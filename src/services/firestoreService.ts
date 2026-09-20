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
import {
  Store,
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
  StorePayment,
  SaasPaymentRequest,
} from '../types';

// ==========================================
// ANONYMOUS AUTH HELPER FOR CUSTOMERS
// ==========================================
export async function ensureAnonymousCustomerAuth(): Promise<string> {
  if (auth.currentUser) {
    return auth.currentUser.uid;
  }
  try {
    const cred = await signInAnonymously(auth);
    return cred.user.uid;
  } catch (err) {
    console.warn('Login anônimo do Firebase indisponível, gerando UID de sessão:', err);
    let anon = localStorage.getItem('delivery_customer_anon_uid');
    if (!anon) {
      anon = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('delivery_customer_anon_uid', anon);
    }
    return anon;
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

export async function getStoreBySlugFromFirestore(slug: string): Promise<Store | null> {
  try {
    const q = query(collection(db, 'stores'), where('slug', '==', slug.toLowerCase()));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs[0].data() as Store;
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
  const q = query(collection(db, 'stores'), where('slug', '==', slug.toLowerCase()));
  return onSnapshot(
    q,
    (snap) => {
      if (!snap.empty) {
        callback(snap.docs[0].data() as Store);
      } else {
        callback(null);
      }
    },
    (err) => {
      console.error('Erro no snapshot de store por slug:', err);
    }
  );
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
  await setDoc(docRef, store, { merge: true });
}
export const saveStoreInFirestore = saveStoreToFirestore;

export async function updateStoreStatusInFirestore(storeId: string, aberta: boolean): Promise<void> {
  const docRef = doc(db, 'stores', storeId);
  await updateDoc(docRef, { aberta });
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

export function subscribeToOrderById(
  orderId: string,
  callback: (order: Order | null) => void
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

export async function createOrderInFirestore(
  orderData: Omit<Order, 'id' | 'numero' | 'criadoEm' | 'historicoStatus'>
): Promise<Order> {
  const storeRef = doc(db, 'stores', orderData.storeId);
  const newOrderId = `ord_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const orderRef = doc(db, 'orders', newOrderId);

  // Executar transação atômica para ler e incrementar nextOrderNumber da loja
  let nextNumber = 1;
  try {
    nextNumber = await runTransaction(db, async (transaction) => {
      const storeDoc = await transaction.get(storeRef);
      let currentNumber = 1;
      if (storeDoc.exists()) {
        const sData = storeDoc.data() as Store;
        currentNumber = typeof sData.nextOrderNumber === 'number' && sData.nextOrderNumber > 0 ? sData.nextOrderNumber : 1;
      }
      transaction.update(storeRef, { nextOrderNumber: currentNumber + 1 });
      return currentNumber;
    });
  } catch (tError) {
    console.warn('Aviso na transação de numeração de pedido, calculando fallback:', tError);
    // Fallback caso a transação falhe (ex: doc de loja não encontrado ou permissão)
    const storeSnap = await getDoc(storeRef);
    if (storeSnap.exists()) {
      const sData = storeSnap.data() as Store;
      nextNumber = typeof sData.nextOrderNumber === 'number' && sData.nextOrderNumber > 0 ? sData.nextOrderNumber : 1;
      await updateDoc(storeRef, { nextOrderNumber: nextNumber + 1 }).catch(() => {});
    }
  }

  const nowIso = new Date().toISOString();
  const newOrder: Order = {
    ...orderData,
    id: newOrderId,
    numero: nextNumber,
    criadoEm: nowIso,
    historicoStatus: [
      {
        status: orderData.status,
        em: nowIso,
        nota: 'Pedido recebido pelo sistema',
      },
    ],
  };

  await setDoc(orderRef, newOrder);
  return newOrder;
}

export async function updateOrderStatusInFirestore(
  orderId: string,
  newStatus: OrderStatus,
  nota?: string,
  tempoEstimadoMin?: number
): Promise<void> {
  const docRef = doc(db, 'orders', orderId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return;

  const order = snap.data() as Order;
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
  if (newStatus === 'cancelado' && nota) {
    updateData.motivoCancelamento = nota;
  }

  await updateDoc(docRef, updateData);
}

export async function updateOrderPaymentStatusInFirestore(
  orderId: string,
  newPaymentStatus: PaymentStatus,
  nota?: string
): Promise<void> {
  const docRef = doc(db, 'orders', orderId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return;

  const order = snap.data() as Order;
  const historico = order.historicoStatus || [];
  historico.push({
    status: order.status,
    em: new Date().toISOString(),
    nota: nota || `Pagamento atualizado para: ${newPaymentStatus}`,
  });

  await updateDoc(docRef, {
    'pagamento.status': newPaymentStatus,
    historicoStatus: historico,
  });
}

export async function assignCourierInFirestore(orderId: string, courierId: string): Promise<void> {
  const docRef = doc(db, 'orders', orderId);
  await updateDoc(docRef, { entregadorId: courierId });
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
  await updateDoc(docRef, partial as any);
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
  await setDoc(doc(db, 'categories', id), { ...category, id }, { merge: true });
  return id;
}
export const createCategoryInFirestore = saveCategoryToFirestore;
export const updateCategoryInFirestore = (
  idOrCategory: string | Category,
  partial?: Partial<Category>
) => {
  if (typeof idOrCategory === 'string') {
    return updateDoc(doc(db, 'categories', idOrCategory), (partial || {}) as any);
  }
  return setDoc(doc(db, 'categories', idOrCategory.id), idOrCategory, { merge: true });
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
  await setDoc(doc(db, 'products', id), { ...product, id }, { merge: true });
  return id;
}
export const createProductInFirestore = saveProductToFirestore;
export const updateProductInFirestore = (
  idOrProduct: string | Product,
  partial?: Partial<Product>
) => {
  if (typeof idOrProduct === 'string') {
    return updateDoc(doc(db, 'products', idOrProduct), (partial || {}) as any);
  }
  return setDoc(doc(db, 'products', idOrProduct.id), idOrProduct, { merge: true });
};

export async function updateProductPhotoInFirestore(
  productId: string,
  photoUrl: string | null
): Promise<void> {
  const docRef = doc(db, 'products', productId);
  if (!photoUrl) {
    await updateDoc(docRef, { foto: deleteField() });
  } else {
    await updateDoc(docRef, { foto: photoUrl });
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
  await setDoc(doc(db, 'option_groups', id), { ...group, id }, { merge: true });
  return id;
}
export const createOptionGroupInFirestore = saveOptionGroupToFirestore;
export const updateOptionGroupInFirestore = (
  idOrGroup: string | OptionGroup,
  partial?: Partial<OptionGroup>
) => {
  if (typeof idOrGroup === 'string') {
    return updateDoc(doc(db, 'option_groups', idOrGroup), (partial || {}) as any);
  }
  return setDoc(doc(db, 'option_groups', idOrGroup.id), idOrGroup, { merge: true });
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
  callback: (zones: DeliveryZone[]) => void
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
  await setDoc(doc(db, 'delivery_zones', id), { ...zone, id }, { merge: true });
  return id;
}
export const createDeliveryZoneInFirestore = saveDeliveryZoneToFirestore;
export const updateDeliveryZoneInFirestore = (
  idOrZone: string | DeliveryZone,
  partial?: Partial<DeliveryZone>
) => {
  if (typeof idOrZone === 'string') {
    return updateDoc(doc(db, 'delivery_zones', idOrZone), (partial || {}) as any);
  }
  return setDoc(doc(db, 'delivery_zones', idOrZone.id), idOrZone, { merge: true });
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
  await setDoc(doc(db, 'coupons', id), { ...coupon, id }, { merge: true });
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
  await setDoc(doc(db, 'couriers', id), { ...courier, id }, { merge: true });
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

export async function saveUserProfileToFirestore(user: UserProfile): Promise<void> {
  const docRef = doc(db, 'users', user.uid);
  await setDoc(docRef, user, { merge: true });
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
    await setDoc(platRef, DEFAULT_SAAS_CONFIG, { merge: true });
    await setDoc(docRef, DEFAULT_SAAS_CONFIG, { merge: true });
    return DEFAULT_SAAS_CONFIG;
  } catch (err) {
    console.error('Erro ao buscar config do SaaS no Firestore:', err);
    return DEFAULT_SAAS_CONFIG;
  }
}

export async function saveSaasConfigToFirestore(config: SaasConfig): Promise<void> {
  const docRef = doc(db, 'saas_config', 'global');
  const platRef = doc(db, 'config', 'plataforma');
  await Promise.all([
    setDoc(docRef, config, { merge: true }),
    setDoc(platRef, config, { merge: true }),
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

  await setDoc(paymentRef, fullPayment);

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

      await updateDoc(storeRef, {
        dataVencimento: baseDate.toISOString(),
        status: 'ativa',
      });
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

  await setDoc(reqRef, newReq);
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

  await updateDoc(reqRef, {
    status: newStatus,
    analisadoEm: new Date().toISOString(),
    analisadoPor: analisadoPor || 'superadmin',
  });

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
