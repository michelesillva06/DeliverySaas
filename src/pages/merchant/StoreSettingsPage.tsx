import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
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
} from 'lucide-react';
import { Store, DeliveryZone, DayHours } from '../../types';
import {
  saveStoreInFirestore,
  subscribeToDeliveryZonesByStore,
  createDeliveryZoneInFirestore,
  deleteDeliveryZoneInFirestore,
} from '../../services/firestoreService';
import { formatCurrency } from '../../lib/formatters';
import { gerarQrCodeDataUrl } from '../../lib/pix';
import { useToast } from '../../components/Toast';

export const StoreSettingsPage: React.FC = () => {
  const { store } = useOutletContext<{ store: Store }>();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'perfil' | 'horarios' | 'bairros' | 'pagamentos' | 'whatsapp' | 'qrcode'>('perfil');

  // Form State
  const [formData, setFormData] = useState<Store>(store);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [storeQrCodeUrl, setStoreQrCodeUrl] = useState('');
  const [saving, setSaving] = useState(false);

  // Novo Bairro
  const [newBairro, setNewBairro] = useState('');
  const [newTaxa, setNewTaxa] = useState('5.00');
  const [newTempo, setNewTempo] = useState('40');

  useEffect(() => {
    setFormData(store);
  }, [store]);

  useEffect(() => {
    const unsub = subscribeToDeliveryZonesByStore(store.id, (zones) => {
      setDeliveryZones(zones);
    });
    return unsub;
  }, [store.id]);

  useEffect(() => {
    // Gerar QR Code do Cardápio para a aba QR Code
    const storeUrl = `${window.location.origin}/${store.slug}`;
    gerarQrCodeDataUrl(storeUrl).then(setStoreQrCodeUrl);
  }, [store.slug]);

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

  const handleUpdateHours = (dia: number, field: keyof DayHours, val: any) => {
    const updatedHorarios = (formData.horarios || []).map((h) => {
      if (h.dia === dia) {
        return { ...h, [field]: val };
      }
      return h;
    });
    setFormData({ ...formData, horarios: updatedHorarios });
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
          onClick={() => setActiveTab('whatsapp')}
          className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
            activeTab === 'whatsapp' ? 'bg-neutral-900 text-white shadow-xs' : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50'
          }`}
        >
          Mensagens WhatsApp
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
              <label className="block font-bold text-neutral-700 mb-1">URL do Logotipo</label>
              <input
                type="url"
                value={formData.logo || ''}
                onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                placeholder="https://..."
                className="w-full p-3 border border-neutral-200 rounded-xl focus:ring-1 focus:ring-neutral-900"
              />
            </div>

            <div>
              <label className="block font-bold text-neutral-700 mb-1">URL da Imagem de Capa</label>
              <input
                type="url"
                value={formData.capa || ''}
                onChange={(e) => setFormData({ ...formData, capa: e.target.value })}
                placeholder="https://..."
                className="w-full p-3 border border-neutral-200 rounded-xl focus:ring-1 focus:ring-neutral-900"
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
        <form onSubmit={handleSaveProfile} className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-xs space-y-4">
          <p className="text-xs text-neutral-600">
            A loja só aceitará pedidos nos dias e horários configurados como abertos (a menos que a pausa manual esteja ativada).
          </p>

          <div className="space-y-2 divide-y divide-neutral-100 text-xs">
            {formData.horarios?.map((h) => (
              <div key={h.dia} className="pt-2 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 w-36">
                  <input
                    type="checkbox"
                    checked={h.ativo}
                    onChange={(e) => handleUpdateHours(h.dia, 'ativo', e.target.checked)}
                    className="rounded border-neutral-300 text-neutral-900"
                  />
                  <span className={`font-bold ${h.ativo ? 'text-neutral-900' : 'text-neutral-400'}`}>
                    {h.nomeDia}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-neutral-500">Abertura:</span>
                  <input
                    type="time"
                    disabled={!h.ativo}
                    value={h.abertura}
                    onChange={(e) => handleUpdateHours(h.dia, 'abertura', e.target.value)}
                    className="p-2 border border-neutral-200 rounded-lg text-xs disabled:opacity-40"
                  />
                  <span className="text-neutral-500">às</span>
                  <input
                    type="time"
                    disabled={!h.ativo}
                    value={h.fechamento}
                    onChange={(e) => handleUpdateHours(h.dia, 'fechamento', e.target.value)}
                    className="p-2 border border-neutral-200 rounded-lg text-xs disabled:opacity-40"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-3 border-t border-neutral-100">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{saving ? 'Gravando no Firestore...' : 'Salvar Horários'}</span>
            </button>
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
            <div className="divide-y divide-neutral-100 text-xs">
              {deliveryZones.length === 0 ? (
                <div className="p-6 text-center text-neutral-400">Nenhum bairro cadastrado.</div>
              ) : (
                deliveryZones.map((z) => (
                  <div key={z.id} className="p-3.5 flex items-center justify-between hover:bg-neutral-50">
                    <div>
                      <span className="font-bold text-neutral-900 text-sm">{z.bairro}</span>
                      <p className="text-neutral-500 mt-0.5">Tempo estimado: ~{z.tempoMin} min</p>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="font-extrabold text-neutral-900 text-sm">{formatCurrency(z.taxa)}</span>
                      <button
                        onClick={() => handleDeleteZone(z.id)}
                        className="p-1.5 text-neutral-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                        title="Remover Bairro"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
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
          </div>

          <div className="flex justify-end pt-3 border-t border-neutral-100">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{saving ? 'Gravando no Firestore...' : 'Salvar Modelos'}</span>
            </button>
          </div>
        </form>
      )}

      {/* ABA 6: QR CODE DO CARDÁPIO (PARA IMPRESSÃO A5) */}
      {activeTab === 'qrcode' && (
        <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-xs space-y-6 text-center max-w-lg mx-auto">
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
            {window.location.origin}/{store.slug}
          </div>

          <div className="flex justify-center gap-2">
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/${store.slug}`);
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
      )}
    </div>
  );
};
