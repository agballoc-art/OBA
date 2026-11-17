import React, { useState } from 'react';
import {
  ArrowRight,
  Banknote,
  Minus,
  Plus,
  ShoppingBag,
  Truck,
  Wine,
} from 'lucide-react';
import {
  HERO_IMAGE_PATH,
  OFFICIAL_WHISKY_EMBLEM,
  Product,
  REAL_OBA_SAVOUR_IMAGE,
} from '../types';
import { formatPriceFcfa } from '../utils/format';
import { ObaLogo } from './ObaLogo';

interface CatalogViewProps {
  products: Product[];
  loading: boolean;
  quantities: Record<string, number>;
  onChangeQuantity: (productId: string, packId: string, delta: number) => void;
  onContinue: () => void;
}

const ProductVisual: React.FC<{ src: string; alt: string }> = ({ src, alt }) => {
  const [failed, setFailed] = useState(false);

  if (src === OFFICIAL_WHISKY_EMBLEM) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-[#16110E] via-[#3B1F11] to-[#24130B] flex flex-col items-center justify-center p-6 text-center select-none">
        <svg
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-16 h-16 mb-3"
          aria-hidden="true"
        >
          <circle cx="32" cy="32" r="30" stroke="#D4AF37" strokeWidth="1.5" fill="#16110E" />
          <path
            d="M16 42L20 24L28 31L32 19L36 31L44 24L48 42H16Z"
            stroke="#D4AF37"
            strokeWidth="2"
            strokeLinejoin="round"
            fill="#3B1F11"
          />
          <path d="M18 47H46" stroke="#A97142" strokeWidth="2" strokeLinecap="round" />
          <circle cx="32" cy="15" r="2" fill="#E5C158" />
        </svg>
        <span className="font-display text-2xl sm:text-3xl font-bold tracking-[0.14em] text-[#FAF7F0]">
          OBA IMPÉRIAL
        </span>
        <span className="mt-1 font-display text-xl font-semibold tracking-[0.2em] text-[#D4AF37]">
          WHISKY
        </span>
        <span className="mt-3 text-[11px] tracking-[0.18em] text-[#EFE8DA]/75 uppercase">
          BORN FROM AFRICA ROYALTIES
        </span>
      </div>
    );
  }

  if (failed || !src) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-[#24130B] via-[#3B1F11] to-[#16110E] flex flex-col items-center justify-center p-4 text-center">
        <Wine className="w-10 h-10 text-[#D4AF37] mb-2" />
        <span className="text-xs font-medium text-[#EFE8DA]/80 line-clamp-2">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="w-full h-full object-contain bg-[#120E0B] transition-transform duration-300 group-hover:scale-[1.02]"
    />
  );
};

