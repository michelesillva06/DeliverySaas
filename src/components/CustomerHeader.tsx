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

  const hasLongDesc = Boolean(store.descricao && store.descricao.length > 90);

  return (
    <header className="relative bg-white border-b border-neutral-200">
      {/* 1. CAPA */}
      <div className="relative w-full h-[160px] sm:h-[220px] overflow-hidden bg-neutral-900">
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
        {/* Gradiente sutil de baixo para cima (transparente -> preto 35%) */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent pointer-events-none" />
      </div>

      {/* 2 & 3 & 4. LOGO, BLOCO DE INFORMAÇÕES E ESPAÇAMENTO */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-5 pt-1 bg-white">
        {/* Linha do Logo e Botão WhatsApp Desktop */}
        <div className="flex items-end justify-between -mt-9 sm:-mt-11 mb-3">
          {/* LOGO */}
          <div className="w-[72px] h-[72px] sm:w-[88px] sm:h-[88px] rounded-2xl bg-white border-4 border-white shadow-md overflow-hidden flex-shrink-0 flex items-center justify-center font-bold text-neutral-400 text-xl z-10">
            {store.logo ? (
              <img
                src={store.logo}
                alt={store.nome}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="text-xl sm:text-2xl font-black text-neutral-400">
                {store.nome.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>

          {/* Botão WhatsApp ALINHADO À DIREITA no Desktop */}
          {store.whatsapp && (
            <a
              href={generateWhatsAppUrl(store.whatsapp, `Olá! Gostaria de tirar uma dúvida sobre o cardápio.`)}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>WhatsApp</span>
            </a>
          )}
        </div>

        {/* BLOCO DE TEXTOS (fundo branco, contraste alto com #111111 e #555555) */}
        <div className="space-y-3">
          {/* Nome e Selo Status */}
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[24px] sm:text-[28px] font-black text-[#111111] leading-tight break-words tracking-tight">
              {store.nome}
            </h1>

            {openStatus.isOpen ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Aberta</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-rose-50 text-rose-800 border border-rose-200/80">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>Fechada</span>
              </span>
            )}
          </div>

          {/* Descrição com "ver mais" */}
          {store.descricao && (
            <div className="text-[14px] text-[#555555] leading-normal">
              <p className={!descExpanded && hasLongDesc ? 'line-clamp-2' : ''}>
                {store.descricao}
              </p>
              {hasLongDesc && (
                <button
                  type="button"
                  onClick={() => setDescExpanded(!descExpanded)}
                  className="mt-0.5 text-xs font-bold text-neutral-900 underline hover:text-neutral-700 inline-flex items-center gap-0.5 cursor-pointer"
                >
                  <span>{descExpanded ? 'Ver menos' : 'Ver mais'}</span>
                  {descExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}
            </div>
          )}

          {/* Linha de Informações Operacionais */}
          <div className="flex flex-wrap items-center gap-y-2 gap-x-3 text-xs text-[#555555] font-medium pt-0.5">
            <div className="flex items-center gap-1">
              <Bike className="w-3.5 h-3.5 text-neutral-500" />
              <span>entrega ~{store.tempoEstimadoMin || 40} min</span>
            </div>

            <span className="text-neutral-300">•</span>

            <div className="flex items-center gap-1">
              <ShoppingBag className="w-3.5 h-3.5 text-neutral-500" />
              <span>retirada ~{store.tempoEstimadoRetiradaMin || 20} min</span>
            </div>

            <span className="text-neutral-300">•</span>

            <div className="flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-neutral-500" />
              <span>pedido mínimo {formatCurrency(store.pedidoMinimo || 25)}</span>
            </div>

            <span className="text-neutral-300">•</span>

            <button
              type="button"
              onClick={() => setHoursModalOpen(true)}
              className="text-neutral-900 font-bold underline hover:text-neutral-700 cursor-pointer text-xs"
            >
              Ver horários
            </button>
          </div>

          {/* Botão WhatsApp em LINHA PRÓPRIA (largura total) no celular */}
          {store.whatsapp && (
            <div className="sm:hidden pt-1">
              <a
                href={generateWhatsAppUrl(store.whatsapp, `Olá! Gostaria de tirar uma dúvida sobre o cardápio.`)}
                target="_blank"
                rel="noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Conversar no WhatsApp</span>
              </a>
            </div>
          )}

          {/* Alerta de Loja Fechada */}
          {!openStatus.isOpen && (
            <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-start gap-2.5 mt-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Estabelecimento Fechado</span>
                <span>
                  {openStatus.reason || 'Esta loja não está aceitando pedidos no momento. Você pode visualizar o cardápio, mas o checkout está desabilitado.'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Horários de Funcionamento */}
      {hoursModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-neutral-100">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="font-extrabold text-base text-neutral-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-neutral-500" />
                Horários de Funcionamento
              </h3>
              <button
                onClick={() => setHoursModalOpen(false)}
                className="p-1.5 hover:bg-neutral-100 rounded-xl text-neutral-400 hover:text-neutral-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5 text-xs">
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
                    className={`flex items-center justify-between p-2.5 rounded-xl transition-colors ${
                      isToday ? 'bg-neutral-900 text-white font-bold' : 'text-neutral-700 hover:bg-neutral-50'
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
              className="w-full py-3 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

