import React, { useState, useEffect } from 'react';
import { Copy, Check, QrCode, MessageCircle, AlertCircle, ShieldCheck } from 'lucide-react';
import { Order, Store } from '../types';
import { gerarBrCode, gerarQrCodeDataUrl } from '../lib/pix';
import { formatCurrency, generateWhatsAppUrl } from '../lib/formatters';
import { updateOrderPaymentStatusInFirestore } from '../services/firestoreService';
import { useToast } from './Toast';

interface PixPaymentModalProps {
  order: Order;
  store: Store;
  onPaymentInformed?: () => void;
}

export const PixPaymentModal: React.FC<PixPaymentModalProps> = ({ order, store, onPaymentInformed }) => {
  const { showToast } = useToast();
  const [brCode, setBrCode] = useState<string>('');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function setupPix() {
      try {
        setLoading(true);
        const code = gerarBrCode({
          tipoChave: store.pixKeyType || 'aleatoria',
          chave: store.pixKey,
          nomeRecebedor: store.pixReceiverName || store.nome,
          cidade: store.pixCity || 'BRASIL',
          valor: order.total,
          txid: `LOJA${order.numero}`,
          descricao: `Pedido #${order.numero} ${store.nome}`,
        });
        setBrCode(code);

        const url = await gerarQrCodeDataUrl(code);
        setQrCodeUrl(url);
      } catch (err) {
        console.error('Erro ao gerar BR Code Pix:', err);
      } finally {
        setLoading(false);
      }
    }
    setupPix();
  }, [order, store]);

  const handleCopyCode = async () => {
    if (!brCode) return;
    try {
      await navigator.clipboard.writeText(brCode);
      setCopied(true);
      showToast('Código Pix copiado com sucesso!', 'success');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      showToast('Falha ao copiar automaticamente. Selecione e copie o texto.', 'error');
    }
  };

  const handleAlreadyPaid = async () => {
    try {
      await updateOrderPaymentStatusInFirestore(
        order.id,
        'informado',
        'Cliente informou que realizou o pagamento Pix e solicitou conferência da loja'
      );
    } catch (err) {
      console.error('Erro ao atualizar status do Pix no Firestore:', err);
    }

    const msg = `Olá! Acabei de realizar o pagamento do Pedido #${order.numero} no valor de ${formatCurrency(
      order.total
    )} via Pix. Segue em anexo o meu comprovante para conferência!`;
    const waUrl = generateWhatsAppUrl(store.whatsapp, msg);

    if (onPaymentInformed) onPaymentInformed();

    window.open(waUrl, '_blank');
  };

  const isConfirmed = order.pagamento?.status === 'confirmado';
  const isInformado = order.pagamento?.status === 'informado';

  return (
    <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm space-y-5 text-base">
      {/* Cabeçalho do Bloco Pix */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 flex-shrink-0">
            <QrCode className="w-7 h-7" />
          </div>
          <div>
            <h3 className="font-black text-lg text-neutral-900 leading-tight">Pagamento via Pix</h3>
            <p className="text-sm text-neutral-600 font-medium">Aprovação imediata e sem tarifas</p>
          </div>
        </div>

        {/* Badge de Status do Pagamento */}
        {isConfirmed ? (
          <span className="flex items-center gap-2 px-3.5 py-1.5 bg-emerald-100 text-emerald-900 rounded-full text-sm font-black">
            <ShieldCheck className="w-5 h-5 text-emerald-700" />
            Pix Confirmado
          </span>
        ) : isInformado ? (
          <span className="flex items-center gap-2 px-3.5 py-1.5 bg-amber-100 text-amber-900 rounded-full text-sm font-black">
            <AlertCircle className="w-5 h-5 text-amber-700" />
            Aguardando Conferência da Loja
          </span>
        ) : (
          <span className="px-3.5 py-1.5 bg-neutral-100 text-neutral-800 rounded-full text-sm font-bold">
            Aguardando Pagamento
          </span>
        )}
      </div>

      {isConfirmed ? (
        <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-2">
          <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
            <Check className="w-8 h-8 stroke-[3]" />
          </div>
          <h4 className="font-black text-emerald-950 text-xl">Pagamento Confirmado pela Loja!</h4>
          <p className="text-base text-emerald-800 max-w-sm mx-auto">
            O lojista confirmou o recebimento do seu Pix de {formatCurrency(order.total)}. Seu pedido já está sendo
            atendido!
          </p>
        </div>
      ) : (
        <>
          {/* Valor a Pagar */}
          <div className="text-center py-4 bg-neutral-50 rounded-2xl border border-neutral-200">
            <p className="text-sm text-neutral-600 font-bold uppercase tracking-wider">Valor exato do pedido:</p>
            <p className="text-3xl font-black text-neutral-900 mt-1">{formatCurrency(order.total)}</p>
            <p className="text-sm text-neutral-600 mt-1">
              Favorecido: <strong>{store.pixReceiverName || store.nome}</strong> • {store.pixCity || 'Brasil'}
            </p>
          </div>

          {/* QR Code */}
          <div className="flex flex-col items-center justify-center py-2">
            {loading ? (
              <div className="w-56 h-56 bg-neutral-100 rounded-2xl flex items-center justify-center text-sm font-bold text-neutral-400 animate-pulse">
                Gerando QR Code...
              </div>
            ) : qrCodeUrl ? (
              <div className="p-4 bg-white border-2 border-dashed border-neutral-300 rounded-3xl shadow-sm">
                <img src={qrCodeUrl} alt="QR Code Pix" className="w-56 h-56 object-contain" />
              </div>
            ) : null}
            <p className="text-sm text-neutral-600 mt-3 text-center font-medium max-w-sm">
              Abra o aplicativo do seu banco, escolha a opção Pix e aponte a câmera para ler o QR Code
            </p>
          </div>

          {/* Código Copia e Cola */}
          <div className="space-y-2">
            <label className="block text-sm font-black text-neutral-800 uppercase tracking-wide">
              Ou use o Pix Copia e Cola:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={brCode}
                className="flex-1 text-sm bg-neutral-50 border border-neutral-300 rounded-2xl p-4 font-mono text-neutral-700 truncate focus:outline-none min-h-[48px]"
              />
              <button
                type="button"
                onClick={handleCopyCode}
                className="px-5 py-3.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-2xl text-base font-bold flex items-center gap-2 transition-colors shadow-sm cursor-pointer min-h-[48px]"
              >
                {copied ? (
                  <>
                    <Check className="w-5 h-5 text-emerald-400 stroke-[3]" />
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Botão Já Paguei */}
          <div className="pt-2 space-y-2">
            <button
              type="button"
              onClick={handleAlreadyPaid}
              className="w-full min-h-[54px] py-4 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base sm:text-lg rounded-2xl shadow-lg flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
            >
              <MessageCircle className="w-6 h-6" />
              <span>Já paguei! Enviar comprovante no WhatsApp</span>
            </button>
            <p className="text-xs text-neutral-500 text-center leading-normal">
              O pedido é liberado para preparo assim que o lojista verificar o comprovante ou a notificação bancária.
            </p>
          </div>
        </>
      )}
    </div>
  );
};
