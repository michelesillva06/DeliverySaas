import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  Save,
  CheckCircle2,
  Clock,
  History,
  AlertTriangle,
  Info,
  DollarSign,
  Calendar,
  Building2,
  Edit2,
  ShieldCheck,
  Check,
  Search,
} from 'lucide-react';
import { Store, OperationalFeeConfig, OperationalFeeEntry, OperationalBillingPeriod } from '../../../types';
import {
  getOperationalFeeConfig,
  saveOperationalFeeConfig,
  subscribeToOperationalFeeConfig,
  subscribeToAllOperationalFeeEntries,
} from '../../../services/operationalFeeService';
import { formatCurrency, formatDateTime } from '../../../lib/formatters';
import { useToast } from '../../../components/Toast';

interface OperationalFeeTabProps {
  stores: Store[];
  authorEmail: string;
}

export const OperationalFeeTab: React.FC<OperationalFeeTabProps> = ({ stores, authorEmail }) => {
  const { showToast } = useToast();

  const [config, setConfig] = useState<OperationalFeeConfig | null>(null);
  const [entries, setEntries] = useState<OperationalFeeEntry[]>([]);
  const [saving, setSaving] = useState(false);

  // Estados do formulário global
  const [valorPadrao, setValorPadrao] = useState<number>(0.99);
  const [ativoGlobal, setAtivoGlobal] = useState<boolean>(true);
  const [periodoApuracao, setPeriodoApuracao] = useState<OperationalBillingPeriod>('mensal');
  const [diasVencimento, setDiasVencimento] = useState<number>(5);
  const [dataInicio, setDataInicio] = useState<string>('2026-01-01');

  // Estado para Modal de Salvar com Justificativa
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [justificativa, setJustificativa] = useState('');

  // Estado para Edição de Override de Loja
  const [editingStoreOverride, setEditingStoreOverride] = useState<Store | null>(null);
  const [storeAtivo, setStoreAtivo] = useState(true);
  const [storeValorUnit, setStoreValorUnit] = useState<string>('');
  const [storeDataInicio, setStoreDataInicio] = useState<string>('');
  const [storeIsencaoAte, setStoreIsencaoAte] = useState<string>('');
  const [storeOverrideJustificativa, setStoreOverrideJustificativa] = useState('');

  const [searchTerm, setSearchTerm] = useState('');

  // Escutar configuração e lançamentos em tempo real
  useEffect(() => {
    const unsubCfg = subscribeToOperationalFeeConfig((cfg) => {
      setConfig(cfg);
      setValorPadrao(cfg.valorPadrao);
      setAtivoGlobal(cfg.ativoGlobal);
      setPeriodoApuracao(cfg.periodoApuracao);
      setDiasVencimento(cfg.diasAposFechamentoVencimento || 5);
      setDataInicio(cfg.dataInicioCobranca || '2026-01-01');
    });

    const unsubEntries = subscribeToAllOperationalFeeEntries((list) => {
      setEntries(list);
    });

    return () => {
      unsubCfg();
      unsubEntries();
    };
  }, []);

  // Consolidação de Taxas por Loja
  const storeFeeSummaries = useMemo(() => {
    const map = new Map<string, { store: Store; pendente: number; pago: number; totalPedidos: number; taxaAtual: number }>();

    stores.forEach((s) => {
      const override = config?.lojasConfig?.[s.id];
      const taxa = typeof override?.valorUnitario === 'number' ? override.valorUnitario : (config?.valorPadrao ?? 0.99);

      map.set(s.id, {
        store: s,
        pendente: 0,
        pago: 0,
        totalPedidos: 0,
        taxaAtual: taxa,
      });
    });

    entries.forEach((e) => {
      const item = map.get(e.storeId);
      if (item && e.status !== 'estornado') {
        item.totalPedidos += 1;
        if (e.status === 'pendente' || e.status === 'em_cobranca') {
          item.pendente += e.taxaAplicada;
        } else if (e.status === 'pago') {
          item.pago += e.taxaAplicada;
        }
      }
    });

    const list = Array.from(map.values());
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return list.filter((i) => i.store.nome.toLowerCase().includes(q) || i.store.slug.includes(q));
    }
    return list;
  }, [stores, entries, config, searchTerm]);

  // Totais Gerais
  const totals = useMemo(() => {
    let pendente = 0;
    let pago = 0;
    let pedidos = 0;

    entries.forEach((e) => {
      if (e.status !== 'estornado') {
        pedidos++;
        if (e.status === 'pendente' || e.status === 'em_cobranca') pendente += e.taxaAplicada;
        else if (e.status === 'pago') pago += e.taxaAplicada;
      }
    });

    return { pendente, pago, total: pendente + pago, pedidos };
  }, [entries]);

  // Salvar Configuração Global
  const handleConfirmSaveGlobal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!justificativa.trim()) {
      showToast('Por favor, informe uma justificativa para registrar na auditoria.', 'error');
      return;
    }

    if (!config) return;

    setSaving(true);
    try {
      const updatedConfig: OperationalFeeConfig = {
        ...config,
        valorPadrao: Number(valorPadrao),
        ativoGlobal,
        periodoApuracao,
        diasAposFechamentoVencimento: Number(diasVencimento),
        dataInicioCobranca: dataInicio,
      };

      await saveOperationalFeeConfig(updatedConfig, authorEmail, justificativa.trim());
      showToast('Configuração de taxa operacional salva com sucesso!', 'success');
      setShowSaveModal(false);
      setJustificativa('');
    } catch (err) {
      console.error(err);
      showToast('Erro ao salvar configuração.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Abrir Modal de Edição de Loja
  const handleOpenStoreOverride = (store: Store) => {
    const existing = config?.lojasConfig?.[store.id];
    setEditingStoreOverride(store);
    setStoreAtivo(existing ? existing.ativo : true);
    setStoreValorUnit(existing?.valorUnitario !== undefined ? String(existing.valorUnitario) : '');
    setStoreDataInicio(existing?.dataInicio || '');
    setStoreIsencaoAte(existing?.isencaoAte || '');
    setStoreOverrideJustificativa('');
  };

  // Salvar Override de Loja
  const handleSaveStoreOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStoreOverride || !config) return;

    if (!storeOverrideJustificativa.trim()) {
      showToast('Informe a justificativa para a alteração individual da loja.', 'error');
      return;
    }

    setSaving(true);
    try {
      const currentLojas = { ...(config.lojasConfig || {}) };
      currentLojas[editingStoreOverride.id] = {
        ativo: storeAtivo,
        valorUnitario: storeValorUnit ? Number(storeValorUnit) : undefined,
        dataInicio: storeDataInicio || undefined,
        isencaoAte: storeIsencaoAte || undefined,
      };

      const updatedConfig: OperationalFeeConfig = {
        ...config,
        lojasConfig: currentLojas,
      };

      await saveOperationalFeeConfig(
        updatedConfig,
        authorEmail,
        `Regra individual para ${editingStoreOverride.nome}: ${storeOverrideJustificativa.trim()}`
      );

      showToast(`Regra personalizada para ${editingStoreOverride.nome} salva!`, 'success');
      setEditingStoreOverride(null);
    } catch (err) {
      console.error(err);
      showToast('Erro ao salvar regra da loja.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Cabeçalho */}
      <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-neutral-900 tracking-tight flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            <span>Módulo de Taxa Operacional por Pedido</span>
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            Gestão da cobrança por pedido concluído, periodicidade de fechamento e regras por estabelecimento.
          </p>
        </div>

        <button
          onClick={() => setShowSaveModal(true)}
          className="px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 self-start sm:self-auto"
        >
          <Save className="w-4 h-4" />
          <span>Salvar Parâmetros Globais</span>
        </button>
      </div>

      {/* Cards de Métricas de Repasse SaaS */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-1">
          <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
            Pedidos Contabilizados
          </span>
          <div className="text-2xl sm:text-3xl font-black text-neutral-900">{totals.pedidos}</div>
          <p className="text-[11px] text-neutral-500">pedidos válidos e concluídos</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-1">
          <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
            Total Gerado em Taxas
          </span>
          <div className="text-2xl sm:text-3xl font-black text-neutral-900">{formatCurrency(totals.total)}</div>
          <p className="text-[11px] text-neutral-500">receita operacional acumulada</p>
        </div>

        <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-200 shadow-xs space-y-1">
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
            Total Recebido / Liquidado
          </span>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600">{formatCurrency(totals.pago)}</div>
          <p className="text-[11px] text-emerald-700">pagamentos confirmados</p>
        </div>

        <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200 shadow-xs space-y-1">
          <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
            Saldo a Receber (Pendente)
          </span>
          <div className="text-2xl sm:text-3xl font-black text-amber-900">{formatCurrency(totals.pendente)}</div>
          <p className="text-[11px] text-amber-700">aguardando fechamento/pagamento</p>
        </div>
      </div>

      {/* Formulário de Configurações Globais */}
      <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-xs space-y-5">
        <div className="border-b border-neutral-100 pb-3">
          <h3 className="text-sm font-black text-neutral-900 uppercase tracking-wider">
            Parâmetros Globais de Cobrança
          </h3>
          <p className="text-xs text-neutral-500">
            Aplicados a todas as lojas que não possuem regras individuais configuradas.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Valor Padrão por Pedido */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">
              Valor Padrão por Pedido (R$) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-neutral-400">R$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={valorPadrao}
                onChange={(e) => setValorPadrao(Number(e.target.value))}
                className="w-full text-xs font-bold p-2.5 pl-8 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                required
              />
            </div>
            <span className="text-[10px] text-neutral-400 mt-1 block">Padrão contratual: R$ 0,99</span>
          </div>

          {/* Periodicidade de Apuração */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">
              Período de Apuração *
            </label>
            <select
              value={periodoApuracao}
              onChange={(e) => setPeriodoApuracao(e.target.value as any)}
              className="w-full text-xs font-bold p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none cursor-pointer"
            >
              <option value="diario">Diário (Fechamento todo dia)</option>
              <option value="semanal">Semanal (Fechamento por semana)</option>
              <option value="mensal">Mensal (Fechamento no final do mês)</option>
            </select>
            <span className="text-[10px] text-neutral-400 mt-1 block">Independente do valor unitário</span>
          </div>

          {/* Dias para Vencimento */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">
              Prazo de Vencimento da Fatura
            </label>
            <input
              type="number"
              min="1"
              max="30"
              value={diasVencimento}
              onChange={(e) => setDiasVencimento(Number(e.target.value))}
              className="w-full text-xs font-bold p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
              required
            />
            <span className="text-[10px] text-neutral-400 mt-1 block">Dias corridos após o fechamento</span>
          </div>

          {/* Data de Início da Cobrança */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">
              Data de Início da Cobrança
            </label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-full text-xs font-bold p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none cursor-pointer"
              required
            />
            <span className="text-[10px] text-neutral-400 mt-1 block">Pedidos anteriores não são cobrados</span>
          </div>
        </div>

        {/* Toggle de Ativação Global */}
        <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-2xl border border-neutral-200">
          <div>
            <h4 className="text-xs font-bold text-neutral-900">Cobrança de Taxa Operacional Habilitada</h4>
            <p className="text-[11px] text-neutral-500">
              Se desativado globalmente, novos pedidos concluídos não gerarão taxas no sistema.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAtivoGlobal(!ativoGlobal)}
            className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
              ativoGlobal ? 'bg-emerald-600' : 'bg-neutral-300'
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                ativoGlobal ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Tabela de Lojas e Configurações Individuais / Saldos */}
      <div className="bg-white rounded-3xl border border-neutral-200 shadow-xs overflow-hidden space-y-4 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-black text-sm text-neutral-900 uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-neutral-700" />
              <span>Taxas Individuais e Saldos por Estabelecimento</span>
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              Personalize a taxa por loja (ex: isenção, desconto de inauguração) e consulte o saldo pendente.
            </p>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar loja..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="text-xs bg-neutral-100 border-none rounded-xl pl-8 pr-3 py-2 font-medium text-neutral-800 placeholder-neutral-400 w-48 focus:ring-2 focus:ring-neutral-900"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-400 font-bold uppercase text-[10px]">
                <th className="py-3 px-4">Loja</th>
                <th className="py-3 px-4">Status Cobrança</th>
                <th className="py-3 px-4">Taxa Unitária</th>
                <th className="py-3 px-4">Pedidos Concluídos</th>
                <th className="py-3 px-4">Total Liquidado</th>
                <th className="py-3 px-4">Saldo Pendente</th>
                <th className="py-3 px-4 text-right">Regra Individual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 font-medium">
              {storeFeeSummaries.map((item) => {
                const override = config?.lojasConfig?.[item.store.id];
                const isCustom = override && (override.valorUnitario !== undefined || override.ativo === false || override.isencaoAte);

                return (
                  <tr key={item.store.id} className="hover:bg-neutral-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-bold text-neutral-900 block">{item.store.nome}</span>
                      <span className="text-[10px] text-neutral-400 font-mono">/{item.store.slug}</span>
                    </td>
                    <td className="py-3 px-4">
                      {override?.ativo === false ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-200 text-neutral-600">
                          Desativada
                        </span>
                      ) : override?.isencaoAte && new Date().toISOString().split('T')[0] <= override.isencaoAte ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                          Isenção até {override.isencaoAte}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Ativa
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-black text-indigo-700 block">
                        {formatCurrency(item.taxaAtual)}
                      </span>
                      {isCustom && (
                        <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1 rounded">
                          Regra Personalizada
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-neutral-700">
                      {item.totalPedidos} pedido(s)
                    </td>
                    <td className="py-3 px-4 font-bold text-emerald-600">
                      {formatCurrency(item.pago)}
                    </td>
                    <td className="py-3 px-4 font-black text-amber-900 text-sm">
                      {formatCurrency(item.pendente)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleOpenStoreOverride(item.store)}
                        className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Configurar</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Histórico Auditável de Alterações de Taxas */}
      {config?.historicoAlteracoes && config.historicoAlteracoes.length > 0 && (
        <div className="bg-white rounded-3xl border border-neutral-200 shadow-xs p-6 space-y-4">
          <h3 className="font-black text-sm text-neutral-900 uppercase tracking-wider flex items-center gap-2">
            <History className="w-4 h-4 text-neutral-600" />
            <span>Histórico de Alterações de Taxas & Justificativas</span>
          </h3>

          <div className="divide-y divide-neutral-100">
            {config.historicoAlteracoes.slice(0, 10).map((log) => (
              <div key={log.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <p className="font-bold text-neutral-800">{log.descricao}</p>
                  <p className="text-neutral-500 text-[11px] mt-0.5">
                    <strong>Justificativa:</strong> {log.justificativa}
                  </p>
                </div>
                <div className="text-right text-[11px] text-neutral-400 whitespace-nowrap">
                  <span>{log.usuario}</span> • {formatDateTime(log.data)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Salvar Parâmetros Globais com Justificativa */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <form
            onSubmit={handleConfirmSaveGlobal}
            className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-neutral-200"
          >
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="font-black text-base text-neutral-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <span>Confirmar Alteração de Parâmetros</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="p-1 text-neutral-400 hover:text-neutral-700"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-neutral-600">
              Você está alterando a taxa operacional padrão para <strong>R$ {valorPadrao.toFixed(2)}</strong> e o período para <strong>{periodoApuracao}</strong>. Todas as alterações exigem justificativa registrada em auditoria.
            </p>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                Justificativa da Alteração *
              </label>
              <textarea
                rows={3}
                placeholder="Ex: Reajuste contratual anual aprovado pela administração."
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                className="w-full text-xs p-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                required
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="flex-1 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{saving ? 'Gravando...' : 'Confirmar e Salvar'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Regra Individual de Loja */}
      {editingStoreOverride && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <form
            onSubmit={handleSaveStoreOverride}
            className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-neutral-200"
          >
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <h3 className="font-black text-base text-neutral-900">
                  Regra Individual: {editingStoreOverride.nome}
                </h3>
                <span className="text-xs text-neutral-500 font-mono">
                  /{editingStoreOverride.slug}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditingStoreOverride(null)}
                className="p-1 text-neutral-400 hover:text-neutral-700"
              >
                ✕
              </button>
            </div>

            {/* Toggle Ativo */}
            <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-200">
              <span className="text-xs font-bold text-neutral-800">Cobrar Taxa desta Loja</span>
              <button
                type="button"
                onClick={() => setStoreAtivo(!storeAtivo)}
                className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                  storeAtivo ? 'bg-emerald-600' : 'bg-neutral-300'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    storeAtivo ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Valor Unitário Personalizado */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                Valor por Pedido Exclusivo (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder={`Padrão global: R$ ${valorPadrao.toFixed(2)}`}
                value={storeValorUnit}
                onChange={(e) => setStoreValorUnit(e.target.value)}
                className="w-full text-xs font-bold p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
              />
              <span className="text-[10px] text-neutral-400 mt-1 block">
                Deixe em branco para usar o padrão da plataforma.
              </span>
            </div>

            {/* Isenção Temporária */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                Isenção Temporária até (opcional)
              </label>
              <input
                type="date"
                value={storeIsencaoAte}
                onChange={(e) => setStoreIsencaoAte(e.target.value)}
                className="w-full text-xs font-bold p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none cursor-pointer"
              />
              <span className="text-[10px] text-neutral-400 mt-1 block">
                Nenhum pedido até esta data gerará cobrança.
              </span>
            </div>

            {/* Justificativa */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                Justificativa para esta Loja *
              </label>
              <textarea
                rows={2}
                placeholder="Ex: Condição comercial especial negociada na implantação."
                value={storeOverrideJustificativa}
                onChange={(e) => setStoreOverrideJustificativa(e.target.value)}
                className="w-full text-xs p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                required
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingStoreOverride(null)}
                className="flex-1 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{saving ? 'Gravando...' : 'Salvar Regra'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
