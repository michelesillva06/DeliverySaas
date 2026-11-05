import React from 'react';
import { formatCurrency } from '../lib/formatters';
import { Product } from '../types';

interface ProductRowProps {
  product: Product;
  onClick: () => void;
  primaryColor: string;
}

export const ProductRow: React.FC<ProductRowProps> = ({ product, onClick, primaryColor }) => {
  const price = product.precoPromocional && product.precoPromocional < product.preco ? product.precoPromocional : product.preco;
  const isPromo = product.precoPromocional && product.precoPromocional < product.preco;

  return (
    <div 
      onClick={onClick}
      className="flex items-center gap-4 py-4 px-4 border-b border-neutral-100 cursor-pointer hover:bg-neutral-50 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <h3 className="text-base font-semibold text-neutral-900 leading-tight">{product.nome}</h3>
        {product.descricao && (
          <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{product.descricao}</p>
        )}
        <div className="mt-2 flex items-center gap-2">
          <span className="text-base font-extrabold text-neutral-900" style={{ color: primaryColor }}>
            {formatCurrency(price)}
          </span>
          {isPromo && (
            <span className="text-xs font-bold text-neutral-400 line-through">
              {formatCurrency(product.preco)}
            </span>
          )}
        </div>
      </div>
      <div className="w-24 h-24 rounded-2xl overflow-hidden bg-neutral-200 flex-shrink-0 shadow-xs">
        <img src={product.foto || '/placeholder.png'} alt={product.nome} className="w-full h-full object-cover" />
      </div>
    </div>
  );
};
