import { Order, Store } from '../types';
import { formatCurrency, formatDateTime } from './formatters';

// Set global de IDs de pedidos já impressos automaticamente para evitar disparos duplicados
const impressoAutoSet = new Set<string>();

// Fila serial de impressão (Promises em cadeia) para evitar que múltiplos iframes se atropelem
let filaImpressao: Promise<void> = Promise.resolve();

function enfileirarImpressao(task: () => Promise<void>): Promise<void> {
  filaImpressao = filaImpressao
    .then(() => task())
    .catch((err) => {
      console.error('[Impressão] Erro na fila de impressão:', err);
    });
  return filaImpressao;
}

export function imprimirTicket(html: string, largura: '80mm' | '58mm' = '80mm'): Promise<void> {
  return enfileirarImpressao(() => {
    return new Promise<void>((resolve) => {
      const iframeId = `iframe-print-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

      const iframe = document.createElement('iframe');
      iframe.id = iframeId;
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);

      const win = iframe.contentWindow;
      if (!win) {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        resolve();
        return;
      }

      const doc = win.document;
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Comanda - Delivery</title>
          <style>
            @page {
              size: ${largura} auto;
              margin: 0;
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            html, body {
              width: ${largura};
              font-family: 'Courier New', Courier, monospace;
              font-size: ${largura === '58mm' ? '10px' : '12px'};
              line-height: 1.35;
              padding: 3mm 2mm;
              color: #000000;
              background: #ffffff;
            }
            .titulo {
              font-size: 16px;
              font-weight: bold;
              text-align: center;
              margin-bottom: 2mm;
              text-transform: uppercase;
            }
            .subtitulo {
              font-size: 12px;
              font-weight: bold;
              text-align: center;
              margin-bottom: 1mm;
            }
            .linha {
              border-top: 1px dashed #000000;
              margin: 2mm 0;
            }
            .destaque {
              font-size: 14px;
              font-weight: bold;
            }
            .bairro {
              font-size: 15px;
              font-weight: bold;
              text-decoration: underline;
              text-transform: uppercase;
              margin-top: 1mm;
            }
            .item-linha {
              display: flex;
              justify-content: space-between;
              margin-bottom: 1mm;
            }
            .item-qtd-nome {
              font-weight: bold;
            }
            .item-sub {
              padding-left: 3mm;
              font-size: 10px;
            }
            .obs {
              font-weight: bold;
              background: #f0f0f0;
              padding: 1mm;
              margin-top: 1mm;
              border: 1px solid #cccccc;
            }
            .total {
              font-size: 18px;
              font-weight: bold;
              text-align: center;
              margin-top: 2mm;
            }
            .centralizado {
              text-align: center;
            }
            .direita {
              text-align: right;
            }
            .negrito {
              font-weight: bold;
            }
          </style>
        </head>
        <body>${html}</body>
        </html>
      `);
      doc.close();

      let finalizado = false;
      const finalizarELimpar = () => {
        if (finalizado) return;
        finalizado = true;
        setTimeout(() => {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
          resolve();
        }, 800); // Intervalo seguro de 800ms antes do próximo ticket
      };

      const executarImpressao = () => {
        try {
          win.focus();
          win.onafterprint = () => {
            finalizarELimpar();
          };
          win.print();
          // Fallback caso onafterprint não seja disparado
          setTimeout(finalizarELimpar, 1200);
        } catch (err) {
          console.error('[Impressão] Erro ao disparar print:', err);
          finalizarELimpar();
        }
      };

      // Dispara a impressão após renderização completa do iframe
      setTimeout(executarImpressao, 350);
    });
  });
}

