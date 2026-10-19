import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import {
  Save,
  Clock,
  MapPin,
  QrCode,
  DollarSign,
  MessageCircle,
  Store as StoreIcon,
  Plus,
  Trash2,
  Printer,
  Copy,
  Loader2,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Edit2,
  XCircle,
  Volume2,
  Play,
} from 'lucide-react';
import { Store, DeliveryZone, DayHours } from '../../types';
import {
  saveStoreInFirestore,
  subscribeToDeliveryZonesByStore,
  createDeliveryZoneInFirestore,
  updateDeliveryZoneInFirestore,
  deleteDeliveryZoneInFirestore,
  updateStoreHorariosInFirestore,
} from '../../services/firestoreService';
import {
  formatCurrency,
  normalizeHorarios,
  getStoreCurrentStatusText,
  isStoreOpen,
} from '../../lib/formatters';
import { gerarBrCode, gerarQrCodeDataUrl } from '../../lib/pix';
import { SOUND_OPTIONS, playSoundPreview } from '../../lib/sound';
import { ImageUploader } from '../../components/ImageUploader';
import { useToast } from '../../components/Toast';
import { printService } from '../../services/printService';

/**
 * Valida os períodos de funcionamento de um dia:
 * 1. Fechamento !== Abertura
 * 2. Sem sobreposição de períodos
 */
function validateDayHours(day: DayHours): string[] {
  const errors: string[] = [];
  if (!day.ativo || !day.periodos || day.periodos.length === 0) {
    return errors;
  }

  for (let i = 0; i < day.periodos.length; i++) {
    const p = day.periodos[i];
    if (p.abertura && p.fechamento && p.abertura === p.fechamento) {
      errors.push(`Período ${i + 1}: O horário de fechamento (${p.fechamento}) não pode ser igual ao de abertura (${p.abertura}).`);
    }
  }

  if (day.periodos.length > 1) {
    const minutesCovered = new Uint8Array(1440);
    let overlapFound = false;

    for (const p of day.periodos) {
      if (!p.abertura || !p.fechamento) continue;
      const [hA, mA] = p.abertura.split(':').map(Number);
      const [hF, mF] = p.fechamento.split(':').map(Number);
      if (isNaN(hA) || isNaN(mA) || isNaN(hF) || isNaN(mF)) continue;

      const start = hA * 60 + mA;
      const end = hF * 60 + mF;

      if (start === end) continue;

      if (end > start) {
        for (let m = start; m < end; m++) {
          if (minutesCovered[m]) {
            overlapFound = true;
            break;
          }
          minutesCovered[m] = 1;
        }
      } else {
        // Virada da noite
        for (let m = start; m < 1440; m++) {
          if (minutesCovered[m]) {
            overlapFound = true;
            break;
          }
          minutesCovered[m] = 1;
        }
        for (let m = 0; m < end; m++) {
          if (minutesCovered[m]) {
            overlapFound = true;
            break;
          }
          minutesCovered[m] = 1;
        }
      }

      if (overlapFound) break;
    }

    if (overlapFound) {
      errors.push('Existem períodos com horários sobrepostos neste dia.');
    }
  }

  return errors;
}

