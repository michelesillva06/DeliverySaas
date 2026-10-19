import React, { useState, useMemo } from 'react';
import {
  ShoppingBag,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  Bike,
  Download,
  Eye,
  Store as StoreIcon,
  Phone,
  MapPin,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';
import { Order, Store, OrderStatus } from '../../../types';
import { formatCurrency, formatDateTime, formatPhone } from '../../../lib/formatters';

interface GlobalOrdersTabProps {
  orders: Order[];
  stores: Store[];
}

export const GlobalOrdersTab: React.FC<GlobalOrdersTabProps> = ({ orders, stores }) => {
  const [selectedStoreId, setSelectedStoreId] = useState<string>('todos');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [periodFilter, setPeriodFilter] = useState<'hoje' | '7dias' | '30dias' | 'todos'>('hoje');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Mapeamento de id de loja para objeto Store
  const storeMap = useMemo(() => {
    const map = new Map<string, Store>();
    stores.forEach((s) => map.set(s.id, s));
    return map;
  }, [stores]);

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Filtragem dos pedidos
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Filtro de Loja
      if (selectedStoreId !== 'todos' && o.storeId !== selectedStoreId) {
        return false;
      }

      // Filtro de Status
      if (statusFilter !== 'todos' && o.status !== statusFilter) {
        return false;
      }

      // Filtro de Período
      if (periodFilter === 'hoje') {
        if (!o.criadoEm.startsWith(todayStr)) return false;
      } else if (periodFilter === '7dias') {
        const diffDays = (now.getTime() - new Date(o.criadoEm).getTime()) / (1000 * 3600 * 24);
        if (diffDays > 7) return false;
      } else if (periodFilter === '30dias') {
        const diffDays = (now.getTime() - new Date(o.criadoEm).getTime()) / (1000 * 3600 * 24);
        if (diffDays > 30) return false;
      }

      // Busca por termo
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const numMatch = o.numero.toString().includes(q);
        const nameMatch = (o.cliente?.nome || '').toLowerCase().includes(q);
        const phoneMatch = (o.cliente?.telefone || '').includes(q);
        const storeNome = storeMap.get(o.storeId)?.nome.toLowerCase() || '';
        const storeMatch = storeNome.includes(q);
        if (!numMatch && !nameMatch && !phoneMatch && !storeMatch) return false;
      }

      return true;
    });
  }, [orders, selectedStoreId, statusFilter, periodFilter, searchQuery, storeMap, todayStr]);

  // Exportar para CSV
  const handleExportCSV = () => {
    const headers = [
      'ID Pedido',
      'Número',
      'Loja',
      'Data Criação',
      'Cliente',
      'Telefone',
      'Tipo',
      'Total (R$)',
      'Forma Pagamento',
      'Status Pagamento',
      'Status Pedido',
    ];

    const rows = filteredOrders.map((o) => {
      const stNome = storeMap.get(o.storeId)?.nome || o.storeId;
      return [
        o.id,
        o.numero,
        `"${stNome.replace(/"/g, '""')}"`,
        o.criadoEm,
        `"${(o.cliente?.nome || '').replace(/"/g, '""')}"`,
        o.cliente?.telefone || '',
        o.tipo,
        (o.total || 0).toFixed(2),
        o.pagamento?.forma || '',
        o.pagamento?.status || '',
        o.status,
      ].join(';');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `pedidos_globais_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Barra de Filtros e Exportação */}
      <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-neutral-900 uppercase tracking-wider flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-neutral-700" />
              <span>Pedidos Globais da Plataforma ({filteredOrders.length})</span>
            </h3>
            <p className="text-xs text-neutral-500">
              Acompanhamento centralizado de todos os pedidos realizados em todas as lojas parceiras.
            </p>
          </div>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
          >
            <Download className="w-4 h-4" />
            <span>Exportar CSV</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2 border-t border-neutral-100">
          {/* Filtro por Loja */}
          <div>
            <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
              Estabelecimento
            </label>
            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="w-full text-xs bg-neutral-100 border-none rounded-xl px-3 py-2 font-bold text-neutral-800 cursor-pointer"
            >
              <option value="todos">Todas as Lojas ({stores.length})</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Status */}
          <div>
            <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
              Status do Pedido
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-xs bg-neutral-100 border-none rounded-xl px-3 py-2 font-bold text-neutral-800 cursor-pointer"
            >
              <option value="todos">Todos os Status</option>
              <option value="novo">Novo</option>
              <option value="aceito">Aceito</option>
              <option value="preparo">Em Preparo</option>
              <option value="saiu_entrega">Saiu para Entrega</option>
              <option value="pronto">Pronto / Retirada</option>
              <option value="entregue">Entregue (Concluído)</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>

          {/* Filtro por Período */}
          <div>
            <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
              Período
            </label>
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value as any)}
              className="w-full text-xs bg-neutral-100 border-none rounded-xl px-3 py-2 font-bold text-neutral-800 cursor-pointer"
            >
              <option value="hoje">Hoje</option>
              <option value="7dias">Últimos 7 Dias</option>
              <option value="30dias">Últimos 30 Dias</option>
              <option value="todos">Todo o Histórico</option>
            </select>
          </div>

          {/* Busca por Termo */}
          <div>
            <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
              Pesquisar
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Pedido #, cliente, loja..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs bg-neutral-100 border-none rounded-xl pl-8 pr-3 py-2 font-medium text-neutral-800 placeholder-neutral-400 focus:ring-2 focus:ring-neutral-900"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabela de Pedidos */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-400 font-bold uppercase text-[10px]">
                <th className="py-3 px-4">Pedido</th>
                <th className="py-3 px-4">Loja</th>
                <th className="py-3 px-4">Horário</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Valor</th>
                <th className="py-3 px-4">Pagamento</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 font-medium">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-neutral-400 text-xs">
                    Nenhum pedido encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o) => {
                  const storeObj = storeMap.get(o.storeId);
                  return (
                    <tr key={o.id} className="hover:bg-neutral-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-neutral-900">
                        #{o.numero}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-neutral-800 block truncate max-w-[140px]">
                          {storeObj?.nome || o.storeId}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-mono">
                          /{storeObj?.slug || ''}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-neutral-500 whitespace-nowrap">
                        {formatDateTime(o.criadoEm)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-neutral-800 block">
                          {o.cliente?.nome || 'Cliente'}
                        </span>
                        <span className="text-[10px] text-neutral-400">
                          {formatPhone(o.cliente?.telefone || '')}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="capitalize text-neutral-600">
                          {o.tipo === 'entrega' ? '🛵 Entrega' : '🛍️ Retirada'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-black text-neutral-900">
                        {formatCurrency(o.total)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="capitalize text-neutral-700 block text-[11px]">
                          {o.pagamento?.forma}
                        </span>
                        <span
                          className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded ${
                            o.pagamento?.status === 'confirmado'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {o.pagamento?.status || 'pendente'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {o.status === 'entregue' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 flex items-center gap-1 w-fit">
                            <CheckCircle2 className="w-3 h-3" /> Entregue
                          </span>
                        )}
                        {o.status === 'pronto' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-100 text-teal-800 flex items-center gap-1 w-fit">
                            <CheckCircle2 className="w-3 h-3" /> Pronto
                          </span>
                        )}
                        {o.status === 'novo' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 flex items-center gap-1 w-fit animate-pulse">
                            <Clock className="w-3 h-3" /> Novo
                          </span>
                        )}
                        {o.status === 'aceito' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800 flex items-center gap-1 w-fit">
                            <Clock className="w-3 h-3" /> Aceito
                          </span>
                        )}
                        {o.status === 'preparo' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 flex items-center gap-1 w-fit">
                            <Clock className="w-3 h-3" /> Em Preparo
                          </span>
                        )}
                        {o.status === 'saiu_entrega' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 flex items-center gap-1 w-fit">
                            <Bike className="w-3 h-3" /> Em Rota
                          </span>
                        )}
                        {o.status === 'cancelado' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-neutral-200 text-neutral-600 flex items-center gap-1 w-fit">
                            <XCircle className="w-3 h-3" /> Cancelado
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedOrder(o)}
                          className="p-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg transition-colors cursor-pointer inline-flex items-center"
                          title="Ver detalhes do pedido"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Detalhes do Pedido Global */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-neutral-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <h3 className="font-black text-base text-neutral-900">
                  Pedido #{selectedOrder.numero}
                </h3>
                <span className="text-xs text-neutral-500">
                  Loja: <strong>{storeMap.get(selectedOrder.storeId)?.nome || selectedOrder.storeId}</strong>
                </span>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-xl"
              >
                ✕
              </button>
            </div>

            {/* Itens */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                Itens do Pedido ({selectedOrder.itens?.length || 0})
              </span>
              <div className="bg-neutral-50 rounded-2xl p-3 space-y-2 border border-neutral-200">
                {selectedOrder.itens?.map((it, idx) => (
                  <div key={idx} className="flex justify-between items-start text-xs">
                    <div>
                      <span className="font-bold text-neutral-800">
                        {it.qtd}x {it.nome}
                      </span>
                      {it.complementos?.length > 0 && (
                        <p className="text-[10px] text-neutral-500 pl-2">
                          + {it.complementos.map((c) => c.nome).join(', ')}
                        </p>
                      )}
                      {it.obs && <p className="text-[10px] text-amber-700 italic pl-2">Obs: {it.obs}</p>}
                    </div>
                    <span className="font-bold text-neutral-900">{formatCurrency(it.totalItem)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Endereço */}
            {selectedOrder.tipo === 'entrega' && selectedOrder.endereco && (
              <div className="bg-neutral-50 p-3 rounded-2xl border border-neutral-200 text-xs space-y-1">
                <span className="text-[10px] font-bold text-neutral-400 uppercase block">Endereço de Entrega:</span>
                <p className="font-bold text-neutral-800">
                  {selectedOrder.endereco.rua}, Nº {selectedOrder.endereco.numero}
                </p>
                {selectedOrder.endereco.complemento && (
                  <p className="text-neutral-600">Compl: {selectedOrder.endereco.complemento}</p>
                )}
                <p className="text-neutral-600">Bairro: {selectedOrder.endereco.bairro}</p>
                {selectedOrder.endereco.referencia && (
                  <p className="text-neutral-500 italic">Ref: {selectedOrder.endereco.referencia}</p>
                )}
              </div>
            )}

            {/* Totais */}
            <div className="border-t border-neutral-100 pt-3 space-y-1 text-xs">
              <div className="flex justify-between text-neutral-500">
                <span>Subtotal:</span>
                <span>{formatCurrency(selectedOrder.subtotal)}</span>
              </div>
              {selectedOrder.desconto > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Desconto:</span>
                  <span>-{formatCurrency(selectedOrder.desconto)}</span>
                </div>
              )}
              {selectedOrder.taxaEntrega > 0 && (
                <div className="flex justify-between text-neutral-500">
                  <span>Taxa de Entrega:</span>
                  <span>{formatCurrency(selectedOrder.taxaEntrega)}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-sm text-neutral-900 pt-1 border-t border-neutral-200">
                <span>Total:</span>
                <span>{formatCurrency(selectedOrder.total)}</span>
              </div>
            </div>

            <button
              onClick={() => setSelectedOrder(null)}
              className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
