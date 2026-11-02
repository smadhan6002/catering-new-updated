import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { User, ChevronDown, Check } from 'lucide-react';
import { categories } from './data/menu';
import { CartProvider } from './context/CartContext';
import { LanguageProvider, useLanguage, type Language } from './context/LanguageContext';
import { Hero } from './components/Hero';
import { CategoryNav } from './components/CategoryNav';
import { MenuSection } from './components/MenuSection';
import { CartActionBar } from './components/CartActionBar';
import { CartDrawer } from './components/CartDrawer';
import { RiceSuggestionModal } from './components/RiceSuggestionModal';
import { AdminPage } from './components/admin/AdminPage';
import { Footer } from './components/Footer';
import { FoodImageDisclaimer } from './components/FoodImageDisclaimer';
import logoImg from './assets/LOGO.png';

function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const options: { value: Language; label: string; native: string }[] = [
    { value: 'en', label: 'English', native: 'English' },
    { value: 'ta', label: 'Tamil', native: 'தமிழ்' },
  ];

  const current = options.find((o) => o.value === lang) ?? options[0];

  return (
    <div ref={ref} className="relative" id="language-switcher">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Language: ${current.native}`}
        className="bg-white hover:bg-orange-50 text-slate-800 text-xs sm:text-sm font-semibold px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl border border-slate-200 transition-all duration-150 flex items-center gap-1 sm:gap-1.5 cursor-pointer shadow-2xs"
      >
        <span className="text-xs sm:text-sm leading-none">{lang === 'ta' ? '🇮🇳' : '🌐'}</span>
        <span className="hidden min-[380px]:inline text-xs sm:text-sm">{current.native}</span>
        <ChevronDown className={`w-3 h-3 text-primary transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Select language"
          className="absolute top-full right-0 mt-2 z-50 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden min-w-[130px]"
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              role="option"
              aria-selected={lang === opt.value}
              onClick={() => {
                setLang(opt.value);
                setOpen(false);
              }}
              className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-xs sm:text-sm transition-colors cursor-pointer ${
                lang === opt.value
                  ? 'bg-orange-50 text-primary font-bold'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>{opt.native}</span>
              {lang === opt.value && <Check className="w-3.5 h-3.5 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminLoginButton() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  return (
    <button
      onClick={() => navigate('/admin')}
      className="bg-primary hover:bg-[#c2410c] text-white text-xs sm:text-sm font-semibold px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-xl shadow-xs hover:shadow-md transition-all duration-150 flex items-center gap-1.5 cursor-pointer border border-orange-600/30 active:scale-[0.98]"
      aria-label="Admin login"
    >
      <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
      <span>{t.admin}</span>
    </button>
  );
}

function MainApp() {
  const { lang, businessName } = useLanguage();
  const [activeCategory, setActiveCategory] = React.useState(categories[0].id);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (visible) {
          const id = visible.target.id.replace('category-', '');
          setActiveCategory(id);
        }
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );

    categories.forEach((cat) => {
      const el = document.getElementById(`category-${cat.id}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24">
      {/* Header — White with Orange Branding */}
      <header className="sticky top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 md:h-18 flex items-center justify-between gap-2">
          {/* Logo & Business Name */}
          <a
            href="/"
            className="flex items-center gap-2 sm:gap-3 group min-w-0"
            aria-label={`${businessName} Home`}
          >
            <img
              src={logoImg}
              alt={`${businessName} Logo`}
              className="h-9 w-9 sm:h-11 sm:w-11 md:h-12 md:w-12 object-contain rounded-full border border-slate-200 bg-white p-0.5 shadow-2xs transition-transform group-hover:scale-105 duration-200 flex-shrink-0"
            />
            <div className="min-w-0">
              <span className="block font-bold text-sm sm:text-base md:text-xl text-slate-900 tracking-tight truncate group-hover:text-primary transition-colors">
                {businessName}
              </span>
              <span className="hidden sm:block text-[10px] md:text-xs font-medium text-slate-500 -mt-0.5 truncate">
                {lang === 'ta' ? 'பாரம்பரிய கேட்டரிங் சேவைகள்' : 'Authentic Traditional Feast Catering'}
              </span>
            </div>
          </a>

          {/* Controls: Language & Admin */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 flex-shrink-0">
            <LanguageSwitcher />
            <AdminLoginButton />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <Hero />

      {/* Sticky Category Navigation */}
      <CategoryNav categories={categories} activeCategory={activeCategory} />

      {/* Menu Section Grid */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <FoodImageDisclaimer />
        {categories.map((category) => (
          <MenuSection key={category.id} category={category} />
        ))}
      </main>

      {/* Footer */}
      <Footer />

      {/* Cart & Drawer */}
      <CartActionBar />
      <CartDrawer />
      <RiceSuggestionModal />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <CartProvider>
          <Routes>
            <Route path="/" element={<MainApp />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/admin/*" element={<AdminPage />} />
          </Routes>
        </CartProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}
