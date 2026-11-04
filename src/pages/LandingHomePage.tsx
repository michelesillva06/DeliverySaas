import React from 'react';
import { Link } from 'react-router-dom';
import {
  UtensilsCrossed,
  Smartphone,
  QrCode,
  Bell,
  CheckCircle2,
  ArrowRight,
  Printer,
  Sparkles,
  MessageCircle,
  Sliders,
  TrendingUp,
  Monitor,
  Check,
  Store,
  Clock,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  Bike,
  ShoppingBag,
} from 'lucide-react';
import { SUPPORT_WHATSAPP, SUPPORT_MESSAGE_NEW_STORE, getWhatsAppSupportLink } from '../lib/constants';

const SALES_WHATSAPP_URL = getWhatsAppSupportLink(SUPPORT_WHATSAPP, SUPPORT_MESSAGE_NEW_STORE);

export const LandingHomePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col selection:bg-rose-500 selection:text-white font-sans">
      {/* Header de Navegação Comercial */}
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

          <div className="flex items-center gap-2.5 sm:gap-4">
            <Link
              to="/bora-de-acai"
              className="hidden sm:flex px-3.5 py-2 text-xs font-bold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl transition-colors items-center gap-1.5"
            >
              <span>Demonstração</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
            <Link
              to="/entrar"
              className="px-3.5 py-2 text-xs sm:text-sm font-bold text-neutral-300 hover:text-white hover:bg-neutral-900 rounded-xl transition-colors"
            >
              Entrar
            </Link>
            <a
              href={SALES_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 sm:px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs sm:text-sm font-black shadow-lg shadow-rose-600/30 hover:shadow-rose-600/50 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Quero minha loja</span>
            </a>
          </div>
        </div>
      </header>

      {/* Hero Principal */}
      <main className="flex-1">
        <section className="relative overflow-hidden pt-12 pb-16 sm:pt-20 sm:pb-24 border-b border-neutral-800">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-rose-950/40 via-neutral-950 to-neutral-950 pointer-events-none" />

          <div className="max-w-6xl mx-auto px-4 sm:px-6 relative space-y-12">
            <div className="text-center space-y-6 max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold tracking-wide">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Cardápio Digital & Painel de Pedidos para Delivery</span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.12]">
                Seu cardápio digital com pedidos organizados em um só painel
              </h1>

              <p className="text-sm sm:text-base text-neutral-400 leading-relaxed font-medium max-w-2xl mx-auto">
                Seu cliente escolhe, finaliza o pedido e segue para o WhatsApp da sua loja. Você acompanha tudo pelo painel de pedidos sem comissão por venda.
              </p>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 max-w-md mx-auto">
                <Link
                  to="/bora-de-acai"
                  className="w-full sm:w-auto px-7 py-3.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-2xl text-sm font-bold border border-neutral-700 shadow-lg hover:border-neutral-500 transition-all flex items-center justify-center gap-2"
                >
                  <Smartphone className="w-4 h-4 text-rose-400" />
                  <span>Testar demonstração</span>
                </Link>

                <a
                  href={SALES_WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-7 py-3.5 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-sm font-black shadow-xl shadow-rose-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Quero minha loja</span>
                </a>
              </div>
            </div>

            {/* Apresentação Lado a Lado / Empilhada em Mobile: Celular + Computador */}
            <div className="pt-4 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center max-w-5xl mx-auto">
              {/* Celular: Mockup do Cardápio do Cliente */}
              <div className="lg:col-span-5 flex flex-col items-center">
                <div className="w-full max-w-[310px] bg-neutral-900 border-4 border-neutral-800 rounded-[36px] p-3 shadow-2xl shadow-rose-950/20 relative">
                  {/* Notch */}
                  <div className="w-28 h-4 bg-neutral-800 rounded-b-xl mx-auto mb-3 flex items-center justify-center">
                    <div className="w-3 h-3 rounded-full bg-neutral-950" />
                  </div>

                  {/* Tela do Cardápio */}
                  <div className="bg-neutral-950 rounded-[24px] p-3.5 text-left space-y-3 border border-neutral-800">
                    <div className="flex items-center gap-2 pb-2 border-b border-neutral-800">
                      <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center font-black text-xs text-white">
                        BA
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white leading-none">Bora de Açaí</p>
                        <span className="text-[10px] text-emerald-400 font-bold">● Aberto Agora</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="p-2 bg-neutral-900 rounded-xl border border-neutral-800 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-white">Açaí Tradicional 500ml</p>
                          <p className="text-[10px] text-neutral-400">Com leite em pó e banana</p>
                          <p className="text-xs font-extrabold text-rose-400 mt-1">R$ 22,00</p>
                        </div>
                        <span className="px-2 py-1 bg-rose-600 text-white rounded-lg text-[10px] font-bold">
                          + Adicionar
                        </span>
                      </div>

                      <div className="p-2 bg-neutral-900 rounded-xl border border-neutral-800 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-white">Copo da Felicidade 700ml</p>
                          <p className="text-[10px] text-neutral-400">Nutella, morango e M&Ms</p>
                          <p className="text-xs font-extrabold text-rose-400 mt-1">R$ 32,00</p>
                        </div>
                        <span className="px-2 py-1 bg-rose-600 text-white rounded-lg text-[10px] font-bold">
                          + Adicionar
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-neutral-800 flex items-center justify-between bg-rose-950/40 p-2.5 rounded-xl border border-rose-900/50">
                      <div>
                        <p className="text-[10px] text-neutral-300 font-medium">Sacola do Cliente</p>
                        <p className="text-xs font-black text-white">Total: R$ 54,00</p>
                      </div>
                      <span className="px-3 py-1.5 bg-emerald-600 text-white text-[11px] font-bold rounded-lg flex items-center gap-1">
                        <MessageCircle className="w-3 h-3" />
                        <span>Enviar no WhatsApp</span>
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-neutral-400 font-medium mt-3 text-center">
                  📱 Visão do Cliente no Celular
                </p>
              </div>

              {/* Computador: Mockup do Painel do Lojista */}
              <div className="lg:col-span-7 flex flex-col items-center">
                <div className="w-full bg-neutral-900 border-2 border-neutral-800 rounded-2xl p-3 sm:p-4 shadow-2xl relative">
                  {/* Barra do Navegador */}
                  <div className="flex items-center gap-1.5 pb-3 mb-3 border-b border-neutral-800">
                    <span className="w-3 h-3 rounded-full bg-rose-500" />
                    <span className="w-3 h-3 rounded-full bg-amber-500" />
                    <span className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-[11px] text-neutral-400 font-mono ml-2 truncate">
                      https://pedeai.app/painel/pedidos
                    </span>
                  </div>

                  {/* Kanban em Miniatura */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-3 text-left">
                    {/* Coluna Novos */}
                    <div className="bg-neutral-950 p-2 sm:p-3 rounded-xl border border-neutral-800 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold text-rose-400">
                        <span>NOVOS (1)</span>
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                      </div>
                      <div className="p-2 bg-neutral-900 rounded-lg border border-rose-500/30 text-[11px] space-y-1">
                        <p className="font-bold text-white">#1042 • Maria S.</p>
                        <p className="text-[10px] text-neutral-400">1x Açaí 500ml</p>
                        <div className="flex justify-between items-center text-[10px] font-bold pt-1">
                          <span className="text-amber-400">Pix Pendente</span>
                          <span className="text-white">R$ 22,00</span>
                        </div>
                      </div>
                    </div>

                    {/* Coluna Em Preparo */}
                    <div className="bg-neutral-950 p-2 sm:p-3 rounded-xl border border-neutral-800 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold text-amber-400">
                        <span>PREPARO (1)</span>
                      </div>
                      <div className="p-2 bg-neutral-900 rounded-lg border border-neutral-800 text-[11px] space-y-1">
                        <p className="font-bold text-white">#1041 • Carlos F.</p>
                        <p className="text-[10px] text-neutral-400">2x Copo Felicidade</p>
                        <div className="flex justify-between items-center text-[10px] font-bold pt-1">
                          <span className="text-emerald-400">Pix Confirmado</span>
                          <span className="text-white">R$ 64,00</span>
                        </div>
                      </div>
                    </div>

                    {/* Coluna Saiu p/ Entrega */}
                    <div className="bg-neutral-950 p-2 sm:p-3 rounded-xl border border-neutral-800 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold text-indigo-400">
                        <span>ENTREGA (1)</span>
                      </div>
                      <div className="p-2 bg-neutral-900 rounded-lg border border-neutral-800 text-[11px] space-y-1">
                        <p className="font-bold text-white">#1040 • Ana B.</p>
                        <p className="text-[10px] text-neutral-400">Motoboy: Marcos</p>
                        <div className="flex justify-between items-center text-[10px] font-bold pt-1">
                          <span className="text-sky-400">Cartão Entrega</span>
                          <span className="text-white">R$ 38,00</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-neutral-400 font-medium mt-3 text-center">
                  💻 Painel do Lojista em Tempo Real
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Seção "VEJA COMO FUNCIONA" */}
        <section className="py-16 sm:py-24 bg-neutral-900/50 border-b border-neutral-800">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-12 text-center">
            <div className="space-y-3 max-w-xl mx-auto">
              <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
                Veja como funciona em 3 passos simples
              </h2>
              <p className="text-sm text-neutral-400">
                Uma jornada sem atrito para o seu cliente e 100% sob controle da sua cozinha.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
              {/* Passo 1 */}
              <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4 relative">
                <span className="w-10 h-10 rounded-2xl bg-rose-600 text-white font-black text-lg flex items-center justify-center shadow-lg shadow-rose-600/30">
                  1
                </span>
                <h3 className="text-lg font-bold text-white">Cliente Escolhe os Produtos</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  O cliente acessa seu link próprio pelo celular ou QR Code, navega pelas categorias, escolhe adicionais obrigatórios e opcionais e adiciona ao carrinho.
                </p>
              </div>

              {/* Passo 2 */}
              <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4 relative">
                <span className="w-10 h-10 rounded-2xl bg-rose-600 text-white font-black text-lg flex items-center justify-center shadow-lg shadow-rose-600/30">
                  2
                </span>
                <h3 className="text-lg font-bold text-white">Finaliza e Segue para o WhatsApp</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Ao confirmar o pedido, os dados são gravados com segurança no banco de dados e o cliente é direcionado ao WhatsApp da sua loja com o resumo pré-preenchido.
                </p>
              </div>

              {/* Passo 3 */}
              <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4 relative">
                <span className="w-10 h-10 rounded-2xl bg-rose-600 text-white font-black text-lg flex items-center justify-center shadow-lg shadow-rose-600/30">
                  3
                </span>
                <h3 className="text-lg font-bold text-white">Sua Loja Administra no Painel</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Seu painel toca o alerta de novo pedido instantaneamente. Você aceita, envia para a cozinha, atribui entregadores e imprime comandas com 1 clique.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Modelo Comercial Transparente - R$ 0 de Mensalidade */}
        <section className="py-16 sm:py-24 border-b border-neutral-800 relative bg-neutral-950">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-12 text-center">
            <div className="space-y-3 max-w-2xl mx-auto">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Zero Risco para seu Estabelecimento</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                Cardápio digital com implantação e mensalidade grátis
              </h2>
              <p className="text-sm text-neutral-400 leading-relaxed">
                Nosso modelo padrão é mantido por uma taxa de serviço de R$ 0,99 por pedido, paga pelo consumidor e apresentada antes da confirmação. Se você recebe o pagamento integral do pedido, repassa à plataforma as taxas arrecadadas no período combinado.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
              {/* Modalidade Diária */}
              <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 hover:border-emerald-500/40 transition-all space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="inline-block px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-xs font-bold border border-emerald-500/20">
                    Frequência de Repasse
                  </div>
                  <h3 className="text-xl font-black text-white">Modalidade Diária</h3>
                  <p className="text-sm text-neutral-400 leading-relaxed">
                    Apuração e fechamento diário do repasse. O lojista repassa as taxas arrecadadas dos pedidos do dia anterior.
                  </p>
                </div>

                <ul className="space-y-2 text-xs text-neutral-300 pt-3 border-t border-neutral-800">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Fechamento diário</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Implantação e mensalidade R$ 0,00</span>
                  </li>
                </ul>
              </div>

              {/* Modalidade Semanal */}
              <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 hover:border-rose-500/40 transition-all space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="inline-block px-3 py-1 bg-rose-500/10 text-rose-400 rounded-full text-xs font-bold border border-rose-500/20">
                    Frequência de Repasse
                  </div>
                  <h3 className="text-xl font-black text-white">Modalidade Semanal</h3>
                  <p className="text-sm text-neutral-400 leading-relaxed">
                    Apuração e fechamento semanal. O lojista consolida e repassa as taxas da semana no dia acordado.
                  </p>
                </div>

                <ul className="space-y-2 text-xs text-neutral-300 pt-3 border-t border-neutral-800">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    <span>Fechamento semanal</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    <span>Implantação e mensalidade R$ 0,00</span>
                  </li>
                </ul>
              </div>

              {/* Modalidade Quinzenal */}
              <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 hover:border-indigo-500/40 transition-all space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="inline-block px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-full text-xs font-bold border border-indigo-500/20">
                    Frequência de Repasse
                  </div>
                  <h3 className="text-xl font-black text-white">Modalidade Quinzenal</h3>
                  <p className="text-sm text-neutral-400 leading-relaxed">
                    Apuração quinzenal: 2 fechamentos no mês (dia 1-15, dia 16-fim). Maior prazo para o repasse das taxas.
                  </p>
                </div>

                <ul className="space-y-2 text-xs text-neutral-300 pt-3 border-t border-neutral-800">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <span>2 acertos no mês</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <span>Implantação e mensalidade R$ 0,00</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Demonstração do Cardápio Público */}
        <section className="py-16 sm:py-24 border-b border-neutral-800 relative">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold">
              <Store className="w-3.5 h-3.5" />
              <span>Experimente na Prática</span>
            </div>

            <div className="space-y-3 max-w-2xl mx-auto">
              <h2 className="text-2xl sm:text-4xl font-black text-white">
                Demonstração do Cardápio Digital
              </h2>
              <p className="text-sm text-neutral-400 leading-relaxed">
                Navegue pela loja demonstrativa <strong>Bora de Açaí</strong>. Monte seu pedido, escolha complementos, veja a taxa de entrega por bairro e o fluxo de checkout.
              </p>
            </div>

            <div className="p-6 sm:p-8 rounded-3xl bg-neutral-900 border border-neutral-800 max-w-xl mx-auto space-y-5 text-left shadow-xl">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-purple-600 flex items-center justify-center text-white font-black text-xl shadow-lg">
                  BA
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Bora de Açaí — Loja Demo</h3>
                  <p className="text-xs text-neutral-400">Cardápio público aberto para simulação</p>
                  <span className="inline-block mt-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-[10px] font-bold">
                    Ambiente de Demonstração
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-xs text-neutral-400 pt-2 border-t border-neutral-800">
                <p className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Navegação por categorias e busca rápida</span>
                </p>
                <p className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Grupos de adicionais obrigatórios e opcionais</span>
                </p>
                <p className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Pix com QR Code e Copia e Cola</span>
                </p>
              </div>

              <div className="pt-3">
                <Link
                  to="/bora-de-acai"
                  className="w-full py-3.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black shadow-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <span>Experimentar o Cardápio Demonstração</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Recursos Técnicos da Plataforma */}
        <section className="py-16 sm:py-24 bg-neutral-900/40">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-12">
            <div className="text-center space-y-3">
              <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
                Recursos Prontos para Alavancar sua Operação
              </h2>
              <p className="text-sm sm:text-base text-neutral-400 max-w-xl mx-auto">
                Tudo configurado pela própria loja, no seu ritmo e sem complicações.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Card 1 */}
              <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center">
                  <QrCode className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Pix com QR Code e Copia e Cola</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Gere cobranças Pix personalizadas com sua chave. O cliente paga pelo banco e você confere no painel.
                </p>
              </div>

              {/* Card 2 */}
              <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                  <Bike className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Gestão de Entregadores</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Cadastre sua equipe de entregadores, atribua pedidos e notifique com 1 toque no WhatsApp com a rota do GPS.
                </p>
              </div>

              {/* Card 3 */}
              <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                  <Printer className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Impressão de Comanda Térmica</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Impressão organizada em 58mm e 80mm com vias separadas para a cozinha e para o cliente/motoboy.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Final */}
        <section className="py-16 sm:py-24 border-t border-neutral-800 relative overflow-hidden">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-6">
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
              Pronto para modernizar o delivery do seu negócio?
            </h2>
            <p className="text-neutral-400 text-sm sm:text-base max-w-xl mx-auto">
              Fale com nossa equipe no WhatsApp comercial e tenha sua loja pronta para receber pedidos hoje mesmo.
            </p>
            <div className="pt-2">
              <a
                href={SALES_WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 px-8 py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-sm font-black shadow-xl shadow-rose-600/30 hover:scale-105 active:scale-95 transition-all"
              >
                <MessageCircle className="w-5 h-5" />
                <span>Solicitar Minha Loja no WhatsApp</span>
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-900 py-8 bg-neutral-950 text-neutral-500 text-xs text-center">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} Pede AI • Plataforma de Delivery e Cardápio Digital.</p>
          <div className="flex items-center gap-4 text-neutral-400">
            <Link to="/privacidade" className="hover:text-white transition-colors">
              Política de Privacidade
            </Link>
            <span>•</span>
            <Link to="/entrar" className="hover:text-white transition-colors">
              Área do Lojista
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
