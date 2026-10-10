import { Order, Store } from '../types';
import { formatCurrency, formatDateTime } from '../lib/formatters';

export type PrintFormat = '80mm' | '58mm';
export type PrintTicketType = 'cozinha' | 'entrega' | 'completo' | 'teste';
export type ViasConfig = 'cozinha' | 'entrega' | 'ambas';

export interface PrintOptions {
  largura?: PrintFormat;
  copias?: number;
}

export interface PrintAgentConfig {
  enabled: boolean;
  endpointUrl?: string; // ex: http://localhost:9100/print ou ws://localhost:9100
  timeoutMs?: number;
}

// Set em memória para garantir idempotência contra múltiplos cliques ou eventos concorrentes
const impressoAutoSet = new Set<string>();

// Fila serial de impressão (Promises encadeadas)
let filaSerial: Promise<void> = Promise.resolve();

function enfileirarTarefa(tarefa: () => Promise<void>): Promise<void> {
  filaSerial = filaSerial
    .then(() => tarefa())
    .catch((err) => {
      console.error('[PrintService] Erro na execução da fila de impressão:', err);
    });
  return filaSerial;
}

/**
 * Utilitário de formatação de divisor de linha para bobina térmica
 */
function obterSeparador(largura: PrintFormat, char = '-'): string {
  const contagem = largura === '58mm' ? 32 : 44;
  return char.repeat(contagem);
}

/**
 * CSS Base Embutido no documento de impressão térmica
 */
function obterEstilosCssTermico(largura: PrintFormat): string {
  const is58mm = largura === '58mm';
  return `
    @page {
      size: ${largura} auto;
      margin: 0;
    }
    *, *::before, *::after {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      width: ${largura};
      max-width: ${largura};
      margin: 0 auto;
      padding: ${is58mm ? '2mm 1.5mm' : '3mm 2mm'};
      background: #ffffff;
      color: #000000;
      font-family: 'Courier New', Courier, 'Lucida Console', Monaco, monospace;
      font-size: ${is58mm ? '10px' : '12px'};
      line-height: 1.35;
      font-weight: 500;
      word-break: break-word;
      overflow-wrap: break-word;
    }
    .titulo-principal {
      font-size: ${is58mm ? '14px' : '16px'};
      font-weight: 800;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 1mm;
    }
    .subtitulo {
      font-size: ${is58mm ? '11px' : '12px'};
      font-weight: 700;
      text-align: center;
      margin-bottom: 1mm;
    }
    .pedido-badge {
      font-size: ${is58mm ? '16px' : '20px'};
      font-weight: 900;
      text-align: center;
      padding: 1mm 0;
      margin: 1.5mm 0;
      border-top: 2px solid #000000;
      border-bottom: 2px solid #000000;
    }
    .tipo-badge {
      font-size: ${is58mm ? '13px' : '15px'};
      font-weight: 900;
      text-align: center;
      padding: 1mm;
      margin: 1mm 0;
      border: 1px dashed #000000;
      text-transform: uppercase;
    }
    .divisor {
      border-top: 1px dashed #000000;
      margin: 2mm 0;
      clear: both;
    }
    .divisor-duplo {
      border-top: 2px solid #000000;
      margin: 2.5mm 0;
      clear: both;
    }
    .linha-flex {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1mm;
    }
    .texto-esq { text-align: left; }
    .texto-centro { text-align: center; }
    .texto-dir { text-align: right; }
    .negrito { font-weight: 800; }
    .item-nome {
      font-weight: 800;
      font-size: ${is58mm ? '11px' : '13px'};
      line-height: 1.25;
    }
    .item-qtd {
      font-weight: 900;
      font-size: ${is58mm ? '12px' : '14px'};
      margin-right: 1.5mm;
    }
    .sub-item {
      padding-left: ${is58mm ? '2.5mm' : '3.5mm'};
      font-size: ${is58mm ? '9.5px' : '11px'};
      margin-top: 0.5mm;
      color: #000000;
    }
    .caixa-obs {
      margin-top: 1mm;
      padding: 1.5mm;
      border: 1.5px solid #000000;
      font-weight: 800;
      font-size: ${is58mm ? '10px' : '11.5px'};
      background: #f8f8f8;
      text-transform: uppercase;
    }
    .total-caixa {
      font-size: ${is58mm ? '16px' : '19px'};
      font-weight: 900;
      text-align: center;
      padding: 2mm 0;
      border-top: 2px solid #000000;
      border-bottom: 2px solid #000000;
      margin: 2.5mm 0;
    }
    .bairro-destaque {
      font-size: ${is58mm ? '13px' : '15px'};
      font-weight: 900;
      text-transform: uppercase;
      text-decoration: underline;
      margin-top: 1mm;
    }
    .rodape-corte {
      text-align: center;
      font-size: ${is58mm ? '9px' : '10px'};
      margin-top: 3mm;
      padding-bottom: 12mm; /* Espaço para avanço e corte na guilhotina térmica */
    }
  `;
}

