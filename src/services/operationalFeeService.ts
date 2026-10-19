import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  Unsubscribe,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  OperationalFeeConfig,
  OperationalFeeEntry,
  OperationalInvoice,
  OperationalBillingPeriod,
  AdminAuditLog,
  Order,
  Store,
  SaasConfig,
} from '../types';
import { gerarBrCode, gerarQrCodeDataUrl } from '../lib/pix';

const CONFIG_DOC_PATH = 'operational_fee_config';
const CONFIG_DOC_ID = 'default';

export const DEFAULT_FEE_CONFIG: OperationalFeeConfig = {
  valorPadrao: 0.99,
  ativoGlobal: true,
  periodoApuracao: 'mensal',
  diasAposFechamentoVencimento: 5,
  dataInicioCobranca: '2026-01-01',
  lojasConfig: {},
  historicoAlteracoes: [],
};

// ==========================================
// CONFIGURAÇÃO DA TAXA OPERACIONAL
// ==========================================
export async function getOperationalFeeConfig(): Promise<OperationalFeeConfig> {
  try {
    const docRef = doc(db, CONFIG_DOC_PATH, CONFIG_DOC_ID);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { ...DEFAULT_FEE_CONFIG, ...(snap.data() as OperationalFeeConfig) };
    }
    // Salvar configuração padrão se não existir
    await setDoc(docRef, DEFAULT_FEE_CONFIG);
    return DEFAULT_FEE_CONFIG;
  } catch (err) {
    console.error('Erro ao buscar configuração de taxa operacional:', err);
    return DEFAULT_FEE_CONFIG;
  }
}

export function subscribeToOperationalFeeConfig(
  callback: (config: OperationalFeeConfig) => void
): Unsubscribe {
  const docRef = doc(db, CONFIG_DOC_PATH, CONFIG_DOC_ID);
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        callback({ ...DEFAULT_FEE_CONFIG, ...(snap.data() as OperationalFeeConfig) });
      } else {
        callback(DEFAULT_FEE_CONFIG);
      }
    },
    (err) => {
      console.error('Erro ao escutar taxa operacional:', err);
      callback(DEFAULT_FEE_CONFIG);
    }
  );
}

export async function saveOperationalFeeConfig(
  newConfig: OperationalFeeConfig,
  authorEmail: string,
  justificativa: string
): Promise<void> {
  const docRef = doc(db, CONFIG_DOC_PATH, CONFIG_DOC_ID);
  
  const changeLog = {
    id: `log_${Date.now()}`,
    data: new Date().toISOString(),
    usuario: authorEmail || 'SuperAdmin',
    descricao: `Alteração da configuração operacional. Taxa padrão: R$ ${newConfig.valorPadrao.toFixed(2)}, Período: ${newConfig.periodoApuracao}`,
    justificativa: justificativa.trim() || 'Ajuste de parâmetros operacionais da plataforma',
  };

  const updatedConfig: OperationalFeeConfig = {
    ...newConfig,
    historicoAlteracoes: [changeLog, ...(newConfig.historicoAlteracoes || [])].slice(0, 50),
  };

  await setDoc(docRef, updatedConfig);

  // Registrar auditoria
  await recordAdminAuditLog({
    autorEmail: authorEmail || 'SuperAdmin',
    autorUid: 'superadmin',
    acao: 'alterar_taxa_global',
    alvoId: 'operational_fee_config',
    alvoNome: 'Configuração Global de Taxa Operacional',
    detalhes: `Valor padrão: R$ ${newConfig.valorPadrao.toFixed(2)}, Ativo global: ${newConfig.ativoGlobal ? 'Sim' : 'Não'}`,
    justificativa,
  });
}

