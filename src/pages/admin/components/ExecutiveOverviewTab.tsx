import React, { useState, useEffect, useMemo } from 'react';
import {
  Store as StoreIcon,
  ShoppingBag,
  TrendingUp,
  Users,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  MessageCircle,
  ExternalLink,
  ArrowRight,
  ShieldAlert,
  Crown,
  Activity,
  Flame,
} from 'lucide-react';
import { Store, Order } from '../../../types';
import { formatCurrency, formatDateTime, isStoreOpen } from '../../../lib/formatters';
import { subscribeToActiveStorefrontVisitors } from '../../../services/analyticsService';

interface ExecutiveOverviewTabProps {
  stores: Store[];
  orders: Order[];
  onNavigateTab: (tab: any) => void;
}

export const ExecutiveOverviewTab: React.FC<ExecutiveOverviewTabProps> = ({
  stores,
  orders,
  onNavigateTab,
}) => {
  const [activeVisitors, setActiveVisitors] = useState(0);
  const [activeStoresCount, setActiveStoresCount] = useState(0);
  const [todayViews, setTodayViews] = useState(0);

  // Escutar visitantes ativos ao vivo (últimos 5 min)
  useEffect(() => {
    const unsub = subscribeToActiveStorefrontVisitors((activeSessions, storesActive, views) => {
      setActiveVisitors(activeSessions);
      setActiveStoresCount(storesActive);
      setTodayViews(views);
    });
    return () => unsub();
  }, []);

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Métricas de Lojas
  const storeMetrics = useMemo(() => {
    const total = stores.length;
    const ativas = stores.filter((s) => s.status === 'ativa').length;
    const suspensas = stores.filter((s) => s.status === 'bloqueada' || s.status === 'vencida').length;
    
    // Abertas agora (usando isStoreOpen que verifica horário e botão aberta)
    let abertasAgora = 0;
    let fechadasAgora = 0;
    stores.forEach((s) => {
      const openStatus = isStoreOpen(s);
      if (openStatus.isOpen) abertasAgora++;
      else fechadasAgora++;
    });

    // Novas lojas
    const hojeCount = stores.filter((s) => (s.criadaEm || s.criadoEm || '').startsWith(todayStr)).length;
    const seteDiasCount = stores.filter((s) => {
      const d = s.criadaEm || s.criadoEm;
      if (!d) return false;
      return (now.getTime() - new Date(d).getTime()) / (1000 * 3600 * 24) <= 7;
    }).length;
    const trintaDiasCount = stores.filter((s) => {
      const d = s.criadaEm || s.criadoEm;
      if (!d) return false;
      return (now.getTime() - new Date(d).getTime()) / (1000 * 3600 * 24) <= 30;
    }).length;

    // Lojas com WhatsApp configurado
    const comWhatsapp = stores.filter((s) => (s.whatsapp || '').replace(/\D/g, '').length >= 10).length;

    return {
      total,
      ativas,
      suspensas,
      abertasAgora,
      fechadasAgora,
      hojeCount,
      seteDiasCount,
      trintaDiasCount,
      comWhatsapp,
    };
  }, [stores, todayStr]);

  // Métricas de Pedidos
  const orderMetrics = useMemo(() => {
    const pedidosHoje = orders.filter((o) => o.criadoEm.startsWith(todayStr));
    const emAndamentoHoje = pedidosHoje.filter(
      (o) => o.status === 'novo' || o.status === 'aceito' || o.status === 'preparo' || o.status === 'saiu_entrega'
    );
    const concluidosHoje = pedidosHoje.filter(
      (o) => o.status === 'entregue' || (o.tipo === 'retirada' && o.status === 'pronto')
    );
    const canceladosHoje = pedidosHoje.filter((o) => o.status === 'cancelado');

    const volumeConcluidoHoje = concluidosHoje.reduce((sum, o) => sum + (o.total || 0), 0);

    // Lojas ativas em pedidos hoje
    const lojasComPedidoHoje = new Set(pedidosHoje.map((o) => o.storeId)).size;
    const lojasComConcluidoHoje = new Set(concluidosHoje.map((o) => o.storeId)).size;

    // 7 e 30 dias
    const seteDiasOrders = orders.filter((o) => (now.getTime() - new Date(o.criadoEm).getTime()) / (1000 * 3600 * 24) <= 7);
    const trintaDiasOrders = orders.filter((o) => (now.getTime() - new Date(o.criadoEm).getTime()) / (1000 * 3600 * 24) <= 30);

    return {
      totalHoje: pedidosHoje.length,
      emAndamentoHoje: emAndamentoHoje.length,
      concluidosHoje: concluidosHoje.length,
      canceladosHoje: canceladosHoje.length,
      volumeConcluidoHoje,
      lojasComPedidoHoje,
      lojasComConcluidoHoje,
      total7Dias: seteDiasOrders.length,
      total30Dias: trintaDiasOrders.length,
    };
  }, [orders, todayStr]);

  // Taxa de conversão de visitas em pedidos
  const conversionRate = useMemo(() => {
    if (todayViews === 0) return 0;
    return (orderMetrics.totalHoje / todayViews) * 100;
  }, [orderMetrics.totalHoje, todayViews]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Banner de Tempo Real e Visão Geral */}
      <div className="bg-gradient-to-r from-neutral-900 via-neutral-800 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-black uppercase tracking-wider border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Central de Controle ao Vivo</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Visão Geral da Plataforma Pede AI
            </h2>
            <p className="text-xs sm:text-sm text-neutral-300 max-w-2xl leading-relaxed">
              Monitoramento unificado de todos os estabelecimentos, volume comercial transacionado e métricas de acessos em tempo real.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => onNavigateTab('nova_loja')}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer flex items-center gap-2"
            >
              <span>+ Criar Nova Loja</span>
            </button>
            <button
              onClick={() => onNavigateTab('taxas')}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-black transition-all border border-white/20 cursor-pointer flex items-center gap-2"
            >
              <span>Taxa por Pedido</span>
            </button>
          </div>
        </div>
      </div>

      {/* BLOCO 1: INDICADORES DE LOJAS E ESTABELECIMENTOS */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-black text-neutral-500 uppercase tracking-wider flex items-center gap-2">
            <StoreIcon className="w-4 h-4 text-neutral-700" />
            <span>Lojas e Estabelecimentos Parceiros</span>
          </h3>
          <button
            onClick={() => onNavigateTab('lojas')}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
          >
            <span>Ver todas as lojas</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Total de Lojas */}
          <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs">
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
              Cadastradas
            </span>
            <div className="text-2xl font-black text-neutral-900 mt-1">{storeMetrics.total}</div>
            <span className="text-[10px] text-neutral-500 mt-0.5 block">base da plataforma</span>
          </div>

          {/* Ativas */}
          <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
              Habilitadas
            </span>
            <div className="text-2xl font-black text-emerald-600 mt-1">{storeMetrics.ativas}</div>
            <span className="text-[10px] text-neutral-500 mt-0.5 block">status ativo</span>
          </div>

          {/* Suspensas */}
          <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs">
            <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider block">
              Suspensas
            </span>
            <div className="text-2xl font-black text-rose-600 mt-1">{storeMetrics.suspensas}</div>
            <span className="text-[10px] text-neutral-500 mt-0.5 block">bloqueadas/vencidas</span>
          </div>

          {/* Abertas Agora */}
          <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 shadow-xs">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Abertas Agora
            </span>
            <div className="text-2xl font-black text-emerald-900 mt-1">{storeMetrics.abertasAgora}</div>
            <span className="text-[10px] text-emerald-700 mt-0.5 block">recebendo pedidos</span>
          </div>

          {/* Fechadas Agora */}
          <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs">
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
              Fechadas Agora
            </span>
            <div className="text-2xl font-black text-neutral-700 mt-1">{storeMetrics.fechadasAgora}</div>
            <span className="text-[10px] text-neutral-500 mt-0.5 block">fora do expediente</span>
          </div>

          {/* Novas (Últimos 7 dias) */}
          <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-200 shadow-xs">
            <span className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider block">
              Novas (7 dias)
            </span>
            <div className="text-2xl font-black text-indigo-900 mt-1">+{storeMetrics.seteDiasCount}</div>
            <span className="text-[10px] text-indigo-700 mt-0.5 block">
              {storeMetrics.hojeCount > 0 ? `${storeMetrics.hojeCount} hoje` : '0 hoje'}
            </span>
          </div>
        </div>
      </div>

      {/* BLOCO 2: PEDIDOS E MOVIMENTAÇÃO COMERCIAL HOJE */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-black text-neutral-500 uppercase tracking-wider flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-neutral-700" />
            <span>Pedidos e Movimentação Comercial de Hoje ({todayStr})</span>
          </h3>
          <button
            onClick={() => onNavigateTab('pedidos_globais')}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
          >
            <span>Ver pedidos globais</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Recebidos Hoje */}
          <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs">
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
              Total Hoje
            </span>
            <div className="text-2xl font-black text-neutral-900 mt-1">{orderMetrics.totalHoje}</div>
            <span className="text-[10px] text-neutral-500 mt-0.5 block">pedidos emitidos</span>
          </div>

          {/* Em Andamento */}
          <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 shadow-xs">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Em Andamento
            </span>
            <div className="text-2xl font-black text-amber-900 mt-1">{orderMetrics.emAndamentoHoje}</div>
            <span className="text-[10px] text-amber-700 mt-0.5 block">cozinha / rota</span>
          </div>

          {/* Concluídos Hoje */}
          <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 shadow-xs">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Concluídos
            </span>
            <div className="text-2xl font-black text-emerald-900 mt-1">{orderMetrics.concluidosHoje}</div>
            <span className="text-[10px] text-emerald-700 mt-0.5 block">entregues com sucesso</span>
          </div>

          {/* Cancelados Hoje */}
          <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs">
            <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider block">
              Cancelados
            </span>
            <div className="text-2xl font-black text-rose-600 mt-1">{orderMetrics.canceladosHoje}</div>
            <span className="text-[10px] text-neutral-500 mt-0.5 block">não faturados</span>
          </div>

          {/* Volume Concluído Hoje */}
          <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs">
            <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider block">
              Volume Concluído
            </span>
            <div className="text-xl sm:text-2xl font-black text-indigo-900 mt-1">
              {formatCurrency(orderMetrics.volumeConcluidoHoje)}
            </div>
            <span className="text-[10px] text-neutral-500 mt-0.5 block">transacionado por lojas</span>
          </div>

          {/* Lojas Ativas Hoje */}
          <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs">
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
              Lojas com Venda
            </span>
            <div className="text-2xl font-black text-neutral-900 mt-1">
              {orderMetrics.lojasComPedidoHoje} / {storeMetrics.total}
            </div>
            <span className="text-[10px] text-neutral-500 mt-0.5 block">receberam pedidos</span>
          </div>
        </div>
      </div>

      {/* BLOCO 3: ACESSOS E INSTRUMENTAÇÃO AO VIVO NOS CARDÁPIOS */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-black text-neutral-500 uppercase tracking-wider flex items-center gap-2">
            <Eye className="w-4 h-4 text-neutral-700" />
            <span>Audiência e Acessos aos Cardápios Digitais (Tempo Real)</span>
          </h3>
          <button
            onClick={() => onNavigateTab('analytics')}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
          >
            <span>Ver detalhes de acessos</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Visitantes Ativos Agora */}
          <div className="bg-neutral-900 text-white p-5 rounded-2xl shadow-sm space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                Visitantes Ativos Agora
              </span>
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
            </div>
            <div className="text-3xl font-black text-emerald-400">{activeVisitors}</div>
            <p className="text-[11px] text-neutral-400">
              Navegando nos cardápios nos últimos 5 minutos
            </p>
          </div>

          {/* Lojas Recebendo Acessos */}
          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-1">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
              Lojas com Acesso Agora
            </span>
            <div className="text-3xl font-black text-neutral-900">{activeStoresCount}</div>
            <p className="text-[11px] text-neutral-500">
              Cardápios com clientes olhando produtos neste instante
            </p>
          </div>

          {/* Visualizações no Dia */}
          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-1">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
              Visualizações Totais Hoje
            </span>
            <div className="text-3xl font-black text-neutral-900">{todayViews}</div>
            <p className="text-[11px] text-neutral-500">
              Páginas de cardápio e produtos carregadas
            </p>
          </div>

          {/* Taxa de Conversão */}
          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-1">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
              Conversão de Visitas
            </span>
            <div className="text-3xl font-black text-indigo-600">
              {todayViews > 0 ? `${conversionRate.toFixed(1)}%` : '—'}
            </div>
            <p className="text-[11px] text-neutral-500">
              {orderMetrics.totalHoje} pedidos / {todayViews} visitas
            </p>
          </div>
        </div>
      </div>

      {/* BLOCO 4: ATALHOS RÁPIDOS E GESTÃO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Taxa Operacional */}
        <div
          onClick={() => onNavigateTab('taxas')}
          className="bg-white p-5 rounded-2xl border border-neutral-200 hover:border-neutral-400 transition-all shadow-xs cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:translate-x-1 transition-transform" />
          </div>
          <h4 className="font-bold text-sm text-neutral-900 mt-3">Taxas Operacionais</h4>
          <p className="text-xs text-neutral-500 mt-1">
            Configure o repasse por pedido (padrão R$ 0,99), regras de apuração e consulte o acumulado.
          </p>
        </div>

        {/* Card 2: Movimentação Financeira */}
        <div
          onClick={() => onNavigateTab('faturamento_lojas')}
          className="bg-white p-5 rounded-2xl border border-neutral-200 hover:border-neutral-400 transition-all shadow-xs cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl">
              <Flame className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:translate-x-1 transition-transform" />
          </div>
          <h4 className="font-bold text-sm text-neutral-900 mt-3">Movimentação dos Deliveries</h4>
          <p className="text-xs text-neutral-500 mt-1">
            Consulte os rankings de lojas por pedidos e faturamento transacionado na plataforma.
          </p>
        </div>

        {/* Card 3: Saúde do Sistema */}
        <div
          onClick={() => onNavigateTab('saude')}
          className="bg-white p-5 rounded-2xl border border-neutral-200 hover:border-neutral-400 transition-all shadow-xs cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="p-2.5 bg-blue-50 text-blue-700 rounded-xl">
              <Activity className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:translate-x-1 transition-transform" />
          </div>
          <h4 className="font-bold text-sm text-neutral-900 mt-3">Saúde do Sistema</h4>
          <p className="text-xs text-neutral-500 mt-1">
            Verifique a latência de conexão do Firestore, integridade dos serviços e logs de erro.
          </p>
        </div>
      </div>
    </div>
  );
};