/**
 * MODELO 1: Comanda da Cozinha
 * Exibe apenas informações essenciais para a preparação:
 * - Número do pedido, horário e tipo (Entrega/Retirada)
 * - Nome do cliente para separação
 * - Produtos, quantidades em destaque, complementos
 * - Observações de cada item e observação geral do pedido
 * ZERO valores financeiros ou dados desnecessários para a cozinha.
 */
export function gerarHtmlCozinha(order: Order, store: Partial<Store>, largura: PrintFormat = '80mm'): string {
  const dataHora = formatDateTime(order.criadoEm);
  const tipoLabel = order.tipo === 'entrega' ? '🛵 ENTREGA' : '🛍️ RETIRADA NO BALCÃO';

  let itensHtml = '';
  order.itens.forEach((it) => {
    itensHtml += `
      <div style="margin-bottom: 2.5mm;">
        <div class="linha-flex">
          <div class="item-nome">
            <span class="item-qtd">[ ${it.qtd}x ]</span>
            <span>${it.nome.toUpperCase()}</span>
          </div>
        </div>
    `;

    if (it.complementos && it.complementos.length > 0) {
      it.complementos.forEach((opt) => {
        itensHtml += `
          <div class="sub-item">
            + ${opt.qtd && opt.qtd > 1 ? `${opt.qtd}x ` : ''}${opt.nome} ${opt.grupoNome ? `(${opt.grupoNome})` : ''}
          </div>
        `;
      });
    }

    if (it.obs && it.obs.trim()) {
      itensHtml += `
        <div class="caixa-obs">
          ⚠️ OBS ITEM: ${it.obs.toUpperCase()}
        </div>
      `;
    }

    itensHtml += `</div>`;
  });

  const obsGeral = (order.observacoes || order.observacao || '').trim();
  let obsGeralHtml = '';
  if (obsGeral) {
    obsGeralHtml = `
      <div class="divisor"></div>
      <div class="caixa-obs" style="font-size: 12px; padding: 2mm;">
        🔔 OBSERVAÇÃO GERAL DO PEDIDO:<br/>
        ${obsGeral.toUpperCase()}
      </div>
    `;
  }

  return `
    <div class="titulo-principal">*** COMANDA COZINHA ***</div>
    <div class="subtitulo">${store.nome || 'DeliverySaas'}</div>
    
    <div class="pedido-badge">PEDIDO #${order.numero}</div>
    
    <div class="tipo-badge">${tipoLabel}</div>
    
    <div class="linha-flex" style="font-size: 11px; margin-top: 1mm;">
      <span><strong>Data:</strong> ${dataHora}</span>
    </div>
    <div style="font-size: 11px; margin-bottom: 1.5mm;">
      <strong>Cliente:</strong> ${order.cliente.nome.toUpperCase()}
    </div>
    
    <div class="divisor"></div>
    <div class="negrito" style="margin-bottom: 2mm; font-size: 12px; text-transform: uppercase;">
      ITENS PARA PREPARO:
    </div>
    
    ${itensHtml}
    ${obsGeralHtml}
    
    <div class="divisor-duplo"></div>
    <div class="rodape-corte">
      <div>--- FIM DA COMANDA DE PRODUÇÃO ---</div>
      <div style="margin-top: 1mm;">Impresso via Sistema Delivery</div>
    </div>
  `;
}

