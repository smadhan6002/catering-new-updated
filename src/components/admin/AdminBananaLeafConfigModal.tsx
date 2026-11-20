import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Plus,
  Trash2,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Save,
  Search,
} from 'lucide-react';
import { bananaLeafService } from '../../services/bananaLeafService';
import { dishService, type UnifiedDish } from '../../services/dishService';
import type { MealCustomizationConfig, MealGroup, MealDishOption } from '../../types/bananaLeaf';
import { useLanguage } from '../../context/LanguageContext';

interface AdminBananaLeafConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const AdminBananaLeafConfigModal: React.FC<AdminBananaLeafConfigModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const { lang } = useLanguage();
  const isTa = lang === 'ta';

  const [config, setConfig] = useState<MealCustomizationConfig>(() => bananaLeafService.getConfig());
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [activeGroupId, setActiveGroupId] = useState<string>('');
  const [addingDishGroupId, setAddingDishGroupId] = useState<string | null>(null);
  const [dishSearch, setDishSearch] = useState('');
  const [allCatalogDishes, setAllCatalogDishes] = useState<UnifiedDish[]>([]);

  useEffect(() => {
    if (isOpen) {
      const cfg = bananaLeafService.getConfig();
      setConfig(cfg);
      if (cfg.groups.length > 0) {
        setActiveGroupId(cfg.groups[0].id);
      }
      setAllCatalogDishes(dishService.getAllDishes());
    }
  }, [isOpen]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  }

  if (!isOpen) return null;

  const handleToggleEnabled = () => {
    setConfig((prev) => ({
      ...prev,
      isEnabled: !prev.isEnabled,
    }));
  };

  const handleUpdateGroup = (groupId: string, updates: Partial<MealGroup>) => {
    setConfig((prev) => ({
      ...prev,
      groups: prev.groups.map((g) => (g.id === groupId ? { ...g, ...updates } : g)),
    }));
  };

  const handleAddGroup = () => {
    const newId = `group-${Date.now()}`;
    const newGroup: MealGroup = {
      id: newId,
      name: 'New Dish Category',
      nameTa: 'புதிய வகை',
      description: 'Choose from items',
      descriptionTa: 'விருப்பமான உணவுகளைத் தேர்ந்தெடுக்கவும்',
      minSelections: 1,
      maxSelections: 2,
      isRequired: true,
      dishes: [],
    };

    setConfig((prev) => ({
      ...prev,
      groups: [...prev.groups, newGroup],
    }));
    setActiveGroupId(newId);
  };

  const handleDeleteGroup = (groupId: string) => {
    if (config.groups.length <= 1) {
      alert(isTa ? 'குறைந்தது ஒரு குழு இருக்க வேண்டும்.' : 'At least one meal group is required.');
      return;
    }
    if (confirm(isTa ? 'இந்த குழுவை நீக்க விரும்புகிறீர்களா?' : 'Are you sure you want to remove this meal group?')) {
      setConfig((prev) => {
        const remaining = prev.groups.filter((g) => g.id !== groupId);
        if (activeGroupId === groupId && remaining.length > 0) {
          setActiveGroupId(remaining[0].id);
        }
        return {
          ...prev,
          groups: remaining,
        };
      });
    }
  };

  const handleMoveGroup = (groupId: string, direction: 'up' | 'down') => {
    setConfig((prev) => {
      const idx = prev.groups.findIndex((g) => g.id === groupId);
      if (idx === -1) return prev;
      if (direction === 'up' && idx === 0) return prev;
      if (direction === 'down' && idx === prev.groups.length - 1) return prev;

      const newGroups = [...prev.groups];
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      const temp = newGroups[idx];
      newGroups[idx] = newGroups[targetIdx];
      newGroups[targetIdx] = temp;

      return {
        ...prev,
        groups: newGroups,
      };
    });
  };

  const handleAddDishToGroup = (groupId: string, dish: UnifiedDish) => {
    setConfig((prev) => ({
      ...prev,
      groups: prev.groups.map((g) => {
        if (g.id !== groupId) return g;
        if (g.dishes.some((d) => d.dishId === dish.id)) return g;

        const newOption: MealDishOption = {
          dishId: dish.id,
          dishName: dish.name,
          dishNameTa: dish.nameTa || dish.name,
          image: dish.image,
          categoryId: dish.categoryId,
          isDefault: false,
          isRequired: false,
        };

        return {
          ...g,
          dishes: [...g.dishes, newOption],
        };
      }),
    }));
    setAddingDishGroupId(null);
    setDishSearch('');
  };

  const handleRemoveDishFromGroup = (groupId: string, dishId: string) => {
    setConfig((prev) => ({
      ...prev,
      groups: prev.groups.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          dishes: g.dishes.filter((d) => d.dishId !== dishId),
        };
      }),
    }));
  };

  const handleToggleDishDefault = (groupId: string, dishId: string) => {
    setConfig((prev) => ({
      ...prev,
      groups: prev.groups.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          dishes: g.dishes.map((d) => (d.dishId === dishId ? { ...d, isDefault: !d.isDefault } : d)),
        };
      }),
    }));
  };

  const handleToggleDishRequired = (groupId: string, dishId: string) => {
    setConfig((prev) => ({
      ...prev,
      groups: prev.groups.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          dishes: g.dishes.map((d) => {
            if (d.dishId === dishId) {
              const nextReq = !d.isRequired;
              return {
                ...d,
                isRequired: nextReq,
                isDefault: nextReq ? true : d.isDefault,
              };
            }
            return d;
          }),
        };
      }),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await bananaLeafService.saveConfig(config);
      showToast(isTa ? 'அமைப்புகள் வெற்றிகரமாக சேமிக்கப்பட்டன!' : 'Banana Leaf Customizer settings saved!');
      onSaved?.();
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      console.error('Error saving banana leaf config:', err);
      showToast(isTa ? 'சேமிக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.' : 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (confirm(isTa ? 'அனைத்து அமைப்புகளையும் ஆரம்ப நிலைக்கு மாற்ற விரும்புகிறீர்களா?' : 'Reset customizer to authentic South Indian feast defaults?')) {
      const reset = await bananaLeafService.resetToDefaults();
      setConfig(reset);
      showToast(isTa ? 'ஆரம்ப நிலைக்கு மாற்றப்பட்டது.' : 'Reset to traditional defaults.');
    }
  };

  const currentGroup = config.groups.find((g) => g.id === activeGroupId) || config.groups[0];

  const filteredDishesToAdd = allCatalogDishes.filter((d) => {
    if (!currentGroup) return false;
    if (currentGroup.dishes.some((existing) => existing.dishId === d.id)) return false;
    if (!dishSearch.trim()) return true;
    const q = dishSearch.toLowerCase();
    return d.name.toLowerCase().includes(q) || (d.nameTa && d.nameTa.toLowerCase().includes(q));
  });

  return (
    <>
      {toast && (
        <div className="fixed top-5 right-5 z-[350] bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-sm animate-fade-in border border-slate-700">
          <Check size={18} className="text-emerald-400 flex-shrink-0" />
          <span className="font-semibold">{toast}</span>
        </div>
      )}

      {/* Backdrop */}
      <div className="fixed inset-0 z-[140] bg-slate-950/70 backdrop-blur-xs" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="fixed inset-0 z-[145] flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
        <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-emerald-900 text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-800/80 border border-emerald-600/50 flex items-center justify-center">
                <Sparkles size={20} className="text-yellow-300" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <span>{isTa ? 'வாழை இலை உணவு தனிப்பயனாக்க அமைப்புகள்' : 'Banana Leaf Meals Customizer Settings'}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    config.isEnabled ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}>
                    {config.isEnabled ? (isTa ? 'செயலில் உள்ளது' : 'Enabled') : (isTa ? 'முடக்கப்பட்டுள்ளது' : 'Disabled')}
                  </span>
                </h2>
                <p className="text-xs text-emerald-200/80">
                  {isTa ? 'வாடிக்கையாளர்கள் தங்கள் வாழை இலை உணவில் சேர்க்கும் வகைகளை உள்ளமைக்கவும்.' : 'Configure live groups, dish options, selection limits and required items.'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-full text-emerald-200 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Master Controls Strip */}
          <div className="bg-emerald-50/60 border-b border-emerald-200/70 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.isEnabled}
                onChange={handleToggleEnabled}
                className="w-5 h-5 text-emerald-600 rounded-md focus:ring-emerald-500 cursor-pointer"
              />
              <span className="text-sm font-bold text-slate-800">
                {isTa ? 'வாடிக்கையாளர்களுக்கு தனிப்பயனாக்குதலை இயக்கவும்' : 'Enable Customer Interactive Meal Customizer'}
              </span>
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <RotateCcw size={13} />
                <span>{isTa ? 'இயல்பு நிலைக்கு மீட்டமை' : 'Reset to Defaults'}</span>
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Left Column: Group Navigation (4 cols) */}
            <div className="md:col-span-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {isTa ? 'உணவு குழுக்கள்' : 'Meal Groups'} ({config.groups.length})
                </span>
                <button
                  type="button"
                  onClick={handleAddGroup}
                  className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-100/70 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  <Plus size={13} />
                  <span>{isTa ? 'புதிய குழு' : 'Add Group'}</span>
                </button>
              </div>

              <div className="space-y-2">
                {config.groups.map((group, index) => {
                  const isActive = group.id === currentGroup?.id;
                  return (
                    <div
                      key={group.id}
                      onClick={() => setActiveGroupId(group.id)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                        isActive
                          ? 'border-emerald-600 bg-emerald-50/80 shadow-xs ring-1 ring-emerald-500'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-400">{index + 1}.</span>
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                            {isTa && group.nameTa ? group.nameTa : group.name}
                          </h4>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {group.dishes.length} {isTa ? 'உணவுகள்' : 'options'} • Min: {group.minSelections}, Max: {group.maxSelections}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleMoveGroup(group.id, 'up')}
                          disabled={index === 0}
                          className="p-1 rounded-md text-slate-400 hover:text-slate-700 disabled:opacity-30"
                          title="Move Up"
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveGroup(group.id, 'down')}
                          disabled={index === config.groups.length - 1}
                          className="p-1 rounded-md text-slate-400 hover:text-slate-700 disabled:opacity-30"
                          title="Move Down"
                        >
                          <ChevronDown size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteGroup(group.id)}
                          className="p-1 rounded-md text-rose-400 hover:text-rose-700"
                          title="Delete Group"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Group Configuration Details & Dishes (8 cols) */}
            {currentGroup && (
              <div className="md:col-span-8 flex flex-col gap-5 bg-slate-50/50 p-4 sm:p-5 rounded-2xl border border-slate-200">
                {/* Group Meta Settings */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {isTa ? 'குழு பெயர் (English)' : 'Group Name (English)'}
                    </label>
                    <input
                      type="text"
                      value={currentGroup.name}
                      onChange={(e) => handleUpdateGroup(currentGroup.id, { name: e.target.value })}
                      className="w-full text-xs sm:text-sm px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {isTa ? 'குழு பெயர் (தமிழ்)' : 'Group Name (Tamil)'}
                    </label>
                    <input
                      type="text"
                      value={currentGroup.nameTa || ''}
                      onChange={(e) => handleUpdateGroup(currentGroup.id, { nameTa: e.target.value })}
                      className="w-full text-xs sm:text-sm px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {isTa ? 'குறைந்தபட்ச தேர்வுகள் (Min)' : 'Min Selections Required'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={currentGroup.maxSelections}
                      value={currentGroup.minSelections}
                      onChange={(e) =>
                        handleUpdateGroup(currentGroup.id, { minSelections: Math.max(0, parseInt(e.target.value) || 0) })
                      }
                      className="w-full text-xs sm:text-sm px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {isTa ? 'அதிகபட்ச தேர்வுகள் (Max)' : 'Max Selections Allowed'}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={currentGroup.maxSelections}
                      onChange={(e) =>
                        handleUpdateGroup(currentGroup.id, { maxSelections: Math.max(1, parseInt(e.target.value) || 1) })
                      }
                      className="w-full text-xs sm:text-sm px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Group Dishes List */}
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <span>{isTa ? 'உணவு பட்டியல்' : 'Dishes in this Group'}</span>
                      <span className="text-[11px] font-normal text-slate-500">
                        ({currentGroup.dishes.length} {isTa ? 'வகைகள்' : 'items'})
                      </span>
                    </h5>

                    <button
                      type="button"
                      onClick={() => setAddingDishGroupId(currentGroup.id)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 px-3 py-1.5 rounded-xl shadow-xs transition-colors cursor-pointer"
                    >
                      <Plus size={13} />
                      <span>{isTa ? 'உணவைச் சேர்' : 'Add Dish from Catalogue'}</span>
                    </button>
                  </div>

                  {/* Add Dish Dropdown / Selector */}
                  {addingDishGroupId === currentGroup.id && (
                    <div className="mb-4 p-3 bg-emerald-50 border border-emerald-300 rounded-2xl space-y-2.5 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-900">
                          {isTa ? 'கேட்டலாக்கிலிருந்து உணவைத் தேர்ந்தெடுக்கவும்:' : 'Select Dish from Catalogue:'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setAddingDishGroupId(null)}
                          className="text-slate-400 hover:text-slate-700 text-xs"
                        >
                          {isTa ? 'ரத்து' : 'Cancel'}
                        </button>
                      </div>

                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder={isTa ? 'உணவு பெயர் தேடவும்...' : 'Search dish name...'}
                          value={dishSearch}
                          onChange={(e) => setDishSearch(e.target.value)}
                          className="w-full text-xs pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div className="max-h-48 overflow-y-auto space-y-1 pr-1 bg-white p-2 rounded-xl border border-emerald-200">
                        {filteredDishesToAdd.length === 0 ? (
                          <p className="text-xs text-slate-400 text-center py-2">
                            {isTa ? 'உணவுகள் எதுவும் கிடைக்கவில்லை' : 'No matching dishes found in catalogue.'}
                          </p>
                        ) : (
                          filteredDishesToAdd.slice(0, 15).map((d) => (
                            <div
                              key={d.id}
                              onClick={() => handleAddDishToGroup(currentGroup.id, d)}
                              className="flex items-center justify-between p-2 hover:bg-emerald-50 rounded-lg cursor-pointer transition-colors text-xs"
                            >
                              <div className="flex items-center gap-2">
                                {d.image && (
                                  <img src={d.image} alt="" className="w-7 h-7 rounded-md object-cover" />
                                )}
                                <div>
                                  <span className="font-bold text-slate-800">{d.name}</span>
                                  {d.nameTa && <span className="text-slate-500 ml-1.5">({d.nameTa})</span>}
                                </div>
                              </div>
                              <span className="text-emerald-700 font-bold text-[11px]">+ Add</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* Dishes Table */}
                  <div className="space-y-2">
                    {currentGroup.dishes.length === 0 ? (
                      <div className="text-center py-8 text-xs text-slate-400 bg-white rounded-2xl border border-dashed border-slate-300">
                        {isTa
                          ? 'இந்தக் குழுவில் இன்னும் எந்த உணவும் சேர்க்கப்படவில்லை. மேலே உள்ள "உணவைச் சேர்" பொத்தானைக் கிளிக் செய்யவும்.'
                          : 'No dishes added to this group yet. Click "+ Add Dish from Catalogue" above.'}
                      </div>
                    ) : (
                      currentGroup.dishes.map((dish) => (
                        <div
                          key={dish.dishId}
                          className="flex items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-2xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {dish.image && (
                              <img src={dish.image} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                            )}
                            <div className="min-w-0">
                              <h6 className="text-xs sm:text-sm font-bold text-slate-800 truncate">
                                {dish.dishName}
                              </h6>
                              {dish.dishNameTa && (
                                <p className="text-[11px] text-slate-500 truncate">{dish.dishNameTa}</p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            {/* Preselected / Default toggle */}
                            <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 cursor-pointer bg-slate-50 hover:bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                              <input
                                type="checkbox"
                                checked={dish.isDefault}
                                onChange={() => handleToggleDishDefault(currentGroup.id, dish.dishId)}
                                className="w-3.5 h-3.5 text-emerald-600 rounded cursor-pointer"
                              />
                              <span>{isTa ? 'இயல்புநிலை' : 'Default'}</span>
                            </label>

                            {/* Required Dish toggle */}
                            <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 cursor-pointer bg-slate-50 hover:bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                              <input
                                type="checkbox"
                                checked={dish.isRequired}
                                onChange={() => handleToggleDishRequired(currentGroup.id, dish.dishId)}
                                className="w-3.5 h-3.5 text-emerald-600 rounded cursor-pointer"
                              />
                              <span>{isTa ? 'கட்டாயம்' : 'Required'}</span>
                            </label>

                            <button
                              type="button"
                              onClick={() => handleRemoveDishFromGroup(currentGroup.id, dish.dishId)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Remove"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {isTa ? 'மாற்றங்கள் உடனடியாக அமலுக்கு வரும்.' : 'Changes will be saved to Supabase & local storage.'}
            </span>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                {isTa ? 'ரத்து' : 'Cancel'}
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 transition-all shadow-md hover:shadow-lg cursor-pointer"
              >
                <Save size={15} />
                <span>{saving ? (isTa ? 'சேமிக்கப்படுகிறது...' : 'Saving...') : (isTa ? 'மாற்றங்களைச் சேமி' : 'Save Changes')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};