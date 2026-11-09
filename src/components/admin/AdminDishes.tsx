import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  X,
  UploadCloud,
  Check,
  AlertTriangle,
  Layers,
  Search,
  Eye,
  EyeOff,
  Filter,
} from 'lucide-react';
import { categories as staticCategories } from '../../data/menu';
import { dishService, type UnifiedDish } from '../../services/dishService';
import { storageService } from '../../services/storageService';
import { MEASUREMENT_UNITS } from '../../data/units';
import { useLanguage } from '../../context/LanguageContext';

const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB limit for base64 storage

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function resizeImage(file: File, maxPx = 600): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.onerror = reject;
    img.src = url;
  });
}

interface DishFormData {
  id?: string;
  name: string;
  nameTa: string;
  categoryId: string;
  imagePreview: string;
  imageFile: File | null;
  defaultUnit: string;
  isActive: boolean;
  isBuiltIn?: boolean;
}

const emptyForm = (): DishFormData => ({
  name: '',
  nameTa: '',
  categoryId: staticCategories[0]?.id ?? '',
  imagePreview: '',
  imageFile: null,
  defaultUnit: 'Pieces',
  isActive: true,
  isBuiltIn: false,
});

export const AdminDishes: React.FC = () => {
  const { lang, dishName: getDishNameTa, t } = useLanguage();
  const isTa = lang === 'ta';

  const [activeTab, setActiveTab] = useState<'all' | 'admin' | 'deactivated' | 'units'>('all');
  const [dishes, setDishes] = useState<UnifiedDish[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingDish, setEditingDish] = useState<UnifiedDish | null>(null);
  const [form, setForm] = useState<DishFormData>(emptyForm());
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<UnifiedDish | null>(null);
  const [toast, setToast] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Unit configuration search
  const [unitSearch, setUnitSearch] = useState('');
  const [unitCategoryFilter, setUnitCategoryFilter] = useState('all');

  const allCategories = staticCategories.map((c) => ({
    id: c.id,
    name: c.name,
    nameTa: t.categories?.[c.id] || c.name,
  }));

  function loadDishes() {
    setDishes(dishService.getAllDishes());
  }

  useEffect(() => {
    loadDishes();
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  function openAdd() {
    setEditingDish(null);
    setForm(emptyForm());
    setFormError('');
    setShowForm(true);
  }

  function openEdit(dish: UnifiedDish) {
    setEditingDish(dish);
    setForm({
      id: dish.id,
      name: dish.name,
      nameTa: dish.nameTa || getDishNameTa(dish.id, dish.name),
      categoryId: dish.categoryId,
      imagePreview: dish.image,
      imageFile: null,
      defaultUnit: dish.defaultUnit || 'Pieces',
      isActive: dish.isActive,
      isBuiltIn: dish.isBuiltIn,
    });
    setFormError('');
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingDish(null);
    setForm(emptyForm());
    setFormError('');
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFormError(isTa ? 'செல்லுபடியாகும் படக் கோப்பைத் தேர்ந்தெடுக்கவும் (JPG, PNG, WEBP).' : 'Please select a valid image file (JPG, PNG, WEBP).');
      return;
    }
    setFormError('');
    try {
      const preview = file.size > MAX_IMAGE_SIZE
        ? await resizeImage(file)
        : await fileToBase64(file);
      setForm((f) => ({ ...f, imagePreview: preview, imageFile: file }));
    } catch {
      setFormError(isTa ? 'படத்தை ஏற்றுவதில் தோல்வி. வேறு கோப்பை முயற்சிக்கவும்.' : 'Failed to load image. Try a different file.');
    }
  }

  async function handleSave() {
    setFormError('');
    if (!form.name.trim()) {
      setFormError(isTa ? 'உணவின் ஆங்கிலப் பெயர் அவசியம்.' : 'Dish English name is required.');
      return;
    }
    if (!form.categoryId) {
      setFormError(isTa ? 'தயவுசெய்து ஒரு உணவுப் பிரிவைத் தேர்ந்தெடுக்கவும்.' : 'Please select a category.');
      return;
    }
    if (!form.imagePreview) {
      setFormError(isTa ? 'தயவுசெய்து உணவுப் புகைப்படத்தை பதிவேற்றவும்.' : 'Please upload or provide a dish image.');
      return;
    }

    setSaving(true);
    try {
      let finalImageUrl = form.imagePreview;
      if (form.imageFile) {
        const uploadRes = await storageService.uploadDishImage(form.imageFile, form.name);
        if (uploadRes.url) {
          finalImageUrl = uploadRes.url;
        }
      }

      if (editingDish) {
        // Edit existing dish (built-in or custom)
        dishService.updateDish(editingDish.id, {
          name: form.name.trim(),
          nameTa: form.nameTa.trim() || undefined,
          categoryId: form.categoryId,
          image: finalImageUrl,
          defaultUnit: form.defaultUnit,
          isActive: form.isActive,
        });
        showToast(isTa ? 'உணவு விவரங்கள் வெற்றிகரமாக புதுப்பிக்கப்பட்டன!' : 'Dish updated successfully.');
      } else {
        // Add new custom dish
        dishService.add({
          name: form.name.trim(),
          nameTa: form.nameTa.trim() || undefined,
          categoryId: form.categoryId,
          image: finalImageUrl,
          defaultUnit: form.defaultUnit,
        });
        showToast(isTa ? 'புதிய உணவு வெற்றிகரமாக சேர்க்கப்பட்டது!' : 'New dish added successfully.');
      }
      loadDishes();
      closeForm();
    } catch (err) {
      setFormError(isTa ? 'உணவு சேமிப்பதில் பிழை ஏற்பட்டது.' : 'Failed to save dish. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function handleToggleActive(dish: UnifiedDish) {
    if (dish.isActive) {
      dishService.deactivateDish(dish.id);
      showToast(isTa ? `"${dish.name}" இணையதளத்திலிருந்து மறைக்கப்பட்டது.` : `"${dish.name}" hidden from customer menu.`);
    } else {
      dishService.reactivateDish(dish.id);
      showToast(isTa ? `"${dish.name}" மீண்டும் இணையதளத்தில் காட்டப்படும்.` : `"${dish.name}" reactivated on customer menu.`);
    }
    loadDishes();
  }

  function handleDelete(dish: UnifiedDish) {
    dishService.deleteDish(dish.id);
    loadDishes();
    setDeleteConfirm(null);
    showToast(isTa ? `"${dish.name}" நீக்கப்பட்டது (வரலாற்று ஆர்டர்கள் பாதுகாக்கப்பட்டுள்ளன).` : `"${dish.name}" removed (historical orders preserved).`);
  }

  function handleSetDishUnit(dishId: string, unit: string) {
    dishService.setUnitOverride(dishId, unit);
    loadDishes();
    showToast(isTa ? `அளவீட்டு அலகு ${unit} என புதுப்பிக்கப்பட்டது.` : `Measurement unit updated to ${unit}`);
  }

  // Filtered dishes
  const filteredDishes = useMemo(() => {
    let list = [...dishes];

    // Tab filter
    if (activeTab === 'admin') {
      list = list.filter((d) => d.isAdminAdded);
    } else if (activeTab === 'deactivated') {
      list = list.filter((d) => !d.isActive);
    }

    // Category filter
    if (categoryFilter !== 'all') {
      list = list.filter((d) => d.categoryId === categoryFilter);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((d) => {
        const enMatch = d.name.toLowerCase().includes(q);
        const taMatch = (d.nameTa || '').toLowerCase().includes(q);
        const catMatch = (d.categoryName || '').toLowerCase().includes(q);
        const idMatch = d.id.toLowerCase().includes(q);
        return enMatch || taMatch || catMatch || idMatch;
      });
    }

    return list;
  }, [dishes, activeTab, categoryFilter, searchQuery]);

  // Unit configuration items
  const allDishesForUnits = useMemo(() => {
    let list = [...dishes];
    if (unitCategoryFilter !== 'all') {
      list = list.filter((d) => d.categoryId === unitCategoryFilter);
    }
    if (unitSearch.trim()) {
      const q = unitSearch.toLowerCase().trim();
      list = list.filter((d) => {
        const enMatch = d.name.toLowerCase().includes(q);
        const taMatch = (d.nameTa || '').toLowerCase().includes(q);
        return enMatch || taMatch;
      });
    }
    return list;
  }, [dishes, unitCategoryFilter, unitSearch]);

  const activeCount = dishes.filter((d) => d.isActive).length;
  const adminCount = dishes.filter((d) => d.isAdminAdded).length;
  const deactivatedCount = dishes.filter((d) => !d.isActive).length;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-[200] bg-slate-900 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm border border-slate-700 animate-in fade-in slide-in-from-top-2 duration-200">
          <Check size={16} className="text-green-400" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
            {isTa ? 'உணவு வகைகள் மேலாண்மை' : 'Dish & Menu Management'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {isTa
              ? 'உணவுகளின் ஆங்கிலம் & தமிழ் பெயர்கள், பிரிவுகள், புகைப்படங்கள் மற்றும் அளவீட்டு அலகுகளை நிர்வகிக்கவும்'
              : 'Manage existing dishes, Tamil/English names, categories, images, and measurement units'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition-all duration-150 cursor-pointer"
          >
            <Plus size={18} />
            <span>{isTa ? 'புதிய உணவு சேர்க்க' : 'Add New Dish'}</span>
          </button>
        </div>
      </div>

      {/* Tabs & Counts */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer border-b-2 flex items-center gap-2 ${
            activeTab === 'all'
              ? 'border-primary text-primary bg-blue-50/70'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>{isTa ? 'அனைத்து உணவுகள்' : 'All Dishes'}</span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
            {activeCount}/{dishes.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('admin')}
          className={`px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer border-b-2 flex items-center gap-2 ${
            activeTab === 'admin'
              ? 'border-primary text-primary bg-blue-50/70'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>{isTa ? 'நிர்வாகியால் சேர்க்கப்பட்டவை' : 'Admin Custom'}</span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-primary font-bold">
            {adminCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('deactivated')}
          className={`px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer border-b-2 flex items-center gap-2 ${
            activeTab === 'deactivated'
              ? 'border-primary text-primary bg-blue-50/70'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>{isTa ? 'மறைக்கப்பட்ட உணவுகள்' : 'Deactivated / Hidden'}</span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
            {deactivatedCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('units')}
          className={`px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer border-b-2 flex items-center gap-2 ${
            activeTab === 'units'
              ? 'border-primary text-primary bg-blue-50/70'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>{isTa ? 'அளவீட்டு அலகுகள் (Units Config)' : 'Units Config'}</span>
        </button>
      </div>

      {/* DISHES TAB CONTENT (ALL / ADMIN / DEACTIVATED) */}
      {activeTab !== 'units' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative flex-1 w-full">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isTa ? 'உணவு பெயர் (தமிழ் / English) அல்லது எண் மூலம் தேடவும்...' : 'Search by dish name (English or தமிழ்) or ID…'}
                className="w-full pl-9 pr-4 py-2.5 text-xs sm:text-sm bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X size={15} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter size={15} className="text-slate-400 hidden sm:block" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full sm:w-56 px-3 py-2.5 text-xs sm:text-sm font-medium bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
              >
                <option value="all">{isTa ? 'அனைத்துப் பிரிவுகள் (All Categories)' : 'All Categories'}</option>
                {allCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {isTa ? c.nameTa : c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Results Summary */}
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              {isTa ? 'காட்டப்படும் உணவுகள்:' : 'Showing dishes:'} <strong className="text-slate-800">{filteredDishes.length}</strong>
            </span>
            {categoryFilter !== 'all' && (
              <button
                onClick={() => setCategoryFilter('all')}
                className="text-primary hover:underline font-medium cursor-pointer"
              >
                {isTa ? 'பிரிவு வடிகட்டியை நீக்கு' : 'Clear filter'}
              </button>
            )}
          </div>

          {/* Dishes Grid */}
          {filteredDishes.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 py-16 text-center text-slate-400 p-4">
              <Layers size={44} className="mx-auto mb-3 text-slate-300" />
              <p className="text-sm font-bold text-slate-800">
                {isTa ? 'உணவுகள் எதுவும் கிடைக்கவில்லை' : 'No dishes found'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {isTa ? 'உங்கள் தேடல் அல்லது வடிகட்டியை மாற்றி முயற்சிக்கவும்.' : 'Try adjusting your search query or category filter.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredDishes.map((dish) => {
                const taName = dish.nameTa || getDishNameTa(dish.id, dish.name);
                return (
                  <div
                    key={dish.id}
                    className={`bg-white rounded-2xl border transition-all duration-150 overflow-hidden shadow-xs hover:shadow-md flex flex-col ${
                      dish.isActive ? 'border-slate-200/80' : 'border-amber-200 bg-amber-50/20 opacity-80'
                    }`}
                  >
                    {/* Image Header with Badges */}
                    <div className="h-40 bg-slate-100 overflow-hidden relative group">
                      <img
                        src={dish.image}
                        alt={dish.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          // Fallback placeholder
                          (e.currentTarget as HTMLImageElement).src =
                            'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
                        }}
                      />
                      {/* Top Badges */}
                      <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
                        <span className="bg-slate-900/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-xs">
                          {dish.defaultUnit}
                        </span>
                        {dish.isAdminAdded ? (
                          <span className="bg-primary/90 text-white text-[9px] font-bold px-2 py-0.5 rounded-full backdrop-blur-xs">
                            {isTa ? 'நிர்வாக உணவு' : 'Custom'}
                          </span>
                        ) : (
                          <span className="bg-blue-600/90 text-white text-[9px] font-bold px-2 py-0.5 rounded-full backdrop-blur-xs">
                            {isTa ? 'முதன்மை மெனு' : 'Built-in'}
                          </span>
                        )}
                      </div>

                      {/* Active / Inactive Badge */}
                      <div className="absolute top-2 right-2">
                        {dish.isActive ? (
                          <span className="bg-green-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-xs flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            {isTa ? 'செயலில்' : 'Active'}
                          </span>
                        ) : (
                          <span className="bg-amber-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-xs flex items-center gap-1">
                            <EyeOff size={11} />
                            {isTa ? 'மறைக்கப்பட்டது' : 'Hidden'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Dish Info */}
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-bold text-slate-900 text-sm leading-snug">
                            {dish.name}
                          </h3>
                        </div>
                        {taName && (
                          <p className="text-xs font-semibold text-primary mt-0.5 font-tamil">
                            {taName}
                          </p>
                        )}
                        <p className="text-[11px] text-slate-500 mt-1 font-medium flex items-center gap-1">
                          <span>{dish.categoryName}</span>
                          <span>•</span>
                          <span className="font-mono text-[10px] text-slate-400">{dish.id}</span>
                        </p>
                      </div>

                      {/* Action Buttons */}
                      <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between gap-1">
                        <button
                          onClick={() => handleToggleActive(dish)}
                          title={dish.isActive ? (isTa ? 'இணையதளத்திலிருந்து மறை' : 'Hide from website') : (isTa ? 'மீண்டும் இயக்கு' : 'Reactivate on website')}
                          className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors ${
                            dish.isActive
                              ? 'text-slate-500 hover:text-amber-700 hover:bg-amber-50'
                              : 'text-green-700 bg-green-50 hover:bg-green-100'
                          }`}
                        >
                          {dish.isActive ? <EyeOff size={15} /> : <Eye size={15} />}
                          <span className="text-[11px]">
                            {dish.isActive ? (isTa ? 'மறை' : 'Hide') : (isTa ? 'இயக்கு' : 'Show')}
                          </span>
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(dish)}
                            title={isTa ? 'உணவைத் திருத்த' : 'Edit dish'}
                            className="p-1.5 text-slate-600 hover:text-primary hover:bg-blue-50 rounded-lg cursor-pointer transition-colors flex items-center gap-1"
                          >
                            <Pencil size={15} />
                            <span className="text-[11px] font-medium">{isTa ? 'திருத்து' : 'Edit'}</span>
                          </button>

                          <button
                            onClick={() => setDeleteConfirm(dish)}
                            title={isTa ? 'நீக்க / செயலிழக்க' : 'Deactivate / Remove'}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: MEASUREMENT UNITS CONFIGURATION */}
      {activeTab === 'units' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-6 space-y-6">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative flex-1 w-full">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={isTa ? 'உணவுப் பெயரைத் தேடி அலகை மாற்றவும் (Coffee, Tea, Sweets, Rice…)' : 'Search dish to change measurement unit (Coffee, Tea, Sweets, Rice…)'}
                value={unitSearch}
                onChange={(e) => setUnitSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <select
              value={unitCategoryFilter}
              onChange={(e) => setUnitCategoryFilter(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 text-xs sm:text-sm font-medium bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
            >
              <option value="all">{isTa ? 'அனைத்து பிரிவுகள்' : 'All Categories'}</option>
              {allCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {isTa ? c.nameTa : c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-700 uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3 text-left">{isTa ? 'உணவு பெயர்' : 'Dish Name'}</th>
                  <th className="px-4 py-3 text-left">{isTa ? 'பிரிவு' : 'Category'}</th>
                  <th className="px-4 py-3 text-left">{isTa ? 'தற்போதைய அலகு' : 'Current Default Unit'}</th>
                  <th className="px-4 py-3 text-left">{isTa ? 'அலகு மாற்று' : 'Change Unit'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allDishesForUnits.map((dish) => {
                  const taName = dish.nameTa || getDishNameTa(dish.id, dish.name);
                  return (
                    <tr key={dish.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-900">{dish.name}</p>
                        {taName && taName !== dish.name && (
                          <p className="text-xs text-primary font-tamil">{taName}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{dish.categoryName}</td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-xs bg-blue-50 text-blue-900 border border-blue-200 px-2.5 py-1 rounded-md">
                          {dish.defaultUnit}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={dish.defaultUnit}
                          onChange={(e) => handleSetDishUnit(dish.id, e.target.value)}
                          className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                        >
                          {MEASUREMENT_UNITS.map((u) => (
                            <option key={u.id} value={u.id}>
                              {isTa ? u.labelTa : u.labelEn}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ADD / EDIT DISH MODAL */}
      {showForm && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[92vh] flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-primary flex items-center justify-center">
                  {editingDish ? <Pencil size={16} /> : <Plus size={18} />}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                    {editingDish
                      ? (isTa ? 'உணவு விவரங்களைத் திருத்து' : 'Edit Dish Details')
                      : (isTa ? 'புதிய உணவைச் சேர்க்க' : 'Add New Dish')}
                  </h3>
                  {editingDish && (
                    <p className="text-[11px] text-slate-400 font-mono">ID: {editingDish.id}</p>
                  )}
                </div>
              </div>
              <button onClick={closeForm} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs sm:text-sm">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl text-xs flex items-center gap-2">
                  <AlertTriangle size={15} className="flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* English Name */}
              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  {isTa ? 'உணவின் பெயர் (ஆங்கிலத்தில்)' : 'Dish Name (English)'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={isTa ? 'உதாரணம்: Special Ghee Pongal' : 'e.g. Special Ghee Pongal'}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 text-slate-900 font-medium"
                />
              </div>

              {/* Tamil Name */}
              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  {isTa ? 'உணவின் பெயர் (தமிழில்)' : 'Tamil Display Name (தமிழில்)'}
                </label>
                <input
                  type="text"
                  value={form.nameTa}
                  onChange={(e) => setForm((f) => ({ ...f, nameTa: e.target.value }))}
                  placeholder={isTa ? 'உதாரணம்: ஸ்பெஷல் நெய் பொங்கல்' : 'e.g. ஸ்பெஷல் நெய் பொங்கல்'}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 text-slate-900 font-tamil font-medium"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  {isTa ? 'வாடிக்கையாளர் இணையதளத்தில் தமிழ் மொழியைத் தேர்ந்தெடுக்கும் போது காட்டப்படும்.' : 'Displayed when customer switches website to Tamil.'}
                </p>
              </div>

              {/* Category */}
              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  {isTa ? 'உணவுப் பிரிவு (Category)' : 'Menu Category'} <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.categoryId}
                  onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 bg-white cursor-pointer font-medium"
                >
                  {allCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {isTa ? `${c.nameTa} (${c.name})` : `${c.name} (${c.nameTa})`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Measurement Unit */}
              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  {isTa ? 'இயல்புநிலை அளவீட்டு அலகு (Default Unit)' : 'Default Measurement Unit'}
                </label>
                <select
                  value={form.defaultUnit}
                  onChange={(e) => setForm((f) => ({ ...f, defaultUnit: e.target.value }))}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 bg-white cursor-pointer font-medium"
                >
                  {MEASUREMENT_UNITS.map((u) => (
                    <option key={u.id} value={u.id}>
                      {isTa ? u.labelTa : u.labelEn}
                    </option>
                  ))}
                </select>
              </div>

              {/* Image Upload & Preview */}
              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  {isTa ? 'உணவுப் புகைப்படம்' : 'Dish Image'} <span className="text-red-500">*</span>
                </label>

                {form.imagePreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-slate-300 h-44 bg-slate-100 flex items-center justify-center">
                    <img src={form.imagePreview} alt="Dish Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, imagePreview: '', imageFile: null }))}
                      className="absolute top-2 right-2 bg-slate-900/80 hover:bg-slate-900 text-white p-1.5 rounded-full cursor-pointer transition-colors"
                      title={isTa ? 'படத்தை நீக்கு' : 'Remove image'}
                    >
                      <X size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="absolute bottom-2 right-2 bg-white/90 hover:bg-white text-slate-800 text-xs font-semibold px-2.5 py-1 rounded-lg shadow-sm border border-slate-200 cursor-pointer"
                    >
                      {isTa ? 'படத்தை மாற்று' : 'Change Image'}
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-primary rounded-xl p-6 text-center cursor-pointer bg-slate-50 hover:bg-blue-50/30 transition-colors"
                  >
                    <UploadCloud size={32} className="mx-auto text-slate-400 mb-2" />
                    <p className="text-xs font-semibold text-slate-700">
                      {isTa ? 'புகைப்படத்தை தேர்ந்தெடுக்க கிளிக் செய்யவும்' : 'Click to select or upload dish photo'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">PNG, JPG, WEBP (Max 2MB)</p>
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </div>

              {/* Active on Website Toggle */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <p className="font-semibold text-slate-900 text-xs sm:text-sm">
                    {isTa ? 'இணையதளத்தில் நேரலையில் காட்டு' : 'Active on Customer Website'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {isTa
                      ? 'செயலிழக்கச் செய்தால் வாடிக்கையாளருக்கு மெனுவில் காட்டப்படாது, ஆனால் பழைய ஆர்டர்கள் அப்படியே இருக்கும்.'
                      : 'When disabled, customers will not see this dish, while preserving past order records.'}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="w-5 h-5 accent-primary cursor-pointer rounded"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-200 flex items-center justify-end gap-3 bg-slate-50/50">
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl font-medium text-xs sm:text-sm cursor-pointer transition-colors"
              >
                {isTa ? 'ரத்து செய்' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold text-xs sm:text-sm shadow-sm cursor-pointer transition-colors disabled:opacity-60 flex items-center gap-1.5"
              >
                {saving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{isTa ? 'சேமிக்கப்படுகிறது...' : 'Saving…'}</span>
                  </>
                ) : (
                  <span>{isTa ? 'மாற்றங்களைச் சேமி' : 'Save Changes'}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE / DEACTIVATE CONFIRMATION MODAL */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle size={24} />
            </div>

            <div className="text-center">
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                {isTa ? 'உணவை நீக்க / மறைக்க வேண்டுமா?' : 'Remove or Deactivate Dish?'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-2">
                {isTa
                  ? `"${deleteConfirm.name}" உணவை இணையதள மெனுவிலிருந்து நீக்க விரும்புகிறீர்களா? வரலாற்று ஆர்டர்கள் பாதுகாக்கப்படும்.`
                  : `Are you sure you want to remove "${deleteConfirm.name}" from the active menu? Historical customer orders and records will remain completely intact.`}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl font-medium text-xs sm:text-sm cursor-pointer"
              >
                {isTa ? 'ரத்து' : 'Cancel'}
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold text-xs sm:text-sm shadow-sm cursor-pointer"
              >
                {isTa ? 'ஆம், நீக்கு' : 'Confirm Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
