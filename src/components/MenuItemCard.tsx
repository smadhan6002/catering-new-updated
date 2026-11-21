import React, { useState } from 'react';
import type { MenuItem } from '../data/menu';
import { useCart } from '../context/CartContext';
import { useLanguage } from '../context/LanguageContext';
import { Check, Plus, Sparkles, Utensils } from 'lucide-react';
import { bananaLeafService } from '../services/bananaLeafService';
import { BananaLeafCustomizerModal } from './BananaLeafCustomizerModal';
import type { CustomizedMealSelection } from '../types/bananaLeaf';
import { isNormalMeals, NORMAL_MEALS_DEFAULT_ITEMS } from '../data/normalMeals';

interface MenuItemCardProps {
  item: MenuItem;
}

export const MenuItemCard: React.FC<MenuItemCardProps> = ({ item }) => {
  const { cartItems, addItem } = useCart();
  const { dishName, t, lang } = useLanguage();
  const isTa = lang === 'ta';

  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [showNormalToast, setShowNormalToast] = useState(false);

  const isBananaLeaf = bananaLeafService.isBananaLeafMeals(item.id);
  const isNormal = isNormalMeals(item.id) || isNormalMeals(item.name);
  const itemsInCart = cartItems.filter((i) => (i.cartItemId || i.id) === item.id || i.id === item.id);
  const isAdded = itemsInCart.length > 0;

  const handleAction = () => {
    if (isBananaLeaf) {
      setIsCustomizerOpen(true);
    } else if (isNormal) {
      addItem(item, undefined, {
        plateQuantity: 1,
        includedDishes: NORMAL_MEALS_DEFAULT_ITEMS,
      });
      setShowNormalToast(true);
      setTimeout(() => setShowNormalToast(false), 3000);
    } else if (!isAdded) {
      addItem(item);
    }
  };

  const handleCustomizationConfirm = (customization: CustomizedMealSelection) => {
    addItem(item, customization);
    setIsCustomizerOpen(false);
  };

  const displayName = dishName(item.id, item.name);

  return (
    <>
      {/* Small success confirmation toast for Normal Meals */}
      {showNormalToast && (
        <div className="fixed top-5 right-5 z-[350] bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs sm:text-sm animate-in fade-in slide-in-from-top-2 border border-slate-700">
          <Check size={18} className="text-green-400 flex-shrink-0" />
          <span className="font-semibold">
            {isTa ? 'சாதாரண சாப்பாடு கார்ட்டில் சேர்க்கப்பட்டது!' : 'Normal Meals added successfully!'}
          </span>
        </div>
      )}

      <div className={`bg-white rounded-2xl overflow-hidden shadow-xs hover:shadow-md border transition-all duration-200 flex flex-col group ${
        isBananaLeaf
          ? 'border-emerald-300 hover:border-emerald-500 ring-1 ring-emerald-100'
          : isNormal
          ? 'border-orange-300 hover:border-orange-500 ring-1 ring-orange-100'
          : 'border-slate-200 hover:border-orange-300'
      }`}>
        {/* Dish Image */}
        <div className="relative w-full aspect-[4/3] bg-slate-100 overflow-hidden">
          <img
            src={item.image}
            alt={displayName}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
          {isBananaLeaf && (
            <span className="absolute top-2 left-2 z-10 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-700/90 text-white backdrop-blur-xs shadow-xs">
              <Sparkles size={11} className="text-yellow-300" />
              {isTa ? 'தனிப்பயனாக்கலாம்' : 'Customizable'}
            </span>
          )}
          {isNormal && (
            <span className="absolute top-2 left-2 z-10 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-700/90 text-white backdrop-blur-xs shadow-xs">
              <Sparkles size={11} className="text-yellow-300" />
              {isTa ? '9 உணவுகள் உள்ளடங்கியது' : '9 Items Included'}
            </span>
          )}
        </div>

        {/* Dish Card Content */}
        <div className="p-3 sm:p-4 flex flex-col justify-between flex-1 gap-2.5">
          <h3 className="font-bold text-slate-900 text-xs sm:text-sm line-clamp-2 leading-snug min-h-[2rem] sm:min-h-[2.5rem]">
            {displayName}
          </h3>

          {isBananaLeaf ? (
            <button
              onClick={handleAction}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 bg-emerald-700 hover:bg-emerald-800 text-white border border-emerald-800/40 shadow-xs hover:shadow-md cursor-pointer active:scale-[0.98]"
            >
              <Utensils size={14} className="stroke-[2.2]" />
              <span>
                {isTa
                  ? (isAdded ? `உணவை மாற்று (${itemsInCart.length})` : 'உணவைத் தேர்வு செய்')
                  : (isAdded ? `Customize (${itemsInCart.length} in Cart)` : 'Customize Meal')}
              </span>
            </button>
          ) : isNormal ? (
            <button
              onClick={handleAction}
              className={`w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 cursor-pointer active:scale-[0.98] ${
                isAdded
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs hover:bg-emerald-100'
                  : 'bg-primary hover:bg-[#c2410c] text-white border border-orange-600/30 shadow-xs hover:shadow-md'
              }`}
            >
              {isAdded ? (
                <>
                  <Check size={15} className="stroke-[2.5]" />
                  <span>
                    {isTa
                      ? `சேர்க்கப்பட்டது (${itemsInCart[0]?.plateQuantity || 1} நபர்கள்)`
                      : `Added (${itemsInCart[0]?.plateQuantity || 1} Plates)`}
                  </span>
                </>
              ) : (
                <>
                  <Plus size={15} className="stroke-[2.5]" />
                  <span>{t.add}</span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleAction}
              disabled={isAdded}
              className={`w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 ${
                isAdded
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs cursor-default'
                  : 'bg-primary hover:bg-[#c2410c] text-white border border-orange-600/30 shadow-xs hover:shadow-md cursor-pointer active:scale-[0.98]'
              }`}
            >
              {isAdded ? (
                <>
                  <Check size={15} className="stroke-[2.5]" />
                  <span>{t.added}</span>
                </>
              ) : (
                <>
                  <Plus size={15} className="stroke-[2.5]" />
                  <span>{t.add}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Interactive Banana Leaf Meals Customizer Modal */}
      {isBananaLeaf && (
        <BananaLeafCustomizerModal
          isOpen={isCustomizerOpen}
          onClose={() => setIsCustomizerOpen(false)}
          onConfirm={handleCustomizationConfirm}
        />
      )}
    </>
  );
};
