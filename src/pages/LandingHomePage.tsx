import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  UtensilsCrossed,
  MessageCircle,
  ExternalLink,
  Check,
  CheckCircle2,
  ChevronDown,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import { SUPPORT_WHATSAPP, SUPPORT_MESSAGE_NEW_STORE, getWhatsAppSupportLink } from '../lib/constants';
import { subscribeToSaasConfig } from '../services/firestoreService';

const SALES_WHATSAPP_URL = getWhatsAppSupportLink(SUPPORT_WHATSAPP, SUPPORT_MESSAGE_NEW_STORE);

export const LandingHomePage: React.FC = () => {
  const [acaiSlug, setAcaiSlug] = useState('boradeacai');
  const [burgerSlug, setBurgerSlug] = useState('megaburger');
  const [faqOpenIndex, setFaqOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    const unsub = subscribeToSaasConfig((cfg) => {
      if (cfg?.demoAcaiSlug) setAcaiSlug(cfg.demoAcaiSlug);
      if (cfg?.demoBurgerSlug) setBurgerSlug(cfg.demoBurgerSlug);
    });
    return () => unsub();
  }, []);

  const demoAcaiUrl = `https://pedeai-cardapiodigital.vercel.app/#/${acaiSlug}`;
  const demoBurgerUrl = `https://pedeai-cardapiodigital.vercel.app/#/${burgerSlug}`;

  const toggleFaq = (index: number) => {
    setFaqOpenIndex(faqOpenIndex === index ? null : index);
  };

  const faqItems = [
    {
      q: 'Quem paga a taxa de serviço de R$ 0,99?',
      a: 'A taxa é paga pelo consumidor final. O valor de R$ 0,99 é adicionado de forma 100% transparente no resumo do checkout, antes de o cliente confirmar o pedido.',
    },
    {
      q: 'Como a loja faz o repasse das taxas arrecadadas?',
      a: 'Como a sua loja recebe o pagamento integral do pedido diretamente do cliente (via Pix ou na entrega), você repassa à plataforma apenas a soma das taxas arrecadadas no período acordado (diário, semanal ou quinzenal) via Pix pelo painel.',
    },
    {
      q: 'O cliente ou o restaurante precisa baixar algum aplicativo?',
      a: 'Não. O cardápio digital funciona direto no navegador do celular do cliente, sem necessidade de download. O restaurante opera pelo painel web responsivo em celulares, tablets ou computadores.',
    },
    {
      q: 'Como recebo os pedidos no meu estabelecimento?',
      a: 'Ao confirmar a sacola no cardápio, o pedido é salvo imediatamente no seu painel operacional com alerta sonoro e o cliente é encaminhado ao WhatsApp da sua loja com o resumo organizado.',
    },
  ];

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col selection:bg-rose-500 selection:text-white font-sans">
      {/* 1. MENU SUPERIOR */}
      <header className="border-b border-neutral-800/80 bg-neutral-950/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-2xl bg-rose-600 flex items-center justify-center text-white shadow-lg shadow-rose-600/30 group-hover:scale-105 transition-transform">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-white block leading-none">
                Pede AI
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-400">
                Cardápio & Pedidos
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              to="/entrar"
              className="px-4 py-2.5 text-xs sm:text-sm font-bold text-neutral-300 hover:text-white hover:bg-neutral-900 rounded-xl transition-colors"
            >
              Entrar
            </Link>
            <a
              href={SALES_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs sm:text-sm font-black shadow-lg shadow-rose-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Quero meu cardápio</span>
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* 2. HERO PRINCIPAL */}
        <section className="relative overflow-hidden pt-16 pb-16 sm:pt-24 sm:pb-20 border-b border-neutral-800">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-rose-950/30 via-neutral-950 to-neutral-950 pointer-events-none" />

          <div className="max-w-4xl mx-auto px-4 sm:px-6 relative text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold tracking-wide">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Plataforma Completa para Delivery</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.12]">
              Seu cardápio digital com pedidos organizados em um só painel
            </h1>

            <p className="text-sm sm:text-lg text-neutral-300 leading-relaxed font-normal max-w-2xl mx-auto">
              Seu cliente escolhe, finaliza o pedido e segue para o WhatsApp da sua loja. Você acompanha tudo pelo painel de pedidos sem comissão por venda.
            </p>

            {/* Apenas UM botão de CTA comercial no Hero */}
            <div className="pt-4 flex justify-center">
              <a
                href={SALES_WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-base font-black shadow-xl shadow-rose-600/30 hover:scale-105 active:scale-95 transition-all flex items-center gap-2.5 cursor-pointer"
              >
                <MessageCircle className="w-5 h-5" />
                <span>Quero meu cardápio</span>
              </a>
            </div>
          </div>
        </section>

        {/* 3. SEÇÃO DE DEMONSTRAÇÕES IMEDIATAMENTE ABAIXO DO HERO */}
        <section className="py-16 sm:py-24 border-b border-neutral-800 bg-neutral-900/40">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-12">
            <div className="text-center space-y-3 max-w-2xl mx-auto">
              <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                Veja como seu cardápio pode ficar
              </h2>
              <p className="text-sm sm:text-base text-neutral-400">
                Explore os exemplos e experimente a experiência de fazer um pedido.
              </p>
            </div>

            {/* Grid com os Dois Exemplos (Lado a Lado no Desktop, Empilhados no Celular) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              {/* EXEMPLO A: BORA DE AÇAÍ */}
              <div className="rounded-3xl bg-neutral-900 border border-neutral-800 hover:border-purple-500/50 transition-all p-6 sm:p-7 flex flex-col justify-between space-y-6 shadow-xl shadow-purple-950/10">
                <div className="space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                    <div>
                      <h3 className="text-xl font-black text-white">Bora de Açaí</h3>
                      <p className="text-xs text-neutral-400">Açaí, Sobremesas e Copos Recheados</p>
                    </div>
                    <span className="px-3 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-full text-xs font-bold">
                      Açaí & Doces
                    </span>
                  </div>

                  {/* Mockup Fiel em HTML/CSS do Cardápio Bora de Açaí */}
                  <div className="bg-white text-neutral-900 rounded-2xl overflow-hidden shadow-inner border border-neutral-200">
                    {/* Capa */}
                    <div className="h-28 bg-gradient-to-r from-purple-950 via-purple-900 to-indigo-950 relative">
                      <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
                    </div>

                    {/* Cartão de Identidade Sobreposto */}
                    <div className="px-4 pb-4 -mt-10 relative">
                      <div className="flex items-end justify-between gap-3">
                        <div className="w-16 h-16 rounded-2xl bg-purple-700 text-white font-black text-xl flex items-center justify-center border-4 border-white shadow-md">
                          BA
                        </div>
                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-[11px] font-black uppercase">
                          ● Aberta
                        </span>
                      </div>

                      <div className="mt-2">
                        <h4 className="font-black text-base text-neutral-900">Bora de Açaí</h4>
                        <p className="text-[11px] text-neutral-500">Entrega • Retirada • Pedido mínimo R$ 15,00</p>
                      </div>

                      {/* Seção Destaques */}
                      <div className="mt-4 pt-3 border-t border-neutral-100 space-y-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-purple-700 block">
                          Mais Pedidos
                        </span>

                        <div className="space-y-2">
                          {/* Item 1 */}
                          <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-50 border border-neutral-100 gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-xs text-neutral-900">Açaí Tradicional 500ml</p>
                              <p className="text-[10px] text-neutral-500 truncate">Com 2 acompanhamentos grátis</p>
                              <p className="font-black text-xs text-purple-700 mt-0.5">R$ 22,00</p>
                            </div>
                            <div className="w-14 h-14 rounded-lg bg-purple-900 overflow-hidden flex-shrink-0">
                              <img
                                src="https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=150&q=80"
                                alt="Açaí"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </div>

                          {/* Item 2 */}
                          <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-50 border border-neutral-100 gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-xs text-neutral-900">Copo da Felicidade 700ml</p>
                              <p className="text-[10px] text-neutral-500 truncate">Nutella, morangos frescos e M&Ms</p>
                              <p className="font-black text-xs text-purple-700 mt-0.5">R$ 32,00</p>
                            </div>
                            <div className="w-14 h-14 rounded-lg bg-purple-900 overflow-hidden flex-shrink-0">
                              <img
                                src="https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=150&q=80"
                                alt="Copo Felicidade"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <a
                  href={demoAcaiUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs sm:text-sm font-black shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  <span>Testar cardápio de açaí</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>

              {/* EXEMPLO B: MEGA BURGER */}
              <div className="rounded-3xl bg-neutral-900 border border-neutral-800 hover:border-amber-500/50 transition-all p-6 sm:p-7 flex flex-col justify-between space-y-6 shadow-xl shadow-amber-950/10">
                <div className="space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                    <div>
                      <h3 className="text-xl font-black text-white">Mega Burger</h3>
                      <p className="text-xs text-neutral-400">Smash Burgers Artesanais & Porções</p>
                    </div>
                    <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full text-xs font-bold">
                      Hamburgueria
                    </span>
                  </div>

                  {/* Mockup Fiel em HTML/CSS do Cardápio Mega Burger */}
                  <div className="bg-white text-neutral-900 rounded-2xl overflow-hidden shadow-inner border border-neutral-200">
                    {/* Capa */}
                    <div className="h-28 bg-gradient-to-r from-amber-950 via-amber-900 to-orange-950 relative">
                      <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
                    </div>

                    {/* Cartão de Identidade Sobreposto */}
                    <div className="px-4 pb-4 -mt-10 relative">
                      <div className="flex items-end justify-between gap-3">
                        <div className="w-16 h-16 rounded-2xl bg-amber-600 text-white font-black text-xl flex items-center justify-center border-4 border-white shadow-md">
                          MB
                        </div>
                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-[11px] font-black uppercase">
                          ● Aberta
                        </span>
                      </div>

                      <div className="mt-2">
                        <h4 className="font-black text-base text-neutral-900">Mega Burger</h4>
                        <p className="text-[11px] text-neutral-500">Entrega • Retirada • Pedido mínimo R$ 20,00</p>
                      </div>

                      {/* Seção Destaques */}
                      <div className="mt-4 pt-3 border-t border-neutral-100 space-y-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-amber-700 block">
                          Smash Burgers
                        </span>

                        <div className="space-y-2">
                          {/* Item 1 */}
                          <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-50 border border-neutral-100 gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-xs text-neutral-900">The Mega Bacon Smash</p>
                              <p className="text-[10px] text-neutral-500 truncate">Duplo smash 180g, cheddar melt e bacon</p>
                              <p className="font-black text-xs text-amber-700 mt-0.5">R$ 32,90</p>
                            </div>
                            <div className="w-14 h-14 rounded-lg bg-amber-900 overflow-hidden flex-shrink-0">
                              <img
                                src="https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=150&q=80"
                                alt="Burger"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </div>

                          {/* Item 2 */}
                          <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-50 border border-neutral-100 gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-xs text-neutral-900">Fritas Rústicas com Cheddar</p>
                              <p className="text-[10px] text-neutral-500 truncate">Batatas douradas com bacon crocante</p>
                              <p className="font-black text-xs text-amber-700 mt-0.5">R$ 22,00</p>
                            </div>
                            <div className="w-14 h-14 rounded-lg bg-amber-900 overflow-hidden flex-shrink-0">
                              <img
                                src="https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=150&q=80"
                                alt="Fritas"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <a
                  href={demoBurgerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs sm:text-sm font-black shadow-lg shadow-amber-600/30 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  <span>Testar cardápio de hamburgueria</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* 4. CARD DO PLANO IMEDIATAMENTE APÓS DEMONSTRAÇÕES */}
        <section className="py-16 sm:py-24 border-b border-neutral-800 bg-neutral-950">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-b from-neutral-900 via-neutral-900 to-neutral-950 border border-neutral-800 shadow-2xl relative overflow-hidden space-y-8">
              <div className="absolute top-0 right-0 w-72 h-72 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />

              <div className="space-y-4 text-center sm:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Modelo Transparente & Acessível</span>
                </div>
                <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                  Seu delivery no digital, sem mensalidade
                </h2>
              </div>

              {/* Destaques em Evidência: R$ 0 / R$ 0 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-neutral-950/80 border border-neutral-800 text-center sm:text-left space-y-1">
                  <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Implantação</span>
                  <p className="text-3xl sm:text-4xl font-black text-emerald-400">R$ 0</p>
                  <p className="text-xs text-neutral-400">Sem taxa inicial de adesão ou ativação</p>
                </div>

                <div className="p-5 rounded-2xl bg-neutral-950/80 border border-neutral-800 text-center sm:text-left space-y-1">
                  <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Mensalidade</span>
                  <p className="text-3xl sm:text-4xl font-black text-emerald-400">R$ 0</p>
                  <p className="text-xs text-neutral-400">Sem cobrança fixa mensal nem surpresas</p>
                </div>
              </div>

              {/* Texto Visível Explicativo Obrigatório */}
              <div className="p-5 rounded-2xl bg-neutral-800/40 border border-neutral-700/60 space-y-2">
                <p className="text-sm sm:text-base text-neutral-200 font-semibold leading-relaxed">
                  A plataforma é mantida por uma taxa de serviço de R$ 0,99 por pedido, paga pelo consumidor e informada antes da confirmação.
                </p>
                <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                  Quando sua loja recebe o pagamento completo do pedido, repassa à plataforma as taxas arrecadadas, conforme o período combinado.
                </p>
              </div>

              {/* Lista de Benefícios */}
              <div className="space-y-3 pt-2">
                <h3 className="font-bold text-sm text-neutral-200">O que está incluído para a sua loja:</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm text-neutral-300">
                  <div className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Cardápio digital com link próprio e QR Code</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Painel de pedidos em tempo real com som</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Envio automático direto para o WhatsApp</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Sem limite de produtos, fotos ou categorias</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Impressão automática em comandas 58mm e 80mm</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Zero comissão percentual sobre as suas vendas</span>
                  </div>
                </div>
              </div>

              {/* Botão de CTA do Plano */}
              <div className="pt-4 text-center sm:text-left">
                <a
                  href={SALES_WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-base font-black shadow-xl shadow-emerald-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span>Quero cadastrar minha loja</span>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* 5. FAQ COMPACTO */}
        <section className="py-16 sm:py-20 border-b border-neutral-800 bg-neutral-900/30">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-8">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-400 uppercase tracking-wider">
                <HelpCircle className="w-4 h-4 text-rose-500" />
                <span>Perguntas Frequentes</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Tire suas dúvidas antes de começar
              </h2>
            </div>

            <div className="space-y-3">
              {faqItems.map((item, idx) => {
                const isOpen = faqOpenIndex === idx;
                return (
                  <div
                    key={idx}
                    className="rounded-2xl bg-neutral-900 border border-neutral-800 overflow-hidden transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => toggleFaq(idx)}
                      className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-bold text-sm text-neutral-200 hover:text-white cursor-pointer"
                    >
                      <span>{item.q}</span>
                      <ChevronDown
                        className={`w-4 h-4 text-neutral-400 transition-transform duration-200 flex-shrink-0 ${
                          isOpen ? 'rotate-180 text-rose-400' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 sm:px-5 sm:pb-5 text-xs sm:text-sm text-neutral-400 leading-relaxed border-t border-neutral-800/60 pt-3">
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {/* 6. RODAPÉ */}
      <footer className="py-8 bg-neutral-950 border-t border-neutral-900 text-neutral-500 text-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} Pede AI • Plataforma de Delivery e Cardápio Digital.</p>
          <div className="flex items-center gap-4 text-neutral-400">
            <Link to="/privacidade" className="hover:text-white transition-colors">
              Privacidade
            </Link>
            <span>•</span>
            <Link to="/entrar" className="hover:text-white transition-colors">
              Painel do Lojista
            </Link>
            <span>•</span>
            <a
              href={SALES_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-emerald-400 transition-colors flex items-center gap-1"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Suporte Comercial</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
