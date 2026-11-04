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
      const min = typeof g.min === 'number' ? g.min : 0;
      const max = typeof g.max === 'number' && g.max > 0 ? g.max : 1;
      const isObrigatorio = g.obrigatorio || min > 0;
      const requiredMin = isObrigatorio ? Math.max(1, min) : 0;

      if (selectedCount < requiredMin) {
        if (requiredMin === 1 && max === 1) {
          errs.push(`Por favor, escolha 1 opção no grupo "${g.nome}".`);
        } else {
          errs.push(`Por favor, escolha ao menos ${requiredMin} opção(ões) no grupo "${g.nome}".`);
        }
      } else if (selectedCount > max) {
        errs.push(`Você pode escolher no máximo ${max} opção(ões) no grupo "${g.nome}".`);
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

    const base = product.precoPromocional && product.precoPromocional < product.preco ? product.precoPromocional : product.preco;
    const unit = base + optionsSum;
    const total = unit * quantity;
    return { unitPrice: unit, totalPrice: total, flatSelectedOptions: flat };
  }, [product, activeGroups, selections, quantity]);

  if (!isOpen || !product) return null;

  const handleToggleOption = (group: OptionGroup, optionId: string) => {
    const current = selections[group.id] || [];
    const isSingle = group.max === 1;

    if (isSingle) {
      setSelections((prev) => ({ ...prev, [group.id]: [optionId] }));
    } else {
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white w-full sm:max-w-xl max-h-[92vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Imagem e Botão Fechar */}
        <div className="relative w-full h-52 sm:h-64 bg-neutral-100 flex-shrink-0">
          {product.foto ? (
            <img
              src={product.foto}
              alt={product.nome}
              className="w-full h-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center font-black text-6xl text-neutral-300 bg-neutral-100 select-none">
              {product.nome ? product.nome.charAt(0).toUpperCase() : '?'}
            </div>
          )}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-11 h-11 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center transition-colors shadow-md backdrop-blur-xs"
            aria-label="Fechar modal"
          >
            <X className="w-6 h-6 stroke-[2.5]" />
          </button>
        </div>

        {/* Informações e Grupos de Complementos (Scroll) */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 divide-y divide-neutral-100">
          {/* Título, Descrição e Preço */}
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-neutral-900 leading-tight">
              {product.nome}
            </h2>
            {product.descricao && (
              <p className="mt-2 text-base text-neutral-600 leading-relaxed font-normal">
                {product.descricao}
              </p>
            )}
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: primaryColor }}>
                {formatCurrency(product.precoPromocional || product.preco)}
              </span>
              {product.precoPromocional && product.precoPromocional < product.preco && (
                <span className="text-base text-neutral-400 line-through">
                  {formatCurrency(product.preco)}
                </span>
              )}
            </div>
          </div>

          {/* Grupos de Complementos */}
          {activeGroups.map((group) => {
            const currentSelected = selections[group.id] || [];
            const isSingle = group.max === 1;
            const min = typeof group.min === 'number' ? group.min : 0;
            const max = typeof group.max === 'number' && group.max > 0 ? group.max : 1;
            const isObrigatorio = group.obrigatorio || min > 0;

            let ruleLabelText = '';
            if (!isObrigatorio) {
              if (max === 1) ruleLabelText = 'Opcional • Escolha até 1 opção';
              else ruleLabelText = `Opcional • Escolha até ${max} opções (${currentSelected.length}/${max})`;
            } else {
              if (min === 1 && max === 1) ruleLabelText = 'Obrigatório • Escolha 1 opção';
              else if (min === max && max > 1) ruleLabelText = `Obrigatório • Escolha exatamente ${max} opções (${currentSelected.length}/${max})`;
              else {
                const requiredMin = min > 0 ? min : 1;
                ruleLabelText = `Obrigatório • Escolha de ${requiredMin} até ${max} opções (${currentSelected.length}/${max})`;
              }
            }

            return (
              <div key={group.id} className="pt-5 first:pt-0">
                <div className="mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-black text-neutral-900">
                      {group.nome}
                    </h3>
                    {isObrigatorio && (
                      <span className="text-xs uppercase font-black bg-rose-100 text-rose-800 px-2 py-0.5 rounded-md">
                        Obrigatório
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-neutral-500 mt-0.5">
                    {ruleLabelText}
                  </p>
                </div>

                <div className="space-y-2 mt-2">
                  {group.opcoes
                    .filter((op) => op.ativo)
                    .map((opcao) => {
                      const isChecked = currentSelected.includes(opcao.id);
                      const isMaxReached = !isSingle && currentSelected.length >= group.max && !isChecked;

                      return (
                        <div
                          key={opcao.id}
                          onClick={() => !isMaxReached && handleToggleOption(group, opcao.id)}
                          className={`flex items-center justify-between p-4 rounded-2xl border min-h-[54px] text-base transition-all cursor-pointer select-none ${
                            isChecked
                              ? 'border-neutral-900 bg-neutral-50 font-bold shadow-2xs'
                              : isMaxReached
                              ? 'opacity-40 border-neutral-200 cursor-not-allowed bg-neutral-50/50'
                              : 'border-neutral-200 hover:border-neutral-400 bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div
                              className={`w-6 h-6 flex items-center justify-center rounded-${
                                isSingle ? 'full' : 'lg'
                              } border-2 transition-colors flex-shrink-0 ${
                                isChecked
                                  ? 'bg-neutral-900 border-neutral-900 text-white'
                                  : 'border-neutral-300 bg-white'
                              }`}
                            >
                              {isChecked && <Check className="w-4 h-4 stroke-[3]" />}
                            </div>
                            <span className="text-neutral-900 break-words">{opcao.nome}</span>
                          </div>
                          {opcao.preco > 0 && (
                            <span className="text-base font-extrabold text-neutral-800 flex-shrink-0 ml-3">
                              +{formatCurrency(opcao.preco)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            );
          })}

          {/* Campo de Observações */}
          <div className="pt-5">
            <label className="block text-sm font-black text-neutral-800 uppercase tracking-wider mb-2">
              Alguma observação para este item?
            </label>
            <textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Ex: sem cebola, ponto da carne bem passado, talheres descartáveis..."
              maxLength={200}
              rows={2}
              className="w-full text-base p-4 border border-neutral-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none text-neutral-900"
            />
          </div>
        </div>

        {/* Rodapé Fixo com Contador e Botão */}
        <div className="p-4 sm:p-5 border-t border-neutral-200 bg-white flex flex-col gap-3">
          {!isValid && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-800 font-semibold">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
              <span>{errors[0]}</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            {/* Contador de Quantidade (min 48px touch targets) */}
            <div className="flex items-center border-2 border-neutral-200 rounded-2xl p-1 bg-neutral-50">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="w-12 h-12 flex items-center justify-center rounded-xl hover:bg-white text-neutral-800 disabled:opacity-30 transition-colors"
                aria-label="Diminuir quantidade"
              >
                <Minus className="w-5 h-5 stroke-[2.5]" />
              </button>
              <span className="w-10 text-center text-lg font-black text-neutral-900">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                className="w-12 h-12 flex items-center justify-center rounded-xl hover:bg-white text-neutral-800 transition-colors"
                aria-label="Aumentar quantidade"
              >
                <Plus className="w-5 h-5 stroke-[2.5]" />
              </button>
            </div>

            {/* Botão Adicionar ao Pedido */}
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!isValid}
              className="flex-1 min-h-[54px] py-4 px-5 rounded-2xl font-black text-base sm:text-lg text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-between"
              style={{ backgroundColor: primaryColor }}
            >
              <span>Adicionar ao Pedido</span>
              <span className="tracking-tight">{formatCurrency(totalPrice)}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