/**
 * MODELO 2: Cupom de Entrega / Conferência
 * Exibe todos os dados para entrega, motorista/motoboy e conferência do cliente:
 * - Cabeçalho completo da loja (nome, telefone, endereço)
 * - Número do pedido, data e hora
 * - Cliente, telefone de contato
 * - Endereço completo com bairro em destaque, complemento e ponto de referência
 * - Resumo dos itens com valores unitários/subtotais
 * - Financeiro: Subtotal, taxa de entrega, descontos e TOTAL EM DESTAQUE
 * - Forma de pagamento, status e detalhe de troco
 */
export function gerarHtmlEntrega(order: Order, store: Partial<Store>, largura: PrintFormat = '80mm'): string {
  const dataHora = formatDateTime(order.criadoEm);
  const tipoLabel = order.tipo === 'entrega' ? '🛵 ENTREGA' : '🛍️ RETIRADA NO BALCÃO';

  // Cabeçalho da loja
  const telLoja = store.whatsapp || '';
  const endLoja = store.endereco || '';

  // Cliente e Endereço
  let clienteHtml = `
    <div class="negrito">CLIENTE: ${order.cliente.nome.toUpperCase()}</div>
    <div>TEL / WHATS: <strong>${order.cliente.telefone}</strong></div>
  `;

  if (order.tipo === 'entrega' && order.endereco) {
    const end = order.endereco;
    clienteHtml += `
      <div style="margin-top: 1.5mm;">
        <div><strong>ENDEREÇO:</strong> ${end.rua}, Nº ${end.numero}</div>
        ${end.complemento ? `<div>COMPLEMENTO: ${end.complemento}</div>` : ''}
        <div class="bairro-destaque">BAIRRO: ${end.bairro.toUpperCase()}</div>
        ${end.referencia ? `<div>REF: <em>${end.referencia}</em></div>` : ''}
      </div>
    `;
  } else {
    clienteHtml += `
      <div class="tipo-badge" style="margin-top: 1.5mm;">
        >>> RETIRADA NO BALCÃO <<<
      </div>
    `;
  }

  // Itens
  let itensHtml = '';
  order.itens.forEach((it) => {
    itensHtml += `
      <div style="margin-bottom: 2mm;">
        <div class="linha-flex">
          <span class="item-nome">
            <span class="item-qtd">${it.qtd}x</span> ${it.nome}
          </span>
          <span class="negrito">${formatCurrency(it.totalItem)}</span>
        </div>
    `;

    if (it.complementos && it.complementos.length > 0) {
      it.complementos.forEach((opt) => {
        itensHtml += `
          <div class="linha-flex sub-item">
            <span>+ ${opt.qtd && opt.qtd > 1 ? `${opt.qtd}x ` : ''}${opt.nome}</span>
            <span>${opt.preco > 0 ? formatCurrency(opt.preco * (opt.qtd || 1)) : ''}</span>
          </div>
        `;
      });
    }

    if (it.obs && it.obs.trim()) {
      itensHtml += `<div class="sub-item" style="font-style: italic;">Obs: ${it.obs}</div>`;
    }

    itensHtml += `</div>`;
  });

  // Forma de Pagamento e Troco
  const trocoVal = order.pagamento.trocoPara || order.pagamento.troco;
  let pagamentoDetalhe = '';

  if (order.pagamento.forma === 'dinheiro') {
    pagamentoDetalhe = `<div class="negrito">FORMA: DINHEIRO</div>`;
    if (trocoVal && trocoVal > order.total) {
      const trocoDevolver = trocoVal - order.total;
      pagamentoDetalhe += `
        <div>Troco para: <strong>${formatCurrency(trocoVal)}</strong></div>
        <div class="negrito" style="font-size: 12px; margin-top: 0.5mm;">
          LEVAR DE TROCO: ${formatCurrency(trocoDevolver)}
        </div>
      `;
    } else {
      pagamentoDetalhe += `<div>(Sem troco / Valor exato)</div>`;
    }
  } else if (order.pagamento.forma === 'pix') {
    const isPago = order.pagamento.status === 'confirmado';
    pagamentoDetalhe = `
      <div class="negrito">FORMA: PIX</div>
      <div style="font-size: 11px;">Status: <strong>${isPago ? '✅ PAGO (CONFIRMADO)' : '⏳ AGUARDANDO PAGAMENTO'}</strong></div>
    `;
  } else if (order.pagamento.forma === 'cartao_entrega') {
    pagamentoDetalhe = `
      <div class="negrito">FORMA: CARTÃO NA ENTREGA</div>
      <div style="font-size: 11px;">⚠️ Levar maquininha de cartão</div>
    `;
  } else {
    pagamentoDetalhe = `<div class="negrito">FORMA: COMBINAR VIA WHATSAPP</div>`;
  }

  return `
    <div class="titulo-principal">${store.nome || 'DeliverySaas'}</div>
    ${telLoja ? `<div class="subtitulo">Tel: ${telLoja}</div>` : ''}
    ${endLoja ? `<div class="texto-centro" style="font-size: 10px; margin-bottom: 1mm;">${endLoja}</div>` : ''}
    
    <div class="divisor"></div>
    <div class="texto-centro negrito" style="font-size: 11px; text-transform: uppercase;">
      CUPOM DE ENTREGA / CONFERÊNCIA
    </div>
    <div class="pedido-badge">PEDIDO #${order.numero}</div>
    <div class="tipo-badge">${tipoLabel}</div>
    <div class="texto-centro" style="font-size: 11px; margin-bottom: 1.5mm;">
      Data/Hora: ${dataHora}
    </div>
    
    <div class="divisor"></div>
    ${clienteHtml}
    
    <div class="divisor"></div>
    <div class="negrito" style="margin-bottom: 1.5mm; font-size: 11.5px;">RESUMO DOS PRODUTOS:</div>
    ${itensHtml}
    
    <div class="divisor"></div>
    <div class="linha-flex">
      <span>Subtotal:</span>
      <span class="negrito">${formatCurrency(order.subtotal)}</span>
    </div>
    ${order.taxaEntrega ? `
      <div class="linha-flex">
        <span>Taxa de Entrega:</span>
        <span class="negrito">${formatCurrency(order.taxaEntrega)}</span>
      </div>
    ` : ''}
    ${order.desconto ? `
      <div class="linha-flex">
        <span>Desconto ${order.cupom ? `(${order.cupom})` : ''}:</span>
        <span class="negrito">-${formatCurrency(order.desconto)}</span>
      </div>
    ` : ''}
    
    <div class="total-caixa">
      TOTAL: ${formatCurrency(order.total)}
    </div>
    
    <div style="margin-top: 1.5mm;">
      ${pagamentoDetalhe}
    </div>
    
    <div class="divisor-duplo"></div>
    <div class="rodape-corte">
      <div>Agradecemos a sua preferência!</div>
      <div style="margin-top: 1mm; font-weight: 700;">Volte Sempre!</div>
      <div style="margin-top: 1mm; font-size: 9px; opacity: 0.8;">Pede AI • Delivery</div>
    </div>
  `;
}

