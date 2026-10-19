import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Receipt,
  CheckCircle2,
  Clock,
  AlertTriangle,
  QrCode,
  Copy,
  Check,
  Search,
  Calendar,
  DollarSign,
  ArrowUpRight,
  Send,
  FileText,
  ShieldCheck,
  Info,
  ExternalLink,
} from 'lucide-react';
import { Store, OperationalFeeEntry, OperationalInvoice, OperationalFeeConfig } from '../../types';
import {
  subscribeToOperationalFeeEntriesByStore,
  subscribeToInvoicesByStore,
  subscribeToOperationalFeeConfig,
  submitInvoicePaymentProof,
} from '../../services/operationalFeeService';
import { formatCurrency, formatDateTime } from '../../lib/formatters';
import { useToast } from '../../components/Toast';

export const OperationalFeePage: React.FC = () => {
  const { store } = useOutletContext<{ store: Store }>();
  const { showToast } = useToast();

  const [entries, setEntries] = useState<OperationalFeeEntry[]>([]);
  const [invoices, setInvoices] = useState<OperationalInvoice[]>([]);
  const [config, setConfig] = useState<OperationalFeeConfig | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<OperationalInvoice | null>(null);
  const [proofText, setProofText] = useState('');
  const [isSubmittingProof, setIsSubmittingProof] = useState(false);
  const [copied, setCopied] = useState(false);

  // Filtros do extrato
  const [filterPeriod, setFilterPeriod] = useState<'mes' | '7dias' | 'todos'>('mes');
  const [filterStatus, setFilterStatus] = useState<'todos' | 'pendente' | 'em_cobranca' | 'pago' | 'estornado'>('todos');
  const [searchTerm, setSearchTerm] = useState('');

  // Escutar lançamentos da loja
  useEffect(() => {
    if (!store?.id) return;

    const unsubEntries = subscribeToOperationalFeeEntriesByStore(store.id, (list) => {
      setEntries(list);
    });

    const unsubInvoices = subscribeToInvoicesByStore(store.id, (invs) => {
      setInvoices(invs);
    });

    const unsubConfig = subscribeToOperationalFeeConfig((cfg) => {
      setConfig(cfg);
    });

    return () => {
      unsubEntries();
      unsubInvoices();
      unsubConfig();
    };
  }, [store?.id]);

  // Taxa unitária para esta loja
  const taxaUnit = useMemo(() => {
    if (!config) return 0.99;
    const storeOverride = config.lojasConfig?.[store.id];
    if (typeof storeOverride?.valorUnitario === 'number') {
      return storeOverride.valorUnitario;
    }
    return config.valorPadrao ?? 0.99;
  }, [config, store.id]);

  // Cálculos do período
  const metrics = useMemo(() => {
    const validos = entries.filter((e) => e.status !== 'estornado');
    const pendentes = entries.filter((e) => e.status === 'pendente' || e.status === 'em_cobranca');
    const pagos = entries.filter((e) => e.status === 'pago');

    const totalAcumulado = validos.reduce((sum, e) => sum + e.taxaAplicada, 0);
    const totalPago = pagos.reduce((sum, e) => sum + e.taxaAplicada, 0);
    const saldoPendente = pendentes.reduce((sum, e) => sum + e.taxaAplicada, 0);

    // Próxima fatura em aberto
    const openInvoice = invoices.find((inv) => inv.status === 'aberta' || inv.status === 'vencida');

    return {
      quantidadeValidos: validos.length,
      totalAcumulado,
      totalPago,
      saldoPendente,
      openInvoice,
    };
  }, [entries, invoices]);

  // Filtragem dos lançamentos
  const filteredEntries = useMemo(() => {
    const now = new Date();
    return entries.filter((e) => {
      if (filterStatus !== 'todos' && e.status !== filterStatus) return false;

      const entryDate = new Date(e.criadoEm);
      if (filterPeriod === '7dias') {
        const diffDays = (now.getTime() - entryDate.getTime()) / (1000 * 3600 * 24);
        if (diffDays > 7) return false;
      } else if (filterPeriod === 'mes') {
        if (entryDate.getMonth() !== now.getMonth() || entryDate.getFullYear() !== now.getFullYear()) {
          return false;
        }
      }

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchNum = e.orderNumero.toString().includes(term);
        const matchId = e.orderId.toLowerCase().includes(term);
        if (!matchNum && !matchId) return false;
      }

      return true;
    });
  }, [entries, filterPeriod, filterStatus, searchTerm]);

  // Copiar Pix Copia e Cola
  const handleCopyPix = (payload?: string) => {
    if (!payload) return;
    navigator.clipboard.writeText(payload);
    setCopied(true);
    showToast('Código Pix Copia e Cola copiado!', 'success');
    setTimeout(() => setCopied(false), 3000);
  };

  // Enviar comprovante da fatura
  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    if (!proofText.trim()) {
      showToast('Por favor, informe a identificação ou comprovante da transferência.', 'error');
      return;
    }

    setIsSubmittingProof(true);
    try {
      await submitInvoicePaymentProof(selectedInvoice.id, proofText.trim());
      showToast('Comprovante enviado com sucesso! A Master confirmará o recebimento.', 'success');
      setSelectedInvoice(null);
      setProofText('');
    } catch (err) {
      console.error(err);
      showToast('Erro ao enviar comprovante.', 'error');
    } finally {
      setIsSubmittingProof(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
              <Receipt className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">
              Meu Repasse Operacional
            </h1>
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            Controle transparente das taxas operacionais por pedidos concluídos da sua loja.
          </p>
        </div>

        {/* Status de Vencimento e Botão Pagar */}
        {metrics.openInvoice && (
          <button
            onClick={() => setSelectedInvoice(metrics.openInvoice!)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer animate-bounce"
          >
            <QrCode className="w-4 h-4" />
            <span>Pagar Fatura Aberta ({formatCurrency(metrics.openInvoice.valorTotal)})</span>
          </button>
        )}
      </div>

      {/* Cards de Resumo Financeiro */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Card 1: Pedidos Válidos */}
        <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs">
          <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
            Pedidos Válidos
          </span>
          <div className="text-2xl sm:text-3xl font-black text-neutral-900 mt-1">
            {metrics.quantidadeValidos}
          </div>
          <span className="text-[11px] text-neutral-500 mt-1 block">concluídos com sucesso</span>
        </div>

        {/* Card 2: Taxa Unitária */}
        <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs">
          <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
            Taxa por Pedido
          </span>
          <div className="text-2xl sm:text-3xl font-black text-indigo-600 mt-1">
            {formatCurrency(taxaUnit)}
          </div>
          <span className="text-[11px] text-neutral-500 mt-1 block">
            apuração {config?.periodoApuracao || 'mensal'}
          </span>
        </div>

        {/* Card 3: Total Acumulado */}
        <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs">
          <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
            Total Acumulado
          </span>
          <div className="text-2xl sm:text-3xl font-black text-neutral-900 mt-1">
            {formatCurrency(metrics.totalAcumulado)}
          </div>
          <span className="text-[11px] text-neutral-500 mt-1 block">histórico total da loja</span>
        </div>

        {/* Card 4: Total Pago */}
        <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs">
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
            Total Pago
          </span>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 mt-1">
            {formatCurrency(metrics.totalPago)}
          </div>
          <span className="text-[11px] text-neutral-500 mt-1 block">repasses confirmados</span>
        </div>

        {/* Card 5: Saldo Pendente */}
        <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 shadow-xs col-span-2 lg:col-span-1">
          <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">
            Saldo Pendente
          </span>
          <div className="text-2xl sm:text-3xl font-black text-amber-900 mt-1">
            {formatCurrency(metrics.saldoPendente)}
          </div>
          <span className="text-[11px] text-amber-700 mt-1 block">a acertar no fechamento</span>
        </div>
      </div>

      {/* Banner Informativo de Regras */}
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl flex items-start gap-3 text-blue-900">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-bold">Como funciona a Taxa Operacional do Pede AI:</p>
          <p className="text-blue-800 leading-relaxed">
            A taxa de <strong>{formatCurrency(taxaUnit)}</strong> incide exclusivamente sobre <strong>pedidos válidos e concluídos</strong> (entregues aos clientes). Pedidos cancelados, recusados ou de teste nunca são cobrados. O fechamento ocorre de forma <strong>{config?.periodoApuracao || 'mensal'}</strong> e o repasse é feito via Pix diretamente para a administração da plataforma.
          </p>
        </div>
      </div>

      {/* Seção de Faturas / Cobranças Emitidas */}
      {invoices.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-neutral-900 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-neutral-600" />
              <span>Minhas Cobranças & Faturas</span>
            </h2>
            <span className="text-xs font-bold text-neutral-500">{invoices.length} fatura(s)</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-neutral-200 text-neutral-400 font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Período</th>
                  <th className="py-2.5 px-3">Pedidos</th>
                  <th className="py-2.5 px-3">Valor Total</th>
                  <th className="py-2.5 px-3">Vencimento</th>
                  <th className="py-2.5 px-3">Situação</th>
                  <th className="py-2.5 px-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 font-medium">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="py-3 px-3 font-mono">
                      {inv.periodoInicio} até {inv.periodoFim}
                    </td>
                    <td className="py-3 px-3 font-bold text-neutral-800">
                      {inv.quantidadePedidos} pedido(s)
                    </td>
                    <td className="py-3 px-3 font-black text-neutral-900 text-sm">
                      {formatCurrency(inv.valorTotal)}
                    </td>
                    <td className="py-3 px-3 text-neutral-600">
                      {inv.vencimento}
                    </td>
                    <td className="py-3 px-3">
                      {inv.status === 'paga' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 flex items-center gap-1 w-fit">
                          <CheckCircle2 className="w-3 h-3" /> PAGA
                        </span>
                      )}
                      {inv.status === 'aguardando_confirmacao' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 flex items-center gap-1 w-fit">
                          <Clock className="w-3 h-3" /> EM ANÁLISE
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
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => setSelectedInvoice(inv)}
                        className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        <span>{inv.status === 'paga' ? 'Ver Detalhes' : 'Pagar / Enviar Comprovante'}</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Extrato Detalhado de Lançamentos por Pedido */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-black text-neutral-900 uppercase tracking-wider">
              Extrato Detalhado de Pedidos
            </h2>
            <p className="text-xs text-neutral-500">
              Cada pedido concluído gera um lançamento único e auditável.
            </p>
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value as any)}
              className="text-xs bg-neutral-100 border-none rounded-xl px-3 py-2 font-bold text-neutral-700 cursor-pointer"
            >
              <option value="mes">Este Mês</option>
              <option value="7dias">Últimos 7 dias</option>
              <option value="todos">Todo o Histórico</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="text-xs bg-neutral-100 border-none rounded-xl px-3 py-2 font-bold text-neutral-700 cursor-pointer"
            >
              <option value="todos">Todos os Status</option>
              <option value="pendente">Pendente</option>
              <option value="em_cobranca">Em Cobrança</option>
              <option value="pago">Pago</option>
              <option value="estornado">Estornado</option>
            </select>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar pedido #..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="text-xs bg-neutral-100 border-none rounded-xl pl-8 pr-3 py-2 font-medium text-neutral-800 placeholder-neutral-400 w-36 sm:w-44 focus:ring-2 focus:ring-neutral-900"
              />
            </div>
          </div>
        </div>

        {/* Tabela de Lançamentos */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-400 font-bold uppercase text-[10px]">
                <th className="py-2.5 px-3">Pedido</th>
                <th className="py-2.5 px-3">Data Conclusão</th>
                <th className="py-2.5 px-3">Valor da Venda</th>
                <th className="py-2.5 px-3">Taxa Operacional</th>
                <th className="py-2.5 px-3">Situação</th>
                <th className="py-2.5 px-3">Fatura</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 font-medium">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-neutral-400 text-xs">
                    Nenhum lançamento encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((e) => (
                  <tr key={e.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-neutral-900">
                      #{e.orderNumero}
                    </td>
                    <td className="py-2.5 px-3 text-neutral-500">
                      {formatDateTime(e.dataConclusao)}
                    </td>
                    <td className="py-2.5 px-3 text-neutral-600">
                      {formatCurrency(e.valorPedido)}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-indigo-700">
                      {formatCurrency(e.taxaAplicada)}
                    </td>
                    <td className="py-2.5 px-3">
                      {e.status === 'pendente' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          Pendente
                        </span>
                      )}
                      {e.status === 'em_cobranca' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                          Em Cobrança
                        </span>
                      )}
                      {e.status === 'pago' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Pago
                        </span>
                      )}
                      {e.status === 'estornado' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                          Estornado
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-neutral-400 font-mono text-[11px]">
                      {e.cobrancaId ? e.cobrancaId.slice(-8) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Pagamento Pix / Detalhes da Cobrança */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-neutral-200">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <h3 className="font-black text-base text-neutral-900">
                  {selectedInvoice.status === 'paga' ? 'Comprovante da Cobrança' : 'Efetuar Repasse via Pix'}
                </h3>
                <span className="text-xs text-neutral-500 font-mono">
                  Fatura: {selectedInvoice.id}
                </span>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-xl"
              >
                ✕
              </button>
            </div>

            {/* Resumo dos Valores */}
            <div className="bg-neutral-50 p-4 rounded-2xl space-y-2 border border-neutral-200">
              <div className="flex justify-between text-xs">
                <span className="text-neutral-500">Período de Apuração:</span>
                <span className="font-bold text-neutral-800">
                  {selectedInvoice.periodoInicio} a {selectedInvoice.periodoFim}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-neutral-500">Pedidos Concluídos:</span>
                <span className="font-bold text-neutral-800">{selectedInvoice.quantidadePedidos}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-neutral-500">Vencimento:</span>
                <span className="font-bold text-neutral-800">{selectedInvoice.vencimento}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-neutral-500">Beneficiário:</span>
                <span className="font-bold text-neutral-800">{selectedInvoice.pixRecebedor || 'Pede AI Plataforma'}</span>
              </div>
              <div className="border-t border-neutral-200 pt-2 flex justify-between items-center">
                <span className="text-xs font-bold text-neutral-700">Valor Total a Pagar:</span>
                <span className="text-xl font-black text-emerald-600">
                  {formatCurrency(selectedInvoice.valorTotal)}
                </span>
              </div>
            </div>

            {/* QR Code Pix e Copia e Cola */}
            {selectedInvoice.status !== 'paga' && selectedInvoice.pixQrCodeBase64 && (
              <div className="flex flex-col items-center justify-center p-3 bg-neutral-50 rounded-2xl border border-neutral-200">
                <img
                  src={selectedInvoice.pixQrCodeBase64}
                  alt="QR Code Pix"
                  className="w-44 h-44 rounded-xl border border-neutral-300"
                />
                <span className="text-[11px] text-neutral-500 mt-2 font-medium">
                  Abra o app do seu banco e aponte a câmera
                </span>

                {selectedInvoice.pixPayload && (
                  <button
                    onClick={() => handleCopyPix(selectedInvoice.pixPayload)}
                    className="mt-3 w-full py-2.5 px-4 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Código Pix Copiado!' : 'Copiar Código Pix Copia e Cola'}</span>
                  </button>
                )}
              </div>
            )}

            {/* Formulário de Envio de Comprovante */}
            {selectedInvoice.status !== 'paga' && (
              <form onSubmit={handleSubmitProof} className="space-y-3 pt-2 border-t border-neutral-100">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Já realizou o Pix? Informe os dados do comprovante:
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Ex: Pago às 15:30 pelo Banco Inter (Autenticação: E123456...)"
                    value={proofText}
                    onChange={(e) => setProofText(e.target.value)}
                    className="w-full text-xs p-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                    required
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedInvoice(null)}
                    className="flex-1 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-bold"
                  >
                    Fechar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingProof}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-md"
                  >
                    <Send className="w-4 h-4" />
                    <span>{isSubmittingProof ? 'Enviando...' : 'Confirmar Envio'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* Status de Já Pago */}
            {selectedInvoice.status === 'paga' && (
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-center gap-3 text-emerald-900">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                <div className="text-xs">
                  <p className="font-bold">Fatura Liquidada com Sucesso!</p>
                  <p className="text-emerald-700">
                    Confirmado em {formatDateTime(selectedInvoice.confirmadoEm || selectedInvoice.geradoEm)} por {selectedInvoice.confirmadoPor || 'Administração'}.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
