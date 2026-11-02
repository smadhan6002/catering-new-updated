import React, { useState } from 'react';
import { Download, FileText, CheckCircle2, Loader2, Sparkles, Eye, Utensils } from 'lucide-react';
import { categories as staticCategories } from '../../data/menu';
import { dishService } from '../../services/dishService';
import { generateMenuPDF } from '../../utils/generateMenuPDF';
import { useLanguage } from '../../context/LanguageContext';
import { siteConfig } from '../../config/site';

export const AdminMenuPDF: React.FC = () => {
  const { t, lang, dishName: getDishNameTa } = useLanguage();
  const isTa = lang === 'ta';

  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState({ percent: 0, status: '' });
  const [success, setSuccess] = useState(false);

  const adminDishes = dishService.getAll();
  const totalDishes = staticCategories.reduce((s, c) => s + c.items.length, 0) + adminDishes.length;
  const totalCategories = staticCategories.length;

  async function handleDownload() {
    setDownloading(true);
    setSuccess(false);
    setProgress({ percent: 5, status: 'Initializing…' });

    try {
      await generateMenuPDF((percent, status) => {
        setProgress({ percent, status });
      }, lang);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err) {
      console.error('Failed to generate menu PDF:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {isTa ? 'உணவு மெனு PDF பட்டியல்' : 'Food Menu PDF'}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {isTa
              ? 'அனைத்து பிரிவுகள் மற்றும் உணவுகளுடன் கூடிய தொழில்முறை மெனு PDF-ஐப் பதிவிறக்கவும்'
              : 'Generate and download a high-quality, professional catering menu PDF with Tamil Unicode'}
          </p>
        </div>

        <button
          onClick={handleDownload}
          disabled={downloading}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-white font-semibold text-sm rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50"
        >
          {downloading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              <span>{progress.status || (isTa ? 'தயாராகிறது...' : 'Generating PDF...')}</span>
            </>
          ) : (
            <>
              <Download size={18} />
              <span>{isTa ? 'உணவு மெனு PDF பதிவிறக்கு' : 'Download Food Menu PDF'}</span>
            </>
          )}
        </button>
      </div>

      {/* Progress & Success notification */}
      {downloading && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
            <span>{progress.status}</span>
            <span>{progress.percent}%</span>
          </div>
          <div className="w-full bg-orange-200/70 rounded-full h-2 overflow-hidden">
            <div
              className="bg-primary h-full transition-all duration-300"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3 text-green-800 text-sm">
          <CheckCircle2 size={20} className="text-green-600 flex-shrink-0" />
          <span>
            {isTa
              ? 'உணவு மெனு PDF வெற்றிகரமாகப் பதிவிறக்கப்பட்டது! (Kanchi_Ambal_Catering_Food_Menu.pdf)'
              : 'Food Menu PDF generated and downloaded successfully! (Kanchi_Ambal_Catering_Food_Menu.pdf)'}
          </span>
        </div>
      )}

      {/* Menu Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-100 text-primary flex items-center justify-center flex-shrink-0">
            <Utensils size={22} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{totalDishes}</p>
            <p className="text-xs text-slate-500 mt-0.5">{isTa ? 'மொத்த உணவுகள்' : 'Total Food Items'}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
            <FileText size={22} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{totalCategories}</p>
            <p className="text-xs text-slate-500 mt-0.5">{isTa ? 'பிரிவுகள் (Categories)' : 'Menu Categories'}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <Sparkles size={22} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">A4 • 300 DPI</p>
            <p className="text-xs text-slate-500 mt-0.5">{isTa ? 'இருமொழி வடிவம் (Tamil & English)' : 'Bilingual Printable Layout'}</p>
          </div>
        </div>
      </div>

      {/* Category Breakdown & Dish Previews */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <Eye size={18} className="text-primary" />
            {isTa ? 'மெனு உள்ளடக்க முன்னோட்டம்' : 'Included Menu Categories & Dishes'}
          </h3>
          <span className="text-xs text-slate-400 font-medium">
            {siteConfig.name}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {staticCategories.map((cat) => (
            <div
              key={cat.id}
              className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2 hover:border-slate-200 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">{cat.name}</h4>
                  <p className="text-xs text-slate-500 font-medium">{t.categories[cat.id] || cat.name}</p>
                </div>
                <span className="text-xs font-semibold bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
                  {cat.items.length} {isTa ? 'பொருட்கள்' : 'items'}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {cat.items.slice(0, 6).map((item) => (
                  <span
                    key={item.id}
                    className="text-[11px] bg-white border border-slate-200/80 text-slate-700 px-2 py-0.5 rounded"
                  >
                    {isTa ? getDishNameTa(item.id, item.name) : item.name}
                  </span>
                ))}
                {cat.items.length > 6 && (
                  <span className="text-[11px] text-slate-400 self-center">
                    +{cat.items.length - 6} more
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
