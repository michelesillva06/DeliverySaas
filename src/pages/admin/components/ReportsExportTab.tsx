import React, { useState, useMemo } from 'react';
import {
  FileText,
  Download,
  Calendar,
  Filter,
  CheckCircle2,
  Table,
} from 'lucide-react';
import { Store, Order, OperationalFeeEntry, OperationalInvoice } from '../../../types';
import { formatCurrency, formatDateTime } from '../../../lib/formatters';
import { useToast } from '../../../components/Toast';

interface ReportsExportTabProps {
  stores: Store[];
  orders: Order[];
  entries: OperationalFeeEntry[];
  invoices: OperationalInvoice[];
}

export const ReportsExportTab: React.FC<ReportsExportTabProps> = ({
  stores,
  orders,
  entries,
  invoices,
}) => {
  const { showToast } = useToast();

  const [reportType, setReportType] = useState<'pedidos' | 'lojas' | 'taxas' | 'faturas'>('pedidos');
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [dataFim, setDataFim] = useState(() => new Date().toISOString().split('T')[0]);

  // Exportar Relatório Escolhido
  const handleExport = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let filename = `relatorio_${reportType}_${dataInicio}_a_${dataFim}.csv`;

    if (reportType === 'pedidos') {
      headers = [
        'ID Pedido',
        'Número',
        'ID Loja',
        'Data',
        'Cliente',
        'Telefone',
        'Tipo',
        'Total (R$)',
        'Pagamento',
        'Status',
      ];
      const filtered = orders.filter((o) => {
        const d = o.criadoEm.split('T')[0];
        return d >= dataInicio && d <= dataFim;
      });

      rows = filtered.map((o) => [
        o.id,
        o.numero,
        o.storeId,
        o.criadoEm,
        `"${(o.cliente?.nome || '').replace(/"/g, '""')}"`,
        o.cliente?.telefone || '',
        o.tipo,
        (o.total || 0).toFixed(2),
        o.pagamento?.forma || '',
        o.status,
      ]);
    } else if (reportType === 'lojas') {
      headers = [
        'ID Loja',
        'Nome',
        'Slug',
        'Status',
        'Plano',
        'Mensalidade (R$)',
        'Responsável',
        'E-mail',
        'WhatsApp',
        'Data Cadastro',
      ];
      rows = stores.map((s) => [
        s.id,
        `"${s.nome.replace(/"/g, '""')}"`,
        s.slug,
        s.status,
        s.plano || '',
        (s.valorMensalidade || 0).toFixed(2),
        `"${(s.nomeResponsavel || '').replace(/"/g, '""')}"`,
        s.emailResponsavel || '',
        s.whatsapp || '',
        s.criadaEm || s.criadoEm || '',
      ]);
    } else if (reportType === 'taxas') {
      headers = [
        'ID Lançamento',
        'ID Pedido',
        'Número Pedido',
        'Loja',
        'Data Conclusão',
        'Valor do Pedido (R$)',
        'Taxa Operacional (R$)',
        'Status Lançamento',
        'ID Cobrança',
      ];
      const filtered = entries.filter((e) => {
        const d = e.criadoEm.split('T')[0];
        return d >= dataInicio && d <= dataFim;
      });

      rows = filtered.map((e) => [
        e.id,
        e.orderId,
        e.orderNumero,
        `"${e.storeNome.replace(/"/g, '""')}"`,
        e.dataConclusao,
        (e.valorPedido || 0).toFixed(2),
        (e.taxaAplicada || 0).toFixed(2),
        e.status,
        e.cobrancaId || '',
      ]);
    } else if (reportType === 'faturas') {
      headers = [
        'ID Fatura',
        'Loja',
        'Período Início',
        'Período Fim',
        'Quantidade Pedidos',
        'Valor Total (R$)',
        'Vencimento',
        'Situação',
        'Confirmado Em',
        'Confirmado Por',
      ];
      const filtered = invoices.filter((i) => {
        const d = i.geradoEm.split('T')[0];
        return d >= dataInicio && d <= dataFim;
      });

      rows = filtered.map((i) => [
        i.id,
        `"${i.storeNome.replace(/"/g, '""')}"`,
        i.periodoInicio,
        i.periodoFim,
        i.quantidadePedidos,
        (i.valorTotal || 0).toFixed(2),
        i.vencimento,
        i.status,
        i.confirmadoEm || '',
        i.confirmadoPor || '',
      ]);
    }

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Relatório exportado com sucesso (${rows.length} registros)!`, 'success');
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-xs space-y-2">
        <h2 className="text-xl font-black text-neutral-900 tracking-tight flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-600" />
          <span>Central de Relatórios & Exportação CSV</span>
        </h2>
        <p className="text-xs text-neutral-500">
          Gere relatórios completos de lojas, pedidos, lançamentos de taxas operacionais e cobranças para auditoria ou importação no Excel.
        </p>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-xs space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">
              Tipo de Relatório *
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as any)}
              className="w-full text-xs font-bold p-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none cursor-pointer"
            >
              <option value="pedidos">Histórico de Pedidos Globais</option>
              <option value="taxas">Extrato de Taxas Operacionais</option>
              <option value="faturas">Faturas e Cobranças Emitidas</option>
              <option value="lojas">Lojas Cadastradas (Base Completa)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">
              Data Inicial *
            </label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-full text-xs font-bold p-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">
              Data Final *
            </label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-full text-xs font-bold p-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none cursor-pointer"
            />
          </div>
        </div>

        <button
          onClick={handleExport}
          className="w-full py-3 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
        >
          <Download className="w-4 h-4" />
          <span>Baixar Relatório em Planilha CSV</span>
        </button>
      </div>
    </div>
  );
};
