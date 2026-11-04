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
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  OperationalFeeConfig,
  OperationalFeeEntry,
  OperationalInvoice,
  OperationalBillingCycle,
  BillingModality,
  StoreBillingConfig,
  OperationalPaymentRecord,
  OperationalAdjustment,
  StoreCreditBalance,
  AdminAuditLog,
  Order,
  Store,
  SaasConfig,
} from '../types';
import { gerarBrCode, gerarQrCodeDataUrl } from '../lib/pix';

const CONFIG_DOC_PATH = 'operational_fee_config';
const CONFIG_DOC_ID = 'default';

export const DEFAULT_PLATFORM_SERVICE_FEE = 0.99;

export const DEFAULT_MODALITY_RATES: Record<BillingModality, number> = {
  diaria: 0.99,
  semanal: 0.99,
  quinzenal: 0.99,
};

export const DEFAULT_FEE_CONFIG: OperationalFeeConfig = {
  valorPadraoDiaria: 0.99,
  valorPadraoSemanal: 0.99,
  valorPadraoQuinzenal: 0.99,
  valorPadrao: 0.99,
  ativoGlobal: true,
  periodoApuracao: 'diario',
  diasAposFechamentoVencimento: 3,
  dataInicioCobranca: '2026-01-01',
  lojasConfig: {},
  historicoAlteracoes: [],
};

// ==========================================
// HELPERS DE FUSO HORÁRIO (America/Manaus)
// ==========================================
export function getManausDateString(date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Manaus',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date); // YYYY-MM-DD
  } catch (err) {
    return date.toISOString().split('T')[0];
  }
}

export function getManausIsoString(date = new Date()): string {
  return date.toISOString();
}

/**
 * Calcula o intervalo de datas (início e fim) para a modalidade e data informadas
 */
