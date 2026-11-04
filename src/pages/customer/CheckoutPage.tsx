import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  ShoppingBag,
  MapPin,
  Clock,
  DollarSign,
  QrCode,
  CreditCard,
  MessageCircle,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  getStoreBySlugFromFirestore,
  subscribeToStoreBySlug,
  subscribeToDeliveryZonesByStore,
  createOrderInFirestore,
  ensureAnonymousCustomerAuth,
} from '../../services/firestoreService';
import { Store, DeliveryZone, PaymentMethod, PaymentStatus } from '../../types';
import { useCart, CartProvider } from '../../services/cartContext';
import { useAuth } from '../../services/authContext';
import { formatCurrency, formatPhone, isStoreOpen, generateWhatsAppUrl, getPaymentMethodLabel } from '../../lib/formatters';
import { limparObjeto } from '../../lib/utils';
import { useToast } from '../../components/Toast';
import { validateAndSanitizeCheckout } from '../../schemas/checkoutSchema';
import { trackStorefrontEvent } from '../../services/analyticsService';

export const CheckoutWrapper: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    ensureAnonymousCustomerAuth().catch(console.warn);

    getStoreBySlugFromFirestore(slug).then((st) => {
      setStore(st);
      setLoading(false);
    });

    const unsub = subscribeToStoreBySlug(slug, (st) => {
      if (st) setStore(st);
    });

    return () => unsub();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 text-base font-bold text-neutral-600 bg-neutral-50">
        Carregando dados da loja...
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 text-base font-bold text-neutral-700 bg-neutral-50">
        Loja não encontrada.
      </div>
    );
  }

  return (
    <CartProvider storeId={store.id} storeSlug={store.slug}>
      <CheckoutContent store={store} />
    </CartProvider>
  );
};

