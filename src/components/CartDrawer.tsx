import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Trash2, Plus, Minus, ShoppingBag, Tag, ArrowRight, AlertTriangle } from 'lucide-react';
import { useCart } from '../services/cartContext';
import { formatCurrency } from '../lib/formatters';
import { Store } from '../types';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  store: Store;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ isOpen, onClose, store }) => {
  const navigate = useNavigate();
  const {
    items,
    updateQuantity,
    removeItem,
    subtotal,
    appliedCoupon,
    couponDiscount,
    applyCouponCode,
    removeCoupon,
    total,
    totalItemsCount,
  } = useCart();

  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState('');

  const [applyingCoupon, setApplyingCoupon] = useState(false);

  if (!isOpen) return null;

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;
    setApplyingCoupon(true);
    try {
      const res = await applyCouponCode(couponInput);
      if (res.success) {
        setCouponError('');
        setCouponInput('');
      } else {
        setCouponError(res.message);
      }
    } finally {
      setApplyingCoupon(false);
    }
  };

  const isBelowMin = subtotal < store.pedidoMinimo;

  const handleGoToCheckout = () => {
    if (items.length === 0 || isBelowMin) return;
    onClose();
    navigate(`/${store.slug}/checkout`);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho do Carrinho */}
        <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5" style={{ color: store.corPrimaria }} />
            <h2 className="font-bold text-lg text-neutral-900">Seu Pedido ({totalItemsCount})</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-500 hover:text-neutral-900 rounded-lg hover:bg-neutral-100 transition-colors"
            aria-label="Fechar carrinho"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lista de Itens */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 divide-y divide-neutral-100">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-neutral-500">
              <ShoppingBag className="w-16 h-16 text-neutral-300 mb-3" />
              <p className="font-bold text-neutral-800 text-lg">Sua sacola está vazia</p>
              <p className="text-sm text-neutral-500 mt-1 max-w-xs">
                Adicione itens deliciosos do cardápio para começar o seu pedido!
              </p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="pt-3 first:pt-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h4 className="font-bold text-sm text-neutral-900 leading-tight">{item.nome}</h4>
                    {item.complementos && item.complementos.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {item.complementos.map((c, i) => (
                          <p key={i} className="text-xs text-neutral-500">
                            + {c.nome} {c.preco > 0 && `(${formatCurrency(c.preco)})`}
                          </p>
                        ))}
                      </div>
                    )}
                    {item.obs && (
                      <p className="text-xs text-neutral-500 italic mt-1 bg-neutral-50 p-1.5 rounded-md">
                        "{item.obs}"
                      </p>
                    )}
                    <div className="mt-2 font-bold text-sm text-neutral-900">
                      {formatCurrency(item.totalItem)}
                    </div>
                  </div>

                  {/* Ações de Quantidade */}
                  <div className="flex items-center gap-1.5 border border-neutral-200 rounded-lg p-0.5 bg-neutral-50">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="w-7 h-7 flex items-center justify-center rounded hover:bg-white text-neutral-600 transition-colors"
                      aria-label="Diminuir"
                    >
                      {item.qtd === 1 ? <Trash2 className="w-3.5 h-3.5 text-rose-500" /> : <Minus className="w-3.5 h-3.5" />}
                    </button>
                    <span className="w-5 text-center text-xs font-bold text-neutral-800">{item.qtd}</span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="w-7 h-7 flex items-center justify-center rounded hover:bg-white text-neutral-600 transition-colors"
                      aria-label="Aumentar"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Rodapé com Cupom e Totais */}
        {items.length > 0 && (
          <div className="p-4 border-t border-neutral-200 bg-neutral-50 space-y-3">
            {/* Campo Cupom */}
            {appliedCoupon ? (
              <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-medium text-emerald-800">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-emerald-600" />
                  <span>
                    Cupom <strong>{appliedCoupon.codigo}</strong> (-{formatCurrency(couponDiscount)})
                  </span>
                </div>
                <button
                  onClick={removeCoupon}
                  className="text-emerald-700 hover:text-emerald-900 underline font-bold text-[11px]"
                >
                  Remover
                </button>
              </div>
            ) : (
              <form onSubmit={handleApplyCoupon} className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    placeholder="Possui cupom de desconto?"
                    className="w-full text-xs uppercase p-2.5 pl-8 border border-neutral-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  />
                  <Tag className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-3" />
                </div>
                <button
                  type="submit"
                  className="px-3 py-2 bg-neutral-900 text-white rounded-xl text-xs font-bold hover:bg-neutral-800 transition-colors"
                >
                  Aplicar
                </button>
              </form>
            )}

            {couponError && <p className="text-xs text-rose-600 font-medium">{couponError}</p>}

            {/* Aviso de Pedido Mínimo */}
            {isBelowMin && (
              <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-medium">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>
                  Pedido mínimo da loja é {formatCurrency(store.pedidoMinimo)}. Faltam{' '}
                  {formatCurrency(store.pedidoMinimo - subtotal)}.
                </span>
              </div>
            )}

            {/* Totais */}
            <div className="space-y-1.5 text-sm pt-2">
              <div className="flex justify-between text-neutral-600">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {couponDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Desconto</span>
                  <span>-{formatCurrency(couponDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-neutral-900 pt-1 border-t border-neutral-200">
                <span>Total (sem taxa de entrega)</span>
                <span style={{ color: store.corPrimaria }}>{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Botão Finalizar */}
            <button
              onClick={handleGoToCheckout}
              disabled={isBelowMin}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-sm text-white shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: store.corPrimaria }}
            >
              <span>Continuar para o Checkout</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
