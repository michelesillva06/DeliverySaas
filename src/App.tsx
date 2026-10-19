import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './services/authContext';
import { ActiveStoreProvider, useActiveStore } from './services/activeStoreContext';
import { ToastProvider } from './components/Toast';
import { isMasterRole } from './types';

// Landing Page
import { LandingHomePage } from './pages/LandingHomePage';

// Customer Pages
import { StorefrontWrapper } from './pages/customer/StorefrontPage';
import { CheckoutWrapper } from './pages/customer/CheckoutPage';
import { OrderTrackingWrapper } from './pages/customer/OrderTrackingPage';

// Auth Pages
import { LoginPage } from './pages/auth/LoginPage';

// Merchant Pages
import { PanelLayout } from './pages/merchant/PanelLayout';
import { OrdersKanbanPage } from './pages/merchant/OrdersKanbanPage';
import { MenuManagementPage } from './pages/merchant/MenuManagementPage';
import { StoreSettingsPage } from './pages/merchant/StoreSettingsPage';
import { CouponsPage } from './pages/merchant/CouponsPage';
import { CouriersPage } from './pages/merchant/CouriersPage';
import { CustomersCrmPage } from './pages/merchant/CustomersCrmPage';
import { ReportsPage } from './pages/merchant/ReportsPage';
import { SubscriptionPage } from './pages/merchant/SubscriptionPage';
import { OperationalFeePage } from './pages/merchant/OperationalFeePage';

// Super Admin Page
import { SuperAdminPage } from './pages/admin/SuperAdminPage';

// Route Guards
const MerchantRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, loading } = useAuth();
  const { activeStoreId } = useActiveStore();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-900 text-neutral-400 text-xs font-bold">
        Carregando painel...
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/entrar" replace />;
  }

  // Se for superadmin / master, exige a seleção prévia de uma loja no contexto activeStoreId
  if (isMasterRole(currentUser.role)) {
    if (!activeStoreId) {
      return <Navigate to="/admin" replace />;
    }
    return <>{children}</>;
  }

  // Para lojista normal / OWNER, exige ter um storeId vinculado
  if (!currentUser.storeId) {
    return <Navigate to="/entrar" replace />;
  }

  return <>{children}</>;
};

const SuperAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-900 text-neutral-400 text-xs font-bold">
        Carregando...
      </div>
    );
  }

  // Usuário não autenticado não pode acessar
  if (!currentUser) {
    return <Navigate to="/entrar" replace />;
  }

  // OWNER não pode acessar rotas MASTER (redireciona para o próprio painel)
  if (!isMasterRole(currentUser.role)) {
    return <Navigate to="/painel" replace />;
  }

  return <>{children}</>;
};

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <ActiveStoreProvider>
          <ToastProvider>
          <Routes>
            {/* Página Inicial (Landing Page Oficial do SaaS - NUNCA abre loja) */}
            <Route path="/" element={<LandingHomePage />} />

            {/* Rotas de Autenticação */}
            <Route path="/entrar" element={<LoginPage />} />
            <Route path="/login" element={<Navigate to="/entrar" replace />} />
            <Route path="/cadastrar-loja" element={<Navigate to="/" replace />} />

            {/* Painel do Lojista (Protegido por Auth e StoreId) */}
            <Route
              path="/painel"
              element={
                <MerchantRoute>
                  <PanelLayout />
                </MerchantRoute>
              }
            >
              <Route index element={<OrdersKanbanPage />} />
              <Route path="cardapio" element={<MenuManagementPage />} />
              <Route path="configuracoes" element={<StoreSettingsPage />} />
              <Route path="cupons" element={<CouponsPage />} />
              <Route path="entregadores" element={<CouriersPage />} />
              <Route path="clientes" element={<CustomersCrmPage />} />
              <Route path="relatorios" element={<ReportsPage />} />
              <Route path="repasse" element={<OperationalFeePage />} />
              <Route path="minha-assinatura" element={<SubscriptionPage />} />
            </Route>

            {/* Super Admin (Protegido) */}
            <Route
              path="/admin"
              element={
                <SuperAdminRoute>
                  <SuperAdminPage />
                </SuperAdminRoute>
              }
            />

            {/* Rotas Públicas do Cliente (Cardápio PWA, Checkout, Rastreio) */}
            <Route path="/:slug" element={<StorefrontWrapper />} />
            <Route path="/:slug/checkout" element={<CheckoutWrapper />} />
            <Route path="/:slug/pedido/:orderId" element={<OrderTrackingWrapper />} />

            {/* Fallback para a Página Inicial */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </ActiveStoreProvider>
    </AuthProvider>
    </HashRouter>
  );
}
