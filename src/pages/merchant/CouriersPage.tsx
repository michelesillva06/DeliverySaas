import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Bike, Trash2, Edit2, MessageCircle, X, Loader2 } from 'lucide-react';
import { Store, Courier } from '../../types';
import {
  subscribeToCouriersByStore,
  createCourierInFirestore,
  updateCourierInFirestore,
  deleteCourierFromFirestore,
} from '../../services/firestoreService';
import { formatCurrency, formatPhone, generateWhatsAppUrl } from '../../lib/formatters';
import { useToast } from '../../components/Toast';

export const CouriersPage: React.FC = () => {
  const { store } = useOutletContext<{ store: Store }>();
  const { showToast } = useToast();

  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCourier, setEditingCourier] = useState<Courier | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = subscribeToCouriersByStore(store.id, (data) => setCouriers(data));
    return () => unsub();
  }, [store.id]);

  const handleOpenModal = (courier?: Courier) => {
    if (courier) {
      setEditingCourier({ ...courier });
    } else {
      setEditingCourier({
        id: '',
        storeId: store.id,
        nome: '',
        telefone: '',
        taxaEntrega: 5.0,
        ativo: true,
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourier) return;
    setSaving(true);
    try {
      if (editingCourier.id) {
        await updateCourierInFirestore(editingCourier);
        showToast('Entregador atualizado no Firestore!', 'success');
      } else {
        const { id, ...data } = editingCourier;
        await createCourierInFirestore({
          ...data,
          storeId: store.id,
        });
        showToast('Entregador cadastrado no Firestore!', 'success');
      }
      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      showToast('Erro ao salvar entregador no Firestore.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Excluir este entregador?')) {
      try {
        await deleteCourierFromFirestore(id);
        showToast('Entregador excluído do Firestore.', 'info');
      } catch (err: any) {
        console.error(err);
        showToast('Erro ao excluir entregador.', 'error');
      }
    }
  };

  const handleToggle = async (c: Courier) => {
    try {
      await updateCourierInFirestore({ ...c, ativo: !c.ativo });
      showToast(c.ativo ? 'Entregador inativado.' : 'Entregador ativado.', 'info');
    } catch (err: any) {
      console.error(err);
      showToast('Erro ao alterar status.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-neutral-900">Gestão de Entregadores</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Cadastre motoboys e entregadores parceiros para atribuir aos pedidos e calcular taxas
          </p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Entregador</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {couriers.length === 0 ? (
          <div className="col-span-full py-12 text-center text-neutral-400 bg-white rounded-2xl border border-neutral-200">
            Nenhum entregador cadastrado no Firestore.
          </div>
        ) : (
          couriers.map((c) => (
            <div
              key={c.id}
              className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-600">
                    <Bike className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-neutral-900">{c.nome}</h3>
                    <p className="text-xs text-neutral-500 font-medium">{formatPhone(c.telefone)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenModal(c)}
                    className="p-1 hover:bg-neutral-100 rounded-lg text-neutral-500 cursor-pointer"
                    title="Editar"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="p-1 hover:bg-rose-50 rounded-lg text-neutral-400 hover:text-rose-600 cursor-pointer"
                    title="Excluir"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-xs">
                <div>
                  <span className="text-neutral-500">Taxa repasse: </span>
                  <span className="font-bold text-neutral-900">{formatCurrency(c.taxaEntrega)}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggle(c)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase transition-colors cursor-pointer ${
                      c.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-600'
                    }`}
                  >
                    {c.ativo ? 'Ativo' : 'Inativo'}
                  </button>

                  {c.telefone && (
                    <a
                      href={generateWhatsAppUrl(c.telefone, 'Olá parceiro! Temos novas entregas para você.')}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg cursor-pointer"
                      title="Enviar WhatsApp"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Entregador */}
      {isModalOpen && editingCourier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <form
            onSubmit={handleSave}
            className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl"
          >
            <div className="flex justify-between items-center border-b border-neutral-100 pb-3">
              <h2 className="font-bold text-base text-neutral-900">
                {editingCourier.id ? 'Editar Entregador' : 'Novo Entregador'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-neutral-700 mb-1">Nome do Entregador *</label>
                <input
                  type="text"
                  required
                  value={editingCourier.nome}
                  onChange={(e) => setEditingCourier({ ...editingCourier, nome: e.target.value })}
                  placeholder="Ex: Carlos Oliveira"
                  className="w-full p-2.5 border border-neutral-200 rounded-xl focus:ring-1 focus:ring-neutral-900"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">WhatsApp / Telefone *</label>
                <input
                  type="tel"
                  required
                  value={editingCourier.telefone}
                  onChange={(e) => setEditingCourier({ ...editingCourier, telefone: e.target.value })}
                  placeholder="92999999999"
                  className="w-full p-2.5 border border-neutral-200 rounded-xl focus:ring-1 focus:ring-neutral-900"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">Taxa padrão de repasse (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editingCourier.taxaEntrega}
                  onChange={(e) =>
                    setEditingCourier({ ...editingCourier, taxaEntrega: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full p-2.5 border border-neutral-200 rounded-xl font-bold focus:ring-1 focus:ring-neutral-900"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 text-xs font-bold bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{saving ? 'Salvando...' : 'Salvar'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
