import React from 'react';
import { MessageCircle, Clock, MapPin, ShoppingBag } from 'lucide-react';
import { Store } from '../types';
import { isStoreOpen, generateWhatsAppUrl } from '../lib/formatters';

interface StoreHeaderProps {
  store: Store;
}

export const StoreHeader: React.FC<StoreHeaderProps> = ({ store }) => {
  const openStatus = isStoreOpen(store);

  return (
    <div className="relative">
      {/* Cover Image */}
      <div className="h-48 w-full bg-neutral-200">
        {store.capa && <img src={store.capa} alt={store.nome} className="w-full h-full object-cover" />}
      </div>

      {/* Main Info Card */}
      <div className="relative -mt-12 mx-4 bg-white rounded-3xl p-5 shadow-lg border border-neutral-100">
        {/* Logo */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-24 h-24 rounded-full border-4 border-white bg-white shadow-md overflow-hidden">
          {store.logo ? (
            <img src={store.logo} alt={store.nome} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-neutral-100 text-neutral-400 font-black text-2xl">
              {store.nome.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>

        <div className="mt-12 text-center">
          <h1 className="text-2xl font-black text-neutral-900">{store.nome}</h1>
          <div className="flex items-center justify-center gap-2 mt-1">
            <span className={`w-2 h-2 rounded-full ${openStatus.isOpen ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <span className={`text-sm font-bold ${openStatus.isOpen ? 'text-emerald-700' : 'text-rose-700'}`}>
              {openStatus.isOpen ? 'Aberta agora' : 'Fechada'}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-neutral-600 font-medium">
            <div className="flex items-center justify-center gap-1.5 p-2 bg-neutral-50 rounded-xl">
              <Clock className="w-4 h-4 text-neutral-400" />
              <span>{store.tempoEstimadoMin || 30} min</span>
            </div>
            <div className="flex items-center justify-center gap-1.5 p-2 bg-neutral-50 rounded-xl">
              <MapPin className="w-4 h-4 text-neutral-400" />
              <span>{store.endereco || 'Consulte'}</span>
            </div>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
            <a
              href={generateWhatsAppUrl(store.whatsapp || '', 'Olá! Gostaria de saber mais sobre o cardápio.')}
              target="_blank"
              rel="noreferrer"
              className="flex-1 py-3 px-4 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 font-black text-sm rounded-2xl flex items-center justify-center gap-2 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </a>
            <button
              className="flex-1 py-3 px-4 text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 transition-colors"
              style={{ backgroundColor: store.corPrimaria }}
              onClick={() => document.getElementById('menu-start')?.scrollIntoView({behavior: 'smooth'})}
            >
              <ShoppingBag className="w-4 h-4" />
              Ver Cardápio
            </button>
        </div>
      </div>
    </div>
  );
};
