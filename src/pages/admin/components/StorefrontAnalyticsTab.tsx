import React, { useState, useEffect, useMemo } from 'react';
import {
  Eye,
  Users,
  ShoppingBag,
  TrendingUp,
  Store as StoreIcon,
  Clock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { Store, Order } from '../../../types';
import { subscribeToActiveStorefrontVisitors, getStorefrontAnalyticsSummary } from '../../../services/analyticsService';

interface StorefrontAnalyticsTabProps {
  stores: Store[];
  orders: Order[];
}

export const StorefrontAnalyticsTab: React.FC<StorefrontAnalyticsTabProps> = ({ stores, orders }) => {
  const [activeSessions, setActiveSessions] = useState(0);
  const [activeStores, setActiveStores] = useState(0);
  const [todayViews, setTodayViews] = useState(0);

  const [period, setPeriod] = useState<'hoje' | '7dias' | '30dias'>('hoje');
  const [summaryData, setSummaryData] = useState({
    visitasTotais: 0,
    visitantesUnicos: 0,
    iniciados: 0,
    concluidos: 0,
  });

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  useEffect(() => {
    const unsub = subscribeToActiveStorefrontVisitors((sessions, storesCnt, views) => {
      setActiveSessions(sessions);
      setActiveStores(storesCnt);
      setTodayViews(views);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const now = new Date();
    let startDate = todayStr;
    if (period === '7dias') {
      const d = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
      startDate = d.toISOString().split('T')[0];
    } else if (period === '30dias') {
      const d = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
      startDate = d.toISOString().split('T')[0];
    }

    getStorefrontAnalyticsSummary(startDate).then(setSummaryData);
  }, [period, todayStr]);

  // Taxa de Conversão do Funil
  const taxaIniciou = summaryData.visitasTotais > 0 ? (summaryData.iniciados / summaryData.visitasTotais) * 100 : 0;
  const taxaConcluiu = summaryData.iniciados > 0 ? (summaryData.concluidos / summaryData.iniciados) * 100 : 0;
  const conversaoGlobal = summaryData.visitasTotais > 0 ? (summaryData.concluidos / summaryData.visitasTotais) * 100 : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Cabeçalho */}
      <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-neutral-900 tracking-tight flex items-center gap-2">
            <Eye className="w-5 h-5 text-indigo-600" />
            <span>Audiência e Acessos aos Cardápios Digitais</span>
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            Instrumentação real de sessões e tráfego nos cardápios públicos via eventos anônimos.
          </p>
        </div>

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
            Últimos 7 dias
          </button>
          <button
            onClick={() => setPeriod('30dias')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              period === '30dias' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            Últimos 30 dias
          </button>
        </div>
      </div>

      {/* Cards de Métricas em Tempo Real */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Visitantes Ativos Agora */}
        <div className="bg-neutral-900 text-white p-5 rounded-2xl shadow-sm space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
              Visitantes Ativos Agora
            </span>
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
          </div>
          <div className="text-3xl font-black text-emerald-400">{activeSessions}</div>
          <p className="text-[11px] text-neutral-400">
            Navegando nos cardápios nos últimos 5 minutos
          </p>
        </div>

        {/* Card 2: Lojas Recebendo Clientes */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-1">
          <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
            Lojas com Tráfego Agora
          </span>
          <div className="text-3xl font-black text-neutral-900">{activeStores}</div>
          <p className="text-[11px] text-neutral-500">
            Estabelecimentos com clientes visualizando produtos
          </p>
        </div>

        {/* Card 3: Visualizações Hoje */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-1">
          <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
            Visualizações Hoje
          </span>
          <div className="text-3xl font-black text-neutral-900">{todayViews}</div>
          <p className="text-[11px] text-neutral-500">
            Total de telas e produtos abertos hoje
          </p>
        </div>

        {/* Card 4: Conversão Global */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-1">
          <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
            Conversão do Período
          </span>
          <div className="text-3xl font-black text-indigo-600">
            {conversaoGlobal > 0 ? `${conversaoGlobal.toFixed(1)}%` : '—'}
          </div>
          <p className="text-[11px] text-neutral-500">
            Proporção de acessos transformados em pedidos
          </p>
        </div>
      </div>

      {/* Funil de Conversão do Cardápio */}
      <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-xs space-y-5">
        <div>
          <h3 className="text-sm font-black text-neutral-900 uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-600" />
            <span>Funil de Conversão do Cardápio Digital</span>
          </h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            Mede a taxa de clientes que entram no cardápio, avançam para o checkout e concluem o pedido.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* Etapa 1: Visita ao Cardápio */}
          <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 bg-neutral-200 text-neutral-700 rounded-md text-[10px] font-bold uppercase">
                Etapa 1
              </span>
              <Eye className="w-4 h-4 text-neutral-500" />
            </div>
            <h4 className="font-bold text-xs text-neutral-600">Visitas ao Cardápio</h4>
            <div className="text-2xl font-black text-neutral-900">
              {summaryData.visitasTotais || todayViews}
            </div>
            <p className="text-[11px] text-neutral-400">Topo do funil (100%)</p>
          </div>

          {/* Etapa 2: Iniciou Checkout */}
          <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 bg-indigo-200 text-indigo-800 rounded-md text-[10px] font-bold uppercase">
                Etapa 2
              </span>
              <ShoppingBag className="w-4 h-4 text-indigo-600" />
            </div>
            <h4 className="font-bold text-xs text-indigo-900">Iniciou Checkout</h4>
            <div className="text-2xl font-black text-indigo-950">
              {summaryData.iniciados}
            </div>
            <p className="text-[11px] text-indigo-700">
              {taxaIniciou.toFixed(1)}% das visitas montaram carrinho
            </p>
          </div>

          {/* Etapa 3: Pedido Concluído */}
          <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 bg-emerald-200 text-emerald-800 rounded-md text-[10px] font-bold uppercase">
                Etapa 3
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <h4 className="font-bold text-xs text-emerald-900">Pedido Concluído</h4>
            <div className="text-2xl font-black text-emerald-950">
              {summaryData.concluidos}
            </div>
            <p className="text-[11px] text-emerald-700">
              {taxaConcluiu.toFixed(1)}% dos checkouts foram finalizados
            </p>
          </div>
        </div>
      </div>

      {/* Nota de Privacidade e Metodologia */}
      <div className="bg-neutral-50 border border-neutral-200 p-4 rounded-2xl flex items-start gap-3 text-neutral-700 text-xs">
        <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-neutral-900">Metodologia e Privacidade (LGPD):</p>
          <p className="text-neutral-600 leading-relaxed">
            A coleta de métricas de tráfego utiliza identificadores anônimos de sessão temporária (sessão de navegador). Nenhuma informação pessoal ou dado sensível do visitante é armazenado. Uma mesma pessoa acessando de múltiplos dispositivos pode ser contabilizada separadamente.
          </p>
        </div>
      </div>
    </div>
  );
};
