import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Package,
  Bike,
  MessageCircle,
  RotateCcw,
  AlertCircle,
  ShoppingBag,
  ShieldAlert,
} from 'lucide-react';
import {
  getStoreBySlugFromFirestore,
  subscribeToStoreBySlug,
  subscribeToOrderById,
  getOrderByIdFromFirestore,
  ensureAnonymousCustomerAuth,
} from '../../services/firestoreService';
import { Store, Order, OrderStatus } from '../../types';
import { formatCurrency, generateWhatsAppUrl, getPaymentMethodLabel } from '../../lib/formatters';
import { PixPaymentModal } from '../../components/PixPaymentModal';
import { CartProvider, useCart } from '../../services/cartContext';
import { useAuth } from '../../services/authContext';
import { useToast } from '../../components/Toast';

export const OrderTrackingWrapper: React.FC = () => {
  const { slug, orderId } = useParams<{ slug: string; orderId: string }>();
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
        Carregando acompanhamento do pedido...
      </div>
    );
  }

  if (!store || !orderId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 text-base font-bold text-neutral-700 bg-neutral-50">
        Loja ou pedido não encontrado.
      </div>
    );
  }

  return (
    <CartProvider storeId={store.id} storeSlug={store.slug}>
      <OrderTrackingContent store={store} orderId={orderId} />
    </CartProvider>
  );
};