/**
 * MODELO DE TESTE: Validação de Alinhamento, Largura e Guilhotina
 */
export function gerarHtmlTeste(store: Partial<Store>, largura: PrintFormat = '80mm'): string {
  const agora = formatDateTime(new Date().toISOString());
  const vias = store.viasImpressao || 'ambas';
  const auto = store.imprimirAutoAoAceitar !== false;
  const is58 = largura === '58mm';

  return `
    <div class="titulo-principal">*** TESTE DE IMPRESSÃO ***</div>
    <div class="subtitulo">${store.nome || 'DeliverySaas'}</div>
    <div class="divisor-duplo"></div>
    
    <div class="texto-centro negrito" style="font-size: 13px; margin-bottom: 1.5mm;">
      VALIDAÇÃO TÉRMICA ${largura}
    </div>
    <div class="texto-centro" style="font-size: 11px;">
      Data/Hora: ${agora}
    </div>
    
    <div class="divisor"></div>
    <div class="negrito" style="margin-bottom: 1mm;">PARÂMETROS DA LOJA:</div>
    <div class="linha-flex">
      <span>Largura Bobina:</span>
      <span class="negrito">${largura}</span>
    </div>
    <div class="linha-flex">
      <span>Vias Automáticas:</span>
      <span class="negrito uppercase">${vias}</span>
    </div>
    <div class="linha-flex">
      <span>Impressão no Aceite:</span>
      <span class="negrito">${auto ? 'ATIVADA' : 'DESATIVADA'}</span>
    </div>
    
    <div class="divisor"></div>
    <div class="negrito" style="margin-bottom: 1mm;">TESTE DE ALINHAMENTO:</div>
    <div class="texto-esq">[ESQUERDA]</div>
    <div class="texto-centro">[CENTRALIZADO]</div>
    <div class="texto-dir">[DIREITA]</div>
    
    <div class="divisor"></div>
    <div class="negrito" style="margin-bottom: 1mm;">TESTE DE RÉGUA / LARGURA:</div>
    <div style="font-family: monospace; font-size: 9px; word-break: break-all;">
      ${is58 ? '12345678901234567890123456789012' : '12345678901234567890123456789012345678901234'}
    </div>
    <div style="font-size: 10px; margin-top: 1mm;">
      Acentos: ÁÉÍÓÚ ãõ çÇ - Pontuação: !?#$%&*()
    </div>
    
    <div class="divisor"></div>
    <div class="negrito" style="margin-bottom: 1mm;">ITEM FICTÍCIO DE TESTE:</div>
    <div class="linha-flex">
      <span class="negrito">1x X-BURGER ARTESANAL</span>
      <span class="negrito">R$ 38,00</span>
    </div>
    <div class="sub-item">+ Bacon Duplo Crocante (R$ 6,00)</div>
    <div class="caixa-obs">OBS: CARNE AO PONTO, SEM CEBOLA</div>
    
    <div class="total-caixa">
      TOTAL: R$ 44,00
    </div>
    
    <div class="divisor-duplo"></div>
    <div class="rodape-corte">
      <div class="negrito">IMPRESSORA CONFIGURADA COM SUCESSO!</div>
      <div style="margin-top: 1mm;">Corte térmico / Guilhotina posicionado abaixo.</div>
    </div>
  `;
}

