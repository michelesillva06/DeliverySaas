import React, { useState } from 'react';
import { Clock, MapPin, Phone, MessageCircle, AlertCircle, CheckCircle2, ChevronDown, X } from 'lucide-react';
import { Store } from '../types';
import { isStoreOpen, formatCurrency, formatPhone, generateWhatsAppUrl } from '../lib/formatters';

interface CustomerHeaderProps {
  store: Store;
}

export const CustomerHeader: React.FC<CustomerHeaderProps> = ({ store }) => {
  const [hoursModalOpen, setHoursModalOpen] = useState(false);
  const openStatus = isStoreOpen(store);

  return (
    <header className="relative bg-white border-b border-neutral-200">
      {/* Imagem de Capa */}
      <div className="relative w-full h-32 sm:h-48 bg-neutral-900 overflow-hidden">
        {store.capa ? (
          <img
            src={store.capa}
            alt={store.nome}
            className="w-full h-full object-cover opacity-90"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full bg-neutral-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
      </div>

      {/* Conteúdo do Estabelecimento */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-4">
        <div className="relative flex flex-col sm:flex-row sm:items-end gap-4 -mt-12 sm:-mt-16 mb-4">
          {/* Logo da Loja */}
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white border-4 border-white shadow-xl overflow-hidden flex-shrink-0 flex items-center justify-center">
            {store.logo ? (
              <img
                src={store.logo}
                alt={store.nome}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="text-2xl font-black text-neutral-400">
                {store.nome.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>

          {/* Nome, Status e Ações Rápidas */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-neutral-900 truncate tracking-tight">
                {store.nome}
              </h1>

              {openStatus.isOpen ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Loja Aberta
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  Fechada
                </span>
              )}
            </div>

            {store.descricao && (
              <p className="text-xs sm:text-sm text-neutral-600 mt-1 line-clamp-2 leading-relaxed">
                {store.descricao}
              </p>
            )}

            {/* Informações Operacionais em Badges */}
            <div className="flex flex-wrap items-center gap-y-2 gap-x-4 mt-3 text-xs text-neutral-600 font-medium">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-neutral-400" />
                <span>
                  Entrega: ~{store.tempoEstimadoMin} min • Retirada: ~{store.tempoEstimadoRetiradaMin} min
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span>Pedido Mínimo: <strong>{formatCurrency(store.pedidoMinimo)}</strong></span>
              </div>

              <button
                type="button"
                onClick={() => setHoursModalOpen(true)}
                className="text-neutral-900 underline hover:text-neutral-700 font-semibold cursor-pointer text-xs"
              >
                Ver horários
              </button>
            </div>
          </div>

          {/* Contato WhatsApp Direto */}
          <div className="flex items-center gap-2 sm:self-center">
            {store.whatsapp && (
              <a
                href={generateWhatsAppUrl(store.whatsapp, `Olá! Gostaria de tirar uma dúvida sobre o cardápio.`)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
              >
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                <span>WhatsApp</span>
              </a>
            )}
          </div>
        </div>

        {/* Alerta caso a loja esteja fechada */}
        {!openStatus.isOpen && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>
              {openStatus.reason || 'Esta loja está fechada no momento. Você pode visualizar o cardápio, mas o checkout está desabilitado.'}
            </span>
          </div>
        )}
      </div>

      {/* Modal de Horários de Funcionamento */}
      {hoursModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="font-bold text-base text-neutral-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-neutral-500" />
                Horários de Funcionamento
              </h3>
              <button
                onClick={() => setHoursModalOpen(false)}
                className="p-1 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-neutral-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              {store.horarios?.map((h) => {
                const isToday = new Date().getDay() === h.dia;
                return (
                  <div
                    key={h.dia}
                    className={`flex items-center justify-between p-2 rounded-lg ${
                      isToday ? 'bg-neutral-100 font-bold text-neutral-900' : 'text-neutral-600'
                    }`}
                  >
                    <span>
                      {h.nomeDia} {isToday && '(Hoje)'}
                    </span>
                    <span>
                      {h.ativo ? `${h.abertura} às ${h.fechamento}` : 'Fechado'}
                    </span>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setHoursModalOpen(false)}
              className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
