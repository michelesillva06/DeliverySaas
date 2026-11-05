import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  query,
  where,
  orderBy,
  onSnapshot,
  writeBatch,
  runTransaction,
  Unsubscribe,
} from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import { SUPPORT_WHATSAPP } from '../lib/constants';
import { limparObjeto } from '../lib/utils';
import { isStoreOpen, isStoreExpired, getStoreEffectiveStatus } from '../lib/formatters';
import {
  Store,
  StoreStatus,
  DayHours,
  Category,
  Product,
  OptionGroup,
  DeliveryZone,
  Coupon,
  Courier,
  Order,
  UserProfile,
  OrderStatus,
  PaymentStatus,
  SaasConfig,
  SaasPaymentRequest,
  StorePayment,
} from '../types';
import {
  recordOrderOperationalFee,
  reverseOrderOperationalFee,
  confirmOrderOperationalFee,
  recordAdminAuditLog,
} from './operationalFeeService';

// ==========================================
// ANONYMOUS AUTH HELPER FOR CUSTOMERS
// ==========================================
export function getOrCreateLocalCustomerId(): string {
  try {
    let uid = localStorage.getItem('delivery_customer_anon_uid');
    if (!uid) {
      uid = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('delivery_customer_anon_uid', uid);
    }
    return uid;
  } catch {
    return `anon_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

export async function ensureAnonymousCustomerAuth(): Promise<string> {
  if (auth.currentUser) {
    return auth.currentUser.uid;
  }
  try {
    const cred = await signInAnonymously(auth);
    return cred.user.uid;
  } catch (err: any) {
    // Se o provedor anônimo estiver restrito ou desativado no Firebase Auth da nuvem (auth/admin-restricted-operation),
    // utiliza o identificador local único do cliente para não quebrar a navegação e o checkout
    if (err?.code === 'auth/admin-restricted-operation' || err?.code === 'auth/operation-not-allowed') {
      console.info('Autenticação anônima do Firebase desabilitada no console GCP; utilizando identificador local de cliente seguro.');
    } else {
      console.warn('Aviso ao iniciar sessão anônima no Firebase Auth:', err?.message || err);
    }
    return getOrCreateLocalCustomerId();
  }
}

// ==========================================
// STORES (FIRESTORE)
// ==========================================
export async function getStoreFromFirestore(storeId: string): Promise<Store | null> {
  try {
    const docRef = doc(db, 'stores', storeId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as Store;
    }
    return null;
  } catch (error) {
    console.error('Erro ao buscar loja no Firestore:', error);
    return null;
  }
}

export async function seedDemoStoreInFirestore(slug = 'bora-de-acai'): Promise<Store> {
  const storeId = 'store_bora_de_acai_demo';
  const demoStore: Store = {
    id: storeId,
    nome: 'Bora de Açaí',
    slug: 'bora-de-acai',
    customSlug: 'restaurante-demonstracao',
    descricao: 'O melhor açaí da cidade com adicionais ilimitados e entrega rápida! (Loja de Demonstração)',
    whatsapp: '5592999998888',
    status: 'ativa',
    aberta: true,
    aceitaEntrega: true,
    aceitaRetirada: true,
    corPrimaria: '#7e22ce',
    pedidoMinimo: 15.0,
    tempoEstimadoMin: 30,
    tempoEstimadoRetiradaMin: 15,
    endereco: 'Av. Djalma Batista, 1200 - Chapada, Manaus - AM',
    logo: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=300&q=80',
    capa: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=1200&q=80',
    ownerUid: 'demo_owner_uid',
    nomeResponsavel: 'Bora de Açaí',
    emailResponsavel: 'demo@boradeacai.com',
    plano: 'Ilimitado',
    valorImplantacao: 0,
    valorMensalidade: 0,
    diaVencimento: 30,
    dataVencimento: '2030-12-31T23:59:59.000Z',
    pagamentos: {
      pix: true,
      cartaoEntrega: true,
      dinheiro: true,
      whatsapp: true,
    },
    pixKeyType: 'telefone',
    pixKey: '92999998888',
    pixReceiverName: 'Bora de Açaí Ltda',
    pixCity: 'MANAUS',
    criadoEm: new Date().toISOString(),
    viasImpressao: 'ambas',
    imprimirAutoAoAceitar: false,
    soundPreference: 'bell',
    horarios: [],
    nextOrderNumber: 1001,
    mensagensWhatsapp: {
      aceito: 'Olá {nome}! Seu pedido #{numero} foi aceito.',
      preparo: 'Olá {nome}! Seu pedido #{numero} está em preparo.',
      saiuEntrega: 'Olá {nome}! Seu pedido #{numero} saiu para entrega!',
      prontoRetirada: 'Olá {nome}! Seu pedido #{numero} está pronto para retirada!',
      cancelado: 'Olá {nome}. Seu pedido #{numero} foi cancelado.',
    },
  };

  try {
    // 1. Salvar Loja
    await setDoc(doc(db, 'stores', storeId), limparObjeto(demoStore));

    // 2. Salvar Categorias
    const categories: Category[] = [
      { id: 'cat_acai_copos', storeId, nome: 'Copos de Açaí', ordem: 1, ativa: true },
      { id: 'cat_acai_felicidade', storeId, nome: 'Copo da Felicidade', ordem: 2, ativa: true },
      { id: 'cat_acai_bebidas', storeId, nome: 'Sucos e Bebidas', ordem: 3, ativa: true },
    ];
    for (const cat of categories) {
      await setDoc(doc(db, 'categories', cat.id), limparObjeto(cat));
    }

    // 3. Salvar Grupos de Adicionais
    const optionGroups: OptionGroup[] = [
      {
        id: 'opt_tamanho',
        storeId,
        nome: 'Acompanhamentos Grátis',
        obrigatorio: true,
        min: 1,
        max: 2,
        opcoes: [
          { id: 'opt_1', nome: 'Leite em Pó Ninho', preco: 0 },
          { id: 'opt_2', nome: 'Leite Condensado Nestlé', preco: 0 },
          { id: 'opt_3', nome: 'Paçoca Crocante', preco: 0 },
        ],
      },
      {
        id: 'opt_coberturas',
        storeId,
        nome: 'Adicionais Especiais (Opcional)',
        obrigatorio: false,
        min: 0,
        max: 4,
        opcoes: [
          { id: 'opt_c1', nome: 'Nutella Pura (50g)', preco: 5.0 },
          { id: 'opt_c2', nome: 'Morango Fresco Fatiado', preco: 4.0 },
          { id: 'opt_c3', nome: 'Banana Prata Fatiada', preco: 3.0 },
          { id: 'opt_c4', nome: 'Granola Crocante', preco: 2.5 },
        ],
      },
    ];
    for (const og of optionGroups) {
      await setDoc(doc(db, 'optionGroups', og.id), limparObjeto(og));
    }

    // 4. Salvar Produtos
    const products: Product[] = [
      {
        id: 'prod_acai_300',
        storeId,
        categoriaId: 'cat_acai_copos',
        nome: 'Açaí Tradicional 300ml',
        descricao: 'Açaí puro batido cremoso de altíssima qualidade. Acompanha até 2 itens grátis.',
        preco: 16.0,
        disponivel: true,
        ativo: true,
        ordem: 1,
        optionGroupIds: ['opt_tamanho', 'opt_coberturas'],
        imagem: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=600&q=80',
      },
      {
        id: 'prod_acai_500',
        storeId,
        categoriaId: 'cat_acai_copos',
        nome: 'Açaí Tradicional 500ml',
        descricao: 'O mais pedido! Açaí cremoso de altíssima pureza com sabor inigualável.',
        preco: 22.0,
        precoPromocional: 19.9,
        disponivel: true,
        ativo: true,
        ordem: 2,
        optionGroupIds: ['opt_tamanho', 'opt_coberturas'],
        imagem: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=600&q=80',
      },
      {
        id: 'prod_felicidade_700',
        storeId,
        categoriaId: 'cat_acai_felicidade',
        nome: 'Copo da Felicidade 700ml',
        descricao: 'Camadas fartas de açaí, Nutella pura, morango fresco, leite condensado e M&Ms.',
        preco: 32.0,
        disponivel: true,
        ativo: true,
        ordem: 3,
        optionGroupIds: ['opt_coberturas'],
        imagem: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=600&q=80',
      },
      {
        id: 'prod_suco_300',
        storeId,
        categoriaId: 'cat_acai_bebidas',
        nome: 'Suco Natural de Laranja 500ml',
        descricao: 'Suco da fruta espremido na hora, 100% natural e sem açúcar.',
        preco: 9.0,
        disponivel: true,
        ativo: true,
        ordem: 4,
        optionGroupIds: [],
        imagem: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=600&q=80',
      },
    ];
    for (const prod of products) {
      await setDoc(doc(db, 'products', prod.id), limparObjeto(prod));
    }

    // 5. Salvar Bairros de Entrega
    const zones: DeliveryZone[] = [
      { id: 'zone_demo_1', storeId, bairro: 'Centro', taxa: 5.0, ativo: true },
      { id: 'zone_demo_2', storeId, bairro: 'Chapada', taxa: 6.0, ativo: true },
      { id: 'zone_demo_3', storeId, bairro: 'Adrianópolis', taxa: 8.0, ativo: true },
      { id: 'zone_demo_4', storeId, bairro: 'Flores', taxa: 7.0, ativo: true },
    ];
    for (const zone of zones) {
      await setDoc(doc(db, 'deliveryZones', zone.id), limparObjeto(zone));
    }

    return demoStore;
  } catch (err) {
    console.error('Erro ao semear loja de demonstração no Firestore:', err);
    return demoStore;
  }
}

export async function seedMegaBurgerStoreInFirestore(slug = 'megaburger'): Promise<Store> {
  const storeId = 'store_mega_burger_demo';
  const demoStore: Store = {
    id: storeId,
    nome: 'Mega Burger',
    slug: 'megaburger',
    customSlug: 'mega-burger',
    descricao: 'Smash burgers artesanais suculentos, pão brioche amanteigado, bacon crocante e molhos especiais. (Demonstração)',
    whatsapp: '5592999997777',
    status: 'ativa',
    aberta: true,
    aceitaEntrega: true,
    aceitaRetirada: true,
    corPrimaria: '#d97706',
    pedidoMinimo: 20.0,
    tempoEstimadoMin: 35,
    tempoEstimadoRetiradaMin: 20,
    endereco: 'Rua das Laranjeiras, 500 - Adrianópolis, Manaus - AM',
    logo: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=300&q=80',
    capa: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1200&q=80',
    ownerUid: 'demo_megaburger_uid',
    nomeResponsavel: 'Mega Burger',
    emailResponsavel: 'contato@megaburger.com',
    plano: 'Ilimitado',
    valorImplantacao: 0,
    valorMensalidade: 0,
    diaVencimento: 30,
    dataVencimento: '2030-12-31T23:59:59.000Z',
    pagamentos: {
      pix: true,
      cartaoEntrega: true,
      dinheiro: true,
      whatsapp: true,
    },
    pixKeyType: 'telefone',
    pixKey: '92999997777',
    pixReceiverName: 'Mega Burger Lanches Ltda',
    pixCity: 'MANAUS',
    criadoEm: new Date().toISOString(),
    viasImpressao: 'ambas',
    imprimirAutoAoAceitar: false,
    soundPreference: 'bell',
    horarios: [],
    nextOrderNumber: 2001,
    mensagensWhatsapp: {
      aceito: 'Olá {nome}! Seu pedido #{numero} no Mega Burger foi aceito.',
      preparo: 'Olá {nome}! Seu burger #{numero} está na chapa sendo preparado!',
      saiuEntrega: 'Olá {nome}! Seu pedido #{numero} saiu para entrega!',
      prontoRetirada: 'Olá {nome}! Seu pedido #{numero} está pronto no balcão!',
      cancelado: 'Olá {nome}. Seu pedido #{numero} foi cancelado.',
    },
  };

  try {
    await setDoc(doc(db, 'stores', storeId), limparObjeto(demoStore));

    const categories: Category[] = [
      { id: 'cat_burger_smash', storeId, nome: 'Smash Burgers Artesanais', ordem: 1, ativa: true },
      { id: 'cat_burger_porcoes', storeId, nome: 'Porções & Acompanhamentos', ordem: 2, ativa: true },
      { id: 'cat_burger_bebidas', storeId, nome: 'Bebidas Geladas', ordem: 3, ativa: true },
    ];
    for (const cat of categories) {
      await setDoc(doc(db, 'categories', cat.id), limparObjeto(cat));
    }

    const optionGroups: OptionGroup[] = [
      {
        id: 'opt_burger_ponto',
        storeId,
        nome: 'Ponto da Carne',
        obrigatorio: true,
        min: 1,
        max: 1,
        opcoes: [
          { id: 'opt_p1', nome: 'Ao Ponto Smash (Suculento)', preco: 0 },
          { id: 'opt_p2', nome: 'Bem Passado Crocante', preco: 0 },
        ],
      },
      {
        id: 'opt_burger_extras',
        storeId,
        nome: 'Turbine seu Burger (Opcional)',
        obrigatorio: false,
        min: 0,
        max: 5,
        opcoes: [
          { id: 'opt_b1', nome: 'Cheddar Melt Cremoso Extra', preco: 4.5 },
          { id: 'opt_b2', nome: 'Fatias de Bacon Crocante Extra', preco: 5.5 },
          { id: 'opt_b3', nome: 'Cebola Caramelizada', preco: 3.5 },
          { id: 'opt_b4', nome: 'Molho Especial Mega Defumado (40ml)', preco: 3.0 },
          { id: 'opt_b5', nome: 'Smash Blend Extra 90g com Queijo', preco: 8.9 },
        ],
      },
    ];
    for (const og of optionGroups) {
      await setDoc(doc(db, 'optionGroups', og.id), limparObjeto(og));
    }

    const products: Product[] = [
      {
        id: 'prod_mega_bacon',
        storeId,
        categoriaId: 'cat_burger_smash',
        nome: 'The Mega Bacon Smash',
        descricao: 'Duplo smash burger 180g dry-aged, generoso cheddar melt, fatias de bacon crocante e molho secreto no pão brioche selado.',
        preco: 36.9,
        precoPromocional: 32.9,
        destaque: true,
        disponivel: true,
        ativo: true,
        ordem: 1,
        optionGroupIds: ['opt_burger_ponto', 'opt_burger_extras'],
        imagem: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80',
      },
      {
        id: 'prod_smoky_cheddar',
        storeId,
        categoriaId: 'cat_burger_smash',
        nome: 'Smoky Cheddar & Onions',
        descricao: 'Dois smash 90g, cheddar inglês cremoso, cebola caramelizada artesanal e picles crocante.',
        preco: 31.9,
        destaque: true,
        disponivel: true,
        ativo: true,
        ordem: 2,
        optionGroupIds: ['opt_burger_ponto', 'opt_burger_extras'],
        imagem: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=600&q=80',
      },
      {
        id: 'prod_classic_cheese',
        storeId,
        categoriaId: 'cat_burger_smash',
        nome: 'Classic Cheeseburger',
        descricao: 'Smash 100g, queijo prato derretido, maionese artesanal da casa em pão brioche macio.',
        preco: 24.9,
        destaque: false,
        disponivel: true,
        ativo: true,
        ordem: 3,
        optionGroupIds: ['opt_burger_ponto', 'opt_burger_extras'],
        imagem: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80',
      },
      {
        id: 'prod_fritas_cheddar_bacon',
        storeId,
        categoriaId: 'cat_burger_porcoes',
        nome: 'Fritas Rústicas com Cheddar e Bacon',
        descricao: 'Batatas rústicas douradas e crocantes, cobertas com molho cheddar cremoso e farofa de bacon.',
        preco: 22.0,
        destaque: true,
        disponivel: true,
        ativo: true,
        ordem: 4,
        optionGroupIds: [],
        imagem: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=600&q=80',
      },
      {
        id: 'prod_refrigerante_lata',
        storeId,
        categoriaId: 'cat_burger_bebidas',
        nome: 'Refrigerante em Lata 350ml',
        descricao: 'Coca-Cola original, Coca Sem Açúcar ou Guaraná Antarctica bem gelado.',
        preco: 6.5,
        destaque: false,
        disponivel: true,
        ativo: true,
        ordem: 5,
        optionGroupIds: [],
        imagem: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80',
      },
    ];
    for (const prod of products) {
      await setDoc(doc(db, 'products', prod.id), limparObjeto(prod));
    }

    const zones: DeliveryZone[] = [
      { id: 'zone_mb_1', storeId, bairro: 'Adrianópolis', taxa: 6.0, ativo: true },
      { id: 'zone_mb_2', storeId, bairro: 'Centro', taxa: 7.0, ativo: true },
      { id: 'zone_mb_3', storeId, bairro: 'Nossa Senhora das Graças', taxa: 5.0, ativo: true },
      { id: 'zone_mb_4', storeId, bairro: 'Parque 10', taxa: 8.0, ativo: true },
    ];
    for (const zone of zones) {
      await setDoc(doc(db, 'deliveryZones', zone.id), limparObjeto(zone));
    }

    return demoStore;
  } catch (err) {
    console.error('Erro ao semear loja Mega Burger no Firestore:', err);
    return demoStore;
  }
}

export async function getStoreBySlugFromFirestore(slug: string): Promise<Store | null> {
  try {
    const cleanSlug = slug.toLowerCase().trim();
    // 1. Tentar buscar pelo slug padrão
    const qSlug = query(collection(db, 'stores'), where('slug', '==', cleanSlug));
    const snapSlug = await getDocs(qSlug);
    if (!snapSlug.empty) {
      return snapSlug.docs[0].data() as Store;
    }
    
    // 2. Tentar buscar pelo customSlug (vanity URL)
    const qCustom = query(collection(db, 'stores'), where('customSlug', '==', cleanSlug));
    const snapCustom = await getDocs(qCustom);
    if (!snapCustom.empty) {
      return snapCustom.docs[0].data() as Store;
    }
    
    return null;
  } catch (error) {
    console.error('Erro ao buscar loja por slug no Firestore:', error);
    return null;
  }
}

export async function getAllStoresFromFirestore(): Promise<Store[]> {
  try {
    const snap = await getDocs(collection(db, 'stores'));
    const list: Store[] = [];
    snap.forEach((d) => list.push(d.data() as Store));
    return list;
  } catch (error) {
    console.error('Erro ao buscar todas as lojas:', error);
    return [];
  }
}

export async function isSlugAvailableInFirestore(slug: string, currentStoreId?: string): Promise<boolean> {
  try {
    const clean = slug.toLowerCase().trim();
    if (!clean) return false;
    const q = query(collection(db, 'stores'), where('slug', '==', clean));
    const snap = await getDocs(q);
    if (snap.empty) return true;
    if (currentStoreId && snap.docs.length === 1 && snap.docs[0].id === currentStoreId) {
      return true;
    }
    return false;
  } catch (error) {
    console.error('Erro ao validar slug no Firestore:', error);
    return true;
  }
}

export function subscribeToStore(storeId: string, callback: (store: Store | null) => void): Unsubscribe {
  const docRef = doc(db, 'stores', storeId);
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        callback(snap.data() as Store);
      } else {
        callback(null);
      }
    },
    (err) => {
      console.error('Erro no snapshot de store:', err);
    }
  );
}

export function subscribeToStoreBySlug(slug: string, callback: (store: Store | null) => void): Unsubscribe {
  const cleanSlug = slug.toLowerCase().trim();
  const q = query(collection(db, 'stores'), where('slug', '==', cleanSlug));
  return onSnapshot(
    q,
    async (snap) => {
      if (!snap.empty) {
        callback(snap.docs[0].data() as Store);
      } else {
        // Tentar buscar por customSlug
        const qCustom = query(collection(db, 'stores'), where('customSlug', '==', cleanSlug));
        const snapCustom = await getDocs(qCustom);
        if (!snapCustom.empty) {
          callback(snapCustom.docs[0].data() as Store);
        } else {
          callback(null);
        }
      }
    },
    (err) => {
      console.error('Erro no snapshot de store por slug:', err);
    }
  );
}

export async function softDeleteStoreInFirestore(
  storeId: string,
  authorEmail: string,
  storeSlug: string,
  storeNome: string
): Promise<void> {
  const docRef = doc(db, 'stores', storeId);
  const now = new Date().toISOString();
  await updateDoc(docRef, {
    excluida: true,
    excluidaEm: now,
    excluidaPor: authorEmail,
    aberta: false,
  });

  await recordAdminAuditLog({
    autorEmail: authorEmail,
    autorUid: 'master',
    acao: 'LOJA_EXCLUIDA',
    alvoId: storeId,
    alvoNome: storeNome,
    detalhes: `Loja "${storeNome}" (${storeSlug}) foi excluída logicamente da plataforma.`,
  });
}

export async function restoreStoreInFirestore(
  storeId: string,
  authorEmail: string,
  storeSlug: string,
  storeNome: string
): Promise<void> {
  const docRef = doc(db, 'stores', storeId);
  const now = new Date().toISOString();
  await updateDoc(docRef, {
    excluida: false,
    aberta: false, // Restaurar como fechado para revisão operacional
    restauradaEm: now,
    restauradaPor: authorEmail,
  });

  await recordAdminAuditLog({
    autorEmail: authorEmail,
    autorUid: 'master',
    acao: 'LOJA_RESTAURADA',
    alvoId: storeId,
    alvoNome: storeNome,
    detalhes: `Loja "${storeNome}" (${storeSlug}) foi restaurada com status fechada para revisão operacional.`,
  });
}

export function subscribeToAllStores(callback: (stores: Store[]) => void): Unsubscribe {
  return onSnapshot(
    collection(db, 'stores'),
    (snap) => {
      const list: Store[] = [];
      snap.forEach((d) => list.push(d.data() as Store));
      callback(list);
    },
    (err) => {
      console.error('Erro no snapshot de all stores:', err);
      callback([]);
    }
  );
}

export async function saveStoreToFirestore(store: Store): Promise<void> {
  const docRef = doc(db, 'stores', store.id);
  // Proteção: Nunca salvar senhas em texto puro no documento público da loja
  const { senha, senhaTemporaria, ...safeStore } = store as any;
  await setDoc(docRef, limparObjeto(safeStore), { merge: true });
}
export const saveStoreInFirestore = saveStoreToFirestore;

export async function updateStoreStatusInFirestore(
  storeId: string,
  abertaOrStatus: boolean | StoreStatus
): Promise<void> {
  const docRef = doc(db, 'stores', storeId);
  if (typeof abertaOrStatus === 'boolean') {
    await updateDoc(docRef, limparObjeto({ aberta: abertaOrStatus }));
  } else {
    await updateDoc(docRef, limparObjeto({ status: abertaOrStatus }));
  }
}

export async function updateStoreOpenStatusInFirestore(storeId: string, aberta: boolean): Promise<void> {
  const docRef = doc(db, 'stores', storeId);
  await updateDoc(docRef, limparObjeto({ aberta }));
}

export async function updateStoreBillingStatusInFirestore(storeId: string, status: StoreStatus): Promise<void> {
  const docRef = doc(db, 'stores', storeId);
  await updateDoc(docRef, limparObjeto({ status }));
}

export async function updateStoreHorariosInFirestore(
  storeId: string,
  horarios: DayHours[],
  aberta: boolean
): Promise<void> {
  const docRef = doc(db, 'stores', storeId);
  await updateDoc(docRef, limparObjeto({ horarios, aberta }));
}

export async function updateStoreLogoInFirestore(storeId: string, logoUrl: string | null): Promise<void> {
  const docRef = doc(db, 'stores', storeId);
  const cleanUrl = logoUrl && typeof logoUrl === 'string' ? logoUrl.trim() : '';
  await updateDoc(docRef, {
    logo: cleanUrl,
  });
}

export async function updateStoreCapaInFirestore(storeId: string, capaUrl: string | null): Promise<void> {
  const docRef = doc(db, 'stores', storeId);
  const cleanUrl = capaUrl && typeof capaUrl === 'string' ? capaUrl.trim() : '';
  await updateDoc(docRef, {
    capa: cleanUrl,
  });
}

// ==========================================
// ORDERS (TEMPO REAL VIA onSnapshot & TRANSACTIONS)
// ==========================================
export function subscribeToOrdersByStore(
  storeId: string,
  callback: (orders: Order[]) => void
): Unsubscribe {
  const colRef = collection(db, 'orders');
  const q = query(colRef, where('storeId', '==', storeId));

  return onSnapshot(
    q,
    (snap) => {
      const orders: Order[] = [];
      snap.forEach((d) => {
        orders.push(d.data() as Order);
      });
      orders.sort(
        (a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime()
      );
      callback(orders);
    },
    (err) => {
      console.error('Erro no snapshot de orders:', err);
      callback([]);
    }
  );
}

export function subscribeToAllOrders(
  callback: (orders: Order[]) => void,
  limitCount = 500
): Unsubscribe {
  const colRef = collection(db, 'orders');
  return onSnapshot(
    colRef,
    (snap) => {
      const orders: Order[] = [];
      snap.forEach((d) => {
        orders.push(d.data() as Order);
      });
      orders.sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());
      callback(orders.slice(0, limitCount));
    },
    (err) => {
      console.error('Erro no snapshot global de orders:', err);
      callback([]);
    }
  );
}

// Regras de transição válida de status de pedidos (máquina de estados finitos)
export const VALID_ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  novo: ['aceito', 'cancelado'],
  aceito: ['preparo', 'cancelado'],
  preparo: ['saiu_entrega', 'pronto', 'cancelado'],
  saiu_entrega: ['entregue', 'cancelado'],
  pronto: ['entregue', 'cancelado'],
  entregue: [],
  cancelado: [],
};

// Regras de transição válida de status de pagamento
export const VALID_PAYMENT_STATUS_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  aguardando: ['informado', 'confirmado', 'estornado'],
  na_entrega: ['confirmado', 'estornado'],
  informado: ['confirmado', 'aguardando', 'estornado'],
  confirmado: ['estornado'],
  estornado: [],
};

export function subscribeToOrderById(
  orderId: string,
  callback: (order: Order | null) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const docRef = doc(db, 'orders', orderId);
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        callback(snap.data() as Order);
      } else {
        callback(null);
      }
    },
    (err) => {
      console.error('Erro no snapshot do pedido:', err);
      if (onError) onError(err);
    }
  );
}

export async function getOrderByIdFromFirestore(orderId: string): Promise<Order | null> {
  try {
    const docRef = doc(db, 'orders', orderId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as Order;
    }
    return null;
  } catch (error) {
    console.error('Erro ao buscar pedido por id:', error);
    return null;
  }
}

export async function getOrdersByStoreFromFirestore(storeId: string): Promise<Order[]> {
  try {
    const q = query(collection(db, 'orders'), where('storeId', '==', storeId));
    const snap = await getDocs(q);
    const list: Order[] = [];
    snap.forEach((d) => list.push(d.data() as Order));
    list.sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());
    return list;
  } catch (err) {
    console.error('Erro ao buscar pedidos no Firestore:', err);
    return [];
  }
}

/**
 * Criação confiável e atômica de pedidos no Firestore.
 * 1. Recalcula preços de produtos, complementos, cupons e taxas de entrega a partir dos dados oficiais do banco.
 * 2. Valida loja aberta, produtos ativos, regras de complementos e pedido mínimo.
 * 3. Garante número sequencial estritamente atômico e gravação no mesmo bloco de transação.
 * 4. Idempotência: caso o mesmo pedido (idempotencyKey / id) seja reenviado, retorna o pedido existente sem duplicá-lo.
 */
export async function createOrderInFirestore(
  orderData: Omit<Order, 'numero' | 'criadoEm' | 'historicoStatus'> & {
    id?: string;
    idempotencyKey?: string;
  }
): Promise<Order> {
  if (!orderData.storeId) {
    throw new Error('Identificador da loja (storeId) é obrigatório.');
  }

  const storeRef = doc(db, 'stores', orderData.storeId);
  const storeSnap = await getDoc(storeRef);
  if (!storeSnap.exists()) {
    throw new Error('Loja não encontrada ou inativa.');
  }
  const store = storeSnap.data() as Store;

  // 1. Validar disponibilidade da loja e status da assinatura/licença
  if (store.status === 'bloqueada' || store.status === 'aguardando_ativacao') {
    throw new Error('Esta loja não está disponível para receber novos pedidos no momento.');
  }
  if (isStoreExpired(store)) {
    throw new Error('A assinatura desta loja está vencida no momento. Não é possível concluir o pedido.');
  }
  const openStatus = isStoreOpen(store);
  if (!openStatus.isOpen) {
    throw new Error(openStatus.reason || 'A loja está fechada para novos pedidos no momento.');
  }

  // 2. Validar modalidade de atendimento
  if (orderData.tipo === 'entrega' && store.aceitaEntrega === false) {
    throw new Error('Esta loja não realiza entregas no momento.');
  }
  if (orderData.tipo === 'retirada' && store.aceitaRetirada === false) {
    throw new Error('Esta loja não aceita retirada no balcão.');
  }

  // 3. Validar itens do carrinho
  if (!orderData.itens || orderData.itens.length === 0) {
    throw new Error('O carrinho de itens está vazio.');
  }

  // 4. Buscar e validar produtos oficiais do Firestore
  const uniqueProdIds = Array.from(new Set(orderData.itens.map((i) => i.produtoId)));
  const prodDocs = await Promise.all(uniqueProdIds.map((pid) => getDoc(doc(db, 'products', pid))));
  const prodMap = new Map<string, Product>();

  for (const pDoc of prodDocs) {
    if (!pDoc.exists()) {
      throw new Error('Um dos produtos selecionados não foi encontrado no cardápio.');
    }
    const prod = pDoc.data() as Product;
    if (prod.storeId !== orderData.storeId || prod.ativo === false) {
      throw new Error(`O produto "${prod.nome}" está indisponível para pedidos.`);
    }
    prodMap.set(prod.id, prod);
  }

  // 5. Buscar e validar grupos de opcionais oficiais
  const uniqueGroupIds = Array.from(
    new Set(
      orderData.itens
        .flatMap((it) => (it.complementos || []).map((c) => c.grupoId))
        .filter(Boolean)
    )
  );
  const groupDocs = await Promise.all(
    uniqueGroupIds.map((gid) => getDoc(doc(db, 'option_groups', gid)))
  );
  const groupMap = new Map<string, OptionGroup>();
  for (const gDoc of groupDocs) {
    if (gDoc.exists()) {
      const group = gDoc.data() as OptionGroup;
      if (group.storeId === orderData.storeId) {
        groupMap.set(group.id, group);
      }
    }
  }

  // 6. Recalcular cada item com preços oficiais
  let calculatedSubtotal = 0;
  const recalculatedItems = orderData.itens.map((item, idx) => {
    const prod = prodMap.get(item.produtoId)!;
    const qtd = Math.max(1, Math.floor(Number(item.qtd) || 1));

    // Preço base oficial (considerando preço promocional se válido)
    const officialBasePrice =
      typeof prod.precoPromocional === 'number' && prod.precoPromocional > 0 && prod.precoPromocional < prod.preco
        ? prod.precoPromocional
        : prod.preco;

    // Validar e recalcular complementos
    let complementsTotal = 0;
    const cleanComplements: Order['itens'][0]['complementos'] = [];

    // Agrupar contagens para validar limites mínimos e máximos por grupo
    const countsByGroup: Record<string, number> = {};

    (item.complementos || []).forEach((c) => {
      const group = groupMap.get(c.grupoId);
      let officialComplementPrice = 0;
      let officialComplementName = c.nome;

      if (group) {
        countsByGroup[c.grupoId] = (countsByGroup[c.grupoId] || 0) + 1;
        const foundOpt = (group.opcoes || []).find(
          (o) => o.id === c.opcaoId || o.nome.toLowerCase() === c.nome.toLowerCase()
        );
        if (foundOpt) {
          officialComplementPrice = Math.max(0, Number(foundOpt.preco) || 0);
          officialComplementName = foundOpt.nome;
        }
      }

      complementsTotal += officialComplementPrice;
      cleanComplements.push({
        grupoId: c.grupoId || '',
        grupoNome: group?.nome || c.grupoNome || '',
        opcaoId: c.opcaoId || '',
        nome: officialComplementName,
        preco: officialComplementPrice,
      });
    });

    // Validar obrigatoriedade e limites máximos dos grupos
    groupMap.forEach((group, gid) => {
      const count = countsByGroup[gid] || 0;
      const minRequired = group.obrigatorio ? Math.max(1, group.min || 1) : group.min || 0;
      if (count < minRequired) {
        throw new Error(
          `O grupo "${group.nome}" exige no mínimo ${minRequired} opção(ões) selecionada(s).`
        );
      }
      if (typeof group.max === 'number' && group.max > 0 && count > group.max) {
        throw new Error(
          `O grupo "${group.nome}" permite no máximo ${group.max} opção(ões).`
        );
      }
    });

    const itemUnitPrice = officialBasePrice + complementsTotal;
    const totalItem = itemUnitPrice * qtd;
    calculatedSubtotal += totalItem;

    return {
      id: item.id || `item_${idx}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      produtoId: prod.id,
      nome: prod.nome,
      qtd,
      precoUnit: officialBasePrice,
      complementos: cleanComplements,
      obs: (item.obs || '').trim(),
      totalItem,
    };
  });

  // 7. Recalcular cupom de desconto oficial
  let calculatedDiscount = 0;
  let validatedCouponCode: string | null = null;
  if (orderData.cupom) {
    const couponValidation = await validateCouponInFirestore(
      orderData.storeId,
      orderData.cupom,
      calculatedSubtotal
    );
    if (couponValidation.valid) {
      calculatedDiscount = couponValidation.discount;
      validatedCouponCode = couponValidation.coupon?.codigo || null;
    }
  }

  // 8. Validar pedido mínimo da loja (considera valor dos produtos após descontos, sem entrega e sem taxa de serviço)
  const minStore = Math.max(0, Number(store.pedidoMinimo) || 0);
  const valorProdutosComDesconto = Math.max(0, calculatedSubtotal - calculatedDiscount);
  if (valorProdutosComDesconto < minStore) {
    throw new Error(
      `O valor dos produtos após descontos (R$ ${valorProdutosComDesconto.toFixed(2)}) não atinge o pedido mínimo de R$ ${minStore.toFixed(2)}.`
    );
  }

  // 9. Recalcular taxa de entrega oficial
  let calculatedDeliveryFee = 0;
  if (orderData.tipo === 'entrega') {
    if (!orderData.endereco?.bairro) {
      throw new Error('Informe o bairro de entrega para calcular o valor da taxa.');
    }
    const cleanBairro = orderData.endereco.bairro.trim().toLowerCase();
    const zonesSnap = await getDocs(
      query(collection(db, 'delivery_zones'), where('storeId', '==', orderData.storeId))
    );
    const zones = zonesSnap.docs.map((d) => d.data() as DeliveryZone);
    const matchedZone = zones.find(
      (z) => z.ativo !== false && z.bairro.trim().toLowerCase() === cleanBairro
    );

    if (matchedZone) {
      calculatedDeliveryFee = Math.max(0, Number(matchedZone.taxa) || 0);
    } else {
      calculatedDeliveryFee = Math.max(0, Number(orderData.taxaEntrega) || 0);
    }
  }

  // 10. Recalcular taxa de serviço da plataforma (R$ 0,99 por pedido com itens; R$ 0 se sacola vazia)
  const calculatedServiceFee = recalculatedItems.length > 0 ? 0.99 : 0;

  // 11. Recalcular total oficial: Total = produtos − descontos + entrega + taxa de serviço
  const calculatedTotal = Math.max(
    0,
    calculatedSubtotal - calculatedDiscount + calculatedDeliveryFee + calculatedServiceFee
  );

  // 11. Validação de pagamento e troco
  if (orderData.pagamento.forma === 'dinheiro' && orderData.pagamento.troco) {
    if (orderData.pagamento.troco < calculatedTotal) {
      throw new Error(
        `O valor informado para troco (R$ ${orderData.pagamento.troco.toFixed(2)}) é menor que o total do pedido (R$ ${calculatedTotal.toFixed(2)}).`
      );
    }
  }

  // Status de pagamento inicial seguro (nunca permite injeção de 'confirmado' pelo cliente)
  const safeInitialPaymentStatus: PaymentStatus =
    orderData.pagamento.forma === 'dinheiro' || orderData.pagamento.forma === 'cartao_entrega'
      ? 'na_entrega'
      : 'aguardando';

  // 12. Idempotência e numeração atômica
  const targetOrderId =
    orderData.id || orderData.idempotencyKey || `ord_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const orderRef = doc(db, 'orders', targetOrderId);

  // Se o pedido já tiver sido salvo previamente com esta mesma chave estável (ex: recuperação após falha de rede)
  try {
    const existingSnap = await getDoc(orderRef);
    if (existingSnap.exists()) {
      console.info('Pedido já gravado no Firestore anteriormente nesta tentativa. Retornando documento existente.');
      return existingSnap.data() as Order;
    }
  } catch {
    // Documento ainda não existe ou não está acessível; prossegue normalmente com a criação
  }

  let createdOrder: Order;
  try {
    createdOrder = await runTransaction(db, async (transaction) => {
      // 1. Ler número sequencial atual da loja (store doc existe e tem allow read: true)
      const currentStoreDoc = await transaction.get(storeRef);
      let nextNum = 1001;
      if (currentStoreDoc.exists()) {
        const sData = currentStoreDoc.data() as Store;
        nextNum =
          typeof sData.nextOrderNumber === 'number' && sData.nextOrderNumber > 0
            ? sData.nextOrderNumber
            : 1001;
      }

      // 2. Atualizar sequencial da loja atomicamente
      transaction.update(storeRef, { nextOrderNumber: nextNum + 1 });

      const nowIso = new Date().toISOString();
      const newOrder: Order = {
        ...orderData,
        id: targetOrderId,
        numero: nextNum,
        subtotal: calculatedSubtotal,
        taxaEntrega: calculatedDeliveryFee,
        taxaServico: calculatedServiceFee,
        desconto: calculatedDiscount,
        cupom: validatedCouponCode,
        total: calculatedTotal,
        itens: recalculatedItems,
        pagamento: {
          forma: orderData.pagamento.forma,
          status: safeInitialPaymentStatus,
          troco: orderData.pagamento.troco,
        },
        status: 'novo',
        criadoEm: nowIso,
        historicoStatus: [
          {
            status: 'novo',
            em: nowIso,
            nota: 'Pedido recebido e validado com sucesso pelo sistema',
          },
        ],
      };

      // 3. Gravar o pedido atomicamente dentro da mesma transação
      transaction.set(orderRef, limparObjeto(newOrder));
      return newOrder;
    });
  } catch (txErr: any) {
    console.warn('Aviso: Transação com incremento sequencial falhou, aplicando gravação direta resiliente:', txErr?.message || txErr);
    const nowIso = new Date().toISOString();
    const fallbackNumero = Math.floor(1000 + (Date.now() % 90000));
    const fallbackOrder: Order = {
      ...orderData,
      id: targetOrderId,
      numero: fallbackNumero,
      subtotal: calculatedSubtotal,
      taxaEntrega: calculatedDeliveryFee,
      taxaServico: calculatedServiceFee,
      desconto: calculatedDiscount,
      cupom: validatedCouponCode,
      total: calculatedTotal,
      itens: recalculatedItems,
      pagamento: {
        forma: orderData.pagamento.forma,
        status: safeInitialPaymentStatus,
        troco: orderData.pagamento.troco,
      },
      status: 'novo',
      criadoEm: nowIso,
      historicoStatus: [
        {
          status: 'novo',
          em: nowIso,
          nota: 'Pedido recebido e validado com sucesso pelo sistema',
        },
      ],
    };

    await setDoc(orderRef, limparObjeto(fallbackOrder));
    createdOrder = fallbackOrder;
  }

  return createdOrder;
}

export async function updateOrderStatusInFirestore(
  orderId: string,
  newStatus: OrderStatus,
  nota?: string,
  tempoEstimadoMin?: number
): Promise<void> {
  const docRef = doc(db, 'orders', orderId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    throw new Error('Pedido não encontrado para atualização.');
  }

  const order = snap.data() as Order;
  const currentStatus = order.status;

  // Se já estiver no status desejado, operação é idempotente
  if (currentStatus === newStatus) return;

  // Validar transição de status
  const allowedTransitions = VALID_ORDER_STATUS_TRANSITIONS[currentStatus] || [];
  if (!allowedTransitions.includes(newStatus)) {
    throw new Error(
      `Transição de status inválida: não é permitido alterar de "${currentStatus}" para "${newStatus}".`
    );
  }

  const historico = order.historicoStatus || [];
  historico.push({
    status: newStatus,
    em: new Date().toISOString(),
    nota: nota || (newStatus === 'aceito' ? 'Pedido aceito pela loja' : undefined),
  });

  const updateData: any = {
    status: newStatus,
    historicoStatus: historico,
  };

  if (tempoEstimadoMin !== undefined) {
    updateData.tempoEstimadoMin = tempoEstimadoMin;
  }
  if (newStatus === 'aceito' && !order.impressoAutomaticamenteEm) {
    updateData.impressoAutomaticamenteEm = new Date().toISOString();
  }
  if (newStatus === 'cancelado' && nota) {
    updateData.motivoCancelamento = nota;
  }

  await updateDoc(docRef, limparObjeto(updateData));

  // Contabilização automática e idempotente da Taxa Operacional por Pedido
  try {
    if (newStatus === 'entregue' || (order.tipo === 'retirada' && newStatus === 'pronto')) {
      const storeRef = doc(db, 'stores', order.storeId);
      const storeSnap = await getDoc(storeRef);
      if (storeSnap.exists()) {
        const store = storeSnap.data() as Store;
        await recordOrderOperationalFee({ ...order, status: newStatus }, store);
      }
    } else if (newStatus === 'cancelado') {
      await reverseOrderOperationalFee(order.id, nota || 'Pedido cancelado');
    }
  } catch (feeErr) {
    console.error('Aviso ao processar taxa operacional do pedido:', feeErr);
  }
}

export async function updateOrderPaymentStatusInFirestore(
  orderId: string,
  newPaymentStatus: PaymentStatus,
  nota?: string
): Promise<void> {
  const docRef = doc(db, 'orders', orderId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    throw new Error('Pedido não encontrado para atualização de pagamento.');
  }

  const order = snap.data() as Order;
  const currentPaymentStatus = order.pagamento?.status || 'aguardando';

  if (currentPaymentStatus === newPaymentStatus) return;

  const allowedTransitions = VALID_PAYMENT_STATUS_TRANSITIONS[currentPaymentStatus] || [];
  if (!allowedTransitions.includes(newPaymentStatus)) {
    throw new Error(
      `Transição de pagamento inválida: não é permitido alterar de "${currentPaymentStatus}" para "${newPaymentStatus}".`
    );
  }

  const historico = order.historicoStatus || [];
  historico.push({
    status: order.status,
    em: new Date().toISOString(),
    nota: nota || `Pagamento atualizado para: ${newPaymentStatus}`,
  });

  await updateDoc(
    docRef,
    limparObjeto({
      'pagamento.status': newPaymentStatus,
      historicoStatus: historico,
    })
  );

  // Se o pagamento do cliente foi confirmado, promover a taxa operacional para faturável ('pendente')
  if (newPaymentStatus === 'confirmado') {
    try {
      const promoted = await confirmOrderOperationalFee(orderId);
      if (!promoted && (order.status === 'entregue' || (order.tipo === 'retirada' && order.status === 'pronto'))) {
        const storeRef = doc(db, 'stores', order.storeId);
        const storeSnap = await getDoc(storeRef);
        if (storeSnap.exists()) {
          const storeData = storeSnap.data() as Store;
          await recordOrderOperationalFee(
            { ...order, pagamento: { ...order.pagamento, status: 'confirmado' } },
            storeData
          );
        }
      }
    } catch (feeErr) {
      console.warn('Aviso ao sincronizar taxa operacional após confirmação de pagamento:', feeErr);
    }
  }
}

export async function assignCourierInFirestore(orderId: string, courierId: string): Promise<void> {
  const docRef = doc(db, 'orders', orderId);
  if (courierId) {
    await updateDoc(docRef, limparObjeto({ entregadorId: courierId }));
  } else {
    await updateDoc(docRef, { entregadorId: deleteField() });
  }
}

export async function deleteTestOrdersFromFirestore(storeId: string): Promise<number> {
  try {
    const q = query(
      collection(db, 'orders'),
      where('storeId', '==', storeId),
      where('teste', '==', true)
    );
    const snap = await getDocs(q);
    if (snap.empty) return 0;

    const batch = writeBatch(db);
    snap.forEach((d) => {
      batch.delete(d.ref);
    });
    await batch.commit();
    return snap.size;
  } catch (error) {
    console.error('Erro ao excluir pedidos de teste:', error);
    throw error;
  }
}

export async function updateOrderInFirestore(
  orderId: string,
  partial: Partial<Order> | Record<string, any>
): Promise<void> {
  const docRef = doc(db, 'orders', orderId);
  await updateDoc(docRef, limparObjeto(partial) as any);
}

// ==========================================
// CATEGORIES (FIRESTORE)
// ==========================================
export function subscribeToCategoriesByStore(
  storeId: string,
  callback: (categories: Category[]) => void
): Unsubscribe {
  const colRef = collection(db, 'categories');
  const q = query(colRef, where('storeId', '==', storeId));
  return onSnapshot(
    q,
    (snap) => {
      const items: Category[] = [];
      snap.forEach((d) => items.push(d.data() as Category));
      items.sort((a, b) => a.ordem - b.ordem);
      callback(items);
    },
    (err) => {
      console.error('Erro ao buscar categorias:', err);
      callback([]);
    }
  );
}

export async function getCategoriesByStoreFromFirestore(storeId: string): Promise<Category[]> {
  try {
    const q = query(collection(db, 'categories'), where('storeId', '==', storeId));
    const snap = await getDocs(q);
    const items: Category[] = [];
    snap.forEach((d) => items.push(d.data() as Category));
    items.sort((a, b) => a.ordem - b.ordem);
    return items;
  } catch (err) {
    console.error('Erro ao buscar categorias no Firestore:', err);
    return [];
  }
}

export async function saveCategoryToFirestore(category: Category | Omit<Category, 'id'>): Promise<string> {
  const id = (category as Category).id || `cat_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  await setDoc(doc(db, 'categories', id), limparObjeto({ ...category, id }), { merge: true });
  return id;
}
export const createCategoryInFirestore = saveCategoryToFirestore;
export const updateCategoryInFirestore = (
  idOrCategory: string | Category,
  partial?: Partial<Category>
) => {
  if (typeof idOrCategory === 'string') {
    return updateDoc(doc(db, 'categories', idOrCategory), limparObjeto(partial || {}) as any);
  }
  return setDoc(doc(db, 'categories', idOrCategory.id), limparObjeto(idOrCategory), { merge: true });
};

