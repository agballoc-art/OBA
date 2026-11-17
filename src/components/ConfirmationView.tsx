import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Check,
  Copy,
  MessageCircle,
  ShoppingBag,
  Truck,
} from 'lucide-react';
import { Order } from '../types';
import {
  buildOrderWhatsappMessage,
  buildWhatsappClickToChatUrl,
  formatPriceFcfa,
} from '../utils/format';

interface ConfirmationViewProps {
  order: Order;
  officialWhatsappNumber: string;
  onEditOrder: () => void;
  onNewOrder: () => void;
}

export const ConfirmationView: React.FC<ConfirmationViewProps> = ({
  order,
  officialWhatsappNumber,
  onEditOrder,
  onNewOrder,
}) => {
  const [copied, setCopied] = useState(false);

  const whatsappMessage = buildOrderWhatsappMessage(order);
  const waUrl = buildWhatsappClickToChatUrl(officialWhatsappNumber, whatsappMessage);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(whatsappMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Presse-papiers indisponible
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="rounded-2xl bg-[#FAF7F0] text-[#17120E] p-6 sm:p-9 border border-[#D4AF37]/60 shadow-2xl space-y-6">
        <div className="space-y-3 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-[#24130B] text-[#D4AF37] flex items-center justify-center shadow-lg">
            <MessageCircle className="w-8 h-8" />
          </div>

          <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#17120E] [text-wrap:balance]">
            Vérifiez et envoyez sur WhatsApp
          </h1>

          <p className="text-sm sm:text-base text-[#4A2715] leading-relaxed max-w-lg mx-auto">
            Votre commande n&apos;est <strong>pas encore envoyée</strong>. Relisez le message ci-dessous, puis appuyez sur le bouton pour l&apos;ouvrir dans WhatsApp et valider l&apos;envoi auprès de l&apos;équipe OBA IMPÉRIAL.
          </p>
        </div>

        {/* Récapitulatif rapide */}
        <div className="rounded-xl bg-[#16110E] text-[#FAF7F0] p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2 text-xs text-[#D4AF37]">
            <span>Récapitulatif de la commande</span>
            <span className="font-mono tabular-nums">{order.orderNumber}</span>
          </div>

          <div className="space-y-1.5 text-sm">
            {order.items.map((item) => (
              <div key={item.productId} className="flex items-center justify-between gap-2">
                <span>
                  <strong className="font-mono tabular-nums">{item.quantity}×</strong>{' '}
                  {item.productName}
                </span>
                <span className="font-mono font-semibold text-[#D4AF37] tabular-nums whitespace-nowrap">
                  {formatPriceFcfa(item.lineTotal)}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-2.5 border-t border-[#FAF7F0]/15 flex items-center justify-between text-base font-bold">
            <span>Total à la livraison</span>
            <span className="font-mono text-xl text-[#D4AF37] tabular-nums">
              {formatPriceFcfa(order.totalAmount)}
            </span>
          </div>
        </div>

        {/* Aperçu exact du message WhatsApp prérempli */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#7C401A]">
              Aperçu du message WhatsApp
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="min-h-[36px] px-3 py-1 rounded-lg bg-[#EFE8DA] hover:bg-[#E5DAC5] text-[#17120E] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Message copié</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#7C401A]" />
                  <span>Copier le message</span>
                </>
              )}
            </button>
          </div>

          <pre className="rounded-xl bg-white border border-[#17120E]/15 p-4 text-xs sm:text-sm text-[#17120E] whitespace-pre-wrap font-sans leading-relaxed overflow-x-auto">
            {whatsappMessage}
          </pre>
        </div>

        {/* Bouton principal WhatsApp Click-to-Chat */}
        {waUrl ? (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full min-h-[60px] px-6 py-4 rounded-xl bg-emerald-700 hover:bg-emerald-600 active:scale-[0.99] text-white font-bold text-base sm:text-lg tracking-wide flex items-center justify-center gap-3 transition-all shadow-lg"
          >
            <MessageCircle className="w-6 h-6" />
            <span>ENVOYER SUR WHATSAPP</span>
          </a>
        ) : (
          <div className="rounded-xl bg-amber-100 border border-amber-400 text-amber-950 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-800 shrink-0 mt-0.5" />
              <div className="text-sm space-y-1">
                <p className="font-bold">
                  Numéro WhatsApp officiel OBA IMPÉRIAL non encore configuré
                </p>
                <p className="text-xs leading-relaxed">
                  L&apos;administrateur doit renseigner le numéro officiel dans{' '}
                  <strong>Administration → Configuration WhatsApp</strong> ou dans{' '}
                  <code className="font-mono">src/config/obaConfig.ts</code>. En attendant, vous pouvez copier le message ci-dessus pour l&apos;envoyer manuellement.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-[#24130B] text-[#FAF7F0] text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Copy className="w-4 h-4 text-[#D4AF37]" />
              <span>{copied ? 'Message copié' : 'Copier le message de commande'}</span>
            </button>
          </div>
        )}

        {/* Rappels Livraison & Paiement à la livraison */}
        <div className="space-y-2.5">
          <div className="rounded-xl bg-[#EFE8DA] border border-[#A97142]/40 p-3.5 flex items-center gap-3">
            <Truck className="w-5 h-5 text-[#7C401A] shrink-0" />
            <p className="text-xs sm:text-sm font-semibold text-[#17120E]">
              Livraison assurée par l&apos;équipe OBA IMPÉRIAL.
            </p>
          </div>
          <div className="rounded-xl bg-[#EFE8DA] border border-[#A97142]/40 p-3.5 flex items-center gap-3">
            <Banknote className="w-5 h-5 text-[#7C401A] shrink-0" />
            <p className="text-xs sm:text-sm font-semibold text-[#17120E]">
              Paiement à la livraison uniquement : {formatPriceFcfa(order.totalAmount)}.
            </p>
          </div>
        </div>

        {/* Actions secondaires */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={onEditOrder}
            className="min-h-[48px] px-4 py-3 rounded-xl bg-[#EFE8DA] hover:bg-[#E5DAC5] text-[#17120E] font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Modifier ma commande</span>
          </button>

          <button
            type="button"
            onClick={onNewOrder}
            className="min-h-[48px] px-4 py-3 rounded-xl bg-[#24130B] hover:bg-[#3B1F11] text-[#FAF7F0] font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4 text-[#D4AF37]" />
            <span>Nouvelle commande</span>
          </button>
        </div>
      </div>
    </div>
  );
};
