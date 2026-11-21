import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { MenuItem } from '../data/menu';
import type { CustomizedMealSelection } from '../types/bananaLeaf';

export interface CartItem extends MenuItem {
  cartItemId?: string;
  customization?: CustomizedMealSelection;
  plateQuantity?: number;
  includedDishes?: { dishId: string; dishName: string; dishNameTa: string }[];
}

export interface FoodQuantity {
  dishId: string;
  dishName: string; // canonical English name (snapshot)
  quantity: number; // in kg
  unit: 'kg';
}

interface CartContextType {
  cartItems: CartItem[];
  guestCount: number | null;
  setGuestCount: (count: number | null) => void;
  addItem: (
    item: MenuItem,
    customization?: CustomizedMealSelection,
    extra?: { plateQuantity?: number; includedDishes?: { dishId: string; dishName: string; dishNameTa: string }[] }
  ) => void;
  updateCustomization: (cartItemId: string, customization: CustomizedMealSelection) => void;
  updatePlateQuantity: (cartItemId: string, quantity: number) => void;
  removeItem: (idOrCartItemId: string) => void;
  clearCart: () => void;
  totalItems: number;
  isCartDrawerOpen: boolean;
  setIsCartDrawerOpen: (isOpen: boolean) => void;
  isRiceSuggestionOpen: boolean;
  setIsRiceSuggestionOpen: (isOpen: boolean) => void;
  // Food quantity (kg) management
  foodQuantities: FoodQuantity[];
  addFoodQuantity: (q: FoodQuantity) => void;
  updateFoodQuantity: (dishId: string, quantity: number) => void;
  removeFoodQuantity: (dishId: string) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [guestCount, setGuestCountState] = useState<number | null>(null);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  const [isRiceSuggestionOpen, setIsRiceSuggestionOpen] = useState(false);
  const [foodQuantities, setFoodQuantities] = useState<FoodQuantity[]>([]);

  const setGuestCount = useCallback((count: number | null) => {
    setGuestCountState(count);
  }, []);

  const addItem = useCallback(
    (
      item: MenuItem,
      customization?: CustomizedMealSelection,
      extra?: { plateQuantity?: number; includedDishes?: { dishId: string; dishName: string; dishNameTa: string }[] }
    ) => {
      setCartItems((prev) => {
        const cartItemId = customization
          ? `${item.id}-${customization.customizationId}`
          : item.id;

        const existingIndex = prev.findIndex(
          (i) => (i.cartItemId || i.id) === cartItemId
        );

        if (existingIndex !== -1) {
          // If item already in cart has plateQuantity or extra specifies plateQuantity, increment plate quantity
          if (extra?.plateQuantity || prev[existingIndex].plateQuantity) {
            return prev.map((it, idx) =>
              idx === existingIndex
                ? { ...it, plateQuantity: (it.plateQuantity || 1) + 1 }
                : it
            );
          }
          return prev;
        }

        // Trigger recommendation ONLY for the plain dish "Rice" when added without meal customization
        const isRice = !customization && (item.id === 'ms2' || item.name.trim().toLowerCase() === 'rice');
        if (isRice) {
          setIsRiceSuggestionOpen(true);
        }

        const newCartItem: CartItem = {
          ...item,
          cartItemId,
          customization,
          plateQuantity: extra?.plateQuantity,
          includedDishes: extra?.includedDishes,
        };

        return [...prev, newCartItem];
      });
    },
    []
  );

  const updatePlateQuantity = useCallback((cartItemId: string, quantity: number) => {
    setCartItems((prev) => {
      if (quantity <= 0) {
        return prev.filter((item) => (item.cartItemId || item.id) !== cartItemId);
      }
      return prev.map((item) => {
        if ((item.cartItemId || item.id) === cartItemId) {
          return {
            ...item,
            plateQuantity: quantity,
          };
        }
        return item;
      });
    });
  }, []);

  const updateCustomization = useCallback((oldCartItemId: string, customization: CustomizedMealSelection) => {
    setCartItems((prev) => {
      return prev.map((item) => {
        if ((item.cartItemId || item.id) === oldCartItemId) {
          const newCartItemId = `${item.id}-${customization.customizationId}`;
          return {
            ...item,
            cartItemId: newCartItemId,
            customization,
          };
        }
        return item;
      });
    });
  }, []);

  const removeItem = useCallback((idOrCartItemId: string) => {
    setCartItems((prev) => prev.filter((item) => {
      const itemKey = item.cartItemId || item.id;
      return itemKey !== idOrCartItemId;
    }));
    setFoodQuantities((prev) => prev.filter((fq) => fq.dishId !== idOrCartItemId));
  }, []);

  const clearCart = useCallback(() => {
    setCartItems([]);
    setFoodQuantities([]);
  }, []);

  const addFoodQuantity = useCallback((q: FoodQuantity) => {
    setFoodQuantities((prev) => {
      const exists = prev.find((fq) => fq.dishId === q.dishId);
      if (exists) {
        return prev.map((fq) => fq.dishId === q.dishId ? { ...fq, quantity: q.quantity } : fq);
      }
      return [...prev, q];
    });
  }, []);

  const updateFoodQuantity = useCallback((dishId: string, quantity: number) => {
    setFoodQuantities((prev) =>
      prev.map((fq) => fq.dishId === dishId ? { ...fq, quantity } : fq)
    );
  }, []);

  const removeFoodQuantity = useCallback((dishId: string) => {
    setFoodQuantities((prev) => prev.filter((fq) => fq.dishId !== dishId));
  }, []);

  const totalItems = cartItems.length;

  return (
    <CartContext.Provider
      value={{
        cartItems,
        guestCount,
        setGuestCount,
        addItem,
        updateCustomization,
        updatePlateQuantity,
        removeItem,
        clearCart,
        totalItems,
        isCartDrawerOpen,
        setIsCartDrawerOpen,
        isRiceSuggestionOpen,
        setIsRiceSuggestionOpen,
        foodQuantities,
        addFoodQuantity,
        updateFoodQuantity,
        removeFoodQuantity,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