export async function deleteCategoryFromFirestore(categoryId: string): Promise<void> {
  await deleteDoc(doc(db, 'categories', categoryId));
}
export const deleteCategoryInFirestore = deleteCategoryFromFirestore;

// ==========================================
// PRODUCTS (FIRESTORE)
// ==========================================
export function subscribeToProductsByStore(
  storeId: string,
  callback: (products: Product[]) => void
): Unsubscribe {
  const colRef = collection(db, 'products');
  const q = query(colRef, where('storeId', '==', storeId));
  return onSnapshot(
    q,
    (snap) => {
      const items: Product[] = [];
      snap.forEach((d) => items.push(d.data() as Product));
      items.sort((a, b) => a.ordem - b.ordem);
      callback(items);
    },
    (err) => {
      console.error('Erro ao buscar produtos:', err);
      callback([]);
    }
  );
}

export async function getProductsByStoreFromFirestore(storeId: string): Promise<Product[]> {
  try {
    const q = query(collection(db, 'products'), where('storeId', '==', storeId));
    const snap = await getDocs(q);
    const items: Product[] = [];
    snap.forEach((d) => items.push(d.data() as Product));
    items.sort((a, b) => a.ordem - b.ordem);
    return items;
  } catch (err) {
    console.error('Erro ao buscar produtos no Firestore:', err);
    return [];
  }
}

