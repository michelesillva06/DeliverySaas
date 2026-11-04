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
      className={`group relative bg-white border border-neutral-200/90 rounded-2xl p-4 sm:p-5 flex gap-4 transition-all hover:border-neutral-400 hover:shadow-md cursor-pointer ${
        isOutOfStock ? 'opacity-60 cursor-not-allowed hover:shadow-none' : ''
      }`}
    >
      {/* Informações do Produto */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <div className="flex items-start gap-2">
            <h3 className="font-bold text-lg sm:text-xl text-neutral-900 group-hover:text-neutral-700 transition-colors leading-snug">
              {product.nome}
            </h3>
            {isOutOfStock && (
              <span className="px-2.5 py-1 rounded-full text-xs font-black uppercase bg-neutral-200 text-neutral-700 flex-shrink-0">
                Esgotado
              </span>
            )}
          </div>
          {product.descricao && (
            <p className="text-sm text-neutral-600 mt-2 line-clamp-2 leading-relaxed font-normal">
              {product.descricao}
            </p>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex flex-col">
            {product.precoPromocional && product.precoPromocional < product.preco && (
              <span className="text-xs text-neutral-400 line-through">
                {formatCurrency(product.preco)}
              </span>
            )}
            <span
              className="font-black text-xl sm:text-2xl tracking-tight"
              style={{ color: primaryColor }}
            >
              {formatCurrency(product.precoPromocional || product.preco)}
            </span>
          </div>

          {!isOutOfStock && (
            <span
              className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-2xl flex items-center justify-center text-white shadow-sm group-hover:scale-105 active:scale-95 transition-transform"
              style={{ backgroundColor: primaryColor }}
              aria-label={`Adicionar ${product.nome}`}
            >
              <Plus className="w-6 h-6 stroke-[2.5]" />
            </span>
          )}
        </div>
      </div>

      {/* Foto do Produto */}
      <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden bg-neutral-100 flex-shrink-0 relative border border-neutral-200/80 shadow-2xs">
        {product.foto ? (
          <img
            src={product.foto}
            alt={product.nome}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center font-black text-3xl text-neutral-300 bg-neutral-100 select-none">
            {product.nome ? product.nome.charAt(0).toUpperCase() : '?'}
          </div>
        )}
      </div>
    </div>
  );
};
