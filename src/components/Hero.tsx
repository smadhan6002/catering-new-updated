import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { generateMenuPDF } from '../utils/generateMenuPDF';
import heroImg from '../assets/Home section.jpg';
import { Download, Utensils } from 'lucide-react';

export const Hero: React.FC = () => {
  const { t, lang, businessName } = useLanguage();
  const [downloading, setDownloading] = useState(false);

  async function handleDownloadMenu() {
    setDownloading(true);
    try {
      await generateMenuPDF(undefined, lang);
    } catch (err) {
      console.error(err);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section className="relative w-full min-h-[360px] sm:min-h-[420px] md:min-h-[480px] flex items-center justify-center overflow-hidden border-b border-orange-100">
      {/* Background Image: sharp, vibrant, no blur */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${heroImg})`,
        }}
      />

      {/* Gentle overlay to preserve vibrant food colors while blending at bottom */}
      <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/15 via-transparent to-white/70 pointer-events-none" />

      {/* Radial soft highlight centered behind text for contrast */}
      <div className="absolute inset-0 z-10 bg-[radial-gradient(ellipse_85%_75%_at_50%_50%,rgba(255,255,255,0.85)_0%,rgba(255,255,255,0.50)_55%,rgba(255,255,255,0.15)_100%)] pointer-events-none" />

      {/* Content */}
      <div className="relative z-20 text-center px-4 sm:px-6 max-w-4xl mx-auto flex flex-col items-center py-12 sm:py-16 md:py-20">
        {/* Welcome Tagline */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/95 border border-orange-200 text-primary font-semibold text-xs sm:text-sm tracking-wide shadow-2xs mb-4">
          <Utensils className="w-3.5 h-3.5 text-primary" />
          <span>{t.welcome}</span>
        </div>

        {/* Brand Heading */}
        <h1 className="hero-title text-3xl sm:text-5xl md:text-6xl font-extrabold mb-3 sm:mb-4 tracking-tight leading-tight">
          {businessName}
        </h1>

        {/* Catering Description */}
        <p className="text-slate-700 text-sm sm:text-lg md:text-xl max-w-2xl mx-auto mb-6 sm:mb-8 font-medium leading-relaxed">
          {t.heroDescription}
        </p>

        {/* Customer-facing Menu Download Button */}
        <button
          onClick={handleDownloadMenu}
          disabled={downloading}
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-[#c2410c] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer disabled:opacity-60 border border-orange-600/30 active:scale-[0.98]"
        >
          {downloading ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>{lang === 'ta' ? 'மெனு PDF உருவாக்கப்படுகிறது...' : 'Generating Menu PDF...'}</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4 text-white" />
              <span>{lang === 'ta' ? 'உணவு மெனு PDF பதிவிறக்கு' : 'Download Food Menu PDF'}</span>
            </>
          )}
        </button>
      </div>
    </section>
  );
};