export const CatalogView: React.FC<CatalogViewProps> = ({
  products,
  loading,
  quantities,
  onChangeQuantity,
  onContinue,
}) => {
  const visibleProducts = products.filter((p) => p.active).slice(0, 2);

  let totalPacks = 0;
  let totalAmount = 0;
  const selectedLines: { name: string; qty: number; lineTotal: number }[] = [];

  for (const product of visibleProducts) {
    const pack = product.packOptions[0];
    if (!pack) continue;
    const qty = quantities[`${product.id}::${pack.id}`] || 0;
    if (qty > 0) {
      totalPacks += qty;
      const lineTotal = qty * pack.price;
      totalAmount += lineTotal;
      selectedLines.push({ name: product.name, qty, lineTotal });
    }
  }

  const scrollToCatalog = () => {
    const el = document.getElementById('catalogue-oba');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className={totalPacks > 0 ? 'pb-28 sm:pb-16' : 'pb-12'}>
      {/* En-tête de présentation */}
      <section className="relative overflow-hidden border-b border-[#A97142]/25 bg-gradient-to-b from-[#0B0908] via-[#16110E] to-[#1C120C]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
              <ObaLogo />

              <div className="space-y-3">
                <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-[#FAF7F0] leading-[1.08] [text-wrap:balance]">
                  Bienvenue chez OBA IMPÉRIAL
                </h1>
                <p className="text-base sm:text-lg text-[#EFE8DA]/85 max-w-xl leading-relaxed">
                  Consultez nos deux références officielles, sélectionnez votre nombre de packs de 10 unités et envoyez votre commande directement à notre équipe sur WhatsApp.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <button
                  type="button"
                  onClick={totalPacks > 0 ? onContinue : scrollToCatalog}
                  className="min-h-[58px] px-7 py-4 rounded-xl bg-[#D4AF37] hover:bg-[#E5C158] active:scale-[0.99] text-[#0B0908] font-bold text-base tracking-wide inline-flex items-center justify-center gap-3 transition-all shadow-lg shadow-black/40 cursor-pointer"
                >
                  <ShoppingBag className="w-5 h-5" />
                  <span>{totalPacks > 0 ? 'CONTINUER MA COMMANDE' : 'PASSER UNE COMMANDE'}</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm text-[#D4AF37]/95 pt-1">
                <span>Tarifs publics en FCFA</span>
                <span aria-hidden="true">·</span>
                <span>Livraison par OBA IMPÉRIAL</span>
                <span aria-hidden="true">·</span>
                <span>Paiement à la livraison</span>
              </div>
            </div>

            <div className="lg:col-span-6 relative min-h-[280px] sm:min-h-[360px] rounded-2xl overflow-hidden border border-[#A97142]/35 bg-[#120E0B]">
              <img
                src={HERO_IMAGE_PATH}
                alt="OBA IMPÉRIAL — Visuel officiel"
                referrerPolicy="no-referrer"
                className="w-full h-full lg:h-full object-cover object-center"
              />
              <div
                className="absolute inset-0 bg-gradient-to-t from-[#0B0908]/85 via-transparent to-transparent pointer-events-none"
                aria-hidden="true"
              />
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs text-[#FAF7F0]/90">
                <span className="font-display text-lg font-semibold tracking-wider text-[#E5C158]">
                  Catalogue officiel OBA IMPÉRIAL
                </span>
                <span>Sans création de compte</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Catalogue officiel — Deux produits uniquement */}
      <section id="catalogue-oba" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14">
        <div className="mb-8 text-center sm:text-left">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#FAF7F0]">
            Nos produits officiels
          </h2>
          <p className="text-sm sm:text-base text-[#EFE8DA]/80 mt-1.5">
            Choisissez le nombre de packs de 10 unités avec les boutons{' '}
            <strong className="text-[#D4AF37]">+</strong> et{' '}
            <strong className="text-[#D4AF37]">−</strong>.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            {[1, 2].map((idx) => (
              <div
                key={idx}
                className="h-[480px] rounded-2xl bg-[#16110E] border border-[#A97142]/20 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            {visibleProducts.map((product) => {
              const pack = product.packOptions[0];
              const currentQty = quantities[`${product.id}::${pack.id}`] || 0;
              const lineTotal = currentQty * pack.price;

              return (
                <article
                  key={product.id}
                  className={`group rounded-2xl overflow-hidden flex flex-col bg-[#FAF7F0] text-[#17120E] transition-all duration-200 ${
                    currentQty > 0
                      ? 'ring-2 ring-[#D4AF37] shadow-xl shadow-black/40'
                      : 'border border-[#A97142]/30 shadow-md shadow-black/20'
                  }`}
                >
                  {/* Visuel du produit */}
                  <div className="relative h-72 sm:h-80 w-full overflow-hidden bg-[#120E0B]">
                    <ProductVisual src={product.imageUrl} alt={product.name} />
                    {!product.available && (
                      <div className="absolute inset-0 bg-[#0B0908]/75 flex items-center justify-center p-4">
                        <span className="px-4 py-2 rounded-xl bg-[#FAF7F0] text-[#17120E] font-bold text-sm">
                          Momentanément indisponible
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Informations & Sélecteur de quantité */}
                  <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between gap-5">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-x-2 text-xs font-medium text-[#7C401A]">
                        <span>{pack.label}</span>
                        <span aria-hidden="true">·</span>
                        <span>{product.available ? 'Disponible' : 'Indisponible'}</span>
                      </div>

                      <h3 className="font-display text-2xl sm:text-3xl font-bold text-[#17120E] leading-snug">
                        {product.name}
                      </h3>
                    </div>

                    <div className="pt-4 border-t border-[#17120E]/10 space-y-4">
                      <div className="flex items-baseline justify-between gap-3">
                        <div>
                          <div className="font-mono text-2xl sm:text-3xl font-bold text-[#17120E] tabular-nums">
                            {formatPriceFcfa(pack.price)}
                          </div>
                          <div className="text-xs font-medium text-[#7C401A] mt-0.5">
                            le pack de 10 unités
                          </div>
                        </div>

                        {currentQty > 0 && (
                          <div className="text-right">
                            <div className="text-[11px] font-semibold text-[#7C401A]">
                              Sous-total
                            </div>
                            <div className="font-mono text-lg font-bold text-[#3B1F11] tabular-nums">
                              {formatPriceFcfa(lineTotal)}
                            </div>
                          </div>
                        )}
                      </div>

                      {product.available ? (
                        <div className="flex items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => onChangeQuantity(product.id, pack.id, -1)}
                            disabled={currentQty === 0}
                            aria-label={`Diminuer ${product.name}`}
                            className={`min-h-[56px] min-w-[56px] rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                              currentQty === 0
                                ? 'bg-[#EFE8DA] text-[#17120E]/30 cursor-not-allowed'
                                : 'bg-[#24130B] text-[#FAF7F0] hover:bg-[#3B1F11] active:scale-95'
                            }`}
                          >
                            <Minus className="w-6 h-6 stroke-[2.5]" />
                          </button>

                          <div
                            className="flex-1 min-h-[56px] rounded-xl bg-[#EFE8DA] flex flex-col items-center justify-center px-3"
                            aria-live="polite"
                          >
                            <span className="font-mono text-2xl font-bold text-[#17120E] tabular-nums leading-none">
                              {currentQty}
                            </span>
                            <span className="text-xs font-semibold text-[#7C401A] mt-1">
                              {currentQty > 1 ? 'packs de 10' : 'pack de 10'}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => onChangeQuantity(product.id, pack.id, 1)}
                            aria-label={`Augmenter ${product.name}`}
                            className="min-h-[56px] min-w-[56px] rounded-xl bg-[#D4AF37] hover:bg-[#E5C158] active:scale-95 text-[#0B0908] flex items-center justify-center transition-all shadow-sm cursor-pointer"
                          >
                            <Plus className="w-6 h-6 stroke-[2.5]" />
                          </button>
                        </div>
                      ) : (
                        <div className="min-h-[56px] rounded-xl bg-[#EFE8DA] text-[#7C401A] text-sm font-semibold flex items-center justify-center">
                          Indisponible actuellement
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Récapitulatif du panier (bureau & tablette) */}
        {totalPacks > 0 && (
          <div className="hidden sm:flex mt-8 rounded-2xl bg-[#16110E] border border-[#D4AF37]/50 p-6 items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#3B1F11] text-[#D4AF37] flex items-center justify-center shrink-0">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-[#EFE8DA]/85">
                  {selectedLines.map((l, idx) => (
                    <span key={l.name}>
                      {idx > 0 && ' · '}
                      <strong className="text-[#FAF7F0]">{l.name}</strong> ({l.qty}{' '}
                      {l.qty > 1 ? 'packs' : 'pack'})
                    </span>
                  ))}
                </p>
                <p className="font-mono text-2xl font-bold text-[#D4AF37] tabular-nums mt-1">
                  Total : {formatPriceFcfa(totalAmount)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onContinue}
              className="min-h-[56px] px-8 py-3.5 rounded-xl bg-[#D4AF37] hover:bg-[#E5C158] text-[#0B0908] font-bold text-base tracking-wide inline-flex items-center gap-3 transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>CONTINUER</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Visuel de marque & engagement livraison / paiement */}
        <div className="mt-12 rounded-2xl overflow-hidden border border-[#A97142]/35 bg-[#16110E] grid grid-cols-1 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-7 relative min-h-[220px]">
            <img
              src={REAL_OBA_SAVOUR_IMAGE}
              alt="3 façons de savourer OBA IMPÉRIAL"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="lg:col-span-5 p-6 sm:p-8 flex flex-col justify-center space-y-5">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-[#24130B] border border-[#D4AF37]/40 text-[#D4AF37] flex items-center justify-center">
                <Truck className="w-5 h-5" />
              </div>
              <h3 className="font-display text-2xl font-bold text-[#FAF7F0]">
                Livraison assurée par OBA IMPÉRIAL
              </h3>
              <p className="text-sm text-[#EFE8DA]/85 leading-relaxed">
                Votre commande est préparée et livrée directement à votre adresse par l&apos;équipe OBA IMPÉRIAL.
              </p>
            </div>

            <div className="pt-4 border-t border-[#FAF7F0]/10 flex items-start gap-3">
              <Banknote className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
              <p className="text-sm text-[#FAF7F0]">
                <strong>Paiement à la livraison :</strong> vous réglez votre commande uniquement à la réception, sans paiement en ligne.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Barre panier fixe sur mobile */}
      {totalPacks > 0 && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#120E0B]/95 backdrop-blur-md border-t border-[#D4AF37]/40 px-4 py-3 shadow-2xl">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-[#EFE8DA]/80">
                <span className="font-mono font-bold text-[#FAF7F0] tabular-nums">{totalPacks}</span>{' '}
                {totalPacks > 1 ? 'packs de 10' : 'pack de 10'}
              </div>
              <div className="font-mono text-base font-bold text-[#D4AF37] tabular-nums truncate">
                {formatPriceFcfa(totalAmount)}
              </div>
            </div>
            <button
              type="button"
              onClick={onContinue}
              className="min-h-[48px] px-6 py-3 rounded-xl bg-[#D4AF37] hover:bg-[#E5C158] active:scale-[0.98] text-[#0B0908] font-bold text-sm tracking-wide inline-flex items-center gap-2 transition-all shrink-0 cursor-pointer"
            >
              <span>CONTINUER</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
