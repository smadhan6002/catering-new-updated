import React, { useState } from 'react';
import type { MenuItem } from '../data/menu';
import { useCart } from '../context/CartContext';
import { useLanguage } from '../context/LanguageContext';
import { Check, Plus, Sparkles, Utensils } from 'lucide-react';
import { bananaLeafService } from '../services/bananaLeafService';
import { BananaLeafCustomizerModal } from './BananaLeafCustomizerModal';
import type { CustomizedMealSelection } from '../types/bananaLeaf';

interface MenuItemCardProps {
  item: MenuItem;
}

export const MenuItemCard: React.FC<MenuItemCardProps> = ({ item }) => {
  const { cartItems, addItem } = useCart();
  const { dishName, t, lang } = useLanguage();
  const isTa = lang === 'ta';

  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);

  const isBananaLeaf = bananaLeafService.isBananaLeafMeals(item.id);
  const itemsInCart = cartItems.filter((i) => i.id === item.id);
  const isAdded = itemsInCart.length > 0;

  const handleAction = () => {
    if (isBananaLeaf) {
      setIsCustomizerOpen(true);
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
      <div className={`bg-white rounded-2xl overflow-hidden shadow-xs hover:shadow-md border transition-all duration-200 flex flex-col group ${
        isBananaLeaf ? 'border-emerald-300 hover:border-emerald-500 ring-1 ring-emerald-100' : 'border-slate-200 hover:border-orange-300'
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
