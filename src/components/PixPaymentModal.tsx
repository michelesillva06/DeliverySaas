import React, { useState, useEffect } from 'react';
import { Copy, Check, QrCode, MessageCircle, AlertCircle, ShieldCheck } from 'lucide-react';
import { Order, Store } from '../types';
import { gerarBrCode, gerarQrCodeDataUrl } from '../lib/pix';
import { formatCurrency, generateWhatsAppUrl } from '../lib/formatters';
import { updateOrderInFirestore } from '../services/firestoreService';
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
    // 1. Atualizar status para 'informado' no Firestore
    try {
      await updateOrderInFirestore(order.id, {
        pagamento: {
          ...order.pagamento,
          status: 'informado',
        },
      });
    } catch (err) {
      console.error('Erro ao atualizar status do Pix no Firestore:', err);
    }

    // 2. Montar mensagem para o WhatsApp do lojista
    const msg = `Olá! Acabei de realizar o pagamento do Pedido #${order.numero} no valor de ${formatCurrency(
      order.total
    )} via Pix. Segue em anexo o meu comprovante para conferência!`;
    const waUrl = generateWhatsAppUrl(store.whatsapp, msg);

    if (onPaymentInformed) onPaymentInformed();

    // 3. Abrir WhatsApp do lojista
    window.open(waUrl, '_blank');
  };

  const isConfirmed = order.pagamento?.status === 'confirmado';
  const isInformado = order.pagamento?.status === 'informado';

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm space-y-5">
      {/* Cabeçalho do Bloco Pix */}
      <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-base text-neutral-900 leading-tight">Pagamento via Pix</h3>
            <p className="text-xs text-neutral-500">Pague sem taxas com aprovação rápida</p>
          </div>
        </div>

        {/* Badge de Status do Pagamento */}
        {isConfirmed ? (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Pix Confirmado
          </span>
        ) : isInformado ? (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            Aguardando Conferência da Loja
          </span>
        ) : (
          <span className="px-3 py-1 bg-neutral-100 text-neutral-700 rounded-full text-xs font-semibold">
            Aguardando Pagamento
          </span>
        )}
      </div>

      {isConfirmed ? (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-2">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <Check className="w-6 h-6" />
          </div>
          <h4 className="font-bold text-emerald-900 text-base">Pagamento Confirmado pela Loja!</h4>
          <p className="text-xs text-emerald-700 max-w-sm mx-auto">
            O lojista já conferiu o recebimento do seu Pix de {formatCurrency(order.total)}. Seu pedido está sendo
            atendido!
          </p>
        </div>
      ) : (
        <>
          {/* Valor a Pagar */}
          <div className="text-center py-2 bg-neutral-50 rounded-xl border border-neutral-100">
            <p className="text-xs text-neutral-500 font-medium">Valor exato a transferir:</p>
            <p className="text-2xl font-extrabold text-neutral-900 mt-0.5">{formatCurrency(order.total)}</p>
            <p className="text-[11px] text-neutral-500 mt-1">
              Favorecido: <strong>{store.pixReceiverName || store.nome}</strong> • {store.pixCity || 'Brasil'}
            </p>
          </div>

          {/* QR Code */}
          <div className="flex flex-col items-center justify-center py-2">
            {loading ? (
              <div className="w-48 h-48 bg-neutral-100 rounded-xl flex items-center justify-center text-xs text-neutral-400 animate-pulse">
                Gerando QR Code...
              </div>
            ) : qrCodeUrl ? (
              <div className="p-3 bg-white border-2 border-dashed border-neutral-200 rounded-2xl shadow-sm">
                <img src={qrCodeUrl} alt="QR Code Pix" className="w-52 h-52 object-contain" />
              </div>
            ) : null}
            <p className="text-xs text-neutral-500 mt-2 text-center">
              Abra o aplicativo do seu banco e aponte a câmera para ler o QR Code
            </p>
          </div>

          {/* Código Copia e Cola */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider">
              Ou use o Pix Copia e Cola:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={brCode}
                className="flex-1 text-xs bg-neutral-50 border border-neutral-200 rounded-xl p-3 font-mono text-neutral-600 truncate focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopyCode}
                className="px-4 py-3 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
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
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Já paguei! Enviar comprovante no WhatsApp</span>
            </button>
            <p className="text-[11px] text-neutral-500 text-center leading-normal">
              ⚠️ O pedido será liberado para preparo assim que o lojista verificar o comprovante no banco.
            </p>
          </div>
        </>
      )}
    </div>
  );
};
