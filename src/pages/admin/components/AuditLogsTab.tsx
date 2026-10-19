import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  Search,
  Clock,
  User,
  History,
  Tag,
  CheckCircle2,
  AlertTriangle,
  Building2,
  TrendingUp,
  KeyRound,
  FileText,
} from 'lucide-react';
import { AdminAuditLog } from '../../../types';
import { subscribeToAdminAuditLogs } from '../../../services/operationalFeeService';
import { formatDateTime } from '../../../lib/formatters';

export const AuditLogsTab: React.FC = () => {
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('todos');

  useEffect(() => {
    const unsub = subscribeToAdminAuditLogs((list) => {
      setLogs(list);
    });
    return () => unsub();
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (actionFilter !== 'todos' && log.acao !== actionFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchAutor = log.autorEmail.toLowerCase().includes(q);
        const matchDetalhes = log.detalhes.toLowerCase().includes(q);
        const matchAlvo = (log.alvoNome || '').toLowerCase().includes(q);
        const matchJust = (log.justificativa || '').toLowerCase().includes(q);
        if (!matchAutor && !matchDetalhes && !matchAlvo && !matchJust) return false;
      }
      return true;
    });
  }, [logs, actionFilter, searchQuery]);

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Cabeçalho */}
      <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-neutral-900 tracking-tight flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600" />
            <span>Auditoria de Operações Administrativas</span>
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            Registro imutável de todas as ações de gestão, alterações de taxas, suspensões e conciliações financeiras.
          </p>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-neutral-100 border-none rounded-xl px-3 py-2 font-bold text-neutral-800 cursor-pointer"
          >
            <option value="todos">Todas as Ações</option>
            <option value="alterar_taxa_global">Alteração de Taxa Global</option>
            <option value="alterar_taxa_loja">Alteração de Taxa por Loja</option>
            <option value="confirmar_fatura">Confirmação de Fatura / Pagamento</option>
            <option value="fechar_periodo_fatura">Fechamento de Período</option>
            <option value="suspender_loja">Suspensão de Estabelecimento</option>
            <option value="ativar_loja">Ativação de Estabelecimento</option>
            <option value="login_como_loja">Gerenciamento em Modo Admin</option>
          </select>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Pesquisar evento, autor, loja..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-neutral-100 border-none rounded-xl pl-8 pr-3 py-2 font-medium text-neutral-800 placeholder-neutral-400 w-64 focus:ring-2 focus:ring-neutral-900"
          />
        </div>
      </div>

      {/* Tabela de Logs */}
      <div className="bg-white rounded-3xl border border-neutral-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-400 font-bold uppercase text-[10px]">
                <th className="py-3 px-4">Data / Hora</th>
                <th className="py-3 px-4">Autor</th>
                <th className="py-3 px-4">Tipo de Ação</th>
                <th className="py-3 px-4">Alvo</th>
                <th className="py-3 px-4">Detalhes</th>
                <th className="py-3 px-4">Justificativa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 font-medium">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-neutral-400 text-xs">
                    Nenhum registro de auditoria encontrado.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-neutral-50/80 transition-colors">
                    <td className="py-3 px-4 text-neutral-500 whitespace-nowrap">
                      {formatDateTime(log.criadoEm)}
                    </td>
                    <td className="py-3 px-4 font-bold text-neutral-800">
                      {log.autorEmail}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-neutral-100 text-neutral-800">
                        {log.acao.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-neutral-900">
                      {log.alvoNome || log.alvoId}
                    </td>
                    <td className="py-3 px-4 text-neutral-700">
                      {log.detalhes}
                    </td>
                    <td className="py-3 px-4 text-neutral-500 italic">
                      {log.justificativa || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