export async function saveProductToFirestore(product: Product | Omit<Product, 'id'>): Promise<string> {
  const id = (product as Product).id || `prod_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  await setDoc(doc(db, 'products', id), limparObjeto({ ...product, id }), { merge: true });
  return id;
}
export const createProductInFirestore = saveProductToFirestore;
export const updateProductInFirestore = (
  idOrProduct: string | Product,
  partial?: Partial<Product>
) => {
  if (typeof idOrProduct === 'string') {
    return updateDoc(doc(db, 'products', idOrProduct), limparObjeto(partial || {}) as any);
  }
  return setDoc(doc(db, 'products', idOrProduct.id), limparObjeto(idOrProduct), { merge: true });
};

export async function updateProductPhotoInFirestore(
  productId: string,
  photoUrl: string | null
): Promise<void> {
  const docRef = doc(db, 'products', productId);
  if (!photoUrl) {
    await updateDoc(docRef, { foto: deleteField() });
  } else {
    await updateDoc(docRef, limparObjeto({ foto: photoUrl }));
  }
}

export async function deleteProductFromFirestore(productId: string): Promise<void> {
  await deleteDoc(doc(db, 'products', productId));
}
export const deleteProductInFirestore = deleteProductFromFirestore;

// ==========================================
// OPTION GROUPS (FIRESTORE)
// ==========================================
export function subscribeToOptionGroupsByStore(
  storeId: string,
  callback: (groups: OptionGroup[]) => void
): Unsubscribe {
  const colRef = collection(db, 'option_groups');
  const q = query(colRef, where('storeId', '==', storeId));
  return onSnapshot(
    q,
    (snap) => {
      const items: OptionGroup[] = [];
      snap.forEach((d) => items.push(d.data() as OptionGroup));
      callback(items);
    },
    (err) => {
      console.error('Erro ao buscar grupos de adicionais:', err);
      callback([]);
    }
  );
}

export async function getOptionGroupsByStoreFromFirestore(storeId: string): Promise<OptionGroup[]> {
  try {
    const q = query(collection(db, 'option_groups'), where('storeId', '==', storeId));
    const snap = await getDocs(q);
    const items: OptionGroup[] = [];
    snap.forEach((d) => items.push(d.data() as OptionGroup));
    return items;
  } catch (err) {
    console.error('Erro ao buscar complementos no Firestore:', err);
    return [];
  }
}

export async function saveOptionGroupToFirestore(group: OptionGroup | Omit<OptionGroup, 'id'>): Promise<string> {
  const id = (group as OptionGroup).id || `opt_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  await setDoc(doc(db, 'option_groups', id), limparObjeto({ ...group, id }), { merge: true });
  return id;
}
export const createOptionGroupInFirestore = saveOptionGroupToFirestore;
export const updateOptionGroupInFirestore = (
  idOrGroup: string | OptionGroup,
  partial?: Partial<OptionGroup>
) => {
  if (typeof idOrGroup === 'string') {
    return updateDoc(doc(db, 'option_groups', idOrGroup), limparObjeto(partial || {}) as any);
  }
  return setDoc(doc(db, 'option_groups', idOrGroup.id), limparObjeto(idOrGroup), { merge: true });
};

