import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Search, Utensils, ArrowLeft, MessageCircle } from 'lucide-react';
import { SUPPORT_WHATSAPP, SUPPORT_MESSAGE_HELP, getWhatsAppSupportLink } from '../../lib/constants';
import {
  getStoreBySlugFromFirestore,
  subscribeToStoreBySlug,
  subscribeToCategoriesByStore,
  subscribeToProductsByStore,
  subscribeToOptionGroupsByStore,
  ensureAnonymousCustomerAuth,
} from '../../services/firestoreService';
import { Store, Category, Product, OptionGroup } from '../../types';
import { CustomerHeader } from '../../components/CustomerHeader';
import { ProductCard } from '../../components/ProductCard';
import { ProductModal } from '../../components/ProductModal';
import { CartDrawer } from '../../components/CartDrawer';
import { CartFloatingBar } from '../../components/CartFloatingBar';
import { CartProvider, useCart } from '../../services/cartContext';
import { useToast } from '../../components/Toast';

export const StorefrontWrapper: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Iniciar autenticação anônima automaticamente ao abrir a loja
    ensureAnonymousCustomerAuth().catch(console.warn);

    if (!slug) return;

    // Buscar inicial do Firestore
    getStoreBySlugFromFirestore(slug).then((st) => {
      setStore(st);
      setLoading(false);
    });

    const unsub = subscribeToStoreBySlug(slug, (updated) => {
      if (updated) {
        setStore(updated);
      }
    });

    return () => unsub();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-900 text-neutral-400 text-xs font-bold">
        Carregando cardápio...
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-neutral-950 text-white">
        <div className="w-16 h-16 rounded-3xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-500 mb-4">
          <Utensils className="w-8 h-8" />
        </div>
        <h1 className="text-xl sm:text-2xl font-black text-white">Estabelecimento não encontrado</h1>
        <p className="text-xs sm:text-sm text-neutral-400 mt-2 max-w-sm">
          O link que você acessou não corresponde a nenhuma loja cadastrada.
        </p>
        <Link
          to="/"
          className="mt-6 px-5 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Ir para a Página Inicial</span>
        </Link>
      </div>
    );
  }

  if (store.status !== 'ativa') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-neutral-950 text-white">
        <div className="w-16 h-16 rounded-3xl bg-rose-950/50 border border-rose-800/60 flex items-center justify-center text-rose-400 mb-4">
          <Utensils className="w-8 h-8" />
        </div>
        <h1 className="text-xl sm:text-2xl font-black text-white">Loja indisponível no momento</h1>
        <p className="text-xs sm:text-sm text-neutral-400 mt-2 max-w-sm">
          Este estabelecimento não está aceitando pedidos no momento. Por favor, tente novamente mais tarde.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a
            href={getWhatsAppSupportLink(SUPPORT_WHATSAPP, 'Olá! Tentei acessar uma loja indisponível na plataforma Pede AI.')}
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Falar com o suporte</span>
          </a>
          <Link
            to="/"
            className="px-5 py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Página Inicial</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <CartProvider storeId={store.id} storeSlug={store.slug}>
      <StorefrontContent store={store} />
    </CartProvider>
  );
};