// ==========================================
// CONTABILIZAÇÃO AUTOMÁTICA E IDEMPOTENTE
// ==========================================
export async function recordOrderOperationalFee(
  order: Order,
  store: Store
): Promise<OperationalFeeEntry | null> {
  // 1. Validações preliminares: pedidos cancelados ou testes nunca geram taxa
  if (order.teste || order.status === 'cancelado') {
    return null;
  }

  // 2. Verificar se o status atual do pedido é considerado concluído/entregue
  const isConcluido = order.status === 'entregue' || (order.tipo === 'retirada' && order.status === 'pronto');
  if (!isConcluido) {
    return null;
  }

  try {
    const feeConfig = await getOperationalFeeConfig();
    
    // 3. Verificar se a cobrança está ativa globalmente
    if (!feeConfig.ativoGlobal) {
      return null;
    }

    // 4. Verificar se a cobrança está ativa para a loja específica
    const storeOverride = feeConfig.lojasConfig?.[order.storeId];
    if (storeOverride && storeOverride.ativo === false) {
      return null;
    }

    // 5. Verificar data de início da cobrança
    const dataInicio = storeOverride?.dataInicio || feeConfig.dataInicioCobranca;
    if (dataInicio && order.criadoEm) {
      const orderDate = new Date(order.criadoEm).toISOString().split('T')[0];
      if (orderDate < dataInicio) {
        return null;
      }
    }

    // 6. Verificar isenção temporária
    if (storeOverride?.isencaoAte) {
      const hoje = new Date().toISOString().split('T')[0];
      if (hoje <= storeOverride.isencaoAte) {
        return null;
      }
    }

    // 7. IDEMPOTÊNCIA: Checar se já existe lançamento para este pedido
    const entryId = `fee_${order.id}`;
    const entryRef = doc(db, 'operational_fee_entries', entryId);
    const existingSnap = await getDoc(entryRef);

    if (existingSnap.exists()) {
      return existingSnap.data() as OperationalFeeEntry;
    }

    // 8. Determinar taxa unitária aplicada
    const taxaUnit = typeof storeOverride?.valorUnitario === 'number' && storeOverride.valorUnitario >= 0
      ? storeOverride.valorUnitario
      : feeConfig.valorPadrao;

    const nowIso = new Date().toISOString();
    const entry: OperationalFeeEntry = {
      id: entryId,
      orderId: order.id,
      orderNumero: order.numero,
      storeId: order.storeId,
      storeNome: store.nome,
      dataConclusao: nowIso,
      valorPedido: order.total || 0,
      taxaAplicada: taxaUnit,
      status: 'pendente',
      criadoEm: nowIso,
    };

    await setDoc(entryRef, entry);
    return entry;
  } catch (err) {
    console.error('Erro ao contabilizar taxa operacional do pedido:', err);
    return null;
  }
}

/**
 * Estorna uma taxa operacional previamente contabilizada (ex: se o pedido foi cancelado a posteriori)
 */
export async function reverseOrderOperationalFee(
  orderId: string,
  motivo: string
): Promise<boolean> {
  try {
    const entryId = `fee_${orderId}`;
    const entryRef = doc(db, 'operational_fee_entries', entryId);
    const snap = await getDoc(entryRef);

    if (!snap.exists()) return false;

    const current = snap.data() as OperationalFeeEntry;
    if (current.status === 'estornado') return true;

    await updateDoc(entryRef, {
      status: 'estornado',
      estornadoEm: new Date().toISOString(),
      motivoEstorno: motivo || 'Pedido cancelado',
    });

    return true;
  } catch (err) {
    console.error('Erro ao estornar taxa operacional:', err);
    return false;
  }
}

// ==========================================
// CONSULTAS E SUBSCRIÇÕES
// ==========================================
export function subscribeToOperationalFeeEntriesByStore(
  storeId: string,
  callback: (entries: OperationalFeeEntry[]) => void
): Unsubscribe {
  const colRef = collection(db, 'operational_fee_entries');
  const q = query(colRef, where('storeId', '==', storeId));

  return onSnapshot(
    q,
    (snap) => {
      const list: OperationalFeeEntry[] = [];
      snap.forEach((d) => list.push(d.data() as OperationalFeeEntry));
      list.sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());
      callback(list);
    },
    (err) => {
      console.error('Erro no snapshot de lançamentos operacionais:', err);
      callback([]);
    }
  );
}

export function subscribeToAllOperationalFeeEntries(
  callback: (entries: OperationalFeeEntry[]) => void
): Unsubscribe {
  const colRef = collection(db, 'operational_fee_entries');
  return onSnapshot(
    colRef,
    (snap) => {
      const list: OperationalFeeEntry[] = [];
      snap.forEach((d) => list.push(d.data() as OperationalFeeEntry));
      list.sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());
      callback(list);
    },
    (err) => {
      console.error('Erro ao buscar todos os lançamentos operacionais:', err);
      callback([]);
    }
  );
}

