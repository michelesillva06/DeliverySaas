import {
  collection,
  doc,
  setDoc,
  query,
  where,
  getDocs,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { StorefrontAccessLog, StorefrontEventType } from '../types';

function getOrCreateSessionId(): string {
  try {
    let sid = sessionStorage.getItem('pedeai_sid');
    if (!sid) {
      sid = `s_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      sessionStorage.setItem('pedeai_sid', sid);
    }
    return sid;
  } catch {
    return `s_anon_${Date.now()}`;
  }
}

/**
 * Registra um evento real de instrumentação no cardápio público
 */
export async function trackStorefrontEvent(
  storeId: string,
  storeSlug: string,
  tipo: StorefrontEventType,
  produtoId?: string
): Promise<void> {
  if (!storeId) return;

  try {
    const sessionId = getOrCreateSessionId();
    const now = new Date();
    const dataStr = now.toISOString().split('T')[0];
    const logId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const log: StorefrontAccessLog = {
      id: logId,
      storeId,
      storeSlug,
      sessionId,
      tipo,
      produtoId,
      data: dataStr,
      timestamp: now.toISOString(),
    };

    await setDoc(doc(db, 'storefront_analytics', logId), log);
  } catch (err) {
    // Falha silenciosa para não interromper a navegação do cliente
    console.debug('Analytics log info:', err);
  }
}

/**
 * Escuta eventos recentes (últimos 15 minutos) para medir visitantes ativos em tempo real
 */
export function subscribeToActiveStorefrontVisitors(
  callback: (activeSessionsCount: number, activeStoresCount: number, todayViewsCount: number) => void
): Unsubscribe {
  const colRef = collection(db, 'storefront_analytics');
  const todayStr = new Date().toISOString().split('T')[0];
  const q = query(colRef, where('data', '==', todayStr));

  return onSnapshot(
    q,
    (snap) => {
      const now = Date.now();
      const fiveMinutesAgo = now - 5 * 60 * 1000;
      const activeSessions = new Set<string>();
      const activeStores = new Set<string>();
      let todayViews = 0;

      snap.forEach((d) => {
        const item = d.data() as StorefrontAccessLog;
        todayViews++;
        const itemTime = new Date(item.timestamp).getTime();
        if (itemTime >= fiveMinutesAgo) {
          activeSessions.add(item.sessionId);
          activeStores.add(item.storeId);
        }
      });

      callback(activeSessions.size, activeStores.size, todayViews);
    },
    (err) => {
      console.error('Erro ao escutar analytics de visitantes:', err);
      callback(0, 0, 0);
    }
  );
}

/**
 * Obtém resumo consolidado de acessos e conversão
 */
export async function getStorefrontAnalyticsSummary(dataInicio: string): Promise<{
  visitasTotais: number;
  visitantesUnicos: number;
  iniciados: number;
  concluidos: number;
}> {
  try {
    const colRef = collection(db, 'storefront_analytics');
    const snap = await getDocs(colRef);
    const sessions = new Set<string>();
    let totalVisitas = 0;
    let iniciados = 0;
    let concluidos = 0;

    snap.forEach((d) => {
      const item = d.data() as StorefrontAccessLog;
      if (item.data >= dataInicio) {
        sessions.add(item.sessionId);
        if (item.tipo === 'visita') totalVisitas++;
        if (item.tipo === 'iniciou_pedido') iniciados++;
        if (item.tipo === 'concluiu_pedido') concluidos++;
      }
    });

    return {
      visitasTotais: totalVisitas,
      visitantesUnicos: sessions.size,
      iniciados,
      concluidos,
    };
  } catch (err) {
    console.error('Erro ao buscar resumo de analytics:', err);
    return { visitasTotais: 0, visitantesUnicos: 0, iniciados: 0, concluidos: 0 };
  }
}