const OrderTrackingContent: React.FC<{ store: Store; orderId: string }> = ({ store, orderId }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { currentUser, firebaseUser } = useAuth();
  const { addItem } = useCart();
  const [order, setOrder] = useState<Order | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const activeUid = firebaseUser?.uid || currentUser?.uid;

    ensureAnonymousCustomerAuth()
      .catch((err) => console.warn('Aviso ao iniciar sessão no rastreio:', err))
      .finally(() => {
        if (!isMounted) return;

        getOrderByIdFromFirestore(orderId)
          .then((ord) => {
            if (!isMounted) return;
            if (ord) {
              const isOwner = currentUser?.storeId === ord.storeId || currentUser?.role === 'superadmin';
              const isCustomer = activeUid && ord.customerUid === activeUid;
              if (ord.customerUid && activeUid && !isOwner && !isCustomer) {
                setUnauthorized(true);
              } else {
                setOrder(ord);
              }
            }
            setLoadingOrder(false);
          })
          .catch((err) => {
            if (!isMounted) return;
            if (err?.code === 'permission-denied') {
              setUnauthorized(true);
            }
            setLoadingOrder(false);
          });
      });

    const unsub = subscribeToOrderById(
      orderId,
      (updated) => {
        if (!isMounted) return;
        if (updated) {
          const isOwner = currentUser?.storeId === updated.storeId || currentUser?.role === 'superadmin';
          const isCustomer = activeUid && updated.customerUid === activeUid;
          if (updated.customerUid && activeUid && !isOwner && !isCustomer) {
            setUnauthorized(true);
          } else {
            setOrder(updated);
          }
        }
        setLoadingOrder(false);
      },
      (err) => {
        if (!isMounted) return;
        if (err?.code === 'permission-denied') {
          setUnauthorized(true);
        }
        setLoadingOrder(false);
      }
    );

    return () => {
      isMounted = false;
      unsub();
    };
  }, [orderId, firebaseUser?.uid, currentUser?.uid, currentUser?.storeId, currentUser?.role]);

  if (loadingOrder) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 text-base font-bold text-neutral-600 bg-neutral-50">
        Carregando acompanhamento do pedido...
      </div>
    );
  }

  if (unauthorized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-neutral-50">
        <ShieldAlert className="w-16 h-16 text-rose-500 mb-3" />
        <h2 className="text-2xl font-black text-neutral-900">Acesso Restrito ao Pedido</h2>
        <p className="text-base text-neutral-600 mt-2 max-w-sm">
          Este pedido pertence a outro cliente. Por políticas de proteção de dados, somente o titular pode acompanhá-lo.
        </p>
        <Link
          to={`/${store.slug}`}
          className="mt-6 px-6 py-3.5 bg-neutral-900 text-white rounded-2xl text-base font-black min-h-[48px] inline-flex items-center"
        >
          Voltar ao Cardápio
        </Link>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-neutral-50">
        <Package className="w-16 h-16 text-neutral-300 mb-3" />
        <h2 className="text-2xl font-black text-neutral-900">Pedido não localizado</h2>
        <p className="text-base text-neutral-500 mt-2">Verifique o link ou retorne ao cardápio.</p>
        <Link
          to={`/${store.slug}`}
          className="mt-6 px-6 py-3.5 bg-neutral-900 text-white rounded-2xl text-base font-black min-h-[48px] inline-flex items-center"
        >
          Voltar ao Cardápio
        </Link>
      </div>
    );
  }

  // Passos da Timeline
  const steps: { key: OrderStatus; label: string; desc: string }[] = [
    { key: 'novo', label: 'Recebido', desc: 'Aguardando confirmação do lojista' },
    { key: 'aceito', label: 'Aceito', desc: 'Pedido confirmado pela loja' },
    { key: 'preparo', label: 'Em preparo', desc: 'Sendo preparado na cozinha' },
    {
      key: order.tipo === 'entrega' ? 'saiu_entrega' : 'pronto',
      label: order.tipo === 'entrega' ? 'A caminho' : 'Pronto',
      desc: order.tipo === 'entrega' ? 'Saiu para entrega com o entregador' : 'Pronto para retirada no balcão',
    },
    { key: 'entregue', label: 'Concluído', desc: 'Entregue com sucesso' },
  ];

  const statusOrder: OrderStatus[] = [
    'novo',
    'aceito',
    'preparo',
    order.tipo === 'entrega' ? 'saiu_entrega' : 'pronto',
    'entregue',
  ];

  const currentStepIndex = statusOrder.indexOf(order.status);
  const isCancelled = order.status === 'cancelado';

  const handleRepeatOrder = () => {
    order.itens.forEach((it) => {
      addItem({
        produtoId: it.produtoId,
        nome: it.nome,
        qtd: it.qtd,
        precoUnit: it.precoUnit,
        complementos: it.complementos,
        obs: it.obs,
        totalItem: it.totalItem,
      });
    });
    showToast('Itens adicionados à sua sacola!', 'success');
    navigate(`/${store.slug}`);
  };

  const handleOpenWhatsApp = () => {
    if (!store.whatsapp) {
      showToast('O estabelecimento não possui número de WhatsApp configurado.', 'info');
      return;
    }

    let text = `*🍟 RESUMO DO PEDIDO #${order.numero}*\n`;
    text += `*Loja:* ${store.nome}\n`;
    text += `*Cliente:* ${order.cliente.nome}\n`;
    text += `*Telefone:* ${order.cliente.telefone}\n`;
    text += `*Modalidade:* ${order.tipo === 'entrega' ? '🛵 Entrega' : '🛍️ Retirada no Balcão'}\n`;
    if (order.tipo === 'entrega' && order.endereco) {
      text += `*Endereço:* ${order.endereco.rua}, ${order.endereco.numero} - ${order.endereco.bairro}\n`;
    }
    text += `\n*Itens:*\n`;
    order.itens.forEach((it) => {
      text += `• ${it.qtd}x ${it.nome} (${formatCurrency(it.totalItem)})\n`;
      if (it.complementos && it.complementos.length > 0) {
        it.complementos.forEach((c) => {
          text += `  ↳ + ${c.nome} (${formatCurrency(c.preco * it.qtd)})\n`;
        });
      }
    });
    text += `\n*Subtotal:* ${formatCurrency(order.subtotal)}\n`;
    if (order.desconto) text += `*Desconto:* -${formatCurrency(order.desconto)}\n`;
    if (order.taxaEntrega) text += `*Taxa de Entrega:* ${formatCurrency(order.taxaEntrega)}\n`;
    if (typeof order.taxaServico === 'number' && order.taxaServico > 0) {
      text += `*Taxa de Serviço:* ${formatCurrency(order.taxaServico)} (Uso e manutenção da plataforma)\n`;
    }
    text += `\n*TOTAL:* *${formatCurrency(order.total)}*\n`;
    text += `*Link de Acompanhamento:*\n${window.location.origin}/#/${store.slug}/pedido/${order.id}`;

    window.location.href = generateWhatsAppUrl(store.whatsapp, text);
  };

  return (
    <div className="min-h-screen bg-neutral-100 pb-24 text-base">
      {/* Topo do Acompanhamento */}
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
              <span className="font-black text-base text-[#111111] truncate hidden sm:inline max-w-[180px]">
                {store.nome}
              </span>
            </div>
          </Link>

          <span className="font-black text-base text-[#111111] bg-neutral-100 px-4 py-2 rounded-2xl border border-neutral-300">
            Pedido #{order.numero}
          </span>

          <button
            type="button"
            onClick={handleOpenWhatsApp}
            className="text-sm sm:text-base font-black text-emerald-800 bg-emerald-50 px-3.5 py-2 rounded-2xl border border-emerald-300 flex items-center gap-2 hover:bg-emerald-100 transition-colors cursor-pointer min-h-[44px]"
          >
            <MessageCircle className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">WhatsApp Loja</span>
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Banner de Status Principal */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200 shadow-sm text-center space-y-5">
          <div className="inline-flex p-4 rounded-full bg-neutral-900 text-white shadow-md">
            {isCancelled ? (
              <AlertCircle className="w-10 h-10 text-rose-400" />
            ) : order.status === 'entregue' ? (
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            ) : order.status === 'saiu_entrega' ? (
              <Bike className="w-10 h-10 text-amber-300" />
            ) : order.status === 'pronto' ? (
              <ShoppingBag className="w-10 h-10 text-blue-400" />
            ) : (
              <Clock className="w-10 h-10 text-rose-300" />
            )}
          </div>

          <div>
            <span className="text-sm font-black uppercase tracking-wider text-neutral-400">
              Status Atual • Pedido #{order.numero}
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 mt-1">
              {isCancelled
                ? 'Pedido Cancelado'
                : order.status === 'novo'
                ? 'Pedido Recebido pela Loja!'
                : order.status === 'aceito'
                ? 'Pedido Confirmado!'
                : order.status === 'preparo'
                ? 'Em Preparo na Cozinha'
                : order.status === 'saiu_entrega'
                ? 'Saiu para Entrega!'
                : order.status === 'pronto'
                ? 'Pronto para Retirada!'
                : 'Pedido Entregue!'}
            </h1>
            <p className="text-base text-neutral-600 mt-2 max-w-lg mx-auto leading-relaxed">
              {isCancelled
                ? order.motivoCancelamento || 'O pedido foi cancelado pelo estabelecimento.'
                : order.status === 'novo'
                ? 'O estabelecimento já recebeu sua solicitação e em instantes irá confirmar o início do preparo.'
                : order.status === 'aceito'
                ? `A previsão informada é de aproximadamente ${order.tempoEstimadoMin || store.tempoEstimadoMin || 40} minutos.`
                : order.status === 'preparo'
                ? 'Seus itens estão sendo preparados na cozinha com todo o capricho.'
                : order.status === 'saiu_entrega'
                ? 'O entregador está a caminho do seu endereço. Fique atento ao portão!'
                : order.status === 'pronto'
                ? 'Seu pedido está pronto e embalado aguardando retirada no balcão.'
                : 'Obrigado pela preferência! Bom apetite!'}
            </p>
          </div>

          {/* Timeline de Etapas */}
          {!isCancelled && (
            <div className="pt-6 border-t border-neutral-100">
              <div className="relative flex items-center justify-between max-w-md mx-auto px-2">
                <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-1.5 bg-neutral-200 z-0" />
                <div
                  className="absolute left-6 top-1/2 -translate-y-1/2 h-1.5 bg-neutral-900 transition-all duration-500 z-0"
                  style={{
                    width: `${Math.max(0, (currentStepIndex / (steps.length - 1)) * 100)}%`,
                  }}
                />

                {steps.map((step, idx) => {
                  const isCompleted = currentStepIndex >= idx;
                  const isCurrent = currentStepIndex === idx;

                  return (
                    <div key={step.key} className="relative z-10 flex flex-col items-center">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black transition-all ${
                          isCompleted
                            ? 'bg-neutral-900 text-white ring-4 ring-white shadow-md'
                            : 'bg-neutral-200 text-neutral-500'
                        }`}
                      >
                        {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
                      </div>
                      <span
                        className={`text-xs sm:text-sm font-black mt-2 text-center whitespace-nowrap ${
                          isCurrent ? 'text-neutral-900' : isCompleted ? 'text-neutral-700' : 'text-neutral-400'
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal de Pagamento Pix caso aguardando */}
        {order.pagamento.forma === 'pix' && order.pagamento.status === 'aguardando' && (
          <PixPaymentModal order={order} store={store} />
        )}

        {/* Detalhes dos Itens do Pedido */}
        <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm space-y-4">
          <h2 className="text-xl font-black text-neutral-900">Itens do Pedido</h2>

          <div className="space-y-4 divide-y divide-neutral-100">
            {order.itens.map((it, idx) => (
              <div key={idx} className="pt-4 first:pt-0 flex justify-between items-start gap-4">
                <div className="flex-1">
                  <p className="font-black text-base text-neutral-900">
                    {it.qtd}x {it.nome}
                  </p>
                  {it.complementos && it.complementos.length > 0 && (
                    <ul className="text-sm text-neutral-600 font-medium space-y-1 mt-1">
                      {it.complementos.map((c, cIdx) => (
                        <li key={cIdx}>
                          + {c.nome} ({formatCurrency(c.preco * it.qtd)})
                        </li>
                      ))}
                    </ul>
                  )}
                  {it.obs && <p className="text-sm text-neutral-700 italic mt-1 bg-neutral-50 p-2 rounded-xl">Obs: {it.obs}</p>}
                </div>
                <span className="font-black text-base text-neutral-900 flex-shrink-0">{formatCurrency(it.totalItem)}</span>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-neutral-200 space-y-2 text-base text-neutral-700">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-bold">{formatCurrency(order.subtotal)}</span>
            </div>
            {order.desconto ? (
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>Desconto {order.cupom ? `(${order.cupom})` : ''}</span>
                <span>-{formatCurrency(order.desconto)}</span>
              </div>
            ) : null}
            {order.tipo === 'entrega' && (
              <div className="flex justify-between">
                <span>Taxa de Entrega</span>
                <span className="font-bold">{formatCurrency(order.taxaEntrega || 0)}</span>
              </div>
            )}
            {typeof order.taxaServico === 'number' && order.taxaServico > 0 && (
              <div className="flex flex-col gap-0.5">
                <div className="flex justify-between items-center text-neutral-800">
                  <span className="font-medium">Taxa de serviço da plataforma</span>
                  <span className="font-bold">{formatCurrency(order.taxaServico)}</span>
                </div>
                <span className="text-xs text-neutral-500">
                  Valor destinado ao uso e à manutenção da plataforma de pedidos.
                </span>
              </div>
            )}
            <div className="flex justify-between text-xl font-black text-neutral-900 pt-3 border-t border-neutral-200">
              <span>Total Pago / A Pagar</span>
              <span>{formatCurrency(order.total)}</span>
            </div>
          </div>
        </div>

        {/* Informações de Entrega / Retirada e Pagamento */}
        <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm space-y-4 text-base">
          <h2 className="text-xl font-black text-neutral-900">Entrega e Pagamento</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <p className="text-neutral-500 font-black uppercase text-xs">Cliente</p>
              <p className="font-black text-neutral-900 text-lg mt-0.5">{order.cliente.nome}</p>
              <p className="text-neutral-700 font-medium">{order.cliente.telefone}</p>
            </div>

            <div>
              <p className="text-neutral-500 font-black uppercase text-xs">Forma de Pagamento</p>
              <p className="font-black text-neutral-900 text-lg mt-0.5 capitalize">
                {getPaymentMethodLabel(order.pagamento.forma, order.tipo)}
              </p>
              <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-black mt-1 uppercase ${
                  order.pagamento.status === 'confirmado'
                    ? 'bg-emerald-100 text-emerald-900'
                    : order.pagamento.status === 'informado'
                    ? 'bg-amber-100 text-amber-900'
                    : 'bg-neutral-100 text-neutral-800'
                }`}
              >
                {order.pagamento.status === 'confirmado'
                  ? 'Confirmado / Pago'
                  : order.pagamento.status === 'informado'
                  ? 'Comprovante Enviado (Aguardando Loja)'
                  : order.pagamento.status === 'na_entrega'
                  ? 'Pagar na Entrega / Retirada'
                  : 'Aguardando Pagamento'}
              </span>
            </div>
          </div>

          {order.tipo === 'entrega' && order.endereco && (
            <div className="pt-3 border-t border-neutral-100">
              <p className="text-neutral-500 font-black uppercase text-xs">Endereço de Entrega</p>
              <p className="font-bold text-neutral-900 text-base mt-1">
                {order.endereco.rua}, {order.endereco.numero} - {order.endereco.bairro}
                {order.endereco.complemento ? ` (${order.endereco.complemento})` : ''}
              </p>
              {order.endereco.referencia && (
                <p className="text-neutral-600 text-sm mt-0.5">Ref: {order.endereco.referencia}</p>
              )}
            </div>
          )}
        </div>

        {/* Botões de Ação */}
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={handleRepeatOrder}
            className="flex-1 min-h-[54px] py-4 px-6 bg-neutral-900 hover:bg-neutral-800 text-white rounded-2xl text-base font-black flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-5 h-5" />
            <span>Pedir Novamente</span>
          </button>

          <button
            onClick={handleOpenWhatsApp}
            className="min-h-[54px] py-4 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-base font-black flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
          >
            <MessageCircle className="w-5 h-5" />
            <span>Falar com a Loja no WhatsApp</span>
          </button>
        </div>
      </main>
    </div>
  );
};
