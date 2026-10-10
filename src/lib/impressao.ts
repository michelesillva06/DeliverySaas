import { Order, Store } from '../types';
import {
  printService,
  gerarHtmlCozinha,
  gerarHtmlEntrega,
  gerarHtmlTeste,
  PrintFormat,
} from '../services/printService';

export {
  printService,
  gerarHtmlCozinha,
  gerarHtmlEntrega,
  gerarHtmlTeste,
};

/**
 * Função mantida para compatibilidade direta com chamadas legadas
 */
export async function imprimirTicketCozinha(order: Order, store: Store): Promise<void> {
  return printService.imprimirComandaCozinha(order, store);
}

/**
 * Função mantida para compatibilidade direta com chamadas legadas
 */
export async function imprimirTicketEntrega(order: Order, store: Store): Promise<void> {
  return printService.imprimirCupomEntrega(order, store);
}

/**
 * Disparo automático com verificação de vias configuradas e idempotência
 */
export async function dispararImpressaoSequencialAoAceitar(order: Order, store: Store): Promise<void> {
  return printService.imprimirAoAceitar(order, store);
}

/**
 * Função de teste da impressora
 */
export async function imprimirTesteImpressora(store: Partial<Store>): Promise<void> {
  return printService.imprimirTeste(store);
}

/**
 * Função legado para impressão direta de HTML
 */
export async function imprimirTicket(html: string, largura: PrintFormat = '80mm'): Promise<void> {
  // Criação direta via printService com renderização do html
  const iframeId = `iframe-print-custom-${Date.now()}`;
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
    return;
  }

  const doc = win.document;
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Impressão</title>
      <style>
        @page { size: ${largura} auto; margin: 0; }
        body { margin: 0; padding: 2mm; font-family: monospace; color: #000; }
      </style>
    </head>
    <body>${html}</body>
    </html>
  `);
  doc.close();

  return new Promise<void>((resolve) => {
    setTimeout(() => {
      try {
        win.focus();
        win.onafterprint = () => {
          setTimeout(() => {
            if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
            resolve();
          }, 500);
        };
        win.print();
        setTimeout(() => {
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
          resolve();
        }, 1500);
      } catch (e) {
        console.error(e);
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        resolve();
      }
    }, 300);
  });
}

/**
 * Mantido por compatibilidade
 */
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
