import React, { useState, useMemo } from 'react';
import {
  X,
  Printer,
  MessageCircle,
  MapPin,
  Clock,
  User,
  Phone,
  CheckCircle2,
  XCircle,
  ChevronRight,
  AlertTriangle,
  Bike,
  DollarSign,
  ShieldCheck,
} from 'lucide-react';
import { Order, Store, Courier, OrderStatus } from '../types';
import { formatCurrency, formatDateTime, generateWhatsAppUrl } from '../lib/formatters';
import {
  updateOrderStatusInFirestore,
  updateOrderPaymentStatusInFirestore,
  assignCourierInFirestore,
} from '../services/firestoreService';
import { useToast } from './Toast';
import { ThermalReceipt } from './ThermalReceipt';

interface OrderDetailModalProps {
  order: Order | null;
  store: Store;
  couriers: Courier[];
  isOpen: boolean;
  onClose: () => void;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  order,
  store,
  couriers,
  isOpen,
  onClose,
}) => {
  const { showToast } = useToast();
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [estimatedTime, setEstimatedTime] = useState(order?.tempoEstimadoMin || store.tempoEstimadoMin || 40);

  // Recalcular snapshot de preços para verificar consistência
  const isTotalConsistent = useMemo(() => {
    if (!order) return true;
    const calculatedSubtotal = order.itens.reduce((acc, it) => acc + it.totalItem, 0);
    const calculatedTotal = calculatedSubtotal - (order.desconto || 0) + (order.taxaEntrega || 0);
    return Math.abs(calculatedTotal - order.total) < 0.01;
  }, [order]);

  if (!isOpen || !order) return null;

  const handleStatusChange = async (newStatus: OrderStatus) => {
    try {
      await updateOrderStatusInFirestore(order.id, newStatus, undefined, estimatedTime);
      showToast(`Status do pedido atualizado para: ${newStatus}`, 'success');
    } catch (err: any) {
      console.error(err);
      showToast('Erro ao atualizar status no Firestore.', 'error');
    }
  };

  const handleCancelOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelReason.trim()) {
      showToast('Por favor, informe o motivo do cancelamento.', 'error');
      return;
    }
    try {
      await updateOrderStatusInFirestore(order.id, 'cancelado', cancelReason);
      setCancelModalOpen(false);
      setCancelReason('');
      showToast('Pedido cancelado com sucesso.', 'info');
    } catch (err: any) {
      console.error(err);
      showToast('Erro ao cancelar pedido no Firestore.', 'error');
    }
  };

  const handleConfirmPix = async () => {
    try {
      await updateOrderPaymentStatusInFirestore(order.id, 'confirmado');
      showToast('Pagamento Pix confirmado com sucesso!', 'success');
    } catch (err: any) {
      console.error(err);
      showToast('Erro ao confirmar Pix no Firestore.', 'error');
    }
  };

  const handleMarkPaymentReceived = async () => {
    try {
      await updateOrderPaymentStatusInFirestore(order.id, 'confirmado');
      showToast('Pagamento marcado como recebido!', 'success');
    } catch (err: any) {
      console.error(err);
      showToast('Erro ao atualizar pagamento no Firestore.', 'error');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleAssignCourier = async (courierId: string) => {
    try {
      await assignCourierInFirestore(order.id, courierId);
      showToast('Entregador vinculado ao pedido.', 'success');
    } catch (err: any) {
      console.error(err);
      showToast('Erro ao vincular entregador no Firestore.', 'error');
    }
  };

  // Enviar mensagem pelo WhatsApp usando os templates da loja
  const handleSendWhatsApp = (statusType: 'aceito' | 'preparo' | 'saiuEntrega' | 'prontoRetirada' | 'cancelado') => {
    let template = store.mensagensWhatsapp?.[statusType] || '';
    if (!template) {
      if (statusType === 'aceito') template = 'Olá {nome}! Seu pedido #{numero} foi aceito.';
      if (statusType === 'preparo') template = 'Olá {nome}! Seu pedido #{numero} está em preparo.';
      if (statusType === 'saiuEntrega') template = 'Olá {nome}! Seu pedido #{numero} saiu para entrega!';
      if (statusType === 'prontoRetirada') template = 'Olá {nome}! Seu pedido #{numero} está pronto para retirada!';
      if (statusType === 'cancelado') template = 'Olá {nome}. Seu pedido #{numero} foi cancelado.';
    }

    const message = template
      .replace('{nome}', order.cliente.nome)
      .replace('{numero}', order.numero.toString())
      .replace('{total}', formatCurrency(order.total))
      .replace('{tempo}', (order.tempoEstimadoMin || estimatedTime).toString());

    const url = generateWhatsAppUrl(order.cliente.telefone, message);
    window.open(url, '_blank');
  };

  const mapsUrl = order.endereco
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${order.endereco.rua}, ${order.endereco.numero}, ${order.endereco.bairro}`
      )}`
    : '';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <ThermalReceipt order={order} store={store} />
      <div
        className="bg-white w-full max-w-xl h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="p-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-neutral-900">PEDIDO #{order.numero}</h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                  order.status === 'novo'
                    ? 'bg-amber-100 text-amber-800'
                    : order.status === 'aceito'
                    ? 'bg-blue-100 text-blue-800'
                    : order.status === 'preparo'
                    ? 'bg-purple-100 text-purple-800'
                    : order.status === 'pronto'
                    ? 'bg-teal-100 text-teal-800'
                    : order.status === 'saiu_entrega'
                    ? 'bg-indigo-100 text-indigo-800'
                    : order.status === 'entregue'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {order.status === 'saiu_entrega'
                  ? 'Saiu p/ entrega'
                  : order.status === 'pronto'
                  ? 'Pronto p/ retirada'
                  : order.status}
              </span>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">Criado em: {formatDateTime(order.criadoEm)}</p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrint}
              className="p-2 hover:bg-neutral-200 text-neutral-700 rounded-xl transition-colors flex items-center gap-1 text-xs font-bold cursor-pointer"
              title="Imprimir comanda térmica (80mm)"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-neutral-200 text-neutral-500 rounded-xl transition-colors cursor-pointer"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Alerta de inconsistência se houver */}
        {!isTotalConsistent && (
          <div className="bg-rose-600 text-white p-3 text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>ALERTA DE SEGURANÇA: O total gravado no pedido diverge da soma dos itens!</span>
          </div>
        )}

        {/* Alerta de estorno de Pix se cancelado após confirmação */}
        {order.status === 'cancelado' && order.pagamento.status === 'confirmado' && (
          <div className="bg-amber-500 text-white p-3 text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>ATENÇÃO: Este pedido teve o Pix confirmado. Providencie o estorno do valor ao cliente!</span>
          </div>
        )}

        {/* Conteúdo Principal (Scroll) */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 divide-y divide-neutral-100">
          {/* Seção 1: Cliente e Endereço */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Cliente & Entrega</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-neutral-50 p-4 rounded-xl border border-neutral-200/70 text-sm">
              <div>
                <div className="flex items-center gap-1.5 text-neutral-500 text-xs mb-0.5">
                  <User className="w-3.5 h-3.5" />
                  <span>Nome do Cliente</span>
                </div>
                <p className="font-bold text-neutral-900">{order.cliente.nome}</p>
                <div className="flex items-center gap-1.5 text-neutral-600 text-xs mt-1">
                  <Phone className="w-3.5 h-3.5 text-neutral-400" />
                  <span>{order.cliente.telefone}</span>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1.5 text-neutral-500 text-xs mb-0.5">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Tipo de Pedido</span>
                </div>
                <p className="font-bold text-neutral-900 uppercase">
                  {order.tipo === 'entrega' ? '🛵 Entrega em Domicílio' : '🛍️ Retirada no Balcão'}
                </p>
                {order.tipo === 'entrega' && order.endereco && (
                  <p className="text-xs text-neutral-600 mt-1 leading-snug">
                    {order.endereco.rua}, Nº {order.endereco.numero} - {order.endereco.bairro}
                    {order.endereco.complemento && ` (${order.endereco.complemento})`}
                  </p>
                )}
              </div>
            </div>

            {order.tipo === 'entrega' && mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Abrir rota no Google Maps</span>
              </a>
            )}
          </div>

          {/* Seção 2: Itens do Pedido */}
          <div className="pt-5 space-y-3">
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
              Itens Solicitados ({order.itens.length})
            </h3>
            <div className="space-y-3">
              {order.itens.map((item, idx) => (
                <div key={idx} className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/60 text-sm">
                  <div className="flex justify-between items-start">
                    <div className="flex gap-2">
                      <span className="w-6 h-6 rounded-md bg-neutral-900 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                        {item.qtd}x
                      </span>
                      <div>
                        <p className="font-bold text-neutral-900">{item.nome}</p>
                        {item.complementos && item.complementos.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {item.complementos.map((c, i) => (
                              <p key={i} className="text-xs text-neutral-600">
                                • {c.nome} {c.preco > 0 && `(+${formatCurrency(c.preco)})`}
                              </p>
                            ))}
                          </div>
                        )}
                        {item.obs && (
                          <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200/60 p-1.5 rounded-md mt-1.5 italic">
                            Observação: {item.obs}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="font-bold text-neutral-900">{formatCurrency(item.totalItem)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Seção 3: Pagamento e Totais */}
          <div className="pt-5 space-y-3">
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Pagamento & Totais</h3>
            <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200/70 space-y-2 text-sm">
              <div className="flex justify-between text-neutral-600">
                <span>Subtotal:</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              {order.desconto > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Desconto ({order.cupom || 'Cupom'}):</span>
                  <span>-{formatCurrency(order.desconto)}</span>
                </div>
              )}
              {order.tipo === 'entrega' && (
                <div className="flex justify-between text-neutral-600">
                  <span>Taxa de Entrega ({order.endereco?.bairro || 'Bairro'}):</span>
                  <span>{formatCurrency(order.taxaEntrega || 0)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-neutral-900 pt-2 border-t border-neutral-200">
                <span>Total do Pedido:</span>
                <span>{formatCurrency(order.total)}</span>
              </div>

              {/* Detalhe do Pagamento */}
              <div className="mt-3 pt-3 border-t border-neutral-200 flex items-center justify-between">
                <div>
                  <span className="text-xs text-neutral-500 block">Forma de Pagamento:</span>
                  <span className="font-bold text-sm text-neutral-900 uppercase">
                    {order.pagamento.forma === 'pix'
                      ? '⚡ Pix'
                      : order.pagamento.forma === 'dinheiro'
                      ? '💵 Dinheiro'
                      : order.pagamento.forma === 'cartao_entrega'
                      ? '💳 Cartão na Entrega'
                      : '💬 Combinar no WhatsApp'}
                  </span>
                  {order.pagamento.forma === 'dinheiro' && order.pagamento.troco && (
                    <span className="block text-xs text-neutral-600 mt-0.5">
                      Troco para: {formatCurrency(order.pagamento.troco)} (Troco a levar:{' '}
                      {formatCurrency(order.pagamento.troco - order.total)})
                    </span>
                  )}
                </div>

                {/* Botões de Ação de Pagamento */}
                <div>
                  {order.pagamento.forma === 'pix' && order.pagamento.status !== 'confirmado' && (
                    <button
                      onClick={handleConfirmPix}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Confirmar Pagamento Pix</span>
                    </button>
                  )}
                  {order.pagamento.status === 'confirmado' && (
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Pago / Confirmado
                    </span>
                  )}
                  {(order.pagamento.forma === 'dinheiro' || order.pagamento.forma === 'cartao_entrega') &&
                    order.pagamento.status !== 'confirmado' && (
                      <button
                        onClick={handleMarkPaymentReceived}
                        className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                      >
                        Marcar como Recebido
                      </button>
                    )}
                </div>
              </div>
            </div>
          </div>

          {/* Seção 4: Atribuição de Entregador */}
          {order.tipo === 'entrega' && (
            <div className="pt-5 space-y-2">
              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                Entregador Responsável
              </h3>
              <div className="flex items-center gap-3">
                <select
                  value={order.entregadorId || ''}
                  onChange={(e) => handleAssignCourier(e.target.value)}
                  className="flex-1 p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium focus:ring-1 focus:ring-neutral-900"
                >
                  <option value="">-- Selecione o entregador --</option>
                  {couriers
                    .filter((c) => c.ativo)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome} ({c.telefone}) - Taxa: {formatCurrency(c.taxaEntrega)}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          )}

          {/* Seção 5: Avisos do WhatsApp com Modelos */}
          <div className="pt-5 space-y-2">
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
              Notificar Cliente no WhatsApp
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleSendWhatsApp('aceito')}
                className="p-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>Pedido Aceito</span>
              </button>
              <button
                onClick={() => handleSendWhatsApp('preparo')}
                className="p-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>Em Preparo</span>
              </button>
              {order.tipo === 'entrega' ? (
                <button
                  onClick={() => handleSendWhatsApp('saiuEntrega')}
                  className="p-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Saiu p/ Entrega</span>
                </button>
              ) : (
                <button
                  onClick={() => handleSendWhatsApp('prontoRetirada')}
                  className="p-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Pronto p/ Retirada</span>
                </button>
              )}
              <button
                onClick={() => handleSendWhatsApp('cancelado')}
                className="p-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <MessageCircle className="w-3.5 h-3.5 text-rose-600" />
                <span>Cancelamento</span>
              </button>
            </div>
          </div>

          {/* Seção 6: Histórico de Status */}
          <div className="pt-5 space-y-2">
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Histórico de Alterações</h3>
            <div className="space-y-2 pl-2 border-l-2 border-neutral-200 text-xs">
              {order.historicoStatus?.map((h, i) => (
                <div key={i} className="relative pl-3">
                  <div className="absolute -left-[11px] top-1.5 w-2 h-2 rounded-full bg-neutral-400" />
                  <p className="font-bold text-neutral-800 uppercase">{h.status}</p>
                  <p className="text-neutral-500 text-[11px]">{formatDateTime(h.em)}</p>
                  {h.nota && <p className="text-neutral-600 italic mt-0.5">{h.nota}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Rodapé com Fluxo de Ações do Kanban */}
        <div className="p-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between gap-3">
          {order.status !== 'cancelado' && order.status !== 'entregue' ? (
            <>
              <button
                onClick={() => setCancelModalOpen(true)}
                className="px-3.5 py-2.5 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Recusar / Cancelar
              </button>

              <div className="flex items-center gap-2">
                {order.status === 'novo' && (
                  <button
                    onClick={() => handleStatusChange('aceito')}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Aceitar Pedido</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
                {order.status === 'aceito' && (
                  <button
                    onClick={() => handleStatusChange('preparo')}
                    className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Iniciar Preparo</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
                {order.status === 'preparo' && (
                  <button
                    onClick={() => handleStatusChange(order.tipo === 'entrega' ? 'saiu_entrega' : 'pronto')}
                    className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>{order.tipo === 'entrega' ? 'Enviar para Entrega' : 'Pronto para Retirada'}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
                {(order.status === 'saiu_entrega' || order.status === 'pronto') && (
                  <button
                    onClick={() => handleStatusChange('entregue')}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Concluir / Entregue</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="text-xs text-neutral-500 font-medium">Este pedido está concluído ou finalizado.</div>
          )}
        </div>
      </div>

      {/* Modal de Cancelamento com Motivo Obrigatório */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <form
            onSubmit={handleCancelOrder}
            className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl"
          >
            <h3 className="font-bold text-base text-neutral-900">Motivo do Cancelamento</h3>
            <p className="text-xs text-neutral-500">
              Informe o motivo para registro e explicação ao cliente:
            </p>
            <textarea
              required
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Ex: Produto esgotado, endereço fora de área, cliente solicitou..."
              rows={3}
              className="w-full text-xs p-3 border border-neutral-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelModalOpen(false)}
                className="px-3 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-100 rounded-lg cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors cursor-pointer"
              >
                Confirmar Cancelamento
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
