import React from 'react';
import { ComandaImpressao } from './ComandaImpressao';
import { Order, Store } from '../types';

interface ThermalReceiptProps {
  order: Order;
  store: Store;
}

export const ThermalReceipt: React.FC<ThermalReceiptProps> = ({ order, store }) => {
  return <ComandaImpressao order={order} store={store} />;
};
