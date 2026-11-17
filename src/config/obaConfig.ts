/**
 * Configuration officielle OBA IMPÉRIAL.
 *
 * Renseignez ci-dessous le numéro WhatsApp officiel de réception des commandes
 * (format international sans le signe « + », ni espaces — exemple : "2290197000000").
 *
 * Vous pouvez également le définir via la variable d'environnement
 * `VITE_OBA_WHATSAPP_NUMBER` ou directement depuis la console d'administration
 * (onglet « Configuration »).
 */
export const OBA_WHATSAPP_CONFIG = {
  /**
   * Numéro WhatsApp officiel de OBA IMPÉRIAL (+229 0162017062).
   */
  officialWhatsappNumber:
    (import.meta.env.VITE_OBA_WHATSAPP_NUMBER as string | undefined) ||
    '2290162017062',
} as const;

export const OFFICIAL_PRODUCT_IDS = [
  'oba-imperial-gin',
  'oba-imperial-whisky',
] as const;

export type OfficialProductId = (typeof OFFICIAL_PRODUCT_IDS)[number];
