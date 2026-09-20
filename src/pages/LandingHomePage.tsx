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
} from 'lucide-react';

const SALES_WHATSAPP_NUMBER = '5592984550000';
const SALES_WHATSAPP_MESSAGE = encodeURIComponent('Olá! Gostaria de contratar o sistema para o meu estabelecimento.');
const SALES_WHATSAPP_URL = `https://wa.me/${SALES_WHATSAPP_NUMBER}?text=${SALES_WHATSAPP_MESSAGE}`;

export const LandingHomePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col selection:bg-rose-500 selection:text-white">
      {/* Header de Navegação */}
      <header className="border-b border-neutral-800/80 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-2xl bg-rose-600 flex items-center justify-center text-white shadow-lg shadow-rose-600/30 group-hover:scale-105 transition-transform">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-white block leading-none">
                DeliverySaaS
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-400">
                Cardápio & Pedidos
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              to="/entrar"
              className="px-4 py-2 text-xs sm:text-sm font-bold text-neutral-300 hover:text-white hover:bg-neutral-900 rounded-xl transition-colors"
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

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative overflow-hidden pt-16 pb-20 sm:pt-24 sm:pb-28 border-b border-neutral-800">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-rose-950/40 via-neutral-950 to-neutral-950 pointer-events-none" />
          
          <div className="max-w-5xl mx-auto px-4 sm:px-6 relative text-center space-y-8">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold tracking-wide animate-fade-in">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Plataforma Completa para Restaurantes, Hamburguerias e Pizzarias</span>
            </div>

            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white max-w-4xl mx-auto leading-[1.08]">
              Seu cardápio digital próprio,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-rose-500 to-amber-400">
                sem comissões por pedido.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-neutral-400 max-w-2xl mx-auto leading-relaxed font-medium">
              Receba pedidos automáticos pelo WhatsApp, aceite pagamentos via Pix com verificação instantânea, gerencie a cozinha com Kanban em tempo real e imprima comandas térmicas com 1 clique.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 max-w-md mx-auto">
              <a
                href={SALES_WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-8 py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-sm font-black shadow-xl shadow-rose-600/30 hover:shadow-rose-600/50 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2.5"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Quero Minha Loja</span>
                <ArrowRight className="w-4 h-4" />
              </a>
              
              <Link
                to="/entrar"
                className="w-full sm:w-auto px-7 py-4 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white rounded-2xl text-sm font-bold border border-neutral-800 transition-all flex items-center justify-center"
              >
                Entrar no Painel
              </Link>
            </div>

            <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-neutral-400 font-medium">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Implantação guiada completa</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Mensalidade fixa sem pegadinhas</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Sem taxa ou comissão por pedido</span>
              </div>
            </div>
          </div>
        </section>

        {/* Recursos Principais */}
        <section className="py-20 bg-neutral-900/40">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-12">
            <div className="text-center space-y-3">
              <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
                Tudo o que seu delivery precisa para faturar mais
              </h2>
              <p className="text-sm sm:text-base text-neutral-400 max-w-xl mx-auto">
                Desenvolvido sob medida para a rotina intensa de cozinhas, entregas e atendimento rápido.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Card 1 */}
              <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4 hover:border-neutral-700 transition-colors">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
                  <Smartphone className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white">Cardápio Web App (PWA)</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Seus clientes acessam pelo link ou QR code da mesa, sem precisar baixar nenhum aplicativo pesado. Carregamento ultrarrápido com fotos, adicionais e categorias.
                </p>
              </div>

              {/* Card 2 */}
              <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4 hover:border-neutral-700 transition-colors">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <QrCode className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white">Pix Automatizado</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Geração de QR Code e chave Copia e Cola Pix direto para sua conta bancária. Seu cliente paga em segundos sem complicação e o dinheiro cai direto para você.
                </p>
              </div>

              {/* Card 3 */}
              <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4 hover:border-neutral-700 transition-colors">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Bell className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white">Painel Kanban com Alarme</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Gestão em tempo real de novos pedidos, em preparo, prontos e entregues. Alarme sonoro contínuo para você nunca perder um pedido enquanto estiver atendendo.
                </p>
              </div>

              {/* Card 4 */}
              <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4 hover:border-neutral-700 transition-colors">
                <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
                  <Printer className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white">Impressão de Comanda Térmica</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Compatível com impressoras térmicas de 58mm e 80mm. Comanda organizada com dados do cliente, endereço, itens, adicionais e valor para envio direto à cozinha.
                </p>
              </div>

              {/* Card 5 */}
              <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4 hover:border-neutral-700 transition-colors">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Sliders className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white">Cardápio & Adicionais Flexíveis</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Crie grupos de complementos obrigatórios ou opcionais (ponto da carne, molhos extras, bordas recheadas, bebidas) com limites mínimos e máximos.
                </p>
              </div>

              {/* Card 6 */}
              <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4 hover:border-neutral-700 transition-colors">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white">Relatórios & Base de Clientes</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Acompanhe ticket médio, faturamento diário e mensal, produtos mais vendidos e fidelize sua base de clientes com histórico completo de pedidos.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Banner CTA Final */}
        <section className="py-16 sm:py-24 border-t border-neutral-800 relative overflow-hidden">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-6">
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
              Pronto para modernizar o delivery do seu negócio?
            </h2>
            <p className="text-neutral-400 text-sm sm:text-base max-w-xl mx-auto">
              Fale com nossa equipe de consultores no WhatsApp e solicite a implantação da sua loja.
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
          <p>© {new Date().getFullYear()} DeliverySaaS • Plataforma de Delivery e Cardápio Digital.</p>
          <div className="flex items-center gap-4 text-neutral-400">
            <Link to="/entrar" className="hover:text-white transition-colors">
              Área do Lojista
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
