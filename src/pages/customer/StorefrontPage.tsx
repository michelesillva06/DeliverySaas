import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Search, Utensils, ArrowLeft, MessageCircle } from 'lucide-react';
import { SUPPORT_WHATSAPP, getWhatsAppSupportLink } from '../../lib/constants';
import { isStoreOpen, generateWhatsAppUrl } from '../../lib/formatters';
import {
  getStoreBySlugFromFirestore,
  subscribeToStoreBySlug,
  subscribeToCategoriesByStore,
  subscribeToProductsByStore,
  subscribeToOptionGroupsByStore,
  ensureAnonymousCustomerAuth,
} from '../../services/firestoreService';
import { Store, Category, Product, OptionGroup } from '../../types';
import { StoreHeader } from '../../components/StoreHeader';
import { FeaturedSection } from '../../components/FeaturedSection';
import { ProductRow } from '../../components/ProductRow';
import { ProductModal } from '../../components/ProductModal';
import { CartDrawer } from '../../components/CartDrawer';
import { CartFloatingBar } from '../../components/CartFloatingBar';
import { CartProvider, useCart } from '../../services/cartContext';
import { useToast } from '../../components/Toast';
import { trackStorefrontEvent } from '../../services/analyticsService';

export const StorefrontWrapper: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Iniciar sessão de cliente automaticamente de forma resiliente
    ensureAnonymousCustomerAuth().catch(console.warn);

    if (!slug) return;

    // Buscar dados do estabelecimento
    getStoreBySlugFromFirestore(slug).then((st) => {
      setStore(st);
      setLoading(false);
      if (st) {
        trackStorefrontEvent(st.id, st.slug, 'visita');
      }
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
      <div className="min-h-screen flex items-center justify-center bg-white text-neutral-600 text-base font-bold">
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
        <h1 className="text-2xl sm:text-3xl font-black text-white">Loja não encontrada</h1>
        <p className="text-base text-neutral-400 mt-2 max-w-sm">
          O link acessado não corresponde a nenhuma loja cadastrada na plataforma.
        </p>
        <Link
          to="/"
          className="mt-6 px-6 py-3.5 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-base font-bold flex items-center gap-2 transition-colors min-h-[48px]"
        >
          <ArrowLeft className="w-5 h-5" />
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
        <h1 className="text-2xl sm:text-3xl font-black text-white">Loja indisponível no momento</h1>
        <p className="text-base text-neutral-400 mt-2 max-w-sm">
          Este estabelecimento não está aceitando pedidos no momento. Por favor, tente novamente mais tarde.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a
            href={getWhatsAppSupportLink(SUPPORT_WHATSAPP, 'Olá! Tentei acessar uma loja indisponível na plataforma.')}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3.5 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-base font-bold flex items-center gap-2 transition-colors min-h-[48px]"
          >
            <MessageCircle className="w-5 h-5" />
            <span>Falar com o suporte</span>
          </a>
          <Link
            to="/"
            className="px-6 py-3.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-2xl text-base font-bold flex items-center gap-2 transition-colors min-h-[48px]"
          >
            <ArrowLeft className="w-5 h-5" />
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
  const { addItem } = useCart();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [optionGroups, setOptionGroups] = useState<OptionGroup[]>([]);

  const [activeCategory, setActiveCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const openStatus = useMemo(() => isStoreOpen(store), [store]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 200);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    document.title = `${store.nome} | Cardápio Digital`;

    let manifestMeta = document.querySelector('link[rel="manifest"]');
    if (!manifestMeta) {
      manifestMeta = document.createElement('link');
      manifestMeta.setAttribute('rel', 'manifest');
      document.head.appendChild(manifestMeta);
    }

    const manifest = {
      name: store.nome,
      short_name: store.nome.slice(0, 12),
      icons: [{ src: store.logo || '/logo.png', sizes: '192x192', type: 'image/png' }],
      start_url: window.location.pathname,
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: store.corPrimaria || '#e11d48',
    };

    const stringManifest = JSON.stringify(manifest);
    const blob = new Blob([stringManifest], { type: 'application/json' });
    manifestMeta.setAttribute('href', URL.createObjectURL(blob));

    const shareImage = store.logo || store.capa;
    if (shareImage) {
      let ogImageMeta = document.querySelector('meta[property="og:image"]');
      if (!ogImageMeta) {
        ogImageMeta = document.createElement('meta');
        ogImageMeta.setAttribute('property', 'og:image');
        document.head.appendChild(ogImageMeta);
      }
      ogImageMeta.setAttribute('content', shareImage);
    }
  }, [store]);

  // Escutar categorias, produtos e complementos em tempo real
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

  // Filtragem de busca
  const filteredProducts = useMemo(() => {
    let list = products.filter((p) => p.disponivel !== false && p.ativo !== false);
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
    <div className="min-h-screen bg-neutral-100 flex flex-col pb-28 selection:bg-rose-500 selection:text-white text-base">
      {/* Cabeçalho da Loja com Capa e Logo */}
      <StoreHeader store={store} />

      {/* Barra de Busca e Navegação por Categorias (Sticky) */}
      <div className="sticky top-0 z-30 bg-white/98 backdrop-blur-md border-b border-neutral-200 shadow-sm transition-all">
        <div className="max-w-4xl mx-auto px-4 py-3 space-y-3">
          {/* Versão Compacta do Cabeçalho ao Rolar */}
          {isScrolled && (
            <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-neutral-100 animate-fadeIn">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-white border border-neutral-200 overflow-hidden flex-shrink-0 flex items-center justify-center font-black text-neutral-400 text-sm shadow-2xs">
                  {store.logo ? (
                    <img
                      src={store.logo}
                      alt={store.nome}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    store.nome.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-black text-[#111111] truncate leading-tight">
                    {store.nome}
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${openStatus.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                    <span className="text-xs font-bold text-neutral-600">
                      {openStatus.isOpen ? 'Aberta agora' : 'Fechada'}
                    </span>
                  </div>
                </div>
              </div>

              {store.whatsapp && (
                <a
                  href={generateWhatsAppUrl(store.whatsapp, `Olá! Gostaria de tirar uma dúvida sobre o cardápio.`)}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors flex items-center gap-1.5 flex-shrink-0 min-h-[38px]"
                >
                  <MessageCircle className="w-4 h-4 text-white" />
                  <span className="hidden sm:inline">WhatsApp</span>
                </a>
              )}
            </div>
          )}

          {/* Busca (Input 16px para evitar auto-zoom no iOS) */}
          <div className="relative">
            <Search className="w-5 h-5 text-neutral-400 absolute left-4 top-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar pelo nome do prato, lanche, bebida..."
              className="w-full text-base pl-12 pr-4 py-3 bg-neutral-100 border border-neutral-300 rounded-2xl focus:outline-none focus:border-neutral-900 focus:bg-white transition-colors min-h-[48px] text-neutral-900"
            />
          </div>

          {/* Abas de Categorias (Touch target min 44px, fonte 16px) */}
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
                  className={`px-4 sm:px-5 py-2.5 rounded-2xl text-base font-bold whitespace-nowrap transition-all cursor-pointer min-h-[44px] ${
                    activeCategory === cat.id
                      ? 'bg-neutral-900 text-white shadow-sm'
                      : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 border border-neutral-200'
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
      <main className="max-w-2xl mx-auto w-full pb-6">
        <FeaturedSection products={products} onClick={setSelectedProduct} primaryColor={store.corPrimaria || '#000'} />
        
        {products.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-neutral-200 shadow-sm space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-400 mx-auto">
              <Utensils className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-neutral-900">Cardápio em preparação</h2>
            <p className="text-base text-neutral-500 max-w-sm mx-auto">
              O estabelecimento está cadastrando seus produtos. Volte em alguns instantes para conferir as delícias!
            </p>
          </div>
        ) : activeCategoriesWithProducts.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-neutral-200 text-neutral-600 text-base font-medium">
            Nenhum item encontrado para "{searchQuery}".
          </div>
        ) : (
          activeCategoriesWithProducts.map((cat) => {
            const catProducts = filteredProducts.filter(
              (p) => p.categoriaId === cat.id || p.categoryId === cat.id
            );
            if (catProducts.length === 0) return null;

            return (
              <section key={cat.id} id={`cat_${cat.id}`} className="space-y-4 scroll-mt-32">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">
                    {cat.nome}
                  </h2>
                  <div className="flex-1 h-px bg-neutral-300" />
                  <span className="text-sm font-bold text-neutral-500 bg-neutral-200 px-3 py-1 rounded-full">
                    {catProducts.length} {catProducts.length === 1 ? 'item' : 'itens'}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-0">
                  {catProducts.map((prod) => (
                    <ProductRow
                      key={prod.id}
                      product={prod}
                      onClick={() => setSelectedProduct(prod)}
                      primaryColor={store.corPrimaria || '#000'}
                    />
                  ))}
                </div>
              </section>
            );
          })
        )}
      </main>

      {/* Barra Flutuante da Sacola */}
      <CartFloatingBar onClick={() => setCartDrawerOpen(true)} primaryColor={store.corPrimaria} />

      {/* Drawer Lateral da Sacola */}
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
          }}
        />
      )}
    </div>
  );
};
