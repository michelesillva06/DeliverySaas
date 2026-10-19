import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  DollarSign,
  TrendingUp,
  ShoppingBag,
  CreditCard,
  QrCode,
  Bike,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Store, Order } from '../../types';
import { subscribeToOrdersByStore } from '../../services/firestoreService';
import { formatCurrency } from '../../lib/formatters';

export const ReportsPage: React.FC = () => {
  const { store } = useOutletContext<{ store: Store }>();
  const [period, setPeriod] = useState<'hoje' | '7dias' | 'mes' | 'todos'>('mes');
  const [allOrders, setAllOrders] = useState<Order[]>([]);

  useEffect(() => {
    const unsub = subscribeToOrdersByStore(store.id, (orders) => setAllOrders(orders));
    return () => unsub();
  }, [store.id]);

  // Filtrar pedidos por período
  const filteredOrders = useMemo(() => {
    const now = new Date();
    return allOrders.filter((o) => {
      const orderDate = new Date(o.criadoEm);
      if (period === 'hoje') {
        return orderDate.toDateString() === now.toDateString();
      }
      if (period === '7dias') {
        const diffDays = (now.getTime() - orderDate.getTime()) / (1000 * 3600 * 24);
        return diffDays <= 7;
      }
      if (period === 'mes') {
        return (
          orderDate.getMonth() === now.getMonth() &&
          orderDate.getFullYear() === now.getFullYear()
        );
      }
      return true;
    });
  }, [allOrders, period]);

  // Pedidos válidos (não cancelados) para métricas de faturamento
  const validOrders = useMemo(() => {
    return filteredOrders.filter((o) => o.status !== 'cancelado');
  }, [filteredOrders]);

  const chartData = useMemo(() => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('pt-BR', { weekday: 'short' });
      const ordersInDate = validOrders.filter((o) => new Date(o.criadoEm).toDateString() === d.toDateString());
      const total = ordersInDate.reduce((acc, o) => acc + (o.total || 0), 0);
      data.push({ name: dateStr, faturamento: total });
    }
    return data;
  }, [validOrders]);

  const faturamentoTotal = validOrders.reduce((acc, o) => acc + (o.total || 0), 0);
  const ticketMedio = validOrders.length > 0 ? faturamentoTotal / validOrders.length : 0;
  const pedidosConcluidos = validOrders.filter((o) => o.status === 'entregue').length;
  const pedidosCancelados = filteredOrders.filter((o) => o.status === 'cancelado').length;

  // Breakdown por Forma de Pagamento
  const paymentBreakdown = useMemo(() => {
    const map: { [key: string]: { count: number; total: number } } = {
      pix: { count: 0, total: 0 },
      dinheiro: { count: 0, total: 0 },
      cartao_entrega: { count: 0, total: 0 },
      whatsapp: { count: 0, total: 0 },
    };

    validOrders.forEach((o) => {
      const forma = o.pagamento?.forma || 'whatsapp';
      if (map[forma]) {
        map[forma].count += 1;
        map[forma].total += o.total || 0;
      }
    });

    return map;
  }, [validOrders]);

  // Breakdown por Tipo de Pedido (Entrega vs Retirada)
  const deliveryCount = validOrders.filter((o) => o.tipo === 'entrega').length;
  const pickupCount = validOrders.filter((o) => o.tipo === 'retirada').length;

  // Ranking Top Produtos
  const topProducts = useMemo(() => {
    const map: { [nome: string]: { qtd: number; total: number } } = {};

    validOrders.forEach((o) => {
      o.itens?.forEach((it) => {
        if (!map[it.nome]) {
          map[it.nome] = { qtd: 0, total: 0 };
        }
        map[it.nome].qtd += it.qtd || 1;
        map[it.nome].total += it.totalItem || ((it.precoUnit || 0) * (it.qtd || 1));
      });
    });

    return Object.entries(map)
      .map(([nome, data]) => ({ nome, ...data }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 5);
  }, [validOrders]);

  return (
    <div className="space-y-6">
      {/* Topo com Seletor de Período */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-neutral-900">Relatórios & Métricas</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Acompanhe o faturamento, volume de pedidos e produtos mais vendidos sincronizados no Firestore
          </p>
        </div>

        <div className="flex bg-white p-1 rounded-xl border border-neutral-200 shadow-xs text-xs font-bold">
          <button
            onClick={() => setPeriod('hoje')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              period === 'hoje' ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Hoje
          </button>
          <button
            onClick={() => setPeriod('7dias')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              period === '7dias' ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Últimos 7 Dias
          </button>
          <button
            onClick={() => setPeriod('mes')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              period === 'mes' ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Este Mês
          </button>
          <button
            onClick={() => setPeriod('todos')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              period === 'todos' ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Histórico Completo
          </button>
        </div>
      </div>

      {/* Gráfico de Faturamento */}
      <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-4">
        <h2 className="font-bold text-sm text-neutral-900">Faturamento Diário (Últimos 7 dias)</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(value) => `R$${value}`} />
              <Tooltip formatter={(value: any) => [formatCurrency(Number(value) || 0), 'Faturamento']} />
              <Bar dataKey="faturamento" fill="#e11d48" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Grid de Métricas Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-500 uppercase">Faturamento Bruto</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-neutral-900">{formatCurrency(faturamentoTotal)}</p>
          <p className="text-[11px] text-neutral-400">Total apurado no período</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-500 uppercase">Total de Pedidos</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-neutral-900">{validOrders.length}</p>
          <p className="text-[11px] text-neutral-400">
            {pedidosConcluidos} entregues • {pedidosCancelados} cancelados
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-500 uppercase">Ticket Médio</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-neutral-900">{formatCurrency(ticketMedio)}</p>
          <p className="text-[11px] text-neutral-400">Valor médio por compra</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-500 uppercase">Distribuição Tipo</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Bike className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <div>
              <p className="text-lg font-black text-neutral-900">{deliveryCount}</p>
              <p className="text-[10px] text-neutral-500">🛵 Entregas</p>
            </div>
            <div className="w-px h-8 bg-neutral-200" />
            <div>
              <p className="text-lg font-black text-neutral-900">{pickupCount}</p>
              <p className="text-[10px] text-neutral-500">🛍️ Balcão</p>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Formas de Pagamento e Top Produtos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formas de Pagamento */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-4">
          <h2 className="font-bold text-sm text-neutral-900">Faturamento por Forma de Pagamento</h2>
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 bg-teal-50/60 rounded-xl border border-teal-100">
              <div className="flex items-center gap-2.5">
                <QrCode className="w-5 h-5 text-teal-700" />
                <div>
                  <p className="font-bold text-neutral-900">Pix (BR Code / QR Code)</p>
                  <p className="text-neutral-500 text-[11px]">{paymentBreakdown.pix.count} pedidos</p>
                </div>
              </div>
              <span className="font-black text-sm text-neutral-900">
                {formatCurrency(paymentBreakdown.pix.total)}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-100">
              <div className="flex items-center gap-2.5">
                <CreditCard className="w-5 h-5 text-indigo-600" />
                <div>
                  <p className="font-bold text-neutral-900">Cartão na Entrega</p>
                  <p className="text-neutral-500 text-[11px]">{paymentBreakdown.cartao_entrega.count} pedidos</p>
                </div>
              </div>
              <span className="font-black text-sm text-neutral-900">
                {formatCurrency(paymentBreakdown.cartao_entrega.total)}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-100">
              <div className="flex items-center gap-2.5">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                <div>
                  <p className="font-bold text-neutral-900">Dinheiro em Espécie</p>
                  <p className="text-neutral-500 text-[11px]">{paymentBreakdown.dinheiro.count} pedidos</p>
                </div>
              </div>
              <span className="font-black text-sm text-neutral-900">
                {formatCurrency(paymentBreakdown.dinheiro.total)}
              </span>
            </div>
          </div>
        </div>

        {/* Top 5 Produtos Mais Vendidos */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-4">
          <h2 className="font-bold text-sm text-neutral-900">Top 5 Produtos Mais Vendidos</h2>
          <div className="space-y-2.5 text-xs">
            {topProducts.length === 0 ? (
              <div className="py-8 text-center text-neutral-400">Nenhuma venda registrada no período.</div>
            ) : (
              topProducts.map((p, idx) => (
                <div key={p.nome} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-neutral-50">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-neutral-900 text-white font-bold flex items-center justify-center text-xs">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="font-bold text-neutral-900">{p.nome}</p>
                      <p className="text-[11px] text-neutral-500">{p.qtd} unidades vendidas</p>
                    </div>
                  </div>
                  <span className="font-bold text-neutral-900">{formatCurrency(p.total)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
