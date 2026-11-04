import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  QrCode,
  DollarSign,
  Download,
  Filter,
  Search,
  Check,
  Calendar,
  Building2,
  PlusCircle,
  ExternalLink,
  Wallet,
  Plus,
  Minus,
} from 'lucide-react';
import { Store, OperationalInvoice, SaasConfig, OperationalBillingPeriod } from '../../../types';
import {
  subscribeToAllInvoices,
  closeBillingCycleForStore,
  recordPaymentForInvoice,
  addStoreCredit,
  getStoreCreditBalance,
} from '../../../services/operationalFeeService';
import { formatCurrency, formatDateTime } from '../../../lib/formatters';
import { useToast } from '../../../components/Toast';

interface OperationalInvoicesTabProps {
  stores: Store[];
  saasConfig?: SaasConfig | null;
  authorEmail: string;
}

export const OperationalInvoicesTab: React.FC<OperationalInvoicesTabProps> = ({
  stores,
  saasConfig,
  authorEmail,
}) => {
  const { showToast } = useToast();

  const [invoices, setInvoices] = useState<OperationalInvoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<OperationalInvoice | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Modal Fechamento de Período Manual
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [genStoreId, setGenStoreId] = useState<string>(stores[0]?.id || '');
  const [generating, setGenerating] = useState(false);

  // Modal Registro de Pagamento (Total ou Parcial)
  const [showPaymentModal, setShowPaymentModal] = useState<OperationalInvoice | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');
  const [payObs, setPayObs] = useState<string>('');
  const [registeringPay, setRegisteringPay] = useState(false);

  // Modal Ajuste Manual de Crédito / Débito
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjStoreId, setAdjStoreId] = useState<string>(stores[0]?.id || '');
  const [adjValor, setAdjValor] = useState<string>('');
  const [adjTipo, setAdjTipo] = useState<'credito' | 'debito'>('credito');
  const [adjJustificativa, setAdjJustificativa] = useState<string>('');
  const [savingAdj, setSavingAdj] = useState(false);

  useEffect(() => {
    const unsub = subscribeToAllInvoices((list) => {
      setInvoices(list);
    });
    return () => unsub();
  }, []);

  // Filtragem de faturas
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (selectedStoreId !== 'todos' && inv.storeId !== selectedStoreId) return false;
      if (statusFilter !== 'todos' && inv.status !== statusFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchStore = inv.storeNome.toLowerCase().includes(q);
        const matchId = inv.id.toLowerCase().includes(q);
        if (!matchStore && !matchId) return false;
      }
      return true;
    });
  }, [invoices, selectedStoreId, statusFilter, searchTerm]);

  // Totais
  const totals = useMemo(() => {
    let valorTotal = 0;
    let valorPago = 0;
    let valorPendente = 0;
    let totalFaturas = invoices.length;

    invoices.forEach((inv) => {
      const val = inv.valorTotalAPagar ?? inv.valorBruto;
      valorTotal += val;
      valorPago += inv.valorPago || (inv.status === 'paga' ? val : 0);
      valorPendente += inv.saldoPendente ?? (inv.status === 'paga' ? 0 : val);
    });

    return { valorTotal, valorPago, valorPendente, totalFaturas };
  }, [invoices]);

  // Gerar Fatura / Fechar Período para a Loja
  const handleGenerateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const st = stores.find((s) => s.id === genStoreId);
    if (!st) {
      showToast('Selecione uma loja válida.', 'error');
      return;
    }

    setGenerating(true);
    try {
      const res = await closeBillingCycleForStore({
        storeId: st.id,
        storeNome: st.nome,
        authorEmail,
        saasConfig,
        forceGenerate: true,
      });

      if (!res) {
        showToast('Nenhum pedido pendente encontrado para esta loja.', 'info');
      } else if ('valorTotalAPagar' in res) {
        showToast(`Fatura de R$ ${res.valorTotalAPagar.toFixed(2)} gerada com sucesso!`, 'success');
        setShowGenerateModal(false);
      } else {
        showToast(`Ciclo encerrado e transportado para o próximo fechamento (saldo R$ ${res.valorBruto.toFixed(2)}).`, 'info');
        setShowGenerateModal(false);
      }
    } catch (err) {
      console.error(err);
      showToast('Erro ao fechar período.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  // Abrir Modal de Pagamento
  const handleOpenPaymentModal = (inv: OperationalInvoice) => {
    setShowPaymentModal(inv);
    setPayAmount(String(inv.saldoPendente ?? inv.valorTotalAPagar ?? inv.valorBruto));
    setPayObs('');
  };

  // Registrar Pagamento (Parcial, Total ou Com Troco)
  const handleConfirmPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPaymentModal) return;

    const val = Number(payAmount);
    if (isNaN(val) || val <= 0) {
      showToast('Informe um valor de pagamento válido.', 'error');
      return;
    }

    setRegisteringPay(true);
    try {
      const updated = await recordPaymentForInvoice({
        invoiceId: showPaymentModal.id,
        valorPago: val,
        confirmedByEmail: authorEmail,
        observacao: payObs.trim() || undefined,
      });

      showToast(`Pagamento de R$ ${val.toFixed(2)} registrado! Fatura: ${updated.status}.`, 'success');
      setShowPaymentModal(null);
      setSelectedInvoice(null);
    } catch (err) {
      console.error(err);
      showToast('Erro ao registrar pagamento.', 'error');
    } finally {
      setRegisteringPay(false);
    }
  };

  // Salvar Ajuste Manual de Crédito / Débito
  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    const st = stores.find((s) => s.id === adjStoreId);
    if (!st) {
      showToast('Selecione uma loja válida.', 'error');
      return;
    }

    const numVal = Number(adjValor);
    if (isNaN(numVal) || numVal <= 0) {
      showToast('Informe um valor válido para o ajuste.', 'error');
      return;
    }

    if (!adjJustificativa.trim()) {
      showToast('A justificativa do ajuste é obrigatória.', 'error');
      return;
    }

    setSavingAdj(true);
    try {
      const finalVal = adjTipo === 'credito' ? numVal : -numVal;
      await addStoreCredit(st.id, finalVal, adjJustificativa.trim(), authorEmail);
      showToast(`Ajuste de ${adjTipo} no valor de R$ ${numVal.toFixed(2)} registrado com sucesso para ${st.nome}!`, 'success');
      setShowAdjustmentModal(false);
      setAdjValor('');
      setAdjJustificativa('');
    } catch (err) {
      console.error(err);
      showToast('Erro ao gravar ajuste manual.', 'error');
    } finally {
      setSavingAdj(false);
    }
  };

  // Exportar Faturas para CSV
  const handleExportCSV = () => {
    const headers = ['ID Fatura', 'Loja', 'Modalidade', 'Período Início', 'Período Fim', 'Pedidos', 'Valor Bruto (R$)', 'Créditos (R$)', 'Total A Pagar (R$)', 'Valor Pago (R$)', 'Saldo Pendente (R$)', 'Vencimento', 'Status', 'Confirmado Por'];
    const rows = filteredInvoices.map((inv) => [
      inv.id,
      `"${inv.storeNome.replace(/"/g, '""')}"`,
      inv.modalidade || 'diaria',
      inv.periodoInicio,
      inv.periodoFim,
      inv.quantidadePedidos,
      (inv.valorBruto || 0).toFixed(2),
      (inv.creditosUtilizados || 0).toFixed(2),
      (inv.valorTotalAPagar ?? inv.valorBruto).toFixed(2),
      (inv.valorPago || 0).toFixed(2),
      (inv.saldoPendente ?? 0).toFixed(2),
      inv.vencimento,
      inv.status,
      inv.confirmadoPor || '',
    ].join(';'));

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `faturas_operacionais_${new Date().toISOString().split('T')[0]}.csv`);
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
            <FileText className="w-5 h-5 text-indigo-600" />
            <span>Cobranças & Recebimentos de Repasse</span>
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            Consolidação de períodos de apuração, emissão de faturas Pix, pagamentos parciais e ajustes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowAdjustmentModal(true)}
            className="px-3.5 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Wallet className="w-4 h-4 text-indigo-600" />
            <span>Ajuste Crédito / Débito</span>
          </button>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Fechar Período (Nova Fatura)</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-1">
          <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
            Total de Faturas
          </span>
          <div className="text-2xl sm:text-3xl font-black text-neutral-900">{totals.totalFaturas}</div>
          <p className="text-[11px] text-neutral-500">cobranças emitidas</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-1">
          <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
            Volume Total Faturado
          </span>
          <div className="text-2xl sm:text-3xl font-black text-neutral-900">{formatCurrency(totals.valorTotal)}</div>
          <p className="text-[11px] text-neutral-500">valor total a receber</p>
        </div>

        <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-200 shadow-xs space-y-1">
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
            Total Recebido (PAGO)
          </span>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600">{formatCurrency(totals.valorPago)}</div>
          <p className="text-[11px] text-emerald-700">pagamentos liquidados</p>
        </div>

        <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200 shadow-xs space-y-1">
          <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
            Saldo Restante Pendente
          </span>
          <div className="text-2xl sm:text-3xl font-black text-amber-900">{formatCurrency(totals.valorPendente)}</div>
          <p className="text-[11px] text-amber-700">aguardando quitação</p>
        </div>
      </div>

      {/* Filtros da Tabela */}
      <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Loja */}
          <select
            value={selectedStoreId}
            onChange={(e) => setSelectedStoreId(e.target.value)}
            className="bg-neutral-100 border-none rounded-xl px-3 py-2 font-bold text-neutral-800 cursor-pointer"
          >
            <option value="todos">Todas as Lojas ({stores.length})</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>

          {/* Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-neutral-100 border-none rounded-xl px-3 py-2 font-bold text-neutral-800 cursor-pointer"
          >
            <option value="todos">Todos os Status</option>
            <option value="em_aberto">Em Aberto / Pendente</option>
            <option value="aguardando_confirmacao">Aguardando Confirmação</option>
            <option value="parcialmente_paga">Parcialmente Paga</option>
            <option value="paga">Paga (Quitada)</option>
            <option value="vencida">Vencida</option>
          </select>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Buscar fatura ou loja..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-neutral-100 border-none rounded-xl pl-8 pr-3 py-2 font-medium text-neutral-800 placeholder-neutral-400 w-52 focus:ring-2 focus:ring-neutral-900"
          />
        </div>
      </div>

      {/* Tabela de Faturas */}
      <div className="bg-white rounded-3xl border border-neutral-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-400 font-bold uppercase text-[10px]">
                <th className="py-3 px-4">Loja</th>
                <th className="py-3 px-4">Período</th>
                <th className="py-3 px-4">Pedidos</th>
                <th className="py-3 px-4">Valor Total</th>
                <th className="py-3 px-4">Pago</th>
                <th className="py-3 px-4">A Pagar</th>
                <th className="py-3 px-4">Vencimento</th>
                <th className="py-3 px-4">Situação</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 font-medium">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-neutral-400 text-xs">
                    Nenhuma fatura encontrada com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-neutral-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-neutral-900">
                      {inv.storeNome}
                      <span className="block text-[10px] text-neutral-400 font-mono font-normal">
                        {inv.id.slice(-10)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-neutral-600 font-mono text-[11px]">
                      {inv.periodoInicio} a {inv.periodoFim}
                    </td>
                    <td className="py-3 px-4 text-neutral-700">
                      {inv.quantidadePedidos} pedido(s)
                    </td>
                    <td className="py-3 px-4 font-bold text-neutral-800">
                      {formatCurrency(inv.valorTotalAPagar ?? inv.valorBruto)}
                    </td>
                    <td className="py-3 px-4 font-bold text-emerald-600">
                      {formatCurrency(inv.valorPago || 0)}
                    </td>
                    <td className="py-3 px-4 font-black text-rose-700 text-sm">
                      {formatCurrency(inv.saldoPendente ?? inv.valorTotalAPagar ?? inv.valorBruto)}
                    </td>
                    <td className="py-3 px-4 text-neutral-600">
                      {inv.vencimento}
                    </td>
                    <td className="py-3 px-4">
                      {inv.status === 'paga' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 flex items-center gap-1 w-fit">
                          <CheckCircle2 className="w-3 h-3" /> PAGA
                        </span>
                      )}
                      {inv.status === 'parcialmente_paga' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 flex items-center gap-1 w-fit">
                          <Clock className="w-3 h-3" /> PARCIAL
                        </span>
                      )}
                      {inv.status === 'aguardando_confirmacao' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 flex items-center gap-1 w-fit">
                          <Clock className="w-3 h-3" /> COM COMPROVANTE
                        </span>
                      )}
                      {inv.status === 'em_aberto' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 flex items-center gap-1 w-fit">
                          <Clock className="w-3 h-3" /> EM ABERTO
                        </span>
                      )}
                      {inv.status === 'vencida' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 flex items-center gap-1 w-fit">
                          <AlertTriangle className="w-3 h-3" /> VENCIDA
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {inv.status !== 'paga' && (
                          <button
                            onClick={() => handleOpenPaymentModal(inv)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                            title="Registrar pagamento de repasse"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            <span>Registrar Pagamento</span>
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                          Ver
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Fechamento de Período Manual */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <form
            onSubmit={handleGenerateInvoice}
            className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-neutral-200"
          >
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="font-black text-base text-neutral-900 flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-emerald-600" />
                <span>Encerrar Ciclo e Gerar Cobrança</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowGenerateModal(false)}
                className="p-1 text-neutral-400 hover:text-neutral-700"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                Estabelecimento *
              </label>
              <select
                value={genStoreId}
                onChange={(e) => setGenStoreId(e.target.value)}
                className="w-full text-xs font-bold p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none cursor-pointer"
                required
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome} ({s.slug})
                  </option>
                ))}
              </select>
            </div>

            <p className="text-[11px] text-neutral-500 bg-neutral-50 p-3 rounded-xl border border-neutral-200">
              O sistema apurará todos os pedidos concluídos pendentes e saldos acumulados da loja. Se o total atingir o limite mínimo da loja, emitirá a fatura Pix com vencimento conforme o prazo configurado.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowGenerateModal(false)}
                className="flex-1 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={generating}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{generating ? 'Consolidando...' : 'Encerrar Ciclo'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Registrar Pagamento de Fatura (Suporta Parcial) */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <form
            onSubmit={handleConfirmPaymentSubmit}
            className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-neutral-200"
          >
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <h3 className="font-black text-base text-neutral-900">
                  Registrar Pagamento de Repasse
                </h3>
                <span className="text-xs text-neutral-500 font-bold">
                  Loja: {showPaymentModal.storeNome}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowPaymentModal(null)}
                className="p-1 text-neutral-400 hover:text-neutral-700"
              >
                ✕
              </button>
            </div>

            <div className="bg-neutral-50 p-3 rounded-2xl space-y-1 text-xs border border-neutral-200">
              <div className="flex justify-between">
                <span className="text-neutral-500">Valor Total Fatura:</span>
                <span className="font-bold text-neutral-800">
                  {formatCurrency(showPaymentModal.valorTotalAPagar ?? showPaymentModal.valorBruto)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Já Pago Anteriormente:</span>
                <span className="font-bold text-emerald-600">
                  {formatCurrency(showPaymentModal.valorPago || 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Saldo Pendente Atual:</span>
                <span className="font-black text-rose-600">
                  {formatCurrency(showPaymentModal.saldoPendente ?? showPaymentModal.valorTotalAPagar ?? showPaymentModal.valorBruto)}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                Valor Sendo Recebido Hoje (R$) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="w-full text-sm font-black p-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-600 outline-none"
                required
              />
              <span className="text-[10px] text-neutral-400 mt-1 block">
                Se o valor pago for maior que o saldo pendente, o troco/excedente vira crédito para a loja.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                Observação / Autenticação Bancária (Opcional)
              </label>
              <input
                type="text"
                value={payObs}
                onChange={(e) => setPayObs(e.target.value)}
                placeholder="Ex: Recebido via Pix no Santander (TXID E123456...)"
                className="w-full text-xs p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPaymentModal(null)}
                className="flex-1 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={registeringPay}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{registeringPay ? 'Confirmando...' : 'Confirmar Pagamento'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Ajuste Manual de Crédito / Débito */}
      {showAdjustmentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <form
            onSubmit={handleSaveAdjustment}
            className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-neutral-200"
          >
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="font-black text-base text-neutral-900 flex items-center gap-2">
                <Wallet className="w-5 h-5 text-indigo-600" />
                <span>Lançar Ajuste Manual (Crédito / Débito)</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAdjustmentModal(false)}
                className="p-1 text-neutral-400 hover:text-neutral-700"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                Estabelecimento *
              </label>
              <select
                value={adjStoreId}
                onChange={(e) => setAdjStoreId(e.target.value)}
                className="w-full text-xs font-bold p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none cursor-pointer"
                required
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome} ({s.slug})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Tipo de Ajuste *
                </label>
                <select
                  value={adjTipo}
                  onChange={(e) => setAdjTipo(e.target.value as any)}
                  className="w-full text-xs font-bold p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none cursor-pointer"
                >
                  <option value="credito">Crédito (A favor da loja)</option>
                  <option value="debito">Débito (Cobrar da loja)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Valor (R$) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={adjValor}
                  onChange={(e) => setAdjValor(e.target.value)}
                  placeholder="0.00"
                  className="w-full text-xs font-bold p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                Justificativa Obrigatória *
              </label>
              <textarea
                rows={2}
                placeholder="Ex: Bônus de boas-vindas / Compensação de reembolso autorizado."
                value={adjJustificativa}
                onChange={(e) => setAdjJustificativa(e.target.value)}
                className="w-full text-xs p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                required
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAdjustmentModal(false)}
                className="flex-1 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingAdj}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{savingAdj ? 'Gravando...' : 'Gravar Ajuste'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Detalhes da Fatura / Comprovante */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-neutral-200">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <h3 className="font-black text-base text-neutral-900">
                  Fatura: {selectedInvoice.id}
                </h3>
                <span className="text-xs text-neutral-500 font-bold">
                  {selectedInvoice.storeNome}
                </span>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="p-1 text-neutral-400 hover:text-neutral-700"
              >
                ✕
              </button>
            </div>

            <div className="bg-neutral-50 p-4 rounded-2xl space-y-2 border border-neutral-200 text-xs">
              <div className="flex justify-between">
                <span className="text-neutral-500">Período:</span>
                <span className="font-bold text-neutral-800">
                  {selectedInvoice.periodoInicio} a {selectedInvoice.periodoFim}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Pedidos Vinculados:</span>
                <span className="font-bold text-neutral-800">{selectedInvoice.quantidadePedidos}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Valor Bruto:</span>
                <span className="font-bold text-neutral-800">{formatCurrency(selectedInvoice.valorBruto)}</span>
              </div>
              {selectedInvoice.creditosUtilizados > 0 && (
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>Crédito Aplicado:</span>
                  <span>-{formatCurrency(selectedInvoice.creditosUtilizados)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-neutral-500">Valor A Pagar:</span>
                <span className="font-black text-neutral-900">
                  {formatCurrency(selectedInvoice.valorTotalAPagar ?? selectedInvoice.valorBruto)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Valor Já Pago:</span>
                <span className="font-bold text-emerald-600">
                  {formatCurrency(selectedInvoice.valorPago || 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Saldo Restante:</span>
                <span className="font-black text-rose-600">
                  {formatCurrency(selectedInvoice.saldoPendente ?? selectedInvoice.valorTotalAPagar ?? selectedInvoice.valorBruto)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Vencimento:</span>
                <span className="font-bold text-neutral-800">{selectedInvoice.vencimento}</span>
              </div>
            </div>

            {selectedInvoice.saldosTransportadosOrigem && selectedInvoice.saldosTransportadosOrigem.length > 0 && (
              <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs space-y-1">
                <span className="font-bold text-neutral-700 block">Saldos Transportados Acumulados:</span>
                <ul className="list-disc list-inside text-neutral-600 space-y-0.5 text-[11px]">
                  {selectedInvoice.saldosTransportadosOrigem.map((st, idx) => (
                    <li key={idx}>
                      Período {st.periodo}: {formatCurrency(st.valor)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {selectedInvoice.comprovanteTexto && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs space-y-1">
                <span className="font-bold text-blue-900 block">Comprovante do Lojista:</span>
                <p className="text-blue-800 italic">"{selectedInvoice.comprovanteTexto}"</p>
                {selectedInvoice.comprovanteEnviadoEm && (
                  <span className="text-[10px] text-blue-600 block">
                    Enviado em {formatDateTime(selectedInvoice.comprovanteEnviadoEm)}
                  </span>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-2 border-t border-neutral-100">
              <button
                onClick={() => setSelectedInvoice(null)}
                className="flex-1 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-bold"
              >
                Fechar
              </button>
              {selectedInvoice.status !== 'paga' && (
                <button
                  onClick={() => handleOpenPaymentModal(selectedInvoice)}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                >
                  <DollarSign className="w-4 h-4" />
                  <span>Registrar Pagamento</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
