import React from 'react';
import { ShoppingBag, ArrowRight } from 'lucide-react';
import { useCart } from '../services/cartContext';
import { formatCurrency } from '../lib/formatters';

interface CartFloatingBarProps {
  onClick: () => void;
  primaryColor?: string;
}

export const CartFloatingBar: React.FC<CartFloatingBarProps> = ({ onClick, primaryColor = '#EA1D2C' }) => {
  const { totalItemsCount, total } = useCart();

  if (totalItemsCount === 0) return null;

  return (
    <div className="fixed bottom-5 inset-x-4 max-w-xl mx-auto z-40 animate-in slide-in-from-bottom-5 duration-300">
      <button
        onClick={onClick}
        className="w-full min-h-[58px] py-4 px-5 rounded-2xl shadow-2xl text-white font-black flex items-center justify-between transition-transform active:scale-[0.98] border border-white/20"
        style={{ backgroundColor: primaryColor }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-black/25 flex items-center justify-center flex-shrink-0">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <span className="text-base sm:text-lg">
            Ver sacola ({totalItemsCount} {totalItemsCount === 1 ? 'item' : 'itens'})
          </span>
        </div>

        <div className="flex items-center gap-2 text-base sm:text-lg">
          <span className="tracking-tight">{formatCurrency(total)}</span>
          <ArrowRight className="w-5 h-5 stroke-[2.5]" />
        </div>
      </button>
    </div>
  );
};