export function calculateCycleRange(
  modality: BillingModality,
  refDateStr: string,
  diaFechamentoSemanal = 0 // 0 = Domingo
): { dataInicio: string; dataFim: string } {
  const parts = refDateStr.split('-').map(Number);
  const year = parts[0];
  const month = parts[1] - 1; // 0-indexed
  const day = parts[2];

  const date = new Date(year, month, day);

  if (modality === 'diaria') {
    return { dataInicio: refDateStr, dataFim: refDateStr };
  }

  if (modality === 'semanal') {
    // Encontrar o dia de fechamento nesta semana
    const currentDayOfWeek = date.getDay(); // 0 = Dom, 1 = Seg ...
    const diffToClosing = (diaFechamentoSemanal - currentDayOfWeek + 7) % 7;
    
    // Se hoje for o dia de fechamento, o ciclo encerra hoje
    const closingDate = new Date(date);
    if (diffToClosing !== 0) {
      closingDate.setDate(date.getDate() + diffToClosing);
    }

    const startDate = new Date(closingDate);
    startDate.setDate(closingDate.getDate() - 6);

    const fmt = (d: Date) => d.toISOString().split('T')[0];
    return { dataInicio: fmt(startDate), dataFim: fmt(closingDate) };
  }

  // Quinzenal: 1 a 15 e 16 até fim do mês
  if (day <= 15) {
    const dataInicio = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const dataFim = `${year}-${String(month + 1).padStart(2, '0')}-15`;
    return { dataInicio, dataFim };
  } else {
    const lastDayObj = new Date(year, month + 1, 0); // último dia do mês
    const dataInicio = `${year}-${String(month + 1).padStart(2, '0')}-16`;
    const dataFim = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDayObj.getDate()).padStart(2, '0')}`;
    return { dataInicio, dataFim };
  }
}

/**
 * Calcula a data de vencimento a partir da data de fechamento e prazo em dias corridos
 */
export function calculateDueDate(dataFechamento: string, prazoDias: number): string {
  if (prazoDias <= 0) return dataFechamento;
  const parts = dataFechamento.split('-').map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  date.setDate(date.getDate() + prazoDias);
  return date.toISOString().split('T')[0];
}

// ==========================================
// CONFIGURAÇÃO INDIVIDUAL DA LOJA
// ==========================================
export async function getStoreBillingConfig(storeId: string): Promise<StoreBillingConfig> {
  try {
    const docRef = doc(db, 'store_billing_configs', storeId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as StoreBillingConfig;
    }

    // Criar configuração inicial padrão (Modalidade Diária R$ 0.99, Implantação e Mensalidade R$ 0,00)
    const today = getManausDateString();
    const defaultConfig: StoreBillingConfig = {
      storeId,
      modalidade: 'diaria',
      taxaPorPedido: DEFAULT_MODALITY_RATES.diaria,
      taxaEmCentavos: Math.round(DEFAULT_MODALITY_RATES.diaria * 100),
      implantacao: 0,
      mensalidade: 0,
      dataInicioCobranca: today,
      diaFechamentoSemanal: 0,
      prazoPagamentoDias: 3,
      valorMinimoFatura: 0, // Sem limite por padrão
      proximoFechamento: today,
      observacaoNegociacao: '',
      criadoEm: getManausIsoString(),
    };

    await setDoc(docRef, defaultConfig);
    return defaultConfig;
  } catch (err) {
    console.error('Erro ao buscar configuração de cobrança da loja:', err);
    const today = getManausDateString();
    return {
      storeId,
      modalidade: 'diaria',
      taxaPorPedido: DEFAULT_MODALITY_RATES.diaria,
      taxaEmCentavos: 99,
      implantacao: 0,
      mensalidade: 0,
      dataInicioCobranca: today,
      prazoPagamentoDias: 3,
      valorMinimoFatura: 0,
      proximoFechamento: today,
    };
  }
}

export function subscribeToStoreBillingConfig(
  storeId: string,
  callback: (config: StoreBillingConfig | null) => void
): Unsubscribe {
  const docRef = doc(db, 'store_billing_configs', storeId);
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        callback(snap.data() as StoreBillingConfig);
      } else {
        callback(null);
      }
    },
    (err) => {
      console.error('Erro ao escutar configuração da loja:', err);
      callback(null);
    }
  );
}

export async function saveStoreBillingConfig(
  storeId: string,
  configData: Partial<StoreBillingConfig>,
  authorEmail: string,
  justificativa?: string
): Promise<void> {
  const docRef = doc(db, 'store_billing_configs', storeId);
  const current = await getStoreBillingConfig(storeId);

  const modalidade = configData.modalidade || current.modalidade || 'diaria';
  const taxaPorPedido =
    typeof configData.taxaPorPedido === 'number'
      ? configData.taxaPorPedido
      : DEFAULT_MODALITY_RATES[modalidade];
  const taxaEmCentavos = Math.round(taxaPorPedido * 100);

  const updatedConfig: StoreBillingConfig = {
    ...current,
    ...configData,
    modalidade,
    taxaPorPedido,
    taxaEmCentavos,
    atualizadoEm: getManausIsoString(),
  };

  await setDoc(docRef, updatedConfig);

  // Registrar log de auditoria
  await recordAdminAuditLog({
    autorEmail: authorEmail || 'SuperAdmin',
    autorUid: 'superadmin',
    acao: 'alterar_taxa_loja',
    alvoId: storeId,
    alvoNome: `Configuração da loja ${storeId}`,
    detalhes: `Modalidade: ${modalidade}, Taxa: R$ ${taxaPorPedido.toFixed(2)} (${taxaEmCentavos} centavos), Min Fatura: R$ ${(updatedConfig.valorMinimoFatura || 0).toFixed(2)}`,
    justificativa: justificativa || 'Atualização das condições comerciais da loja',
  });
}

// ==========================================
// CONFIGURAÇÃO GLOBAL DA PLATAFORMA
// ==========================================
export async function getOperationalFeeConfig(): Promise<OperationalFeeConfig> {
  try {
    const docRef = doc(db, CONFIG_DOC_PATH, CONFIG_DOC_ID);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { ...DEFAULT_FEE_CONFIG, ...(snap.data() as OperationalFeeConfig) };
    }
    await setDoc(docRef, DEFAULT_FEE_CONFIG);
    return DEFAULT_FEE_CONFIG;
  } catch (err) {
    console.error('Erro ao buscar configuração global de taxa:', err);
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
    data: getManausIsoString(),
    usuario: authorEmail || 'SuperAdmin',
    descricao: `Alteração da configuração operacional global. Taxa padrão: R$ ${(newConfig.valorPadrao || 0.79).toFixed(2)}`,
    justificativa: justificativa.trim() || 'Ajuste de parâmetros operacionais da plataforma',
  };

  const updatedConfig: OperationalFeeConfig = {
    ...newConfig,
    historicoAlteracoes: [changeLog, ...(newConfig.historicoAlteracoes || [])].slice(0, 50),
  };

  await setDoc(docRef, updatedConfig);

  await recordAdminAuditLog({
    autorEmail: authorEmail || 'SuperAdmin',
    autorUid: 'superadmin',
    acao: 'alterar_taxa_global',
    alvoId: 'operational_fee_config',
    alvoNome: 'Configuração Global de Taxa Operacional',
    detalhes: `Valor padrão: R$ ${(newConfig.valorPadrao || 0.79).toFixed(2)}, Ativo global: ${newConfig.ativoGlobal ? 'Sim' : 'Não'}`,
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
  // Pedidos de teste ou cancelados NUNCA geram taxa
  if (order.teste || order.status === 'cancelado') {
    return null;
  }

  // Apenas pedidos entregues ou pronta entrega concluída
  const isConcluido = order.status === 'entregue' || (order.tipo === 'retirada' && order.status === 'pronto');
  if (!isConcluido) {
    return null;
  }

  try {
    // 1. Obter configuração de cobrança da loja
    const storeBilling = await getStoreBillingConfig(order.storeId);

    // 2. Data de início da cobrança
    const orderDate = order.criadoEm ? order.criadoEm.split('T')[0] : getManausDateString();
    if (storeBilling.dataInicioCobranca && orderDate < storeBilling.dataInicioCobranca) {
      return null;
    }

    // 3. IDEMPOTÊNCIA: Checar se já existe taxa gravada para este pedido
    const entryId = `fee_${order.id}`;
    const entryRef = doc(db, 'operational_fee_entries', entryId);
    const existingSnap = await getDoc(entryRef);

    const isPaymentConfirmed = order.pagamento?.status === 'confirmado';
    const nowIso = getManausIsoString();

    if (existingSnap.exists()) {
      const existingEntry = existingSnap.data() as OperationalFeeEntry;
      // Se o pagamento do cliente foi confirmado agora e a taxa estava aguardando conferência, promove para 'pendente' (faturável)
      if (isPaymentConfirmed && existingEntry.status === 'pendente_conferencia') {
        await updateDoc(entryRef, {
          status: 'pendente',
          dataConfirmacaoPagamento: nowIso,
        });
        return { ...existingEntry, status: 'pendente', dataConfirmacaoPagamento: nowIso };
      }
      return existingEntry;
    }

    // 4. Calcular taxa em centavos inteiros (prioriza taxaServico do pedido se definido, senão taxa configurada, padrão 0.99)
    const taxaUnit = typeof order.taxaServico === 'number' && order.taxaServico >= 0
      ? order.taxaServico
      : (storeBilling.taxaPorPedido ?? DEFAULT_PLATFORM_SERVICE_FEE);
    const taxaCentavos = Math.round(taxaUnit * 100);

    // Status da taxa: se o cliente já pagou (confirmado), está 'pendente' (apta para faturamento);
    // se ainda não confirmou, fica em 'pendente_conferencia'
    const feeStatus = isPaymentConfirmed ? 'pendente' : 'pendente_conferencia';

    const entry: OperationalFeeEntry = {
      id: entryId,
      orderId: order.id,
      orderNumero: order.numero,
      storeId: order.storeId,
      storeNome: store.nome,
      dataConclusao: nowIso,
      valorPedido: order.total || 0,
      taxaAplicada: taxaCentavos / 100,
      taxaEmCentavos: taxaCentavos,
      modalidadeAplicada: storeBilling.modalidade || 'diaria',
      status: feeStatus,
      dataConfirmacaoPagamento: isPaymentConfirmed ? nowIso : undefined,
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
 * Promove uma taxa de 'pendente_conferencia' para 'pendente' assim que o pagamento do pedido é confirmado pelo lojista
 */
export async function confirmOrderOperationalFee(orderId: string): Promise<boolean> {
  try {
    const entryId = `fee_${orderId}`;
    const entryRef = doc(db, 'operational_fee_entries', entryId);
    const snap = await getDoc(entryRef);
    if (!snap.exists()) return false;

    const current = snap.data() as OperationalFeeEntry;
    if (current.status === 'pendente_conferencia') {
      const nowIso = getManausIsoString();
      await updateDoc(entryRef, {
        status: 'pendente',
        dataConfirmacaoPagamento: nowIso,
      });
      return true;
    }
    return false;
  } catch (err) {
    console.error('Erro ao promover taxa para confirmada:', err);
    return false;
  }
}

/**
 * Estorna uma taxa operacional se o pedido for cancelado.
 * Se a fatura já tiver sido gerada e paga, adiciona um crédito para o lojista.
 */
export async function reverseOrderOperationalFee(
  orderId: string,
  motivo: string,
  authorEmail = 'Sistema'
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
      estornadoEm: getManausIsoString(),
      motivoEstorno: motivo || 'Pedido cancelado',
    });

    // Se já estava em fatura paga, gerar crédito de repasse para o lojista
    if (current.cobrancaId) {
      const invRef = doc(db, 'operational_invoices', current.cobrancaId);
      const invSnap = await getDoc(invRef);
      if (invSnap.exists() && invSnap.data()?.status === 'paga') {
        await addStoreCredit(
          current.storeId,
          current.taxaAplicada,
          `Estorno de taxa referente ao pedido cancelado #${current.orderNumero}`,
          authorEmail
        );
      }
    }

    return true;
  } catch (err) {
    console.error('Erro ao estornar taxa operacional:', err);
    return false;
  }
}