const StorefrontContent: React.FC<{ store: Store }> = ({ store }) => {
  const { showToast } = useToast();
  const { addItem } = useCart();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [optionGroups, setOptionGroups] = useState<OptionGroup[]>([]);

  const [activeCategory, setActiveCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);

  // Assinar atualizações em tempo real do cardápio exclusivamente via Firestore
  useEffect(() => {
    const unsubCat = subscribeToCategoriesByStore(store.id, (cats) => {
      setCategories(cats);
    });
    const unsubProd = subscribeToProductsByStore(store.id, (prods) => {
      setProducts(prods);
    });
    const unsubOpt = subscribeToOptionGroupsByStore(store.id, (opts) => {
      setOptionGroups(opts);
    });

    return () => {
      unsubCat();
      unsubProd();
      unsubOpt();
    };
  }, [store.id]);

  useEffect(() => {
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0].id);
    }
  }, [categories, activeCategory]);

  // Filtragem de busca e produtos disponíveis
  const filteredProducts = useMemo(() => {
    let list = products.filter((p) => (p.disponivel !== false && p.ativo !== false));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) => p.nome.toLowerCase().includes(q) || (p.descricao && p.descricao.toLowerCase().includes(q))
      );
    }
    return list;
  }, [products, searchQuery]);

  const activeCategoriesWithProducts = useMemo(() => {
    const activeCats = categories.filter((c) => c.ativa !== false);
    if (searchQuery.trim()) {
      return activeCats.filter((c) =>
        filteredProducts.some((p) => p.categoriaId === c.id || p.categoryId === c.id)
      );
    }
    return activeCats;
  }, [categories, filteredProducts, searchQuery]);

  return (
    <div className="min-h-screen bg-neutral-100 flex flex-col pb-24 selection:bg-rose-500 selection:text-white">
      {/* Cabeçalho da Loja com Capa e Logo */}
      <CustomerHeader store={store} />

      {/* Barra de Busca e Navegação por Categorias */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-neutral-200 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 py-2.5 space-y-2.5">
          {/* Busca */}
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar no cardápio..."
              className="w-full text-xs pl-10 pr-4 py-2.5 bg-neutral-100 border border-neutral-200 rounded-xl focus:outline-none focus:border-neutral-900 transition-colors"
            />
          </div>

          {/* Abas de Categorias */}
          {activeCategoriesWithProducts.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
              {activeCategoriesWithProducts.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveCategory(cat.id);
                    const el = document.getElementById(`cat_${cat.id}`);
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    activeCategory === cat.id
                      ? 'bg-neutral-900 text-white shadow-xs'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  {cat.nome}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Conteúdo do Cardápio */}
      <main className="max-w-4xl mx-auto px-4 py-6 w-full space-y-8 flex-1">
        {products.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-neutral-200 shadow-xs space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-400 mx-auto">
              <Utensils className="w-7 h-7" />
            </div>
            <h2 className="text-base font-bold text-neutral-800">Cardápio em preparação</h2>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
              O estabelecimento está cadastrando seus itens. Volte em alguns instantes para conferir as delícias!
            </p>
          </div>
        ) : activeCategoriesWithProducts.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-neutral-200 text-neutral-500 text-xs">
            Nenhum item encontrado para "{searchQuery}".
          </div>
        ) : (
          activeCategoriesWithProducts.map((cat) => {
            const catProducts = filteredProducts.filter(
              (p) => p.categoriaId === cat.id || p.categoryId === cat.id
            );
            if (catProducts.length === 0) return null;

            return (
              <section key={cat.id} id={`cat_${cat.id}`} className="space-y-3 scroll-mt-28">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-black text-neutral-900 uppercase tracking-wide">
                    {cat.nome}
                  </h2>
                  <div className="flex-1 h-px bg-neutral-200" />
                  <span className="text-[11px] font-bold text-neutral-400">{catProducts.length} itens</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {catProducts.map((prod) => (
                    <ProductCard
                      key={prod.id}
                      product={prod}
                      onClick={() => setSelectedProduct(prod)}
                      primaryColor={store.corPrimaria}
                    />
                  ))}
                </div>
              </section>
            );
          })
        )}
      </main>

      {/* Barra Flutuante do Carrinho */}
      <CartFloatingBar onClick={() => setCartDrawerOpen(true)} primaryColor={store.corPrimaria} />

      {/* Drawer Lateral do Carrinho */}
      <CartDrawer
        isOpen={cartDrawerOpen}
        onClose={() => setCartDrawerOpen(false)}
        store={store}
      />

      {/* Modal de Detalhes / Customização do Produto */}
      {selectedProduct && (
        <ProductModal
          isOpen={!!selectedProduct}
          product={selectedProduct}
          primaryColor={store.corPrimaria}
          optionGroups={optionGroups.filter((og) => selectedProduct.optionGroupIds?.includes(og.id))}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={(prod, quantity, selectedOptions, obs, totalItem) => {
            addItem({
              produtoId: prod.id,
              nome: prod.nome,
              qtd: quantity,
              precoUnit: prod.precoPromocional || prod.preco,
              complementos: selectedOptions,
              obs,
              totalItem,
            });
            setSelectedProduct(null);
            showToast('Item adicionado à sacola!', 'success');
          }}
        />
      )}
    </div>
  );
};
