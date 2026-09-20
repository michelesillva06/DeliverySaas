import React from 'react';
import { Plus } from 'lucide-react';
import { Product } from '../types';
import { formatCurrency } from '../lib/formatters';

interface ProductCardProps {
  product: Product;
  onClick: () => void;
  primaryColor?: string;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onClick, primaryColor = '#EA1D2C' }) => {
  const isOutOfStock = !product.ativo;

  return (
    <div
      onClick={() => !isOutOfStock && onClick()}
      className={`group relative bg-white border border-neutral-200/80 rounded-2xl p-3.5 sm:p-4 flex gap-3.5 sm:gap-4 transition-all hover:border-neutral-300 hover:shadow-md cursor-pointer ${
        isOutOfStock ? 'opacity-60 cursor-not-allowed hover:shadow-none' : ''
      }`}
    >
      {/* Informações do Produto */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm sm:text-base text-neutral-900 group-hover:text-neutral-700 transition-colors leading-snug">
              {product.nome}
            </h3>
            {isOutOfStock && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-neutral-200 text-neutral-700 flex-shrink-0">
                Esgotado
              </span>
            )}
          </div>
          {product.descricao && (
            <p className="text-xs text-neutral-500 mt-1 line-clamp-2 leading-relaxed">
              {product.descricao}
            </p>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span className="font-extrabold text-sm sm:text-base" style={{ color: primaryColor }}>
            {formatCurrency(product.preco)}
          </span>

          {!isOutOfStock && (
            <span
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform"
              style={{ backgroundColor: primaryColor }}
              aria-label="Adicionar item"
            >
              <Plus className="w-4 h-4" />
            </span>
          )}
        </div>
      </div>

      {/* Foto do Produto */}
      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-neutral-100 flex-shrink-0 relative border border-neutral-100/80 shadow-2xs">
        {product.foto ? (
          <img
            src={product.foto}
            alt={product.nome}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center font-black text-xl sm:text-2xl text-neutral-400 bg-neutral-100 select-none">
            {product.nome ? product.nome.charAt(0).toUpperCase() : '?'}
          </div>
        )}
      </div>
    </div>
  );
};
