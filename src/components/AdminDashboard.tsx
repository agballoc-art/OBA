import React, { useEffect, useMemo, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import {
  Ban,
  Banknote,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  ChefHat,
  Clock,
  Edit3,
  Eye,
  EyeOff,
  History,
  ImagePlus,
  Loader2,
  Lock,
  LogOut,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Truck,
  UserPlus,
  X,
} from 'lucide-react';
import {
  auth,
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  storage,
} from '../firebase';
import { OBA_WHATSAPP_CONFIG, OFFICIAL_PRODUCT_IDS } from '../config/obaConfig';
import {
  AdminUser,
  DELIVERY_DATE_STATUS_META,
  DELIVERY_TIMING_LABELS,
  OFFICIAL_PRODUCTS,
  OFFICIAL_WHISKY_EMBLEM,
  Order,
  ORDER_STATUS_META,
  OrderStatus,
  PAYMENT_STATUS_META,
  PaymentStatus,
  Product,
  STUDIO_IMAGE_PRESETS,
} from '../types';
import {
  compressImageToDataUrl,
  formatFirestoreTimestamp,
  formatPriceFcfa,
  getGoogleMapsUrl,
  normalizeOfficialWhatsappNumber,
} from '../utils/format';

interface AdminDashboardProps {
  products: Product[];
  officialWhatsappNumber: string;
}

type AdminTab = 'orders' | 'products' | 'whatsapp' | 'admins';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  products,
  officialWhatsappNumber,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAuthorizedAdmin, setIsAuthorizedAdmin] = useState(false);
  const [checkingRole, setCheckingRole] = useState(false);

  // Connexion
  const [showEmailLogin, setShowEmailLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Onglets & filtres commandes
  const [activeTab, setActiveTab] = useState<AdminTab>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  // Proposition d'une autre date de livraison
  const [proposingDateOrderId, setProposingDateOrderId] = useState<string | null>(null);
  const [proposedDateValue, setProposedDateValue] = useState('');
  const [proposedDateNote, setProposedDateNote] = useState('');

  // Administrateurs
  const [adminsList, setAdminsList] = useState<AdminUser[]>([]);
  const [newAdminUid, setNewAdminUid] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [adminActionMsg, setAdminActionMsg] = useState<string | null>(null);

  // Modale édition produit officiel (photo & disponibilité uniquement)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [prodImageUrl, setProdImageUrl] = useState('');
  const [prodActive, setProdActive] = useState(true);
  const [prodAvailable, setProdAvailable] = useState(true);
  const [prodSaving, setProdSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [prodError, setProdError] = useState<string | null>(null);
  const [syncingCatalog, setSyncingCatalog] = useState(false);
  const [syncCatalogMsg, setSyncCatalogMsg] = useState<string | null>(null);

  // Configuration WhatsApp officielle
  const [whatsappInput, setWhatsappInput] = useState(officialWhatsappNumber);
  const [whatsappSaving, setWhatsappSaving] = useState(false);
  const [whatsappFeedback, setWhatsappFeedback] = useState<string | null>(null);

  useEffect(() => {
    setWhatsappInput(officialWhatsappNumber);
  }, [officialWhatsappNumber]);

  // Surveiller Firebase Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);

      if (!currentUser) {
        setIsAuthorizedAdmin(false);
        return;
      }

      setCheckingRole(true);
      try {
        if (
          currentUser.email === BOOTSTRAPPED_ADMIN_EMAIL &&
          currentUser.emailVerified
        ) {
          setIsAuthorizedAdmin(true);
        } else {
          const adminSnap = await getDoc(doc(db, 'admins', currentUser.uid));
          setIsAuthorizedAdmin(adminSnap.exists());
        }
      } catch {
        setIsAuthorizedAdmin(false);
      } finally {
        setCheckingRole(false);
      }
    });

    return () => unsub();
  }, []);

  // Commandes en temps réel
  useEffect(() => {
    if (!authReady || !isAuthorizedAdmin) {
      setOrders([]);
      return;
    }

    setOrdersLoading(true);
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const loaded: Order[] = snapshot.docs.map((d) => {
          const raw = d.data() as Partial<Order>;
          return {
            id: d.id,
            orderNumber: raw.orderNumber || d.id,
            status: raw.status || 'nouvelle',
            paymentStatus: raw.paymentStatus || 'en_attente',
            deliveryDateStatus: raw.deliveryDateStatus || 'en_attente',
            confirmedDeliveryDate: raw.confirmedDeliveryDate || '',
            deliveryScheduleNote: raw.deliveryScheduleNote || '',
            customerName: raw.customerName || '',
            phone: raw.phone || '',
            recipientName: raw.recipientName || raw.customerName || '',
            addressText: raw.addressText || '',
            district: raw.district || '',
            city: raw.city || '',
            cityDistrict: raw.cityDistrict || '',
            landmark: raw.landmark || '',
            hasGps: Boolean(raw.hasGps),
            latitude: raw.latitude ?? null,
            longitude: raw.longitude ?? null,
            deliveryTiming: raw.deliveryTiming || 'scheduled',
            requestedDate: raw.requestedDate || '',
            notes: raw.notes || '',
            items: Array.isArray(raw.items) ? raw.items : [],
            totalAmount: typeof raw.totalAmount === 'number' ? raw.totalAmount : 0,
            currency: raw.currency || 'FCFA',
            statusHistory: Array.isArray(raw.statusHistory) ? raw.statusHistory : [],
            adminNote: raw.adminNote || '',
            createdAt: raw.createdAt,
            updatedAt: raw.updatedAt,
          };
        });
        setOrders(loaded);
        setOrdersLoading(false);
      },
      (error) => {
        setOrdersLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'orders');
      }
    );

    return () => unsub();
  }, [authReady, isAuthorizedAdmin]);

  // Liste administrateurs
  useEffect(() => {
    if (!authReady || !isAuthorizedAdmin) {
      setAdminsList([]);
      return;
    }

    const unsub = onSnapshot(
      collection(db, 'admins'),
      (snapshot) => {
        const list: AdminUser[] = snapshot.docs.map((d) => ({
          uid: d.id,
          ...(d.data() as Omit<AdminUser, 'uid'>),
        }));
        setAdminsList(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'admins');
      }
    );

    return () => unsub();
  }, [authReady, isAuthorizedAdmin]);

  const kpis = useMemo(() => {
    const counts = {
      total: orders.length,
      nouvelle: 0,
      confirmee: 0,
      en_preparation: 0,
      en_livraison: 0,
      livree: 0,
      payee: 0,
      refusee: 0,
    };
    for (const o of orders) {
      if (o.status in counts) {
        counts[o.status] += 1;
      }
      if (o.paymentStatus === 'paye') {
        counts.payee += 1;
      }
    }
    return counts;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (paymentFilter !== 'all' && o.paymentStatus !== paymentFilter) return false;
      if (!q) return true;
      return (
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.phone.toLowerCase().includes(q) ||
        o.cityDistrict.toLowerCase().includes(q) ||
        o.addressText.toLowerCase().includes(q)
      );
    });
  }, [orders, statusFilter, paymentFilter, searchQuery]);

  const handleGoogleLogin = async () => {
    setLoginError(null);
    setLoginBusy(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setLoginError(
        err instanceof Error
          ? err.message
          : 'Connexion Google impossible. Réessayez.'
      );
    } finally {
      setLoginBusy(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('operation-not-allowed')) {
        setLoginError(
          "La connexion par identifiant et mot de passe n'est pas encore activée dans Firebase Console (Authentication → Méthodes de connexion → E-mail/Mot de passe)."
        );
      } else if (
        msg.includes('invalid-credential') ||
        msg.includes('wrong-password') ||
        msg.includes('user-not-found')
      ) {
        setLoginError('Identifiant ou mot de passe incorrect.');
      } else {
        setLoginError('Connexion refusée. Vérifiez vos identifiants.');
      }
    } finally {
      setLoginBusy(false);
    }
  };

  const handleUpdateOrderStatus = async (order: Order, nextStatus: OrderStatus) => {
    if (order.status === nextStatus) return;
    setUpdatingOrderId(order.id);
    const actorLabel = user?.email || user?.displayName || 'Administrateur';
    const nextHistory = [
      ...(Array.isArray(order.statusHistory) ? order.statusHistory : []).slice(-38),
      {
        status: nextStatus,
        changedAt: new Date().toISOString(),
        actor: actorLabel.slice(0, 160),
        note: `Statut livraison : ${ORDER_STATUS_META[nextStatus].label}`,
      },
    ];

    const orderPath = `orders/${order.id}`;
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        status: nextStatus,
        statusHistory: nextHistory,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, orderPath);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleUpdatePaymentStatus = async (
    order: Order,
    nextPayment: PaymentStatus
  ) => {
    if (order.paymentStatus === nextPayment) return;
    setUpdatingOrderId(order.id);
    const actorLabel = user?.email || user?.displayName || 'Administrateur';
    const nextHistory = [
      ...(Array.isArray(order.statusHistory) ? order.statusHistory : []).slice(-38),
      {
        status: `paiement_${nextPayment}`,
        changedAt: new Date().toISOString(),
        actor: actorLabel.slice(0, 160),
        note: `Paiement : ${PAYMENT_STATUS_META[nextPayment].label}`,
      },
    ];

    const orderPath = `orders/${order.id}`;
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        paymentStatus: nextPayment,
        statusHistory: nextHistory,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, orderPath);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleConfirmRequestedDate = async (order: Order) => {
    setUpdatingOrderId(order.id);
    const actorLabel = user?.email || user?.displayName || 'Administrateur';
    const confirmedDateText =
      order.deliveryTiming === 'scheduled'
        ? order.requestedDate
        : DELIVERY_TIMING_LABELS[order.deliveryTiming] || order.requestedDate;

    const nextHistory = [
      ...(Array.isArray(order.statusHistory) ? order.statusHistory : []).slice(-38),
      {
        status: 'date_confirmee',
        changedAt: new Date().toISOString(),
        actor: actorLabel.slice(0, 160),
        note: `Date de livraison confirmée : ${confirmedDateText}`,
      },
    ];

    const orderPath = `orders/${order.id}`;
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        deliveryDateStatus: 'confirmee',
        confirmedDeliveryDate: confirmedDateText.slice(0, 60),
        deliveryScheduleNote: 'Créneau confirmé par l’équipe OBA IMPÉRIAL',
        statusHistory: nextHistory,
        updatedAt: serverTimestamp(),
      });
      setProposingDateOrderId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, orderPath);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleProposeAnotherDate = async (order: Order) => {
    if (!proposedDateValue.trim()) return;
    setUpdatingOrderId(order.id);
    const actorLabel = user?.email || user?.displayName || 'Administrateur';
    const cleanDate = proposedDateValue.trim().slice(0, 60);
    const cleanNote = proposedDateNote.trim().slice(0, 300);

    const nextHistory = [
      ...(Array.isArray(order.statusHistory) ? order.statusHistory : []).slice(-38),
      {
        status: 'autre_date_proposee',
        changedAt: new Date().toISOString(),
        actor: actorLabel.slice(0, 160),
        note: `Nouvelle date proposée : ${cleanDate}${cleanNote ? ` (${cleanNote})` : ''}`,
      },
    ];

    const orderPath = `orders/${order.id}`;
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        deliveryDateStatus: 'autre_date_proposee',
        confirmedDeliveryDate: cleanDate,
        deliveryScheduleNote: cleanNote,
        statusHistory: nextHistory,
        updatedAt: serverTimestamp(),
      });
      setProposingDateOrderId(null);
      setProposedDateValue('');
      setProposedDateNote('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, orderPath);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Nettoie toutes les anciennes données fictives Firestore et synchronise les 2 produits officiels
  const handleCleanAndSyncOfficialCatalog = async () => {
    setSyncingCatalog(true);
    setSyncCatalogMsg(null);
    try {
      // 1. Supprimer toutes les anciennes catégories inventées
      const catSnap = await getDocs(collection(db, 'categories'));
      for (const catDoc of catSnap.docs) {
        await deleteDoc(doc(db, 'categories', catDoc.id));
      }

      // 2. Supprimer tout produit qui ne fait pas partie des 2 références officielles
      const prodSnap = await getDocs(collection(db, 'products'));
      let removedCount = 0;
      for (const prodDoc of prodSnap.docs) {
        if (!OFFICIAL_PRODUCT_IDS.includes(prodDoc.id as (typeof OFFICIAL_PRODUCT_IDS)[number])) {
          await deleteDoc(doc(db, 'products', prodDoc.id));
          removedCount += 1;
        }
      }

      // 3. Enregistrer / mettre à jour exactement les 2 produits officiels
      for (const official of OFFICIAL_PRODUCTS) {
        const existingSnap = await getDoc(doc(db, 'products', official.id));
        const existingData = existingSnap.exists()
          ? (existingSnap.data() as Partial<Product>)
          : null;
        const preserveUploadedImage =
          existingData?.imageUrl &&
          !existingData.imageUrl.includes('/src/assets/images/')
            ? existingData.imageUrl
            : official.imageUrl;

        await setDoc(doc(db, 'products', official.id), {
          name: official.name,
          description: official.description,
          categoryId: official.categoryId,
          categoryName: official.categoryName,
          price: official.price,
          unit: official.unit,
          packOptions: official.packOptions,
          imageUrl: preserveUploadedImage,
          active: existingData ? existingData.active !== false : true,
          available: existingData ? existingData.available !== false : true,
          isDemoPrice: false,
          sortOrder: official.sortOrder,
          createdAt: existingData?.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      setSyncCatalogMsg(
        removedCount > 0 || catSnap.size > 0
          ? `Base nettoyée (${removedCount} ancien(s) produit(s) et ${catSnap.size} catégorie(s) supprimés) et catalogue officiel synchronisé.`
          : 'Catalogue officiel synchronisé (2 produits uniquement).'
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'products');
    } finally {
      setSyncingCatalog(false);
    }
  };

  // Édition photo / stock d'un produit officiel uniquement
  const openEditOfficialProduct = (product: Product) => {
    setEditingProduct(product);
    setProdImageUrl(product.imageUrl);
    setProdActive(product.active);
    setProdAvailable(product.available);
    setProdError(null);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProdError(null);
    setUploadingPhoto(true);
    try {
      try {
        const storagePath = `products/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, file);
        const downloadUrl = await getDownloadURL(storageRef);
        setProdImageUrl(downloadUrl);
      } catch {
        const dataUrl = await compressImageToDataUrl(file);
        if (dataUrl.length > 290000) {
          throw new Error('Image trop volumineuse. Choisissez un fichier plus léger.');
        }
        setProdImageUrl(dataUrl);
      }
    } catch (err) {
      setProdError(err instanceof Error ? err.message : 'Erreur lors du chargement de la photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveOfficialProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    const officialRef = OFFICIAL_PRODUCTS.find((p) => p.id === editingProduct.id);
    if (!officialRef) return;

    const cleanImg = prodImageUrl.trim().slice(0, 300000) || officialRef.imageUrl;
    setProdSaving(true);
    const path = `products/${officialRef.id}`;

    try {
      const existingSnap = await getDoc(doc(db, 'products', officialRef.id));
      await setDoc(doc(db, 'products', officialRef.id), {
        name: officialRef.name,
        description: officialRef.description,
        categoryId: officialRef.categoryId,
        categoryName: officialRef.categoryName,
        price: officialRef.price,
        unit: officialRef.unit,
        packOptions: officialRef.packOptions,
        imageUrl: cleanImg,
        active: prodActive,
        available: prodAvailable,
        isDemoPrice: false,
        sortOrder: officialRef.sortOrder,
        createdAt: existingSnap.exists()
          ? existingSnap.data().createdAt || serverTimestamp()
          : serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setEditingProduct(null);
    } catch (error) {
      setProdSaving(false);
      handleFirestoreError(error, OperationType.WRITE, path);
    } finally {
      setProdSaving(false);
    }
  };

  const handleToggleProductField = async (
    product: Product,
    field: 'active' | 'available'
  ) => {
    const officialRef = OFFICIAL_PRODUCTS.find((p) => p.id === product.id);
    if (!officialRef) return;
    const path = `products/${product.id}`;
    try {
      const existingSnap = await getDoc(doc(db, 'products', product.id));
      if (!existingSnap.exists()) {
        await setDoc(doc(db, 'products', product.id), {
          ...officialRef,
          [field]: !product[field],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(doc(db, 'products', product.id), {
          [field]: !product[field],
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  // Enregistrer le numéro WhatsApp officiel dans Firestore settings/whatsapp
  const handleSaveWhatsappNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    setWhatsappFeedback(null);
    const digits = normalizeOfficialWhatsappNumber(whatsappInput);
    if (digits.length > 0 && digits.length < 8) {
      setWhatsappFeedback(
        'Le numéro doit contenir l’indicatif pays et les chiffres (ex : 2290197000000).'
      );
      return;
    }

    setWhatsappSaving(true);
    const actorLabel = (user?.email || user?.displayName || 'Administrateur').slice(0, 160);
    const path = 'settings/whatsapp';
    try {
      await setDoc(doc(db, 'settings', 'whatsapp'), {
        whatsappNumber: digits,
        updatedBy: actorLabel,
        updatedAt: serverTimestamp(),
      });
      setWhatsappInput(digits);
      setWhatsappFeedback(
        digits
          ? `Numéro WhatsApp officiel enregistré : +${digits}`
          : 'Numéro WhatsApp effacé.'
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    } finally {
      setWhatsappSaving(false);
    }
  };

  // Gestion liste administrateurs
  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminActionMsg(null);
    const uid = newAdminUid.trim();
    const mail = newAdminEmail.trim();
    const name = newAdminName.trim() || 'Administrateur OBA';
    if (!/^[a-zA-Z0-9_-]{3,128}$/.test(uid)) {
      setAdminActionMsg("Format d'identifiant UID Firebase invalide.");
      return;
    }
    if (mail.length < 3) {
      setAdminActionMsg("Veuillez saisir l'adresse e-mail de l'administrateur.");
      return;
    }
    const path = `admins/${uid}`;
    try {
      await setDoc(doc(db, 'admins', uid), {
        email: mail.slice(0, 160),
        displayName: name.slice(0, 100),
        role: 'admin',
        createdAt: serverTimestamp(),
      });
      setNewAdminUid('');
      setNewAdminEmail('');
      setNewAdminName('');
      setAdminActionMsg('Administrateur ajouté avec succès.');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const handleRemoveAdmin = async (uid: string) => {
    const path = `admins/${uid}`;
    try {
      await deleteDoc(doc(db, 'admins', uid));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  // ---------------------------------------------------------------------------
  // Écrans d'authentification
  // ---------------------------------------------------------------------------
  if (!authReady || checkingRole) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin mx-auto" />
        <p className="text-sm text-[#EFE8DA]/80">Vérification de la session administrateur...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-10 sm:py-14">
        <div className="rounded-2xl bg-[#16110E] border border-[#A97142]/40 p-6 sm:p-8 space-y-6 shadow-2xl">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 mx-auto rounded-xl bg-[#24130B] border border-[#D4AF37]/40 text-[#D4AF37] flex items-center justify-center">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="font-display text-3xl font-bold text-[#FAF7F0]">
              Espace Administrateur
            </h1>
            <p className="text-sm text-[#EFE8DA]/75">
              Accès réservé à l&apos;équipe OBA IMPÉRIAL.
            </p>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loginBusy}
            className="w-full min-h-[52px] px-5 py-3 rounded-xl bg-[#D4AF37] hover:bg-[#E5C158] text-[#0B0908] font-bold text-sm flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
          >
            <ShieldCheck className="w-5 h-5" />
            <span>Se connecter avec Google</span>
          </button>

          <div className="relative flex items-center py-1">
            <div className="flex-grow border-t border-[#FAF7F0]/15" />
            <button
              type="button"
              onClick={() => setShowEmailLogin((prev) => !prev)}
              className="mx-3 text-xs text-[#D4AF37] hover:underline cursor-pointer"
            >
              Ou par identifiant &amp; mot de passe
            </button>
            <div className="flex-grow border-t border-[#FAF7F0]/15" />
          </div>

          {showEmailLogin && (
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div>
                <label
                  htmlFor="admin-email"
                  className="block text-xs font-semibold text-[#EFE8DA]/90 mb-1.5"
                >
                  Identifiant (e-mail)
                </label>
                <input
                  id="admin-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@obaimperial.com"
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-[#0B0908] border border-[#A97142]/40 text-[#FAF7F0] placeholder:text-[#EFE8DA]/30 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                />
              </div>

              <div>
                <label
                  htmlFor="admin-password"
                  className="block text-xs font-semibold text-[#EFE8DA]/90 mb-1.5"
                >
                  Mot de passe
                </label>
                <input
                  id="admin-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-[#0B0908] border border-[#A97142]/40 text-[#FAF7F0] placeholder:text-[#EFE8DA]/30 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                />
              </div>

              <button
                type="submit"
                disabled={loginBusy}
                className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#24130B] hover:bg-[#3B1F11] border border-[#D4AF37]/40 text-[#FAF7F0] font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                {loginBusy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Lock className="w-4 h-4 text-[#D4AF37]" />
                )}
                <span>Connexion par mot de passe</span>
              </button>
            </form>
          )}

          {loginError && (
            <div
              role="alert"
              className="rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-100 p-3.5 text-xs leading-relaxed"
            >
              {loginError}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!isAuthorizedAdmin) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="rounded-2xl bg-[#16110E] border border-rose-500/40 p-6 sm:p-8 text-center space-y-4">
          <Ban className="w-10 h-10 text-rose-400 mx-auto" />
          <h2 className="font-display text-2xl font-bold text-[#FAF7F0]">
            Accès administrateur requis
          </h2>
          <p className="text-sm text-[#EFE8DA]/80 leading-relaxed">
            Le compte <strong className="text-[#FAF7F0]">{user.email}</strong> n&apos;est pas encore autorisé dans la liste des administrateurs OBA IMPÉRIAL.
          </p>
          <div className="rounded-xl bg-[#0B0908] border border-[#A97142]/30 p-3 text-left">
            <span className="text-[11px] text-[#D4AF37] block">Votre identifiant Firebase :</span>
            <code className="font-mono text-xs text-[#FAF7F0] break-all select-all">
              {user.uid}
            </code>
          </div>
          <button
            type="button"
            onClick={() => void signOut(auth)}
            className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#24130B] hover:bg-[#3B1F11] text-[#FAF7F0] text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-[#D4AF37]" />
            <span>Se déconnecter</span>
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Console Administrateur Autorisée
  // ---------------------------------------------------------------------------
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
      {/* En-tête & Navigation Admin */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-[#A97142]/25">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#FAF7F0]">
            Console de gestion OBA IMPÉRIAL
          </h1>
          <p className="text-xs sm:text-sm text-[#EFE8DA]/75 mt-1">
            Connecté : <span className="text-[#D4AF37] font-medium">{user.email}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex flex-wrap p-1 rounded-xl bg-[#16110E] border border-[#A97142]/30 gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('orders')}
              className={`min-h-[42px] px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'orders'
                  ? 'bg-[#D4AF37] text-[#0B0908]'
                  : 'text-[#EFE8DA]/80 hover:text-[#FAF7F0]'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Commandes ({orders.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('products')}
              className={`min-h-[42px] px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'products'
                  ? 'bg-[#D4AF37] text-[#0B0908]'
                  : 'text-[#EFE8DA]/80 hover:text-[#FAF7F0]'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Produits officiels (2)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('whatsapp')}
              className={`min-h-[42px] px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'whatsapp'
                  ? 'bg-[#D4AF37] text-[#0B0908]'
                  : 'text-[#EFE8DA]/80 hover:text-[#FAF7F0]'
              }`}
            >
              <MessageCircle className="w-4 h-4" />
              <span>Configuration WhatsApp</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('admins')}
              className={`min-h-[42px] px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'admins'
                  ? 'bg-[#D4AF37] text-[#0B0908]'
                  : 'text-[#EFE8DA]/80 hover:text-[#FAF7F0]'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Accès</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => void signOut(auth)}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#16110E] border border-[#A97142]/40 text-[#EFE8DA] hover:text-[#FAF7F0] text-xs sm:text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-[#D4AF37]" />
            <span>Déconnexion</span>
          </button>
        </div>
      </div>

      {/* Indicateurs KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {(
          [
            { key: 'all', type: 'delivery', label: 'Total commandes', count: kpis.total },
            { key: 'nouvelle', type: 'delivery', label: 'Nouvelles', count: kpis.nouvelle },
            { key: 'confirmee', type: 'delivery', label: 'Confirmées', count: kpis.confirmee },
            { key: 'en_preparation', type: 'delivery', label: 'En préparation', count: kpis.en_preparation },
            { key: 'en_livraison', type: 'delivery', label: 'En livraison', count: kpis.en_livraison },
            { key: 'livree', type: 'delivery', label: 'Livrées', count: kpis.livree },
            { key: 'paye', type: 'payment', label: 'Payées', count: kpis.payee },
          ] as const
        ).map((kpi) => {
          const isActive =
            activeTab === 'orders' &&
            (kpi.type === 'payment'
              ? paymentFilter === 'paye'
              : statusFilter === kpi.key && paymentFilter === 'all');

          return (
            <button
              key={`${kpi.type}-${kpi.key}`}
              type="button"
              onClick={() => {
                setActiveTab('orders');
                if (kpi.type === 'payment') {
                  setStatusFilter('all');
                  setPaymentFilter('paye');
                } else {
                  setPaymentFilter('all');
                  setStatusFilter(kpi.key);
                }
              }}
              className={`rounded-xl p-4 text-left border transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#24130B] border-[#D4AF37] ring-1 ring-[#D4AF37]'
                  : 'bg-[#16110E] border-[#A97142]/25 hover:border-[#A97142]/60'
              }`}
            >
              <span className="text-xs text-[#EFE8DA]/75 block truncate">{kpi.label}</span>
              <span className="font-mono text-2xl font-bold text-[#FAF7F0] tabular-nums mt-1 block">
                {kpi.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ONGLET 1 : COMMANDES */}
      {activeTab === 'orders' && (
        <div className="space-y-5">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-[#D4AF37] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher par numéro, client, téléphone ou ville..."
                  className="w-full min-h-[46px] pl-10 pr-4 py-2 rounded-xl bg-[#16110E] border border-[#A97142]/30 text-sm text-[#FAF7F0] placeholder:text-[#EFE8DA]/40 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-[#EFE8DA]/70 mr-1">Paiement :</span>
                {(
                  [
                    { id: 'all', label: 'Tous' },
                    { id: 'en_attente', label: 'En attente' },
                    { id: 'partiel', label: 'Partiel' },
                    { id: 'paye', label: 'Payées' },
                  ] as const
                ).map((pf) => (
                  <button
                    key={pf.id}
                    type="button"
                    onClick={() => setPaymentFilter(pf.id)}
                    className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      paymentFilter === pf.id
                        ? 'bg-emerald-700 text-white'
                        : 'bg-[#16110E] text-[#EFE8DA]/80 border border-[#A97142]/25 hover:border-[#A97142]/60'
                    }`}
                  >
                    {pf.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-[#EFE8DA]/70 mr-1">Livraison :</span>
              {(
                [
                  { id: 'all', label: 'Toutes' },
                  { id: 'nouvelle', label: 'Nouvelles' },
                  { id: 'confirmee', label: 'Confirmées' },
                  { id: 'en_preparation', label: 'Préparation' },
                  { id: 'en_livraison', label: 'En livraison' },
                  { id: 'livree', label: 'Livrées' },
                  { id: 'refusee', label: 'Refusées' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    statusFilter === tab.id
                      ? 'bg-[#D4AF37] text-[#0B0908]'
                      : 'bg-[#16110E] text-[#EFE8DA]/80 border border-[#A97142]/25 hover:border-[#A97142]/60'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {ordersLoading ? (
            <div className="space-y-4">
              {[1, 2].map((n) => (
                <div
                  key={n}
                  className="h-44 rounded-2xl bg-[#16110E] border border-[#A97142]/20 animate-pulse"
                />
              ))}
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="rounded-2xl bg-[#16110E] border border-[#A97142]/25 p-10 text-center space-y-2">
              <ShoppingBag className="w-10 h-10 text-[#D4AF37] mx-auto" />
              <h3 className="font-display text-2xl font-bold text-[#FAF7F0]">
                Aucune commande correspondante
              </h3>
              <p className="text-sm text-[#EFE8DA]/75">
                Les commandes clients apparaîtront ici en temps réel.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {filteredOrders.map((order) => {
                const statusMeta = ORDER_STATUS_META[order.status] || ORDER_STATUS_META.nouvelle;
                const paymentMeta =
                  PAYMENT_STATUS_META[order.paymentStatus] || PAYMENT_STATUS_META.en_attente;
                const dateStatusMeta =
                  DELIVERY_DATE_STATUS_META[order.deliveryDateStatus] ||
                  DELIVERY_DATE_STATUS_META.en_attente;
                const mapsUrl = getGoogleMapsUrl(
                  order.hasGps,
                  order.latitude,
                  order.longitude,
                  order.addressText || order.cityDistrict
                );
                const isUpdating = updatingOrderId === order.id;
                const showHistory = expandedHistoryId === order.id;
                const isProposingDate = proposingDateOrderId === order.id;

                return (
                  <article
                    key={order.id}
                    className="rounded-2xl bg-[#FAF7F0] text-[#17120E] border border-[#A97142]/35 overflow-hidden shadow-lg"
                  >
                    <div className="bg-[#16110E] text-[#FAF7F0] px-5 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-mono text-base font-bold text-[#D4AF37] tabular-nums">
                          {order.orderNumber}
                        </span>
                        <span aria-hidden="true" className="text-[#EFE8DA]/40">
                          ·
                        </span>
                        <span className="text-xs text-[#EFE8DA]/80 tabular-nums">
                          {formatFirestoreTimestamp(order.createdAt)}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-bold ${statusMeta.surfaceBg} ${statusMeta.textColor} ${statusMeta.borderColor}`}
                        >
                          <Truck className="w-3.5 h-3.5" />
                          {statusMeta.label}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-bold ${paymentMeta.surfaceBg} ${paymentMeta.textColor} ${paymentMeta.borderColor}`}
                        >
                          <Banknote className="w-3.5 h-3.5" />
                          {paymentMeta.label}
                        </span>
                        <span className="font-mono text-lg font-bold text-[#FAF7F0] tabular-nums ml-1">
                          {formatPriceFcfa(order.totalAmount)}
                        </span>
                      </div>
                    </div>

                    <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
                      <div className="lg:col-span-5 space-y-4 text-sm">
                        <div>
                          <span className="text-xs font-semibold text-[#7C401A] uppercase tracking-wider block">
                            Client
                          </span>
                          <p className="text-lg font-bold text-[#17120E] mt-0.5">
                            {order.customerName}
                          </p>
                          <a
                            href={`tel:${order.phone}`}
                            className="inline-flex items-center gap-1.5 mt-1.5 font-mono text-sm font-semibold text-[#24130B] underline hover:text-[#7C401A]"
                          >
                            <Phone className="w-4 h-4 text-[#7C401A]" />
                            {order.phone}
                          </a>
                        </div>

                        <div className="pt-3 border-t border-[#17120E]/10 space-y-1.5">
                          <span className="text-xs font-semibold text-[#7C401A] uppercase tracking-wider block">
                            Localisation de livraison
                          </span>
                          <p className="text-sm text-[#17120E]">
                            <strong>Adresse :</strong> {order.addressText}
                          </p>
                          {(order.district || order.city) && (
                            <p className="text-xs text-[#4A2715]">
                              <strong>Quartier :</strong> {order.district || '—'} ·{' '}
                              <strong>Ville :</strong> {order.city || '—'}
                            </p>
                          )}
                          {order.hasGps &&
                            typeof order.latitude === 'number' &&
                            typeof order.longitude === 'number' && (
                              <p className="font-mono text-xs text-[#4A2715] tabular-nums">
                                GPS : {order.latitude.toFixed(6)}, {order.longitude.toFixed(6)}
                              </p>
                            )}
                          {order.notes && (
                            <p className="text-xs text-[#4A2715] bg-[#EFE8DA] rounded-lg p-2.5 mt-1">
                              <strong>Instructions :</strong> {order.notes}
                            </p>
                          )}

                          <div className="pt-1.5">
                            <a
                              href={mapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#24130B] hover:bg-[#3B1F11] text-[#FAF7F0] text-xs font-bold inline-flex items-center gap-2 transition-colors"
                            >
                              <MapPin className="w-4 h-4 text-[#D4AF37]" />
                              <span>VOIR LA LOCALISATION</span>
                            </a>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-[#17120E]/10 space-y-2.5">
                          <span className="text-xs font-semibold text-[#7C401A] uppercase tracking-wider block">
                            Date de livraison
                          </span>
                          <div className="rounded-xl bg-[#EFE8DA] p-3 space-y-1 text-xs">
                            <p>
                              <strong>Date souhaitée :</strong>{' '}
                              {order.deliveryTiming === 'scheduled'
                                ? order.requestedDate
                                : DELIVERY_TIMING_LABELS[order.deliveryTiming] || order.requestedDate}
                            </p>
                            <p className="text-[#7C401A] font-semibold">
                              Statut date : {dateStatusMeta.label}
                            </p>
                            {order.confirmedDeliveryDate && (
                              <p className="text-[#17120E] font-bold">
                                Date retenue : {order.confirmedDeliveryDate}
                              </p>
                            )}
                            {order.deliveryScheduleNote && (
                              <p className="text-[#4A2715]">{order.deliveryScheduleNote}</p>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => void handleConfirmRequestedDate(order)}
                              className="min-h-[40px] px-3 py-1.5 rounded-lg bg-[#24130B] hover:bg-[#3B1F11] text-[#FAF7F0] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <CalendarCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
                              <span>Confirmer la date demandée</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                if (isProposingDate) {
                                  setProposingDateOrderId(null);
                                } else {
                                  setProposingDateOrderId(order.id);
                                  setProposedDateValue(order.confirmedDeliveryDate || '');
                                  setProposedDateNote(order.deliveryScheduleNote || '');
                                }
                              }}
                              className="min-h-[40px] px-3 py-1.5 rounded-lg bg-white border border-[#17120E]/20 hover:bg-[#EFE8DA] text-[#17120E] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <CalendarClock className="w-3.5 h-3.5 text-[#7C401A]" />
                              <span>Proposer une autre date</span>
                            </button>
                          </div>

                          {isProposingDate && (
                            <div className="rounded-xl bg-white border border-[#A97142]/40 p-3 space-y-2.5">
                              <div>
                                <label className="block text-[11px] font-bold text-[#17120E] mb-1">
                                  Nouvelle date / créneau proposé *
                                </label>
                                <input
                                  type="text"
                                  value={proposedDateValue}
                                  onChange={(e) => setProposedDateValue(e.target.value)}
                                  placeholder="Ex : Demain 14h - 16h"
                                  className="w-full min-h-[40px] px-3 py-1.5 rounded-lg border border-[#17120E]/20 text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-[#17120E] mb-1">
                                  Message / précision (facultatif)
                                </label>
                                <input
                                  type="text"
                                  value={proposedDateNote}
                                  onChange={(e) => setProposedDateNote(e.target.value)}
                                  placeholder="Ex : Passage de notre équipe dans votre zone"
                                  className="w-full min-h-[40px] px-3 py-1.5 rounded-lg border border-[#17120E]/20 text-xs"
                                />
                              </div>
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setProposingDateOrderId(null)}
                                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#EFE8DA] cursor-pointer"
                                >
                                  Annuler
                                </button>
                                <button
                                  type="button"
                                  disabled={isUpdating || !proposedDateValue.trim()}
                                  onClick={() => void handleProposeAnotherDate(order)}
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#D4AF37] text-[#0B0908] cursor-pointer disabled:opacity-50"
                                >
                                  Enregistrer cette date
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="lg:col-span-7 flex flex-col justify-between gap-4">
                        <div className="rounded-xl bg-[#EFE8DA]/70 p-4 space-y-2">
                          <span className="text-xs font-semibold text-[#7C401A] uppercase tracking-wider block">
                            Produits commandés
                          </span>
                          <div className="divide-y divide-[#17120E]/10">
                            {order.items.map((item, idx) => (
                              <div
                                key={`${item.productId}-${idx}`}
                                className="py-2 flex items-center justify-between gap-3 text-sm"
                              >
                                <div>
                                  <span className="font-mono font-bold text-[#24130B] tabular-nums">
                                    {item.quantity}×
                                  </span>{' '}
                                  <span className="font-semibold text-[#17120E]">
                                    {item.productName}
                                  </span>{' '}
                                  <span className="text-xs text-[#7C401A]">({item.unit})</span>
                                </div>
                                <span className="font-mono font-bold text-[#17120E] tabular-nums whitespace-nowrap">
                                  {formatPriceFcfa(item.lineTotal)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="space-y-2">
                            <span className="text-xs font-semibold text-[#7C401A] uppercase tracking-wider block">
                              Statut de livraison
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {(
                                [
                                  { status: 'confirmee', label: 'Confirmer', icon: CheckCircle2 },
                                  { status: 'en_preparation', label: 'En préparation', icon: ChefHat },
                                  { status: 'en_livraison', label: 'En livraison', icon: Truck },
                                  { status: 'livree', label: 'Livrée', icon: Package },
                                  { status: 'refusee', label: 'Refuser', icon: Ban },
                                ] as const
                              ).map((act) => {
                                const Icon = act.icon;
                                const isCurrent = order.status === act.status;
                                return (
                                  <button
                                    key={act.status}
                                    type="button"
                                    disabled={isUpdating || isCurrent}
                                    onClick={() => void handleUpdateOrderStatus(order, act.status)}
                                    className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                                      isCurrent
                                        ? 'bg-[#D4AF37] text-[#0B0908] cursor-default'
                                        : act.status === 'refusee'
                                        ? 'bg-rose-100 text-rose-900 hover:bg-rose-200 border border-rose-300'
                                        : 'bg-white text-[#17120E] hover:bg-[#EFE8DA] border border-[#17120E]/15'
                                    }`}
                                  >
                                    <Icon className="w-4 h-4" />
                                    <span>{act.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="space-y-2 pt-3 border-t border-[#17120E]/10">
                            <span className="text-xs font-semibold text-[#7C401A] uppercase tracking-wider block">
                              Statut de paiement (indépendant)
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {(
                                [
                                  { status: 'en_attente', label: 'En attente (à la livraison)' },
                                  { status: 'partiel', label: 'Paiement partiel' },
                                  { status: 'paye', label: 'Marquer payée' },
                                ] as const
                              ).map((pAct) => {
                                const isCurrentPay = order.paymentStatus === pAct.status;
                                return (
                                  <button
                                    key={pAct.status}
                                    type="button"
                                    disabled={isUpdating || isCurrentPay}
                                    onClick={() => void handleUpdatePaymentStatus(order, pAct.status)}
                                    className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                                      isCurrentPay
                                        ? 'bg-emerald-800 text-white cursor-default'
                                        : 'bg-white text-[#17120E] hover:bg-[#EFE8DA] border border-[#17120E]/15'
                                    }`}
                                  >
                                    <Banknote className="w-4 h-4" />
                                    <span>{pAct.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div>
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedHistoryId(showHistory ? null : order.id)
                              }
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#7C401A] hover:text-[#17120E] pt-1 cursor-pointer"
                            >
                              <History className="w-3.5 h-3.5" />
                              <span>
                                {showHistory
                                  ? 'Masquer l’historique'
                                  : `Voir l’historique (${order.statusHistory?.length || 1})`}
                              </span>
                            </button>

                            {showHistory && (
                              <div className="mt-2 rounded-xl bg-[#EFE8DA] p-3 space-y-1.5 text-xs">
                                {(order.statusHistory || []).map((entry, idx) => (
                                  <div
                                    key={idx}
                                    className="flex flex-wrap items-center justify-between gap-2 text-[#17120E]"
                                  >
                                    <span>
                                      <strong>{entry.note || entry.status}</strong> · {entry.actor}
                                    </span>
                                    <span className="font-mono text-[11px] text-[#7C401A] tabular-nums">
                                      {formatFirestoreTimestamp(entry.changedAt)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ONGLET 2 : PRODUITS OFFICIELS (2 PRODUITS UNIQUEMENT) */}
      {activeTab === 'products' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#FAF7F0]">
                Catalogue officiel OBA IMPÉRIAL (2 produits)
              </h2>
              <p className="text-sm text-[#EFE8DA]/75">
                Seuls OBA IMPÉRIAL GIN (2 750 FCFA) et OBA IMPÉRIAL WHISKY (3 500 FCFA) en pack de 10 unités sont autorisés.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void handleCleanAndSyncOfficialCatalog()}
              disabled={syncingCatalog}
              className="min-h-[48px] px-4 py-2.5 rounded-xl bg-[#24130B] border border-[#D4AF37]/60 text-[#FAF7F0] text-sm font-semibold inline-flex items-center gap-2 hover:bg-[#3B1F11] transition-colors cursor-pointer"
            >
              {syncingCatalog ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#D4AF37]" />
              ) : (
                <RefreshCw className="w-4 h-4 text-[#D4AF37]" />
              )}
              <span>Nettoyer &amp; synchroniser la base</span>
            </button>
          </div>

          {syncCatalogMsg && (
            <div className="rounded-xl bg-[#16110E] border border-[#D4AF37]/50 text-[#FAF7F0] p-4 text-sm">
              {syncCatalogMsg}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {products.map((product) => (
              <div
                key={product.id}
                className="rounded-2xl bg-[#FAF7F0] text-[#17120E] overflow-hidden border border-[#A97142]/30 flex flex-col"
              >
                <div className="h-56 bg-[#120E0B] relative overflow-hidden flex items-center justify-center">
                  {product.imageUrl === OFFICIAL_WHISKY_EMBLEM ? (
                    <div className="text-center p-4">
                      <span className="font-display text-2xl font-bold text-[#FAF7F0] block">
                        OBA IMPÉRIAL WHISKY
                      </span>
                      <span className="text-xs text-[#D4AF37]">
                        Emblème officiel (photo produit non encore importée)
                      </span>
                    </div>
                  ) : (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="text-xs text-[#7C401A] font-medium">
                      {product.unit} · {product.active ? 'Visible client' : 'Masqué'} ·{' '}
                      {product.available ? 'Disponible' : 'Indisponible'}
                    </div>
                    <h3 className="font-display text-2xl font-bold text-[#17120E]">
                      {product.name}
                    </h3>
                    <p className="font-mono text-xl font-bold text-[#3B1F11] tabular-nums">
                      {formatPriceFcfa(product.price)}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-[#17120E]/10 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => void handleToggleProductField(product, 'active')}
                        className={`min-h-[42px] px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                          product.active
                            ? 'bg-[#24130B] text-[#FAF7F0]'
                            : 'bg-[#EFE8DA] text-[#7C401A]'
                        }`}
                      >
                        {product.active ? (
                          <Eye className="w-3.5 h-3.5 text-[#D4AF37]" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5" />
                        )}
                        <span>{product.active ? 'Visible' : 'Masqué'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleToggleProductField(product, 'available')}
                        className={`min-h-[42px] px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                          product.available
                            ? 'bg-emerald-900 text-emerald-50'
                            : 'bg-rose-100 text-rose-900'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>{product.available ? 'En stock' : 'Rupture'}</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => openEditOfficialProduct(product)}
                      className="w-full min-h-[44px] px-4 py-2 rounded-lg bg-[#D4AF37] hover:bg-[#E5C158] text-[#0B0908] text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Mettre à jour la photo officielle</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ONGLET 3 : CONFIGURATION WHATSAPP */}
      {activeTab === 'whatsapp' && (
        <div className="max-w-2xl rounded-2xl bg-[#16110E] border border-[#A97142]/35 p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#24130B] border border-[#D4AF37]/40 text-[#D4AF37] flex items-center justify-center">
              <MessageCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#FAF7F0]">
                Numéro WhatsApp officiel OBA IMPÉRIAL
              </h2>
              <p className="text-xs text-[#EFE8DA]/75">
                Utilisé par le bouton « Envoyer sur WhatsApp » des commandes clients
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveWhatsappNumber} className="space-y-4">
            <div>
              <label
                htmlFor="oba-wa-number"
                className="block text-xs font-semibold text-[#EFE8DA] mb-1.5"
              >
                Numéro au format international (sans « + » ni espaces, avec indicatif pays)
              </label>
              <input
                id="oba-wa-number"
                type="tel"
                maxLength={24}
                value={whatsappInput}
                onChange={(e) => setWhatsappInput(e.target.value)}
                placeholder="Ex : 2290197000000"
                className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-[#0B0908] border border-[#A97142]/40 font-mono text-base text-[#FAF7F0] placeholder:text-[#EFE8DA]/30 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              />
            </div>

            <div className="rounded-xl bg-[#0B0908] border border-[#A97142]/25 p-4 text-xs text-[#EFE8DA]/80 space-y-1.5 leading-relaxed">
              <p>
                <strong>Emplacements de configuration disponibles :</strong>
              </p>
              <p>
                1. Directement ici dans la console (enregistré dans Firestore <code className="text-[#D4AF37]">settings/whatsapp</code>).
              </p>
              <p>
                2. Ou dans le fichier <code className="text-[#D4AF37]">src/config/obaConfig.ts</code> / variable <code className="text-[#D4AF37]">VITE_OBA_WHATSAPP_NUMBER</code> (actuellement : <code className="text-[#D4AF37]">{OBA_WHATSAPP_CONFIG.officialWhatsappNumber || 'non défini'}</code>).
              </p>
            </div>

            {whatsappFeedback && (
              <p className="text-sm font-medium text-[#D4AF37]">{whatsappFeedback}</p>
            )}

            <button
              type="submit"
              disabled={whatsappSaving}
              className="min-h-[48px] px-6 py-3 rounded-xl bg-[#D4AF37] hover:bg-[#E5C158] text-[#0B0908] font-bold text-sm inline-flex items-center gap-2 cursor-pointer"
            >
              {whatsappSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Enregistrer le numéro officiel</span>
            </button>
          </form>
        </div>
      )}

      {/* ONGLET 4 : ACCÈS ADMINISTRATEURS */}
      {activeTab === 'admins' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 rounded-2xl bg-[#16110E] border border-[#A97142]/35 p-6 space-y-4">
            <div className="flex items-center gap-2.5">
              <UserPlus className="w-5 h-5 text-[#D4AF37]" />
              <h2 className="font-display text-2xl font-bold text-[#FAF7F0]">
                Autoriser un administrateur
              </h2>
            </div>
            <p className="text-xs text-[#EFE8DA]/75 leading-relaxed">
              Ajoutez l&apos;identifiant Firebase d&apos;un collaborateur pour lui donner accès à cette console.
            </p>

            <form onSubmit={handleAddAdmin} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#EFE8DA] mb-1">
                  Identifiant Firebase (UID) *
                </label>
                <input
                  type="text"
                  required
                  value={newAdminUid}
                  onChange={(e) => setNewAdminUid(e.target.value)}
                  placeholder="Ex : xK92mQp..."
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#0B0908] border border-[#A97142]/40 font-mono text-xs text-[#FAF7F0]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#EFE8DA] mb-1">
                  Adresse e-mail *
                </label>
                <input
                  type="email"
                  required
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="responsable@obaimperial.com"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#0B0908] border border-[#A97142]/40 text-sm text-[#FAF7F0]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#EFE8DA] mb-1">
                  Nom complet
                </label>
                <input
                  type="text"
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                  placeholder="Responsable Commercial"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#0B0908] border border-[#A97142]/40 text-sm text-[#FAF7F0]"
                />
              </div>

              <button
                type="submit"
                className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#E5C158] text-[#0B0908] font-bold text-sm cursor-pointer"
              >
                Ajouter cet administrateur
              </button>

              {adminActionMsg && (
                <p className="text-xs text-[#D4AF37] font-medium">{adminActionMsg}</p>
              )}
            </form>
          </div>

          <div className="lg:col-span-7 rounded-2xl bg-[#16110E] border border-[#A97142]/35 p-6 space-y-4">
            <h2 className="font-display text-2xl font-bold text-[#FAF7F0]">
              Administrateurs autorisés
            </h2>
            <div className="rounded-xl bg-[#0B0908] border border-[#D4AF37]/40 p-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[#FAF7F0]">{BOOTSTRAPPED_ADMIN_EMAIL}</p>
                <p className="text-xs text-[#D4AF37]">Administrateur principal (vérifié)</p>
              </div>
              <ShieldCheck className="w-5 h-5 text-[#D4AF37]" />
            </div>

            {adminsList.map((adm) => (
              <div
                key={adm.uid}
                className="rounded-xl bg-[#0B0908] border border-[#A97142]/25 p-4 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#FAF7F0] truncate">{adm.displayName}</p>
                  <p className="text-xs text-[#EFE8DA]/80 truncate">{adm.email}</p>
                  <p className="font-mono text-[11px] text-[#A97142] truncate">{adm.uid}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleRemoveAdmin(adm.uid)}
                  className="min-h-[40px] px-3 py-1.5 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs font-semibold hover:bg-rose-900/60 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Retirer</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODALE MISE À JOUR PHOTO OFFICIELLE */}
      {editingProduct !== null && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-[#FAF7F0] text-[#17120E] border border-[#D4AF37] shadow-2xl overflow-hidden my-8">
            <div className="bg-[#16110E] text-[#FAF7F0] px-6 py-4 flex items-center justify-between">
              <h3 className="font-display text-2xl font-bold">{editingProduct.name}</h3>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                aria-label="Fermer"
                className="min-h-[40px] min-w-[40px] rounded-lg hover:bg-white/10 flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOfficialProduct} className="p-6 space-y-4">
              <div className="rounded-xl bg-[#EFE8DA] p-3 text-xs text-[#4A2715] space-y-1">
                <p>
                  <strong>Tarif officiel verrouillé :</strong> {formatPriceFcfa(editingProduct.price)} ({editingProduct.unit})
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#17120E]">
                  Photographie officielle du produit
                </label>

                <div className="flex flex-wrap items-center gap-3">
                  <label className="min-h-[44px] px-4 py-2 rounded-xl bg-[#24130B] hover:bg-[#3B1F11] text-[#FAF7F0] text-xs font-bold inline-flex items-center gap-2 cursor-pointer">
                    {uploadingPhoto ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#D4AF37]" />
                    ) : (
                      <ImagePlus className="w-4 h-4 text-[#D4AF37]" />
                    )}
                    <span>Importer une photo officielle</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>

                  <div className="flex flex-wrap gap-1.5">
                    {STUDIO_IMAGE_PRESETS.map((preset) => (
                      <button
                        key={preset.url}
                        type="button"
                        onClick={() => setProdImageUrl(preset.url)}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border cursor-pointer ${
                          prodImageUrl === preset.url
                            ? 'bg-[#D4AF37] border-[#D4AF37] text-[#0B0908]'
                            : 'bg-white border-[#17120E]/15 text-[#4A2715]'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-[#17120E]/15 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prodActive}
                    onChange={(e) => setProdActive(e.target.checked)}
                    className="w-4 h-4 accent-[#24130B]"
                  />
                  <span>Visible client</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-[#17120E]/15 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prodAvailable}
                    onChange={(e) => setProdAvailable(e.target.checked)}
                    className="w-4 h-4 accent-[#24130B]"
                  />
                  <span>En stock</span>
                </label>
              </div>

              {prodError && (
                <div className="rounded-xl bg-rose-100 border border-rose-400 text-rose-900 p-3 text-xs font-medium">
                  {prodError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="min-h-[46px] px-5 py-2.5 rounded-xl bg-[#EFE8DA] text-[#17120E] text-sm font-semibold cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={prodSaving}
                  className="min-h-[46px] px-6 py-2.5 rounded-xl bg-[#24130B] hover:bg-[#3B1F11] text-[#FAF7F0] text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
                >
                  {prodSaving && <Loader2 className="w-4 h-4 animate-spin text-[#D4AF37]" />}
                  <span>Enregistrer</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