// ==========================================
// COBRANÇAS / FATURAS CONSOLIDADAS
// ==========================================
export function subscribeToInvoicesByStore(
  storeId: string,
  callback: (invoices: OperationalInvoice[]) => void
): Unsubscribe {
  const colRef = collection(db, 'operational_invoices');
  const q = query(colRef, where('storeId', '==', storeId));

  return onSnapshot(
    q,
    (snap) => {
      const list: OperationalInvoice[] = [];
      snap.forEach((d) => list.push(d.data() as OperationalInvoice));
      list.sort((a, b) => new Date(b.geradoEm).getTime() - new Date(a.geradoEm).getTime());
      callback(list);
    },
    (err) => {
      console.error('Erro ao buscar cobranças da loja:', err);
      callback([]);
    }
  );
}

export function subscribeToAllInvoices(
  callback: (invoices: OperationalInvoice[]) => void
): Unsubscribe {
  const colRef = collection(db, 'operational_invoices');
  return onSnapshot(
    colRef,
    (snap) => {
      const list: OperationalInvoice[] = [];
      snap.forEach((d) => list.push(d.data() as OperationalInvoice));
      list.sort((a, b) => new Date(b.geradoEm).getTime() - new Date(a.geradoEm).getTime());
      callback(list);
    },
    (err) => {
      console.error('Erro ao buscar todas as cobranças:', err);
      callback([]);
    }
  );
}

/**
 * Fecha um período e consolida os lançamentos pendentes em uma fatura única
 */
export async function generateInvoiceForStore(params: {
  storeId: string;
  storeNome: string;
  periodoInicio: string; // YYYY-MM-DD
  periodoFim: string; // YYYY-MM-DD
  periodoTipo: OperationalBillingPeriod;
  vencimento: string; // YYYY-MM-DD
  saasConfig?: SaasConfig | null;
  authorEmail: string;
}): Promise<OperationalInvoice | null> {
  const { storeId, storeNome, periodoInicio, periodoFim, periodoTipo, vencimento, saasConfig, authorEmail } = params;

  // Buscar todos os lançamentos pendentes da loja
  const q = query(
    collection(db, 'operational_fee_entries'),
    where('storeId', '==', storeId),
    where('status', '==', 'pendente')
  );

  const snap = await getDocs(q);
  const eligibleEntries: OperationalFeeEntry[] = [];

  snap.forEach((d) => {
    const entry = d.data() as OperationalFeeEntry;
    const entryDate = entry.criadoEm.split('T')[0];
    if (entryDate >= periodoInicio && entryDate <= periodoFim) {
      eligibleEntries.push(entry);
    }
  });

  if (eligibleEntries.length === 0) {
    return null;
  }

  const invoiceId = `inv_${storeId}_${Date.now()}`;
  const totalValor = eligibleEntries.reduce((sum, e) => sum + e.taxaAplicada, 0);
  const totalPedidos = eligibleEntries.length;
  const taxaMedia = totalPedidos > 0 ? totalValor / totalPedidos : 0.99;

  // Gerar QR Code Pix Copia e Cola usando os dados reais da Master Admin (SaaS Config)
  let pixPayload = '';
  let pixQrCodeBase64 = '';
  const pixChave = saasConfig?.pixSuperAdmin || '92994642693';
  const pixRecebedor = saasConfig?.nomeRecebedor || 'PEDE AI PLATAFORMA';
  const pixCidade = saasConfig?.cidade || 'MANAUS';

  try {
    pixPayload = gerarBrCode({
      chave: pixChave,
      nomeRecebedor: pixRecebedor,
      cidade: pixCidade,
      valor: totalValor,
      txid: `FAT${invoiceId.slice(-8)}`,
    });
    pixQrCodeBase64 = await gerarQrCodeDataUrl(pixPayload);
  } catch (pixErr) {
    console.warn('Aviso ao gerar QR code Pix para a fatura:', pixErr);
  }

  const invoice: OperationalInvoice = {
    id: invoiceId,
    storeId,
    storeNome,
    periodoInicio,
    periodoFim,
    periodoTipo,
    quantidadePedidos: totalPedidos,
    taxaMedia,
    valorTotal: totalValor,
    vencimento,
    status: 'aberta',
    pedidosIds: eligibleEntries.map((e) => e.orderId),
    lancamentosIds: eligibleEntries.map((e) => e.id),
    pixChave,
    pixRecebedor,
    pixCidade,
    pixPayload,
    pixQrCodeBase64,
    geradoEm: new Date().toISOString(),
  };

  // Salvar fatura
  await setDoc(doc(db, 'operational_invoices', invoiceId), invoice);

  // Atualizar lançamentos para 'em_cobranca' vinculados a essa fatura
  for (const entry of eligibleEntries) {
    await updateDoc(doc(db, 'operational_fee_entries', entry.id), {
      status: 'em_cobranca',
      cobrancaId: invoiceId,
    }).catch(console.error);
  }

  // Registrar auditoria
  await recordAdminAuditLog({
    autorEmail: authorEmail || 'SuperAdmin',
    autorUid: 'superadmin',
    acao: 'fechar_periodo_fatura',
    alvoId: invoiceId,
    alvoNome: storeNome,
    detalhes: `Gerada fatura ${invoiceId} com ${totalPedidos} pedidos. Total: R$ ${totalValor.toFixed(2)}. Vencimento: ${vencimento}`,
  });

  return invoice;
}