export function gerarHtmlCozinha(order: Order, store: Store): string {
  const dataHora = formatDateTime(order.criadoEm);

  let itensHtml = '';
  order.itens.forEach((it) => {
    itensHtml += `
      <div style="margin-bottom: 2mm;">
        <div class="item-linha">
          <span class="item-qtd-nome">${it.qtd}x ${it.nome}</span>
        </div>
    `;

    if (it.complementos && it.complementos.length > 0) {
      it.complementos.forEach((opt) => {
        itensHtml += `<div class="item-sub">• ${opt.nome} (${opt.grupoNome})</div>`;
      });
    }

    if (it.obs && it.obs.trim()) {
      itensHtml += `<div class="obs">OBS ITEM: ${it.obs.toUpperCase()}</div>`;
    }

    itensHtml += `</div>`;
  });

  const obsTexto = order.observacoes || order.observacao;
  let obsPedidoHtml = '';
  if (obsTexto && obsTexto.trim()) {
    obsPedidoHtml = `
      <div class="linha"></div>
      <div class="obs">OBS PEDIDO: ${obsTexto.toUpperCase()}</div>
    `;
  }

  return `
    <div class="titulo">*** COZINHA ***</div>
    <div class="subtitulo">${store.nome || 'Igarapé Burger'}</div>
    <div class="centralizado negrito" style="font-size: 15px; margin-top: 1mm;">PEDIDO #${order.numero}</div>
    <div class="centralizado" style="font-size: 11px;">Data/Hora: ${dataHora}</div>
    <div class="linha"></div>
    <div class="destaque centralizado">TIPO: ${order.tipo === 'entrega' ? '🛵 ENTREGA' : '🛍️ RETIRADA'}</div>
    <div class="linha"></div>
    <div class="negrito" style="margin-bottom: 2mm;">ITENS DO PEDIDO:</div>
    ${itensHtml}
    ${obsPedidoHtml}
    <div class="linha"></div>
    <div class="centralizado" style="font-size: 10px; margin-top: 2mm;">--- FIM TICKET COZINHA ---</div>
  `;
}

export function gerarHtmlEntrega(order: Order, store: Store): string {
  const dataHora = formatDateTime(order.criadoEm);

  let clienteHtml = `
    <div class="negrito">CLIENTE: ${order.cliente.nome.toUpperCase()}</div>
    <div class="negrito">TEL/WHATS: ${order.cliente.telefone}</div>
  `;

  if (order.tipo === 'entrega' && order.endereco) {
    const end = order.endereco;
    clienteHtml += `
      <div style="margin-top: 1mm;">
        <div>ENDEREÇO: ${end.rua}, Nº ${end.numero}</div>
        ${end.complemento ? `<div>COMP: ${end.complemento}</div>` : ''}
        <div class="bairro">BAIRRO: ${end.bairro.toUpperCase()}</div>
        ${end.referencia ? `<div>REF: ${end.referencia}</div>` : ''}
      </div>
    `;
  } else {
    clienteHtml += `<div class="destaque" style="margin-top: 1mm;">RETIRADA NO BALCÃO</div>`;
  }

  let itensHtml = '';
  order.itens.forEach((it) => {
    itensHtml += `
      <div style="margin-bottom: 1.5mm;">
        <div class="item-linha">
          <span class="item-qtd-nome">${it.qtd}x ${it.nome}</span>
          <span>${formatCurrency(it.totalItem)}</span>
        </div>
    `;

    if (it.complementos && it.complementos.length > 0) {
      it.complementos.forEach((opt) => {
        itensHtml += `<div class="item-sub">• ${opt.nome}</div>`;
      });
    }

    if (it.obs && it.obs.trim()) {
      itensHtml += `<div class="obs">Obs: ${it.obs}</div>`;
    }

    itensHtml += `</div>`;
  });

  const trocoVal = order.pagamento.trocoPara || order.pagamento.troco;
  let pagamentoTexto = order.pagamento.forma.toUpperCase();
  if (order.pagamento.forma === 'dinheiro') {
    pagamentoTexto = `DINHEIRO`;
    if (trocoVal && trocoVal > 0) {
      const trocoDevolver = Math.max(0, trocoVal - order.total);
      pagamentoTexto += `<br/>• Troco para: ${formatCurrency(trocoVal)}<br/>• Levar de Troco: ${formatCurrency(trocoDevolver)}`;
    } else {
      pagamentoTexto += ` (Sem troco / Valor exato)`;
    }
  } else if (order.pagamento.forma === 'pix') {
    const st = order.pagamento.status === 'confirmado' ? 'PAGO (Confirmado)' : 'AGUARDANDO PAGAMENTO';
    pagamentoTexto = `PIX — ${st}`;
  } else if (order.pagamento.forma === 'cartao_entrega') {
    pagamentoTexto = `CARTÃO NA ENTREGA`;
  }

  return `
    <div class="titulo">*** ${order.tipo === 'entrega' ? 'ENTREGA' : 'RETIRADA'} ***</div>
    <div class="subtitulo">${store.nome || 'Igarapé Burger'}</div>
    <div class="centralizado negrito" style="font-size: 15px; margin-top: 1mm;">PEDIDO #${order.numero}</div>
    <div class="centralizado" style="font-size: 11px;">Data/Hora: ${dataHora}</div>
    <div class="linha"></div>
    ${clienteHtml}
    <div class="linha"></div>
    <div class="negrito" style="margin-bottom: 1.5mm;">RESUMO DOS ITENS:</div>
    ${itensHtml}
    <div class="linha"></div>
    <div class="item-linha">
      <span>Subtotal:</span>
      <span>${formatCurrency(order.subtotal)}</span>
    </div>
    ${order.taxaEntrega ? `<div class="item-linha"><span>Taxa Entrega:</span><span>${formatCurrency(order.taxaEntrega)}</span></div>` : ''}
    ${order.desconto ? `<div class="item-linha"><span>Desconto:</span><span>-${formatCurrency(order.desconto)}</span></div>` : ''}
    <div class="linha"></div>
    <div class="total">TOTAL: ${formatCurrency(order.total)}</div>
    <div class="linha"></div>
    <div class="destaque" style="margin-top: 1mm;">
      <div>PAGAMENTO:</div>
      <div style="font-size: 12px; margin-top: 1mm;">${pagamentoTexto}</div>
    </div>
    <div class="linha"></div>
    <div class="centralizado" style="font-size: 10px; margin-top: 2mm;">--- FIM TICKET ENTREGA ---</div>
  `;
}

