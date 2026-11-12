import React, { useState, useEffect } from 'react';
import {
  Settings,
  Database,
  MessageSquare,
  Check,
  Copy,
  Server,
  Download,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FileCode,
} from 'lucide-react';
import { siteConfig } from '../../config/site';
import { campaignService } from '../../services/campaignService';
import { migrationService, type MigrationSummary } from '../../services/migrationService';
import { testSupabaseConnection, isSupabaseConfigured, supabaseDiagnostics } from '../../lib/supabase';
import { settingsService } from '../../services/settingsService';
import { useLanguage } from '../../context/LanguageContext';

export const AdminSettings: React.FC = () => {
  const { lang } = useLanguage();
  const isTa = lang === 'ta';

  const [copied, setCopied] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    tested: boolean;
    connected: boolean;
    message: string;
  }>({
    tested: false,
    connected: isSupabaseConfigured,
    message: isSupabaseConfigured
      ? 'Supabase credentials loaded in environment.'
      : `Supabase configuration missing or invalid (${supabaseDiagnostics.missingOrInvalid.join(', ')}).`,
  });

  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<MigrationSummary | null>(null);

  // Editable settings
  const [cateringName, setCateringName] = useState(siteConfig.name);
  const [phone, setPhone] = useState(siteConfig.whatsappNumber);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savedSettingsSuccess, setSavedSettingsSuccess] = useState(false);

  useEffect(() => {
    // Load custom settings from Supabase/cache
    const savedName = settingsService.get('business_name', siteConfig.name);
    const savedPhone = settingsService.get('business_phone', siteConfig.whatsappNumber);
    setCateringName(savedName);
    setPhone(savedPhone);
  }, []);

  const isApiConfigured = campaignService.isApiConfigured();

  const envSample = `# Kanchi Ambal Catering Environment Configuration
VITE_WHATSAPP_NUMBER=7200015790

# Official WhatsApp Business Cloud API (Meta)
VITE_WHATSAPP_API_TOKEN=
VITE_WHATSAPP_PHONE_NUMBER_ID=
VITE_WHATSAPP_BUSINESS_ACCOUNT_ID=

# Supabase Production Database Backend
VITE_SUPABASE_URL=https://szdvgehgqzijgctswone.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_PUBLIC_KEY
`;

  function copyEnv() {
    navigator.clipboard.writeText(envSample);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleTestConnection() {
    setTestingConnection(true);
    try {
      const res = await testSupabaseConnection();
      setConnectionStatus({
        tested: true,
        connected: res.connected,
        message: res.message,
      });
    } catch (err) {
      setConnectionStatus({
        tested: true,
        connected: false,
        message: String(err),
      });
    } finally {
      setTestingConnection(false);
    }
  }

  async function handleMigrate() {
    if (!window.confirm(isTa ? 'உங்கள் அனைத்து உள்ளூர் தரவுகளையும் Supabase-க்கு மாற்ற விரும்புகிறீர்களா?' : 'Do you want to migrate all local data into Supabase?')) {
      return;
    }
    setMigrating(true);
    try {
      const summary = await migrationService.migrateToSupabase();
      setMigrationResult(summary);
    } finally {
      setMigrating(false);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await settingsService.set('business_name', cateringName.trim());
      await settingsService.set('business_phone', phone.trim());
      setSavedSettingsSuccess(true);
      setTimeout(() => setSavedSettingsSuccess(false), 3000);
    } finally {
      setSavingSettings(false);
    }
  }

  function handleCopySql() {
    fetch('/supabase_schema.sql')
      .then((res) => res.text())
      .then((sql) => {
        navigator.clipboard.writeText(sql);
        setCopiedSql(true);
        setTimeout(() => setCopiedSql(false), 2500);
      })
      .catch(() => {
        setCopiedSql(true);
        setTimeout(() => setCopiedSql(false), 2500);
      });
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Settings size={22} className="text-primary" />
          <span>{isTa ? 'நிர்வாக அமைப்புகள் (Settings)' : 'Admin System Settings'}</span>
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          {isTa
            ? 'Supabase தரவுத்தளம், காப்புப்பிரதி (Backup), மற்றும் வணிக அமைப்புகள்'
            : 'Configure Supabase database backend, data backups, and business parameters'}
        </p>
      </div>

      {/* ─── 1. SUPABASE DATABASE BACKEND CONNECTION ────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 border border-emerald-200">
              <Database size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isTa ? 'Supabase தரவுத்தள இணைப்பு' : 'Supabase Database Integration'}
              </h3>
              <p className="text-xs text-slate-500">
                Project URL: https://szdvgehgqzijgctswone.supabase.co
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 ${
                connectionStatus.connected
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${connectionStatus.connected ? 'bg-emerald-600 animate-pulse' : 'bg-red-500'}`} />
              {connectionStatus.connected ? (isTa ? 'இணைக்கப்பட்டுள்ளது' : 'Connected') : (isTa ? 'இணைப்பில்லை' : 'Disconnected')}
            </span>

            <button
              onClick={handleTestConnection}
              disabled={testingConnection}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={13} className={testingConnection ? 'animate-spin text-primary' : ''} />
              <span>{testingConnection ? (isTa ? 'சோதிக்கிறது...' : 'Testing...') : (isTa ? 'இணைப்பைச் சோதி' : 'Test Connection')}</span>
            </button>
          </div>
        </div>

        {connectionStatus.tested && (
          <div className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 ${connectionStatus.connected ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-900 border border-amber-200'}`}>
            {connectionStatus.connected ? <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" /> : <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />}
            <p className="leading-relaxed font-medium">{connectionStatus.message}</p>
          </div>
        )}

        {/* Database Migration & Backup Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {/* Download JSON Backup */}
          <button
            onClick={() => migrationService.downloadBackupFile()}
            className="flex items-center justify-center gap-2 p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 transition-all cursor-pointer shadow-2xs hover:border-slate-300"
          >
            <Download size={16} className="text-primary" />
            <span>{isTa ? 'உள்ளூர் காப்புப்பிரதி பதிவிறக்கு' : 'Download Local Backup'}</span>
          </button>

          {/* Migrate to Supabase */}
          <button
            onClick={handleMigrate}
            disabled={migrating}
            className="flex items-center justify-center gap-2 p-3 bg-primary hover:bg-[#c2410c] text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs disabled:opacity-50"
          >
            <UploadCloud size={16} className={migrating ? 'animate-bounce' : ''} />
            <span>{migrating ? (isTa ? 'மாற்றுகிறது...' : 'Migrating...') : (isTa ? 'Supabase-க்கு மாற்று' : 'Migrate to Supabase')}</span>
          </button>

          {/* Copy SQL Migration */}
          <button
            onClick={handleCopySql}
            className="flex items-center justify-center gap-2 p-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
          >
            <FileCode size={16} />
            <span>{copiedSql ? (isTa ? 'நகலெடுக்கப்பட்டது!' : 'SQL Copied!') : (isTa ? 'SQL ஸ்கிரிப்ட் நகலெடு' : 'Copy SQL Schema')}</span>
          </button>
        </div>

        {/* Migration Result Banner */}
        {migrationResult && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-2">
            <p className="font-bold text-emerald-900 flex items-center gap-1.5 text-sm">
              <CheckCircle2 size={16} className="text-emerald-600" />
              <span>{isTa ? 'தரவு மாற்றம் வெற்றிகரமாக நிறைவடைந்தது!' : 'Data Migration Succeeded!'}</span>
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-700 pt-1">
              <div>Customers: <strong>{migrationResult.customers}</strong></div>
              <div>Orders: <strong>{migrationResult.orders}</strong></div>
              <div>Leads: <strong>{migrationResult.leads}</strong></div>
              <div>Inventory: <strong>{migrationResult.inventoryItems}</strong></div>
              <div>Rentals: <strong>{migrationResult.rentalItems}</strong></div>
              <div>Documents: <strong>{migrationResult.purchaseDocuments + migrationResult.rentalDocuments}</strong></div>
            </div>
            {migrationResult.errors.length > 0 && (
              <div className="text-amber-800 mt-2">
                <span className="font-bold">Notes:</span> {migrationResult.errors.join(', ')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── 2. BUSINESS PROFILE SETTINGS ─────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 space-y-4">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Settings size={18} className="text-primary" />
          <span>{isTa ? 'வணிக விவரங்கள்' : 'Catering Business Profile'}</span>
        </h3>

        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isTa ? 'கேட்டரிங் பெயர் (English)' : 'Catering Brand Name'}
              </label>
              <input
                type="text"
                value={cateringName}
                onChange={(e) => setCateringName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isTa ? 'பதிவு செய்யப்பட்ட WhatsApp எண்' : 'Official WhatsApp Number'}
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isTa ? 'சமையலறை & அலுவலக முகவரி' : 'Kitchen / Office Address'}
              </label>
              <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                No. 25, Mandapam Street, Kanchipuram, Tamil Nadu – 631501
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            {savedSettingsSuccess ? (
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                <Check size={14} /> {isTa ? 'அமைப்புகள் சேமிக்கப்பட்டன!' : 'Settings saved permanently to Supabase!'}
              </span>
            ) : <span />}

            <button
              type="submit"
              disabled={savingSettings}
              className="px-5 py-2 bg-primary hover:bg-[#c2410c] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {savingSettings ? (isTa ? 'சேமிக்கிறது...' : 'Saving...') : (isTa ? 'அமைப்புகளைச் சேமி ✓' : 'Save Settings ✓')}
            </button>
          </div>
        </form>
      </div>

      {/* ─── 3. WHATSAPP BUSINESS INTEGRATION ────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <MessageSquare size={18} className="text-primary" />
            <span>WhatsApp Business Integration</span>
          </h3>
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              isApiConfigured
                ? 'bg-green-100 text-green-800'
                : 'bg-amber-100 text-amber-800'
            }`}
          >
            {isApiConfigured ? 'Cloud API Active' : 'Direct Dispatch Active'}
          </span>
        </div>

        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
          The catering platform operates using <strong>legally compliant WhatsApp direct links</strong>.
          Orders and customer messages open automatically via certified click-to-chat links with custom pre-filled Tamil or English text.
        </p>
      </div>

      {/* ─── 4. ENVIRONMENT VARIABLES CONFIGURATION ───────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Server size={18} className="text-primary" />
            <span>Environment Variables for Deployment (Vercel)</span>
          </h3>
          <button
            onClick={copyEnv}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
          >
            {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy .env'}</span>
          </button>
        </div>

        <p className="text-xs text-slate-500">
          Add these environment variables in your Vercel Dashboard under <strong>Project Settings → Environment Variables</strong>.
        </p>

        <div className="relative bg-slate-900 text-slate-200 p-4 rounded-xl text-xs font-mono overflow-x-auto">
          <pre className="whitespace-pre">{envSample}</pre>
        </div>
      </div>
    </div>
  );
};
