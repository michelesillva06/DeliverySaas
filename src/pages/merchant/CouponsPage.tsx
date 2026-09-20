import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Tag, Trash2, Edit2, X, Loader2 } from 'lucide-react';
import { Store, Coupon } from '../../types';
import {
  subscribeToCouponsByStore,
  createCouponInFirestore,
  updateCouponInFirestore,
  deleteCouponFromFirestore,
} from '../../services/firestoreService';
import { formatCurrency } from '../../lib/formatters';
import { useToast } from '../../components/Toast';

export const CouponsPage: React.FC = () => {
  const { store } = useOutletContext<{ store: Store }>();
  const { showToast } = useToast();

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = subscribeToCouponsByStore(store.id, (data) => setCoupons(data));
    return () => unsub();
  }, [store.id]);

  const handleOpenModal = (coupon?: Coupon) => {
    if (coupon) {
      setEditingCoupon({ ...coupon });
    } else {
      setEditingCoupon({
        id: '',
        storeId: store.id,
        codigo: '',
        tipo: 'fixo',
        valor: 5,
        pedidoMinimo: 0,
        usos: 0,
        ativo: true,
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCoupon) return;
    setSaving(true);
    try {
      if (editingCoupon.id) {
        await updateCouponInFirestore(editingCoupon);
        showToast('Cupom atualizado no Firestore!', 'success');
      } else {
        const { id, ...data } = editingCoupon;
        await createCouponInFirestore({
          ...data,
          storeId: store.id,
        });
        showToast('Cupom cadastrado no Firestore!', 'success');
      }
      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      showToast('Erro ao salvar cupom no Firestore.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Deseja excluir este cupom?')) {
      try {
        await deleteCouponFromFirestore(id);
        showToast('Cupom excluído do Firestore.', 'info');
      } catch (err: any) {
        console.error(err);
        showToast('Erro ao excluir cupom.', 'error');
      }
    }
  };

  const handleToggle = async (c: Coupon) => {
    try {
      await updateCouponInFirestore({ ...c, ativo: !c.ativo });
      showToast(c.ativo ? 'Cupom pausado.' : 'Cupom ativado.', 'info');
    } catch (err: any) {
      console.error(err);
      showToast('Erro ao atualizar status do cupom.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-neutral-900">Cupons de Desconto</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Crie códigos promocionais sincronizados em tempo real no Firestore
          </p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Criar Cupom</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200 font-bold text-neutral-500 uppercase">
              <th className="p-3 pl-4">Código</th>
              <th className="p-3">Desconto</th>
              <th className="p-3">Pedido Mínimo</th>
              <th className="p-3">Usos</th>
              <th className="p-3">Status</th>
              <th className="p-3 pr-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {coupons.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-neutral-400">
                  Nenhum cupom cadastrado ainda no Firestore.
                </td>
              </tr>
            ) : (
              coupons.map((c) => (
                <tr key={c.id} className="hover:bg-neutral-50/80 transition-colors">
                  <td className="p-3 pl-4 font-mono font-black text-neutral-900 text-sm">{c.codigo}</td>
                  <td className="p-3 font-bold text-emerald-700">
                    {c.tipo === 'porcentagem' ? `${c.valor}% OFF` : `${formatCurrency(c.valor)} OFF`}
                  </td>
                  <td className="p-3 text-neutral-600">
                    {(c.pedidoMinimo || c.minimo || 0) > 0 ? formatCurrency(c.pedidoMinimo || c.minimo || 0) : 'Sem mínimo'}
                  </td>
                  <td className="p-3 text-neutral-600">
                    {c.usos} {c.maxUsos ? `/ ${c.maxUsos}` : 'usos'}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => handleToggle(c)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase transition-colors cursor-pointer ${
                        c.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-600'
                      }`}
                    >
                      {c.ativo ? 'Ativo' : 'Pausado'}
                    </button>
                  </td>
                  <td className="p-3 pr-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleOpenModal(c)}
                        className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-600 cursor-pointer"
                        title="Editar"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="p-1.5 hover:bg-rose-50 rounded-lg text-neutral-400 hover:text-rose-600 cursor-pointer"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Cupom */}
      {isModalOpen && editingCoupon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <form
            onSubmit={handleSave}
            className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl"
          >
            <div className="flex justify-between items-center border-b border-neutral-100 pb-3">
              <h2 className="font-bold text-base text-neutral-900">
                {editingCoupon.id ? 'Editar Cupom' : 'Novo Cupom'}
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
                <label className="block font-bold text-neutral-700 mb-1">Código do Cupom *</label>
                <input
                  type="text"
                  required
                  value={editingCoupon.codigo}
                  onChange={(e) =>
                    setEditingCoupon({
                      ...editingCoupon,
                      codigo: e.target.value.toUpperCase().replace(/\s/g, ''),
                    })
                  }
                  placeholder="Ex: BEMVINDO10"
                  className="w-full p-2.5 border border-neutral-200 rounded-xl font-mono uppercase font-bold focus:ring-1 focus:ring-neutral-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-neutral-700 mb-1">Tipo de Desconto</label>
                  <select
                    value={editingCoupon.tipo}
                    onChange={(e) =>
                      setEditingCoupon({
                        ...editingCoupon,
                        tipo: e.target.value as 'fixo' | 'porcentagem',
                      })
                    }
                    className="w-full p-2.5 border border-neutral-200 rounded-xl bg-white font-medium focus:ring-1 focus:ring-neutral-900"
                  >
                    <option value="fixo">Valor Fixo (R$)</option>
                    <option value="porcentagem">Porcentagem (%)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-neutral-700 mb-1">Valor do Desconto *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editingCoupon.valor}
                    onChange={(e) =>
                      setEditingCoupon({
                        ...editingCoupon,
                        valor: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full p-2.5 border border-neutral-200 rounded-xl font-bold focus:ring-1 focus:ring-neutral-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-neutral-700 mb-1">Pedido Mínimo (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingCoupon.pedidoMinimo}
                    onChange={(e) =>
                      setEditingCoupon({
                        ...editingCoupon,
                        pedidoMinimo: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full p-2.5 border border-neutral-200 rounded-xl focus:ring-1 focus:ring-neutral-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-neutral-700 mb-1">Limite de Usos (Opcional)</label>
                  <input
                    type="number"
                    value={editingCoupon.maxUsos || ''}
                    onChange={(e) =>
                      setEditingCoupon({
                        ...editingCoupon,
                        maxUsos: e.target.value ? parseInt(e.target.value, 10) : undefined,
                      })
                    }
                    placeholder="Ilimitado"
                    className="w-full p-2.5 border border-neutral-200 rounded-xl focus:ring-1 focus:ring-neutral-900"
                  />
                </div>
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
                <span>{saving ? 'Salvando...' : 'Salvar Cupom'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
