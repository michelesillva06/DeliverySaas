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
      <div className="h-48 w-full relative overflow-hidden bg-neutral-900">
        {store.capa && store.capa.trim() ? (
          <img
            src={store.capa}
            alt={store.nome}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center relative"
            style={{
              background: `linear-gradient(135deg, ${store.corPrimaria || '#e11d48'}44 0%, #171717 100%)`,
            }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none opacity-40" />
            <span className="text-white/20 font-black text-2xl sm:text-3xl tracking-widest uppercase select-none px-4 text-center">
              {store.nome}
            </span>
          </div>
        )}
      </div>

      {/* Main Info Card */}
      <div className="relative -mt-12 mx-4 bg-white rounded-3xl p-5 shadow-lg border border-neutral-100">
        {/* Logo */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-24 h-24 rounded-full border-4 border-white bg-white shadow-md overflow-hidden flex items-center justify-center">
          {store.logo && store.logo.trim() ? (
            <img
              src={store.logo}
              alt={store.nome}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center font-black text-2xl text-white shadow-inner"
              style={{ backgroundColor: store.corPrimaria || '#e11d48' }}
            >
              {(store.nome || 'LOJA')
                .trim()
                .split(' ')
                .map((w) => w[0])
                .slice(0, 2)
                .join('')
                .toUpperCase() || 'LJ'}
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
