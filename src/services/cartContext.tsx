import React, { createContext, useContext, useState, useEffect } from 'react';
import { OrderItem, Coupon, DeliveryZone } from '../types';
import { validateCouponInFirestore } from './firestoreService';

interface CartContextType {
  items: OrderItem[];
  addItem: (item: Omit<OrderItem, 'id'>) => void;
  updateQuantity: (itemId: string, delta: number) => void;
  removeItem: (itemId: string) => void;
  clearCart: () => void;
  appliedCoupon: Coupon | null;
  couponDiscount: number;
  applyCouponCode: (code: string) => Promise<{ success: boolean; message: string }>;
  removeCoupon: () => void;
  selectedZone: DeliveryZone | null;
  setSelectedZone: (zone: DeliveryZone | null) => void;
  orderType: 'entrega' | 'retirada';
  setOrderType: (type: 'entrega' | 'retirada') => void;
  subtotal: number;
  deliveryFee: number;
  total: number;
  totalItemsCount: number;
  storeSlug: string;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ storeId: string; storeSlug: string; children: React.ReactNode }> = ({
  storeId,
  storeSlug,
  children,
}) => {
  const storageKey = `delivery_cart_${storeId}`;

  const [items, setItems] = useState<OrderItem[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponDiscount, setCouponDiscount] = useState<number>(0);
  const [selectedZone, setSelectedZone] = useState<DeliveryZone | null>(null);
  const [orderType, setOrderType] = useState<'entrega' | 'retirada'>('entrega');

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch (err) {
      console.error('Erro ao persistir carrinho no storage local de preferência:', err);
    }
  }, [items, storageKey]);

  // Recalcular subtotal
  const subtotal = items.reduce((acc, it) => acc + it.totalItem, 0);

  // Recalcular desconto caso o subtotal mude
  useEffect(() => {
    if (appliedCoupon) {
      let isMounted = true;
      validateCouponInFirestore(storeId, appliedCoupon.codigo, subtotal).then((res) => {
        if (!isMounted) return;
        if (res.valid) {
          setCouponDiscount(res.discount);
        } else {
          setAppliedCoupon(null);
          setCouponDiscount(0);
        }
      });
      return () => {
        isMounted = false;
      };
    } else {
      setCouponDiscount(0);
    }
  }, [subtotal, appliedCoupon?.codigo, storeId]);

  const deliveryFee = orderType === 'entrega' ? (selectedZone ? selectedZone.taxa : 0) : 0;
  const total = Math.max(0, subtotal - couponDiscount + deliveryFee);
  const totalItemsCount = items.reduce((acc, it) => acc + it.qtd, 0);

  const addItem = (item: Omit<OrderItem, 'id'>) => {
    const newItem: OrderItem = {
      ...item,
      id: `ci_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    };
    setItems((prev) => [...prev, newItem]);
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((it) => {
          if (it.id === itemId) {
            const newQtd = it.qtd + delta;
            if (newQtd <= 0) return null;
            const singleUnitPrice = it.totalItem / it.qtd;
            return {
              ...it,
              qtd: newQtd,
              totalItem: singleUnitPrice * newQtd,
            };
          }
          return it;
        })
        .filter(Boolean) as OrderItem[]
    );
  };

  const removeItem = (itemId: string) => {
    setItems((prev) => prev.filter((it) => it.id !== itemId));
  };

  const clearCart = () => {
    setItems([]);
    setAppliedCoupon(null);
    setCouponDiscount(0);
    localStorage.removeItem(storageKey);
  };

  const applyCouponCode = async (code: string): Promise<{ success: boolean; message: string }> => {
    const res = await validateCouponInFirestore(storeId, code, subtotal);
    if (res.valid && res.coupon) {
      setAppliedCoupon(res.coupon);
      setCouponDiscount(res.discount);
      return { success: true, message: res.message };
    }
    return { success: false, message: res.message };
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponDiscount(0);
  };

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        appliedCoupon,
        couponDiscount,
        applyCouponCode,
        removeCoupon,
        selectedZone,
        setSelectedZone,
        orderType,
        setOrderType,
        subtotal,
        deliveryFee,
        total,
        totalItemsCount,
        storeSlug,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart deve ser usado dentro de um CartProvider');
  }
  return context;
};
