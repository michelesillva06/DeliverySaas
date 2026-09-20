import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Package,
  Bike,
  Home,
  MessageCircle,
  RotateCcw,
  AlertCircle,
  ShoppingBag,
  ExternalLink,
} from 'lucide-react';
import {
  getStoreBySlugFromFirestore,
  subscribeToStoreBySlug,
  subscribeToOrderById,
  getOrderByIdFromFirestore,
} from '../../services/firestoreService';
import { Store, Order, OrderStatus } from '../../types';
import { formatCurrency, formatDateTime, generateWhatsAppUrl } from '../../lib/formatters';
import { PixPaymentModal } from '../../components/PixPaymentModal';
import { ThermalReceipt } from '../../components/ThermalReceipt';
import { CartProvider, useCart } from '../../services/cartContext';
import { useToast } from '../../components/Toast';

export const OrderTrackingWrapper: React.FC = () => {
  const { slug, orderId } = useParams<{ slug: string; orderId: string }>();
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
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
        Carregando acompanhamento do pedido...
      </div>
    );
  }

  if (!store || !orderId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 text-sm font-bold text-neutral-700">
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
  const { addItem } = useCart();
  const [order, setOrder] = useState<Order | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(true);

  useEffect(() => {
    getOrderByIdFromFirestore(orderId).then((ord) => {
      setOrder(ord);
      setLoadingOrder(false);
    });

    const unsub = subscribeToOrderById(orderId, (updated) => {
      setOrder(updated);
      setLoadingOrder(false);
    });
    return () => unsub();
  }, [orderId]);

  if (loadingOrder) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 text-xs font-bold text-neutral-500">
        Buscando dados do pedido no Firestore...
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-neutral-50">
        <Package className="w-16 h-16 text-neutral-300 mb-3" />
        <h2 className="text-xl font-bold text-neutral-900">Pedido não localizado</h2>
        <p className="text-sm text-neutral-500 mt-1">Verifique o link ou retorne ao cardápio.</p>
        <Link
          to={`/${store.slug}`}
          className="mt-4 px-4 py-2 bg-neutral-900 text-white rounded-xl text-xs font-bold"
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

  // Ação Pedir de Novo
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

  // WhatsApp para tirar dúvidas sobre o pedido
  const handleOpenWhatsApp = () => {
    const text = `Olá! Gostaria de falar sobre o meu Pedido #${order.numero} (${order.cliente.nome}).`;
    if (store.whatsapp) {
      window.open(generateWhatsAppUrl(store.whatsapp, text), '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 pb-20">
      {/* Elemento oculto para impressão térmica se necessário */}
      <ThermalReceipt order={order} store={store} />

      {/* Topo */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <Link
            to={`/${store.slug}`}
            className="flex items-center gap-1.5 text-xs font-bold text-neutral-600 hover:text-neutral-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Cardápio</span>
          </Link>
          <span className="font-bold text-sm text-neutral-900">Acompanhar Pedido #{order.numero}</span>
          <button
            onClick={handleOpenWhatsApp}
            className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg flex items-center gap-1 hover:bg-emerald-100 transition-colors cursor-pointer"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ajuda</span>
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Banner de Status Principal */}
        <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-xs text-center space-y-4">
          <div className="inline-flex p-3.5 rounded-full bg-neutral-900 text-white shadow-xs">
            {isCancelled ? (
              <AlertCircle className="w-8 h-8 text-rose-400" />
            ) : order.status === 'entregue' ? (
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            ) : order.status === 'saiu_entrega' ? (
              <Bike className="w-8 h-8 text-amber-300" />
            ) : order.status === 'pronto' ? (
              <ShoppingBag className="w-8 h-8 text-blue-400" />
            ) : (
              <Clock className="w-8 h-8 text-rose-300" />
            )}
          </div>

          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Status Atual do Pedido #{order.numero}
            </span>
            <h1 className="text-2xl font-black text-neutral-900 mt-1">
              {isCancelled
                ? 'Pedido Cancelado'
                : order.status === 'novo'
                ? 'Pedido Recebido!'
                : order.status === 'aceito'
                ? 'Pedido Confirmado pela Loja!'
                : order.status === 'preparo'
                ? 'Em Preparo na Cozinha'
                : order.status === 'saiu_entrega'
                ? 'Saiu para Entrega!'
                : order.status === 'pronto'
                ? 'Pronto para Retirada!'
                : 'Pedido Entregue!'}
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500 mt-1 max-w-md mx-auto">
              {isCancelled
                ? order.motivoCancelamento || 'O pedido foi cancelado pelo estabelecimento.'
                : order.status === 'novo'
                ? 'O estabelecimento já recebeu sua solicitação e em instantes irá confirmar o início do preparo.'
                : order.status === 'aceito'
                ? `A previsão é de aproximadamente ${order.tempoEstimadoMin || store.tempoEstimadoMin || 40} minutos.`
                : order.status === 'preparo'
                ? 'Seus itens estão sendo preparados com todo o capricho.'
                : order.status === 'saiu_entrega'
                ? 'O entregador está a caminho do seu endereço. Fique atento ao portão!'
                : order.status === 'pronto'
                ? 'Seu pedido está embalado e te aguarda no balcão da loja.'
                : 'Obrigado pela preferência! Bom apetite!'}
            </p>
          </div>

          {/* Timeline de Etapas */}
          {!isCancelled && (
            <div className="pt-4 border-t border-neutral-100">
              <div className="relative flex items-center justify-between max-w-md mx-auto px-2">
                {/* Linha de Progresso de Fundo */}
                <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-1 bg-neutral-100 z-0" />
                {/* Linha de Progresso Ativa */}
                <div
                  className="absolute left-6 top-1/2 -translate-y-1/2 h-1 bg-neutral-900 transition-all duration-500 z-0"
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
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                          isCompleted
                            ? 'bg-neutral-900 text-white ring-4 ring-white shadow-xs'
                            : 'bg-neutral-200 text-neutral-400'
                        }`}
                      >
                        {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                      </div>
                      <span
                        className={`text-[10px] sm:text-xs font-bold mt-2 text-center whitespace-nowrap ${
                          isCurrent ? 'text-neutral-900 font-black' : isCompleted ? 'text-neutral-700' : 'text-neutral-400'
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

        {/* Detalhes do Pedido */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-neutral-900">Detalhes da Compra</h2>

          <div className="space-y-3 divide-y divide-neutral-100">
            {order.itens.map((it, idx) => (
              <div key={idx} className="pt-3 first:pt-0 flex justify-between items-start text-xs sm:text-sm">
                <div>
                  <p className="font-bold text-neutral-800">
                    {it.qtd}x {it.nome}
                  </p>
                  {it.complementos && it.complementos.length > 0 && (
                    <ul className="text-[11px] text-neutral-500 space-y-0.5 mt-0.5">
                      {it.complementos.map((c, cIdx) => (
                        <li key={cIdx}>
                          + {c.nome} ({formatCurrency(c.preco * it.qtd)})
                        </li>
                      ))}
                    </ul>
                  )}
                  {it.obs && <p className="text-[11px] text-amber-700 italic mt-0.5">Obs: {it.obs}</p>}
                </div>
                <span className="font-bold text-neutral-900">{formatCurrency(it.totalItem)}</span>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-neutral-200 space-y-1.5 text-xs text-neutral-600">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatCurrency(order.subtotal)}</span>
            </div>
            {order.desconto ? (
              <div className="flex justify-between text-emerald-600 font-medium">
                <span>Desconto {order.cupom ? `(${order.cupom})` : ''}</span>
                <span>-{formatCurrency(order.desconto)}</span>
              </div>
            ) : null}
            {order.tipo === 'entrega' && (
              <div className="flex justify-between">
                <span>Taxa de Entrega</span>
                <span>{formatCurrency(order.taxaEntrega || 0)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-black text-neutral-900 pt-2 border-t border-neutral-100">
              <span>Total Pago / A Pagar</span>
              <span>{formatCurrency(order.total)}</span>
            </div>
          </div>
        </div>

        {/* Informações de Entrega / Retirada e Pagamento */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-3 text-xs">
          <h2 className="text-base font-bold text-neutral-900 mb-2">Dados de Entrega e Pagamento</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-neutral-400 font-bold uppercase text-[10px]">Cliente</p>
              <p className="font-bold text-neutral-800 text-sm">{order.cliente.nome}</p>
              <p className="text-neutral-600">{order.cliente.telefone}</p>
            </div>

            <div>
              <p className="text-neutral-400 font-bold uppercase text-[10px]">Forma de Pagamento</p>
              <p className="font-bold text-neutral-800 text-sm capitalize">
                {order.pagamento.forma === 'pix'
                  ? 'Pix'
                  : order.pagamento.forma === 'cartao_entrega'
                  ? 'Cartão na Entrega'
                  : order.pagamento.forma === 'dinheiro'
                  ? 'Dinheiro'
                  : 'Combinar no WhatsApp'}
              </p>
              <span
                className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mt-0.5 uppercase ${
                  order.pagamento.status === 'confirmado'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {order.pagamento.status === 'confirmado' ? 'Pago' : 'Aguardando Pagamento'}
              </span>
            </div>
          </div>

          {order.tipo === 'entrega' && order.endereco && (
            <div className="pt-2 border-t border-neutral-100">
              <p className="text-neutral-400 font-bold uppercase text-[10px]">Endereço de Entrega</p>
              <p className="font-medium text-neutral-800 mt-0.5">
                {order.endereco.rua}, {order.endereco.numero} - {order.endereco.bairro}
                {order.endereco.complemento ? ` (${order.endereco.complemento})` : ''}
              </p>
              {order.endereco.referencia && (
                <p className="text-neutral-500 text-[11px] mt-0.5">Ref: {order.endereco.referencia}</p>
              )}
            </div>
          )}
        </div>

        {/* Botões de Ação */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleRepeatOrder}
            className="flex-1 py-3.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Pedir Novamente</span>
          </button>

          <button
            onClick={handleOpenWhatsApp}
            className="py-3.5 px-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Falar com a Loja no WhatsApp</span>
          </button>
        </div>
      </main>
    </div>
  );
};