export async function imprimirTicketCozinha(order: Order, store: Store): Promise<void> {
  const largura = store.larguraImpressora || '80mm';
  const html = gerarHtmlCozinha(order, store);
  await imprimirTicket(html, largura);
}

export async function imprimirTicketEntrega(order: Order, store: Store): Promise<void> {
  const largura = store.larguraImpressora || '80mm';
  const html = gerarHtmlEntrega(order, store);
  await imprimirTicket(html, largura);
}

export async function dispararImpressaoSequencialAoAceitar(order: Order, store: Store): Promise<void> {
  if (store.imprimirAutoAoAceitar === false) {
    return;
  }

  // Idempotência rigorosa: trava por ID de pedido na memória e no documento Firestore
  if (impressoAutoSet.has(order.id) || order.impressoAutomaticamenteEm) {
    console.log(`[Impressão] Pedido #${order.numero} (ID: ${order.id}) já foi impresso automaticamente. Ignorando.`);
    return;
  }

  // Registra síncronamente no Set local antes de qualquer async para barrar novos cliques ou listeners
  impressoAutoSet.add(order.id);

  const largura = store.larguraImpressora || '80mm';

  // 1. PRIMEIRO: Imprime Ticket da COZINHA
  const htmlCozinha = gerarHtmlCozinha(order, store);
  await imprimirTicket(htmlCozinha, largura);

  // 2. SEGUNDO: Se for pedido de ENTREGA, imprime Ticket da ENTREGA (aguarda término da cozinha na fila)
  if (order.tipo === 'entrega') {
    const htmlEntrega = gerarHtmlEntrega(order, store);
    await imprimirTicket(htmlEntrega, largura);
  }
}

// Mantido por compatibilidade
export function dispararImpressaoIndividual(
  order: Order,
  store: Store,
  tipoTicket: 'cozinha' | 'entrega'
) {
  if (tipoTicket === 'cozinha') {
    imprimirTicketCozinha(order, store);
  } else {
    imprimirTicketEntrega(order, store);
  }
}
