import React, { useState } from 'react';
import {
  ArrowLeft,
  Banknote,
  Calendar,
  CheckCircle2,
  Loader2,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Truck,
  User,
} from 'lucide-react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Order, OrderItem, Product } from '../types';
import {
  formatPriceFcfa,
  generateOrderNumber,
  sanitizeOrderId,
} from '../utils/format';
import { DeliveryMap } from './DeliveryMap';

interface CheckoutViewProps {
  products: Product[];
  quantities: Record<string, number>;
  quotaExceeded: boolean;
  onBackToCatalog: () => void;
  onOrderPrepared: (order: Order) => void;
}

export const CheckoutView: React.FC<CheckoutViewProps> = ({
  products,
  quantities,
  quotaExceeded,
  onBackToCatalog,
  onOrderPrepared,
}) => {
  const officialProducts = products.filter((p) => p.active).slice(0, 2);
  const selectedItems: OrderItem[] = [];

  for (const product of officialProducts) {
    const pack = product.packOptions[0];
    if (!pack) continue;
    const qty = quantities[`${product.id}::${pack.id}`] || 0;
    if (qty > 0) {
      selectedItems.push({
        productId: product.id,
        productName: product.name,
        packId: pack.id,
        unit: pack.label,
        unitPrice: pack.price,
        quantity: qty,
        lineTotal: pack.price * qty,
      });
    }
  }

  const totalAmount = selectedItems.reduce((sum, item) => sum + item.lineTotal, 0);

  // Coordonnées & Livraison
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [requestedDate, setRequestedDate] = useState(() => {
    const tomorrow = new Date(Date.now() + 86400000);
    return tomorrow.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState('');

  // Position GPS facultative
  const [hasGps, setHasGps] = useState(false);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const todayIso = new Date().toISOString().split('T')[0];
  const tomorrowIso = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const handleShareGps = () => {
    setGpsError(null);
    if (!('geolocation' in navigator)) {
      setGpsError(
        "La géolocalisation n'est pas disponible sur cet appareil. Indiquez simplement votre adresse ci-dessous."
      );
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setHasGps(true);
        setGpsLoading(false);
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsError(
            "Autorisation GPS refusée. Ce champ est facultatif : indiquez simplement votre adresse précise."
          );
        } else {
          setGpsError(
            "Signal GPS indisponible pour le moment. Indiquez simplement votre adresse précise."
          );
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (selectedItems.length === 0 || totalAmount <= 0) {
      setFormError('Votre panier est vide. Sélectionnez au moins un pack.');
      return;
    }

    const cleanCustomer = customerName.trim().slice(0, 120);
    const cleanPhone = phone.trim().slice(0, 32);
    const cleanCity = city.trim().slice(0, 100);
    const cleanDistrict = district.trim().slice(0, 100);
    const cleanAddress = addressLine.trim().slice(0, 300);
    const cleanDate = requestedDate.trim().slice(0, 40);
    const cleanNotes = notes.trim().slice(0, 500);

    if (cleanCustomer.length < 2) {
      setFormError('Veuillez entrer votre nom et prénom.');
      return;
    }
    if (cleanPhone.length < 6) {
      setFormError('Veuillez entrer un numéro de téléphone valide.');
      return;
    }
    if (cleanCity.length < 2) {
      setFormError('Veuillez renseigner votre ville.');
      return;
    }
    if (cleanDistrict.length < 2) {
      setFormError('Veuillez renseigner votre quartier.');
      return;
    }
    if (cleanAddress.length < 2) {
      setFormError('Veuillez renseigner votre adresse ou indication précise de livraison.');
      return;
    }
    if (!cleanDate) {
      setFormError('Veuillez choisir une date souhaitée de livraison.');
      return;
    }

    const cityDistrictCombined = `${cleanDistrict}, ${cleanCity}`.slice(0, 160);
    const orderNumber = generateOrderNumber();
    const orderId = sanitizeOrderId(orderNumber);
    const nowIso = new Date().toISOString();

    const orderObject: Order = {
      id: orderId,
      orderNumber,
      status: 'nouvelle',
      paymentStatus: 'en_attente',
      deliveryDateStatus: 'en_attente',
      customerName: cleanCustomer,
      phone: cleanPhone,
      recipientName: cleanCustomer,
      addressText: cleanAddress,
      district: cleanDistrict,
      city: cleanCity,
      cityDistrict: cityDistrictCombined,
      landmark: '',
      hasGps,
      latitude: hasGps && latitude !== null ? Number(latitude.toFixed(6)) : null,
      longitude: hasGps && longitude !== null ? Number(longitude.toFixed(6)) : null,
      deliveryTiming: 'scheduled',
      requestedDate: cleanDate,
      notes: cleanNotes,
      items: selectedItems,
      totalAmount,
      currency: 'FCFA',
      statusHistory: [
        {
          status: 'nouvelle',
          changedAt: nowIso,
          actor: cleanCustomer,
          note: 'Commande préparée pour envoi sur WhatsApp',
        },
      ],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const firestorePayload: Record<string, unknown> = {
      orderNumber,
      status: 'nouvelle',
      paymentStatus: 'en_attente',
      deliveryDateStatus: 'en_attente',
      customerName: cleanCustomer,
      phone: cleanPhone,
      recipientName: cleanCustomer,
      addressText: cleanAddress,
      district: cleanDistrict,
      city: cleanCity,
      cityDistrict: cityDistrictCombined,
      landmark: '',
      hasGps,
      deliveryTiming: 'scheduled',
      requestedDate: cleanDate,
      notes: cleanNotes,
      items: selectedItems,
      totalAmount,
      currency: 'FCFA',
      statusHistory: orderObject.statusHistory,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (hasGps && latitude !== null && longitude !== null) {
      firestorePayload.latitude = Number(latitude.toFixed(6));
      firestorePayload.longitude = Number(longitude.toFixed(6));
    }

    setSubmitting(true);
    try {
      await setDoc(doc(db, 'orders', orderId), firestorePayload);
    } catch (error) {
      // Journalisation silencieuse afin de ne jamais bloquer le client vers WhatsApp
      console.error('Firestore order log warning:', error);
    } finally {
      setSubmitting(false);
    }

    onOrderPrepared(orderObject);
  };

  if (selectedItems.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center space-y-5">
        <h2 className="font-display text-3xl font-bold text-[#FAF7F0]">Votre panier est vide</h2>
        <p className="text-sm text-[#EFE8DA]/80">
          Choisissez d&apos;abord vos packs OBA IMPÉRIAL GIN ou OBA IMPÉRIAL WHISKY.
        </p>
        <button
          type="button"
          onClick={onBackToCatalog}
          className="min-h-[52px] px-7 py-3.5 rounded-xl bg-[#D4AF37] text-[#0B0908] font-bold text-sm inline-flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour aux produits
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <button
        type="button"
        onClick={onBackToCatalog}
        className="min-h-[44px] px-4 py-2 rounded-xl bg-[#16110E] border border-[#A97142]/40 text-[#FAF7F0] text-sm font-medium inline-flex items-center gap-2 hover:bg-[#24130B] transition-colors mb-6 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4 text-[#D4AF37]" />
        Modifier les quantités
      </button>

      <div className="mb-8 space-y-2">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#FAF7F0]">
          Informations de livraison
        </h1>
        <p className="text-sm sm:text-base text-[#EFE8DA]/85 flex items-center gap-2">
          <Truck className="w-4 h-4 text-[#D4AF37] shrink-0" />
          <span>Livraison assurée par l&apos;équipe OBA IMPÉRIAL · Paiement à la livraison.</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* A. COORDONNÉES CLIENT */}
        <section className="rounded-2xl bg-[#FAF7F0] text-[#17120E] p-5 sm:p-7 space-y-5 border border-[#A97142]/30">
          <div className="flex items-center gap-3 pb-3 border-b border-[#17120E]/10">
            <div className="w-10 h-10 rounded-xl bg-[#24130B] text-[#D4AF37] flex items-center justify-center shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold text-[#17120E]">
                1. Vos coordonnées
              </h2>
              <p className="text-xs text-[#7C401A]">Aucun compte ni mot de passe requis</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="oba-customer-name"
                className="block text-sm font-semibold text-[#17120E] mb-1.5"
              >
                Nom et prénom <span className="text-rose-700">*</span>
              </label>
              <div className="relative">
                <User className="w-5 h-5 text-[#7C401A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="oba-customer-name"
                  type="text"
                  required
                  maxLength={120}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ex : Kouassi Jean"
                  className="w-full min-h-[52px] pl-11 pr-4 py-3 rounded-xl bg-white border border-[#17120E]/20 text-[#17120E] placeholder:text-[#17120E]/40 text-base focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="oba-phone"
                className="block text-sm font-semibold text-[#17120E] mb-1.5"
              >
                Numéro de téléphone <span className="text-rose-700">*</span>
              </label>
              <div className="relative">
                <Phone className="w-5 h-5 text-[#7C401A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="oba-phone"
                  type="tel"
                  required
                  maxLength={32}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ex : +229 01 97 00 00 00"
                  className="w-full min-h-[52px] pl-11 pr-4 py-3 rounded-xl bg-white border border-[#17120E]/20 text-[#17120E] placeholder:text-[#17120E]/40 font-mono text-base focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                />
              </div>
            </div>
          </div>
        </section>

        {/* B. LIEU & DATE DE LIVRAISON */}
        <section className="rounded-2xl bg-[#FAF7F0] text-[#17120E] p-5 sm:p-7 space-y-5 border border-[#A97142]/30">
          <div className="flex items-center gap-3 pb-3 border-b border-[#17120E]/10">
            <div className="w-10 h-10 rounded-xl bg-[#24130B] text-[#D4AF37] flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold text-[#17120E]">
                2. Adresse et date de livraison
              </h2>
              <p className="text-xs text-[#7C401A]">
                Indiquez où et quand recevoir votre commande
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="oba-city"
                  className="block text-sm font-semibold text-[#17120E] mb-1.5"
                >
                  Ville <span className="text-rose-700">*</span>
                </label>
                <input
                  id="oba-city"
                  type="text"
                  required
                  maxLength={100}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ex : Cotonou"
                  className="w-full min-h-[52px] px-4 py-3 rounded-xl bg-white border border-[#17120E]/20 text-[#17120E] placeholder:text-[#17120E]/40 text-base focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                />
              </div>

              <div>
                <label
                  htmlFor="oba-district"
                  className="block text-sm font-semibold text-[#17120E] mb-1.5"
                >
                  Quartier <span className="text-rose-700">*</span>
                </label>
                <input
                  id="oba-district"
                  type="text"
                  required
                  maxLength={100}
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="Ex : Akpakpa"
                  className="w-full min-h-[52px] px-4 py-3 rounded-xl bg-white border border-[#17120E]/20 text-[#17120E] placeholder:text-[#17120E]/40 text-base focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="oba-address"
                className="block text-sm font-semibold text-[#17120E] mb-1.5"
              >
                Adresse ou indication précise du lieu de livraison{' '}
                <span className="text-rose-700">*</span>
              </label>
              <input
                id="oba-address"
                type="text"
                required
                maxLength={300}
                value={addressLine}
                onChange={(e) => setAddressLine(e.target.value)}
                placeholder="Ex : Rue pavée après la pharmacie, portail noir"
                className="w-full min-h-[52px] px-4 py-3 rounded-xl bg-white border border-[#17120E]/20 text-[#17120E] placeholder:text-[#17120E]/40 text-base focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              />
            </div>

            {/* GPS facultatif */}
            <div className="space-y-3 pt-1">
              <button
                type="button"
                onClick={handleShareGps}
                disabled={gpsLoading}
                className="w-full min-h-[54px] px-5 py-3.5 rounded-xl bg-[#24130B] hover:bg-[#3B1F11] text-[#FAF7F0] font-bold text-sm sm:text-base flex items-center justify-center gap-3 transition-colors shadow-sm cursor-pointer"
              >
                {gpsLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 text-[#D4AF37] animate-spin" />
                    <span>Recherche de votre position GPS...</span>
                  </>
                ) : (
                  <>
                    <Navigation className="w-5 h-5 text-[#D4AF37]" />
                    <span>
                      {hasGps
                        ? 'ACTUALISER MA POSITION GPS'
                        : 'PARTAGER MA POSITION GPS (FACULTATIF)'}
                    </span>
                  </>
                )}
              </button>

              {gpsError && (
                <div className="rounded-xl bg-amber-100 border border-amber-400 text-amber-950 p-3.5 text-sm">
                  {gpsError}
                </div>
              )}

              {hasGps && latitude !== null && longitude !== null && (
                <div className="rounded-xl bg-[#16110E] text-[#FAF7F0] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
                      <CheckCircle2 className="w-5 h-5 shrink-0" />
                      <span>Position GPS ajoutée</span>
                    </div>
                    <span className="font-mono text-xs text-[#D4AF37] tabular-nums">
                      {latitude.toFixed(5)}, {longitude.toFixed(5)}
                    </span>
                  </div>
                  <DeliveryMap
                    latitude={latitude}
                    longitude={longitude}
                    quotaExceeded={quotaExceeded}
                    onChangePosition={(lat, lng) => {
                      setLatitude(lat);
                      setLongitude(lng);
                    }}
                  />
                </div>
              )}
            </div>

            {/* Date souhaitée */}
            <div className="pt-2 space-y-2">
              <label
                htmlFor="oba-requested-date"
                className="block text-sm font-semibold text-[#17120E]"
              >
                Date souhaitée de livraison <span className="text-rose-700">*</span>
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setRequestedDate(todayIso)}
                  className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold border cursor-pointer ${
                    requestedDate === todayIso
                      ? 'bg-[#24130B] text-[#FAF7F0] border-[#24130B]'
                      : 'bg-white text-[#17120E] border-[#17120E]/20'
                  }`}
                >
                  Aujourd&apos;hui
                </button>
                <button
                  type="button"
                  onClick={() => setRequestedDate(tomorrowIso)}
                  className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold border cursor-pointer ${
                    requestedDate === tomorrowIso
                      ? 'bg-[#24130B] text-[#FAF7F0] border-[#24130B]'
                      : 'bg-white text-[#17120E] border-[#17120E]/20'
                  }`}
                >
                  Demain
                </button>
                <div className="relative flex-1 min-w-[180px]">
                  <Calendar className="w-4 h-4 text-[#7C401A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="oba-requested-date"
                    type="date"
                    required
                    min={todayIso}
                    value={requestedDate}
                    onChange={(e) => setRequestedDate(e.target.value)}
                    className="w-full min-h-[44px] pl-10 pr-3 py-2 rounded-xl bg-white border border-[#17120E]/20 text-[#17120E] font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                  />
                </div>
              </div>
            </div>

            {/* Instructions complémentaires */}
            <div>
              <label
                htmlFor="oba-notes"
                className="block text-sm font-semibold text-[#17120E] mb-1.5"
              >
                Instructions complémentaires (facultatif)
              </label>
              <textarea
                id="oba-notes"
                rows={2}
                maxLength={500}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex : Appeler avant d'arriver"
                className="w-full px-4 py-3 rounded-xl bg-white border border-[#17120E]/20 text-[#17120E] placeholder:text-[#17120E]/40 text-base focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              />
            </div>
          </div>
        </section>

        {/* C. RÉCAPITULATIF & ENVOI VERS WHATSAPP */}
        <section className="rounded-2xl bg-[#16110E] text-[#FAF7F0] p-5 sm:p-7 space-y-5 border border-[#D4AF37]/50">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#FAF7F0]">
            3. Récapitulatif de votre commande
          </h2>

          <div className="divide-y divide-[#FAF7F0]/10 border-y border-[#FAF7F0]/10">
            {selectedItems.map((item) => (
              <div
                key={item.productId}
                className="py-3.5 flex items-start justify-between gap-4 text-sm sm:text-base"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-[#FAF7F0]">{item.productName}</p>
                  <p className="text-xs text-[#EFE8DA]/80 mt-0.5 tabular-nums">
                    {item.quantity} {item.quantity > 1 ? 'packs' : 'pack'} ×{' '}
                    {formatPriceFcfa(item.unitPrice)}
                  </p>
                </div>
                <span className="font-mono font-bold text-[#D4AF37] tabular-nums whitespace-nowrap">
                  {formatPriceFcfa(item.lineTotal)}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-4 pt-1">
            <span className="text-base sm:text-lg font-semibold text-[#EFE8DA]">
              Total à payer à la livraison
            </span>
            <span className="font-mono text-2xl sm:text-3xl font-bold text-[#D4AF37] tabular-nums">
              {formatPriceFcfa(totalAmount)}
            </span>
          </div>

          <div className="rounded-xl bg-[#24130B] border border-[#A97142]/40 p-4 flex items-center gap-3">
            <Banknote className="w-6 h-6 text-[#D4AF37] shrink-0" />
            <p className="text-sm text-[#FAF7F0]">
              <strong>Paiement à la livraison uniquement :</strong> vous vérifiez votre message WhatsApp à l&apos;étape suivante puis vous appuyez sur Envoyer dans WhatsApp.
            </p>
          </div>

          {formError && (
            <div
              role="alert"
              className="rounded-xl bg-rose-950/80 border border-rose-500/60 text-rose-100 p-4 text-sm font-medium"
            >
              {formError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[60px] px-6 py-4 rounded-xl bg-[#D4AF37] hover:bg-[#E5C158] active:scale-[0.99] text-[#0B0908] font-bold text-base sm:text-lg tracking-wide flex items-center justify-center gap-3 transition-all shadow-xl shadow-black/40 cursor-pointer disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>PRÉPARATION EN COURS...</span>
              </>
            ) : (
              <>
                <MessageCircle className="w-6 h-6" />
                <span>PRÉPARER LE MESSAGE WHATSAPP</span>
              </>
            )}
          </button>
        </section>
      </form>
    </div>
  );
};
