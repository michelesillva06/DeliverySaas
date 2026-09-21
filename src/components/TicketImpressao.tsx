import React from 'react';
import ReactDOM from 'react-dom';
import { Order, Store } from '../types';
import { formatCurrency, formatDateTime } from '../lib/formatters';

interface TicketProps {
  order: Order;
  store: Store;
  tipoTicket: 'cozinha' | 'entrega';
}

export const TicketCozinhaConteudo: React.FC<{ order: Order; store: Store }> = ({ order, store }) => {
  return (
    <div className="text-black bg-white font-mono leading-tight">
      {/* Topo COZINHA */}
      <div className="text-center pb-2 mb-2 border-b-2 border-black">
        <h1 className="font-extrabold text-xl uppercase tracking-wider">*** COZINHA ***</h1>
        <h2 className="font-bold text-sm uppercase mt-0.5">{store.nome}</h2>
      </div>

      {/* Identificação Pedido */}
      <div className="pb-2 mb-2 border-b border-dashed border-black flex justify-between items-baseline">
        <span className="font-extrabold text-lg">PEDIDO #{order.numero}</span>
        <span className="font-bold text-xs">{formatDateTime(order.criadoEm)}</span>
      </div>

      {/* Tipo de Pedido em Destaque */}
      <div className="py-1 mb-2 text-center border-y-2 border-black font-extrabold text-base uppercase bg-black text-white print:bg-transparent print:text-black">
        {order.tipo === 'entrega' ? '🛵 ENTREGA' : '🛍️ RETIRADA'}
      </div>

      {/* Lista de Itens com Complementos e Observações */}
      <div className="py-1 border-b border-dashed border-black space-y-3">
        {order.itens.map((item, idx) => (
          <div key={idx} className="pb-2 border-b border-dotted border-black last:border-0 last:pb-0">
            <div className="font-extrabold text-base leading-snug">
              {item.qtd}x {item.nome}
            </div>
            {item.complementos && item.complementos.length > 0 && (
              <div className="pl-3 mt-1 space-y-0.5 text-xs font-bold">
                {item.complementos.map((comp, cIdx) => (
                  <div key={cIdx}>+ {comp.nome}</div>
                ))}
              </div>
            )}
            {item.obs && (
              <div className="mt-1 p-1 border border-black font-extrabold text-xs uppercase bg-neutral-100 print:bg-transparent">
                OBS: {item.obs}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Rodapé Cozinha */}
      <div className="pt-2 text-center text-[10px] font-bold uppercase">
        ----------------------------------
        <p>FIM DO PEDIDO DE PREPARO</p>
      </div>
    </div>
  );
};

export const TicketEntregaConteudo: React.FC<{ order: Order; store: Store }> = ({ order, store }) => {
  return (
    <div className="text-black bg-white font-mono leading-tight">
      {/* Topo ENTREGA / RETIRADA */}
      <div className="text-center pb-2 mb-2 border-b-2 border-black">
        <h1 className="font-extrabold text-xl uppercase tracking-wider">
          *** {order.tipo === 'entrega' ? 'ENTREGA' : 'RETIRADA'} ***
        </h1>
        <h2 className="font-bold text-sm uppercase mt-0.5">{store.nome}</h2>
        <p className="text-xs">Data: {formatDateTime(order.criadoEm)}</p>
      </div>

      {/* Número do Pedido */}
      <div className="pb-2 mb-2 border-b border-dashed border-black flex justify-between items-baseline font-extrabold text-base">
        <span>PEDIDO #{order.numero}</span>
      </div>

      {/* Dados do Cliente */}
      <div className="py-2 border-b border-dashed border-black space-y-1">
        <p className="font-bold text-sm">CLIENTE: {order.cliente.nome}</p>
        <p className="text-xs font-bold">TEL: {order.cliente.telefone}</p>

        {order.tipo === 'entrega' && order.endereco && (
          <div className="mt-2 p-1.5 border-2 border-black">
            <p className="font-extrabold text-xs uppercase border-b border-black pb-0.5 mb-1">
              ENDEREÇO DE ENTREGA:
            </p>
            <p className="font-bold text-xs">{order.endereco.rua}, Nº {order.endereco.numero}</p>
            <p className="font-extrabold text-sm uppercase mt-1 p-0.5 bg-black text-white print:bg-transparent print:text-black print:border-b-2 print:border-black">
              BAIRRO: {order.endereco.bairro}
            </p>
            {order.endereco.complemento && <p className="text-xs mt-0.5">Compl: {order.endereco.complemento}</p>}
            {order.endereco.referencia && <p className="text-xs italic font-bold">Ref: {order.endereco.referencia}</p>}
          </div>
        )}
      </div>

      {/* Lista Resumida de Itens */}
      <div className="py-2 border-b border-dashed border-black">
        <p className="font-bold text-xs pb-1">ITENS DO PEDIDO:</p>
        <div className="space-y-1 text-xs">
          {order.itens.map((item, idx) => (
            <div key={idx} className="flex justify-between font-bold">
              <span>{item.qtd}x {item.nome}</span>
              <span>{formatCurrency(item.totalItem)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Resumo Financeiro */}
      <div className="py-2 border-b border-dashed border-black space-y-1 text-xs">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>{formatCurrency(order.subtotal)}</span>
        </div>
        {order.desconto > 0 && (
          <div className="flex justify-between font-bold">
            <span>Desconto:</span>
            <span>-{formatCurrency(order.desconto)}</span>
          </div>
        )}
        {order.tipo === 'entrega' && (
          <div className="flex justify-between font-bold">
            <span>Taxa de Entrega:</span>
            <span>{formatCurrency(order.taxaEntrega)}</span>
          </div>
        )}
      </div>

      {/* Forma de Pagamento */}
      <div className="py-2 border-b-2 border-black space-y-1.5">
        <div className="font-extrabold text-sm flex justify-between items-center">
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

        {order.pagamento.forma === 'pix' && (
          <p className="font-bold text-xs uppercase">
            PIX — status: [{order.pagamento.status === 'confirmado' ? 'CONFIRMADO' : 'AGUARDANDO/PENDENTE'}]
          </p>
        )}

        {order.pagamento.forma === 'dinheiro' && order.pagamento.troco && order.pagamento.troco > order.total && (
          <div className="p-1 border border-black font-extrabold text-xs uppercase">
            <p>TROCO PARA: {formatCurrency(order.pagamento.troco)}</p>
            <p>VALOR DO TROCO: {formatCurrency(order.pagamento.troco - order.total)}</p>
          </div>
        )}
      </div>

      {/* Total a Cobrar */}
      <div className="py-3 text-center border-b-2 border-black">
        <p className="text-xs font-bold uppercase">TOTAL A COBRAR:</p>
        <p className="font-extrabold text-2xl">{formatCurrency(order.total)}</p>
      </div>

      {/* Rodapé */}
      <div className="pt-2 text-center text-[10px] font-bold">
        <p>Agradecemos a preferência!</p>
        <p>{store.nome}</p>
      </div>
    </div>
  );
};

export const TicketImpressaoPortal: React.FC<TicketProps> = ({ order, store, tipoTicket }) => {
  let printArea = document.getElementById('ticket-impressao');
  if (!printArea) {
    printArea = document.createElement('div');
    printArea.id = 'ticket-impressao';
    document.body.appendChild(printArea);
  }

  const largura = store.larguraImpressora || '80mm';
  printArea.setAttribute('data-largura', largura);
  document.body.setAttribute('data-printer', largura);

  return ReactDOM.createPortal(
    tipoTicket === 'cozinha' ? (
      <TicketCozinhaConteudo order={order} store={store} />
    ) : (
      <TicketEntregaConteudo order={order} store={store} />
    ),
    printArea
  );
};
