import { OFFICIAL_PRODUCTS, Order, Product } from '../types';

export function formatNumberFr(amount: number): string {
  const rounded = Math.round(Number.isFinite(amount) ? amount : 0);
  return new Intl.NumberFormat('fr-FR')
    .format(rounded)
    .replace(/[\u00a0\u202f]/g, ' ');
}

export function formatPriceFcfa(amount: number): string {
  return `${formatNumberFr(amount)} FCFA`;
}

export function generateOrderNumber(now = new Date()): string {
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i += 1) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `OBA-${yy}${mm}${dd}-${suffix}`;
}

export function sanitizeOrderId(orderNumber: string): string {
  return orderNumber.replace(/[^a-zA-Z0-9_-]/g, '-');
}

/**
 * Verrouille le catalogue sur les deux seuls produits officiels OBA IMPÉRIAL
 * (OBA IMPÉRIAL GIN : pack de 10 à 2 750 FCFA ; OBA IMPÉRIAL WHISKY : pack de 10 à 3 500 FCFA).
 * Ignore tout produit fictif ou obsolète présent en base et garantit des tarifs officiels exacts.
 */
export function enforceOfficialCatalogProducts(
  firestoreProducts: Partial<Product>[]
): Product[] {
  const byId = new Map<string, Partial<Product>>();
  for (const item of firestoreProducts) {
    if (item.id) {
      byId.set(item.id, item);
    }
  }

  return OFFICIAL_PRODUCTS.map((official) => {
    const stored = byId.get(official.id);
    const hasUploadedOfficialImage =
      stored?.imageUrl &&
      !stored.imageUrl.includes('/src/assets/images/');

    return {
      ...official,
      imageUrl: hasUploadedOfficialImage
        ? String(stored?.imageUrl)
        : official.imageUrl,
      available: stored ? stored.available !== false : official.available,
      active: stored ? stored.active !== false : official.active,
      createdAt: stored?.createdAt,
      updatedAt: stored?.updatedAt,
    };
  });
}

export function normalizeOfficialWhatsappNumber(raw: string): string {
  return raw.replace(/[^0-9]/g, '').slice(0, 24);
}

export function buildOrderWhatsappMessage(order: Order): string {
  const orderLines = order.items.map(
    (item) =>
      `- ${item.productName} : ${item.quantity} pack(s) × ${formatPriceFcfa(item.unitPrice)}`
  );

  const gpsLine =
    order.hasGps &&
    typeof order.latitude === 'number' &&
    typeof order.longitude === 'number'
      ? `${order.latitude.toFixed(6)}, ${order.longitude.toFixed(6)} (https://maps.google.com/?q=${order.latitude.toFixed(6)},${order.longitude.toFixed(6)})`
      : 'Non partagée';

  const instructionsText = order.notes?.trim() ? order.notes.trim() : 'Aucune';

  return [
    'NOUVELLE COMMANDE — OBA IMPÉRIAL',
    '',
    `Client : ${order.customerName}`,
    `Téléphone : ${order.phone}`,
    '',
    'COMMANDE :',
    ...orderLines,
    '',
    `TOTAL : ${formatPriceFcfa(order.totalAmount)}`,
    '',
    'LIVRAISON :',
    `Ville : ${order.city}`,
    `Quartier : ${order.district}`,
    `Adresse : ${order.addressText}`,
    `GPS : ${gpsLine}`,
    `Date souhaitée : ${order.requestedDate}`,
    '',
    `Instructions : ${instructionsText}`,
  ].join('\n');
}

export function buildWhatsappClickToChatUrl(
  officialNumber: string,
  message: string
): string | null {
  const cleanDigits = normalizeOfficialWhatsappNumber(officialNumber);
  if (cleanDigits.length < 6) {
    return null;
  }
  return `https://wa.me/${cleanDigits}?text=${encodeURIComponent(message)}`;
}

export function formatFirestoreTimestamp(ts: unknown): string {
  if (!ts) return '—';
  let date: Date | null = null;
  if (ts instanceof Date) {
    date = ts;
  } else if (typeof ts === 'string') {
    const parsed = new Date(ts);
    if (!Number.isNaN(parsed.getTime())) date = parsed;
  } else if (typeof ts === 'object' && ts !== null && 'toDate' in ts) {
    const maybeFn = (ts as { toDate?: () => Date }).toDate;
    if (typeof maybeFn === 'function') {
      date = maybeFn();
    }
  }
  if (!date) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function getGoogleMapsUrl(
  hasGps: boolean,
  latitude?: number | null,
  longitude?: number | null,
  fallbackAddress?: string
): string {
  if (hasGps && typeof latitude === 'number' && typeof longitude === 'number') {
    return `https://www.google.com/maps?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
  }
  const query = encodeURIComponent(fallbackAddress?.trim() || 'Cotonou');
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export async function compressImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Impossible de lire le fichier image.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Format image invalide.'));
      img.onload = () => {
        const maxDim = 720;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas indisponible.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
        resolve(dataUrl);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