/**
 * Driver do Navegador (Iframe Isolado e Otimizado)
 */
function imprimirViaIframe(htmlConteudo: string, largura: PrintFormat = '80mm'): Promise<void> {
  return enfileirarTarefa(() => {
    return new Promise<void>((resolve) => {
      const iframeId = `thermal-print-iframe-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

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

      const estilos = obterEstilosCssTermico(largura);
      const doc = win.document;
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="utf-8">
          <title>Comanda Térmica - DeliverySaas</title>
          <style>${estilos}</style>
        </head>
        <body>
          <div id="print-root">${htmlConteudo}</div>
        </body>
        </html>
      `);
      doc.close();

      let concluido = false;
      const limparEResolver = () => {
        if (concluido) return;
        concluido = true;
        // Intervalo de segurança para que o driver de impressão do SO conclua o spooling
        setTimeout(() => {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
          resolve();
        }, 750);
      };

      const dispararPrint = () => {
        try {
          win.focus();
          win.onafterprint = () => {
            limparEResolver();
          };
          win.print();
          // Fallback caso o evento onafterprint não seja disparado
          setTimeout(limparEResolver, 1500);
        } catch (err) {
          console.error('[PrintService] Falha ao invocar win.print():', err);
          limparEResolver();
        }
      };

      // Aguarda 300ms para renderização completa de estilos e fontes
      setTimeout(dispararPrint, 300);
    });
  });
}

