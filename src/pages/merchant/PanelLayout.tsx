import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Utensils,
  Settings,
  Tag,
  Bike,
  Users,
  BarChart3,
  CreditCard,
  Volume2,
  VolumeX,
  ExternalLink,
  Power,
  Store as StoreIcon,
  LogOut,
  Bell,
  Menu,
  X,
  ShieldAlert,
  AlertTriangle,
  MessageCircle,
  ArrowLeft,
  Crown,
} from 'lucide-react';
import { useAuth } from '../../services/authContext';
import { useActiveStore } from '../../services/activeStoreContext';
import { SUPPORT_WHATSAPP, SUPPORT_MESSAGE_HELP, getWhatsAppSupportLink } from '../../lib/constants';
import {
  getStoreFromFirestore,
  subscribeToStore,
  updateStoreStatusInFirestore,
  subscribeToOrdersByStore,
} from '../../services/firestoreService';
import { Store, Order, isMasterRole } from '../../types';
import { toggleMute, getIsMuted, startOrderAlarmLoop, stopOrderAlarmLoop, startTitleBlink, stopTitleBlink } from '../../lib/sound';
import { useToast } from '../../components/Toast';

export const PanelLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const { activeStoreId, clearActiveStore } = useActiveStore();
  const { showToast } = useToast();

  const [store, setStore] = useState<Store | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMutedState, setIsMutedState] = useState(() => getIsMuted());
  const [newOrdersCount, setNewOrdersCount] = useState(0);

  const isSuperAdmin = isMasterRole(currentUser?.role);
  const effectiveStoreId = isSuperAdmin ? activeStoreId : currentUser?.storeId || null;

  useEffect(() => {
    if (!effectiveStoreId) return;

    // Buscar inicial do Firestore
    getStoreFromFirestore(effectiveStoreId).then((st) => {
      if (st) {
        // Verificar se a data de vencimento passou e marcar como 'vencida' se estivesse 'ativa'
        if (st.dataVencimento && st.status === 'ativa') {
          const vence = new Date(st.dataVencimento);
          if (!isNaN(vence.getTime()) && vence < new Date()) {
            st.status = 'vencida';
            updateStoreStatusInFirestore(st.id, 'vencida' as any).catch(console.error);
          }
        }
        setStore(st);
      }
    });

    // Escutar Loja em tempo real do Firestore
    const unsubStore = subscribeToStore(effectiveStoreId, (updated) => {
      if (updated) {
        if (updated.dataVencimento && updated.status === 'ativa') {
          const vence = new Date(updated.dataVencimento);
          if (!isNaN(vence.getTime()) && vence < new Date()) {
            updated.status = 'vencida';
            updateStoreStatusInFirestore(updated.id, 'vencida' as any).catch(console.error);
          }
        }
        setStore(updated);
      }
    });

    // Escutar novos pedidos em tempo real do Firestore para tocar alarme e piscar título
    const unsubOrders = subscribeToOrdersByStore(effectiveStoreId, (orders) => {
      const pendingNovos = orders.filter((o) => o.status === 'novo');
      setNewOrdersCount(pendingNovos.length);

      if (pendingNovos.length > 0) {
        startOrderAlarmLoop();
        startTitleBlink(`🔔 ${pendingNovos.length} NOVO(S) PEDIDO(S)!`);
      } else {
        stopOrderAlarmLoop();
        stopTitleBlink();
      }
    });

    return () => {
      unsubStore();
      unsubOrders();
      stopOrderAlarmLoop();
      stopTitleBlink();
    };
  }, [effectiveStoreId]);

  const handleToggleStoreOpen = async () => {
    if (!store) return;
    const novoStatus = !store.aberta;
    try {
      await updateStoreStatusInFirestore(store.id, novoStatus);
      const updated: Store = { ...store, aberta: novoStatus };
      setStore(updated);
      showToast(novoStatus ? 'Loja aberta para novos pedidos!' : 'Loja pausada temporariamente.', 'info');
    } catch (err) {
      console.error(err);
      showToast('Erro ao alternar status da loja no Firestore.', 'error');
    }
  };

  const handleToggleMute = () => {
    const muted = toggleMute();
    setIsMutedState(muted);
    showToast(muted ? 'Alerta sonoro silenciado.' : 'Alerta sonoro ativado.', 'info');
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navItems = [
    { label: 'Pedidos ao Vivo', path: '/painel', icon: LayoutDashboard, badge: newOrdersCount },
    { label: 'Cardápio Digital', path: '/painel/cardapio', icon: Utensils },
    { label: 'Configurações', path: '/painel/configuracoes', icon: Settings },
    { label: 'Cupons de Desconto', path: '/painel/cupons', icon: Tag, statusTag: 'Em breve' },
    { label: 'Entregadores', path: '/painel/entregadores', icon: Bike, statusTag: 'Em breve' },
    { label: 'Clientes (CRM)', path: '/painel/clientes', icon: Users },
    { label: 'Relatórios & Vendas', path: '/painel/relatorios', icon: BarChart3 },
    { label: 'Minha Assinatura', path: '/painel/minha-assinatura', icon: CreditCard },
  ];

  if (!store) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-neutral-100">
        <StoreIcon className="w-12 h-12 text-neutral-400 mb-2" />
        <h2 className="text-lg font-bold text-neutral-800">Nenhuma loja vinculada a este usuário</h2>
        <p className="text-xs text-neutral-500 mt-1 text-center max-w-sm">Entre em contato com o suporte para vincular sua loja ao Pede AI.</p>
        <div className="flex flex-col sm:flex-row gap-2 mt-4">
          <a
            href={getWhatsAppSupportLink(SUPPORT_WHATSAPP, 'Olá! Minha conta não possui uma loja vinculada na plataforma Pede AI. Podem me ajudar?')}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Falar com o suporte</span>
          </a>
          <button onClick={handleLogout} className="px-4 py-2 bg-neutral-900 text-white rounded-xl text-xs font-bold">
            Sair
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 flex flex-col">
      {/* Banner Fixo SuperAdmin Gerenciando Loja */}
      {isSuperAdmin && activeStoreId && (
        <div className="bg-amber-400 text-neutral-950 px-4 py-2 flex flex-wrap items-center justify-between gap-2 shadow-sm font-bold text-xs sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-neutral-900 flex-shrink-0" />
            <span>
              Você está gerenciando: <strong>{store.nome}</strong> (modo administrador)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/#/${store.slug}`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg transition-colors flex items-center gap-1.5 text-[11px]"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Ver cardápio público</span>
            </a>
            <button
              onClick={() => {
                clearActiveStore();
                navigate('/admin');
              }}
              className="px-3 py-1 bg-white hover:bg-neutral-100 text-neutral-900 border border-neutral-300 rounded-lg transition-colors text-[11px] cursor-pointer"
            >
              Sair da loja
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Barra Lateral Desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-neutral-200 flex-shrink-0 min-h-screen sticky top-0 h-screen">
        {/* Identificação da Loja */}
        <div className="p-4 border-b border-neutral-200 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-neutral-100 flex-shrink-0 border border-neutral-200">
            {store.logo ? (
              <img src={store.logo} alt={store.nome} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-bold text-neutral-500">
                {store.nome.slice(0, 2)}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-sm text-neutral-900 truncate leading-tight">{store.nome}</h2>
            <span className="text-[11px] text-neutral-500 font-mono">/{store.slug}</span>
          </div>
        </div>

        {/* Status de Abertura da Loja */}
        <div className="p-3 border-b border-neutral-200 bg-neutral-50">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider">Status do Delivery</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                store.aberta ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}
            >
              {store.aberta ? 'Aberta' : 'Pausada'}
            </span>
          </div>

          <button
            onClick={handleToggleStoreOpen}
            className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              store.aberta
                ? 'bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100'
                : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>{store.aberta ? 'Pausar Pedidos (Fechar)' : 'Abrir Loja Agora'}</span>
          </button>
        </div>

        {/* Navegação Principal */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-neutral-900 text-white shadow-xs'
                    : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {item.statusTag && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-neutral-200 text-neutral-600">
                      {item.statusTag}
                    </span>
                  )}
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
                      {item.badge}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Rodapé da Sidebar */}
        <div className="p-3 border-t border-neutral-200 bg-neutral-50 space-y-2">
          {/* Link para o Cardápio do Cliente */}
          <a
            href={`/#/${store.slug}`}
            target="_blank"
            rel="noreferrer"
            className="w-full py-2 px-3 bg-white border border-neutral-200 hover:bg-neutral-100 rounded-xl text-xs font-semibold text-neutral-700 flex items-center justify-between transition-colors"
          >
            <span>Ver Cardápio do Cliente</span>
            <ExternalLink className="w-3.5 h-3.5 text-neutral-400" />
          </a>

          {/* Link Suporte Pede AI */}
          <a
            href={getWhatsAppSupportLink(SUPPORT_WHATSAPP, SUPPORT_MESSAGE_HELP)}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2 px-3 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold flex items-center justify-between transition-colors"
          >
            <div className="flex items-center gap-2">
              <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>Suporte Pede AI</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-emerald-500" />
          </a>

          {/* Super Admin Shortcut if role is superadmin */}
          {currentUser?.role === 'superadmin' && (
            <Link
              to="/admin"
              className="w-full py-2 px-3 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors"
            >
              <ShieldAlert className="w-4 h-4 text-amber-700" />
              <span>Painel Super Admin</span>
            </Link>
          )}

          {/* Usuário e Sair */}
          <div className="pt-2 border-t border-neutral-200 flex items-center justify-between text-xs text-neutral-600">
            <span className="truncate max-w-[120px]" title={currentUser?.email}>
              {currentUser?.nome || currentUser?.email}
            </span>
            <button
              onClick={handleLogout}
              className="p-1.5 hover:bg-neutral-200 rounded-lg text-neutral-500 hover:text-rose-600 transition-colors"
              title="Sair da Conta"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Conteúdo Central e Cabeçalho Superior */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Banner de Simulação Master / Acesso como Loja */}
        {isSuperAdmin && (
          <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 text-neutral-950 px-4 py-2.5 text-xs font-bold flex flex-wrap items-center justify-between gap-2 shadow-sm z-40 border-b border-amber-600">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-neutral-950 text-amber-400 rounded-md font-black text-[10px] uppercase tracking-wider flex items-center gap-1">
                <Crown className="w-3 h-3 text-amber-400" />
                <span>Painel Master</span>
              </span>
              <span>
                Visualizando e operando como: <strong>{store.nome}</strong>{' '}
                <span className="font-mono text-[11px] opacity-80">(/{store.slug})</span>
              </span>
            </div>
            <button
              onClick={() => {
                clearActiveStore();
                navigate('/admin');
              }}
              className="px-3 py-1 bg-neutral-950 hover:bg-neutral-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs ml-auto"
              title="Voltar ao Painel Master"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
              <span>Voltar ao Painel Master</span>
            </button>
          </div>
        )}

        {/* Barra Superior Mobile e Desktop */}
        <header className="bg-white border-b border-neutral-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
          {/* Mobile Menu Toggle & Loja */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 rounded-lg text-neutral-600 hover:bg-neutral-100"
              aria-label="Abrir menu"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="lg:hidden flex items-center gap-2">
              <span className="font-black text-sm text-neutral-900 truncate max-w-[160px]">{store.nome}</span>
            </div>
            <span className="hidden lg:inline text-xs font-bold text-neutral-500">
              Painel de Gestão do Estabelecimento
            </span>
          </div>

          {/* Ações Rápidas: Som, Link do Cardápio */}
          <div className="flex items-center gap-2">
            {/* Botão de Silenciar / Ativar Som */}
            <button
              onClick={handleToggleMute}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${
                isMutedState
                  ? 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'
                  : 'bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100'
              }`}
              title={isMutedState ? 'Som desativado' : 'Som ativo para novos pedidos'}
            >
              {isMutedState ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isMutedState ? 'Mudo' : 'Som Ativo'}</span>
            </button>

            {/* Status Loja no Mobile */}
            <div className="lg:hidden">
              <button
                onClick={handleToggleStoreOpen}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                  store.aberta ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-700'
                }`}
              >
                {store.aberta ? 'Aberta' : 'Fechada'}
              </button>
            </div>

            {/* Acesso rápido ao Cardápio */}
            <a
              href={`/#/${store.slug}`}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center gap-1 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              <span>Ver Cardápio</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </header>

        {/* Área das Páginas */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          {store.status === 'vencida' && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 text-xs font-bold shadow-xs">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <span>Renove para voltar a receber pedidos. Sua loja está indisponível para os clientes no momento.</span>
              </div>
              <Link
                to="/painel/minha-assinatura"
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors flex-shrink-0"
              >
                Pagar / Renovar Assinatura
              </Link>
            </div>
          )}

          {store.status === 'aguardando_ativacao' && (
            <div className="mb-4 p-4 bg-sky-50 border border-sky-200 rounded-2xl flex items-center gap-2.5 text-sky-900 text-xs font-bold shadow-xs">
              <ShieldAlert className="w-5 h-5 text-sky-600 flex-shrink-0" />
              <span>Sua loja está aguardando liberação e ativação da equipe técnica/comercial.</span>
            </div>
          )}

          {store.status === 'bloqueada' && (
            <div className="mb-4 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-rose-900 text-xs font-bold shadow-xs">
              <ShieldAlert className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <span>Esta loja está bloqueada no momento. Entre em contato com o suporte.</span>
            </div>
          )}

          {/* Banner de Aviso: Pix Habilitado sem Teste */}
          {(store.pagamentos?.pix || store.pixKey) && !store.pixTestadoEm && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 text-xs font-bold shadow-xs">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <span>Você ainda não testou sua chave Pix. Teste antes de divulgar sua loja.</span>
              </div>
              <Link
                to="/painel/configuracoes?tab=pagamentos"
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors flex-shrink-0 shadow-xs"
              >
                Testar meu Pix
              </Link>
            </div>
          )}

          <Outlet context={{ store }} />
        </main>
      </div>

      {/* Menu Gaveta Mobile */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden bg-black/60 backdrop-blur-xs">
          <div className="bg-white w-64 h-full shadow-2xl flex flex-col p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <h3 className="font-bold text-sm text-neutral-900">{store.nome}</h3>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1 text-neutral-400 hover:text-neutral-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto space-y-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                      isActive ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {item.statusTag && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-neutral-200 text-neutral-600">
                          {item.statusTag}
                        </span>
                      )}
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white">
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </nav>

            <div className="pt-3 border-t border-neutral-200 space-y-2">
              <a
                href={`/#/${store.slug}`}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2 text-center bg-neutral-100 rounded-xl text-xs font-bold text-neutral-800 block"
              >
                Abrir Cardápio do Cliente
              </a>
              <a
                href={getWhatsAppSupportLink(SUPPORT_WHATSAPP, SUPPORT_MESSAGE_HELP)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2 text-center bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4 text-emerald-700" />
                <span>Suporte Pede AI</span>
              </a>
              <button
                onClick={handleLogout}
                className="w-full py-2 text-center bg-rose-50 text-rose-700 rounded-xl text-xs font-bold block"
              >
                Sair da Conta
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
