import React from 'react';
import ReactDOM from 'react-dom';
import { Order, Store } from '../types';
import { formatCurrency, formatDateTime } from '../lib/formatters';

interface ComandaProps {
  order: Order;
  store: Store;
}

export const ComandaConteudo: React.FC<ComandaProps> = ({ order, store }) => {
  return (
    <div className="text-black bg-white text-xs font-mono p-2 leading-tight">
      {/* Cabeçalho do Estabelecimento */}
      <div className="text-center pb-2 border-b border-dashed border-black">
        <h2 className="font-bold text-sm uppercase tracking-wider">{store.nome}</h2>
        {store.endereco && <p className="text-[11px] leading-tight">{store.endereco}</p>}
        {store.whatsapp && <p className="text-[11px]">WhatsApp: {store.whatsapp}</p>}
      </div>

      {/* Identificação do Pedido */}
      <div className="py-2 border-b border-dashed border-black">
        <div className="flex justify-between items-baseline font-bold text-sm">
          <span>PEDIDO #{order.numero}</span>
          <span className="uppercase">{order.tipo === 'entrega' ? '🛵 ENTREGA' : '🛍️ RETIRADA'}</span>
        </div>
        <p className="text-[11px] text-neutral-800">Data: {formatDateTime(order.criadoEm)}</p>
      </div>

      {/* Dados do Cliente e Endereço */}
      <div className="py-2 border-b border-dashed border-black leading-tight">
        <p className="font-bold">CLIENTE: {order.cliente.nome}</p>
        <p>TEL: {order.cliente.telefone}</p>
        {order.tipo === 'entrega' && order.endereco && (
          <div className="mt-1 pt-1 border-t border-dotted border-black">
            <p className="font-bold">ENDEREÇO DE ENTREGA:</p>
            <p>{order.endereco.rua}, Nº {order.endereco.numero}</p>
            <p>Bairro: {order.endereco.bairro}</p>
            {order.endereco.complemento && <p>Compl: {order.endereco.complemento}</p>}
            {order.endereco.referencia && <p className="italic">Ref: {order.endereco.referencia}</p>}
          </div>
        )}
      </div>

      {/* Itens do Pedido */}
      <div className="py-2 border-b border-dashed border-black">
        <p className="font-bold pb-1 text-center">--- ITENS DO PEDIDO ---</p>
        <div className="space-y-1.5">
          {order.itens.map((item, idx) => (
            <div key={idx} className="leading-tight">
              <div className="flex justify-between font-bold">
                <span>{item.qtd}x {item.nome}</span>
                <span>{formatCurrency(item.totalItem)}</span>
              </div>
              {item.complementos && item.complementos.length > 0 && (
                <div className="pl-2 text-[11px] space-y-0.5">
                  {item.complementos.map((comp, cIdx) => (
                    <div key={cIdx} className="flex justify-between">
                      <span>+ {comp.nome}</span>
                      {comp.preco > 0 && <span>{formatCurrency(comp.preco)}</span>}
                    </div>
                  ))}
                </div>
              )}
              {item.obs && (
                <p className="pl-2 italic text-[11px]">OBS: {item.obs}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Resumo Financeiro */}
      <div className="py-2 border-b border-dashed border-black space-y-1">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>{formatCurrency(order.subtotal)}</span>
        </div>
        {order.desconto > 0 && (
          <div className="flex justify-between font-bold">
            <span>Desconto ({order.cupom || 'Cupom'}):</span>
            <span>-{formatCurrency(order.desconto)}</span>
          </div>
        )}
        {order.tipo === 'entrega' && (
          <div className="flex justify-between">
            <span>Taxa de Entrega:</span>
            <span>{formatCurrency(order.taxaEntrega)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-sm pt-1 border-t border-black">
          <span>TOTAL:</span>
          <span>{formatCurrency(order.total)}</span>
        </div>
      </div>

      {/* Forma de Pagamento */}
      <div className="py-2 border-b border-dashed border-black leading-tight">
        <div className="flex justify-between font-bold">
          <span>PAGAMENTO:</span>
          <span className="uppercase">
            {order.pagamento.forma === 'pix'
              ? 'PIX'
              : order.pagamento.forma === 'dinheiro'
              ? 'DINHEIRO'
              : order.pagamento.forma === 'cartao_entrega'
              ? 'CARTÃO NA ENTREGA'
              : 'WHATSAPP'}
          </span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span>Status do Pagamento:</span>
          <span className="font-bold uppercase">
            {order.pagamento.status === 'confirmado'
              ? 'PAGO'
              : order.pagamento.status === 'informado'
              ? 'INFORMADO'
              : order.pagamento.status === 'na_entrega'
              ? 'NA ENTREGA'
              : 'PENDENTE'}
          </span>
        </div>
        {order.pagamento.forma === 'dinheiro' && order.pagamento.troco && order.pagamento.troco > order.total && (
          <div className="mt-1 pt-1 border-t border-dotted border-black font-bold">
            <p>TROCO PARA: {formatCurrency(order.pagamento.troco)}</p>
            <p>VALOR DO TROCO: {formatCurrency(order.pagamento.troco - order.total)}</p>
          </div>
        )}
      </div>

      {/* Rodapé */}
      <div className="pt-2 text-center text-[10px] text-neutral-600">
        <p>Agradecemos a preferência!</p>
        <p className="mt-1">Pede AI • Delivery</p>
      </div>
    </div>
  );
};

export const ComandaImpressao: React.FC<ComandaProps> = ({ order, store }) => {
  let printArea = document.getElementById('area-impressao');
  if (!printArea) {
    printArea = document.createElement('div');
    printArea.id = 'area-impressao';
    document.body.appendChild(printArea);
  }

  return ReactDOM.createPortal(<ComandaConteudo order={order} store={store} />, printArea);
};