/**
 * Lojista anexa comprovante ou informa código de pagamento da fatura
 */
export async function submitInvoicePaymentProof(
  invoiceId: string,
  comprovanteTexto: string
): Promise<void> {
  const docRef = doc(db, 'operational_invoices', invoiceId);
  await updateDoc(docRef, {
    status: 'aguardando_confirmacao',
    comprovanteTexto: comprovanteTexto.trim(),
    comprovanteEnviadoEm: new Date().toISOString(),
  });
}

/**
 * Administradora Master confirma o recebimento da fatura
 */
export async function confirmInvoicePayment(
  invoiceId: string,
  confirmedByEmail: string
): Promise<void> {
  const docRef = doc(db, 'operational_invoices', invoiceId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error('Fatura não encontrada');

  const invoice = snap.data() as OperationalInvoice;
  const nowIso = new Date().toISOString();

  await updateDoc(docRef, {
    status: 'paga',
    confirmadoPor: confirmedByEmail,
    confirmadoEm: nowIso,
  });

  // Atualizar status de todos os lançamentos para 'pago'
  if (invoice.lancamentosIds && invoice.lancamentosIds.length > 0) {
    for (const entryId of invoice.lancamentosIds) {
      await updateDoc(doc(db, 'operational_fee_entries', entryId), {
        status: 'pago',
      }).catch(console.error);
    }
  }

  // Registrar auditoria
  await recordAdminAuditLog({
    autorEmail: confirmedByEmail,
    autorUid: 'superadmin',
    acao: 'confirmar_fatura',
    alvoId: invoiceId,
    alvoNome: invoice.storeNome,
    detalhes: `Pagamento de fatura no valor de R$ ${invoice.valorTotal.toFixed(2)} confirmado com sucesso.`,
  });
}

// ==========================================
// REGISTRO DE AUDITORIA ADMINISTRATIVA
// ==========================================
export async function recordAdminAuditLog(
  log: Omit<AdminAuditLog, 'id' | 'criadoEm'>
): Promise<void> {
  try {
    const id = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const docRef = doc(db, 'admin_audit_logs', id);
    await setDoc(docRef, {
      ...log,
      id,
      criadoEm: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Erro ao gravar log de auditoria:', err);
  }
}

export function subscribeToAdminAuditLogs(
  callback: (logs: AdminAuditLog[]) => void
): Unsubscribe {
  const colRef = collection(db, 'admin_audit_logs');
  return onSnapshot(
    colRef,
    (snap) => {
      const list: AdminAuditLog[] = [];
      snap.forEach((d) => list.push(d.data() as AdminAuditLog));
      list.sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());
      callback(list.slice(0, 100)); // Limitar últimos 100 eventos
    },
    (err) => {
      console.error('Erro ao buscar logs de auditoria:', err);
      callback([]);
    }
  );
}
