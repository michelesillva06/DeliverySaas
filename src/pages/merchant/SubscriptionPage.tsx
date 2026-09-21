import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { CreditCard, QrCode, ShieldCheck, AlertCircle, Copy, Check, Send, Clock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { Store, SaasConfig, SaasPaymentRequest } from '../../types';
import { subscribeToSaasConfig, createSaasPaymentRequestInFirestore, subscribeToSaasPaymentRequests } from '../../services/firestoreService';
import { formatCurrency } from '../../lib/formatters';
import { gerarBrCode, gerarQrCodeDataUrl } from '../../lib/pix';
import { useToast } from '../../components/Toast';

export const SubscriptionPage: React.FC = () => {
  const { store } = useOutletContext<{ store: Store }>();
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const [saasConfig, setSaasConfig] = useState<SaasConfig | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [brCodeString, setBrCodeString] = useState<string>('');
  const [loadingQr, setLoadingQr] = useState<boolean>(false);

  // Modal Já Paguei
  const [showPaidModal, setShowPaidModal] = useState(false);
  const [txid, setTxid] = useState('');
  const [comprovanteNota, setComprovanteNota] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);

  // Histórico de Solicitações de Confirmação da Loja
  const [myRequests, setMyRequests] = useState<SaasPaymentRequest[]>([]);

  useEffect(() => {
    const unsubConfig = subscribeToSaasConfig((cfg) => setSaasConfig(cfg));
    const unsubReqs = subscribeToSaasPaymentRequests((all) => {
      setMyRequests(all.filter((r) => r.storeId === store.id));
    });
    return () => {
      unsubConfig();
      unsubReqs();
    };
  }, [store.id]);

  // Gerar QR Code Pix dinamicamente com base na chave do SuperAdmin e no valor da mensalidade da loja
  useEffect(() => {
    async function updatePix() {
      const chavePix = saasConfig?.pixSuperAdmin || 'saas.pagamentos@pedeai.com.br';
      const valor = store.valorMensalidade || 99.9;
      const nomeRecebedor = saasConfig?.nomeRecebedor || 'PEDE AI PLATAFORMA';
      const cidade = saasConfig?.cidade || 'MANAUS';

      setLoadingQr(true);
      try {
        const payload = gerarBrCode({
          tipoChave: (saasConfig?.pixTipoChave as any) || 'email',
          chave: chavePix,
          nomeRecebedor,
          cidade,
          valor,
          txid: `SUB${store.id.replace(/[^A-Za-z0-9]/g, '').slice(-15)}`,
          descricao: `Mensalidade ${store.nome.slice(0, 15)}`,
        });
        setBrCodeString(payload);
        const url = await gerarQrCodeDataUrl(payload);
        setQrCodeDataUrl(url);
      } catch (err) {
        console.error('Erro ao gerar QR Code Pix:', err);
      } finally {
        setLoadingQr(false);
      }
    }

    updatePix();
  }, [saasConfig, store]);

  const now = new Date();
  const vence = store.dataVencimento ? new Date(store.dataVencimento) : null;
  const isExpired = store.status === 'vencida' || (vence !== null && vence < now && store.status !== 'ativa');
  const diffDays = vence ? Math.ceil((vence.getTime() - now.getTime()) / (1000 * 3600 * 24)) : 0;

  const handleCopyPix = () => {
    if (!brCodeString && !saasConfig?.pixSuperAdmin) return;
    const textToCopy = brCodeString || saasConfig?.pixSuperAdmin || '';
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    showToast('Código Pix Copia e Cola copiado com sucesso!', 'success');
    setTimeout(() => setCopied(false), 3000);
  };

  const handleSendPaidConfirmation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingRequest(true);
    try {
      await createSaasPaymentRequestInFirestore({
        storeId: store.id,
        storeNome: store.nome,
        valor: store.valorMensalidade || 99.90,
        plano: store.plano || 'Profissional',
        txid: txid.trim(),
        comprovanteNota: comprovanteNota.trim(),
      });
      showToast('Aviso de pagamento enviado com sucesso! O administrador revisará em breve.', 'success');
      setShowPaidModal(false);
      setTxid('');
      setComprovanteNota('');
    } catch (err) {
      console.error(err);
      showToast('Erro ao enviar aviso de pagamento. Tente novamente.', 'error');
    } finally {
      setSendingRequest(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-neutral-900">Minha Assinatura</h1>
        <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">
          Acompanhe o status do seu plano, vencimento e realize o pagamento da sua mensalidade.
        </p>
      </div>

      {/* Alerta de Loja Vencida */}
      {isExpired && (
        <div className="p-4 bg-rose-50 border-2 border-rose-200 rounded-2xl flex items-center gap-3 text-rose-900 shadow-sm animate-pulse">
          <AlertTriangle className="w-6 h-6 text-rose-600 flex-shrink-0" />
          <div>
            <h3 className="font-bold text-sm">Renove para voltar a receber pedidos</h3>
            <p className="text-xs text-rose-700 mt-0.5">
              Sua assinatura venceu. Realize o pagamento via Pix e clique em "Já paguei" para liberar seu cardápio imediatamente.
            </p>
          </div>
        </div>
      )}

      {/* Card do Plano Atual */}
      <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-100">
          <div>
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">Plano Contratado</span>
            <h2 className="text-2xl font-black text-neutral-900 mt-0.5">
              Plano {store.plano || 'Profissional'}
            </h2>
          </div>

          <div>
            <span
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wide ${
                store.status === 'ativa'
                  ? 'bg-emerald-100 text-emerald-800'
                  : store.status === 'vencida'
                  ? 'bg-rose-100 text-rose-800'
                  : store.status === 'aguardando_ativacao'
                  ? 'bg-sky-100 text-sky-800'
                  : 'bg-neutral-200 text-neutral-800'
              }`}
            >
              {store.status === 'ativa' ? (
                <>
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Ativa
                </>
              ) : store.status === 'vencida' ? (
                <>
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  Vencida
                </>
              ) : store.status === 'aguardando_ativacao' ? (
                <>
                  <Clock className="w-4 h-4 text-sky-600" />
                  Aguardando Ativação
                </>
              ) : (
                'Bloqueada'
              )}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 space-y-1">
            <span className="text-neutral-500 font-medium block">Valor da Mensalidade</span>
            <span className="text-xl font-black text-neutral-900 block">
              {formatCurrency(store.valorMensalidade || 99.90)}
            </span>
          </div>

          <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 space-y-1">
            <span className="text-neutral-500 font-medium block">Data de Vencimento</span>
            <span className="text-xl font-black text-neutral-900 block">
              {vence ? vence.toLocaleDateString('pt-BR') : 'Não definida'}
            </span>
          </div>

          <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 space-y-1">
            <span className="text-neutral-500 font-medium block">Dias Restantes</span>
            <span
              className={`text-xl font-black block ${
                diffDays < 0 ? 'text-rose-600' : diffDays <= 7 ? 'text-amber-600' : 'text-emerald-600'
              }`}
            >
              {diffDays < 0 ? 'Vencido' : `${diffDays} dia(s)`}
            </span>
          </div>
        </div>
      </div>

      {/* Pagamento via Pix */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200 shadow-xs space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-neutral-900">Pagamento / Renovação via Pix</h3>
            <p className="text-xs text-neutral-500">Escaneie o QR Code abaixo ou copie a chave Pix para realizar a transferência.</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-8 bg-neutral-50 p-6 rounded-2xl border border-neutral-200">
          {/* Imagem do QR Code */}
          <div className="flex flex-col items-center justify-center flex-shrink-0">
            <div className="w-48 h-48 bg-white p-3 rounded-2xl border border-neutral-200 shadow-md flex items-center justify-center">
              {loadingQr ? (
                <div className="text-xs text-neutral-400 font-bold">Gerando Pix...</div>
              ) : qrCodeDataUrl ? (
                <img src={qrCodeDataUrl} alt="QR Code Pix" className="w-full h-full object-contain" />
              ) : (
                <div className="text-xs text-neutral-400">QR Code indisponível</div>
              )}
            </div>
            <span className="text-[11px] font-bold text-neutral-500 mt-2">Valor: {formatCurrency(store.valorMensalidade || 99.90)}</span>
          </div>

          {/* Dados Pix e Chave Copia e Cola */}
          <div className="flex-1 space-y-4 w-full">
            <div>
              <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">
                Chave Pix (E-mail / Telefone / CPF / Aleatória)
              </label>
              <div className="p-3 bg-white border border-neutral-300 rounded-xl font-mono text-xs font-bold text-neutral-800 break-all">
                {saasConfig?.pixSuperAdmin || 'saas.pagamentos@pedeai.com.br'}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleCopyPix}
                className="flex-1 py-3 px-4 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Pix Copiado!' : 'Copiar Pix Copia e Cola'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowPaidModal(true)}
                className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Já Paguei (Notificar Admin)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Histórico de Confirmações de Pagamento */}
      {myRequests.length > 0 && (
        <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-neutral-900">Histórico de Avisos de Pagamento ("Já Paguei")</h3>
          <div className="divide-y divide-neutral-100 text-xs">
            {myRequests.map((req) => (
              <div key={req.id} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <span className="font-bold text-neutral-800">{formatCurrency(req.valor)}</span>
                  <p className="text-[11px] text-neutral-400">
                    Enviado em {new Date(req.criadoEm).toLocaleDateString()} às {new Date(req.criadoEm).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {req.txid && <p className="text-[10px] text-neutral-500 font-mono">TXID/Comprovante: {req.txid}</p>}
                </div>
                <div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1 ${
                      req.status === 'aprovado'
                        ? 'bg-emerald-100 text-emerald-800'
                        : req.status === 'rejeitado'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {req.status === 'aprovado' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                    {req.status === 'rejeitado' && <XCircle className="w-3 h-3 text-rose-600" />}
                    {req.status === 'pendente' && <Clock className="w-3 h-3 text-amber-600 animate-spin" />}
                    <span>{req.status}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Já Paguei */}
      {showPaidModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="font-bold text-base text-neutral-900 flex items-center gap-2">
                <Send className="w-5 h-5 text-emerald-600" />
                <span>Confirmar Pagamento</span>
              </h3>
              <button onClick={() => setShowPaidModal(false)} className="p-1 text-neutral-400 hover:text-neutral-700">
                ✕
              </button>
            </div>

            <p className="text-xs text-neutral-600">
              Informe os dados do seu pagamento Pix para que nossa equipe valide e renove sua assinatura rapidamente.
            </p>

            <form onSubmit={handleSendPaidConfirmation} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-neutral-700 mb-1">Valor do Pagamento</label>
                <input
                  type="text"
                  readOnly
                  value={formatCurrency(store.valorMensalidade || 99.90)}
                  className="w-full p-3 bg-neutral-100 border border-neutral-200 rounded-xl font-bold text-neutral-800"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">Código de Autenticação / TXID Pix (Opcional)</label>
                <input
                  type="text"
                  value={txid}
                  onChange={(e) => setTxid(e.target.value)}
                  placeholder="Ex: E12345678202609..."
                  className="w-full p-3 border border-neutral-300 rounded-xl focus:outline-none focus:border-rose-500 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">Observação / Comprovante</label>
                <textarea
                  rows={2}
                  value={comprovanteNota}
                  onChange={(e) => setComprovanteNota(e.target.value)}
                  placeholder="Instruções ou nome de quem realizou a transferência..."
                  className="w-full p-3 border border-neutral-300 rounded-xl focus:outline-none focus:border-rose-500 text-xs"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPaidModal(false)}
                  className="w-1/3 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={sendingRequest}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {sendingRequest ? 'Enviando...' : 'Enviar Confirmação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