// ==========================================
// SALDO DE CRÉDITO E AJUSTES MANUAIS
// ==========================================
export async function getStoreCreditBalance(storeId: string): Promise<number> {
  try {
    const docRef = doc(db, 'store_credit_balances', storeId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return (snap.data() as StoreCreditBalance).saldoCredito || 0;
    }
    return 0;
  } catch (err) {
    console.error('Erro ao buscar saldo de crédito da loja:', err);
    return 0;
  }
}

export function subscribeToStoreCreditBalance(
  storeId: string,
  callback: (balance: number) => void
): Unsubscribe {
  const docRef = doc(db, 'store_credit_balances', storeId);
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        callback((snap.data() as StoreCreditBalance).saldoCredito || 0);
      } else {
        callback(0);
      }
    },
    (err) => {
      console.error('Erro ao escutar saldo de crédito:', err);
      callback(0);
    }
  );
}

export async function addStoreCredit(
  storeId: string,
  valor: number,
  justificativa: string,
  authorEmail: string
): Promise<void> {
  const currentCredit = await getStoreCreditBalance(storeId);
  const newCredit = Math.max(0, currentCredit + valor);
  const nowIso = getManausIsoString();

  await setDoc(doc(db, 'store_credit_balances', storeId), {
    storeId,
    saldoCredito: Number(newCredit.toFixed(2)),
    atualizadoEm: nowIso,
  });

  // Registrar ajuste manual
  const adjId = `adj_${Date.now()}`;
  const adjustment: OperationalAdjustment = {
    id: adjId,
    storeId,
    tipo: valor >= 0 ? 'credito' : 'debito',
    valor: Math.abs(valor),
    justificativa,
    autorEmail: authorEmail,
    criadoEm: nowIso,
  };
  await setDoc(doc(db, 'operational_adjustments', adjId), adjustment);

  // Audit log
  await recordAdminAuditLog({
    autorEmail: authorEmail,
    autorUid: 'superadmin',
    acao: 'ajuste_manual_credito_debito',
    alvoId: storeId,
    alvoNome: `Loja ${storeId}`,
    detalhes: `${valor >= 0 ? 'Adicionado crédito' : 'Debitado saldo'} de R$ ${Math.abs(valor).toFixed(2)}. Novo saldo de crédito: R$ ${newCredit.toFixed(2)}`,
    justificativa,
  });
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
 * Fecha um ciclo de apuração para a loja e verifica se o limite mínimo de fatura foi atingido.
 * Se o saldo for inferior ao limite mínimo:
 * - O ciclo é fechado e marcado como 'transportado'.
 * - Os lançamentos acumulados são levados para o próximo fechamento sem gerar fatura de cobrança nem juros/vencimento.
 * Se atingir o limite mínimo (ou se valorMinimoFatura === 0):
 * - É gerada uma fatura consolidade (status: 'em_aberto').
 */
export async function closeBillingCycleForStore(params: {
  storeId: string;
  storeNome: string;
  authorEmail: string;
  saasConfig?: SaasConfig | null;
  forceGenerate?: boolean;
}): Promise<OperationalInvoice | OperationalBillingCycle | null> {
  const { storeId, storeNome, authorEmail, saasConfig, forceGenerate } = params;
  const storeBilling = await getStoreBillingConfig(storeId);

  // Buscar todos os lançamentos pendentes
  const q = query(
    collection(db, 'operational_fee_entries'),
    where('storeId', '==', storeId),
    where('status', '==', 'pendente')
  );

  const snap = await getDocs(q);
  const pendingEntries: OperationalFeeEntry[] = [];
  snap.forEach((d) => pendingEntries.push(d.data() as OperationalFeeEntry));

  // Buscar saldos acumulados de ciclos anteriores que foram 'transportado' e ainda não faturados
  const cyclesQuery = query(
    collection(db, 'operational_billing_cycles'),
    where('storeId', '==', storeId),
    where('status', '==', 'transportado')
  );
  const cyclesSnap = await getDocs(cyclesQuery);
  const carriedCycles: OperationalBillingCycle[] = [];
  cyclesSnap.forEach((d) => carriedCycles.push(d.data() as OperationalBillingCycle));

  const totalPedId = pendingEntries.length;
  if (totalPedId === 0 && carriedCycles.length === 0) {
    return null;
  }

  // Somar centavos dos lançamentos atuais
  const valorAtualCentavos = pendingEntries.reduce((sum, e) => sum + (e.taxaEmCentavos || Math.round(e.taxaAplicada * 100)), 0);
  const valorTransportadoCentavos = carriedCycles.reduce((sum, c) => sum + Math.round(c.valorBruto * 100), 0);
  const valorBrutoTotalCentavos = valorAtualCentavos + valorTransportadoCentavos;
  const valorBrutoTotal = valorBrutoTotalCentavos / 100;

  // Descontar saldo de crédito disponível
  const saldoCredito = await getStoreCreditBalance(storeId);
  const creditosAplicados = Math.min(saldoCredito, valorBrutoTotal);
  const valorLiquidToPay = Math.max(0, valorBrutoTotal - creditosAplicados);

  const hojeStr = getManausDateString();
  const cycleId = `cycle_${storeId}_${Date.now()}`;

  // Se o valor líquido for menor que o limite mínimo da fatura (e não houver forceGenerate)
  const limiteMin = storeBilling.valorMinimoFatura || 0;
  if (!forceGenerate && limiteMin > 0 && valorLiquidToPay < limiteMin) {
    // Encerrar ciclo e transportar saldo para o próximo ciclo
    const cycle: OperationalBillingCycle = {
      id: cycleId,
      storeId,
      storeNome,
      modalidade: storeBilling.modalidade,
      dataInicio: storeBilling.dataInicioCobranca || hojeStr,
      dataFim: hojeStr,
      status: 'transportado',
      pedidosConcluidos: totalPedId,
      valorBrutoEmCentavos: valorAtualCentavos,
      valorBruto: valorAtualCentavos / 100,
      criadoEm: getManausIsoString(),
      encerradoEm: getManausIsoString(),
    };

    await setDoc(doc(db, 'operational_billing_cycles', cycleId), cycle);

    await recordAdminAuditLog({
      autorEmail: authorEmail,
      autorUid: 'superadmin',
      acao: 'fechar_periodo_fatura',
      alvoId: cycleId,
      alvoNome: storeNome,
      detalhes: `Ciclo encerrado e transportado. Saldo R$ ${valorBrutoTotal.toFixed(2)} abaixo do mínimo de R$ ${limiteMin.toFixed(2)}.`,
    });

    return cycle;
  }

  // Caso atingiu o valor mínimo -> Gerar Fatura
  const invoiceId = `inv_${storeId}_${Date.now()}`;
  const dataVencimento = calculateDueDate(hojeStr, storeBilling.prazoPagamentoDias || 3);

  // PIX Config
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
      valor: valorLiquidToPay,
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
    modalidade: storeBilling.modalidade,
    periodoInicio: storeBilling.dataInicioCobranca || hojeStr,
    periodoFim: hojeStr,
    quantidadePedidos: totalPedId + carriedCycles.reduce((s, c) => s + c.pedidosConcluidos, 0),
    taxaAplicada: storeBilling.taxaPorPedido,
    valorBruto: valorBrutoTotal,
    saldosTransportadosOrigem: carriedCycles.map((c) => ({
      cicloId: c.id,
      periodo: `${c.dataInicio} a ${c.dataFim}`,
      valor: c.valorBruto,
    })),
    creditosUtilizados: creditosAplicados,
    valorTotalAPagar: valorLiquidToPay,
    valorPago: 0,
    saldoPendente: valorLiquidToPay,
    dataEmissao: hojeStr,
    vencimento: dataVencimento,
    status: 'em_aberto',
    pedidosIds: pendingEntries.map((e) => e.orderId),
    lancamentosIds: pendingEntries.map((e) => e.id),
    ciclosIds: carriedCycles.map((c) => c.id),
    pixChave,
    pixRecebedor,
    pixCidade,
    pixPayload,
    pixQrCodeBase64,
    geradoEm: getManausIsoString(),
  };

  // Salvar fatura
  await setDoc(doc(db, 'operational_invoices', invoiceId), invoice);

  // Se foram utilizados créditos, abater do saldo de crédito da loja
  if (creditosAplicados > 0) {
    const restanteCredito = Math.max(0, saldoCredito - creditosAplicados);
    await setDoc(doc(db, 'store_credit_balances', storeId), {
      storeId,
      saldoCredito: Number(restanteCredito.toFixed(2)),
      atualizadoEm: getManausIsoString(),
    });
  }

  // Atualizar lançamentos pendentes para 'em_cobranca'
  for (const entry of pendingEntries) {
    await updateDoc(doc(db, 'operational_fee_entries', entry.id), {
      status: 'em_cobranca',
      cobrancaId: invoiceId,
    }).catch(console.error);
  }

  // Atualizar ciclos transportados para 'faturado'
  for (const cycle of carriedCycles) {
    await updateDoc(doc(db, 'operational_billing_cycles', cycle.id), {
      status: 'faturado',
      faturaId: invoiceId,
    }).catch(console.error);
  }

  // Registrar auditoria
  await recordAdminAuditLog({
    autorEmail: authorEmail,
    autorUid: 'superadmin',
    acao: 'fechar_periodo_fatura',
    alvoId: invoiceId,
    alvoNome: storeNome,
    detalhes: `Fatura ${invoiceId} gerada no valor de R$ ${valorLiquidToPay.toFixed(2)} com vencimento em ${dataVencimento}.`,
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
    comprovanteEnviadoEm: getManausIsoString(),
  });
}

