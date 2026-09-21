import React from 'react';
import { TicketImpressaoPortal } from './TicketImpressao';
import { Order, Store } from '../types';

interface ThermalReceiptProps {
  order: Order;
  store: Store;
  tipoTicket?: 'cozinha' | 'entrega';
}

export const ThermalReceipt: React.FC<ThermalReceiptProps> = ({ order, store, tipoTicket = 'entrega' }) => {
  return <TicketImpressaoPortal order={order} store={store} tipoTicket={tipoTicket} />;
};
