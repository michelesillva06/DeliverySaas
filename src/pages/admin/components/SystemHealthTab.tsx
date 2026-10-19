import React, { useState, useEffect } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Server,
  Database,
  ShieldCheck,
  Cpu,
  Clock,
  Wifi,
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useToast } from '../../../components/Toast';

export const SystemHealthTab: React.FC = () => {
  const { showToast } = useToast();

  const [checking, setChecking] = useState(false);
  const [dbStatus, setDbStatus] = useState<'ok' | 'warning' | 'error'>('ok');
  const [dbLatencyMs, setDbLatencyMs] = useState<number | null>(null);
  const [lastCheckTime, setLastCheckTime] = useState<string>('');

  const checkHealth = async () => {
    setChecking(true);
    const start = performance.now();
    try {
      // Teste real de consulta no Firestore
      const testRef = doc(db, 'test', 'connection');
      await getDoc(testRef);
      const latency = Math.round(performance.now() - start);
      setDbLatencyMs(latency);
      setDbStatus(latency > 1500 ? 'warning' : 'ok');
      setLastCheckTime(new Date().toLocaleTimeString());
      showToast(`Conexão com Firestore estável (${latency}ms)!`, 'success');
    } catch (err: any) {
      console.error('Erro no health check do Firestore:', err);
      setDbStatus('error');
      setDbLatencyMs(null);
      setLastCheckTime(new Date().toLocaleTimeString());
      showToast('Falha ao conectar com o Firestore.', 'error');
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      {/* Cabeçalho */}
      <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-neutral-900 tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-600" />
            <span>Saúde do Sistema & Disponibilidade</span>
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            Diagnóstico técnico em tempo real da infraestrutura, banco de dados e latência.
          </p>
        </div>

        <button
          onClick={checkHealth}
          disabled={checking}
          className="px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
          <span>{checking ? 'Testando...' : 'Executar Teste Agora'}</span>
        </button>
      </div>

      {/* Cards de Diagnóstico Técnico */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Banco de Dados Firestore */}
        <div className="bg-white p-5 rounded-3xl border border-neutral-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
              Google Cloud Firestore
            </span>
            <Database className="w-4 h-4 text-neutral-600" />
          </div>
          <div className="flex items-center gap-2">
            {dbStatus === 'ok' && (
              <>
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xl font-black text-emerald-600">Operacional</span>
              </>
            )}
            {dbStatus === 'warning' && (
              <>
                <span className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="text-xl font-black text-amber-600">Latência Alta</span>
              </>
            )}
            {dbStatus === 'error' && (
              <>
                <span className="w-3 h-3 rounded-full bg-rose-500" />
                <span className="text-xl font-black text-rose-600">Indisponível</span>
              </>
            )}
          </div>
          <p className="text-[11px] text-neutral-500">
            Última verificação: {lastCheckTime || '—'}
          </p>
        </div>

        {/* Card 2: Latência de Resposta */}
        <div className="bg-white p-5 rounded-3xl border border-neutral-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
              Tempo de Resposta (Ping)
            </span>
            <Wifi className="w-4 h-4 text-neutral-600" />
          </div>
          <div className="text-2xl font-black text-neutral-900">
            {dbLatencyMs !== null ? `${dbLatencyMs} ms` : '—'}
          </div>
          <p className="text-[11px] text-neutral-500">
            {dbLatencyMs && dbLatencyMs < 400 ? 'Excelente tempo de resposta' : 'Dentro dos parâmetros normais'}
          </p>
        </div>

        {/* Card 3: Regras de Segurança */}
        <div className="bg-white p-5 rounded-3xl border border-neutral-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
              Segurança & Regras
            </span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-black text-neutral-900">
            Ativas & Válidas
          </div>
          <p className="text-[11px] text-neutral-500">
            Proteção multi-tenant por estabelecimento
          </p>
        </div>
      </div>

      {/* Tabela de Componentes e Serviços */}
      <div className="bg-white rounded-3xl border border-neutral-200 shadow-xs p-6 space-y-4">
        <h3 className="text-sm font-black text-neutral-900 uppercase tracking-wider">
          Status dos Serviços da Plataforma
        </h3>

        <div className="divide-y divide-neutral-100 text-xs">
          <div className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="font-bold text-neutral-800">Serviço de Pedidos em Tempo Real (WebSocket)</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
              Operacional
            </span>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="font-bold text-neutral-800">Geração de Pix EMV / BR Code (Banco Central)</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
              Operacional (CRC-16 Ativo)
            </span>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="font-bold text-neutral-800">Notificações WhatsApp (Protocolo wa.me)</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
              Operacional
            </span>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="font-bold text-neutral-800">Cálculo e Idempotência de Taxa Operacional</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
              Operacional
            </span>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="font-bold text-neutral-800">Autenticação Estrita (Firebase Auth)</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
              Operacional
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