export async function deleteOptionGroupFromFirestore(groupId: string): Promise<void> {
  await deleteDoc(doc(db, 'option_groups', groupId));
}
export const deleteOptionGroupInFirestore = deleteOptionGroupFromFirestore;

// ==========================================
// DELIVERY ZONES (FIRESTORE)
// ==========================================
export function subscribeToDeliveryZonesByStore(
  storeId: string,
  callback: (zones: DeliveryZone[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const colRef = collection(db, 'delivery_zones');
  const q = query(colRef, where('storeId', '==', storeId));
  return onSnapshot(
    q,
    (snap) => {
      const items: DeliveryZone[] = [];
      snap.forEach((d) => items.push(d.data() as DeliveryZone));
      callback(items);
    },
    (err) => {
      console.error('Erro ao buscar taxas de entrega:', err);
      if (onError) onError(err);
      callback([]);
    }
  );
}

export async function getDeliveryZonesByStoreFromFirestore(storeId: string): Promise<DeliveryZone[]> {
  try {
    const q = query(collection(db, 'delivery_zones'), where('storeId', '==', storeId));
    const snap = await getDocs(q);
    const items: DeliveryZone[] = [];
    snap.forEach((d) => items.push(d.data() as DeliveryZone));
    return items;
  } catch (err) {
    console.error('Erro ao buscar bairros de entrega no Firestore:', err);
    return [];
  }
}

export async function saveDeliveryZoneToFirestore(zone: DeliveryZone | Omit<DeliveryZone, 'id'>): Promise<string> {
  const id = (zone as DeliveryZone).id || `zone_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  await setDoc(doc(db, 'delivery_zones', id), limparObjeto({ ...zone, id }), { merge: true });
  return id;
}
export const createDeliveryZoneInFirestore = saveDeliveryZoneToFirestore;
export const updateDeliveryZoneInFirestore = (
  idOrZone: string | DeliveryZone,
  partial?: Partial<DeliveryZone>
) => {
  if (typeof idOrZone === 'string') {
    return updateDoc(doc(db, 'delivery_zones', idOrZone), limparObjeto(partial || {}) as any);
  }
  return setDoc(doc(db, 'delivery_zones', idOrZone.id), limparObjeto(idOrZone), { merge: true });
};

export async function deleteDeliveryZoneFromFirestore(zoneId: string): Promise<void> {
  await deleteDoc(doc(db, 'delivery_zones', zoneId));
}
export const deleteDeliveryZoneInFirestore = deleteDeliveryZoneFromFirestore;

// ==========================================
// COUPONS (FIRESTORE)
// ==========================================
export function subscribeToCouponsByStore(
  storeId: string,
  callback: (coupons: Coupon[]) => void
): Unsubscribe {
  const colRef = collection(db, 'coupons');
  const q = query(colRef, where('storeId', '==', storeId));
  return onSnapshot(
    q,
    (snap) => {
      const items: Coupon[] = [];
      snap.forEach((d) => items.push(d.data() as Coupon));
      callback(items);
    },
    (err) => {
      console.error('Erro ao buscar cupons:', err);
      callback([]);
    }
  );
}

export async function getCouponsByStoreFromFirestore(storeId: string): Promise<Coupon[]> {
  try {
    const q = query(collection(db, 'coupons'), where('storeId', '==', storeId));
    const snap = await getDocs(q);
    const items: Coupon[] = [];
    snap.forEach((d) => items.push(d.data() as Coupon));
    return items;
  } catch (err) {
    console.error('Erro ao buscar cupons no Firestore:', err);
    return [];
  }
}

export async function saveCouponToFirestore(coupon: Coupon | Omit<Coupon, 'id'>): Promise<string> {
  const id = (coupon as Coupon).id || `cp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  await setDoc(doc(db, 'coupons', id), limparObjeto({ ...coupon, id }), { merge: true });
  return id;
}
export const createCouponInFirestore = saveCouponToFirestore;
export const updateCouponInFirestore = saveCouponToFirestore;

export async function deleteCouponFromFirestore(couponId: string): Promise<void> {
  await deleteDoc(doc(db, 'coupons', couponId));
}
export const deleteCouponInFirestore = deleteCouponFromFirestore;

export async function validateCouponInFirestore(
  storeId: string,
  code: string,
  subtotal: number
): Promise<{ valid: boolean; coupon?: Coupon; discount: number; message: string }> {
  try {
    const cleanCode = code.trim().toUpperCase();
    const q = query(
      collection(db, 'coupons'),
      where('storeId', '==', storeId),
      where('codigo', '==', cleanCode),
      where('ativo', '==', true)
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      return { valid: false, discount: 0, message: 'Cupom inválido ou expirado.' };
    }
    const coupon = snap.docs[0].data() as Coupon;
    const min = coupon.pedidoMinimo || coupon.minimo || 0;
    if (min > 0 && subtotal < min) {
      return {
        valid: false,
        coupon,
        discount: 0,
        message: `Pedido mínimo para este cupom é R$ ${min.toFixed(2)}.`,
      };
    }
    let discount = 0;
    if (coupon.tipo === 'porcentagem' || coupon.tipo === 'percentual') {
      discount = (subtotal * coupon.valor) / 100;
    } else {
      discount = Math.min(coupon.valor, subtotal);
    }
    return { valid: true, coupon, discount, message: 'Cupom aplicado!' };
  } catch (err) {
    console.error('Erro ao validar cupom:', err);
    return { valid: false, discount: 0, message: 'Erro ao validar cupom.' };
  }
}

// ==========================================
// COURIERS (FIRESTORE)
// ==========================================
export function subscribeToCouriersByStore(
  storeId: string,
  callback: (couriers: Courier[]) => void
): Unsubscribe {
  const colRef = collection(db, 'couriers');
  const q = query(colRef, where('storeId', '==', storeId));
  return onSnapshot(
    q,
    (snap) => {
      const items: Courier[] = [];
      snap.forEach((d) => items.push(d.data() as Courier));
      callback(items);
    },
    (err) => {
      console.error('Erro ao buscar entregadores:', err);
      callback([]);
    }
  );
}

export async function getCouriersByStoreFromFirestore(storeId: string): Promise<Courier[]> {
  try {
    const q = query(collection(db, 'couriers'), where('storeId', '==', storeId));
    const snap = await getDocs(q);
    const items: Courier[] = [];
    snap.forEach((d) => items.push(d.data() as Courier));
    return items;
  } catch (err) {
    console.error('Erro ao buscar entregadores no Firestore:', err);
    return [];
  }
}

export async function saveCourierToFirestore(courier: Courier | Omit<Courier, 'id'>): Promise<string> {
  const id = (courier as Courier).id || `cour_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  await setDoc(doc(db, 'couriers', id), limparObjeto({ ...courier, id }), { merge: true });
  return id;
}
export const createCourierInFirestore = saveCourierToFirestore;
export const updateCourierInFirestore = saveCourierToFirestore;

export async function deleteCourierFromFirestore(courierId: string): Promise<void> {
  await deleteDoc(doc(db, 'couriers', courierId));
}
export const deleteCourierInFirestore = deleteCourierFromFirestore;

// ==========================================
// USERS (FIRESTORE)
// ==========================================
export async function getUserProfileFromFirestore(uid: string): Promise<UserProfile | null> {
  try {
    const docRef = doc(db, 'users', uid);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.error('Erro ao buscar perfil do usuário no Firestore:', error);
    return null;
  }
}

export async function getUserProfileByEmail(email: string): Promise<UserProfile | null> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const q = query(collection(db, 'users'), where('email', '==', cleanEmail));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs[0].data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.error('Erro ao buscar perfil por e-mail:', error);
    return null;
  }
}

export async function getUserProfileByStoreId(storeId: string): Promise<UserProfile | null> {
  try {
    const q = query(collection(db, 'users'), where('storeId', '==', storeId));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs[0].data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.error('Erro ao buscar perfil por storeId:', error);
    return null;
  }
}

export function subscribeToAllUsers(callback: (users: UserProfile[]) => void): Unsubscribe {
  const colRef = collection(db, 'users');
  return onSnapshot(
    colRef,
    (snap) => {
      const list = snap.docs.map((d) => d.data() as UserProfile);
      callback(list);
    },
    (err) => {
      console.warn('Erro ao escutar usuários:', err);
      callback([]);
    }
  );
}

export async function updateUserStatusInFirestore(uid: string, ativo: boolean): Promise<void> {
  const docRef = doc(db, 'users', uid);
  await updateDoc(docRef, { ativo, atualizadoEm: new Date().toISOString() });
}

/**
 * Atualiza o registro de atualização do perfil sem persistir senhas em texto puro.
 */
export async function updateUserPasswordInFirestore(uid: string, _novaSenha?: string): Promise<void> {
  const docRef = doc(db, 'users', uid);
  await updateDoc(docRef, {
    atualizadoEm: new Date().toISOString(),
  });
}

export interface PasswordCleanupScanResult {
  storesWithPasswords: { id: string; nome: string; hasSenha: boolean; hasSenhaTemporaria: boolean }[];
  usersWithPasswords: { uid: string; email: string; hasSenha: boolean; hasSenhaTemporaria: boolean }[];
}

export interface PasswordCleanupExecutionResult {
  storesCleaned: number;
  usersCleaned: number;
  totalCleaned: number;
  errors: string[];
}

/**
 * Realiza uma varredura NÃO destrutiva no Firestore identificando documentos com campos legados de senha.
 */
export async function scanLegacyPasswordsInFirestore(): Promise<PasswordCleanupScanResult> {
  const result: PasswordCleanupScanResult = {
    storesWithPasswords: [],
    usersWithPasswords: [],
  };

  try {
    const storesSnap = await getDocs(collection(db, 'stores'));
    storesSnap.forEach((d) => {
      const data = d.data();
      if (data.senha || data.senhaTemporaria) {
        result.storesWithPasswords.push({
          id: d.id,
          nome: data.nome || d.id,
          hasSenha: Boolean(data.senha),
          hasSenhaTemporaria: Boolean(data.senhaTemporaria),
        });
      }
    });

    const usersSnap = await getDocs(collection(db, 'users'));
    usersSnap.forEach((d) => {
      const data = d.data();
      if (data.senha || data.senhaTemporaria) {
        result.usersWithPasswords.push({
          uid: d.id,
          email: data.email || d.id,
          hasSenha: Boolean(data.senha),
          hasSenhaTemporaria: Boolean(data.senhaTemporaria),
        });
      }
    });
  } catch (err) {
    console.error('Erro na varredura de senhas legadas:', err);
  }

  return result;
}

/**
 * Executa a remoção segura dos campos legados de senha usando deleteField() do Firestore.
 * Não altera dados cadastrais, pedidos ou funcionamento das lojas.
 */
export async function executeLegacyPasswordCleanup(): Promise<PasswordCleanupExecutionResult> {
  const result: PasswordCleanupExecutionResult = {
    storesCleaned: 0,
    usersCleaned: 0,
    totalCleaned: 0,
    errors: [],
  };

  try {
    const scan = await scanLegacyPasswordsInFirestore();

    for (const s of scan.storesWithPasswords) {
      try {
        const storeRef = doc(db, 'stores', s.id);
        await updateDoc(storeRef, {
          senha: deleteField(),
          senhaTemporaria: deleteField(),
        });
        result.storesCleaned += 1;
      } catch (err: any) {
        result.errors.push(`Erro na loja ${s.id}: ${err.message || err}`);
      }
    }

    for (const u of scan.usersWithPasswords) {
      try {
        const userRef = doc(db, 'users', u.uid);
        await updateDoc(userRef, {
          senha: deleteField(),
          senhaTemporaria: deleteField(),
        });
        result.usersCleaned += 1;
      } catch (err: any) {
        result.errors.push(`Erro no usuário ${u.uid}: ${err.message || err}`);
      }
    }

    result.totalCleaned = result.storesCleaned + result.usersCleaned;
  } catch (err: any) {
    result.errors.push(`Falha geral na migração: ${err.message || err}`);
  }

  return result;
}

export async function updateUserProfileInFirestore(uid: string, data: Partial<UserProfile>): Promise<void> {
  const docRef = doc(db, 'users', uid);
  await updateDoc(docRef, limparObjeto({ ...data, atualizadoEm: new Date().toISOString() }));
}

export async function saveUserProfileToFirestore(user: UserProfile): Promise<void> {
  const docRef = doc(db, 'users', user.uid);
  // Proteção: Nunca salvar senhas em texto puro no perfil do Firestore
  const { senha, senhaTemporaria, ...safeUser } = user as any;
  const dataToSave = {
    ...safeUser,
    ativo: user.ativo !== undefined ? user.ativo : true,
    atualizadoEm: new Date().toISOString(),
  };
  await setDoc(docRef, limparObjeto(dataToSave), { merge: true });
}

export function subscribeToSaasPaymentRequestsByStore(
  storeId: string,
  callback: (reqs: SaasPaymentRequest[]) => void
): Unsubscribe {
  const q = query(collection(db, 'saas_payment_requests'), where('storeId', '==', storeId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as SaasPaymentRequest));
      list.sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());
      callback(list);
    },
    (err) => {
      console.warn('Erro ao escutar solicitações da loja:', err);
      callback([]);
    }
  );
}

// ==========================================
// SAAS CONFIG (FIRESTORE)
// ==========================================
const DEFAULT_SAAS_CONFIG: SaasConfig = {
  precoPlanoStarter: 49.9,
  precoPlanoPro: 99.9,
  pixSuperAdmin: 'saas.pagamentos@pedeai.com.br',
  pixTipoChave: 'email',
  nomeRecebedor: 'PEDE AI PLATAFORMA',
  cidade: 'MANAUS',
  whatsappSuporte: SUPPORT_WHATSAPP,
  planos: {
    iniciante: { preco: 49.9, diasTrial: 7, maxProdutos: 50 },
    pro: { preco: 99.9, diasTrial: 7, maxProdutos: 250 },
    ilimitado: { preco: 179.9, diasTrial: 7, maxProdutos: 9999 },
  },
};

export async function getSaasConfigFromFirestore(): Promise<SaasConfig> {
  try {
    const platRef = doc(db, 'config', 'plataforma');
    const snapPlat = await getDoc(platRef);
    if (snapPlat.exists()) {
      return snapPlat.data() as SaasConfig;
    }
    const docRef = doc(db, 'saas_config', 'global');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as SaasConfig;
    }
    await setDoc(platRef, limparObjeto(DEFAULT_SAAS_CONFIG), { merge: true });
    await setDoc(docRef, limparObjeto(DEFAULT_SAAS_CONFIG), { merge: true });
    return DEFAULT_SAAS_CONFIG;
  } catch (err) {
    console.error('Erro ao buscar config do SaaS no Firestore:', err);
    return DEFAULT_SAAS_CONFIG;
  }
}

export async function saveSaasConfigToFirestore(config: SaasConfig): Promise<void> {
  const docRef = doc(db, 'saas_config', 'global');
  const platRef = doc(db, 'config', 'plataforma');
  const cleanConfig = limparObjeto(config);
  await Promise.all([
    setDoc(docRef, cleanConfig, { merge: true }),
    setDoc(platRef, cleanConfig, { merge: true }),
  ]);
}

export function subscribeToSaasConfig(callback: (config: SaasConfig) => void): Unsubscribe {
  const platRef = doc(db, 'config', 'plataforma');
  return onSnapshot(
    platRef,
    (snap) => {
      if (snap.exists()) {
        callback(snap.data() as SaasConfig);
      } else {
        const docRef = doc(db, 'saas_config', 'global');
        getDoc(docRef).then((s) => {
          if (s.exists()) {
            callback(s.data() as SaasConfig);
          } else {
            callback(DEFAULT_SAAS_CONFIG);
          }
        });
      }
    },
    (err) => {
      console.error('Erro no snapshot do SaaS Config:', err);
      callback(DEFAULT_SAAS_CONFIG);
    }
  );
}

// ==========================================
// STORE PAYMENTS & FINANCIAL CONTROL
// ==========================================
export async function addStorePaymentInFirestore(payment: Omit<StorePayment, 'id' | 'registradoEm'>): Promise<string> {
  const id = `pay_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const registradoEm = new Date().toISOString();
  const paymentRef = doc(db, 'stores', payment.storeId, 'pagamentos', id);

  const fullPayment: StorePayment = {
    ...payment,
    id,
    registradoEm,
  };

  await setDoc(paymentRef, limparObjeto(fullPayment));

  // Se o pagamento for do tipo mensalidade, prorrogar vencimento por +30 dias e ativar a loja
  if (payment.tipo === 'mensalidade') {
    const storeRef = doc(db, 'stores', payment.storeId);
    const snap = await getDoc(storeRef);
    if (snap.exists()) {
      const storeData = snap.data() as Store;
      let baseDate = new Date();
      if (storeData.dataVencimento) {
        const curVence = new Date(storeData.dataVencimento);
        if (!isNaN(curVence.getTime()) && curVence > new Date()) {
          baseDate = curVence;
        }
      }
      baseDate.setDate(baseDate.getDate() + 30);

      await updateDoc(storeRef, limparObjeto({
        dataVencimento: baseDate.toISOString(),
        status: 'ativa',
      }));
    }
  }

  return id;
}

export function subscribeToStorePayments(storeId: string, callback: (payments: StorePayment[]) => void): Unsubscribe {
  const colRef = collection(db, 'stores', storeId, 'pagamentos');
  return onSnapshot(
    colRef,
    (snap) => {
      const list: StorePayment[] = [];
      snap.forEach((d) => list.push(d.data() as StorePayment));
      list.sort((a, b) => new Date(b.registradoEm).getTime() - new Date(a.registradoEm).getTime());
      callback(list);
    },
    (err) => {
      console.error('Erro ao buscar pagamentos da loja:', err);
      callback([]);
    }
  );
}

// ==========================================
// SAAS PAYMENT CONFIRMATION REQUESTS ("JÁ PAGUEI")
// ==========================================
export async function createSaasPaymentRequestInFirestore(
  reqData: Omit<SaasPaymentRequest, 'id' | 'criadoEm' | 'status'>
): Promise<string> {
  const id = `req_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const reqRef = doc(db, 'saas_payment_requests', id);

  const newReq: SaasPaymentRequest = {
    ...reqData,
    id,
    status: 'pendente',
    criadoEm: new Date().toISOString(),
  };

  await setDoc(reqRef, limparObjeto(newReq));
  return id;
}

export function subscribeToSaasPaymentRequests(
  callback: (requests: SaasPaymentRequest[]) => void
): Unsubscribe {
  const colRef = collection(db, 'saas_payment_requests');
  return onSnapshot(
    colRef,
    (snap) => {
      const list: SaasPaymentRequest[] = [];
      snap.forEach((d) => list.push(d.data() as SaasPaymentRequest));
      list.sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());
      callback(list);
    },
    (err) => {
      console.error('Erro ao buscar solicitações de confirmação de pagamento:', err);
      callback([]);
    }
  );
}

export async function updateSaasPaymentRequestStatusInFirestore(
  reqId: string,
  newStatus: 'aprovado' | 'rejeitado',
  analisadoPor?: string
): Promise<void> {
  const reqRef = doc(db, 'saas_payment_requests', reqId);
  const snap = await getDoc(reqRef);
  if (!snap.exists()) return;

  const reqData = snap.data() as SaasPaymentRequest;

  await updateDoc(reqRef, limparObjeto({
    status: newStatus,
    analisadoEm: new Date().toISOString(),
    analisadoPor: analisadoPor || 'superadmin',
  }));

  // Se foi aprovado, automaticamente lança um pagamento do tipo mensalidade na loja
  if (newStatus === 'aprovado') {
    await addStorePaymentInFirestore({
      storeId: reqData.storeId,
      storeNome: reqData.storeNome,
      tipo: 'mensalidade',
      valor: reqData.valor,
      data: new Date().toISOString().slice(0, 10),
      forma: 'pix',
      observacao: `Aprovado via confirmação "Já Paguei" (TXID: ${reqData.txid || 'N/A'})`,
      registradoPor: analisadoPor || 'superadmin',
    });
  }
}
