import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldAlert,
  Store as StoreIcon,
  ExternalLink,
  Settings,
  Save,
  PlusCircle,
  DollarSign,
  Check,
  AlertTriangle,
  Clock,
  UserCheck,
  Building2,
  Lock,
  Unlock,
  Edit2,
  CheckCircle2,
  XCircle,
  Sparkles,
} from 'lucide-react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { firebaseConfig, auth } from '../../lib/firebase';
import { Store, StoreStatus, SaasConfig, SaasPaymentRequest, StorePayment } from '../../types';
import {
  subscribeToAllStores,
  saveStoreToFirestore,
  subscribeToSaasConfig,
  saveSaasConfigToFirestore,
  isSlugAvailableInFirestore,
  saveUserProfileToFirestore,
  addStorePaymentInFirestore,
  subscribeToSaasPaymentRequests,
  updateSaasPaymentRequestStatusInFirestore,
  subscribeToStorePayments,
} from '../../services/firestoreService';
import { formatCurrency } from '../../lib/formatters';
import { useToast } from '../../components/Toast';
import { SUPPORT_WHATSAPP } from '../../lib/constants';

export const SuperAdminPage: React.FC = () => {
  const { showToast } = useToast();

  const [stores, setStores] = useState<Store[]>([]);
  const [saasConfig, setSaasConfig] = useState<SaasConfig | null>(null);
  const [paymentRequests, setPaymentRequests] = useState<SaasPaymentRequest[]>([]);
  const [tab, setTab] = useState<'lojas' | 'nova_loja' | 'financeiro' | 'solicitacoes' | 'config'>('lojas');
  const [savingConfig, setSavingConfig] = useState(false);

  // Estado para Nova Loja
  const [nome, setNome] = useState('');
  const [slug, setSlug] = useState('');
  const [customSlug, setCustomSlug] = useState(false);
  const [whatsapp, setWhatsapp] = useState('');
  const [nomeResponsavel, setNomeResponsavel] = useState('');
  const [emailResponsavel, setEmailResponsavel] = useState('');
  const [plano, setPlano] = useState<string>('Profissional');
  const [valorImplantacao, setValorImplantacao] = useState<number>(299);
  const [valorMensalidade, setValorMensalidade] = useState<number>(99.9);
  const [diaVencimento, setDiaVencimento] = useState<number>(10);
  const [statusInicial, setStatusInicial] = useState<'aguardando_ativacao' | 'ativa' | 'vencida' | 'bloqueada'>('ativa');
  const [creatingStore, setCreatingStore] = useState(false);

  // Modal de Resumo Pós-Criação
  const [createdSummary, setCreatedSummary] = useState<{
    nome: string;
    slug: string;
    email: string;
    storeLink: string;
    panelLink: string;
  } | null>(null);

  // Estado para Edição de Loja
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Estado para Registrar Pagamento Manual
  const [payingStore, setPayingStore] = useState<Store | null>(null);
  const [payTipo, setPayTipo] = useState<'implantacao' | 'mensalidade'>('mensalidade');
  const [payValor, setPayValor] = useState<number>(99.9);
  const [payData, setPayData] = useState<string>(new Date().toISOString().slice(0, 10));
  const [payForma, setPayForma] = useState<'pix' | 'cartao' | 'boleto' | 'transferencia' | 'dinheiro' | 'outro'>('pix');
  const [payObservacao, setPayObservacao] = useState('');
  const [registeringPayment, setRegisteringPayment] = useState(false);

  // Pagamentos de uma loja selecionada para visualização
  const [viewingPaymentsStore, setViewingPaymentsStore] = useState<Store | null>(null);
  const [storePaymentsList, setStorePaymentsList] = useState<StorePayment[]>([]);

  useEffect(() => {
    const unsubStores = subscribeToAllStores((data) => setStores(data));
    const unsubConfig = subscribeToSaasConfig((cfg) => setSaasConfig(cfg));
    const unsubReqs = subscribeToSaasPaymentRequests((reqs) => setPaymentRequests(reqs));

    return () => {
      unsubStores();
      unsubConfig();
      unsubReqs();
    };
  }, []);

  useEffect(() => {
    if (viewingPaymentsStore) {
      const unsub = subscribeToStorePayments(viewingPaymentsStore.id, (list) => setStorePaymentsList(list));
      return () => unsub();
    }
  }, [viewingPaymentsStore]);

  // Atualizar slug automaticamente ao digitar nome
  const handleNomeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNome(val);
    if (!customSlug) {
      const generated = val
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      setSlug(generated);
    }
  };

  const handleCreateStoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !slug.trim() || !emailResponsavel.trim()) {
      showToast('Preencha os campos obrigatórios da loja e do responsável.', 'error');
      return;
    }

    const cleanSlug = slug.toLowerCase().trim();
    setCreatingStore(true);

    try {
      const isAvailable = await isSlugAvailableInFirestore(cleanSlug);
      if (!isAvailable) {
        showToast(`O slug "${cleanSlug}" já está em uso por outra loja. Escolha outro.`, 'error');
        setCreatingStore(false);
        return;
      }

      const secondaryApp =
        getApps().find((app) => app.name === 'secondary') || initializeApp(firebaseConfig, 'secondary');
      const secondaryAuth = getAuth(secondaryApp);

      const tempPassword = `Pass_${Math.random().toString(36).substring(2, 8)}!1A`;
      const cleanEmail = emailResponsavel.trim().toLowerCase();

      const userCred = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, tempPassword);
      const newUid = userCred.user.uid;

      await signOut(secondaryAuth);

      const storeId = `store_${cleanSlug}_${Date.now().toString(36)}`;

      const now = new Date();
      let year = now.getFullYear();
      let month = now.getMonth();
      const targetDay = Math.min(Math.max(diaVencimento, 1), 28);

      if (now.getDate() >= targetDay) {
        month += 1;
        if (month > 11) {
          month = 0;
          year += 1;
        }
      }
      const vencimentoInitial = new Date(year, month, targetDay, 23, 59, 59);

      await saveUserProfileToFirestore({
        uid: newUid,
        email: cleanEmail,
        nome: nomeResponsavel.trim(),
        role: 'owner',
        storeId,
        criadoEm: new Date().toISOString(),
      });

      const newStore: Store = {
        id: storeId,
        nome: nome.trim(),
        slug: cleanSlug,
        logo: '',
        capa: '',
        corPrimaria: '#e11d48',
        endereco: '',
        whatsapp: whatsapp.trim(),
        nomeResponsavel: nomeResponsavel.trim(),
        emailResponsavel: cleanEmail,
        plano,
        valorImplantacao,
        valorMensalidade,
        diaVencimento,
        dataVencimento: vencimentoInitial.toISOString(),
        status: statusInicial,
        pixKey: '',
        pixKeyType: 'aleatoria',
        pixReceiverName: '',
        pixCity: '',
        pagamentos: {
          pix: true,
          dinheiro: true,
          cartaoEntrega: true,
          whatsapp: true,
        },
        horarios: [],
        aberta: true,
        pedidoMinimo: 0,
        tempoEstimadoMin: 30,
        tempoEstimadoRetiradaMin: 15,
        aceitaEntrega: true,
        aceitaRetirada: true,
        nextOrderNumber: 1,
        mensagensWhatsapp: {
          aceito: 'Olá! Seu pedido foi aceito e está em processamento.',
          preparo: 'Olá! Seu pedido está em preparo.',
          saiuEntrega: 'Olá! Seu pedido saiu para entrega.',
          prontoRetirada: 'Olá! Seu pedido está pronto para retirada.',
          cancelado: 'Olá. Infelizmente seu pedido foi cancelado.',
        },
        ownerUid: newUid,
        criadoEm: new Date().toISOString(),
        descontoGeral: 0,
        categorias: [],
        produtos: [],
        zonasEntrega: [],
        formasPagamento: {
          pix: { ativo: true, instrucoes: 'Pagamento via QR Code / Chave Pix' },
          cartaoNaEntrega: { ativo: true },
          dinheiro: { ativo: true, permitirTroco: true },
        },
      };

      await saveStoreToFirestore(newStore);

      if (valorImplantacao > 0 && statusInicial === 'ativa') {
        await addStorePaymentInFirestore({
          storeId,
          storeNome: newStore.nome,
          tipo: 'implantacao',
          valor: valorImplantacao,
          data: new Date().toISOString().slice(0, 10),
          forma: 'pix',
          observacao: 'Pagamento da implantação da nova loja',
          registradoPor: 'superadmin',
        });
      }

      try {
        await sendPasswordResetEmail(secondaryAuth, cleanEmail);
      } catch (eReset) {
        console.warn('Erro ao enviar e-mail de reset de senha automático:', eReset);
      }

      showToast(`Loja "${nome}" criada com sucesso no Firestore!`, 'success');

      const origin = window.location.origin;
      setCreatedSummary({
        nome: newStore.nome,
        slug: cleanSlug,
        email: cleanEmail,
        storeLink: `${origin}/${cleanSlug}`,
        panelLink: `${origin}/painel`,
      });

      setNome('');
      setSlug('');
      setCustomSlug(false);
      setWhatsapp('');
      setNomeResponsavel('');
      setEmailResponsavel('');
      setTab('lojas');
    } catch (err: any) {
      console.error('Erro ao criar loja:', err);
      showToast(`Erro ao criar loja: ${err.message || err}`, 'error');
    } finally {
      setCreatingStore(false);
    }
  };

  const handleToggleBlockStore = async (store: Store) => {
    const newStatus: StoreStatus = store.status === 'bloqueada' ? 'ativa' : 'bloqueada';
    const updated: Store = { ...store, status: newStatus };
    try {
      await saveStoreToFirestore(updated);
      showToast(`Status da loja "${store.nome}" alterado para ${newStatus}.`, 'info');
    } catch (err) {
      showToast('Erro ao alterar status da loja.', 'error');
    }
  };

  const handleSaveEditStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStore) return;
    setSavingEdit(true);
    try {
      await saveStoreToFirestore(editingStore);
      showToast(`Dados da loja "${editingStore.nome}" atualizados!`, 'success');
      setEditingStore(null);
    } catch (err) {
      showToast('Erro ao atualizar dados da loja.', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleOpenPaymentModal = (store: Store) => {
    setPayingStore(store);
    setPayTipo('mensalidade');
    setPayValor(store.valorMensalidade || 99.9);
    setPayData(new Date().toISOString().slice(0, 10));
    setPayForma('pix');
    setPayObservacao('');
  };

  const handleRegisterPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingStore) return;
    setRegisteringPayment(true);
    try {
      await addStorePaymentInFirestore({
        storeId: payingStore.id,
        storeNome: payingStore.nome,
        tipo: payTipo,
        valor: payValor,
        data: payData,
        forma: payForma,
        observacao: payObservacao.trim(),
        registradoPor: 'superadmin',
      });
      showToast(`Pagamento registrado para ${payingStore.nome}!`, 'success');
      setPayingStore(null);
    } catch (err) {
      console.error(err);
      showToast('Erro ao registrar pagamento.', 'error');
    } finally {
      setRegisteringPayment(false);
    }
  };

  const handleApprovePaymentRequest = async (req: SaasPaymentRequest) => {
    try {
      await updateSaasPaymentRequestStatusInFirestore(req.id, 'aprovado', 'superadmin');
      showToast(`Pagamento de ${req.storeNome} aprovado e assinatura estendida por 30 dias!`, 'success');
    } catch (err) {
      showToast('Erro ao aprovar solicitação.', 'error');
    }
  };

  const handleRejectPaymentRequest = async (req: SaasPaymentRequest) => {
    try {
      await updateSaasPaymentRequestStatusInFirestore(req.id, 'rejeitado', 'superadmin');
      showToast(`Solicitação de ${req.storeNome} rejeitada.`, 'info');
    } catch (err) {
      showToast('Erro ao rejeitar solicitação.', 'error');
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saasConfig) return;
    setSavingConfig(true);
    try {
      await saveSaasConfigToFirestore(saasConfig);
      showToast('Configurações globais do SaaS salvas no Firestore!', 'success');
    } catch (err: any) {
      console.error(err);
      showToast('Erro ao salvar configurações.', 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  // Métricas para Dashboard
  const now = new Date();
  const next7Days = new Date();
  next7Days.setDate(next7Days.getDate() + 7);

  const totalStores = stores.length;
  const activeStores = stores.filter((s) => s.status === 'ativa').length;
  const expiredStores = stores.filter((s) => {
    if (s.status === 'vencida') return true;
    if (s.dataVencimento && new Date(s.dataVencimento) < now) return true;
    return false;
  }).length;

  const expiringIn7Days = stores.filter((s) => {
    if (!s.dataVencimento) return false;
    const vence = new Date(s.dataVencimento);
    return vence >= now && vence <= next7Days;
  });

  const pendingPaymentReqs = paymentRequests.filter((r) => r.status === 'pendente');

  return (
    <div className="min-h-screen bg-neutral-100 pb-16">
      {/* Topo */}
      <header className="bg-neutral-900 text-white px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500 flex items-center justify-center text-neutral-950 font-black">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-black text-base tracking-tight leading-none">Super Admin • Pede AI</h1>
            <span className="text-[11px] text-neutral-400">Gestão Global Multi-Lojas e Licenciamento</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <Link
            to="/painel"
            className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl font-bold transition-colors"
          >
            Ir para Painel do Lojista
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Banner de Solicitações Pendentes */}
        {pendingPaymentReqs.length > 0 && (
          <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-center justify-between gap-4 text-amber-900 shadow-sm animate-pulse">
            <div className="flex items-center gap-3">
              <Clock className="w-6 h-6 text-amber-600 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-sm">Você tem {pendingPaymentReqs.length} aviso(s) de "Já Paguei" para conferir!</h3>
                <p className="text-xs text-amber-700">Confira o comprovante/TXID e aprove para liberar a loja imediatamente.</p>
              </div>
            </div>
            <button
              onClick={() => setTab('solicitacoes')}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
            >
              Ver Avisos ({pendingPaymentReqs.length})
            </button>
          </div>
        )}

        {/* Métricas Principais */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-1">
            <span className="text-xs font-bold text-neutral-400 uppercase">Total de Lojas</span>
            <p className="text-2xl font-black text-neutral-900">{totalStores}</p>
            <p className="text-[11px] text-neutral-500">Cadastradas no sistema</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-1">
            <span className="text-xs font-bold text-neutral-400 uppercase">Lojas Ativas</span>
            <p className="text-2xl font-black text-emerald-600">{activeStores}</p>
            <p className="text-[11px] text-neutral-500">Em funcionamento normal</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-1">
            <span className="text-xs font-bold text-neutral-400 uppercase">Lojas Vencidas</span>
            <p className="text-2xl font-black text-rose-600">{expiredStores}</p>
            <p className="text-[11px] text-neutral-500">Com mensalidade atrasada</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-1">
            <span className="text-xs font-bold text-neutral-400 uppercase">A Vencer nos Próximos 7 Dias</span>
            <p className="text-2xl font-black text-amber-600">{expiringIn7Days.length}</p>
            <p className="text-[11px] text-neutral-500">Necessitam de cobrança</p>
          </div>
        </div>

        {/* Menu de Abas */}
        <div className="flex flex-wrap bg-white p-1.5 rounded-2xl border border-neutral-200 shadow-xs text-xs font-bold gap-1">
          <button
            onClick={() => setTab('lojas')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
              tab === 'lojas' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <StoreIcon className="w-4 h-4" />
            <span>Lojas Parceiras ({stores.length})</span>
          </button>

          <button
            onClick={() => setTab('nova_loja')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
              tab === 'nova_loja' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <PlusCircle className="w-4 h-4 text-emerald-400" />
            <span>Nova Loja</span>
          </button>

          <button
            onClick={() => setTab('financeiro')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
              tab === 'financeiro' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Controle Financeiro</span>
          </button>

          <button
            onClick={() => setTab('solicitacoes')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer relative ${
              tab === 'solicitacoes' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Avisos "Já Paguei"</span>
            {pendingPaymentReqs.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center">
                {pendingPaymentReqs.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setTab('config')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
              tab === 'config' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Chave Pix & Suporte SaaS</span>
          </button>
        </div>

        {/* TAB 1: LISTA DE LOJAS */}
        {tab === 'lojas' && (
          <div className="bg-white rounded-3xl border border-neutral-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between">
              <h2 className="font-bold text-sm text-neutral-800">Lojas Cadastradas</h2>
              <button
                onClick={() => setTab('nova_loja')}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Cadastrar Nova Loja</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-neutral-50/50 border-b border-neutral-200 font-bold text-neutral-500 uppercase tracking-wider text-[11px]">
                    <th className="p-4 pl-6">Loja</th>
                    <th className="p-4">Plano / Valor</th>
                    <th className="p-4">Vencimento</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 pr-6 text-right">Ações do Administrador</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {stores.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-12 text-center text-neutral-400">
                        Nenhuma loja cadastrada até o momento.
                      </td>
                    </tr>
                  ) : (
                    stores.map((s) => {
                      const vence = s.dataVencimento ? new Date(s.dataVencimento) : null;
                      const isExpired = s.status === 'vencida' || (vence !== null && vence < now && s.status !== 'ativa');

                      return (
                        <tr key={s.id} className="hover:bg-neutral-50/80 transition-colors">
                          <td className="p-4 pl-6">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-2xl bg-neutral-100 border border-neutral-200 overflow-hidden flex items-center justify-center font-bold text-neutral-600 flex-shrink-0">
                                {s.logo ? (
                                  <img src={s.logo} alt={s.nome} className="w-full h-full object-cover" />
                                ) : (
                                  s.nome.slice(0, 2).toUpperCase()
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-neutral-900 text-sm">{s.nome}</span>
                                  <a
                                    href={`/${s.slug}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-neutral-400 hover:text-neutral-700"
                                    title="Abrir cardápio"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                </div>
                                <span className="text-[11px] text-neutral-400 block font-mono">
                                  /{s.slug} • {s.emailResponsavel || 'Sem e-mail'}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="p-4">
                            <div className="font-bold text-neutral-800">{s.plano || 'Profissional'}</div>
                            <span className="text-[11px] text-neutral-500">
                              {formatCurrency(s.valorMensalidade || 99.9)} / mês
                            </span>
                          </td>

                          <td className="p-4">
                            <div className="font-bold text-neutral-800">
                              {vence ? vence.toLocaleDateString('pt-BR') : 'Não definida'}
                            </div>
                            <span className="text-[11px] text-neutral-400">Dia Venc.: {s.diaVencimento || 10}</span>
                          </td>

                          <td className="p-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black uppercase ${
                                s.status === 'ativa'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : isExpired || s.status === 'vencida'
                                  ? 'bg-rose-100 text-rose-800'
                                  : s.status === 'aguardando_ativacao'
                                  ? 'bg-sky-100 text-sky-800'
                                  : 'bg-neutral-200 text-neutral-800'
                              }`}
                            >
                              {s.status === 'ativa' && <Check className="w-3 h-3 text-emerald-600" />}
                              {(isExpired || s.status === 'vencida') && <AlertTriangle className="w-3 h-3 text-rose-600" />}
                              {s.status}
                            </span>
                          </td>

                          <td className="p-4 pr-6 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenPaymentModal(s)}
                                className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                                title="Lançar pagamento mensal ou implantação"
                              >
                                <DollarSign className="w-3.5 h-3.5" />
                                <span>Pagar</span>
                              </button>

                              <button
                                onClick={() => setEditingStore(s)}
                                className="p-2 text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors cursor-pointer"
                                title="Editar dados da loja"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => handleToggleBlockStore(s)}
                                className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                                  s.status === 'bloqueada'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                    : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                                }`}
                                title={s.status === 'bloqueada' ? 'Desbloquear Loja' : 'Bloquear Loja'}
                              >
                                {s.status === 'bloqueada' ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                              </button>

                              <button
                                onClick={() => setViewingPaymentsStore(s)}
                                className="px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl font-bold text-[11px] transition-colors cursor-pointer"
                                title="Ver extrato de pagamentos"
                              >
                                Extrato
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: NOVA LOJA */}
        {tab === 'nova_loja' && (
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200 shadow-xs max-w-3xl space-y-6">
            <div>
              <h2 className="text-xl font-black text-neutral-900 flex items-center gap-2">
                <PlusCircle className="w-6 h-6 text-emerald-600" />
                <span>Cadastrar Nova Loja Parceira</span>
              </h2>
              <p className="text-xs text-neutral-500 mt-1">
                Ao salvar, a conta de acesso do lojista é gerada e um e-mail de definição de senha é enviado automaticamente.
              </p>
            </div>

            <form onSubmit={handleCreateStoreSubmit} className="space-y-6 text-xs">
              <div className="space-y-4 pt-2 border-t border-neutral-100">
                <h3 className="font-black text-neutral-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-neutral-500" />
                  Dados da Loja
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-neutral-700 mb-1">Nome do Estabelecimento *</label>
                    <input
                      type="text"
                      required
                      value={nome}
                      onChange={handleNomeChange}
                      placeholder="Ex: Pizzaria Bella Napoli"
                      className="w-full p-3 border border-neutral-300 rounded-xl focus:outline-none focus:border-rose-500 font-bold text-sm"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-neutral-700 mb-1">
                      Link do Cardápio (Slug) *
                    </label>
                    <div className="flex items-center gap-1">
                      <span className="text-neutral-400 font-mono text-xs">/</span>
                      <input
                        type="text"
                        required
                        value={slug}
                        onChange={(e) => {
                          setCustomSlug(true);
                          setSlug(e.target.value);
                        }}
                        placeholder="pizzaria-bella"
                        className="w-full p-3 border border-neutral-300 rounded-xl focus:outline-none focus:border-rose-500 font-mono text-xs font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-neutral-700 mb-1">WhatsApp da Loja (pedidos)</label>
                    <input
                      type="text"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      placeholder="5592999999999"
                      className="w-full p-3 border border-neutral-300 rounded-xl focus:outline-none focus:border-rose-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-neutral-700 mb-1">Status Inicial *</label>
                    <select
                      value={statusInicial}
                      onChange={(e: any) => setStatusInicial(e.target.value)}
                      className="w-full p-3 border border-neutral-300 rounded-xl focus:outline-none focus:border-rose-500 font-bold bg-white"
                    >
                      <option value="ativa">Ativa (Recebe pedidos imediatamente)</option>
                      <option value="aguardando_ativacao">Aguardando Ativação (Aguardando implantação)</option>
                      <option value="vencida">Vencida</option>
                      <option value="bloqueada">Bloqueada</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-neutral-100">
                <h3 className="font-black text-neutral-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-neutral-500" />
                  Dados do Lojista Responsável
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-neutral-700 mb-1">Nome Completo do Responsável</label>
                    <input
                      type="text"
                      value={nomeResponsavel}
                      onChange={(e) => setNomeResponsavel(e.target.value)}
                      placeholder="Ex: Carlos Silva"
                      className="w-full p-3 border border-neutral-300 rounded-xl focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-neutral-700 mb-1">E-mail de Login do Lojista *</label>
                    <input
                      type="email"
                      required
                      value={emailResponsavel}
                      onChange={(e) => setEmailResponsavel(e.target.value)}
                      placeholder="carlos@pizzariabella.com.br"
                      className="w-full p-3 border border-neutral-300 rounded-xl focus:outline-none focus:border-rose-500 font-medium"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-neutral-100">
                <h3 className="font-black text-neutral-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-neutral-500" />
                  Plano e Condições Comerciais
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-bold text-neutral-700 mb-1">Plano Escolhido</label>
                    <select
                      value={plano}
                      onChange={(e) => setPlano(e.target.value)}
                      className="w-full p-3 border border-neutral-300 rounded-xl focus:outline-none focus:border-rose-500 bg-white font-bold"
                    >
                      <option value="Iniciante">Iniciante</option>
                      <option value="Profissional">Profissional</option>
                      <option value="Ilimitado">Ilimitado</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-neutral-700 mb-1">Taxa de Implantação (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={valorImplantacao}
                      onChange={(e) => setValorImplantacao(Number(e.target.value))}
                      className="w-full p-3 border border-neutral-300 rounded-xl focus:outline-none focus:border-rose-500 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-neutral-700 mb-1">Valor da Mensalidade (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={valorMensalidade}
                      onChange={(e) => setValorMensalidade(Number(e.target.value))}
                      className="w-full p-3 border border-neutral-300 rounded-xl focus:outline-none focus:border-rose-500 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-neutral-700 mb-1">Dia do Vencimento (1 a 28)</label>
                    <input
                      type="number"
                      min="1"
                      max="28"
                      value={diaVencimento}
                      onChange={(e) => setDiaVencimento(Number(e.target.value))}
                      className="w-full p-3 border border-neutral-300 rounded-xl focus:outline-none focus:border-rose-500 font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-neutral-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setTab('lojas')}
                  className="px-5 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingStore}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {creatingStore ? 'Criando Loja...' : 'Salvar e Criar Loja'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 3: CONTROLE FINANCEIRO */}
        {tab === 'financeiro' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Lojas a Vencer nos Próximos 7 Dias */}
              <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-xs space-y-4">
                <h3 className="font-bold text-sm text-neutral-900 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-500" />
                  <span>Lojas a Vencer nos Próximos 7 Dias ({expiringIn7Days.length})</span>
                </h3>

                {expiringIn7Days.length === 0 ? (
                  <p className="text-xs text-neutral-400 py-4">Nenhuma loja vence nos próximos 7 dias.</p>
                ) : (
                  <div className="divide-y divide-neutral-100 text-xs">
                    {expiringIn7Days.map((s) => (
                      <div key={s.id} className="py-3 flex items-center justify-between gap-3">
                        <div>
                          <span className="font-bold text-neutral-800">{s.nome}</span>
                          <p className="text-[11px] text-neutral-400">
                            Vencimento: {new Date(s.dataVencimento!).toLocaleDateString()} • {formatCurrency(s.valorMensalidade || 99.9)}
                          </p>
                        </div>
                        <button
                          onClick={() => handleOpenPaymentModal(s)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-xs cursor-pointer"
                        >
                          Lançar Pagamento
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Lojas Vencidas */}
              <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-xs space-y-4">
                <h3 className="font-bold text-sm text-neutral-900 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-500" />
                  <span>Lojas Inadimplentes / Vencidas ({expiredStores})</span>
                </h3>

                {stores.filter((s) => s.status === 'vencida' || (s.dataVencimento && new Date(s.dataVencimento) < now)).length === 0 ? (
                  <p className="text-xs text-neutral-400 py-4">Nenhuma loja vencida no momento.</p>
                ) : (
                  <div className="divide-y divide-neutral-100 text-xs">
                    {stores
                      .filter((s) => s.status === 'vencida' || (s.dataVencimento && new Date(s.dataVencimento) < now))
                      .map((s) => (
                        <div key={s.id} className="py-3 flex items-center justify-between gap-3">
                          <div>
                            <span className="font-bold text-rose-900">{s.nome}</span>
                            <p className="text-[11px] text-neutral-500">
                              Venceu em: {s.dataVencimento ? new Date(s.dataVencimento).toLocaleDateString() : 'N/A'} • {formatCurrency(s.valorMensalidade || 99.9)}
                            </p>
                          </div>
                          <button
                            onClick={() => handleOpenPaymentModal(s)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-xs cursor-pointer"
                          >
                            Renovar Agora (+30d)
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SOLICITAÇÕES "JÁ PAGUEI" */}
        {tab === 'solicitacoes' && (
          <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-xs space-y-4">
            <h2 className="font-bold text-base text-neutral-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              <span>Confirmações de Pagamento Enviadas pelos Lojistas ("Já Paguei")</span>
            </h2>

            {paymentRequests.length === 0 ? (
              <p className="text-xs text-neutral-400 py-8 text-center">Nenhuma solicitação enviada até o momento.</p>
            ) : (
              <div className="divide-y divide-neutral-100 text-xs">
                {paymentRequests.map((req) => (
                  <div key={req.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-neutral-900">{req.storeNome}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            req.status === 'aprovado'
                              ? 'bg-emerald-100 text-emerald-800'
                              : req.status === 'rejeitado'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {req.status}
                        </span>
                      </div>
                      <p className="text-neutral-600 font-medium">
                        Valor: <strong className="text-neutral-900">{formatCurrency(req.valor)}</strong> • Plano: {req.plano}
                      </p>
                      {req.txid && <p className="font-mono text-neutral-500">TXID/Autenticação: {req.txid}</p>}
                      {req.comprovanteNota && <p className="text-neutral-500 italic">"{req.comprovanteNota}"</p>}
                      <p className="text-[10px] text-neutral-400">
                        Enviado em {new Date(req.criadoEm).toLocaleDateString()} às {new Date(req.criadoEm).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    {req.status === 'pendente' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApprovePaymentRequest(req)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Aprovar (+30d)</span>
                        </button>

                        <button
                          onClick={() => handleRejectPaymentRequest(req)}
                          className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold border border-rose-200 rounded-xl flex items-center gap-1 cursor-pointer"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>Rejeitar</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: CONFIGURAÇÕES GLOBAIS DA PLATAFORMA SAAS */}
        {tab === 'config' && (
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200 shadow-xs max-w-2xl space-y-6">
            <div>
              <h2 className="text-lg font-black text-neutral-900 flex items-center gap-2">
                <Settings className="w-5 h-5 text-amber-500" />
                <span>Configurações Globais do SaaS</span>
              </h2>
              <p className="text-xs text-neutral-500 mt-1">
                Defina a chave Pix do recebedor e os dados de suporte exibidos para todos os lojistas.
              </p>
            </div>

            {saasConfig && (
              <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-neutral-700 mb-1">Chave Pix do Super Admin (Recebedor)</label>
                  <input
                    type="text"
                    required
                    value={saasConfig.pixSuperAdmin}
                    onChange={(e) => setSaasConfig({ ...saasConfig, pixSuperAdmin: e.target.value })}
                    placeholder="Chave Pix (E-mail, CPF, Tel ou Aleatória)"
                    className="w-full p-3 border border-neutral-300 rounded-xl focus:outline-none focus:border-rose-500 font-mono text-xs font-bold"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-neutral-700 mb-1">Nome do Recebedor (Pix)</label>
                    <input
                      type="text"
                      value={saasConfig.nomeRecebedor || ''}
                      onChange={(e) => setSaasConfig({ ...saasConfig, nomeRecebedor: e.target.value })}
                      placeholder="PEDE AI PLATAFORMA"
                      className="w-full p-3 border border-neutral-300 rounded-xl focus:outline-none focus:border-rose-500 uppercase font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-neutral-700 mb-1">Cidade do Recebedor (Pix)</label>
                    <input
                      type="text"
                      value={saasConfig.cidade || ''}
                      onChange={(e) => setSaasConfig({ ...saasConfig, cidade: e.target.value })}
                      placeholder="MANAUS"
                      className="w-full p-3 border border-neutral-300 rounded-xl focus:outline-none focus:border-rose-500 uppercase font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-neutral-700 mb-1">WhatsApp de Suporte do SaaS</label>
                  <input
                    type="text"
                    value={saasConfig.whatsappSuporte}
                    onChange={(e) => setSaasConfig({ ...saasConfig, whatsappSuporte: e.target.value })}
                    placeholder={SUPPORT_WHATSAPP}
                    className="w-full p-3 border border-neutral-300 rounded-xl focus:outline-none focus:border-rose-500 font-mono"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={savingConfig}
                    className="w-full py-3 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl font-bold shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>{savingConfig ? 'Salvando...' : 'Salvar Configurações'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </main>

      {/* Modal de Resumo pós-criação de loja */}
      {createdSummary && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative">
            <div className="flex items-center gap-3 text-emerald-600">
              <Sparkles className="w-8 h-8" />
              <div>
                <h3 className="text-lg font-black text-neutral-900">Loja Criada com Sucesso!</h3>
                <p className="text-xs text-neutral-500">
                  Um e-mail de redefinição de senha foi enviado para {createdSummary.email}.
                </p>
              </div>
            </div>

            <div className="space-y-3 bg-neutral-50 p-4 rounded-2xl border border-neutral-200 text-xs">
              <div>
                <span className="font-bold text-neutral-500 block">Link do Cardápio Digital (Cliente):</span>
                <a
                  href={createdSummary.storeLink}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-emerald-700 hover:underline font-bold break-all"
                >
                  {createdSummary.storeLink}
                </a>
              </div>

              <div>
                <span className="font-bold text-neutral-500 block">Link do Painel do Lojista:</span>
                <a
                  href={createdSummary.panelLink}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-sky-700 hover:underline font-bold break-all"
                >
                  {createdSummary.panelLink}
                </a>
              </div>

              <div>
                <span className="font-bold text-neutral-500 block">E-mail Cadastrado:</span>
                <span className="font-bold text-neutral-800">{createdSummary.email}</span>
              </div>
            </div>

            <button
              onClick={() => setCreatedSummary(null)}
              className="w-full py-3.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl font-bold text-xs shadow-md transition-colors cursor-pointer"
            >
              Concluir e Voltar
            </button>
          </div>
        </div>
      )}

      {/* Modal Editar Dados da Loja */}
      {editingStore && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="font-bold text-base text-neutral-900 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-neutral-700" />
                <span>Editar Loja: {editingStore.nome}</span>
              </h3>
              <button onClick={() => setEditingStore(null)} className="p-1 text-neutral-400 hover:text-neutral-700">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditStore} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-neutral-700 mb-1">Nome da Loja</label>
                <input
                  type="text"
                  required
                  value={editingStore.nome}
                  onChange={(e) => setEditingStore({ ...editingStore, nome: e.target.value })}
                  className="w-full p-3 border border-neutral-300 rounded-xl font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-neutral-700 mb-1">Plano</label>
                  <input
                    type="text"
                    value={editingStore.plano || 'Profissional'}
                    onChange={(e) => setEditingStore({ ...editingStore, plano: e.target.value })}
                    className="w-full p-3 border border-neutral-300 rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-neutral-700 mb-1">Valor Mensalidade (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingStore.valorMensalidade || 99.9}
                    onChange={(e) => setEditingStore({ ...editingStore, valorMensalidade: Number(e.target.value) })}
                    className="w-full p-3 border border-neutral-300 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-neutral-700 mb-1">Dia do Vencimento</label>
                  <input
                    type="number"
                    min="1"
                    max="28"
                    value={editingStore.diaVencimento || 10}
                    onChange={(e) => setEditingStore({ ...editingStore, diaVencimento: Number(e.target.value) })}
                    className="w-full p-3 border border-neutral-300 rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-neutral-700 mb-1">Status</label>
                  <select
                    value={editingStore.status}
                    onChange={(e: any) => setEditingStore({ ...editingStore, status: e.target.value })}
                    className="w-full p-3 border border-neutral-300 rounded-xl font-bold bg-white"
                  >
                    <option value="ativa">Ativa</option>
                    <option value="aguardando_ativacao">Aguardando Ativação</option>
                    <option value="vencida">Vencida</option>
                    <option value="bloqueada">Bloqueada</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingStore(null)}
                  className="w-1/3 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="flex-1 py-3 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl font-bold shadow-md cursor-pointer"
                >
                  {savingEdit ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Lançar Pagamento Manual */}
      {payingStore && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="font-bold text-base text-neutral-900 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                <span>Lançar Pagamento: {payingStore.nome}</span>
              </h3>
              <button onClick={() => setPayingStore(null)} className="p-1 text-neutral-400 hover:text-neutral-700">
                ✕
              </button>
            </div>

            <form onSubmit={handleRegisterPaymentSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-neutral-700 mb-1">Tipo de Pagamento</label>
                <select
                  value={payTipo}
                  onChange={(e: any) => setPayTipo(e.target.value)}
                  className="w-full p-3 border border-neutral-300 rounded-xl font-bold bg-white"
                >
                  <option value="mensalidade">Mensalidade (Prorroga +30 dias e Ativa Loja)</option>
                  <option value="implantacao">Taxa de Implantação</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-neutral-700 mb-1">Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={payValor}
                    onChange={(e) => setPayValor(Number(e.target.value))}
                    className="w-full p-3 border border-neutral-300 rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-neutral-700 mb-1">Data</label>
                  <input
                    type="date"
                    required
                    value={payData}
                    onChange={(e) => setPayData(e.target.value)}
                    className="w-full p-3 border border-neutral-300 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">Forma de Pagamento</label>
                <select
                  value={payForma}
                  onChange={(e: any) => setPayForma(e.target.value)}
                  className="w-full p-3 border border-neutral-300 rounded-xl font-bold bg-white"
                >
                  <option value="pix">Pix</option>
                  <option value="cartao">Cartão</option>
                  <option value="boleto">Boleto</option>
                  <option value="transferencia">Transferência Bancária</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="outro">Outro</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">Observação / Comprovante</label>
                <input
                  type="text"
                  value={payObservacao}
                  onChange={(e) => setPayObservacao(e.target.value)}
                  placeholder="Ex: Recebido via Pix no Santander"
                  className="w-full p-3 border border-neutral-300 rounded-xl"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayingStore(null)}
                  className="w-1/3 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={registeringPayment}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-md cursor-pointer"
                >
                  {registeringPayment ? 'Registrando...' : 'Registrar Pagamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Extrato de Pagamentos da Loja */}
      {viewingPaymentsStore && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 space-y-5 shadow-2xl relative max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="font-bold text-base text-neutral-900">Extrato: {viewingPaymentsStore.nome}</h3>
              <button onClick={() => setViewingPaymentsStore(null)} className="p-1 text-neutral-400 hover:text-neutral-700">
                ✕
              </button>
            </div>

            {storePaymentsList.length === 0 ? (
              <p className="text-xs text-neutral-400 py-6 text-center">Nenhum pagamento registrado para esta loja.</p>
            ) : (
              <div className="divide-y divide-neutral-100 text-xs">
                {storePaymentsList.map((p) => (
                  <div key={p.id} className="py-3 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-neutral-800">{formatCurrency(p.valor)}</span>
                      <span className="text-[10px] text-neutral-400 uppercase font-black ml-2">({p.tipo})</span>
                      <p className="text-[11px] text-neutral-500">
                        Forma: {p.forma.toUpperCase()} • Data: {p.data}
                      </p>
                      {p.observacao && <p className="text-[11px] text-neutral-400 italic">"{p.observacao}"</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