/**
 * Gerador de Bytes ESC/POS (Preparado para Agente de Impressão Local / USB / Rede / WebSocket)
 */
export function gerarEscPosBytes(
  tipo: PrintTicketType,
  data: { order?: Order; store: Partial<Store> }
): Uint8Array {
  const encoder = new TextEncoder();
  const bytes: number[] = [];

  // Comandos ESC/POS Padrão
  const ESC = 0x1b;
  const GS = 0x1d;

  const cmdInit = [ESC, 0x40]; // ESC @ (Inicializa impressora)
  const cmdAlignLeft = [ESC, 0x61, 0x00];
  const cmdAlignCenter = [ESC, 0x61, 0x01];
  const cmdAlignRight = [ESC, 0x61, 0x02];
  const cmdBoldOn = [ESC, 0x45, 0x01];
  const cmdBoldOff = [ESC, 0x45, 0x00];
  const cmdDoubleSize = [GS, 0x21, 0x11]; // Altura e largura dobradas
  const cmdNormalSize = [GS, 0x21, 0x00];
  const cmdCut = [GS, 0x56, 0x41, 0x03]; // Corte parcial com avanço de 3 linhas

  const pushString = (str: string) => {
    const encoded = encoder.encode(str + '\n');
    for (let i = 0; i < encoded.length; i++) {
      bytes.push(encoded[i]);
    }
  };

  // Inicialização
  bytes.push(...cmdInit);

  if (tipo === 'teste') {
    bytes.push(...cmdAlignCenter, ...cmdBoldOn, ...cmdDoubleSize);
    pushString('TESTE IMPRESSAO ESC/POS');
    bytes.push(...cmdNormalSize);
    pushString(data.store.nome || 'DeliverySaas');
    bytes.push(...cmdBoldOff);
    pushString('--------------------------------');
    bytes.push(...cmdAlignLeft);
    pushString('Status: PRONTO PARA USO');
    pushString('Data: ' + new Date().toLocaleString('pt-BR'));
    bytes.push(...cmdAlignCenter);
    pushString('================================');
    bytes.push(...cmdCut);
    return new Uint8Array(bytes);
  }

  const order = data.order;
  if (!order) {
    return new Uint8Array(bytes);
  }

  // Cabeçalho
  bytes.push(...cmdAlignCenter, ...cmdBoldOn);
  pushString(data.store.nome || 'DeliverySaas');
  pushString(tipo === 'cozinha' ? '*** COMANDA COZINHA ***' : '*** CUPOM DE ENTREGA ***');
  bytes.push(...cmdDoubleSize);
  pushString(`PEDIDO #${order.numero}`);
  bytes.push(...cmdNormalSize);
  pushString(order.tipo === 'entrega' ? '>> ENTREGA <<' : '>> RETIRADA <<');
  bytes.push(...cmdBoldOff);
  pushString('--------------------------------');

  // Itens
  bytes.push(...cmdAlignLeft);
  order.itens.forEach((it) => {
    bytes.push(...cmdBoldOn);
    pushString(`${it.qtd}x ${it.nome}`);
    bytes.push(...cmdBoldOff);
    if (it.complementos) {
      it.complementos.forEach((c) => pushString(`  + ${c.nome}`));
    }
    if (it.obs) {
      bytes.push(...cmdBoldOn);
      pushString(`  OBS: ${it.obs}`);
      bytes.push(...cmdBoldOff);
    }
  });

  if (tipo !== 'cozinha') {
    pushString('--------------------------------');
    bytes.push(...cmdAlignRight, ...cmdBoldOn, ...cmdDoubleSize);
    pushString(`TOTAL: ${formatCurrency(order.total)}`);
    bytes.push(...cmdNormalSize, ...cmdBoldOff);
  }

  // Corte
  bytes.push(...cmdAlignCenter);
  pushString('\n\n\n');
  bytes.push(...cmdCut);

  return new Uint8Array(bytes);
}

