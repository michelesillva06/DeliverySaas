import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  UtensilsCrossed,
  Mail,
  Lock,
  ArrowRight,
  AlertCircle,
  Loader2,
  CheckCircle2,
  KeyRound,
  X,
} from 'lucide-react';
import { useAuth } from '../../services/authContext';
import { useToast } from '../../components/Toast';
import { isMasterRole } from '../../types';
import { SUPPORT_WHATSAPP, SUPPORT_MESSAGE_NEW_STORE, getWhatsAppSupportLink } from '../../lib/constants';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, sendPasswordReset } = useAuth();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Modal / Seção Esqueci Minha Senha
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotError, setForgotError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !senha) {
      setError('Preencha seu e-mail e sua senha.');
      return;
    }

    setLoading(true);
    try {
      const res = await login(email, senha);
      if (res.success) {
        if (isMasterRole(res.user?.role)) {
          showToast('Login de Administrador Master realizado com sucesso!', 'success');
          navigate('/admin');
        } else if (res.user?.storeId) {
          showToast(`Bem-vindo, ${res.user.nome || 'Lojista'}!`, 'success');
          navigate('/painel');
        } else {
          setError('Sua conta não possui uma loja vinculada. Entre em contato com a equipe.');
        }
      } else {
        setError(res.message || 'E-mail ou senha incorretos.');
      }
    } catch (err: any) {
      setError('Erro ao autenticar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    if (!forgotEmail.trim()) {
      setForgotError('Digite o e-mail cadastrado na sua loja.');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await sendPasswordReset(forgotEmail);
      if (res.success) {
        setForgotSuccess(res.message);
        showToast('Instruções enviadas para seu e-mail!', 'info');
      } else {
        setForgotError(res.message);
      }
    } catch (err) {
      setForgotError('Erro ao solicitar redefinição. Verifique o e-mail digitado.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col justify-center items-center p-4 py-12 selection:bg-rose-500 selection:text-white relative">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Cabeçalho */}
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex items-center gap-2 group mb-2">
            <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 group-hover:scale-105 transition-transform">
              <UtensilsCrossed className="w-6 h-6" />
            </div>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Entrar no Painel
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400">
            Acesse o painel de pedidos e gestão do seu delivery.
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-xl flex flex-col gap-2 animate-shake">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
              <span className="font-medium">{error}</span>
            </div>
            {error.includes('incorretos') && (
              <button
                type="button"
                onClick={() => {
                  setForgotEmail(email);
                  setShowForgotModal(true);
                }}
                className="text-left text-[11px] text-rose-200 hover:text-white underline font-bold mt-0.5 cursor-pointer"
              >
                Esqueceu sua senha? Clique aqui para redefini-la
              </button>
            )}
          </div>
        )}

        {/* Formulário de Email e Senha */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-neutral-300 mb-1">E-mail</label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu-email@restaurante.com"
                className="w-full p-3 pl-9 bg-neutral-950 border border-neutral-800 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 text-xs sm:text-sm"
              />
              <Mail className="w-4 h-4 text-neutral-500 absolute left-3 top-3.5" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-neutral-300">Senha</label>
              <button
                type="button"
                onClick={() => {
                  setForgotEmail(email);
                  setShowForgotModal(true);
                }}
                className="text-[11px] text-neutral-400 hover:text-rose-400 underline transition-colors"
              >
                Esqueci a senha
              </button>
            </div>
            <div className="relative">
              <input
                type="password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                className="w-full p-3 pl-9 bg-neutral-950 border border-neutral-800 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 text-xs sm:text-sm"
              />
              <Lock className="w-4 h-4 text-neutral-500 absolute left-3 top-3.5" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-rose-600/30 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>Entrar no Painel</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="pt-4 border-t border-neutral-800 text-center text-xs text-neutral-400">
          <span>Ainda não tem loja? </span>
          <a
            href={getWhatsAppSupportLink(SUPPORT_WHATSAPP, SUPPORT_MESSAGE_NEW_STORE)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-rose-400 hover:text-rose-300 underline transition-colors"
          >
            Fale com a gente
          </a>
        </div>
      </div>

      {/* Modal Esqueci a Senha */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl relative">
            <button
              onClick={() => {
                setShowForgotModal(false);
                setForgotSuccess('');
                setForgotError('');
              }}
              className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-white rounded-xl hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center mb-2">
                <KeyRound className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-white">Recuperar Senha</h2>
              <p className="text-xs text-neutral-400">
                Digite seu e-mail cadastrado. Enviaremos um link oficial do Firebase para você redefinir sua senha com segurança.
              </p>
            </div>

            {forgotSuccess ? (
              <div className="p-4 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs rounded-xl space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-200">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>E-mail enviado!</span>
                </div>
                <p>{forgotSuccess}</p>
                <button
                  onClick={() => setShowForgotModal(false)}
                  className="mt-3 w-full py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition-colors"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendResetPassword} className="space-y-4">
                {forgotError && (
                  <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{forgotError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-1">Seu E-mail</label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="seu-email@restaurante.com"
                    className="w-full p-3 bg-neutral-950 border border-neutral-800 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 text-xs sm:text-sm"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="w-1/3 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-bold transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {forgotLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <span>Enviar Link de Redefinição</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
