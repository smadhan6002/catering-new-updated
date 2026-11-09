import React, { useState } from 'react';
import { Lock, Mail, Eye, EyeOff, ChefHat, AlertTriangle, CheckCircle, Copy, Check } from 'lucide-react';
import { authService, type LoginResult } from '../../services/authService';
import { siteConfig } from '../../config/site';
import { useLanguage } from '../../context/LanguageContext';

interface AdminLoginProps {
  onLogin: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLogin }) => {
  const { lang, businessName } = useLanguage();
  const isTa = lang === 'ta';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [authDetails, setAuthDetails] = useState<LoginResult | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setAuthDetails(null);
    setLoading(true);

    try {
      const res = await authService.login(email.trim(), password);

      if (res.success) {
        onLogin();
      } else {
        setError(res.error || (isTa ? 'உள்நுழைவு தோல்வியடைந்தது.' : 'Invalid email or password.'));
        if (res.needsAdminAuthorization) {
          setAuthDetails(res);
        }
      }
    } catch (err: any) {
      setError(err?.message || (isTa ? 'உள்நுழைவு பிழை ஏற்பட்டது.' : 'Login failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const sqlToAuthorize = authDetails?.userId
    ? `INSERT INTO public.admin_users (id, name) VALUES ('${authDetails.userId}', 'Admin Owner') ON CONFLICT (id) DO NOTHING;`
    : `INSERT INTO public.admin_users (id, name) SELECT id, coalesce(raw_user_meta_data->>'full_name', email, 'Admin Owner') FROM auth.users ON CONFLICT (id) DO NOTHING;`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlToAuthorize);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl shadow-lg mb-4">
            <ChefHat size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{businessName}</h1>
          <p className="text-slate-500 text-sm mt-1">
            {isTa ? `${siteConfig.name} • நிர்வாகப் பலகை` : `${siteConfig.tamilName} • Admin Portal`}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            {isTa ? 'நிர்வாகி உள்நுழைவு' : 'Admin Sign In'}
          </h2>
          <p className="text-xs text-slate-500 mb-6">
            {isTa
              ? 'Supabase Authentication மூலம் பாதுகாக்கப்பட்ட அணுகல்'
              : 'Authenticated via official Supabase Auth'}
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-5 flex items-start gap-2.5">
              <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-xs leading-relaxed">{error}</div>
            </div>
          )}

          {/* Special Authorization Notice when Auth succeeds but admin_users is missing */}
          {authDetails?.needsAdminAuthorization && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-xs mb-5 space-y-3">
              <div className="flex items-center gap-2 text-amber-900 font-semibold">
                <CheckCircle size={16} className="text-green-600" />
                <span>
                  {isTa ? 'Supabase கணக்கு சரிபார்க்கப்பட்டது!' : 'Supabase Auth Credentials Verified!'}
                </span>
              </div>
              <p className="text-amber-800 leading-relaxed">
                {isTa
                  ? 'ஆனால் இந்தக் கணக்கிற்கு "public.admin_users" அட்டவணையில் அனுமதி வழங்கப்படவில்லை.'
                  : 'However, this user is not yet authorized in the public.admin_users table.'}
              </p>
              <div className="bg-white p-2.5 rounded-lg border border-amber-200 font-mono text-[11px] text-slate-700 break-all">
                {sqlToAuthorize}
              </div>
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg text-xs transition-colors cursor-pointer"
                >
                  {copiedSql ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedSql ? (isTa ? 'காப்பி செய்யப்பட்டது!' : 'Copied!') : (isTa ? 'SQL-ஐ காப்பி செய்' : 'Copy SQL')}</span>
                </button>
                <span className="text-[10px] text-amber-700 font-medium">
                  {isTa ? 'Supabase SQL Editor-ல் இயக்கவும்' : 'Run in Supabase SQL Editor'}
                </span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email / Username */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {isTa ? 'நிர்வாகி மின்னஞ்சல் (Admin Email)' : 'Admin Email'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Mail size={16} className="text-slate-400" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all bg-slate-50/50 focus:bg-white"
                  placeholder="admin@example.com"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {isTa ? 'கடவுச்சொல் (Password)' : 'Password'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Lock size={16} className="text-slate-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full pl-9 pr-10 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all bg-slate-50/50 focus:bg-white"
                  placeholder={isTa ? 'கடவுச்சொல்லை உள்ளிடவும்' : 'Enter your password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/95 disabled:opacity-60 text-white py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm hover:shadow active:scale-[0.99] mt-3 cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{isTa ? 'சரிபார்க்கிறது…' : 'Signing in…'}</span>
                </>
              ) : (
                <span>{isTa ? 'உள்நுழைக' : 'Sign In'}</span>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>{isTa ? 'பாதுகாப்பான அட்மின் போர்டல்' : 'Secure Admin Portal'}</span>
            <span className="flex items-center gap-1 font-medium text-slate-500">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
              Supabase Auth
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