/**
 * SERVIÇO CENTRAL DE IMPRESSÃO TÉRMICA (PrintService)
 */
export const printService = {
  /**
   * Imprime Comanda da Cozinha
   */
  async imprimirComandaCozinha(order: Order, store: Partial<Store>): Promise<void> {
    const largura = store.larguraImpressora || '80mm';
    const html = gerarHtmlCozinha(order, store, largura);
    await imprimirViaIframe(html, largura);
  },

  /**
   * Imprime Cupom de Entrega
   */
  async imprimirCupomEntrega(order: Order, store: Partial<Store>): Promise<void> {
    const largura = store.larguraImpressora || '80mm';
    const html = gerarHtmlEntrega(order, store, largura);
    await imprimirViaIframe(html, largura);
  },

  /**
   * Dispara a impressão sequencial ao aceitar pedido (respeitando configurações da loja)
   */
  async imprimirAoAceitar(order: Order, store: Partial<Store>): Promise<void> {
    // 1. Verifica se impressão automática está desativada
    if (store.imprimirAutoAoAceitar === false) {
      console.log(`[PrintService] Impressão automática desativada para a loja. Ignorando.`);
      return;
    }

    // 2. Trava de Idempotência: impede reenvio do mesmo pedido
    if (impressoAutoSet.has(order.id) || order.impressoAutomaticamenteEm) {
      console.log(`[PrintService] Pedido #${order.numero} (ID: ${order.id}) já foi impresso automaticamente. Ignorando.`);
      return;
    }

    // Registra imediatamente no Set antes de qualquer await
    impressoAutoSet.add(order.id);

    const largura = store.larguraImpressora || '80mm';
    const vias: ViasConfig = store.viasImpressao || 'ambas';

    // 3. Execução de acordo com as vias configuradas
    if (vias === 'cozinha' || vias === 'ambas') {
      const htmlCozinha = gerarHtmlCozinha(order, store, largura);
      await imprimirViaIframe(htmlCozinha, largura);
    }

    if (vias === 'entrega' || vias === 'ambas') {
      // Se for apenas via de entrega, ou ambas:
      // Caso seja entrega, imprime o ticket de entrega
      // Caso seja retirada e configurado ambas/entrega, imprime o comprovante do cliente
      const htmlEntrega = gerarHtmlEntrega(order, store, largura);
      await imprimirViaIframe(htmlEntrega, largura);
    }
  },

  /**
   * Imprime Cupom de Teste
   */
  async imprimirTeste(store: Partial<Store>): Promise<void> {
    const largura = store.larguraImpressora || '80mm';
    const html = gerarHtmlTeste(store, largura);
    await imprimirViaIframe(html, largura);
  },

  /**
   * Limpa registro de pedido impresso (para testes manuais ou reprocessamento)
   */
  limparHistorico(orderId?: string): void {
    if (orderId) {
      impressoAutoSet.delete(orderId);
    } else {
      impressoAutoSet.clear();
    }
  },

  /**
   * Exporta gerador ESC/POS para futuras integrações com agentes locais de hardware
   */
  gerarEscPosBytes,
};
