import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import {
  getStoreBySlugFromFirestore,
  subscribeToStoreBySlug,
  subscribeToDeliveryZonesByStore,
  createOrderInFirestore,
  ensureAnonymousCustomerAuth,
} from '../../services/firestoreService';
import { Store, DeliveryZone, PaymentMethod, PaymentStatus, Order } from '../../types';
import { useCart, CartProvider } from '../../services/cartContext';
import { useAuth } from '../../services/authContext';
import { formatCurrency, formatPhone, isStoreOpen, generateWhatsAppUrl } from '../../lib/formatters';
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
      <div className="min-h-screen flex items-center justify-center p-4 text-xs font-bold text-neutral-500">
        Carregando dados da loja...
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 text-sm font-bold text-neutral-700">
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

  // Formulário do Cliente (recupera preferências locais de preenchimento)
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
  const [lgpdConsent, setLgpdConsent] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Escutar zonas de entrega em tempo real do Firestore
  useEffect(() => {
    trackStorefrontEvent(store.id, store.slug, 'iniciou_pedido');
    const unsub = subscribeToDeliveryZonesByStore(store.id, (zones) => {
      setDeliveryZones(zones.filter((z) => z.ativo !== false));
    });
    return () => unsub();
  }, [store.id]);

  // Atualizar bairro selecionado no carrinho para recalcular a taxa
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
        <ShoppingBag className="w-16 h-16 text-neutral-300 mb-3" />
        <h2 className="text-xl font-bold text-neutral-900">Seu carrinho está vazio</h2>
        <p className="text-sm text-neutral-500 mt-1">Adicione itens antes de prosseguir com o pedido.</p>
        <Link
          to={`/${store.slug}`}
          className="mt-4 px-5 py-2.5 rounded-xl font-bold text-xs text-white"
          style={{ backgroundColor: store.corPrimaria }}
        >
          Voltar ao Cardápio
        </Link>
      </div>
    );
  }

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return; // Bloquear duplo clique rigorosamente

    if (!openStatus.isOpen) {
      showToast(openStatus.reason || 'A loja está fechada no momento.', 'error');
      return;
    }

    if (subtotal < (store.pedidoMinimo || 0)) {
      showToast(`O pedido mínimo é ${formatCurrency(store.pedidoMinimo)}.`, 'error');
      return;
    }

    // Validação e higienização robusta via Zod Schema
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
      showToast(validation.error, 'error');
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
      // Salvar preferências de preenchimento de formulário no localStorage
      localStorage.setItem('checkout_nome', cleanNome);
      localStorage.setItem('checkout_tel', cleanTel);
      if (orderType === 'entrega' && cleanEndereco) {
        localStorage.setItem('checkout_rua', cleanEndereco.rua);
        localStorage.setItem('checkout_num', cleanEndereco.numero);
      }

      // Garantir autenticação anônima do cliente
      const customerUid = currentUser?.uid || (await ensureAnonymousCustomerAuth());

      // Gravar pedido 100% no Firestore com número sequencial atômico
      const orderPayload = limparObjeto({
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

      const order = await createOrderInFirestore(orderPayload);
      trackStorefrontEvent(store.id, store.slug, 'concluiu_pedido');

      // Limpar carrinho
      clearCart();

      // Montar mensagem para o WhatsApp da loja
      let whatsMsg = `*🍟 NOVO PEDIDO #${order.numero}*\n`;
      whatsMsg += `*Cliente:* ${order.cliente.nome}\n`;
      whatsMsg += `*Telefone:* ${formatPhone(order.cliente.telefone)}\n`;
      whatsMsg += `*Tipo:* ${order.tipo === 'entrega' ? '🛵 Entrega' : '🛍️ Retirada no Balcão'}\n`;
      if (order.endereco) {
        whatsMsg += `*Endereço:* ${order.endereco.rua}, ${order.endereco.numero} - ${order.endereco.bairro}`;
        if (order.endereco.complemento) whatsMsg += ` (${order.endereco.complemento})`;
        if (order.endereco.referencia) whatsMsg += ` - Ref: ${order.endereco.referencia}`;
        whatsMsg += `\n`;
      }
      whatsMsg += `\n*ITENS:* \n`;
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
      whatsMsg += `*TOTAL:* *${formatCurrency(order.total)}*\n`;
      whatsMsg += `*Pagamento:* ${
        order.pagamento.forma === 'pix'
          ? 'Pix'
          : order.pagamento.forma === 'cartao_entrega'
          ? 'Cartão na Entrega'
          : order.pagamento.forma === 'dinheiro'
          ? `Dinheiro${order.pagamento.troco ? ` (Troco para ${formatCurrency(order.pagamento.troco)})` : ''}`
          : 'Combinar no WhatsApp'
      }\n\n`;
      whatsMsg += `*Acompanhe o pedido em tempo real:*\n${window.location.origin}/#/${store.slug}/pedido/${order.id}`;

      // Abrir WhatsApp da loja e redirecionar para tela de acompanhamento
      if (store.whatsapp) {
        try {
          window.open(generateWhatsAppUrl(store.whatsapp, whatsMsg), '_blank');
        } catch (e) {
          console.warn('Popup WhatsApp:', e);
        }
      }

      showToast(`Pedido #${order.numero} gravado com sucesso!`, 'success');
      navigate(`/${store.slug}/pedido/${order.id}`);
    } catch (err: any) {
      console.error('Erro ao gravar pedido no Firestore:', err);
      showToast(err?.message || 'Erro ao processar pedido no Firestore. Tente novamente.', 'error');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 pb-20">
      {/* Topo do Checkout com Marca da Loja */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link
            to={`/${store.slug}`}
            className="flex items-center gap-2 text-xs font-bold text-neutral-600 hover:text-neutral-900 transition-colors group min-w-0"
          >
            <ArrowLeft className="w-4 h-4 text-neutral-500 group-hover:text-neutral-900 transition-colors flex-shrink-0" />
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-neutral-100 border border-neutral-200 overflow-hidden flex items-center justify-center font-bold text-[10px] text-neutral-500 flex-shrink-0">
                {store.logo ? (
                  <img src={store.logo} alt={store.nome} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  store.nome.slice(0, 2).toUpperCase()
                )}
              </div>
              <span className="font-black text-xs text-[#111111] truncate hidden sm:inline max-w-[160px]">
                {store.nome}
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <span className="font-extrabold text-xs sm:text-sm text-[#111111] bg-neutral-100 px-3 py-1.5 rounded-xl border border-neutral-200/80">
              Finalizar Pedido
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmitOrder} className="space-y-6">
          {/* Seção 1: Seus Dados */}
          <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-neutral-900 text-white text-xs flex items-center justify-center font-bold">
                1
              </span>
              Seus Dados para Contato
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">Seu Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: João da Silva"
                  className="w-full text-xs sm:text-sm p-3 border border-neutral-200 rounded-xl focus:ring-1 focus:ring-neutral-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">WhatsApp / Telefone *</label>
                <input
                  type="tel"
                  required
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(92) 99999-9999"
                  className="w-full text-xs sm:text-sm p-3 border border-neutral-200 rounded-xl focus:ring-1 focus:ring-neutral-900"
                />
              </div>
            </div>
          </div>

          {/* Seção 2: Entrega ou Retirada */}
          <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-neutral-900 text-white text-xs flex items-center justify-center font-bold">
                2
              </span>
              Como prefere receber?
            </h2>

            <div className="grid grid-cols-2 gap-3">
              {store.aceitaEntrega !== false && (
                <button
                  type="button"
                  onClick={() => setOrderType('entrega')}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    orderType === 'entrega'
                      ? 'border-neutral-900 bg-neutral-50 shadow-xs'
                      : 'border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <p className="font-bold text-sm text-neutral-900">🛵 Entrega</p>
                  <p className="text-xs text-neutral-500 mt-0.5">Receba no seu endereço</p>
                </button>
              )}

              {store.aceitaRetirada !== false && (
                <button
                  type="button"
                  onClick={() => setOrderType('retirada')}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    orderType === 'retirada'
                      ? 'border-neutral-900 bg-neutral-50 shadow-xs'
                      : 'border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <p className="font-bold text-sm text-neutral-900">🛍️ Retirada no Balcão</p>
                  <p className="text-xs text-neutral-500 mt-0.5">Retire sem taxa de entrega</p>
                </button>
              )}
            </div>

            {/* Endereço de Entrega */}
            {orderType === 'entrega' ? (
              <div className="pt-3 border-t border-neutral-100 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      Bairro Atendido *
                    </label>
                    <select
                      required
                      value={bairroId}
                      onChange={(e) => handleZoneChange(e.target.value)}
                      className="w-full text-xs sm:text-sm p-3 border border-neutral-200 rounded-xl bg-white focus:ring-1 focus:ring-neutral-900 font-medium"
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
                    <label className="block text-xs font-bold text-neutral-700 mb-1">Rua / Avenida *</label>
                    <input
                      type="text"
                      required
                      value={rua}
                      onChange={(e) => setRua(e.target.value)}
                      placeholder="Ex: Rua Rio Purus"
                      className="w-full text-xs sm:text-sm p-3 border border-neutral-200 rounded-xl focus:ring-1 focus:ring-neutral-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">Número *</label>
                    <input
                      type="text"
                      required
                      value={numero}
                      onChange={(e) => setNumero(e.target.value)}
                      placeholder="Ex: 120"
                      className="w-full text-xs sm:text-sm p-3 border border-neutral-200 rounded-xl focus:ring-1 focus:ring-neutral-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">Complemento</label>
                    <input
                      type="text"
                      value={complemento}
                      onChange={(e) => setComplemento(e.target.value)}
                      placeholder="Ex: Apto 402, Bloco C"
                      className="w-full text-xs sm:text-sm p-3 border border-neutral-200 rounded-xl focus:ring-1 focus:ring-neutral-900"
                    />
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-bold text-neutral-700 mb-1">Ponto de Referência</label>
                    <input
                      type="text"
                      value={referencia}
                      onChange={(e) => setReferencia(e.target.value)}
                      placeholder="Ex: Em frente à praça"
                      className="w-full text-xs sm:text-sm p-3 border border-neutral-200 rounded-xl focus:ring-1 focus:ring-neutral-900"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-xs text-neutral-600">
                <p className="font-bold text-neutral-800">Endereço da Loja para Retirada:</p>
                <p className="mt-0.5">{store.endereco || 'Endereço informado pelo estabelecimento'}</p>
                <p className="mt-1 text-emerald-700 font-bold">
                  Previsão para retirada: ~{store.tempoEstimadoRetiradaMin || 25} minutos após a confirmação.
                </p>
              </div>
            )}
          </div>

          {/* Seção 3: Forma de Pagamento */}
          <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-neutral-900 text-white text-xs flex items-center justify-center font-bold">
                3
              </span>
              Forma de Pagamento
            </h2>

            <div className="space-y-2">
              {store.pagamentos?.pix !== false && (
                <label
                  onClick={() => setPaymentMethod('pix')}
                  className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
                    paymentMethod === 'pix' ? 'border-neutral-900 bg-neutral-50 font-medium' : 'border-neutral-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <QrCode className="w-5 h-5 text-teal-600" />
                    <div>
                      <p className="text-sm font-bold text-neutral-900">Pix (Copia e Cola + QR Code)</p>
                      <p className="text-xs text-neutral-500">Pague pelo app do seu banco com rapidez</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md">
                    Recomendado
                  </span>
                </label>
              )}

              {store.pagamentos?.cartaoEntrega !== false && (
                <label
                  onClick={() => setPaymentMethod('cartao_entrega')}
                  className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
                    paymentMethod === 'cartao_entrega'
                      ? 'border-neutral-900 bg-neutral-50 font-medium'
                      : 'border-neutral-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-5 h-5 text-indigo-600" />
                    <div>
                      <p className="text-sm font-bold text-neutral-900">Cartão na Entrega</p>
                      <p className="text-xs text-neutral-500">O entregador levará a maquininha (Débito/Crédito)</p>
                    </div>
                  </div>
                </label>
              )}

              {store.pagamentos?.dinheiro !== false && (
                <div
                  className={`p-3.5 rounded-xl border transition-all ${
                    paymentMethod === 'dinheiro' ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200'
                  }`}
                >
                  <label
                    onClick={() => setPaymentMethod('dinheiro')}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <DollarSign className="w-5 h-5 text-emerald-600" />
                      <div>
                        <p className="text-sm font-bold text-neutral-900">Dinheiro</p>
                        <p className="text-xs text-neutral-500">Pagamento em cédulas na entrega ou retirada</p>
                      </div>
                    </div>
                  </label>

                  {paymentMethod === 'dinheiro' && (
                    <div className="mt-3 pt-3 border-t border-neutral-200 flex items-center gap-3">
                      <label className="text-xs font-bold text-neutral-700">Precisa de troco para quanto?</label>
                      <input
                        type="text"
                        value={trocoPara}
                        onChange={(e) => setTrocoPara(e.target.value)}
                        placeholder={`Ex: ${(Math.ceil(total / 10) * 10 + 10).toFixed(2)}`}
                        className="w-32 text-xs p-2 border border-neutral-300 rounded-lg focus:ring-1 focus:ring-neutral-900"
                      />
                    </div>
                  )}
                </div>
              )}

              {store.pagamentos?.whatsapp !== false && (
                <label
                  onClick={() => setPaymentMethod('whatsapp')}
                  className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
                    paymentMethod === 'whatsapp'
                      ? 'border-neutral-900 bg-neutral-50 font-medium'
                      : 'border-neutral-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <MessageCircle className="w-5 h-5 text-emerald-600" />
                    <div>
                      <p className="text-sm font-bold text-neutral-900">Combinar no WhatsApp</p>
                      <p className="text-xs text-neutral-500">Combine a forma de pagamento diretamente no chat</p>
                    </div>
                  </div>
                </label>
              )}
            </div>
          </div>

          {/* Seção 4: Resumo e Confirmação */}
          <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-neutral-900">Resumo do Pedido</h2>

            <div className="space-y-2 text-sm text-neutral-600 border-b border-neutral-100 pb-3">
              <div className="flex justify-between">
                <span>Subtotal ({items.length} itens)</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {couponDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Desconto ({appliedCoupon?.codigo})</span>
                  <span>-{formatCurrency(couponDiscount)}</span>
                </div>
              )}
              {orderType === 'entrega' && (
                <div className="flex justify-between">
                  <span>Taxa de Entrega</span>
                  <span>{selectedZone ? formatCurrency(deliveryFee) : 'Selecione o bairro'}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-black text-neutral-900 pt-2 border-t border-neutral-200">
                <span>Total a pagar</span>
                <span style={{ color: store.corPrimaria }}>{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Termo de Consentimento LGPD */}
            <label className="flex items-start gap-2.5 text-xs text-neutral-500 cursor-pointer pt-1">
              <input
                type="checkbox"
                required
                checked={lgpdConsent}
                onChange={(e) => setLgpdConsent(e.target.checked)}
                className="mt-0.5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
              />
              <span>
                Concordo com o compartilhamento dos meus dados (nome, telefone e endereço) estritamente para o
                processamento e entrega deste pedido pelo estabelecimento, de acordo com a LGPD.
              </span>
            </label>

            {/* Botão Confirmar Pedido */}
            <button
              type="submit"
              disabled={isSubmitting || !openStatus.isOpen}
              className="w-full py-4 px-4 rounded-xl text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-transform active:scale-[0.99] disabled:opacity-50 cursor-pointer"
              style={{ backgroundColor: store.corPrimaria }}
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Gravando pedido no Firestore...</span>
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