export const StoreSettingsPage: React.FC = () => {
  const { store } = useOutletContext<{ store: Store }>();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<'perfil' | 'horarios' | 'bairros' | 'pagamentos' | 'impressora' | 'whatsapp' | 'qrcode'>('perfil');

  // Sync tab with URL search parameter
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['perfil', 'horarios', 'bairros', 'pagamentos', 'impressora', 'whatsapp', 'qrcode'].includes(tabParam)) {
      setActiveTab(tabParam as any);
    }
  }, [searchParams]);

  // Form State
  const [formData, setFormData] = useState<Store>(store);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [zonesError, setZonesError] = useState<string | null>(null);
  const [zonesLoading, setZonesLoading] = useState<boolean>(true);
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [editingTaxa, setEditingTaxa] = useState<string>('');
  const [editingTempo, setEditingTempo] = useState<string>('');
  const [storeQrCodeUrl, setStoreQrCodeUrl] = useState('');
  
  useEffect(() => {
    if (store) {
      const url = `${window.location.origin}/#/${store.slug}`;
      QRCode.toDataURL(url, { width: 300, margin: 2 })
        .then(setStoreQrCodeUrl)
        .catch(console.error);
    }
  }, [store]);

  const [saving, setSaving] = useState(false);
  const [printingTest, setPrintingTest] = useState(false);
  const [playingSoundId, setPlayingSoundId] = useState<string | null>(null);

  const handlePreviewSound = (soundId: 'chime' | 'bell' | 'alert') => {
    setPlayingSoundId(soundId);
    playSoundPreview(soundId);
    setTimeout(() => {
      setPlayingSoundId((prev) => (prev === soundId ? null : prev));
    }, 1200);
  };

  const handlePrintTest = async () => {
    setPrintingTest(true);
    try {
      await printService.imprimirTeste(formData);
      showToast('Comprovante de teste enviado para a impressora!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Erro ao disparar teste de impressão térmica.', 'error');
    } finally {
      setPrintingTest(false);
    }
  };

  // Teste Pix State
  const [testPixModalOpen, setTestPixModalOpen] = useState(false);
  const [testPixBrCode, setTestPixBrCode] = useState('');
  const [testPixQrCodeUrl, setTestPixQrCodeUrl] = useState('');
  const [testPixLoading, setTestPixLoading] = useState(false);

  const handleTestPix = async () => {
    if (!formData.pixKey?.trim()) {
      showToast('Informe uma Chave Pix válida no formulário antes de testar.', 'error');
      return;
    }
    setTestPixLoading(true);
    try {
      const brCode = gerarBrCode({
        tipoChave: formData.pixKeyType || 'aleatoria',
        chave: formData.pixKey,
        nomeRecebedor: formData.pixReceiverName || formData.nome || 'LOJA',
        cidade: formData.pixCity || 'MANAUS',
        valor: 1.00,
        txid: `TESTE${Date.now().toString().slice(-6)}`,
      });

      const qrUrl = await gerarQrCodeDataUrl(brCode);
      setTestPixBrCode(brCode);
      setTestPixQrCodeUrl(qrUrl);
      setTestPixModalOpen(true);

      // Guardar pixTestadoEm em stores/{id} no Firestore
      const nowIso = new Date().toISOString();
      setFormData((prev) => ({ ...prev, pixTestadoEm: nowIso }));
      if (store?.id) {
        await saveStoreInFirestore({ ...store, pixTestadoEm: nowIso });
      }
      showToast('QR Code de teste (R$ 1,00) gerado! Validação Pix registrada.', 'success');
    } catch (err) {
      console.error('Erro ao gerar Pix de teste:', err);
      showToast('Erro ao gerar QR Code de teste do Pix.', 'error');
    } finally {
      setTestPixLoading(false);
    }
  };

  // Assinar mudanças nos Bairros de Entrega do Firestore em tempo real
  useEffect(() => {
    if (!store?.id) return;
    setZonesLoading(true);
    setZonesError(null);

    const unsub = subscribeToDeliveryZonesByStore(
      store.id,
      (zones) => {
        setDeliveryZones(zones);
        setZonesLoading(false);
      },
      (err) => {
        console.error('Erro ao carregar bairros:', err);
        setZonesError(err?.message || 'Erro ao carregar lista de bairros do Firestore.');
        setZonesLoading(false);
      }
    );

    return () => unsub();
  }, [store?.id]);

  // Novo Bairro
  const [newBairro, setNewBairro] = useState('');
  const [newTaxa, setNewTaxa] = useState('5.00');
  const [newTempo, setNewTempo] = useState('40');

  useEffect(() => {
    if (store) {
      setFormData({
        ...store,
        horarios: normalizeHorarios(store.horarios),
      });
    }
  }, [store]);

  // Checar se há alterações pendentes nos horários
  const normalizedInitialHorarios = normalizeHorarios(store.horarios);
  const isHoursDirty =
    JSON.stringify(formData.horarios) !== JSON.stringify(normalizedInitialHorarios) ||
    formData.aberta !== store.aberta;

  // Erros de validação
  const allScheduleErrors = (formData.horarios || []).flatMap((h) => {
    if (!h.ativo) return [];
    return validateDayHours(h).map((msg) => `${h.nomeDia}: ${msg}`);
  });
  const hasValidationErrors = allScheduleErrors.length > 0;

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isHoursDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isHoursDirty]);

  // Atalhos de Horário
  const handleCopyMondayToAll = () => {
    const monday = formData.horarios.find((h) => h.dia === 1);
    if (!monday) return;
    const periodosCopy = (monday.periodos || []).map((p) => ({ ...p }));
    const updated = formData.horarios.map((h) => ({
      ...h,
      ativo: monday.ativo,
      periodos: periodosCopy.map((p) => ({ ...p })),
      abertura: periodosCopy[0]?.abertura || '10:00',
      fechamento: periodosCopy[0]?.fechamento || '22:00',
    }));
    setFormData({ ...formData, horarios: updated });
    showToast('Horários de Segunda-feira copiados para todos os dias!', 'info');
  };

  const handleCopyMondayToWeekdays = () => {
    const monday = formData.horarios.find((h) => h.dia === 1);
    if (!monday) return;
    const periodosCopy = (monday.periodos || []).map((p) => ({ ...p }));
    const updated = formData.horarios.map((h) => {
      if (h.dia >= 1 && h.dia <= 5) {
        return {
          ...h,
          ativo: monday.ativo,
          periodos: periodosCopy.map((p) => ({ ...p })),
          abertura: periodosCopy[0]?.abertura || '10:00',
          fechamento: periodosCopy[0]?.fechamento || '22:00',
        };
      }
      return h;
    });
    setFormData({ ...formData, horarios: updated });
    showToast('Horários de Segunda copiados para Dias Úteis (2ª a 6ª)!', 'info');
  };

  const handleSetOpen24Hours = () => {
    const updated = formData.horarios.map((h) => ({
      ...h,
      ativo: true,
      periodos: [{ abertura: '00:00', fechamento: '23:59' }],
      abertura: '00:00',
      fechamento: '23:59',
    }));
    setFormData({ ...formData, horarios: updated });
    showToast('Todos os dias configurados para 24 horas!', 'info');
  };

  const handleCloseAllDays = () => {
    const updated = formData.horarios.map((h) => ({
      ...h,
      ativo: false,
    }));
    setFormData({ ...formData, horarios: updated });
    showToast('Todos os dias marcados como Fechado.', 'info');
  };

  const handleToggleDayActive = (dia: number, ativo: boolean) => {
    const updated = formData.horarios.map((h) => {
      if (h.dia === dia) {
        return { ...h, ativo };
      }
      return h;
    });
    setFormData({ ...formData, horarios: updated });
  };

  const handleUpdatePeriod = (dia: number, pIndex: number, field: 'abertura' | 'fechamento', value: string) => {
    const updated = formData.horarios.map((h) => {
      if (h.dia === dia) {
        const periodos = [...(h.periodos || [])];
        if (periodos[pIndex]) {
          periodos[pIndex] = { ...periodos[pIndex], [field]: value };
        }
        return {
          ...h,
          periodos,
          abertura: periodos[0]?.abertura || h.abertura,
          fechamento: periodos[0]?.fechamento || h.fechamento,
        };
      }
      return h;
    });
    setFormData({ ...formData, horarios: updated });
  };

  const handleAddPeriod = (dia: number) => {
    const updated = formData.horarios.map((h) => {
      if (h.dia === dia) {
        const periodos = [...(h.periodos || [])];
        if (periodos.length < 3) {
          const lastP = periodos[periodos.length - 1];
          const defaultStart = lastP ? lastP.fechamento : '18:00';
          periodos.push({ abertura: defaultStart, fechamento: '23:00' });
        }
        return { ...h, periodos };
      }
      return h;
    });
    setFormData({ ...formData, horarios: updated });
  };

  const handleRemovePeriod = (dia: number, pIndex: number) => {
    const updated = formData.horarios.map((h) => {
      if (h.dia === dia) {
        const periodos = (h.periodos || []).filter((_, idx) => idx !== pIndex);
        return {
          ...h,
          periodos,
          abertura: periodos[0]?.abertura || '10:00',
          fechamento: periodos[0]?.fechamento || '22:00',
        };
      }
      return h;
    });
    setFormData({ ...formData, horarios: updated });
  };

  const handleSaveHours = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasValidationErrors) {
      showToast('Por favor, corrija os erros nos horários antes de salvar.', 'error');
      return;
    }
    setSaving(true);
    try {
      await updateStoreHorariosInFirestore(store.id, formData.horarios, formData.aberta);
      showToast('Horários de funcionamento salvos com sucesso!', 'success');
    } catch (err: any) {
      console.error('Erro ao salvar horários:', err);
      showToast(err?.message || 'Erro ao salvar no Firestore. Tente novamente.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveStoreInFirestore(formData);
      showToast('Configurações salvas no Firestore com sucesso!', 'success');
    } catch (err: any) {
      console.error(err);
      showToast('Erro ao salvar no Firestore. Tente novamente.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBairro.trim()) return;
    try {
      await createDeliveryZoneInFirestore({
        storeId: store.id,
        bairro: newBairro.trim(),
        taxa: parseFloat(newTaxa) || 0,
        tempoMin: parseInt(newTempo, 10) || 40,
        ativo: true,
      });
      setNewBairro('');
      setNewTaxa('5.00');
      showToast('Bairro cadastrado no Firestore com sucesso!', 'success');
    } catch (err: any) {
      console.error(err);
      showToast('Erro ao cadastrar bairro no Firestore.', 'error');
    }
  };

  const handleDeleteZone = async (id: string) => {
    try {
      await deleteDeliveryZoneInFirestore(id);
      showToast('Bairro removido.', 'info');
    } catch (err: any) {
      console.error(err);
      showToast('Erro ao excluir bairro.', 'error');
    }
  };

  const handleStartEditZone = (z: DeliveryZone) => {
    setEditingZoneId(z.id);
    setEditingTaxa(z.taxa.toString());
    setEditingTempo((z.tempoMin || 40).toString());
  };

  const handleSaveEditedZone = async (id: string) => {
    try {
      const taxaNum = parseFloat(editingTaxa);
      const tempoNum = parseInt(editingTempo, 10);
      if (isNaN(taxaNum) || taxaNum < 0) {
        showToast('Informe uma taxa de entrega válida.', 'error');
        return;
      }
      await updateDeliveryZoneInFirestore(id, {
        taxa: taxaNum,
        tempoMin: isNaN(tempoNum) ? 40 : tempoNum,
      });
      setEditingZoneId(null);
      showToast('Preço e tempo do bairro atualizados!', 'success');
    } catch (err: any) {
      console.error(err);
      showToast('Erro ao atualizar bairro.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-xl font-black text-neutral-900">Configurações da Loja</h1>
        <p className="text-xs text-neutral-500 mt-0.5">
          Personalize dados operacionais, formas de pagamento, horários e WhatsApp
        </p>
      </div>

      {/* Abas */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        <button
          onClick={() => setActiveTab('perfil')}
          className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
            activeTab === 'perfil' ? 'bg-neutral-900 text-white shadow-xs' : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50'
          }`}
        >
          Perfil & Visual
        </button>
        <button
          onClick={() => setActiveTab('horarios')}
          className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
            activeTab === 'horarios' ? 'bg-neutral-900 text-white shadow-xs' : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50'
          }`}
        >
          Horários de Funcionamento
        </button>
        <button
          onClick={() => setActiveTab('bairros')}
          className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
            activeTab === 'bairros' ? 'bg-neutral-900 text-white shadow-xs' : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50'
          }`}
        >
          Bairros & Taxas
        </button>
        <button
          onClick={() => setActiveTab('pagamentos')}
          className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
            activeTab === 'pagamentos' ? 'bg-neutral-900 text-white shadow-xs' : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50'
          }`}
        >
          Pagamentos & Pix
        </button>
        <button
          onClick={() => setActiveTab('impressora')}
          className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'impressora' ? 'bg-neutral-900 text-white shadow-xs' : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50'
          }`}
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Impressora Térmica</span>
        </button>
        <button
          onClick={() => setActiveTab('whatsapp')}
          className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'whatsapp' ? 'bg-neutral-900 text-white shadow-xs' : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50'
          }`}
        >
          <Volume2 className="w-3.5 h-3.5" />
          <span>Sons & Mensagens</span>
        </button>
        <button
          onClick={() => setActiveTab('qrcode')}
          className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
            activeTab === 'qrcode' ? 'bg-neutral-900 text-white shadow-xs' : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50'
          }`}
        >
          QR Code do Cardápio
        </button>
      </div>

      {/* ABA 1: PERFIL & VISUAL */}
      {activeTab === 'perfil' && (
        <form onSubmit={handleSaveProfile} className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-xs space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-neutral-700 mb-1">Nome da Loja *</label>
              <input
                type="text"
                required
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="w-full p-3 border border-neutral-200 rounded-xl focus:ring-1 focus:ring-neutral-900"
              />
            </div>

            <div>
              <label className="block font-bold text-neutral-700 mb-1">Link do Cardápio (Slug) *</label>
              <div className="flex items-center">
                <span className="p-3 bg-neutral-100 border border-r-0 border-neutral-200 rounded-l-xl text-neutral-500 font-mono">
                  /
                </span>
                <input
                  type="text"
                  required
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                  className="w-full p-3 border border-neutral-200 rounded-r-xl focus:ring-1 focus:ring-neutral-900 font-mono"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-neutral-700 mb-1">Descrição Curta</label>
              <input
                type="text"
                value={formData.descricao || ''}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Ex: Os melhores burgers artesanais da cidade"
                className="w-full p-3 border border-neutral-200 rounded-xl focus:ring-1 focus:ring-neutral-900"
              />
            </div>

            <div>
              <label className="block font-bold text-neutral-700 mb-1">Telefone / WhatsApp da Loja *</label>
              <input
                type="tel"
                required
                value={formData.whatsapp}
                onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                placeholder="92999999999"
                className="w-full p-3 border border-neutral-200 rounded-xl focus:ring-1 focus:ring-neutral-900"
              />
            </div>

            <div>
              <label className="block font-bold text-neutral-700 mb-1">Cor Primária (Hex) *</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={formData.corPrimaria}
                  onChange={(e) => setFormData({ ...formData, corPrimaria: e.target.value })}
                  className="w-10 h-10 rounded-xl border border-neutral-200 cursor-pointer p-1"
                />
                <input
                  type="text"
                  value={formData.corPrimaria}
                  onChange={(e) => setFormData({ ...formData, corPrimaria: e.target.value })}
                  className="w-full p-3 border border-neutral-200 rounded-xl font-mono"
                />
              </div>
            </div>

            <div>
              <ImageUploader
                tipo="logo"
                storeId={store.id}
                currentImageUrl={formData.logo}
                label="Logotipo da Loja"
                aspectRatioLabel="Proporção 1:1"
                onImageUploaded={(url) => setFormData((prev) => ({ ...prev, logo: url }))}
                onImageRemoved={() => setFormData((prev) => ({ ...prev, logo: '' }))}
              />
            </div>

            <div className="sm:col-span-2">
              <ImageUploader
                tipo="capa"
                storeId={store.id}
                currentImageUrl={formData.capa}
                label="Imagem de Capa (Banner da Loja)"
                aspectRatioLabel="Proporção 3:1"
                onImageUploaded={(url) => setFormData((prev) => ({ ...prev, capa: url }))}
                onImageRemoved={() => setFormData((prev) => ({ ...prev, capa: '' }))}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-neutral-700 mb-1">Endereço Físico Completo</label>
              <input
                type="text"
                value={formData.endereco}
                onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                className="w-full p-3 border border-neutral-200 rounded-xl focus:ring-1 focus:ring-neutral-900"
              />
            </div>

            <div>
              <label className="block font-bold text-neutral-700 mb-1">Pedido Mínimo (R$)</label>
              <input
                type="number"
                step="0.01"
                value={formData.pedidoMinimo}
                onChange={(e) => setFormData({ ...formData, pedidoMinimo: parseFloat(e.target.value) || 0 })}
                className="w-full p-3 border border-neutral-200 rounded-xl focus:ring-1 focus:ring-neutral-900 font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-neutral-700 mb-1">Tempo Estimado de Entrega (Minutos)</label>
              <input
                type="number"
                value={formData.tempoEstimadoMin}
                onChange={(e) => setFormData({ ...formData, tempoEstimadoMin: parseInt(e.target.value, 10) || 40 })}
                className="w-full p-3 border border-neutral-200 rounded-xl focus:ring-1 focus:ring-neutral-900 font-bold"
              />
            </div>

            {/* Configurações de Impressora Térmica & Automação */}
            <div className="sm:col-span-2 pt-4 border-t border-neutral-100 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                  <Printer className="w-4 h-4 text-neutral-600" />
                  <span>Impressora Térmica & Automação</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('impressora')}
                  className="text-xs text-neutral-600 hover:text-neutral-900 underline font-medium cursor-pointer"
                >
                  Abrir painel completo de impressão →
                </button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-neutral-50 p-4 rounded-xl border border-neutral-200">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="imprimirAuto"
                    checked={formData.imprimirAutoAoAceitar !== false}
                    onChange={(e) => setFormData({ ...formData, imprimirAutoAoAceitar: e.target.checked })}
                    className="mt-1 w-4 h-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 cursor-pointer"
                  />
                  <div>
                    <label htmlFor="imprimirAuto" className="font-bold text-xs text-neutral-900 cursor-pointer">
                      Impressão automática ao aceitar
                    </label>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      Dispara a impressão térmica assim que o pedido for aceito.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-xs text-neutral-900 mb-1">
                    Largura da Bobina
                  </label>
                  <select
                    value={formData.larguraImpressora || '80mm'}
                    onChange={(e) => setFormData({ ...formData, larguraImpressora: e.target.value as '80mm' | '58mm' })}
                    className="w-full p-2.5 bg-white border border-neutral-200 rounded-xl text-xs font-bold focus:ring-1 focus:ring-neutral-900"
                  >
                    <option value="80mm">80mm (Padrão Larga)</option>
                    <option value="58mm">58mm (Mini Térmica)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-xs text-neutral-900 mb-1">
                    Vias de Impressão
                  </label>
                  <select
                    value={formData.viasImpressao || 'ambas'}
                    onChange={(e) => setFormData({ ...formData, viasImpressao: e.target.value as 'cozinha' | 'entrega' | 'ambas' })}
                    className="w-full p-2.5 bg-white border border-neutral-200 rounded-xl text-xs font-bold focus:ring-1 focus:ring-neutral-900"
                  >
                    <option value="ambas">Ambas (Cozinha + Entrega)</option>
                    <option value="cozinha">Apenas Cozinha</option>
                    <option value="entrega">Apenas Entrega</option>
                  </select>
                </div>

                <div className="sm:col-span-3 pt-2 border-t border-neutral-200 flex justify-end">
                  <button
                    type="button"
                    onClick={handlePrintTest}
                    disabled={printingTest}
                    className="px-3.5 py-2 bg-white hover:bg-neutral-100 border border-neutral-300 text-neutral-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {printingTest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
                    <span>Imprimir teste da impressora</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-neutral-100">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{saving ? 'Gravando no Firestore...' : 'Salvar Alterações'}</span>
            </button>
          </div>
        </form>
      )}

      {/* ABA 2: HORÁRIOS DE FUNCIONAMENTO */}
      {activeTab === 'horarios' && (
        <form onSubmit={handleSaveHours} className="space-y-5 w-full max-w-full min-w-0">
          
          {/* BANNER 1: STATUS DA LOJA EM DESTAQUE (Fuso America/Manaus) */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-neutral-400 block">
                  Status Operacional em Tempo Real (Fuso Manaus)
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <div
                    className={`px-3.5 py-1.5 rounded-full font-black text-xs sm:text-sm flex items-center gap-2 shadow-2xs ${
                      isStoreOpen(formData).isOpen
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        : 'bg-rose-100 text-rose-900 border border-rose-300'
                    }`}
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        isStoreOpen(formData).isOpen ? 'bg-emerald-600 animate-pulse' : 'bg-rose-600'
                      }`}
                    />
                    <span>{getStoreCurrentStatusText(formData)}</span>
                  </div>
                </div>
              </div>

              {/* INTERRUPTOR DE PAUSA MANUAL */}
              <div className="flex items-center gap-3 bg-neutral-50 p-3 rounded-xl border border-neutral-200/80 flex-shrink-0">
                <div className="text-right sm:text-left">
                  <span className="text-xs font-bold text-neutral-900 block leading-tight">
                    Pausar pedidos agora
                  </span>
                  <span className="text-[10px] text-neutral-500 font-medium">
                    {!formData.aberta ? 'Pausa ativada (Loja Fechada)' : 'Pausa desativada (Segue horários)'}
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={!formData.aberta}
                    onChange={(e) => setFormData({ ...formData, aberta: !e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600" />
                </label>
              </div>
            </div>

            {/* Aviso de Pausa Manual Ativada */}
            {!formData.aberta && (
              <div className="p-3 bg-amber-50 border border-amber-200/90 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Atenção:</strong> A pausa manual sobressai aos horários fixos. Enquanto estiver ativada, a loja ficará fechada para os clientes no aplicativo.
                </span>
              </div>
            )}
          </div>

          {/* BANNER 2: ATALHOS RÁPIDOS */}
          <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-neutral-500" />
                Atalhos de Configuração Rápida
              </span>
              <span className="text-[10px] text-neutral-400 font-medium">Aplicação em lote</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={handleCopyMondayToAll}
                className="p-2.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl text-[11px] font-bold text-neutral-700 transition-colors flex items-center justify-center gap-1.5 text-center cursor-pointer"
              >
                <Copy className="w-3 h-3 text-neutral-500 flex-shrink-0" />
                <span>Copiar 2ª para Todos</span>
              </button>

              <button
                type="button"
                onClick={handleCopyMondayToWeekdays}
                className="p-2.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl text-[11px] font-bold text-neutral-700 transition-colors flex items-center justify-center gap-1.5 text-center cursor-pointer"
              >
                <Copy className="w-3 h-3 text-neutral-500 flex-shrink-0" />
                <span>Copiar para Dias Úteis</span>
              </button>

              <button
                type="button"
                onClick={handleSetOpen24Hours}
                className="p-2.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl text-[11px] font-bold text-neutral-700 transition-colors flex items-center justify-center gap-1.5 text-center cursor-pointer"
              >
                <Clock className="w-3 h-3 text-neutral-500 flex-shrink-0" />
                <span>Abrir 24 Horas</span>
              </button>

              <button
                type="button"
                onClick={handleCloseAllDays}
                className="p-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl text-[11px] font-bold text-rose-700 transition-colors flex items-center justify-center gap-1.5 text-center cursor-pointer"
              >
                <XCircle className="w-3 h-3 text-rose-500 flex-shrink-0" />
                <span>Fechar Todos os Dias</span>
              </button>
            </div>
          </div>

          {/* LISTA DE DIAS DA SEMANA */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-neutral-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-neutral-900">Horários Semanais</h3>
                <p className="text-[11px] text-neutral-500">
                  Configure até 3 períodos de funcionamento para cada dia da semana.
                </p>
              </div>
              {isHoursDirty && (
                <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Alterações não salvas
                </span>
              )}
            </div>

            <div className="space-y-3">
              {formData.horarios.map((h) => {
                const dayErrors = validateDayHours(h);
                const hasError = dayErrors.length > 0;

                return (
                  <div
                    key={h.dia}
                    className={`p-3.5 sm:p-4 rounded-xl border transition-colors ${
                      hasError
                        ? 'border-rose-300 bg-rose-50/30'
                        : h.ativo
                        ? 'border-neutral-200 bg-neutral-50/50 hover:bg-neutral-50'
                        : 'border-neutral-200 bg-neutral-100/40 opacity-75'
                    }`}
                  >
                    {/* Linha Principal do Dia */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Nome do Dia e Switch */}
                      <div className="flex items-center justify-between sm:justify-start gap-3 min-w-[150px]">
                        <span className={`font-black text-xs sm:text-sm ${h.ativo ? 'text-neutral-900' : 'text-neutral-400'}`}>
                          {h.nomeDia}
                        </span>

                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={h.ativo}
                            onChange={(e) => handleToggleDayActive(h.dia, e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:translate-x-full peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600" />
                          <span className="ml-2 text-[11px] font-bold text-neutral-600">
                            {h.ativo ? 'Aberto' : 'Fechado'}
                          </span>
                        </label>
                      </div>

                      {/* Lista de Períodos se estiver Aberto */}
                      {h.ativo && (
                        <div className="flex-1 space-y-2">
                          {h.periodos?.map((p, pIdx) => (
                            <div key={pIdx} className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                              <span className="text-[11px] font-bold text-neutral-400 min-w-[55px]">
                                Período {pIdx + 1}:
                              </span>
                              <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                                <input
                                  type="time"
                                  value={p.abertura}
                                  onChange={(e) => handleUpdatePeriod(h.dia, pIdx, 'abertura', e.target.value)}
                                  className="p-1.5 sm:p-2 border border-neutral-300 rounded-lg text-xs font-bold text-neutral-900 bg-white focus:ring-2 focus:ring-neutral-900"
                                />
                                <span className="text-xs font-bold text-neutral-400">às</span>
                                <input
                                  type="time"
                                  value={p.fechamento}
                                  onChange={(e) => handleUpdatePeriod(h.dia, pIdx, 'fechamento', e.target.value)}
                                  className="p-1.5 sm:p-2 border border-neutral-300 rounded-lg text-xs font-bold text-neutral-900 bg-white focus:ring-2 focus:ring-neutral-900"
                                />

                                {(h.periodos?.length || 0) > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemovePeriod(h.dia, pIdx)}
                                    title="Remover período"
                                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}

                          {/* Botão para adicionar outro período */}
                          {(h.periodos?.length || 0) < 3 && (
                            <button
                              type="button"
                              onClick={() => handleAddPeriod(h.dia)}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-neutral-700 hover:text-neutral-900 hover:underline pt-1 cursor-pointer"
                            >
                              <Plus className="w-3 h-3 text-neutral-500" />
                              <span>+ Adicionar outro período</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Mensagens de Erro por Dia */}
                    {hasError && (
                      <div className="mt-2.5 pt-2 border-t border-rose-200/60 space-y-1">
                        {dayErrors.map((err, errIdx) => (
                          <p key={errIdx} className="text-xs font-bold text-rose-600 flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>{err}</span>
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* BOTÃO FIXO NO RODAPÉ / FINAL DA ABA */}
            <div className="sticky bottom-0 bg-white/95 backdrop-blur-md pt-3 pb-2 border-t border-neutral-100 flex flex-col sm:flex-row items-center justify-between gap-3 z-10">
              <div className="text-xs text-neutral-500">
                {hasValidationErrors ? (
                  <span className="text-rose-600 font-bold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Existem erros de validação nos horários.
                  </span>
                ) : isHoursDirty ? (
                  <span className="text-amber-700 font-bold">
                    Você possui alterações pendentes de salvamento.
                  </span>
                ) : (
                  <span className="text-emerald-600 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Horários sincronizados com o Firestore.
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={saving || !isHoursDirty || hasValidationErrors}
                className="w-full sm:w-auto px-6 py-3 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-extrabold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{saving ? 'Gravando no Firestore...' : 'Salvar Horários'}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ABA 3: BAIRROS & TAXAS DE ENTREGA */}
      {activeTab === 'bairros' && (
        <div className="space-y-6">
          <form onSubmit={handleAddZone} className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-neutral-900">Cadastrar Novo Bairro Atendido</h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div className="sm:col-span-2">
                <label className="block font-bold text-neutral-700 mb-1">Nome do Bairro *</label>
                <input
                  type="text"
                  required
                  value={newBairro}
                  onChange={(e) => setNewBairro(e.target.value)}
                  placeholder="Ex: Adrianópolis"
                  className="w-full p-2.5 border border-neutral-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">Taxa de Entrega (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={newTaxa}
                  onChange={(e) => setNewTaxa(e.target.value)}
                  className="w-full p-2.5 border border-neutral-200 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">Tempo Médio (min)</label>
                <input
                  type="number"
                  required
                  value={newTempo}
                  onChange={(e) => setNewTempo(e.target.value)}
                  className="w-full p-2.5 border border-neutral-200 rounded-xl"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar Bairro</span>
              </button>
            </div>
          </form>

          <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-neutral-100 flex justify-between items-center">
              <h3 className="font-bold text-sm text-neutral-900">Bairros Atendidos ({deliveryZones.length})</h3>
            </div>

            {zonesError && (
              <div className="p-4 bg-rose-50 border-b border-rose-200 text-rose-700 text-xs flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{zonesError}</span>
              </div>
            )}

            <div className="divide-y divide-neutral-100 text-xs">
              {zonesLoading ? (
                <div className="p-6 text-center text-neutral-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Carregando bairros do Firestore...</span>
                </div>
              ) : deliveryZones.length === 0 ? (
                <div className="p-6 text-center text-neutral-400">Nenhum bairro cadastrado no momento.</div>
              ) : (
                deliveryZones.map((z) => {
                  const isEditing = editingZoneId === z.id;
                  return (
                    <div key={z.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-50">
                      <div>
                        <span className="font-bold text-neutral-900 text-sm">{z.bairro}</span>
                        {!isEditing && (
                          <p className="text-neutral-500 mt-0.5">Tempo estimado: ~{z.tempoMin || 40} min</p>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <span className="text-neutral-500">R$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={editingTaxa}
                              onChange={(e) => setEditingTaxa(e.target.value)}
                              className="w-20 p-1.5 border border-neutral-300 rounded-lg text-xs font-bold"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={editingTempo}
                              onChange={(e) => setEditingTempo(e.target.value)}
                              className="w-16 p-1.5 border border-neutral-300 rounded-lg text-xs"
                            />
                            <span className="text-neutral-500">min</span>
                          </div>
                          <button
                            onClick={() => handleSaveEditedZone(z.id)}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center gap-1"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>Salvar</span>
                          </button>
                          <button
                            onClick={() => setEditingZoneId(null)}
                            className="px-2.5 py-1.5 bg-neutral-200 hover:bg-neutral-300 text-neutral-700 rounded-lg font-bold"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <span className="font-extrabold text-neutral-900 text-sm">{formatCurrency(z.taxa)}</span>
                          <button
                            onClick={() => handleStartEditZone(z)}
                            className="p-1.5 text-neutral-500 hover:text-neutral-900 rounded-lg hover:bg-neutral-100 cursor-pointer"
                            title="Editar Preço e Tempo"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteZone(z.id)}
                            className="p-1.5 text-neutral-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                            title="Remover Bairro"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ABA 4: PAGAMENTOS & PIX */}
      {activeTab === 'pagamentos' && (
        <form onSubmit={handleSaveProfile} className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-xs space-y-5">
          <div className="space-y-3">
            <h3 className="font-bold text-sm text-neutral-900">Chave Pix da Loja (Para EMV Copia e Cola & QR Code)</h3>
            <p className="text-xs text-neutral-500">
              O sistema gera o QR Code e o código EMV padrão Banco Central automaticamente com o valor do pedido.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block font-bold text-neutral-700 mb-1">Tipo de Chave *</label>
                <select
                  value={formData.pixKeyType || 'aleatoria'}
                  onChange={(e) => setFormData({ ...formData, pixKeyType: e.target.value as any })}
                  className="w-full p-3 border border-neutral-200 rounded-xl focus:ring-1 focus:ring-neutral-900 bg-white"
                >
                  <option value="cpf">CPF</option>
                  <option value="cnpj">CNPJ</option>
                  <option value="email">E-mail</option>
                  <option value="telefone">Telefone (DDD + Celular)</option>
                  <option value="aleatoria">Chave Aleatória (EVP/UUID)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">Chave Pix *</label>
                <input
                  type="text"
                  required
                  value={formData.pixKey}
                  onChange={(e) => setFormData({ ...formData, pixKey: e.target.value })}
                  placeholder="CNPJ, CPF, E-mail, Celular ou EVP"
                  className="w-full p-3 border border-neutral-200 rounded-xl font-mono focus:ring-1 focus:ring-neutral-900"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">Nome do Titular da Conta *</label>
                <input
                  type="text"
                  required
                  value={formData.pixReceiverName || ''}
                  onChange={(e) => setFormData({ ...formData, pixReceiverName: e.target.value })}
                  placeholder="Ex: JOAO DA SILVA"
                  className="w-full p-3 border border-neutral-200 rounded-xl uppercase focus:ring-1 focus:ring-neutral-900"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">Cidade da Conta *</label>
                <input
                  type="text"
                  required
                  value={formData.pixCity || ''}
                  onChange={(e) => setFormData({ ...formData, pixCity: e.target.value })}
                  placeholder="Ex: MANAUS"
                  className="w-full p-3 border border-neutral-200 rounded-xl uppercase focus:ring-1 focus:ring-neutral-900"
                />
              </div>
            </div>

            {/* AVISO FIXO DA CHAVE PIX */}
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs leading-relaxed flex items-start gap-2.5 shadow-2xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <span>
                Confirme que esta chave está cadastrada e <strong>ATIVA</strong> no aplicativo do seu banco (Pix &rarr; Minhas chaves) antes de salvar. Um CPF, CNPJ, e-mail ou telefone só funciona aqui se já for uma chave Pix registrada — não basta ser um documento válido.
              </span>
            </div>

            {/* BOTÃO E STATUS DE TESTE PIX */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-neutral-50 rounded-xl border border-neutral-200">
              <div>
                <h4 className="font-bold text-xs text-neutral-900 flex items-center gap-1.5">
                  <QrCode className="w-4 h-4 text-neutral-700" />
                  <span>Validação de Chave Pix no Banco</span>
                </h4>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  {formData.pixTestadoEm ? (
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Pix testado em {new Date(formData.pixTestadoEm).toLocaleDateString('pt-BR')} às {new Date(formData.pixTestadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  ) : (
                    'Gere um QR Code de teste de R$ 1,00 para confirmar no seu app bancário se seu nome aparece.'
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={handleTestPix}
                disabled={testPixLoading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50 flex-shrink-0"
              >
                {testPixLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                <span>Testar meu Pix (R$ 1,00)</span>
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-neutral-100 space-y-3 text-xs">
            <h3 className="font-bold text-sm text-neutral-900">Métodos de Pagamento Habilitados no Checkout</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.pagamentos.pix}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      pagamentos: { ...formData.pagamentos, pix: e.target.checked },
                    })
                  }
                  className="rounded border-neutral-300 text-neutral-900"
                />
                <span className="font-bold text-neutral-800">Pix Direto (QR Code + Copia e Cola)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.pagamentos.dinheiro}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      pagamentos: { ...formData.pagamentos, dinheiro: e.target.checked },
                    })
                  }
                  className="rounded border-neutral-300 text-neutral-900"
                />
                <span className="font-bold text-neutral-800">Dinheiro em espécie (com opção de troco)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.pagamentos.cartaoEntrega}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      pagamentos: { ...formData.pagamentos, cartaoEntrega: e.target.checked },
                    })
                  }
                  className="rounded border-neutral-300 text-neutral-900"
                />
                <span className="font-bold text-neutral-800">Cartão na Entrega (Maquininha com o entregador)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.pagamentos.whatsapp}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      pagamentos: { ...formData.pagamentos, whatsapp: e.target.checked },
                    })
                  }
                  className="rounded border-neutral-300 text-neutral-900"
                />
                <span className="font-bold text-neutral-800">Combinar no WhatsApp</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-neutral-100">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{saving ? 'Gravando no Firestore...' : 'Salvar Pagamentos'}</span>
            </button>
          </div>
        </form>
      )}

      {/* ABA: IMPRESSORA TÉRMICA PROFISSIONAL */}
      {activeTab === 'impressora' && (
        <form onSubmit={handleSaveProfile} className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-100">
            <div>
              <h2 className="text-base font-black text-neutral-900 flex items-center gap-2">
                <Printer className="w-5 h-5 text-neutral-900" />
                <span>Configurações da Impressora Térmica (Cupom)</span>
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Otimizado para restaurantes e delivery com bobinas térmicas de 80mm e 58mm.
              </p>
            </div>

            <button
              type="button"
              onClick={handlePrintTest}
              disabled={printingTest}
              className="px-4 py-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer self-start sm:self-auto shadow-2xs"
            >
              {printingTest ? <Loader2 className="w-4 h-4 animate-spin text-amber-700" /> : <Printer className="w-4 h-4 text-amber-700" />}
              <span>Imprimir teste da impressora</span>
            </button>
          </div>

          {/* 1. Largura da Bobina */}
          <div className="space-y-3">
            <label className="block text-xs font-black text-neutral-900 uppercase tracking-wider">
              1. Largura do Papel / Bobina Térmica
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div
                onClick={() => setFormData({ ...formData, larguraImpressora: '80mm' })}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  (formData.larguraImpressora || '80mm') === '80mm'
                    ? 'border-neutral-900 bg-neutral-50 shadow-xs'
                    : 'border-neutral-200 hover:border-neutral-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-sm text-neutral-900">80mm (Padrão de Restaurantes)</span>
                  {(formData.larguraImpressora || '80mm') === '80mm' && (
                    <span className="px-2 py-0.5 bg-neutral-900 text-white rounded text-[10px] font-bold">ATIVO</span>
                  )}
                </div>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Bobina larga (3 polegadas). Ideal para Epson TM-T20, Bematech MP-4200, Elgin i9, Daruma, etc. Maior legibilidade e espaçamento.
                </p>
              </div>

              <div
                onClick={() => setFormData({ ...formData, larguraImpressora: '58mm' })}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  formData.larguraImpressora === '58mm'
                    ? 'border-neutral-900 bg-neutral-50 shadow-xs'
                    : 'border-neutral-200 hover:border-neutral-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-sm text-neutral-900">58mm (Mini Térmica / Portátil)</span>
                  {formData.larguraImpressora === '58mm' && (
                    <span className="px-2 py-0.5 bg-neutral-900 text-white rounded text-[10px] font-bold">ATIVO</span>
                  )}
                </div>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Bobina estreita (2 polegadas). Ideal para mini impressoras Bluetooth, maquininhas POS inteligentes e impressoras portáteis.
                </p>
              </div>
            </div>
          </div>

          {/* 2. Quantidade de Vias */}
          <div className="space-y-3">
            <label className="block text-xs font-black text-neutral-900 uppercase tracking-wider">
              2. Quantidade de Vias a Imprimir
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div
                onClick={() => setFormData({ ...formData, viasImpressao: 'ambas' })}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                  (formData.viasImpressao || 'ambas') === 'ambas'
                    ? 'border-neutral-900 bg-neutral-50 shadow-xs'
                    : 'border-neutral-200 hover:border-neutral-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-neutral-900">Ambas as Vias</span>
                  {(formData.viasImpressao || 'ambas') === 'ambas' && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  )}
                </div>
                <p className="text-[11px] text-neutral-500 leading-tight">
                  1 Comanda da Cozinha + 1 Cupom de Entrega/Cliente.
                </p>
              </div>

              <div
                onClick={() => setFormData({ ...formData, viasImpressao: 'cozinha' })}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                  formData.viasImpressao === 'cozinha'
                    ? 'border-neutral-900 bg-neutral-50 shadow-xs'
                    : 'border-neutral-200 hover:border-neutral-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-neutral-900">Apenas Cozinha</span>
                  {formData.viasImpressao === 'cozinha' && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  )}
                </div>
                <p className="text-[11px] text-neutral-500 leading-tight">
                  Somente itens, quantidades e observações para a equipe de preparo.
                </p>
              </div>

              <div
                onClick={() => setFormData({ ...formData, viasImpressao: 'entrega' })}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                  formData.viasImpressao === 'entrega'
                    ? 'border-neutral-900 bg-neutral-50 shadow-xs'
                    : 'border-neutral-200 hover:border-neutral-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-neutral-900">Apenas Entrega / Caixa</span>
                  {formData.viasImpressao === 'entrega' && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  )}
                </div>
                <p className="text-[11px] text-neutral-500 leading-tight">
                  Somente cupom com dados de entrega, endereço e total financeiro.
                </p>
              </div>
            </div>
          </div>

          {/* 3. Impressão Automática ao Aceitar */}
          <div className="space-y-3">
            <label className="block text-xs font-black text-neutral-900 uppercase tracking-wider">
              3. Automação no Kanban
            </label>
            <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <span className="font-bold text-xs text-neutral-900 block">
                  Impressão Automática ao Aceitar Pedido
                </span>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Ao clicar em <strong>&quot;Aceitar Pedido&quot;</strong> na coluna de novos pedidos ou no modal de detalhes, o sistema envia a impressão para a fila imediatamente. O sistema possui controle rigoroso de envio único (idempotência), garantindo que cada pedido seja impresso apenas 1 vez.
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-1">
                <input
                  type="checkbox"
                  checked={formData.imprimirAutoAoAceitar !== false}
                  onChange={(e) => setFormData({ ...formData, imprimirAutoAoAceitar: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
              </label>
            </div>
          </div>

          {/* 4. Arquitetura & Compatibilidade PrintService */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-2 text-xs text-blue-900">
            <div className="flex items-center gap-2 font-bold text-blue-950">
              <Sparkles className="w-4 h-4 text-blue-700" />
              <span>Arquitetura Profissional (Camada PrintService Ativa)</span>
            </div>
            <p className="text-blue-800 leading-relaxed">
              O sistema utiliza a camada centralizada <strong>PrintService</strong> com fila serial assíncrona para evitar travamentos ou diálogos de impressão sobrepostos. O gerador de comandos nativo <strong>ESC/POS</strong> já está preparado para futuras integrações diretas via Print Agent local (USB / Serial / TCP-IP 9100) sem necessidade de refatorar seu aplicativo.
            </p>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
            <button
              type="button"
              onClick={handlePrintTest}
              disabled={printingTest}
              className="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
            >
              {printingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              <span>Imprimir teste da impressora</span>
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{saving ? 'Gravando no Firestore...' : 'Salvar Configurações de Impressão'}</span>
            </button>
          </div>
        </form>
      )}

      {/* ABA 5: MENSAGENS WHATSAPP */}
      {activeTab === 'whatsapp' && (
        <form onSubmit={handleSaveProfile} className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-xs space-y-4">
          <p className="text-xs text-neutral-600">
            Configure os textos automáticos disparados para o cliente pelo WhatsApp com as variáveis:{' '}
            <code className="bg-neutral-100 px-1 py-0.5 rounded text-neutral-800 font-mono">
              {'{nome}'}
            </code>
            ,{' '}
            <code className="bg-neutral-100 px-1 py-0.5 rounded text-neutral-800 font-mono">
              {'{numero}'}
            </code>
            ,{' '}
            <code className="bg-neutral-100 px-1 py-0.5 rounded text-neutral-800 font-mono">
              {'{total}'}
            </code>
            ,{' '}
            <code className="bg-neutral-100 px-1 py-0.5 rounded text-neutral-800 font-mono">
              {'{tempo}'}
            </code>
            .
          </p>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-neutral-700 mb-1">Ao Aceitar Pedido:</label>
              <textarea
                rows={2}
                value={formData.mensagensWhatsapp?.aceito || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    mensagensWhatsapp: { ...formData.mensagensWhatsapp, aceito: e.target.value },
                  })
                }
                className="w-full p-3 border border-neutral-200 rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-neutral-700 mb-1">Ao Entrar em Preparo:</label>
              <textarea
                rows={2}
                value={formData.mensagensWhatsapp?.preparo || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    mensagensWhatsapp: { ...formData.mensagensWhatsapp, preparo: e.target.value },
                  })
                }
                className="w-full p-3 border border-neutral-200 rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-neutral-700 mb-1">Ao Sair para Entrega:</label>
              <textarea
                rows={2}
                value={formData.mensagensWhatsapp?.saiuEntrega || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    mensagensWhatsapp: { ...formData.mensagensWhatsapp, saiuEntrega: e.target.value },
                  })
                }
                className="w-full p-3 border border-neutral-200 rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-neutral-700 mb-1">Ao Ficar Pronto para Retirada:</label>
              <textarea
                rows={2}
                value={formData.mensagensWhatsapp?.prontoRetirada || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    mensagensWhatsapp: { ...formData.mensagensWhatsapp, prontoRetirada: e.target.value },
                  })
                }
                className="w-full p-3 border border-neutral-200 rounded-xl"
              />
            </div>

            {/* Seção de Som de Notificação de Novo Pedido */}
            <div className="pt-3 border-t border-neutral-100 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="block font-black text-neutral-900 text-xs flex items-center gap-1.5">
                    <Volume2 className="w-4 h-4 text-rose-600" />
                    <span>Som de Alerta de Novo Pedido</span>
                  </label>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    Ouça uma prévia de cada som abaixo, selecione o que mais gostar e salve para tocar no painel de pedidos.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handlePreviewSound(formData.soundPreference || 'chime')}
                  className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
                  title="Testar o som selecionado atualmente"
                >
                  <Play className="w-3.5 h-3.5 fill-rose-600 text-rose-600" />
                  <span>Testar Selecionado</span>
                </button>
              </div>

              {/* Grid com os 3 cards de áudio */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                {SOUND_OPTIONS.map((opt) => {
                  const isSelected = (formData.soundPreference || 'chime') === opt.id;
                  const isPlaying = playingSoundId === opt.id;

                  return (
                    <div
                      key={opt.id}
                      onClick={() => {
                        setFormData({ ...formData, soundPreference: opt.id });
                        handlePreviewSound(opt.id);
                      }}
                      className={`relative p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-3 text-left ${
                        isSelected
                          ? 'border-neutral-900 bg-white shadow-sm ring-2 ring-neutral-900/10'
                          : 'border-neutral-200/90 bg-neutral-50/70 hover:bg-white hover:border-neutral-300'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                              isSelected
                                ? 'bg-neutral-900 text-white'
                                : 'bg-neutral-200 text-neutral-600'
                            }`}
                          >
                            {opt.tag}
                          </span>

                          <input
                            type="radio"
                            name="soundPreference"
                            checked={isSelected}
                            onChange={() => {
                              setFormData({ ...formData, soundPreference: opt.id });
                              handlePreviewSound(opt.id);
                            }}
                            className="w-4 h-4 text-neutral-900 focus:ring-neutral-900 cursor-pointer accent-neutral-900"
                          />
                        </div>

                        <h4 className="font-extrabold text-xs text-neutral-900 pt-0.5">
                          {opt.nome}
                        </h4>
                        <p className="text-[11px] text-neutral-500 leading-snug">
                          {opt.descricao}
                        </p>
                      </div>

                      {/* Botão Ouvir Prévia */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFormData({ ...formData, soundPreference: opt.id });
                          handlePreviewSound(opt.id);
                        }}
                        className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          isPlaying
                            ? 'bg-rose-600 text-white shadow-xs animate-pulse'
                            : isSelected
                            ? 'bg-neutral-900 hover:bg-neutral-800 text-white shadow-2xs'
                            : 'bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-200'
                        }`}
                      >
                        {isPlaying ? (
                          <>
                            <Volume2 className="w-3.5 h-3.5 animate-bounce" />
                            <span>Tocando Som...</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3 fill-current" />
                            <span>Ouvir Prévia</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-neutral-100">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{saving ? 'Gravando no Firestore...' : 'Salvar Configurações'}</span>
            </button>
          </div>
        </form>
      )}

      {/* ABA 6: QR CODE DO CARDÁPIO (PARA IMPRESSÃO A5) */}
      {activeTab === 'qrcode' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-xs space-y-6 text-center max-w-lg mx-auto print:hidden">
            <div>
              <h2 className="text-base font-bold text-neutral-900">QR Code Oficial do Seu Cardápio</h2>
              <p className="text-xs text-neutral-500 mt-1">
                Coloque este QR Code nas mesas, balcão ou envie aos clientes para abrirem seu cardápio instantaneamente.
              </p>
            </div>

            <div className="p-4 bg-neutral-50 border-2 border-dashed border-neutral-200 rounded-2xl inline-block">
              {storeQrCodeUrl ? (
                <img src={storeQrCodeUrl} alt="QR Code Cardápio" className="w-56 h-56 mx-auto object-contain" />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center text-xs text-neutral-400">
                  Gerando QR Code...
                </div>
              )}
            </div>

            <div className="text-xs font-mono text-neutral-600 bg-neutral-100 p-2.5 rounded-xl break-all">
              {window.location.origin}/#/{store.slug}
            </div>

            <div className="flex justify-center gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/#/${store.slug}`);
                  showToast('Link do cardápio copiado!', 'success');
                }}
                className="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-4 h-4" />
                <span>Copiar Link</span>
              </button>

              <button
                onClick={() => window.print()}
                className="px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Cartaz</span>
              </button>
            </div>
          </div>

          {/* Printable Poster */}
          <div className="hidden print:block p-8 text-center border-4 border-neutral-900 rounded-3xl max-w-md mx-auto space-y-6">
            <h1 className="text-3xl font-black">{store.nome}</h1>
            <p className="text-lg">Faça seu pedido pelo nosso cardápio digital!</p>
            {storeQrCodeUrl && (
              <img src={storeQrCodeUrl} alt="QR Code" className="w-64 h-64 mx-auto" />
            )}
            <p className="text-base font-bold">Aproxime a câmera do seu celular</p>
          </div>
        </div>
      )}

      {/* MODAL DE TESTE PIX (R$ 1,00) */}
      {testPixModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 space-y-4 relative">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="font-extrabold text-sm text-neutral-900 flex items-center gap-2">
                <QrCode className="w-5 h-5 text-emerald-600" />
                <span>Teste de Validação Pix (R$ 1,00)</span>
              </h3>
              <button
                type="button"
                onClick={() => setTestPixModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* QR Code */}
            <div className="text-center space-y-2">
              <div className="p-3 bg-white border-2 border-dashed border-neutral-200 rounded-2xl inline-block">
                {testPixQrCodeUrl ? (
                  <img src={testPixQrCodeUrl} alt="QR Code Teste Pix" className="w-48 h-48 mx-auto" />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center text-xs text-neutral-400">
                    Gerando...
                  </div>
                )}
              </div>
              <p className="text-[11px] font-bold text-emerald-800 bg-emerald-50 py-1 px-3 rounded-lg inline-block">
                Valor do teste: R$ 1,00
              </p>
            </div>

            {/* Copia e Cola */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-neutral-700">Código Pix Copia e Cola:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={testPixBrCode}
                  className="flex-1 p-2 bg-neutral-50 border border-neutral-200 rounded-xl text-[10px] font-mono text-neutral-600 truncate"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(testPixBrCode);
                    showToast('Código Pix copiado!', 'success');
                  }}
                  className="px-3 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer flex-shrink-0"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar</span>
                </button>
              </div>
            </div>

            {/* Checklist Visual Exigida */}
            <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 space-y-2.5 text-xs text-neutral-800">
              <h4 className="font-extrabold text-neutral-900 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Instruções de Validação:</span>
              </h4>
              <ol className="space-y-2 text-xs font-medium">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-neutral-900 bg-white border border-neutral-300 rounded px-1.5 py-0.5 text-[10px] shadow-2xs">1</span>
                  <span>Abra o app do seu banco</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-neutral-900 bg-white border border-neutral-300 rounded px-1.5 py-0.5 text-[10px] shadow-2xs">2</span>
                  <span>Escaneie ou cole o código</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-neutral-900 bg-white border border-neutral-300 rounded px-1.5 py-0.5 text-[10px] shadow-2xs">3</span>
                  <span>Confirme que aparece <strong>SEU NOME</strong> e <strong>R$ 1,00</strong></span>
                </li>
                <li className="flex items-start gap-2 text-rose-700 font-semibold bg-rose-50 p-2.5 rounded-xl border border-rose-200 mt-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <span>4. Se der erro, a chave não está ativa nesta conta — corrija em Configurações.</span>
                </li>
              </ol>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setTestPixModalOpen(false)}
                className="w-full sm:w-auto px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Concluir Teste
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
