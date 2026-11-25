import React, { useState, useEffect } from 'react';
import { X, Check, RotateCcw, ShoppingBag, Sparkles, AlertCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { bananaLeafService } from '../services/bananaLeafService';
import type { MealCustomizationConfig, MealGroup, MealDishOption, CustomizedMealSelection, CustomizedMealItemSelection } from '../types/bananaLeaf';

interface BananaLeafCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (customization: CustomizedMealSelection) => void;
  initialSelection?: CustomizedMealSelection | null;
}

export const BananaLeafCustomizerModal: React.FC<BananaLeafCustomizerModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialSelection,
}) => {
  const { lang, dishName: getDishNameTa } = useLanguage();
  const isTa = lang === 'ta';

  const [config, setConfig] = useState<MealCustomizationConfig>(() => bananaLeafService.getConfig());
  const [selectedDishes, setSelectedDishes] = useState<Map<string, CustomizedMealItemSelection>>(new Map());
  const [activeGroupIndex, setActiveGroupIndex] = useState<number>(0);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [animatingId, setAnimatingId] = useState<string | null>(null);

  // Sync latest configuration from service on mount/open
  useEffect(() => {
    if (isOpen) {
      const live = bananaLeafService.getConfig();
      setConfig(live);

      // Preselect initial items if editing, or default items if new
      const selectionMap = new Map<string, CustomizedMealItemSelection>();

      if (initialSelection && initialSelection.selectedItems.length > 0) {
        initialSelection.selectedItems.forEach((it) => {
          selectionMap.set(it.dishId, it);
        });
      } else {
        // Apply default preselected items
        live.groups.forEach((group) => {
          group.dishes.forEach((d) => {
            if (d.isDefault) {
              selectionMap.set(d.dishId, {
                dishId: d.dishId,
                dishName: d.dishName,
                dishNameTa: d.dishNameTa || getDishNameTa(d.dishId, d.dishName),
                groupId: group.id,
                groupName: group.name,
                groupNameTa: group.nameTa,
                extraPrice: d.extraPrice,
              });
            }
          });
        });
      }

      setSelectedDishes(selectionMap);
      setValidationError(null);
      setActiveGroupIndex(0);
    }
  }, [isOpen, initialSelection, getDishNameTa]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Toggle dish selection with group limit validation
  const toggleDish = (dish: MealDishOption, group: MealGroup) => {
    setValidationError(null);
    setAnimatingId(dish.dishId);
    setTimeout(() => setAnimatingId(null), 300);

    setSelectedDishes((prev) => {
      const next = new Map(prev);
      const isAlreadySelected = next.has(dish.dishId);

      if (isAlreadySelected) {
        // Check if item is strictly required
        if (dish.isRequired) {
          setValidationError(
            isTa
              ? `${dish.dishNameTa || dish.dishName} இந்த உணவிற்கு அவசியமானது.`
              : `${dish.dishName} is required for this meal.`
          );
          return prev;
        }

        // Count remaining items in this group
        const groupSelectedCount = Array.from(next.values()).filter(
          (item) => item.groupId === group.id && item.dishId !== dish.dishId
        ).length;

        if (group.isRequired && groupSelectedCount < group.minSelections) {
          setValidationError(
            isTa
              ? `${group.nameTa} பிரிவில் குறைந்தது ${group.minSelections} உணவைத் தேர்ந்தெடுக்கவும்.`
              : `Please select at least ${group.minSelections} item from ${group.name}.`
          );
          return prev;
        }

        next.delete(dish.dishId);
      } else {
        // Customers can select as many available dishes as they want (no maximum restrictions)
        next.set(dish.dishId, {
          dishId: dish.dishId,
          dishName: dish.dishName,
          dishNameTa: dish.dishNameTa || getDishNameTa(dish.dishId, dish.dishName),
          groupId: group.id,
          groupName: group.name,
          groupNameTa: group.nameTa,
          extraPrice: dish.extraPrice,
        });
      }

      return next;
    });
  };

  // Reset to defaults
  const handleResetToDefaults = () => {
    const selectionMap = new Map<string, CustomizedMealItemSelection>();
    config.groups.forEach((group) => {
      group.dishes.forEach((d) => {
        if (d.isDefault) {
          selectionMap.set(d.dishId, {
            dishId: d.dishId,
            dishName: d.dishName,
            dishNameTa: d.dishNameTa || getDishNameTa(d.dishId, d.dishName),
            groupId: group.id,
            groupName: group.name,
            groupNameTa: group.nameTa,
            extraPrice: d.extraPrice,
          });
        }
      });
    });
    setSelectedDishes(selectionMap);
    setValidationError(null);
  };

  // Validate complete meal before confirming
  const handleConfirm = () => {
    // Verify each required group has minimum selections
    for (const group of config.groups) {
      if (group.isRequired) {
        const inGroup = Array.from(selectedDishes.values()).filter(
          (it) => it.groupId === group.id
        );
        if (inGroup.length < group.minSelections) {
          setValidationError(
            isTa
              ? `${group.nameTa} பிரிவில் குறைந்தது ${group.minSelections} உணவைத் தேர்ந்தெடுக்கவும்.`
              : `Please select at least ${group.minSelections} item from ${group.name}.`
          );
          // Switch to this group so user can pick
          const gIdx = config.groups.findIndex((g) => g.id === group.id);
          if (gIdx !== -1) setActiveGroupIndex(gIdx);
          return;
        }
      }
    }

    const itemsArray = Array.from(selectedDishes.values());
    const dishIds = itemsArray.map((i) => i.dishId);
    const customizationId = bananaLeafService.generateCustomizationId(dishIds);

    const customization: CustomizedMealSelection = {
      customizationId,
      parentDishId: 'ms1',
      parentDishName: 'Banana Leaf Meals',
      parentDishNameTa: 'வாழை இலை சாப்பாடு',
      selectedItems: itemsArray,
      createdAt: new Date().toISOString(),
    };

    onConfirm(customization);
    onClose();
  };

  // Current active group and its items
  const activeGroup = config.groups[activeGroupIndex] || config.groups[0];

  const selectedCount = selectedDishes.size;

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="customizer-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-950/75 backdrop-blur-md overflow-hidden animate-in fade-in duration-200"
    >
      {/* Modal Container */}
      <div className="relative w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-4xl bg-white sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200/80">
        {/* Top Header */}
        <div className="relative z-10 flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 bg-gradient-to-r from-orange-600 via-orange-500 to-amber-600 text-white shadow-sm shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <span className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/20 backdrop-blur-xs text-lg sm:text-xl shadow-inner shrink-0">
              🍃
            </span>
            <div className="min-w-0">
              <h2 id="customizer-title" className="text-base sm:text-xl font-bold tracking-tight truncate">
                {isTa ? config.titleTa : config.titleEn}
              </h2>
              <p className="text-[11px] sm:text-xs text-orange-100 font-medium truncate">
                {isTa ? config.subtitleTa : config.subtitleEn}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Reset button */}
            <button
              onClick={handleResetToDefaults}
              title={isTa ? 'ஆரம்ப நிலைக்கு மாற்றவும்' : 'Reset to defaults'}
              className="p-1.5 sm:p-2 text-white/90 hover:text-white hover:bg-white/20 rounded-xl transition-colors cursor-pointer text-xs font-semibold flex items-center gap-1"
            >
              <RotateCcw size={15} />
              <span className="hidden sm:inline text-xs">{isTa ? 'மீட்டமை' : 'Reset'}</span>
            </button>

            {/* Close button */}
            <button
              onClick={onClose}
              aria-label="Close customizer"
              className="p-1.5 sm:p-2 text-white/90 hover:text-white hover:bg-white/20 rounded-xl transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Category Tabs Strip */}
        <div className="flex items-center gap-1.5 px-3 sm:px-6 py-2.5 bg-slate-50 border-b border-slate-200/80 overflow-x-auto no-scrollbar shrink-0">
          {config.groups.map((group, idx) => {
            const countInGroup = Array.from(selectedDishes.values()).filter(
              (it) => it.groupId === group.id
            ).length;
            const isSelected = activeGroupIndex === idx;

            return (
              <button
                key={group.id}
                onClick={() => {
                  setActiveGroupIndex(idx);
                  setValidationError(null);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-primary text-white shadow-xs scale-[1.02]'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/70'
                }`}
              >
                <span>{isTa ? group.nameTa : group.name}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isSelected
                      ? 'bg-white/25 text-white'
                      : countInGroup > 0
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {countInGroup > 0
                    ? `${countInGroup} ${isTa ? 'தேர்வு' : 'Selected'}`
                    : '0'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Validation Error Toast */}
        {validationError && (
          <div className="mx-4 sm:mx-6 mt-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2 animate-in slide-in-from-top-1">
            <AlertCircle size={16} className="text-amber-600 shrink-0" />
            <span className="font-medium">{validationError}</span>
          </div>
        )}

        {/* Main Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Visual Banana Leaf Live Preview Card */}
          <div className="relative rounded-2xl bg-gradient-to-b from-emerald-950 via-emerald-900 to-green-950 p-4 sm:p-5 shadow-inner overflow-hidden border border-emerald-800/40">
            {/* Decorative leaf water droplets and texture pattern */}
            <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4">
              {/* Banana Leaf Illustration Container */}
              <div className="relative w-full md:w-3/5 h-44 sm:h-52 flex items-center justify-center">
                {/* Authentic Green Banana Leaf SVG Canvas */}
                <svg
                  viewBox="0 0 600 320"
                  className="w-full h-full drop-shadow-[0_12px_24px_rgba(0,0,0,0.45)] transition-transform duration-300 hover:scale-[1.01]"
                >
                  <defs>
                    <linearGradient id="leafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#4ADE80" />
                      <stop offset="45%" stopColor="#22C55E" />
                      <stop offset="85%" stopColor="#16A34A" />
                      <stop offset="100%" stopColor="#15803D" />
                    </linearGradient>
                    <linearGradient id="midribGrad" x1="0%" y1="50%" x2="100%" y2="50%">
                      <stop offset="0%" stopColor="#86EFAC" />
                      <stop offset="50%" stopColor="#BBF7D0" />
                      <stop offset="100%" stopColor="#4ADE80" />
                    </linearGradient>
                    <filter id="foodShadow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#000" floodOpacity="0.35" />
                    </filter>
                  </defs>

                  {/* Leaf Silhouette Outline (Natural tapered banana leaf shape) */}
                  <path
                    d="M 30,160 C 50,70 180,30 330,35 C 470,40 560,95 580,160 C 560,225 470,280 330,285 C 180,290 50,250 30,160 Z"
                    fill="url(#leafGrad)"
                    stroke="#86EFAC"
                    strokeWidth="2.5"
                  />

                  {/* Leaf Natural Texture Veins */}
                  <g stroke="#15803D" strokeWidth="1.2" opacity="0.35">
                    <line x1="80" y1="160" x2="110" y2="70" />
                    <line x1="80" y1="160" x2="110" y2="250" />
                    <line x1="160" y1="160" x2="200" y2="50" />
                    <line x1="160" y1="160" x2="200" y2="270" />
                    <line x1="250" y1="160" x2="300" y2="40" />
                    <line x1="250" y1="160" x2="300" y2="280" />
                    <line x1="340" y1="160" x2="400" y2="45" />
                    <line x1="340" y1="160" x2="400" y2="275" />
                    <line x1="430" y1="160" x2="490" y2="65" />
                    <line x1="430" y1="160" x2="490" y2="255" />
                    <line x1="510" y1="160" x2="550" y2="105" />
                    <line x1="510" y1="160" x2="550" y2="215" />
                  </g>

                  {/* Prominent Leaf Midrib (Main center vein) */}
                  <path
                    d="M 25,160 Q 300,158 580,160"
                    stroke="url(#midribGrad)"
                    strokeWidth="4.5"
                    strokeLinecap="round"
                  />

                  {/* ─── DYNAMIC FOOD ITEMS PLACED ON LEAF ─── */}

                  {/* 1. Center Rice Mound */}
                  {selectedDishes.has('ms2') && (
                    <g filter="url(#foodShadow)" className="transition-all duration-300">
                      {/* Rice Mound */}
                      <ellipse cx="230" cy="180" rx="55" ry="38" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="1.5" />
                      <ellipse cx="230" cy="174" rx="46" ry="30" fill="#FFFFFF" />
                      {/* Ghee & Sambar Center swirl */}
                      <ellipse cx="230" cy="172" rx="18" ry="11" fill="#F59E0B" opacity="0.85" />
                      <circle cx="230" cy="171" r="7" fill="#EA580C" opacity="0.9" />
                      <text x="230" y="205" textAnchor="middle" fill="#0F172A" fontSize="10" fontWeight="bold">
                        {isTa ? 'சாதம்' : 'Rice'}
                      </text>
                    </g>
                  )}

                  {/* 2. Top-Left Banana (வாழைப்பழம்) */}
                  {selectedDishes.has('ms23') && (
                    <g filter="url(#foodShadow)">
                      <circle cx="105" cy="85" r="18" fill="#FEF08A" stroke="#EAB308" strokeWidth="1.5" />
                      <ellipse cx="105" cy="84" rx="14" ry="7" fill="#FDE047" transform="rotate(-25 105 84)" />
                      <text x="105" y="117" textAnchor="middle" fill="#FEF08A" fontSize="8" fontWeight="bold">
                        {isTa ? 'வாழைப்பழம்' : 'Banana'}
                      </text>
                    </g>
                  )}

                  {/* 3. Top-Middle Pickle (ஊறுகாய்) */}
                  {selectedDishes.has('ms13') && (
                    <g filter="url(#foodShadow)">
                      <circle cx="165" cy="72" r="13" fill="#DC2626" stroke="#991B1B" strokeWidth="1.5" />
                      <circle cx="163" cy="70" r="4" fill="#FCA5A5" opacity="0.8" />
                      <text x="165" y="96" textAnchor="middle" fill="#FCA5A5" fontSize="8" fontWeight="bold">
                        {isTa ? 'ஊறுகாய்' : 'Pickle'}
                      </text>
                    </g>
                  )}

                  {/* 4. Top Poriyal (பொரியல்) */}
                  {selectedDishes.has('ms10') && (
                    <g filter="url(#foodShadow)">
                      <ellipse cx="235" cy="76" rx="26" ry="17" fill="#FEF08A" stroke="#EAB308" strokeWidth="1.5" />
                      <circle cx="230" cy="75" r="2.5" fill="#15803D" />
                      <circle cx="240" cy="78" r="2" fill="#CA8A04" />
                      <circle cx="225" cy="74" r="2" fill="#EA580C" />
                      <text x="235" y="103" textAnchor="middle" fill="#FEF08A" fontSize="9" fontWeight="bold">
                        {isTa ? 'பொரியல்' : 'Poriyal'}
                      </text>
                    </g>
                  )}

                  {/* 5. Top Kootu (கூட்டு) */}
                  {selectedDishes.has('ms11') && (
                    <g filter="url(#foodShadow)">
                      <ellipse cx="310" cy="80" rx="26" ry="17" fill="#FED7AA" stroke="#F97316" strokeWidth="1.5" />
                      <circle cx="305" cy="78" r="2.5" fill="#15803D" />
                      <circle cx="315" cy="82" r="2" fill="#B45309" />
                      <text x="310" y="107" textAnchor="middle" fill="#FED7AA" fontSize="9" fontWeight="bold">
                        {isTa ? 'கூட்டு' : 'Kootu'}
                      </text>
                    </g>
                  )}

                  {/* 6. Top Aviyal (அவியல்) */}
                  {selectedDishes.has('ms14') && (
                    <g filter="url(#foodShadow)">
                      <ellipse cx="385" cy="90" rx="26" ry="17" fill="#FEF9C3" stroke="#CA8A04" strokeWidth="1.5" />
                      <circle cx="380" cy="88" r="2.5" fill="#EA580C" />
                      <circle cx="390" cy="92" r="2.5" fill="#15803D" />
                      <text x="385" y="117" textAnchor="middle" fill="#FEF9C3" fontSize="9" fontWeight="bold">
                        {isTa ? 'அவியல்' : 'Aviyal'}
                      </text>
                    </g>
                  )}

                  {/* 7. Bottom-Left Appalam (அப்பளம்) */}
                  {selectedDishes.has('ms12') && (
                    <g filter="url(#foodShadow)">
                      <ellipse cx="105" cy="205" rx="34" ry="24" fill="#FDE047" stroke="#EAB308" strokeWidth="2" />
                      <circle cx="95" cy="200" r="2" fill="#CA8A04" opacity="0.6" />
                      <circle cx="115" cy="210" r="2.5" fill="#CA8A04" opacity="0.6" />
                      <text x="105" y="240" textAnchor="middle" fill="#FEF08A" fontSize="9" fontWeight="bold">
                        {isTa ? 'அப்பளம்' : 'Appalam'}
                      </text>
                    </g>
                  )}

                  {/* 8. Bottom Sambar Bowl (சாம்பார்) */}
                  {selectedDishes.has('ms3') && (
                    <g filter="url(#foodShadow)">
                      <circle cx="355" cy="180" r="24" fill="#EA580C" stroke="#C2410C" strokeWidth="2" />
                      <circle cx="355" cy="180" r="18" fill="#F97316" />
                      <circle cx="352" cy="178" r="3" fill="#15803D" />
                      <text x="355" y="215" textAnchor="middle" fill="#FFEDD5" fontSize="9" fontWeight="bold">
                        {isTa ? 'சாம்பார்' : 'Sambar'}
                      </text>
                    </g>
                  )}

                  {/* 9. Bottom Rasam Bowl (ரசம்) */}
                  {(selectedDishes.has('ms5') || selectedDishes.has('ms6') || selectedDishes.has('ms7')) && (
                    <g filter="url(#foodShadow)">
                      <circle cx="435" cy="185" r="22" fill="#DC2626" stroke="#991B1B" strokeWidth="2" />
                      <circle cx="435" cy="185" r="16" fill="#EF4444" />
                      <circle cx="433" cy="183" r="2" fill="#15803D" />
                      <text x="435" y="218" textAnchor="middle" fill="#FEE2E2" fontSize="9" fontWeight="bold">
                        {isTa ? 'ரசம்' : 'Rasam'}
                      </text>
                    </g>
                  )}

                  {/* 10. Banana & Beeda (வாழைப்பழம்) */}
                  {selectedDishes.has('ms23') && (
                    <g filter="url(#foodShadow)">
                      <path
                        d="M 50,135 Q 70,120 75,145 Q 70,150 48,140 Z"
                        fill="#FACC15"
                        stroke="#CA8A04"
                        strokeWidth="1.5"
                      />
                    </g>
                  )}

                  {/* 11. Chips / Vathal */}
                  {(selectedDishes.has('ms15') || selectedDishes.has('ms16') || selectedDishes.has('ms20')) && (
                    <g filter="url(#foodShadow)">
                      <circle cx="160" cy="245" r="11" fill="#FACC15" stroke="#EAB308" strokeWidth="1" />
                      <circle cx="178" cy="242" r="10" fill="#FDE047" stroke="#EAB308" strokeWidth="1" />
                      <circle cx="170" cy="254" r="9" fill="#EAB308" />
                      <text x="170" y="274" textAnchor="middle" fill="#FEF08A" fontSize="8" fontWeight="bold">
                        {isTa ? 'சிப்ஸ்' : 'Chips'}
                      </text>
                    </g>
                  )}

                  {/* 12. Buttermilk (மோர்) */}
                  {selectedDishes.has('ms9') && (
                    <g filter="url(#foodShadow)">
                      <ellipse cx="495" cy="205" rx="14" ry="20" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1.5" />
                      <circle cx="494" cy="200" r="1.5" fill="#15803D" />
                      <text x="495" y="235" textAnchor="middle" fill="#F8FAFC" fontSize="8" fontWeight="bold">
                        {isTa ? 'மோர்' : 'Buttermilk'}
                      </text>
                    </g>
                  )}
                </svg>
              </div>

              {/* Live Selection Summary Box */}
              <div className="w-full md:w-2/5 bg-white/10 backdrop-blur-sm rounded-xl p-3 sm:p-4 text-white border border-white/15">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                    <Sparkles size={13} className="text-amber-400" />
                    {isTa ? 'தேர்ந்தெடுத்த உணவுகள்' : 'Placed On Your Leaf'}
                  </span>
                  <span className="bg-emerald-500/30 text-emerald-200 text-xs font-extrabold px-2 py-0.5 rounded-full border border-emerald-400/30">
                    {selectedCount} {isTa ? 'உணவுகள்' : 'Items'}
                  </span>
                </div>

                {/* Preview Dish Pills */}
                <div className="flex flex-wrap gap-1 max-h-24 sm:max-h-28 overflow-y-auto no-scrollbar py-1">
                  {Array.from(selectedDishes.values()).map((dish) => (
                    <span
                      key={dish.dishId}
                      className="inline-flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white text-[11px] font-medium px-2 py-0.5 rounded-lg border border-white/20 transition-all duration-150 animate-in zoom-in-95"
                    >
                      <span>{isTa ? dish.dishNameTa || dish.dishName : dish.dishName}</span>
                    </span>
                  ))}
                  {selectedCount === 0 && (
                    <span className="text-xs text-emerald-200/70 italic py-2">
                      {isTa ? 'கீழே உணவுகளைத் தேர்வு செய்யவும்...' : 'Select dishes below to arrange your leaf...'}
                    </span>
                  )}
                </div>

                <div className="mt-2.5 pt-2 border-t border-white/15 flex items-center justify-between text-[11px] text-emerald-100">
                  <span>{isTa ? 'பாரம்பரிய வாழை இலை விருந்து' : 'Authentic South Indian Feast'}</span>
                  <span className="font-semibold text-amber-300">
                    {isTa ? 'சுத்த சைவம்' : '100% Pure Veg'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Active Group Details & Requirements */}
          {(() => {
            const activeGroupSelectedCount = Array.from(selectedDishes.values()).filter(
              (item) => item.groupId === activeGroup.id
            ).length;

            return (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1 border-b border-slate-200/80">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900">
                      {isTa ? activeGroup.nameTa : activeGroup.name}
                    </h3>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-200">
                      {activeGroupSelectedCount} {isTa ? 'தேர்வு செய்யப்பட்டது' : 'Selected'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isTa ? activeGroup.descriptionTa : activeGroup.description}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/70">
                    {isTa
                      ? activeGroup.isRequired && activeGroup.minSelections > 1
                        ? `குறைந்தது: ${activeGroup.minSelections} (வரம்பற்ற தேர்வு)`
                        : 'வரம்பற்ற தேர்வு'
                      : activeGroup.isRequired && activeGroup.minSelections > 1
                      ? `Min: ${activeGroup.minSelections} (Unlimited Selection)`
                      : 'Unlimited Selection'}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* ─── DISH CARDS GRID ─── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3.5">
            {activeGroup.dishes.map((dish) => {
              const isSelected = selectedDishes.has(dish.dishId);
              const isAnimating = animatingId === dish.dishId;
              const displayName = isTa ? dish.dishNameTa || dish.dishName : dish.dishName;

              return (
                <button
                  key={dish.dishId}
                  type="button"
                  onClick={() => toggleDish(dish, activeGroup)}
                  className={`group relative flex flex-col items-center p-3 rounded-2xl border text-center transition-all duration-200 cursor-pointer select-none active:scale-95 ${
                    isSelected
                      ? 'bg-orange-50/70 border-orange-500 shadow-md ring-2 ring-orange-500/20'
                      : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-orange-300 shadow-2xs hover:shadow-xs'
                  } ${isAnimating ? 'scale-105' : ''}`}
                >
                  {/* Selection Checkmark Badge */}
                  <div
                    className={`absolute top-2 right-2 w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center transition-all duration-200 ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-xs scale-100 rotate-0'
                        : 'bg-slate-100 text-slate-400 border border-slate-200 scale-90 opacity-60 group-hover:opacity-100'
                    }`}
                  >
                    <Check size={13} className="stroke-[3]" />
                  </div>

                  {/* Required/Default Pill */}
                  {dish.isRequired ? (
                    <span className="absolute top-2 left-2 text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                      {isTa ? 'அவசியம்' : 'Required'}
                    </span>
                  ) : dish.isDefault ? (
                    <span className="absolute top-2 left-2 text-[9px] font-semibold px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-600">
                      {isTa ? 'முன்னிருப்பு' : 'Default'}
                    </span>
                  ) : null}

                  {/* Dish Thumbnail / Circular Avatar */}
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-slate-100 border-2 border-white shadow-sm mt-3 mb-2 shrink-0 transition-transform duration-200 group-hover:scale-105">
                    {dish.image ? (
                      <img
                        src={dish.image}
                        alt={displayName}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-100 to-amber-200 text-2xl">
                        🍛
                      </div>
                    )}
                  </div>

                  {/* Dish Name */}
                  <span className="font-bold text-xs sm:text-sm text-slate-900 line-clamp-1 leading-snug">
                    {displayName}
                  </span>

                  {/* Secondary name if available */}
                  <span className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                    {isTa ? dish.dishName : dish.dishNameTa}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── STICKY FOOTER ─── */}
        <div className="relative z-10 p-3.5 sm:p-5 bg-white border-t border-slate-200/90 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-2">
              <span className="text-xl sm:text-2xl">🍃</span>
              <div>
                <span className="text-xs text-slate-500 font-medium block">
                  {isTa ? 'வாழை இலை சாப்பாடு' : 'Banana Leaf Meals'}
                </span>
                <span className="text-sm sm:text-base font-bold text-slate-900">
                  {selectedCount} {isTa ? 'உணவுகள் தேர்ந்தெடுக்கப்பட்டுள்ளன' : 'Dishes Custom Selected'}
                </span>
              </div>
            </div>

            <button
              onClick={handleResetToDefaults}
              className="sm:hidden text-xs text-slate-500 hover:text-slate-800 underline font-medium"
            >
              {isTa ? 'மீட்டமை' : 'Reset'}
            </button>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
            >
              {isTa ? 'ரத்து செய்' : 'Cancel'}
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-primary hover:bg-[#c2410c] text-white text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all duration-150 cursor-pointer active:scale-98"
            >
              <ShoppingBag size={16} />
              <span>
                {initialSelection
                  ? isTa
                    ? 'தேர்வை புதுப்பிக்கவும்'
                    : 'Update Customization'
                  : isTa
                  ? 'கார்ட்டில் சேர்க்கவும்'
                  : 'Add Customized Meal to Cart'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
