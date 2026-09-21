import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Clock,
  User,
  ShoppingBag,
  Bike,
  Printer,
  Search,
  CheckCircle2,
  ChevronRight,
  AlertCircle,
  QrCode,
  DollarSign,
} from 'lucide-react';
import { Store, Order, OrderStatus, Courier } from '../../types';
import {
  subscribeToOrdersByStore,
  subscribeToCouriersByStore,
  updateOrderStatusInFirestore,
} from '../../services/firestoreService';
import { formatCurrency, formatDateTime } from '../../lib/formatters';
import { OrderDetailModal } from '../../components/OrderDetailModal';
import { imprimirTicketEntrega, dispararImpressaoSequencialAoAceitar } from '../../lib/impressao';
import { playNewOrderAlert } from '../../lib/sound';
import { useToast } from '../../components/Toast';

export const OrdersKanbanPage: React.FC = () => {
  const { store } = useOutletContext<{ store: Store }>();
  const { showToast } = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'todos' | 'entrega' | 'retirada'>('todos');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    // Sincronização em tempo real 100% com Firestore
    const unsubOrders = subscribeToOrdersByStore(store.id, (firestoreOrders) => {
      setOrders(firestoreOrders);
      setSelectedOrder((prev) => (prev ? firestoreOrders.find((o) => o.id === prev.id) || null : null));
    });

    const unsubCouriers = subscribeToCouriersByStore(store.id, (c) => {
      setCouriers(c);
    });

    return () => {
      unsubOrders();
      unsubCouriers();
    };
  }, [store.id]);

  // Filtrar pedidos
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (filterType !== 'todos' && o.tipo !== filterType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNum = o.numero.toString().includes(q);
        const matchNome = o.cliente.nome.toLowerCase().includes(q);
        const matchTel = o.cliente.telefone.includes(q);
        if (!matchNum && !matchNome && !matchTel) return false;
      }
      return true;
    });
  }, [orders, filterType, searchQuery]);

  // Colunas do Kanban
  const colNovos = filteredOrders.filter((o) => o.status === 'novo');
  const colEmAndamento = filteredOrders.filter((o) => o.status === 'aceito' || o.status === 'preparo');
  const colProntos = filteredOrders.filter((o) => o.status === 'saiu_entrega' || o.status === 'pronto');
  const colFinalizados = filteredOrders.filter((o) => o.status === 'entregue' || o.status === 'cancelado').slice(0, 15);

  const handleQuickAdvance = async (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    try {
      if (order.status === 'novo') {
        await updateOrderStatusInFirestore(order.id, 'aceito');
        showToast(`Pedido #${order.numero} aceito!`, 'success');
        dispararImpressaoSequencialAoAceitar(order, store);
      } else if (order.status === 'aceito') {
        await updateOrderStatusInFirestore(order.id, 'preparo');
        showToast(`Pedido #${order.numero} em preparo!`, 'success');
      } else if (order.status === 'preparo') {
        const next = order.tipo === 'entrega' ? 'saiu_entrega' : 'pronto';
        await updateOrderStatusInFirestore(order.id, next);
        showToast(
          order.tipo === 'entrega' ? `Pedido #${order.numero} enviado para entrega!` : `Pedido #${order.numero} pronto para retirada!`,
          'success'
        );
      } else if (order.status === 'saiu_entrega' || order.status === 'pronto') {
        await updateOrderStatusInFirestore(order.id, 'entregue');
        showToast(`Pedido #${order.numero} concluído!`, 'success');
      }
    } catch (err) {
      console.error(err);
      showToast('Erro ao atualizar status do pedido no Firestore.', 'error');
    }
  };

  const handlePrintReceipt = (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    imprimirTicketEntrega(order, store);
  };

  return (
    <div className="space-y-4">
      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-neutral-200 shadow-xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por #número ou nome do cliente..."
            className="w-full text-xs pl-9 pr-3 py-2 bg-neutral-100 rounded-xl focus:outline-none focus:ring-1 focus:ring-neutral-900"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Filtro de Tipo */}
          <div className="flex bg-neutral-100 p-0.5 rounded-xl text-xs">
            <button
              onClick={() => setFilterType('todos')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                filterType === 'todos' ? 'bg-white shadow-xs text-neutral-900' : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              Todos ({orders.length})
            </button>
            <button
              onClick={() => setFilterType('entrega')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                filterType === 'entrega' ? 'bg-white shadow-xs text-neutral-900' : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              Entrega
            </button>
            <button
              onClick={() => setFilterType('retirada')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                filterType === 'retirada' ? 'bg-white shadow-xs text-neutral-900' : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              Retirada
            </button>
          </div>
        </div>
      </div>

      {/* Colunas do Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
        {/* Coluna 1: Novos */}
        <KanbanColumn
          title="Novos Pedidos"
          count={colNovos.length}
          color="bg-rose-500"
          badgeColor="bg-rose-100 text-rose-800"
        >
          {colNovos.length === 0 ? (
            <div className="p-8 text-center bg-white/60 border border-dashed border-neutral-200 rounded-2xl text-neutral-400 text-xs">
              Nenhum novo pedido no momento
            </div>
          ) : (
            colNovos.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onSelect={() => setSelectedOrder(order)}
                onQuickAdvance={(e) => handleQuickAdvance(e, order)}
                onPrint={(e) => handlePrintReceipt(e, order)}
              />
            ))
          )}
        </KanbanColumn>

        {/* Coluna 2: Em Preparo */}
        <KanbanColumn
          title="Em Preparo"
          count={colEmAndamento.length}
          color="bg-amber-500"
          badgeColor="bg-amber-100 text-amber-800"
        >
          {colEmAndamento.length === 0 ? (
            <div className="p-8 text-center bg-white/60 border border-dashed border-neutral-200 rounded-2xl text-neutral-400 text-xs">
              Nenhum pedido em produção
            </div>
          ) : (
            colEmAndamento.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onSelect={() => setSelectedOrder(order)}
                onQuickAdvance={(e) => handleQuickAdvance(e, order)}
                onPrint={(e) => handlePrintReceipt(e, order)}
              />
            ))
          )}
        </KanbanColumn>

        {/* Coluna 3: Prontos / Saiu para Entrega */}
        <KanbanColumn
          title="Prontos & Entrega"
          count={colProntos.length}
          color="bg-sky-500"
          badgeColor="bg-sky-100 text-sky-800"
        >
          {colProntos.length === 0 ? (
            <div className="p-8 text-center bg-white/60 border border-dashed border-neutral-200 rounded-2xl text-neutral-400 text-xs">
              Nenhum pedido aguardando entrega ou retirada
            </div>
          ) : (
            colProntos.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onSelect={() => setSelectedOrder(order)}
                onQuickAdvance={(e) => handleQuickAdvance(e, order)}
                onPrint={(e) => handlePrintReceipt(e, order)}
              />
            ))
          )}
        </KanbanColumn>

        {/* Coluna 4: Finalizados Recentemente */}
        <KanbanColumn
          title="Concluídos Hoje"
          count={colFinalizados.length}
          color="bg-emerald-500"
          badgeColor="bg-emerald-100 text-emerald-800"
        >
          {colFinalizados.length === 0 ? (
            <div className="p-8 text-center bg-white/60 border border-dashed border-neutral-200 rounded-2xl text-neutral-400 text-xs">
              Nenhum pedido finalizado hoje
            </div>
          ) : (
            colFinalizados.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onSelect={() => setSelectedOrder(order)}
                onQuickAdvance={(e) => handleQuickAdvance(e, order)}
                onPrint={(e) => handlePrintReceipt(e, order)}
              />
            ))
          )}
        </KanbanColumn>
      </div>

      {/* Modal de Detalhes do Pedido */}
      {selectedOrder && (
        <OrderDetailModal
          isOpen={!!selectedOrder}
          order={selectedOrder}
          store={store}
          couriers={couriers}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
};

interface KanbanColumnProps {
  title: string;
  count: number;
  color: string;
  badgeColor: string;
  children: React.ReactNode;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({ title, count, color, badgeColor, children }) => (
  <div className="flex flex-col bg-neutral-100/70 p-3 rounded-2xl border border-neutral-200/80 min-h-[500px]">
    <div className="flex items-center justify-between pb-3 mb-2 border-b border-neutral-200">
      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
        <h3 className="font-bold text-xs uppercase tracking-wide text-neutral-800">{title}</h3>
      </div>
      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${badgeColor}`}>{count}</span>
    </div>
    <div className="space-y-2.5 flex-1">{children}</div>
  </div>
);

interface OrderCardProps {
  order: Order;
  onSelect: () => void;
  onQuickAdvance: (e: React.MouseEvent) => void;
  onPrint: (e: React.MouseEvent) => void;
}

const OrderCard: React.FC<OrderCardProps> = ({ order, onSelect, onQuickAdvance, onPrint }) => {
  const isPixWaiting = order.pagamento.forma === 'pix' && order.pagamento.status !== 'confirmado';

  return (
    <div
      onClick={onSelect}
      className={`p-3.5 bg-white rounded-xl border transition-all cursor-pointer hover:shadow-md hover:border-neutral-400 group ${
        order.status === 'novo' ? 'border-rose-200 shadow-xs' : 'border-neutral-200'
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-black text-sm text-neutral-900">#{order.numero}</span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                order.tipo === 'entrega' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'
              }`}
            >
              {order.tipo === 'entrega' ? '🛵 Entrega' : '🛍️ Retirada'}
            </span>
          </div>
          <p className="text-xs font-bold text-neutral-800 mt-0.5 truncate max-w-[150px]">
            {order.cliente.nome}
          </p>
        </div>

        <div className="text-right">
          <span className="font-bold text-xs text-neutral-900">{formatCurrency(order.total)}</span>
          <span className="block text-[10px] text-neutral-400 mt-0.5">{formatDateTime(order.criadoEm).split(' ')[1]}</span>
        </div>
      </div>

      {/* Itens Resumo */}
      <div className="mt-2 text-xs text-neutral-600 line-clamp-2 bg-neutral-50 p-1.5 rounded-lg">
        {order.itens.map((it) => `${it.qtd}x ${it.nome}`).join(' • ')}
      </div>

      {/* Alertas Rápidos (Pix aguardando confirmação) */}
      {isPixWaiting && (
        <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 p-1 rounded">
          <QrCode className="w-3.5 h-3.5" />
          <span>Aguardando Pix</span>
        </div>
      )}

      {/* Rodapé do Card */}
      <div className="mt-3 pt-2.5 border-t border-neutral-100 flex items-center justify-between">
        <button
          onClick={onPrint}
          className="p-1 text-neutral-400 hover:text-neutral-900 transition-colors rounded hover:bg-neutral-100 cursor-pointer"
          title="Imprimir comanda"
        >
          <Printer className="w-3.5 h-3.5" />
        </button>

        {order.status !== 'cancelado' && order.status !== 'entregue' && (
          <button
            onClick={onQuickAdvance}
            className="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>
              {order.status === 'novo'
                ? 'Aceitar'
                : order.status === 'aceito'
                ? 'Preparar'
                : order.status === 'preparo'
                ? order.tipo === 'entrega'
                  ? 'Entregar'
                  : 'Pronto'
                : 'Concluir'}
            </span>
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};
