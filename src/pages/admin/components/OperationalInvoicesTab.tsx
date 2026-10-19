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
} from 'lucide-react';
import { Store, OperationalInvoice, SaasConfig, OperationalBillingPeriod } from '../../../types';
import {
  subscribeToAllInvoices,
  generateInvoiceForStore,
  confirmInvoicePayment,
} from '../../../services/operationalFeeService';
import { formatCurrency, formatDateTime } from '../../../lib/formatters';
import { useToast } from '../../../components/Toast';

interface OperationalInvoicesTabProps {
  stores: Store[];
  saasConfig: SaasConfig | null;
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
  const [genInicio, setGenInicio] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [genFim, setGenFim] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [genPeriodoTipo, setGenPeriodoTipo] = useState<OperationalBillingPeriod>('mensal');
  const [genVencimento, setGenVencimento] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().split('T')[0];
  });
  const [generating, setGenerating] = useState(false);

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
      valorTotal += inv.valorTotal;
      if (inv.status === 'paga') valorPago += inv.valorTotal;
      else valorPendente += inv.valorTotal;
    });

    return { valorTotal, valorPago, valorPendente, totalFaturas };
  }, [invoices]);

  // Gerar Fatura para a Loja
  const handleGenerateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const st = stores.find((s) => s.id === genStoreId);
    if (!st) {
      showToast('Selecione uma loja válida.', 'error');
      return;
    }

    setGenerating(true);
    try {
      const inv = await generateInvoiceForStore({
        storeId: st.id,
        storeNome: st.nome,
        periodoInicio: genInicio,
        periodoFim: genFim,
        periodoTipo: genPeriodoTipo,
        vencimento: genVencimento,
        saasConfig,
        authorEmail,
      });

      if (!inv) {
        showToast('Nenhum pedido pendente encontrado para esta loja no período.', 'info');
      } else {
        showToast(`Fatura de R$ ${inv.valorTotal.toFixed(2)} gerada com sucesso!`, 'success');
        setShowGenerateModal(false);
      }
    } catch (err) {
      console.error(err);
      showToast('Erro ao gerar fatura.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  // Confirmar Recebimento da Fatura (Master Admin)
  const handleConfirmPayment = async (inv: OperationalInvoice) => {
    if (!window.confirm(`Confirmar o recebimento de R$ ${inv.valorTotal.toFixed(2)} da loja ${inv.storeNome}?`)) {
      return;
    }

    setProcessingId(inv.id);
    try {
      await confirmInvoicePayment(inv.id, authorEmail);
      showToast(`Pagamento da fatura ${inv.id} confirmado com sucesso!`, 'success');
      setSelectedInvoice(null);
    } catch (err) {
      console.error(err);
      showToast('Erro ao confirmar pagamento.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  // Exportar Faturas para CSV
  const handleExportCSV = () => {
    const headers = ['ID Fatura', 'Loja', 'Período Início', 'Período Fim', 'Pedidos', 'Valor Total (R$)', 'Vencimento', 'Status', 'Confirmado Em', 'Confirmado Por'];
    const rows = filteredInvoices.map((inv) => [
      inv.id,
      `"${inv.storeNome.replace(/"/g, '""')}"`,
      inv.periodoInicio,
      inv.periodoFim,
      inv.quantidadePedidos,
      inv.valorTotal.toFixed(2),
      inv.vencimento,
      inv.status,
      inv.confirmadoEm || '',
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
            Consolidação de períodos de apuração, emissão de faturas Pix e conciliação de recebimentos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
            Total de Faturas Emitidas
          </span>
          <div className="text-2xl sm:text-3xl font-black text-neutral-900">{totals.totalFaturas}</div>
          <p className="text-[11px] text-neutral-500">cobranças consolidadas</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-1">
          <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
            Volume Total Faturado
          </span>
          <div className="text-2xl sm:text-3xl font-black text-neutral-900">{formatCurrency(totals.valorTotal)}</div>
          <p className="text-[11px] text-neutral-500">valor das faturas geradas</p>
        </div>

        <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-200 shadow-xs space-y-1">
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
            Faturas Liquidadas
          </span>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600">{formatCurrency(totals.valorPago)}</div>
          <p className="text-[11px] text-emerald-700">pagamentos confirmados</p>
        </div>

        <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200 shadow-xs space-y-1">
          <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
            Faturas Pendentes
          </span>
          <div className="text-2xl sm:text-3xl font-black text-amber-900">{formatCurrency(totals.valorPendente)}</div>
          <p className="text-[11px] text-amber-700">aguardando liquidação Pix</p>
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
            <option value="aberta">Pendente</option>
            <option value="aguardando_confirmacao">Aguardando Confirmação</option>
            <option value="paga">Paga</option>
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
                <th className="py-3 px-4">Fatura ID</th>
                <th className="py-3 px-4">Loja</th>
                <th className="py-3 px-4">Período</th>
                <th className="py-3 px-4">Pedidos</th>
                <th className="py-3 px-4">Valor Total</th>
                <th className="py-3 px-4">Vencimento</th>
                <th className="py-3 px-4">Situação</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 font-medium">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-neutral-400 text-xs">
                    Nenhuma fatura encontrada com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-neutral-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-neutral-900">
                      {inv.id}
                    </td>
                    <td className="py-3 px-4 font-bold text-neutral-800">
                      {inv.storeNome}
                    </td>
                    <td className="py-3 px-4 text-neutral-600 font-mono text-[11px]">
                      {inv.periodoInicio} a {inv.periodoFim}
                    </td>
                    <td className="py-3 px-4 text-neutral-700">
                      {inv.quantidadePedidos} pedido(s)
                    </td>
                    <td className="py-3 px-4 font-black text-neutral-900 text-sm">
                      {formatCurrency(inv.valorTotal)}
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
                      {inv.status === 'aguardando_confirmacao' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 flex items-center gap-1 w-fit">
                          <Clock className="w-3 h-3" /> COM COMPROVANTE
                        </span>
                      )}
                      {inv.status === 'aberta' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 flex items-center gap-1 w-fit">
                          <Clock className="w-3 h-3" /> PENDENTE
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
                            onClick={() => handleConfirmPayment(inv)}
                            disabled={processingId === inv.id}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                            title="Confirmar recebimento do Pix"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Confirmar</span>
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
                <span>Fechar Período e Gerar Cobrança</span>
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Data Inicial *
                </label>
                <input
                  type="date"
                  value={genInicio}
                  onChange={(e) => setGenInicio(e.target.value)}
                  className="w-full text-xs font-bold p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none cursor-pointer"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Data Final *
                </label>
                <input
                  type="date"
                  value={genFim}
                  onChange={(e) => setGenFim(e.target.value)}
                  className="w-full text-xs font-bold p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none cursor-pointer"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Tipo de Período
                </label>
                <select
                  value={genPeriodoTipo}
                  onChange={(e) => setGenPeriodoTipo(e.target.value as any)}
                  className="w-full text-xs font-bold p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none cursor-pointer"
                >
                  <option value="mensal">Mensal</option>
                  <option value="semanal">Semanal</option>
                  <option value="diario">Diário</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Vencimento *
                </label>
                <input
                  type="date"
                  value={genVencimento}
                  onChange={(e) => setGenVencimento(e.target.value)}
                  className="w-full text-xs font-bold p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none cursor-pointer"
                  required
                />
              </div>
            </div>

            <p className="text-[11px] text-neutral-500 bg-neutral-50 p-3 rounded-xl border border-neutral-200">
              O sistema consolidará todos os pedidos pendentes da loja neste intervalo, gerará um QR Code Pix automático com os dados bancários da Master e vinculará os lançamentos para evitar cobrança duplicada.
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
                <span>{generating ? 'Consolidando...' : 'Gerar Fatura'}</span>
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
                <span className="text-neutral-500">Vencimento:</span>
                <span className="font-bold text-neutral-800">{selectedInvoice.vencimento}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Valor Total:</span>
                <span className="font-black text-emerald-600 text-sm">
                  {formatCurrency(selectedInvoice.valorTotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Situação:</span>
                <span className="font-bold uppercase text-neutral-800">{selectedInvoice.status}</span>
              </div>
            </div>

            {selectedInvoice.comprovanteTexto && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs space-y-1">
                <span className="font-bold text-blue-900 block">Comprovante enviado pelo Lojista:</span>
                <p className="text-blue-800 italic">"{selectedInvoice.comprovanteTexto}"</p>
                {selectedInvoice.comprovanteEnviadoEm && (
                  <span className="text-[10px] text-blue-600 block">
                    Enviado em {formatDateTime(selectedInvoice.comprovanteEnviadoEm)}
                  </span>
                )}
              </div>
            )}

            {selectedInvoice.pixQrCodeBase64 && (
              <div className="flex flex-col items-center justify-center p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                <img
                  src={selectedInvoice.pixQrCodeBase64}
                  alt="QR Code"
                  className="w-36 h-36 rounded-lg border border-neutral-300"
                />
                <span className="text-[10px] text-neutral-500 mt-1 font-mono">
                  Chave: {selectedInvoice.pixChave}
                </span>
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
                  onClick={() => handleConfirmPayment(selectedInvoice)}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirmar Recebimento</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
