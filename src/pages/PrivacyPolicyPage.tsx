import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Lock, CheckCircle2 } from 'lucide-react';

export const PrivacyPolicyPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-neutral-950 text-white selection:bg-rose-500 selection:text-white pb-16">
      <header className="border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar ao Início</span>
          </Link>

          <div className="flex items-center gap-2 text-rose-500 font-black text-sm">
            <ShieldCheck className="w-5 h-5" />
            <span>Pede AI • Privacidade</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        <div className="space-y-3 text-center sm:text-left">
          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            Política de Privacidade e Proteção de Dados
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
            Sua privacidade é essencial para nós. Esta política descreve como os dados fornecidos durante a navegação e realização de pedidos são tratados na plataforma Pede AI.
          </p>
        </div>

        <div className="space-y-6 text-xs sm:text-sm text-neutral-300 leading-relaxed bg-neutral-900/60 p-6 rounded-3xl border border-neutral-800">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-rose-500" />
              <span>1. Finalidade do Tratamento de Dados</span>
            </h2>
            <p className="text-neutral-400">
              Ao realizar um pedido no cardápio de qualquer loja cadastrada, coletamos exclusivamente as informações necessárias para o processamento, preparo, comunicação e entrega do seu pedido (Nome, Telefone com DDD e Endereço de Entrega com ponto de referência).
            </p>
          </section>

          <section className="space-y-2 pt-4 border-t border-neutral-800/80">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>2. Base Legal (LGPD - Execução de Contrato)</span>
            </h2>
            <p className="text-neutral-400">
              Os dados de checkout são coletados com amparo no Art. 7º, V da Lei Geral de Proteção de Dados (Lei nº 13.709/2018 - LGPD), sendo estritamente necessários para a execução do contrato de compra e venda estabelecido entre o cliente e o estabelecimento escolhido.
            </p>
          </section>

          <section className="space-y-2 pt-4 border-t border-neutral-800/80">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span>3. Compartilhamento e Segurança</span>
            </h2>
            <p className="text-neutral-400">
              Seus dados de pedido são compartilhados <strong>exclusivamente com o estabelecimento parceiro</strong> escolhido e com o entregador atribuído à rota. A plataforma Pede AI não vende, não aluga e não compartilha dados pessoais com terceiros para fins de marketing não autorizado.
            </p>
          </section>

          <section className="space-y-2 pt-4 border-t border-neutral-800/80">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400" />
              <span>4. Transparência no Redirecionamento</span>
            </h2>
            <p className="text-neutral-400">
              Ao concluir o pedido, os detalhes da sua solicitação são gravados com segurança no banco de dados da loja e uma mensagem formatada com o resumo do pedido é preenchida no seu aplicativo do WhatsApp para que você possa acompanhar o atendimento de forma direta.
            </p>
          </section>
        </div>

        <div className="text-center pt-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition-colors shadow-lg shadow-rose-600/20"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para a Página Inicial</span>
          </Link>
        </div>
      </main>
    </div>
  );
};
