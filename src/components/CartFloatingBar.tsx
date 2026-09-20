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
    <div className="fixed bottom-4 inset-x-4 max-w-lg mx-auto z-40 animate-in slide-in-from-bottom-5 duration-300">
      <button
        onClick={onClick}
        className="w-full py-3.5 px-4 rounded-2xl shadow-xl text-white font-bold flex items-center justify-between transition-transform active:scale-[0.98]"
        style={{ backgroundColor: primaryColor }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-black/20 flex items-center justify-center">
            <ShoppingBag className="w-4 h-4" />
          </div>
          <span className="text-sm">
            Ver sacola ({totalItemsCount} {totalItemsCount === 1 ? 'item' : 'itens'})
          </span>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span>{formatCurrency(total)}</span>
          <ArrowRight className="w-4 h-4" />
        </div>
      </button>
    </div>
  );
};
