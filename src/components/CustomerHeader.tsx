import React, { useState } from 'react';
import { Clock, MessageCircle, AlertCircle, X, ChevronDown, ChevronUp, Bike, ShoppingBag, DollarSign } from 'lucide-react';
import { Store } from '../types';
import { isStoreOpen, formatCurrency, generateWhatsAppUrl, normalizeHorarios } from '../lib/formatters';

interface CustomerHeaderProps {
  store: Store;
}

export const CustomerHeader: React.FC<CustomerHeaderProps> = ({ store }) => {
  const [hoursModalOpen, setHoursModalOpen] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const openStatus = isStoreOpen(store);

  const hasLongDesc = Boolean(store.descricao && store.descricao.length > 100);

  return (
    <header className="relative bg-white border-b border-neutral-200">
      {/* 1. CAPA */}
      <div className="relative w-full h-[180px] sm:h-[240px] overflow-hidden bg-neutral-900">
        {store.capa ? (
          <img
            src={store.capa}
            alt=""
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{
              background: store.corPrimaria
                ? `linear-gradient(135deg, ${store.corPrimaria}, #111111)`
                : 'linear-gradient(135deg, #1f2937, #111827)',
            }}
          />
        )}
        {/* Gradiente sutil para garantir contraste */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
      </div>

      {/* 2. BLOCO PRINCIPAL DA LOJA */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-6 pt-2 bg-white">
        {/* Linha do Logo e Botão WhatsApp Desktop */}
        <div className="flex items-end justify-between -mt-12 sm:-mt-16 mb-4">
          {/* LOGO */}
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white border-4 border-white shadow-lg overflow-hidden flex-shrink-0 flex items-center justify-center font-black text-neutral-400 text-2xl z-10">
            {store.logo ? (
              <img
                src={store.logo}
                alt={store.nome}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="text-2xl sm:text-3xl font-black text-neutral-400">
                {store.nome.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>

          {/* Botão WhatsApp Desktop */}
          {store.whatsapp && (
            <a
              href={generateWhatsAppUrl(store.whatsapp, `Olá! Gostaria de tirar uma dúvida sobre o cardápio.`)}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl font-bold text-base bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-colors cursor-pointer min-h-[48px]"
            >
              <MessageCircle className="w-5 h-5 text-white" />
              <span>Falar no WhatsApp</span>
            </a>
          )}
        </div>

        {/* TÍTULO E STATUS */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black text-[#111111] leading-tight break-words tracking-tight">
              {store.nome}
            </h1>

            {openStatus.isOpen ? (
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-300">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Aberta agora</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-extrabold bg-rose-50 text-rose-800 border border-rose-300">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span>Fechada no momento</span>
              </span>
            )}
          </div>

          {/* DESCRIÇÃO DA LOJA (text-base com alto contraste) */}
          {store.descricao && (
            <div className="text-base text-neutral-700 leading-relaxed font-normal">
              <p className={!descExpanded && hasLongDesc ? 'line-clamp-2' : ''}>
                {store.descricao}
              </p>
              {hasLongDesc && (
                <button
                  type="button"
                  onClick={() => setDescExpanded(!descExpanded)}
                  className="mt-1 text-sm font-bold text-neutral-900 underline hover:text-neutral-700 inline-flex items-center gap-1 cursor-pointer min-h-[36px]"
                >
                  <span>{descExpanded ? 'Ver menos' : 'Ver mais'}</span>
                  {descExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              )}
            </div>
          )}

          {/* INFORMAÇÕES OPERACIONAIS (pelo menos 16px - text-base) */}
          <div className="flex flex-wrap items-center gap-y-3 gap-x-4 text-base text-neutral-800 font-semibold pt-1 border-t border-neutral-100">
            <div className="flex items-center gap-2 bg-neutral-50 px-3 py-1.5 rounded-xl border border-neutral-200">
              <Bike className="w-5 h-5 text-neutral-700" />
              <span>Entrega ~{store.tempoEstimadoMin || 40} min</span>
            </div>

            <div className="flex items-center gap-2 bg-neutral-50 px-3 py-1.5 rounded-xl border border-neutral-200">
              <ShoppingBag className="w-5 h-5 text-neutral-700" />
              <span>Retirada ~{store.tempoEstimadoRetiradaMin || 20} min</span>
            </div>

            <div className="flex items-center gap-2 bg-neutral-50 px-3 py-1.5 rounded-xl border border-neutral-200">
              <DollarSign className="w-5 h-5 text-neutral-700" />
              <span>Pedido mínimo {formatCurrency(store.pedidoMinimo || 25)}</span>
            </div>

            <div className="flex items-center gap-2 bg-neutral-100 text-neutral-800 px-3 py-1.5 rounded-xl border border-neutral-300 font-medium text-sm sm:text-base">
              <span>💳 Os pedidos incluem taxa de serviço de R$ 0,99</span>
            </div>

            <button
              type="button"
              onClick={() => setHoursModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-neutral-900 font-bold hover:bg-neutral-100 border border-neutral-300 cursor-pointer text-base transition-colors min-h-[44px]"
            >
              <Clock className="w-4 h-4 text-neutral-600" />
              <span>Ver horários</span>
            </button>
          </div>

          {/* BOTÃO WHATSAPP MOBILE (largura total, min-h-[48px]) */}
          {store.whatsapp && (
            <div className="sm:hidden pt-2">
              <a
                href={generateWhatsAppUrl(store.whatsapp, `Olá! Gostaria de tirar uma dúvida sobre o cardápio.`)}
                target="_blank"
                rel="noreferrer"
                className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-2xl font-bold text-base bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-colors cursor-pointer min-h-[50px]"
              >
                <MessageCircle className="w-5 h-5 text-white" />
                <span>Conversar no WhatsApp da Loja</span>
              </a>
            </div>
          )}

          {/* ALERTA DE LOJA FECHADA */}
          {!openStatus.isOpen && (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-sm sm:text-base text-amber-950 flex items-start gap-3 mt-3">
              <AlertCircle className="w-6 h-6 text-amber-700 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-black block text-base sm:text-lg">Estabelecimento Fechado</span>
                <span className="text-amber-900 leading-relaxed">
                  {openStatus.reason || 'Esta loja não está aceitando pedidos no momento. Você pode visualizar o cardápio, mas o checkout está pausado temporariamente.'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Horários de Funcionamento */}
      {hoursModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-neutral-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
              <h3 className="font-black text-lg text-neutral-900 flex items-center gap-2.5">
                <Clock className="w-5 h-5 text-neutral-700" />
                Horários de Funcionamento
              </h3>
              <button
                onClick={() => setHoursModalOpen(false)}
                className="p-2 hover:bg-neutral-100 rounded-xl text-neutral-500 hover:text-neutral-900 transition-colors"
                aria-label="Fechar horários"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-sm sm:text-base">
              {normalizeHorarios(store.horarios).map((h) => {
                const isToday = new Date().getDay() === h.dia;
                const hoursFormatted = h.ativo
                  ? h.periodos && h.periodos.length > 0
                    ? h.periodos.map((p) => `${p.abertura} às ${p.fechamento}`).join(' • ')
                    : `${h.abertura} às ${h.fechamento}`
                  : 'Fechado';

                return (
                  <div
                    key={h.dia}
                    className={`flex items-center justify-between p-3 rounded-xl transition-colors ${
                      isToday ? 'bg-neutral-900 text-white font-bold' : 'text-neutral-800 bg-neutral-50'
                    }`}
                  >
                    <span>
                      {h.nomeDia} {isToday && '(Hoje)'}
                    </span>
                    <span className={isToday ? 'text-emerald-400 font-extrabold text-right' : 'font-semibold text-right'}>
                      {hoursFormatted}
                    </span>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setHoursModalOpen(false)}
              className="w-full py-3.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-2xl text-base font-bold transition-colors cursor-pointer min-h-[48px]"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
