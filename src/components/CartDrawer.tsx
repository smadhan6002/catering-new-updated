import React, { useState } from 'react';
import { X, Check, Edit3, Utensils, ChevronDown, ChevronUp } from 'lucide-react';
import { useCart, type CartItem } from '../context/CartContext';
import { useLanguage } from '../context/LanguageContext';
import { GuestCountSelector } from './GuestCountSelector';
import { FoodQuantitySelector } from './FoodQuantitySelector';
import { InquiryFormModal } from './InquiryFormModal';
import { BananaLeafCustomizerModal } from './BananaLeafCustomizerModal';
import type { CustomizedMealSelection } from '../types/bananaLeaf';
import { isNormalMeals, NORMAL_MEALS_DEFAULT_ITEMS } from '../data/normalMeals';

export const CartDrawer: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [editingCustomItem, setEditingCustomItem] = useState<CartItem | null>(null);
  const [expandedCustomItems, setExpandedCustomItems] = useState<Record<string, boolean>>({});

  const {
    cartItems,
    isCartDrawerOpen,
    setIsCartDrawerOpen,
    removeItem,
    updateCustomization,
    updatePlateQuantity,
    guestCount,
    foodQuantities,
  } = useCart();
  const { t, dishName, categoryName, lang } = useLanguage();
  const isTa = lang === 'ta';

  if (!isCartDrawerOpen) return null;

  const toggleExpand = (cartKey: string) => {
    setExpandedCustomItems((prev) => ({
      ...prev,
      [cartKey]: !prev[cartKey],
    }));
  };

  const handleEditCustomization = (item: CartItem) => {
    setEditingCustomItem(item);
  };

  const handleConfirmEditCustomization = (customization: CustomizedMealSelection) => {
    if (editingCustomItem) {
      updateCustomization(editingCustomItem.cartItemId || editingCustomItem.id, customization);
      setEditingCustomItem(null);
    }
  };

  // Group items by categoryId
  const groupedItems = cartItems.reduce((acc, item) => {
    if (!acc[item.categoryId]) {
      acc[item.categoryId] = [];
    }
    acc[item.categoryId].push(item);
    return acc;
  }, {} as Record<string, typeof cartItems>);

  const handleSendInquiry = () => {
    if (cartItems.length === 0) {
      setErrorMsg(t.pleaseAddDish);
      return;
    }
    const hasGuestCount = guestCount !== null && guestCount > 0;
    const hasFoodQuantity = foodQuantities.length > 0 && foodQuantities.some((fq) => fq.quantity > 0);

    if (!hasGuestCount && !hasFoodQuantity) {
      setErrorMsg(t.pleaseSelectPeople);
      return;
    }
    setErrorMsg('');
    setIsModalOpen(true);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-hidden">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
          onClick={() => setIsCartDrawerOpen(false)}
        />

        {/* Drawer */}
        <div className="absolute inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl flex flex-col transform transition-transform duration-300">
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 bg-white">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{t.yourSelection}</h2>
            <button
              onClick={() => setIsCartDrawerOpen(false)}
              className="w-9 h-9 flex items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-orange-50 hover:text-primary transition-colors cursor-pointer"
              aria-label="Close cart"
            >
              <X size={18} />
            </button>
          </div>

          {/* Scrollable Content with ample bottom padding so nothing is hidden by fixed footer */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 pb-36">
            {/* Guest Count */}
            <section className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900 mb-3">{t.numberOfPeople}</h3>
              <GuestCountSelector />
            </section>

            {/* Food Quantity (kg) Section */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
              <FoodQuantitySelector />
            </div>

            {/* Selected Items */}
            {Object.keys(groupedItems).length > 0 && (
              <section className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
                <h3 className="text-sm font-bold text-slate-900 mb-3">{t.selectedDishes}</h3>
                {Object.entries(groupedItems).map(([categoryId, items]) => (
                  <div key={categoryId} className="mb-4 last:mb-0">
                    <h4 className="text-xs font-bold text-primary tracking-wider uppercase mb-2">
                      {categoryName(categoryId, categoryId)}
                    </h4>
                    <div className="space-y-2.5">
                      {items.map((item) => {
                        const itemKey = item.cartItemId || item.id;
                        const isCustom = !!item.customization;
                        const isNormal = isNormalMeals(item.id) || isNormalMeals(item.name);
                        const isExpanded = !!expandedCustomItems[itemKey];

                        return (
                          <div
                            key={itemKey}
                            className={`rounded-xl border transition-all ${
                              isNormal
                                ? 'border-orange-300 bg-orange-50/50 p-3 shadow-2xs'
                                : isCustom
                                ? 'border-emerald-200 bg-emerald-50/40 p-3'
                                : 'border-slate-100 py-2 border-b last:border-0'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                {isNormal ? (
                                  <Utensils size={16} className="text-orange-600 flex-shrink-0" />
                                ) : isCustom ? (
                                  <Utensils size={16} className="text-emerald-700 flex-shrink-0" />
                                ) : (
                                  <Check size={16} className="text-emerald-600 flex-shrink-0" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-slate-800 text-xs sm:text-sm font-semibold truncate">
                                      {dishName(item.id, item.name)}
                                    </span>
                                    {isNormal && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-300">
                                        {isTa ? '9 உணவுகள்' : '9 Items Included'}
                                      </span>
                                    )}
                                    {isCustom && item.customization && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                        {isTa
                                          ? `தனிப்பயன் (${item.customization.selectedItems.length} வகைகள்)`
                                          : `Customized (${item.customization.selectedItems.length} items)`}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {isNormal && (
                                  <div className="flex items-center gap-1 bg-white border border-orange-300 rounded-lg px-1.5 py-0.5 shadow-2xs">
                                    <button
                                      type="button"
                                      onClick={() => updatePlateQuantity(itemKey, Math.max(1, (item.plateQuantity || 1) - 1))}
                                      className="w-5 h-5 flex items-center justify-center text-orange-700 hover:bg-orange-100 rounded font-bold text-xs cursor-pointer"
                                      title="Decrease plates"
                                    >
                                      -
                                    </button>
                                    <span className="text-xs font-bold text-slate-900 min-w-[20px] text-center">
                                      {item.plateQuantity || 1}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => updatePlateQuantity(itemKey, (item.plateQuantity || 1) + 1)}
                                      className="w-5 h-5 flex items-center justify-center text-orange-700 hover:bg-orange-100 rounded font-bold text-xs cursor-pointer"
                                      title="Increase plates"
                                    >
                                      +
                                    </button>
                                    <span className="text-[10px] font-semibold text-orange-800 ml-0.5 hidden min-[360px]:inline">
                                      {isTa ? 'நபர்கள்' : 'Plates'}
                                    </span>
                                  </div>
                                )}
                                {isCustom && (
                                  <>
                                    <button
                                      onClick={() => handleEditCustomization(item)}
                                      className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 bg-white hover:bg-emerald-100 text-xs font-semibold px-2 py-1 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                                      title={isTa ? 'உணவு வகைகளை மாற்று' : 'Edit meal items'}
                                    >
                                      <Edit3 size={12} />
                                      <span>{isTa ? 'மாற்று' : 'Edit'}</span>
                                    </button>
                                    <button
                                      onClick={() => toggleExpand(itemKey)}
                                      className="p-1 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100"
                                      aria-label="Toggle details"
                                    >
                                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={() => removeItem(itemKey)}
                                  className="text-red-500 hover:text-red-700 text-xs font-semibold px-2 py-1 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                                  aria-label={`Remove ${dishName(item.id, item.name)}`}
                                >
                                  {t.remove}
                                </button>
                              </div>
                            </div>

                            {/* Normal Meals Included Dishes (9 Items) */}
                            {isNormal && (
                              <div className="mt-2.5 pt-2 border-t border-orange-200/70 pl-2 sm:pl-4">
                                <p className="text-[11px] font-bold text-orange-950 mb-1.5 flex items-center gap-1.5">
                                  <Check size={13} className="text-emerald-600" />
                                  <span>{isTa ? 'உள்ளடங்கிய உணவுகள் (9 வகைகள்):' : 'Included Items (9 Items):'}</span>
                                </p>
                                <div className="grid grid-cols-2 min-[400px]:grid-cols-3 gap-1.5">
                                  {NORMAL_MEALS_DEFAULT_ITEMS.map((dish, idx) => (
                                    <div
                                      key={dish.dishId}
                                      className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-white border border-orange-200 text-slate-800 font-medium shadow-2xs"
                                    >
                                      <span className="text-orange-600 font-bold text-[10px] w-3 text-center">{idx + 1}.</span>
                                      <span className="truncate">{isTa ? dish.dishNameTa : dish.dishName}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Expanded List of Customized Dishes */}
                            {isCustom && item.customization && (isExpanded || true) && (
                              <div className="mt-2.5 pt-2 border-t border-emerald-200/60 pl-6">
                                <p className="text-[11px] font-semibold text-emerald-900 mb-1">
                                  {isTa ? 'தேர்ந்தெடுக்கப்பட்ட உணவுகள்:' : 'Selected meal items:'}
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {item.customization.selectedItems.map((dish) => (
                                    <span
                                      key={dish.dishId}
                                      className="inline-block text-[11px] px-2 py-0.5 rounded-md bg-white border border-emerald-200 text-slate-700 shadow-2xs font-medium"
                                    >
                                      {isTa && dish.dishNameTa ? dish.dishNameTa : dish.dishName}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </section>
            )}

            {cartItems.length === 0 && (
              <div className="text-center py-12 text-slate-400 font-medium text-sm">
                {t.emptyCart}
              </div>
            )}
          </div>

          {/* Sticky Bottom Actions */}
          <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 border-t border-slate-200 bg-white/95 backdrop-blur-md shadow-lg">
            {errorMsg && (
              <p className="text-red-600 bg-red-50 border border-red-200 text-xs sm:text-sm mb-3 py-2 px-3 rounded-xl text-center font-semibold">
                {errorMsg}
              </p>
            )}
            <button
              onClick={handleSendInquiry}
              className="w-full bg-primary hover:bg-[#c2410c] text-white py-3.5 rounded-xl font-bold text-sm sm:text-base transition-all duration-150 shadow-md hover:shadow-lg cursor-pointer border border-orange-600/30 active:scale-[0.99]"
            >
              {t.sendCateringInquiry}
            </button>
          </div>
        </div>
      </div>
      <InquiryFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      {/* Edit Banana Leaf Customizer Modal */}
      {editingCustomItem && (
        <BananaLeafCustomizerModal
          isOpen={!!editingCustomItem}
          initialSelection={editingCustomItem.customization}
          onClose={() => setEditingCustomItem(null)}
          onConfirm={handleConfirmEditCustomization}
        />
      )}
    </>
  );
};