const CheckoutContent: React.FC<{ store: Store }> = ({ store }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { currentUser } = useAuth();
  const {
    items,
    subtotal,
    appliedCoupon,
    couponDiscount,
    clearCart,
    orderType,
    setOrderType,
    selectedZone,
    setSelectedZone,
    deliveryFee,
    total,
  } = useCart();

  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);

  // Formulário do Cliente
  const [nome, setNome] = useState(() => localStorage.getItem('checkout_nome') || '');
  const [telefone, setTelefone] = useState(() => localStorage.getItem('checkout_tel') || '');

  // Formulário de Endereço
  const [rua, setRua] = useState(() => localStorage.getItem('checkout_rua') || '');
  const [numero, setNumero] = useState(() => localStorage.getItem('checkout_num') || '');
  const [complemento, setComplemento] = useState('');
  const [referencia, setReferencia] = useState('');
  const [bairroId, setBairroId] = useState<string>('');

  // Forma de Pagamento
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(() => {
    if (store.pagamentos?.pix) return 'pix';
    if (store.pagamentos?.cartaoEntrega) return 'cartao_entrega';
    if (store.pagamentos?.dinheiro) return 'dinheiro';
    return 'whatsapp';
  });
  const [trocoPara, setTrocoPara] = useState<string>('');
  const [lgpdConsent] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const orderAttemptIdRef = useRef<string | null>(null);

  useEffect(() => {
    trackStorefrontEvent(store.id, store.slug, 'iniciou_pedido');
    const unsub = subscribeToDeliveryZonesByStore(store.id, (zones) => {
      setDeliveryZones(zones.filter((z) => z.ativo !== false));
    });
    return () => unsub();
  }, [store.id]);

  const handleZoneChange = (zoneId: string) => {
    setBairroId(zoneId);
    const found = deliveryZones.find((z) => z.id === zoneId) || null;
    setSelectedZone(found);
  };

  const openStatus = isStoreOpen(store);

  // Redirecionar se o carrinho estiver vazio
  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-6 text-center">
        <ShoppingBag className="w-20 h-20 text-neutral-300 mb-4" />
        <h2 className="text-2xl font-black text-neutral-900">Sua sacola está vazia</h2>
        <p className="text-base text-neutral-500 mt-2">
          Adicione itens ao cardápio antes de prosseguir com a finalização do pedido.
        </p>
        <Link
          to={`/${store.slug}`}
          className="mt-6 px-6 py-3.5 rounded-2xl font-black text-base text-white shadow-md min-h-[48px] inline-flex items-center"
          style={{ backgroundColor: store.corPrimaria }}
        >
          Voltar ao Cardápio
        </Link>
      </div>
    );
  }

  const handleSubmitOrder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (isSubmitting) return;

    setSubmissionError(null);

    if (!openStatus.isOpen) {
      const msg = openStatus.reason || 'A loja está fechada no momento e não pode receber pedidos.';
      setSubmissionError(msg);
      return;
    }

    if (subtotal < (store.pedidoMinimo || 0)) {
      const msg = `O pedido mínimo deste estabelecimento é ${formatCurrency(store.pedidoMinimo)}.`;
      setSubmissionError(msg);
      return;
    }

    // Validação dos dados do formulário
    const validation = validateAndSanitizeCheckout({
      nome,
      telefone,
      orderType,
      rua,
      numero,
      complemento,
      referencia,
      bairro: selectedZone?.bairro || '',
      paymentMethod,
      trocoPara,
      total,
      lgpdConsent,
    });

    if (!validation.success) {
      setSubmissionError(validation.error);
      return;
    }

    const {
      nome: cleanNome,
      telefone: cleanTel,
      endereco: cleanEndereco,
      paymentMethod: cleanPaymentMethod,
      parsedTroco,
    } = validation.data;

    setIsSubmitting(true);

    try {
      // Salvar dados no localStorage para conforto do cliente em compras futuras
      localStorage.setItem('checkout_nome', cleanNome);
      localStorage.setItem('checkout_tel', cleanTel);
      if (orderType === 'entrega' && cleanEndereco) {
        localStorage.setItem('checkout_rua', cleanEndereco.rua);
        localStorage.setItem('checkout_num', cleanEndereco.numero);
      }

      // Obter identificador seguro do cliente (Uid Firebase ou UID local seguro)
      let customerUid = currentUser?.uid;
      if (!customerUid) {
        customerUid = await ensureAnonymousCustomerAuth();
      }

      // Reutilizar attemptOrderId para idempotência garantida
      if (!orderAttemptIdRef.current) {
        orderAttemptIdRef.current = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      }
      const attemptOrderId = orderAttemptIdRef.current;

      const orderPayload = limparObjeto({
        id: attemptOrderId,
        storeId: store.id,
        customerUid,
        cliente: {
          nome: cleanNome,
          telefone: cleanTel,
        },
        tipo: orderType,
        endereco: cleanEndereco,
        itens: items.map((item) => ({
          ...item,
          obs: (item.obs ?? '').trim(),
          complementos: (item.complementos || []).map((c) => ({
            grupoId: c.grupoId || '',
            grupoNome: c.grupoNome || '',
            opcaoId: c.opcaoId || '',
            nome: c.nome || '',
            preco: Number(c.preco) || 0,
          })),
        })),
        subtotal: Number(subtotal) || 0,
        desconto: Number(couponDiscount) || 0,
        cupom: appliedCoupon?.codigo ?? null,
        taxaEntrega: Number(deliveryFee) || 0,
        total: Number(total) || 0,
        pagamento: {
          forma: cleanPaymentMethod,
          status: (cleanPaymentMethod === 'pix' ? 'aguardando' : cleanPaymentMethod === 'whatsapp' ? 'aguardando' : 'na_entrega') as PaymentStatus,
          troco: parsedTroco,
        },
        status: 'novo' as const,
      });

      // Gravar no Firestore
      const order = await createOrderInFirestore(orderPayload);
      trackStorefrontEvent(store.id, store.slug, 'concluiu_pedido');

      // Limpar chave de tentativa e carrinho SOMENTE após persistência confirmada
      orderAttemptIdRef.current = null;
      clearCart();

      // Montar mensagem para o WhatsApp da loja
      const paymentLabel = getPaymentMethodLabel(order.pagamento.forma, order.tipo);
      let whatsMsg = `*🍟 NOVO PEDIDO #${order.numero}*\n`;
      whatsMsg += `*Loja:* ${store.nome}\n`;
      whatsMsg += `*Cliente:* ${order.cliente.nome}\n`;
      whatsMsg += `*Telefone:* ${formatPhone(order.cliente.telefone)}\n`;
      whatsMsg += `*Modalidade:* ${order.tipo === 'entrega' ? '🛵 Entrega em Domicílio' : '🛍️ Retirada no Balcão'}\n`;
      if (order.tipo === 'entrega' && order.endereco) {
        whatsMsg += `*Endereço:* ${order.endereco.rua}, ${order.endereco.numero} - ${order.endereco.bairro}`;
        if (order.endereco.complemento) whatsMsg += ` (${order.endereco.complemento})`;
        if (order.endereco.referencia) whatsMsg += ` - Ref: ${order.endereco.referencia}`;
        whatsMsg += `\n`;
      }
      whatsMsg += `\n*PRODUTOS SOLICITADOS:*\n`;
      order.itens.forEach((it) => {
        whatsMsg += `• ${it.qtd}x ${it.nome} (${formatCurrency(it.totalItem)})\n`;
        if (it.complementos && it.complementos.length > 0) {
          it.complementos.forEach((c) => {
            whatsMsg += `  ↳ + ${c.nome} (${formatCurrency(c.preco * it.qtd)})\n`;
          });
        }
        if (it.obs) {
          whatsMsg += `  Obs: ${it.obs}\n`;
        }
      });
      whatsMsg += `\n*Subtotal:* ${formatCurrency(order.subtotal)}\n`;
      if (order.desconto) whatsMsg += `*Desconto:* -${formatCurrency(order.desconto)}\n`;
      if (order.taxaEntrega) whatsMsg += `*Taxa de Entrega:* ${formatCurrency(order.taxaEntrega)}\n`;
      whatsMsg += `*TOTAL A PAGAR:* *${formatCurrency(order.total)}*\n`;
      whatsMsg += `*Forma de Pagamento:* ${paymentLabel}${
        order.pagamento.troco ? ` (Troco para ${formatCurrency(order.pagamento.troco)})` : ''
      }\n`;
      whatsMsg += `*Situação do Pagamento:* ${
        order.pagamento.forma === 'pix'
          ? 'Pendente (Aguardando conferência do Pix)'
          : order.pagamento.forma === 'cartao_entrega'
          ? order.tipo === 'entrega'
            ? 'Pagar com cartão na entrega'
            : 'Pagar com cartão na retirada'
          : order.pagamento.forma === 'dinheiro'
          ? 'Pagar em dinheiro na entrega/retirada'
          : 'A combinar no WhatsApp'
      }\n\n`;
      whatsMsg += `*Acompanhe seu pedido em tempo real:*\n${window.location.origin}/#/${store.slug}/pedido/${order.id}`;

      // Tentar abrir WhatsApp da loja
      const storePhoneDigits = (store.whatsapp || '').replace(/\D/g, '');
      if (storePhoneDigits && storePhoneDigits.length >= 10) {
        try {
          window.open(generateWhatsAppUrl(store.whatsapp, whatsMsg), '_blank');
        } catch (e) {
          console.warn('Redirecionamento ao WhatsApp bloqueado pelo navegador:', e);
        }
      }

      showToast(`Pedido #${order.numero} confirmado com sucesso!`, 'success');
      navigate(`/${store.slug}/pedido/${order.id}`);
    } catch (err: any) {
      console.error('Erro ao registrar pedido:', err);
      let friendlyError = 'Não foi possível registrar seu pedido neste momento.';
      if (err?.code === 'unavailable' || err?.message?.includes('network')) {
        friendlyError = 'Falha de conexão com a internet. Verifique sua rede e tente novamente.';
      } else if (err?.code === 'permission-denied') {
        friendlyError = 'Não foi possível registrar o pedido no banco de dados. Caso o problema persista, utilize o botão abaixo para enviar os itens diretamente pelo WhatsApp da loja.';
      } else if (err?.message) {
        friendlyError = err.message;
      }
      setSubmissionError(friendlyError);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-100 pb-24 text-base">
      {/* Topo do Checkout com Marca da Loja */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-2xl mx-auto px-4 py-3.5 flex items-center justify-between gap-3">
          <Link
            to={`/${store.slug}`}
            className="flex items-center gap-2.5 text-base font-bold text-neutral-700 hover:text-neutral-950 transition-colors group min-w-0"
          >
            <ArrowLeft className="w-5 h-5 text-neutral-500 group-hover:text-neutral-900 transition-colors flex-shrink-0" />
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-neutral-100 border border-neutral-200 overflow-hidden flex items-center justify-center font-black text-xs text-neutral-500 flex-shrink-0">
                {store.logo ? (
                  <img src={store.logo} alt={store.nome} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  store.nome.slice(0, 2).toUpperCase()
                )}
              </div>
              <span className="font-black text-base text-[#111111] truncate hidden sm:inline max-w-[200px]">
                {store.nome}
              </span>
            </div>
          </Link>

          <span className="font-black text-base text-[#111111] bg-neutral-100 px-4 py-2 rounded-2xl border border-neutral-300">
            Finalizar Pedido
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmitOrder} className="space-y-6">
          {/* Seção 1: Seus Dados para Contato */}
          <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm space-y-4">
            <h2 className="text-xl font-black text-neutral-900 flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-neutral-900 text-white text-base flex items-center justify-center font-black">
                1
              </span>
              Seus Dados para Contato
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-sm font-black text-neutral-800 mb-1.5 uppercase tracking-wide">
                  Seu Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: João da Silva"
                  className="w-full text-base p-4 border border-neutral-300 rounded-2xl focus:ring-2 focus:ring-neutral-900 focus:outline-none min-h-[50px] text-neutral-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-black text-neutral-800 mb-1.5 uppercase tracking-wide">
                  WhatsApp / Telefone *
                </label>
                <input
                  type="tel"
                  required
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(92) 99999-9999"
                  className="w-full text-base p-4 border border-neutral-300 rounded-2xl focus:ring-2 focus:ring-neutral-900 focus:outline-none min-h-[50px] text-neutral-900 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Seção 2: Como prefere receber? */}
          <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm space-y-5">
            <h2 className="text-xl font-black text-neutral-900 flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-neutral-900 text-white text-base flex items-center justify-center font-black">
                2
              </span>
              Como prefere receber?
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {store.aceitaEntrega !== false && (
                <div
                  onClick={() => setOrderType('entrega')}
                  className={`p-4 sm:p-5 rounded-2xl border-2 transition-all cursor-pointer select-none ${
                    orderType === 'entrega'
                      ? 'border-neutral-900 bg-neutral-50 shadow-sm'
                      : 'border-neutral-200 hover:border-neutral-400 bg-white'
                  }`}
                >
                  <p className="font-black text-lg text-neutral-900 flex items-center gap-2">
                    <span>🛵</span> Entrega em Domicílio
                  </p>
                  <p className="text-sm font-medium text-neutral-600 mt-1">
                    Receba no conforto do seu endereço
                  </p>
                </div>
              )}

              {store.aceitaRetirada !== false && (
                <div
                  onClick={() => setOrderType('retirada')}
                  className={`p-4 sm:p-5 rounded-2xl border-2 transition-all cursor-pointer select-none ${
                    orderType === 'retirada'
                      ? 'border-neutral-900 bg-neutral-50 shadow-sm'
                      : 'border-neutral-200 hover:border-neutral-400 bg-white'
                  }`}
                >
                  <p className="font-black text-lg text-neutral-900 flex items-center gap-2">
                    <span>🛍️</span> Retirada no Balcão
                  </p>
                  <p className="text-sm font-medium text-neutral-600 mt-1">
                    Retire na loja sem taxa de entrega
                  </p>
                </div>
              )}
            </div>

            {/* Endereço de Entrega */}
            {orderType === 'entrega' ? (
              <div className="pt-4 border-t border-neutral-200 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-black text-neutral-800 mb-1.5 uppercase tracking-wide">
                      Bairro Atendido *
                    </label>
                    <select
                      required
                      value={bairroId}
                      onChange={(e) => handleZoneChange(e.target.value)}
                      className="w-full text-base p-4 border border-neutral-300 rounded-2xl bg-white focus:ring-2 focus:ring-neutral-900 font-semibold text-neutral-900 min-h-[52px]"
                    >
                      <option value="">Selecione seu bairro...</option>
                      {deliveryZones.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.bairro} (Taxa: {formatCurrency(z.taxa)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-black text-neutral-800 mb-1.5 uppercase tracking-wide">
                      Rua / Avenida *
                    </label>
                    <input
                      type="text"
                      required
                      value={rua}
                      onChange={(e) => setRua(e.target.value)}
                      placeholder="Ex: Rua Rio Purus"
                      className="w-full text-base p-4 border border-neutral-300 rounded-2xl focus:ring-2 focus:ring-neutral-900 min-h-[50px] text-neutral-900 bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-black text-neutral-800 mb-1.5 uppercase tracking-wide">
                      Número *
                    </label>
                    <input
                      type="text"
                      required
                      value={numero}
                      onChange={(e) => setNumero(e.target.value)}
                      placeholder="Ex: 120"
                      className="w-full text-base p-4 border border-neutral-300 rounded-2xl focus:ring-2 focus:ring-neutral-900 min-h-[50px] text-neutral-900 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-black text-neutral-800 mb-1.5 uppercase tracking-wide">
                      Complemento
                    </label>
                    <input
                      type="text"
                      value={complemento}
                      onChange={(e) => setComplemento(e.target.value)}
                      placeholder="Ex: Apto 402, Bloco C"
                      className="w-full text-base p-4 border border-neutral-300 rounded-2xl focus:ring-2 focus:ring-neutral-900 min-h-[50px] text-neutral-900 bg-white"
                    />
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-black text-neutral-800 mb-1.5 uppercase tracking-wide">
                      Ponto de Referência
                    </label>
                    <input
                      type="text"
                      value={referencia}
                      onChange={(e) => setReferencia(e.target.value)}
                      placeholder="Ex: Em frente à praça"
                      className="w-full text-base p-4 border border-neutral-300 rounded-2xl focus:ring-2 focus:ring-neutral-900 min-h-[50px] text-neutral-900 bg-white"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 text-base text-neutral-700">
                <p className="font-black text-neutral-900">Endereço da Loja para Retirada:</p>
                <p className="mt-1">{store.endereco || 'Endereço informado pelo estabelecimento'}</p>
                <p className="mt-2 text-emerald-800 font-bold">
                  Previsão para retirada: ~{store.tempoEstimadoRetiradaMin || 25} minutos após a confirmação.
                </p>
              </div>
            )}
          </div>

          {/* Seção 3: Forma de Pagamento */}
          <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm space-y-4">
            <h2 className="text-xl font-black text-neutral-900 flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-neutral-900 text-white text-base flex items-center justify-center font-black">
                3
              </span>
              Forma de Pagamento
            </h2>

            <div className="space-y-3">
              {store.pagamentos?.pix !== false && (
                <div
                  onClick={() => setPaymentMethod('pix')}
                  className={`flex items-center justify-between p-4 sm:p-5 rounded-2xl border-2 cursor-pointer transition-all min-h-[64px] select-none ${
                    paymentMethod === 'pix' ? 'border-neutral-900 bg-neutral-50 shadow-sm' : 'border-neutral-200 bg-white hover:border-neutral-400'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center flex-shrink-0">
                      <QrCode className="w-6 h-6 text-teal-600" />
                    </div>
                    <div>
                      <p className="text-base font-black text-neutral-900">Pix com Chave Copia e Cola / QR Code</p>
                      <p className="text-sm text-neutral-500 font-medium">Pague pelo aplicativo do seu banco</p>
                    </div>
                  </div>
                  <span className="text-xs font-black text-teal-800 bg-teal-100 px-3 py-1 rounded-full uppercase">
                    Rápido
                  </span>
                </div>
              )}

              {store.pagamentos?.cartaoEntrega !== false && (
                <div
                  onClick={() => setPaymentMethod('cartao_entrega')}
                  className={`flex items-center justify-between p-4 sm:p-5 rounded-2xl border-2 cursor-pointer transition-all min-h-[64px] select-none ${
                    paymentMethod === 'cartao_entrega'
                      ? 'border-neutral-900 bg-neutral-50 shadow-sm'
                      : 'border-neutral-200 bg-white hover:border-neutral-400'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center flex-shrink-0">
                      <CreditCard className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-base font-black text-neutral-900">
                        {orderType === 'entrega' ? 'Cartão na Entrega' : 'Cartão na Retirada'}
                      </p>
                      <p className="text-sm text-neutral-500 font-medium">
                        {orderType === 'entrega'
                          ? 'O entregador levará a maquininha de cartão (Débito/Crédito)'
                          : 'Pague na maquininha ao retirar no balcão'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {store.pagamentos?.dinheiro !== false && (
                <div
                  className={`p-4 sm:p-5 rounded-2xl border-2 transition-all min-h-[64px] ${
                    paymentMethod === 'dinheiro' ? 'border-neutral-900 bg-neutral-50 shadow-sm' : 'border-neutral-200 bg-white'
                  }`}
                >
                  <div
                    onClick={() => setPaymentMethod('dinheiro')}
                    className="flex items-center justify-between cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center flex-shrink-0">
                        <DollarSign className="w-6 h-6 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-base font-black text-neutral-900">Dinheiro em Cédulas</p>
                        <p className="text-sm text-neutral-500 font-medium">Pagamento em espécie na entrega ou retirada</p>
                      </div>
                    </div>
                  </div>

                  {paymentMethod === 'dinheiro' && (
                    <div className="mt-4 pt-4 border-t border-neutral-200 flex flex-wrap items-center gap-3">
                      <label className="text-sm font-bold text-neutral-800">Precisa de troco para quanto?</label>
                      <input
                        type="text"
                        value={trocoPara}
                        onChange={(e) => setTrocoPara(e.target.value)}
                        placeholder={`Ex: ${(Math.ceil(total / 10) * 10 + 10).toFixed(2)}`}
                        className="w-40 text-base p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-neutral-900 bg-white font-bold"
                      />
                    </div>
                  )}
                </div>
              )}

              {store.pagamentos?.whatsapp !== false && (
                <div
                  onClick={() => setPaymentMethod('whatsapp')}
                  className={`flex items-center justify-between p-4 sm:p-5 rounded-2xl border-2 cursor-pointer transition-all min-h-[64px] select-none ${
                    paymentMethod === 'whatsapp'
                      ? 'border-neutral-900 bg-neutral-50 shadow-sm'
                      : 'border-neutral-200 bg-white hover:border-neutral-400'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center flex-shrink-0">
                      <MessageCircle className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-base font-black text-neutral-900">Combinar no WhatsApp</p>
                      <p className="text-sm text-neutral-500 font-medium">Combine diretamente com o atendente</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Seção 4: Resumo e Confirmação */}
          <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm space-y-5">
            <h2 className="text-xl font-black text-neutral-900">Resumo do Pedido</h2>

            <div className="space-y-3 text-base text-neutral-700 border-b border-neutral-200 pb-4">
              <div className="flex justify-between">
                <span>Subtotal ({items.length} {items.length === 1 ? 'item' : 'itens'})</span>
                <span className="font-bold">{formatCurrency(subtotal)}</span>
              </div>
              {couponDiscount > 0 && (
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>Desconto aplicado ({appliedCoupon?.codigo})</span>
                  <span>-{formatCurrency(couponDiscount)}</span>
                </div>
              )}
              {orderType === 'entrega' && (
                <div className="flex justify-between">
                  <span>Taxa de Entrega</span>
                  <span className="font-bold">{selectedZone ? formatCurrency(deliveryFee) : 'Selecione o bairro'}</span>
                </div>
              )}
              <div className="flex justify-between text-2xl font-black text-neutral-900 pt-3 border-t border-neutral-200">
                <span>Total a pagar</span>
                <span style={{ color: store.corPrimaria }}>{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Aviso Informativo de Privacidade LGPD */}
            <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-2xl text-sm text-neutral-600 space-y-1">
              <p className="font-black text-neutral-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                Proteção e privacidade dos seus dados
              </p>
              <p className="text-sm leading-relaxed text-neutral-600">
                Seus dados (nome, telefone e endereço) são transmitidos diretamente à loja para o preparo e entrega do pedido, em conformidade com a LGPD.
              </p>
            </div>

            {/* Banner de Erro com Ação de Tentar Novamente */}
            {submissionError && (
              <div className="p-4 sm:p-5 bg-rose-50 border-2 border-rose-300 rounded-3xl flex items-start gap-3.5 text-rose-950">
                <AlertCircle className="w-6 h-6 text-rose-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-black text-base text-rose-900">Não foi possível confirmar o pedido</p>
                  <p className="text-sm mt-0.5 text-rose-800 leading-relaxed">{submissionError}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleSubmitOrder()}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-sm font-black transition-colors min-h-[44px] cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Tentar Novamente</span>
                    </button>
                    {store.whatsapp && (
                      <a
                        href={generateWhatsAppUrl(
                          store.whatsapp,
                          `Olá! Tentei concluir um pedido no valor de ${formatCurrency(total)} pelo cardápio digital, mas ocorreu uma falha de conexão. Segue os meus dados para atendimento direto: ${nome} - ${telefone}.`
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-rose-300 hover:bg-rose-100 text-rose-900 rounded-xl text-sm font-bold transition-colors min-h-[44px]"
                      >
                        <MessageCircle className="w-4 h-4 text-emerald-600" />
                        <span>Falar com o atendente no WhatsApp</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Botão Confirmar Pedido */}
            <button
              type="submit"
              disabled={isSubmitting || !openStatus.isOpen}
              className="w-full min-h-[58px] py-4 px-6 rounded-2xl text-white font-black text-lg shadow-xl flex items-center justify-center gap-3 transition-transform active:scale-[0.99] disabled:opacity-50 cursor-pointer"
              style={{ backgroundColor: store.corPrimaria }}
            >
              {isSubmitting ? (
                <div className="flex items-center gap-3">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Registrando pedido com segurança...</span>
                </div>
              ) : (
                <>
                  <span>Confirmar e Enviar Pedido</span>
                  <span>• {formatCurrency(total)}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};
