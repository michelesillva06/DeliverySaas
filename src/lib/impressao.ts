import { Order, Store } from '../types';

export function dispararImpressaoIndividual(
  order: Order,
  store: Store,
  tipoTicket: 'cozinha' | 'entrega',
  setPrintState: (state: { order: Order; tipoTicket: 'cozinha' | 'entrega' } | null) => void
) {
  setPrintState({ order, tipoTicket });
  setTimeout(() => {
    window.print();
  }, 120);
}

export function dispararImpressaoSequencialAoAceitar(
  order: Order,
  store: Store,
  setPrintState: (state: { order: Order; tipoTicket: 'cozinha' | 'entrega' } | null) => void
) {
  // Se a loja desativou a impressão automática no painel, encerra aqui
  if (store.imprimirAutoAoAceitar === false) {
    return;
  }

  // 1. Monta o ticket da Cozinha no #ticket-impressao
  setPrintState({ order, tipoTicket: 'cozinha' });

  // Timeout para renderização no portal
  setTimeout(() => {
    // Se for RETIRADA, imprime somente a Cozinha
    if (order.tipo === 'retirada') {
      window.print();
      return;
    }

    // Se for ENTREGA, prepara o ouvinte afterprint para engatar a 2ª impressão
    const handleAfterPrint = () => {
      window.removeEventListener('afterprint', handleAfterPrint);

      // 2. Troca o conteúdo para o Ticket da Entrega
      setPrintState({ order, tipoTicket: 'entrega' });

      // Permite repintura do DOM antes de abrir o 2º diálogo
      setTimeout(() => {
        window.print();
      }, 150);
    };

    window.addEventListener('afterprint', handleAfterPrint);

    // Dispara a impressão do 1º ticket (Cozinha)
    window.print();
  }, 120);
}
