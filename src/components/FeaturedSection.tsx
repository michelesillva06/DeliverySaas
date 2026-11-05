import React from 'react';
import { formatCurrency } from '../lib/formatters';
import { Product } from '../types';

interface FeaturedSectionProps {
  products: Product[];
  onClick: (product: Product) => void;
  primaryColor: string;
}

export const FeaturedSection: React.FC<FeaturedSectionProps> = ({ products, onClick, primaryColor }) => {
  const featured = products.filter(p => p.destaque && p.disponivel !== false && p.ativo !== false);
  if (featured.length === 0) return null;

  return (
    <section className="py-6 px-4">
      <h2 className="text-xl font-black text-neutral-900 mb-4 tracking-tight">Destaques</h2>
      <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
        {featured.map((prod) => (
          <div
            key={prod.id}
            onClick={() => onClick(prod)}
            className="flex-shrink-0 w-40 cursor-pointer group"
          >
            <div className="w-40 h-40 rounded-3xl overflow-hidden bg-neutral-200 shadow-md">
              <img src={prod.foto || '/placeholder.png'} alt={prod.nome} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
            </div>
            <div className="mt-2 text-left">
              <p className="text-sm font-extrabold text-neutral-900" style={{ color: primaryColor }}>
                {formatCurrency(prod.precoPromocional || prod.preco)}
              </p>
              <p className="text-xs font-bold text-neutral-800 line-clamp-2 mt-0.5">{prod.nome}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