/**
 * Administrador Master confirma ou registra pagamento de fatura (suporta pagamento parcial ou excedente)
 */
export async function recordPaymentForInvoice(params: {
  invoiceId: string;
  valorPago: number;
  confirmedByEmail: string;
  observacao?: string;
}): Promise<OperationalInvoice> {
  const { invoiceId, valorPago, confirmedByEmail, observacao } = params;
  const docRef = doc(db, 'operational_invoices', invoiceId);
  const snap = await getDoc(docRef);

  if (!snap.exists()) throw new Error('Fatura não encontrada');

  const invoice = snap.data() as OperationalInvoice;
  const totalPagoAcumulado = (invoice.valorPago || 0) + valorPago;
  const novoSaldoPendente = Math.max(0, invoice.valorTotalAPagar - totalPagoAcumulado);

  let novoStatus: OperationalInvoice['status'] = 'parcialmente_paga';
  if (novoSaldoPendente === 0) {
    novoStatus = 'paga';
  }

  // Se o valor pago for superior ao saldo pendente, gerar crédito para o lojista
  let creditoGerado = 0;
  if (totalPagoAcumulado > invoice.valorTotalAPagar) {
    creditoGerado = Number((totalPagoAcumulado - invoice.valorTotalAPagar).toFixed(2));
    await addStoreCredit(
      invoice.storeId,
      creditoGerado,
      `Troco/Crédito referente a pagamento excedente da fatura #${invoiceId}`,
      confirmedByEmail
    );
  }

  const nowIso = getManausIsoString();

  await updateDoc(docRef, {
    status: novoStatus,
    valorPago: Number(totalPagoAcumulado.toFixed(2)),
    saldoPendente: Number(novoSaldoPendente.toFixed(2)),
    confirmadoPor: confirmedByEmail,
    confirmadoEm: nowIso,
  });

  // Gravar registro individual do pagamento
  const payId = `pay_${Date.now()}`;
  const payRecord: OperationalPaymentRecord = {
    id: payId,
    faturaId: invoiceId,
    storeId: invoice.storeId,
    valor: valorPago,
    dataPagamento: getManausDateString(),
    registradoPor: confirmedByEmail,
    observacao,
    creditoGerado,
    criadoEm: nowIso,
  };
  await setDoc(doc(db, 'operational_payments', payId), payRecord);

  // Se quitada totalmente, atualizar lançamentos para 'pago'
  if (novoStatus === 'paga' && invoice.lancamentosIds) {
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
    acao: novoStatus === 'paga' ? 'confirmar_fatura' : 'registrar_pagamento_parcial',
    alvoId: invoiceId,
    alvoNome: invoice.storeNome,
    detalhes: `Pagamento registrado: R$ ${valorPago.toFixed(2)}. Status da fatura: ${novoStatus}. Saldo pendente: R$ ${novoSaldoPendente.toFixed(2)}`,
  });

  return {
    ...invoice,
    status: novoStatus,
    valorPago: totalPagoAcumulado,
    saldoPendente: novoSaldoPendente,
  };
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
      criadoEm: getManausIsoString(),
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
      callback(list.slice(0, 100));
    },
    (err) => {
      console.error('Erro ao buscar logs de auditoria:', err);
      callback([]);
    }
  );
}
