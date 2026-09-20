import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Search, Download, MessageCircle } from 'lucide-react';
import { Store, Order } from '../../types';
import { subscribeToOrdersByStore } from '../../services/firestoreService';
import { formatCurrency, formatPhone, formatDateTime, generateWhatsAppUrl } from '../../lib/formatters';
import { useToast } from '../../components/Toast';

interface CustomerSummary {
  telefone: string;
  nome: string;
  totalPedidos: number;
  totalGasto: number;
  ticketMedio: number;
  ultimoPedidoEm: string;
}

export const CustomersCrmPage: React.FC = () => {
  const { store } = useOutletContext<{ store: Store }>();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    const unsub = subscribeToOrdersByStore(store.id, (data) => setOrders(data));
    return () => unsub();
  }, [store.id]);

  // Agregar clientes com base no telefone
  const customers = useMemo(() => {
    const map: { [tel: string]: CustomerSummary } = {};

    orders.forEach((o) => {
      if (!o.cliente?.telefone) return;
      const tel = o.cliente.telefone;
      if (!map[tel]) {
        map[tel] = {
          telefone: tel,
          nome: o.cliente.nome || 'Cliente',
          totalPedidos: 0,
          totalGasto: 0,
          ticketMedio: 0,
          ultimoPedidoEm: o.criadoEm,
        };
      }

      map[tel].totalPedidos += 1;
      map[tel].totalGasto += o.total || 0;
      if (new Date(o.criadoEm) > new Date(map[tel].ultimoPedidoEm)) {
        map[tel].ultimoPedidoEm = o.criadoEm;
        if (o.cliente.nome) {
          map[tel].nome = o.cliente.nome; // Usa o nome mais recente
        }
      }
    });

    return Object.values(map)
      .map((c) => ({
        ...c,
        ticketMedio: c.totalPedidos > 0 ? c.totalGasto / c.totalPedidos : 0,
      }))
      .sort((a, b) => b.totalGasto - a.totalGasto);
  }, [orders]);

  const filteredCustomers = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (c) => c.nome.toLowerCase().includes(q) || c.telefone.includes(q)
    );
  }, [customers, search]);

  const handleExportCsv = () => {
    if (customers.length === 0) {
      showToast('Nenhum dado para exportar.', 'info');
      return;
    }

    const headers = ['Nome', 'Telefone', 'Total Pedidos', 'Total Gasto (R$)', 'Ticket Médio (R$)', 'Último Pedido'];
    const rows = customers.map((c) => [
      `"${c.nome.replace(/"/g, '""')}"`,
      `"${c.telefone}"`,
      c.totalPedidos,
      c.totalGasto.toFixed(2),
      c.ticketMedio.toFixed(2),
      `"${new Date(c.ultimoPedidoEm).toLocaleDateString()}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `clientes_${store.slug}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Base de clientes exportada com sucesso!', 'success');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-neutral-900">Base de Clientes (CRM)</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Visualize o histórico de recompra e acione clientes no WhatsApp
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Exportar Base (CSV)</span>
        </button>
      </div>

      {/* Busca */}
      <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou WhatsApp..."
            className="w-full text-xs pl-9 pr-3 py-2 bg-neutral-100 rounded-xl focus:outline-none focus:ring-1 focus:ring-neutral-900"
          />
        </div>
        <span className="text-xs text-neutral-500 font-medium">
          {filteredCustomers.length} cliente(s) listado(s)
        </span>
      </div>

      {/* Tabela de Clientes */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200 font-bold text-neutral-500 uppercase">
              <th className="p-3 pl-4">Cliente</th>
              <th className="p-3">Telefone</th>
              <th className="p-3 text-center">Pedidos</th>
              <th className="p-3">Total Gasto</th>
              <th className="p-3">Ticket Médio</th>
              <th className="p-3">Última Compra</th>
              <th className="p-3 pr-4 text-right">Contato</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filteredCustomers.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-neutral-400">
                  Nenhum cliente registrado ainda no Firestore.
                </td>
              </tr>
            ) : (
              filteredCustomers.map((c) => (
                <tr key={c.telefone} className="hover:bg-neutral-50/80 transition-colors">
                  <td className="p-3 pl-4 font-bold text-neutral-900 text-sm">{c.nome}</td>
                  <td className="p-3 font-mono text-neutral-600">{formatPhone(c.telefone)}</td>
                  <td className="p-3 text-center font-bold text-neutral-800">{c.totalPedidos}</td>
                  <td className="p-3 font-extrabold text-neutral-900">{formatCurrency(c.totalGasto)}</td>
                  <td className="p-3 text-neutral-600">{formatCurrency(c.ticketMedio)}</td>
                  <td className="p-3 text-neutral-500">{formatDateTime(c.ultimoPedidoEm)}</td>
                  <td className="p-3 pr-4 text-right">
                    <a
                      href={generateWhatsAppUrl(
                        c.telefone,
                        `Olá ${c.nome}! Estamos com novidades no cardápio da ${store.nome}. Venha conferir!`
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg font-bold text-xs transition-colors cursor-pointer"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
