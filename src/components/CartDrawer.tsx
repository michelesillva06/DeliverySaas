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
    subtotal,
    appliedCoupon,
    couponDiscount,
    applyCouponCode,
    removeCoupon,
    serviceFee,
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
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho do Carrinho */}
        <div className="p-5 border-b border-neutral-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
              style={{ backgroundColor: store.corPrimaria }}
            >
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-xl text-neutral-900">Sua Sacola</h2>
              <p className="text-xs font-bold text-neutral-500">
                {totalItemsCount} {totalItemsCount === 1 ? 'item selecionado' : 'itens selecionados'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center text-neutral-500 hover:text-neutral-900 rounded-xl hover:bg-neutral-100 transition-colors"
            aria-label="Fechar sacola"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Lista de Itens */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 divide-y divide-neutral-100">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-neutral-500">
              <ShoppingBag className="w-20 h-20 text-neutral-300 mb-4" />
              <p className="font-black text-neutral-900 text-2xl">Sua sacola está vazia</p>
              <p className="text-base text-neutral-500 mt-2 max-w-xs font-normal">
                Adicione itens saborosos do cardápio para começar o seu pedido!
              </p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="pt-4 first:pt-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h4 className="font-bold text-base text-neutral-900 leading-snug">{item.nome}</h4>
                    {item.complementos && item.complementos.length > 0 && (
                      <div className="mt-1.5 space-y-1">
                        {item.complementos.map((c, i) => (
                          <p key={i} className="text-sm text-neutral-600 font-medium">
                            + {c.nome} {c.preco > 0 && `(${formatCurrency(c.preco)})`}
                          </p>
                        ))}
                      </div>
                    )}
                    {item.obs && (
                      <p className="text-sm text-neutral-700 italic mt-1.5 bg-neutral-100 p-2 rounded-xl">
                        "{item.obs}"
                      </p>
                    )}
                    <div className="mt-2 font-black text-base text-neutral-900">
                      {formatCurrency(item.totalItem)}
                    </div>
                  </div>

                  {/* Ações de Quantidade */}
                  <div className="flex items-center gap-1 border-2 border-neutral-200 rounded-xl p-1 bg-neutral-50">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white text-neutral-700 transition-colors"
                      aria-label="Diminuir"
                    >
                      {item.qtd === 1 ? <Trash2 className="w-4 h-4 text-rose-600" /> : <Minus className="w-4 h-4" />}
                    </button>
                    <span className="w-7 text-center text-sm font-black text-neutral-900">{item.qtd}</span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white text-neutral-700 transition-colors"
                      aria-label="Aumentar"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Rodapé com Cupom e Totais */}
        {items.length > 0 && (
          <div className="p-5 border-t border-neutral-200 bg-neutral-50 space-y-4">
            {/* Campo Cupom */}
            {appliedCoupon ? (
              <div className="flex items-center justify-between p-3.5 bg-emerald-50 border border-emerald-300 rounded-2xl text-sm font-medium text-emerald-900">
                <div className="flex items-center gap-2.5">
                  <Tag className="w-5 h-5 text-emerald-700" />
                  <span>
                    Cupom <strong>{appliedCoupon.codigo}</strong> (-{formatCurrency(couponDiscount)})
                  </span>
                </div>
                <button
                  onClick={removeCoupon}
                  className="text-emerald-800 hover:text-emerald-950 underline font-bold text-xs"
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
                    placeholder="Cupom de desconto"
                    className="w-full text-base uppercase p-3 pl-10 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-white"
                  />
                  <Tag className="w-4 h-4 text-neutral-400 absolute left-3.5 top-4" />
                </div>
                <button
                  type="submit"
                  disabled={applyingCoupon}
                  className="px-4 py-3 bg-neutral-900 text-white rounded-xl text-sm font-bold hover:bg-neutral-800 transition-colors min-h-[48px]"
                >
                  {applyingCoupon ? '...' : 'Aplicar'}
                </button>
              </form>
            )}

            {couponError && <p className="text-sm text-rose-600 font-bold">{couponError}</p>}

            {/* Aviso de Pedido Mínimo */}
            {isBelowMin && (
              <div className="flex items-center gap-2.5 p-3.5 bg-amber-50 border border-amber-300 rounded-2xl text-sm text-amber-950 font-medium">
                <AlertTriangle className="w-5 h-5 text-amber-700 flex-shrink-0" />
                <span>
                  Pedido mínimo da loja é {formatCurrency(store.pedidoMinimo)}. Faltam{' '}
                  <strong>{formatCurrency(store.pedidoMinimo - subtotal)}</strong>.
                </span>
              </div>
            )}

            {/* Totais */}
            <div className="space-y-2 text-base pt-1">
              <div className="flex justify-between text-neutral-600">
                <span>Subtotal dos produtos</span>
                <span className="font-semibold">{formatCurrency(subtotal)}</span>
              </div>
              {couponDiscount > 0 && (
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>Desconto aplicado</span>
                  <span>-{formatCurrency(couponDiscount)}</span>
                </div>
              )}
              {serviceFee > 0 && (
                <div className="space-y-0.5">
                  <div className="flex justify-between text-neutral-700 font-medium">
                    <span>Taxa de serviço da plataforma</span>
                    <span className="font-bold">{formatCurrency(serviceFee)}</span>
                  </div>
                  <p className="text-xs text-neutral-500 italic">
                    Valor destinado ao uso e à manutenção da plataforma de pedidos.
                  </p>
                </div>
              )}
              <div className="flex justify-between text-xl font-black text-neutral-900 pt-2 border-t border-neutral-200">
                <span>Total estimado</span>
                <span style={{ color: store.corPrimaria }}>{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Botão Finalizar */}
            <button
              onClick={handleGoToCheckout}
              disabled={isBelowMin}
              className="w-full min-h-[54px] py-4 px-5 rounded-2xl font-black text-base sm:text-lg text-white shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: store.corPrimaria }}
            >
              <span>Continuar para o Checkout</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
