import React, { useState, useMemo } from 'react';
import {
  DollarSign,
  TrendingUp,
  Award,
  Store as StoreIcon,
  Calendar,
  Info,
  Download,
  Filter,
} from 'lucide-react';
import { Store, Order } from '../../../types';
import { formatCurrency } from '../../../lib/formatters';

interface StoresFinancialTabProps {
  stores: Store[];
  orders: Order[];
}

export const StoresFinancialTab: React.FC<StoresFinancialTabProps> = ({ stores, orders }) => {
  const [period, setPeriod] = useState<'hoje' | '7dias' | '30dias' | 'todos'>('mes');

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Apenas pedidos válidos e concluídos (entregue ou retirada pronta)
  const validCompletedOrders = useMemo(() => {
    return orders.filter((o) => {
      if (o.teste) return false;
      if (o.status === 'cancelado') return false;
      return o.status === 'entregue' || (o.tipo === 'retirada' && o.status === 'pronto');
    });
  }, [orders]);

  // Filtragem por período
  const filteredOrders = useMemo(() => {
    return validCompletedOrders.filter((o) => {
      if (period === 'hoje') {
        return o.criadoEm.startsWith(todayStr);
      }
      const orderDate = new Date(o.criadoEm);
      const diffDays = (now.getTime() - orderDate.getTime()) / (1000 * 3600 * 24);
      if (period === '7dias') {
        return diffDays <= 7;
      }
      if (period === '30dias') {
        return diffDays <= 30;
      }
      return true; // 'todos'
    });
  }, [validCompletedOrders, period, todayStr]);

  // Métricas Consolidadas da Movimentação
  const metrics = useMemo(() => {
    const totalMovimentado = filteredOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const totalPedidos = filteredOrders.length;
    const ticketMedio = totalPedidos > 0 ? totalMovimentado / totalPedidos : 0;

    return {
      totalMovimentado,
      totalPedidos,
      ticketMedio,
    };
  }, [filteredOrders]);

  // Ranking de Lojas por Faturamento e Pedidos
  const storeRankings = useMemo(() => {
    const map = new Map<string, { store: Store; totalFaturado: number; totalPedidos: number; ticketMedio: number }>();

    // Inicializar lojas
    stores.forEach((s) => {
      map.set(s.id, {
        store: s,
        totalFaturado: 0,
        totalPedidos: 0,
        ticketMedio: 0,
      });
    });

    // Somar pedidos
    filteredOrders.forEach((o) => {
      const current = map.get(o.storeId);
      if (current) {
        current.totalFaturado += o.total || 0;
        current.totalPedidos += 1;
      }
    });

    const list = Array.from(map.values()).map((item) => ({
      ...item,
      ticketMedio: item.totalPedidos > 0 ? item.totalFaturado / item.totalPedidos : 0,
    }));

    // Ordenar por faturamento decrescente
    list.sort((a, b) => b.totalFaturado - a.totalFaturado);
    return list;
  }, [stores, filteredOrders]);

  // Exportar Ranking para CSV
  const handleExportCSV = () => {
    const headers = ['Posição', 'Loja', 'Slug', 'Pedidos Concluídos', 'Volume Total (R$)', 'Ticket Médio (R$)'];
    const rows = storeRankings.map((item, idx) => [
      idx + 1,
      `"${item.store.nome.replace(/"/g, '""')}"`,
      item.store.slug,
      item.totalPedidos,
      item.totalFaturado.toFixed(2),
      item.ticketMedio.toFixed(2),
    ].join(';'));

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `movimentacao_deliveries_${period}_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Cabeçalho */}
      <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-neutral-900 tracking-tight flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            <span>Movimentação Comercial dos Deliveries</span>
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            Volume de vendas processado pelas lojas parceiras (pedidos válidos e concluídos).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Seletor de Período */}
          <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl text-xs font-bold text-neutral-700">
            <button
              onClick={() => setPeriod('hoje')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                period === 'hoje' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              Hoje
            </button>
            <button
              onClick={() => setPeriod('7dias')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                period === '7dias' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              7 Dias
            </button>
            <button
              onClick={() => setPeriod('30dias')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                period === '30dias' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              30 Dias
            </button>
            <button
              onClick={() => setPeriod('todos')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                period === 'todos' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              Histórico Total
            </button>
          </div>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Cards de Métricas de Volume */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Movimentado */}
        <div className="bg-white p-5 rounded-3xl border border-neutral-200 shadow-xs space-y-1">
          <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
            Volume Movimentado no Período
          </span>
          <div className="text-3xl font-black text-neutral-900">
            {formatCurrency(metrics.totalMovimentado)}
          </div>
          <p className="text-[11px] text-neutral-500">
            Soma dos pedidos concluídos pelos deliveries
          </p>
        </div>

        {/* Quantidade de Pedidos */}
        <div className="bg-white p-5 rounded-3xl border border-neutral-200 shadow-xs space-y-1">
          <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
            Pedidos Concluídos no Período
          </span>
          <div className="text-3xl font-black text-indigo-600">
            {metrics.totalPedidos}
          </div>
          <p className="text-[11px] text-neutral-500">
            Pedidos entregues ou retirados com sucesso
          </p>
        </div>

        {/* Ticket Médio */}
        <div className="bg-white p-5 rounded-3xl border border-neutral-200 shadow-xs space-y-1">
          <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
            Ticket Médio por Pedido
          </span>
          <div className="text-3xl font-black text-emerald-600">
            {formatCurrency(metrics.ticketMedio)}
          </div>
          <p className="text-[11px] text-neutral-500">
            Média por pedido concluído na plataforma
          </p>
        </div>
      </div>

      {/* Aviso de Transparência Financeira */}
      <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start gap-3 text-amber-900 text-xs">
        <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold">Esclarecimento de Receita da Plataforma:</p>
          <p className="text-amber-800 leading-relaxed">
            Os valores acima representam o <strong>Volume de Pedidos Processados (GMV)</strong> pelos deliveries clientes da plataforma. Como os pagamentos comerciais (Pix da loja, cartão na maquininha ou dinheiro) ocorrem diretamente entre o cliente final e o lojista, esse valor não constitui receita própria do SaaS. A receita própria da plataforma é constituída pelas mensalidades e pelas <strong>taxas operacionais por pedido</strong>.
          </p>
        </div>
      </div>

      {/* Ranking de Lojas por Movimentação Comercial */}
      <div className="bg-white rounded-3xl border border-neutral-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <h3 className="font-black text-sm text-neutral-900 uppercase tracking-wider flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              <span>Ranking de Estabelecimentos por Vendas</span>
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              Classificação por faturamento movimentado e volume de pedidos no período selecionado.
            </p>
          </div>
          <span className="text-xs font-bold text-neutral-500">{storeRankings.length} loja(s)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-400 font-bold uppercase text-[10px]">
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4">Loja</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Pedidos Concluídos</th>
                <th className="py-3 px-4">Volume Total</th>
                <th className="py-3 px-4">Ticket Médio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 font-medium">
              {storeRankings.map((item, idx) => (
                <tr key={item.store.id} className="hover:bg-neutral-50/80 transition-colors">
                  <td className="py-3 px-4 text-center font-black text-neutral-400">
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}º`}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-bold text-neutral-900 block">{item.store.nome}</span>
                    <span className="text-[10px] text-neutral-400 font-mono">/{item.store.slug}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        item.store.status === 'ativa'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-neutral-200 text-neutral-600'
                      }`}
                    >
                      {item.store.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-bold text-neutral-800">
                    {item.totalPedidos} pedido(s)
                  </td>
                  <td className="py-3 px-4 font-black text-neutral-900 text-sm">
                    {formatCurrency(item.totalFaturado)}
                  </td>
                  <td className="py-3 px-4 text-neutral-600">
                    {formatCurrency(item.ticketMedio)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
