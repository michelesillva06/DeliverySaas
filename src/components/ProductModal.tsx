import React, { useState, useMemo } from 'react';
import { X, Plus, Minus, Check, AlertCircle } from 'lucide-react';
import { Product, OptionGroup, SelectedOption } from '../types';
import { formatCurrency } from '../lib/formatters';

interface ProductModalProps {
  product: Product | null;
  optionGroups: OptionGroup[];
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (
    product: Product,
    quantity: number,
    selectedOptions: SelectedOption[],
    obs: string,
    totalItem: number
  ) => void;
  primaryColor?: string;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  product,
  optionGroups,
  isOpen,
  onClose,
  onAddToCart,
  primaryColor = '#EA1D2C',
}) => {
  const [quantity, setQuantity] = useState(1);
  const [obs, setObs] = useState('');
  const [selections, setSelections] = useState<{ [groupId: string]: string[] }>({});

  // Reset state when a product opens
  React.useEffect(() => {
    if (product) {
      setQuantity(1);
      setObs('');
      const initialSel: { [groupId: string]: string[] } = {};
      // Se tiver grupos obrigatórios com min=1 e max=1, pode pré-selecionar a primeira opção ativa
      optionGroups.forEach((g) => {
        if (product.optionGroupIds?.includes(g.id)) {
          if (g.obrigatorio && g.min === 1 && g.max === 1 && g.opcoes.length > 0) {
            const firstActive = g.opcoes.find((o) => o.ativo);
            if (firstActive) {
              initialSel[g.id] = [firstActive.id];
            }
          } else {
            initialSel[g.id] = [];
          }
        }
      });
      setSelections(initialSel);
    }
  }, [product, optionGroups]);

  const activeGroups = useMemo(() => {
    if (!product || !product.optionGroupIds) return [];
    return optionGroups.filter((g) => product.optionGroupIds?.includes(g.id));
  }, [product, optionGroups]);

  // Validar se todos os grupos obrigatórios foram preenchidos
  const { isValid, errors } = useMemo(() => {
    const errs: string[] = [];
    activeGroups.forEach((g) => {
      const selectedCount = (selections[g.id] || []).length;
      if (g.obrigatorio && selectedCount < g.min) {
        errs.push(`Escolha ao menos ${g.min} opção em "${g.nome}".`);
      }
      if (selectedCount > g.max) {
        errs.push(`Máximo de ${g.max} opções em "${g.nome}".`);
      }
    });
    return { isValid: errs.length === 0, errors: errs };
  }, [activeGroups, selections]);

  // Calcular valor total do item
  const { unitPrice, totalPrice, flatSelectedOptions } = useMemo(() => {
    if (!product) return { unitPrice: 0, totalPrice: 0, flatSelectedOptions: [] };

    let optionsSum = 0;
    const flat: SelectedOption[] = [];

    activeGroups.forEach((g) => {
      const selIds = selections[g.id] || [];
      g.opcoes.forEach((op) => {
        if (selIds.includes(op.id)) {
          optionsSum += op.preco || 0;
          flat.push({
            grupoId: g.id,
            grupoNome: g.nome,
            opcaoId: op.id,
            nome: op.nome,
            preco: op.preco,
          });
        }
      });
    });

    const unit = product.preco + optionsSum;
    const total = unit * quantity;
    return { unitPrice: unit, totalPrice: total, flatSelectedOptions: flat };
  }, [product, activeGroups, selections, quantity]);

  if (!isOpen || !product) return null;

  const handleToggleOption = (group: OptionGroup, optionId: string) => {
    const current = selections[group.id] || [];
    const isSingle = group.max === 1;

    if (isSingle) {
      // Radio mode: substitui
      setSelections((prev) => ({ ...prev, [group.id]: [optionId] }));
    } else {
      // Checkbox mode: toggle respeitando max
      if (current.includes(optionId)) {
        setSelections((prev) => ({
          ...prev,
          [group.id]: current.filter((id) => id !== optionId),
        }));
      } else {
        if (current.length < group.max) {
          setSelections((prev) => ({
            ...prev,
            [group.id]: [...current, optionId],
          }));
        }
      }
    }
  };

  const handleConfirm = () => {
    if (!isValid) return;
    onAddToCart(product, quantity, flatSelectedOptions, obs, totalPrice);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white w-full sm:max-w-lg max-h-[90vh] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Imagem e Botão Fechar */}
        <div className="relative w-full h-48 sm:h-56 bg-neutral-100 flex-shrink-0">
          {product.foto ? (
            <img
              src={product.foto}
              alt={product.nome}
              className="w-full h-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center font-black text-5xl text-neutral-300 bg-neutral-100 select-none">
              {product.nome ? product.nome.charAt(0).toUpperCase() : '?'}
            </div>
          )}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors backdrop-blur-xs"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informações e Grupos de Complementos (Scroll) */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1 divide-y divide-neutral-100">
          {/* Título e Descrição */}
          <div>
            <h2 className="text-xl font-bold text-neutral-900 leading-tight">{product.nome}</h2>
            {product.descricao && (
              <p className="mt-1.5 text-sm text-neutral-600 leading-relaxed">{product.descricao}</p>
            )}
            <div className="mt-2 text-lg font-bold" style={{ color: primaryColor }}>
              {formatCurrency(product.preco)}
            </div>
          </div>

          {/* Grupos de Complementos */}
          {activeGroups.map((group) => {
            const currentSelected = selections[group.id] || [];
            const isSingle = group.max === 1;

            return (
              <div key={group.id} className="pt-4 first:pt-0">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
                      {group.nome}
                      {group.obrigatorio && (
                        <span className="text-[10px] uppercase font-extrabold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">
                          Obrigatório
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-neutral-500">
                      {isSingle
                        ? 'Escolha 1 opção'
                        : `Escolha de ${group.min} até ${group.max} opções (${currentSelected.length}/${group.max})`}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5 mt-2">
                  {group.opcoes
                    .filter((op) => op.ativo)
                    .map((opcao) => {
                      const isChecked = currentSelected.includes(opcao.id);
                      const isMaxReached = !isSingle && currentSelected.length >= group.max && !isChecked;

                      return (
                        <label
                          key={opcao.id}
                          onClick={() => !isMaxReached && handleToggleOption(group, opcao.id)}
                          className={`flex items-center justify-between p-3 rounded-xl border text-sm transition-all cursor-pointer ${
                            isChecked
                              ? 'border-neutral-900 bg-neutral-50 font-medium'
                              : isMaxReached
                              ? 'opacity-40 border-neutral-200 cursor-not-allowed'
                              : 'border-neutral-200 hover:border-neutral-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-5 h-5 flex items-center justify-center rounded-${
                                isSingle ? 'full' : 'md'
                              } border transition-colors ${
                                isChecked
                                  ? 'bg-neutral-900 border-neutral-900 text-white'
                                  : 'border-neutral-300'
                              }`}
                            >
                              {isChecked && <Check className="w-3.5 h-3.5" />}
                            </div>
                            <span>{opcao.nome}</span>
                          </div>
                          {opcao.preco > 0 && (
                            <span className="text-xs font-semibold text-neutral-600">
                              +{formatCurrency(opcao.preco)}
                            </span>
                          )}
                        </label>
                      );
                    })}
                </div>
              </div>
            );
          })}

          {/* Campo de Observações */}
          <div className="pt-4">
            <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
              Observações do item
            </label>
            <textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Ex: sem cebola, ponto da carne mais passado, talheres descartáveis..."
              maxLength={200}
              rows={2}
              className="w-full text-sm p-3 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none"
            />
          </div>
        </div>

        {/* Rodapé Fixo com Contador e Botão */}
        <div className="p-4 border-t border-neutral-100 bg-white flex flex-col gap-2">
          {!isValid && (
            <div className="flex items-center gap-1.5 text-xs text-rose-600 font-medium">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errors[0]}</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            {/* Contador de Quantidade */}
            <div className="flex items-center border border-neutral-200 rounded-xl p-1 bg-neutral-50">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white text-neutral-700 disabled:opacity-40 transition-colors"
                aria-label="Diminuir quantidade"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-8 text-center text-sm font-bold text-neutral-900">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white text-neutral-700 transition-colors"
                aria-label="Aumentar quantidade"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Botão Adicionar ao Carrinho */}
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!isValid}
              className="flex-1 py-3.5 px-4 rounded-xl font-bold text-sm text-white shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-between"
              style={{ backgroundColor: primaryColor }}
            >
              <span>Adicionar ao Pedido</span>
              <span>{formatCurrency(totalPrice)}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
