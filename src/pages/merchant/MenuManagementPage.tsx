import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Plus,
  Edit2,
  Trash2,
  Utensils,
  Layers,
  Settings2,
  Check,
  X,
  Search,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';
import { Store, Category, Product, OptionGroup, OptionItem } from '../../types';
import {
  subscribeToCategoriesByStore,
  subscribeToProductsByStore,
  subscribeToOptionGroupsByStore,
  createCategoryInFirestore,
  updateCategoryInFirestore,
  deleteCategoryInFirestore,
  createProductInFirestore,
  updateProductInFirestore,
  deleteProductInFirestore,
  createOptionGroupInFirestore,
  updateOptionGroupInFirestore,
  deleteOptionGroupInFirestore,
} from '../../services/firestoreService';
import { formatCurrency } from '../../lib/formatters';
import { useToast } from '../../components/Toast';

export const MenuManagementPage: React.FC = () => {
  const { store } = useOutletContext<{ store: Store }>();
  const { showToast } = useToast();

  const [tab, setTab] = useState<'produtos' | 'categorias' | 'complementos'>('produtos');
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [optionGroups, setOptionGroups] = useState<OptionGroup[]>([]);

  // Modais de Criação/Edição
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);

  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);

  const [editingOptionGroup, setEditingOptionGroup] = useState<OptionGroup | null>(null);
  const [isOptionGroupModalOpen, setIsOptionGroupModalOpen] = useState(false);
  const [savingOptionGroup, setSavingOptionGroup] = useState(false);

  const [searchProd, setSearchProd] = useState('');
  const [selectedCatFilter, setSelectedCatFilter] = useState('');

  useEffect(() => {
    const unsubCat = subscribeToCategoriesByStore(store.id, (cats) => setCategories(cats));
    const unsubProd = subscribeToProductsByStore(store.id, (prods) => setProducts(prods));
    const unsubOpt = subscribeToOptionGroupsByStore(store.id, (opts) => setOptionGroups(opts));
    return () => {
      unsubCat();
      unsubProd();
      unsubOpt();
    };
  }, [store.id]);

  // --- Handlers de Produto ---
  const handleOpenProductModal = (prod?: Product) => {
    if (prod) {
      setEditingProduct({ ...prod });
    } else {
      setEditingProduct({
        id: '',
        storeId: store.id,
        categoriaId: categories[0]?.id || '',
        nome: '',
        descricao: '',
        preco: 0,
        foto: '',
        ativo: true,
        ordem: products.length + 1,
        optionGroupIds: [],
      });
    }
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setSavingProduct(true);
    try {
      if (editingProduct.id) {
        await updateProductInFirestore(editingProduct.id, editingProduct);
        showToast('Produto atualizado no Firestore com sucesso!', 'success');
      } else {
        const { id, ...data } = editingProduct;
        await createProductInFirestore({
          ...data,
          storeId: store.id,
        });
        showToast('Produto cadastrado no Firestore com sucesso!', 'success');
      }
      setIsProductModalOpen(false);
    } catch (err: any) {
      console.error(err);
      showToast('Erro ao salvar produto no Firestore.', 'error');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este produto?')) {
      try {
        await deleteProductInFirestore(id);
        showToast('Produto excluído do Firestore.', 'info');
      } catch (err: any) {
        console.error(err);
        showToast('Erro ao excluir produto.', 'error');
      }
    }
  };

  const handleToggleProductStatus = async (prod: Product) => {
    try {
      await updateProductInFirestore(prod.id, { ativo: !prod.ativo });
      showToast(prod.ativo ? 'Produto pausado (esgotado).' : 'Produto ativado.', 'info');
    } catch (err: any) {
      console.error(err);
      showToast('Erro ao atualizar status do produto.', 'error');
    }
  };

  // --- Handlers de Categoria ---
  const handleOpenCategoryModal = (cat?: Category) => {
    if (cat) {
      setEditingCategory({ ...cat });
    } else {
      setEditingCategory({
        id: '',
        storeId: store.id,
        nome: '',
        ordem: categories.length + 1,
        ativa: true,
      });
    }
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    setSavingCategory(true);
    try {
      if (editingCategory.id) {
        await updateCategoryInFirestore(editingCategory.id, editingCategory);
        showToast('Categoria atualizada no Firestore!', 'success');
      } else {
        const { id, ...data } = editingCategory;
        await createCategoryInFirestore({
          ...data,
          storeId: store.id,
        });
        showToast('Categoria cadastrada no Firestore!', 'success');
      }
      setIsCategoryModalOpen(false);
    } catch (err: any) {
      console.error(err);
      showToast('Erro ao salvar categoria no Firestore.', 'error');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (window.confirm('Excluir esta categoria? Os produtos vinculados a ela não serão apagados.')) {
      try {
        await deleteCategoryInFirestore(id);
        showToast('Categoria excluída.', 'info');
      } catch (err: any) {
        console.error(err);
        showToast('Erro ao excluir categoria.', 'error');
      }
    }
  };

  // --- Handlers de Grupos de Complementos ---
  const handleOpenOptionGroupModal = (group?: OptionGroup) => {
    if (group) {
      setEditingOptionGroup(JSON.parse(JSON.stringify(group)));
    } else {
      setEditingOptionGroup({
        id: '',
        storeId: store.id,
        nome: '',
        obrigatorio: false,
        min: 0,
        max: 1,
        opcoes: [
          { id: 'opt_1', nome: 'Opção 1', preco: 0, ativo: true },
          { id: 'opt_2', nome: 'Opção 2', preco: 0, ativo: true },
        ],
      });
    }
    setIsOptionGroupModalOpen(true);
  };

  const handleSaveOptionGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOptionGroup) return;
    setSavingOptionGroup(true);
    try {
      if (editingOptionGroup.id) {
        await updateOptionGroupInFirestore(editingOptionGroup.id, editingOptionGroup);
        showToast('Grupo de complementos atualizado no Firestore!', 'success');
      } else {
        const { id, ...data } = editingOptionGroup;
        await createOptionGroupInFirestore({
          ...data,
          storeId: store.id,
        });
        showToast('Grupo de complementos cadastrado no Firestore!', 'success');
      }
      setIsOptionGroupModalOpen(false);
    } catch (err: any) {
      console.error(err);
      showToast('Erro ao salvar grupo de complementos.', 'error');
    } finally {
      setSavingOptionGroup(false);
    }
  };

  const handleDeleteOptionGroup = async (id: string) => {
    if (window.confirm('Excluir este grupo de complementos?')) {
      try {
        await deleteOptionGroupInFirestore(id);
        showToast('Grupo excluído.', 'info');
      } catch (err: any) {
        console.error(err);
        showToast('Erro ao excluir grupo.', 'error');
      }
    }
  };

  // Filtrar produtos
  const filteredProducts = products.filter((p) => {
    if (selectedCatFilter && p.categoriaId !== selectedCatFilter) return false;
    if (searchProd.trim()) {
      const q = searchProd.toLowerCase();
      return p.nome.toLowerCase().includes(q) || (p.descricao && p.descricao.toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-neutral-900">Gestão do Cardápio</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Gerencie itens, categorias e complementos adicionais sincronizados no Firestore
          </p>
        </div>

        {/* Abas */}
        <div className="flex bg-white p-1 rounded-xl border border-neutral-200 shadow-xs text-xs font-bold">
          <button
            onClick={() => setTab('produtos')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-colors cursor-pointer ${
              tab === 'produtos' ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>Produtos ({products.length})</span>
          </button>
          <button
            onClick={() => setTab('categorias')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-colors cursor-pointer ${
              tab === 'categorias' ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Categorias ({categories.length})</span>
          </button>
          <button
            onClick={() => setTab('complementos')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-colors cursor-pointer ${
              tab === 'complementos' ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Complementos ({optionGroups.length})</span>
          </button>
        </div>
      </div>

      {/* ABA 1: PRODUTOS */}
      {tab === 'produtos' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchProd}
                  onChange={(e) => setSearchProd(e.target.value)}
                  placeholder="Buscar produto por nome..."
                  className="w-full text-xs pl-9 pr-3 py-2 bg-neutral-100 rounded-xl focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
              </div>

              <select
                value={selectedCatFilter}
                onChange={(e) => setSelectedCatFilter(e.target.value)}
                className="text-xs p-2 bg-neutral-100 rounded-xl border-none font-medium focus:ring-1 focus:ring-neutral-900 cursor-pointer"
              >
                <option value="">Todas as Categorias</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => handleOpenProductModal()}
              className="px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Produto</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200 font-bold text-neutral-500 uppercase">
                  <th className="p-3 pl-4">Item</th>
                  <th className="p-3">Categoria</th>
                  <th className="p-3">Preço</th>
                  <th className="p-3">Complementos</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 pr-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-neutral-400">
                      Nenhum produto cadastrado nesta categoria.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => {
                    const cat = categories.find((c) => c.id === p.categoriaId);
                    return (
                      <tr key={p.id} className="hover:bg-neutral-50/80 transition-colors">
                        <td className="p-3 pl-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-neutral-100 overflow-hidden flex-shrink-0">
                              {p.foto ? (
                                <img
                                  src={p.foto}
                                  alt={p.nome}
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-neutral-300">
                                  <Utensils className="w-4 h-4" />
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-neutral-900 text-sm">{p.nome}</p>
                              {p.descricao && (
                                <p className="text-neutral-500 text-[11px] truncate max-w-xs">{p.descricao}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-3 font-medium text-neutral-600">{cat?.nome || 'Sem categoria'}</td>
                        <td className="p-3 font-bold text-neutral-900">{formatCurrency(p.preco)}</td>
                        <td className="p-3 text-neutral-500">
                          {p.optionGroupIds && p.optionGroupIds.length > 0
                            ? `${p.optionGroupIds.length} grupo(s)`
                            : 'Nenhum'}
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => handleToggleProductStatus(p)}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase transition-colors cursor-pointer ${
                              p.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-600'
                            }`}
                          >
                            {p.ativo ? 'Disponível' : 'Esgotado'}
                          </button>
                        </td>
                        <td className="p-3 pr-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenProductModal(p)}
                              className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-600 cursor-pointer"
                              title="Editar Produto"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(p.id)}
                              className="p-1.5 hover:bg-rose-50 rounded-lg text-neutral-400 hover:text-rose-600 cursor-pointer"
                              title="Excluir Produto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

      {/* ABA 2: CATEGORIAS */}
      {tab === 'categorias' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs">
            <p className="text-xs text-neutral-600">
              Categorias organizam o cardápio e facilitam a navegação do cliente.
            </p>
            <button
              onClick={() => handleOpenCategoryModal()}
              className="px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Categoria</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {categories.map((cat) => {
              const prodsCount = products.filter((p) => p.categoriaId === cat.id).length;
              return (
                <div
                  key={cat.id}
                  className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs flex items-center justify-between"
                >
                  <div>
                    <h3 className="font-bold text-sm text-neutral-900">{cat.nome}</h3>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {prodsCount} produtos • Ordem: {cat.ordem}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenCategoryModal(cat)}
                      className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-600 cursor-pointer"
                      title="Editar"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="p-1.5 hover:bg-rose-50 rounded-lg text-neutral-400 hover:text-rose-600 cursor-pointer"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ABA 3: GRUPOS DE COMPLEMENTOS */}
      {tab === 'complementos' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs">
            <p className="text-xs text-neutral-600">
              Crie adicionais (ex: Ponto da carne, Queijo extra, Borda recheada, Molhos, etc.) e vincule aos produtos.
            </p>
            <button
              onClick={() => handleOpenOptionGroupModal()}
              className="px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Grupo de Complementos</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {optionGroups.map((group) => (
              <div
                key={group.id}
                className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-neutral-900">{group.nome}</h3>
                      {group.obrigatorio && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-rose-100 text-rose-700">
                          Obrigatório
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Mín: {group.min} • Máx: {group.max}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenOptionGroupModal(group)}
                      className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-600 cursor-pointer"
                      title="Editar"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteOptionGroup(group.id)}
                      className="p-1.5 hover:bg-rose-50 rounded-lg text-neutral-400 hover:text-rose-600 cursor-pointer"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1 pt-2 border-t border-neutral-100 text-xs">
                  {group.opcoes.map((op) => (
                    <div key={op.id} className="flex justify-between text-neutral-700 py-1">
                      <span>• {op.nome}</span>
                      <span className="font-semibold text-neutral-900">
                        {op.preco > 0 ? `+${formatCurrency(op.preco)}` : 'Grátis'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: PRODUTO */}
      {isProductModalOpen && editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <form
            onSubmit={handleSaveProduct}
            className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center border-b border-neutral-100 pb-3">
              <h2 className="font-bold text-base text-neutral-900">
                {editingProduct.id ? 'Editar Produto' : 'Novo Produto'}
              </h2>
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-neutral-700 mb-1">Nome do Produto *</label>
                <input
                  type="text"
                  required
                  value={editingProduct.nome}
                  onChange={(e) => setEditingProduct({ ...editingProduct, nome: e.target.value })}
                  placeholder="Ex: X-Salada Artesanal"
                  className="w-full p-3 border border-neutral-200 rounded-xl focus:ring-1 focus:ring-neutral-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-neutral-700 mb-1">Categoria *</label>
                  <select
                    required
                    value={editingProduct.categoriaId}
                    onChange={(e) => setEditingProduct({ ...editingProduct, categoriaId: e.target.value })}
                    className="w-full p-3 border border-neutral-200 rounded-xl bg-white focus:ring-1 focus:ring-neutral-900 font-medium cursor-pointer"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-neutral-700 mb-1">Preço Base (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editingProduct.preco}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, preco: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full p-3 border border-neutral-200 rounded-xl focus:ring-1 focus:ring-neutral-900 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">Descrição</label>
                <textarea
                  rows={2}
                  value={editingProduct.descricao || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, descricao: e.target.value })}
                  placeholder="Ingredientes e detalhes para o cliente..."
                  className="w-full p-3 border border-neutral-200 rounded-xl focus:ring-1 focus:ring-neutral-900"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">URL da Foto</label>
                <input
                  type="url"
                  value={editingProduct.foto || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, foto: e.target.value })}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full p-3 border border-neutral-200 rounded-xl focus:ring-1 focus:ring-neutral-900"
                />
              </div>

              {/* Grupos de Complementos Associados */}
              <div className="pt-2">
                <label className="block font-bold text-neutral-700 mb-2">
                  Grupos de Complementos aplicáveis:
                </label>
                <div className="space-y-1.5 max-h-36 overflow-y-auto border border-neutral-200 rounded-xl p-3 bg-neutral-50">
                  {optionGroups.length === 0 ? (
                    <p className="text-neutral-400">Nenhum grupo cadastrado.</p>
                  ) : (
                    optionGroups.map((g) => {
                      const isChecked = editingProduct.optionGroupIds?.includes(g.id);
                      return (
                        <label key={g.id} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const cur = editingProduct.optionGroupIds || [];
                              if (e.target.checked) {
                                setEditingProduct({ ...editingProduct, optionGroupIds: [...cur, g.id] });
                              } else {
                                setEditingProduct({
                                  ...editingProduct,
                                  optionGroupIds: cur.filter((id) => id !== g.id),
                                });
                              }
                            }}
                            className="rounded border-neutral-300 text-neutral-900"
                          />
                          <span className="text-neutral-800 font-medium">
                            {g.nome} ({g.opcoes.length} opções)
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="px-4 py-2.5 text-xs font-bold text-neutral-600 hover:bg-neutral-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingProduct}
                className="px-5 py-2.5 text-xs font-bold bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {savingProduct && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{savingProduct ? 'Salvando no Firestore...' : 'Salvar Produto'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: CATEGORIA */}
      {isCategoryModalOpen && editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <form
            onSubmit={handleSaveCategory}
            className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl"
          >
            <div className="flex justify-between items-center border-b border-neutral-100 pb-3">
              <h2 className="font-bold text-base text-neutral-900">
                {editingCategory.id ? 'Editar Categoria' : 'Nova Categoria'}
              </h2>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-neutral-700 mb-1">Nome da Categoria *</label>
                <input
                  type="text"
                  required
                  value={editingCategory.nome}
                  onChange={(e) => setEditingCategory({ ...editingCategory, nome: e.target.value })}
                  placeholder="Ex: Lanches Especiais"
                  className="w-full p-3 border border-neutral-200 rounded-xl focus:ring-1 focus:ring-neutral-900"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">Ordem de Exibição</label>
                <input
                  type="number"
                  value={editingCategory.ordem}
                  onChange={(e) =>
                    setEditingCategory({ ...editingCategory, ordem: parseInt(e.target.value, 10) || 1 })
                  }
                  className="w-full p-3 border border-neutral-200 rounded-xl focus:ring-1 focus:ring-neutral-900"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingCategory}
                className="px-5 py-2 text-xs font-bold bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {savingCategory && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{savingCategory ? 'Salvando...' : 'Salvar Categoria'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: GRUPO DE COMPLEMENTOS */}
      {isOptionGroupModalOpen && editingOptionGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <form
            onSubmit={handleSaveOptionGroup}
            className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center border-b border-neutral-100 pb-3">
              <h2 className="font-bold text-base text-neutral-900">
                {editingOptionGroup.id ? 'Editar Grupo' : 'Novo Grupo de Complementos'}
              </h2>
              <button
                type="button"
                onClick={() => setIsOptionGroupModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-neutral-700 mb-1">Nome do Grupo *</label>
                <input
                  type="text"
                  required
                  value={editingOptionGroup.nome}
                  onChange={(e) => setEditingOptionGroup({ ...editingOptionGroup, nome: e.target.value })}
                  placeholder="Ex: Ponto da Carne, Escolha o Molho, Adicionais..."
                  className="w-full p-3 border border-neutral-200 rounded-xl focus:ring-1 focus:ring-neutral-900"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold text-neutral-700 mb-1">Obrigatório?</label>
                  <select
                    value={editingOptionGroup.obrigatorio ? 'sim' : 'nao'}
                    onChange={(e) =>
                      setEditingOptionGroup({
                        ...editingOptionGroup,
                        obrigatorio: e.target.value === 'sim',
                      })
                    }
                    className="w-full p-3 border border-neutral-200 rounded-xl bg-white font-medium cursor-pointer"
                  >
                    <option value="nao">Opcional</option>
                    <option value="sim">Sim (Obrigatório)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-neutral-700 mb-1">Mínimo</label>
                  <input
                    type="number"
                    min={0}
                    value={editingOptionGroup.min}
                    onChange={(e) =>
                      setEditingOptionGroup({
                        ...editingOptionGroup,
                        min: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="w-full p-3 border border-neutral-200 rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-neutral-700 mb-1">Máximo</label>
                  <input
                    type="number"
                    min={1}
                    value={editingOptionGroup.max}
                    onChange={(e) =>
                      setEditingOptionGroup({
                        ...editingOptionGroup,
                        max: parseInt(e.target.value, 10) || 1,
                      })
                    }
                    className="w-full p-3 border border-neutral-200 rounded-xl font-bold"
                  />
                </div>
              </div>

              {/* Opções Individuais */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="font-bold text-neutral-700">Opções Disponíveis:</label>
                  <button
                    type="button"
                    onClick={() => {
                      const newOpt: OptionItem = {
                        id: `opt_${Date.now()}`,
                        nome: '',
                        preco: 0,
                        ativo: true,
                      };
                      setEditingOptionGroup({
                        ...editingOptionGroup,
                        opcoes: [...editingOptionGroup.opcoes, newOpt],
                      });
                    }}
                    className="text-[11px] font-bold text-neutral-900 underline cursor-pointer"
                  >
                    + Adicionar Opção
                  </button>
                </div>

                <div className="space-y-2">
                  {editingOptionGroup.opcoes.map((op, idx) => (
                    <div key={op.id || idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        required
                        value={op.nome}
                        onChange={(e) => {
                          const updated = [...editingOptionGroup.opcoes];
                          updated[idx].nome = e.target.value;
                          setEditingOptionGroup({ ...editingOptionGroup, opcoes: updated });
                        }}
                        placeholder="Nome da opção (ex: Bacon Extra)"
                        className="flex-1 p-2 border border-neutral-200 rounded-lg text-xs"
                      />
                      <div className="flex items-center gap-1 w-28">
                        <span className="text-[11px] text-neutral-500">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={op.preco}
                          onChange={(e) => {
                            const updated = [...editingOptionGroup.opcoes];
                            updated[idx].preco = parseFloat(e.target.value) || 0;
                            setEditingOptionGroup({ ...editingOptionGroup, opcoes: updated });
                          }}
                          className="w-full p-2 border border-neutral-200 rounded-lg text-xs font-bold"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = editingOptionGroup.opcoes.filter((_, i) => i !== idx);
                          setEditingOptionGroup({ ...editingOptionGroup, opcoes: updated });
                        }}
                        className="p-1.5 text-neutral-400 hover:text-rose-600 rounded cursor-pointer"
                        title="Remover opção"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setIsOptionGroupModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingOptionGroup}
                className="px-5 py-2 text-xs font-bold bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {savingOptionGroup && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{savingOptionGroup ? 'Salvando...' : 'Salvar Grupo'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
