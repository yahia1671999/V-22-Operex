import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, ShieldCheck, Mail, Lock, Globe, Sun, Moon, Eye, EyeOff, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../lib/utils';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const { language, setLanguage } = useLanguage();
  const { theme, setTheme, toggleTheme } = useTheme();

  useEffect(() => {
    if (language === 'en') {
      setTheme('dark');
    }
  }, [language, setTheme]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  
  const [settings, setSettings] = useState<{ organizationName: string; logoUrl: string | null }>({
    organizationName: 'OPerix',
    logoUrl: null
  });

  useEffect(() => {
    const fetchWithRetry = async (url: string, retries = 3, delay = 1000): Promise<any> => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return await res.json();
      } catch (err) {
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
          return fetchWithRetry(url, retries - 1, delay * 1.5);
        }
        throw err;
      }
    };

    fetchWithRetry('/api/system-settings/public')
      .then(data => {
        if (data && data.organizationName) {
          setSettings(data);
        }
      })
      .catch(err => console.warn('Failed to fetch public settings after retries', err));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError(language === 'ar' ? 'يرجى إدخال البريد الإلكتروني' : 'Please enter your email address');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || (language === 'ar' 
        ? 'فشل تسجيل الدخول، تأكد من صحة البيانات أو وجود حساب معتمد' 
        : 'Access denied: Please verify authorized credentials'));
      console.error('Login failed', err);
    } finally {
      setLoading(false);
    }
  };

  // Helper for localized text
  const tx = (ar: string, en: string) => {
    return language === 'ar' ? ar : en;
  };

  const isRtl = language === 'ar';

  return (
    <div 
      className="min-h-screen flex items-center justify-center bg-[#030712] transition-colors duration-1000 relative overflow-hidden" 
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Deep Space Background layers */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none bg-gradient-to-b from-[#020617] via-[#090f1e] to-[#02040a]" />

      {/* High-fidelity Aurora Mesh Gradient light layers */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
        <style>{`
          @keyframes aurora-1 {
            0% { transform: translate(0px, 0px) scale(1) rotate(0deg); }
            33% { transform: translate(100px, -150px) scale(1.25) rotate(90deg); }
            66% { transform: translate(-80px, 80px) scale(0.85) rotate(180deg); }
            100% { transform: translate(0px, 0px) scale(1) rotate(360deg); }
          }
          @keyframes aurora-2 {
            0% { transform: translate(0px, 0px) scale(1.1) rotate(0deg); }
            50% { transform: translate(-120px, 120px) scale(0.8) rotate(-180deg); }
            100% { transform: translate(0px, 0px) scale(1.1) rotate(0deg); }
          }
          @keyframes aurora-3 {
            0% { transform: translate(0px, 0px) scale(1) rotate(0deg); }
            40% { transform: translate(120px, 100px) scale(1.3) rotate(120deg); }
            100% { transform: translate(0px, 0px) scale(1) rotate(0deg); }
          }
          @keyframes aurora-4 {
            0% { transform: translate(0px, 0px) scale(0.9) rotate(0deg); }
            60% { transform: translate(-100px, -100px) scale(1.2) rotate(-90deg); }
            100% { transform: translate(0px, 0px) scale(0.9) rotate(0deg); }
          }
          @keyframes aurora-pulse {
            0%, 100% { opacity: 0.22; }
            50% { opacity: 0.35; }
          }
          .animate-aurora-1 { animation: aurora-1 30s infinite ease-in-out; }
          .animate-aurora-2 { animation: aurora-2 35s infinite ease-in-out; }
          .animate-aurora-3 { animation: aurora-3 28s infinite ease-in-out; }
          .animate-aurora-4 { animation: aurora-4 40s infinite ease-in-out; }
          .animate-spin-slow { animation: spin 18s linear infinite; }
        `}</style>
        
        {/* Upper Left Glow: Cyan #00B7FF */}
        <div className="absolute top-[-15%] left-[-15%] w-[800px] h-[800px] rounded-full bg-[#00B7FF] blur-[180px] opacity-[0.24] animate-aurora-1 mix-blend-screen" />
        
        {/* Mid Right Glow: Emerald #25C99F */}
        <div className="absolute top-[15%] right-[-15%] w-[750px] h-[750px] rounded-full bg-[#25C99F] blur-[190px] opacity-[0.20] animate-aurora-2 mix-blend-screen" />
        
        {/* Bottom Right Glow: Warm Gold #D6C73A */}
        <div className="absolute bottom-[-15%] right-[-10%] w-[700px] h-[700px] rounded-full bg-[#D6C73A] blur-[170px] opacity-[0.18] animate-aurora-3 mix-blend-screen" />
        
        {/* Bottom Left Glow: Turquoise #00C7C7 */}
        <div className="absolute bottom-[-15%] left-[-15%] w-[720px] h-[720px] rounded-full bg-[#00C7C7] blur-[180px] opacity-[0.22] animate-aurora-4 mix-blend-screen" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.97, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full mx-4 z-10 flex justify-center"
      >
        {/* Premium Dark Glassmorphism Card (Width perfectly fits range at 495px) */}
        <div className="w-full max-w-[495px] bg-[#0c1324]/45 backdrop-blur-[45px] rounded-[30px] border border-white/12 shadow-[0_45px_100px_-25px_rgba(0,0,0,0.65)] ring-1 ring-white/10 p-10 md:p-12 relative overflow-hidden group">
          
          {/* Top gloss line highlight */}
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/45 to-transparent" />
          
          {/* Thin signature gradient band */}
          <div className="absolute top-0 left-0 w-full h-[4px] bg-gradient-to-r from-[#00B7FF] via-[#00C7C7] to-[#D6C73A] opacity-90" />
          
          {/* Subtle logo & branding header */}
          <div className="text-center mb-10">
            <motion.div 
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.5 }}
              className={cn(
                "w-20 h-20 mx-auto mb-6 flex items-center justify-center transition-all duration-700 overflow-hidden rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.3)]",
                settings.logoUrl 
                  ? "bg-transparent drop-shadow-2xl" 
                  : "bg-gradient-to-tr from-[#00B7FF] via-[#00C7C7] to-[#25C99F] border border-white/20 ring-1 ring-white/15"
              )}
            >
              {settings.logoUrl ? (
                <img 
                  src={settings.logoUrl} 
                  alt="Logo" 
                  className="max-w-full max-h-full object-contain filter drop-shadow-lg" 
                  referrerPolicy="no-referrer" 
                  crossOrigin="anonymous" 
                />
              ) : (
                <ShieldCheck className="w-10 h-10 text-white stroke-[1.5]" />
              )}
            </motion.div>
            
            <h1 className="text-3xl font-black text-white mb-2 tracking-tight leading-none uppercase">
              {settings.organizationName || 'OPerix'}
            </h1>
            <p className="text-slate-300/80 text-sm font-semibold tracking-wide">
              {tx('منصة بارادايس للتشغيل والذكاء الاصطناعي', 'Paradise AI & Operations Platform')}
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} autoComplete="off" className="space-y-5">
            {/* Email Field container */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                {tx('البريد الإلكتروني المعتمد', 'Authorized Email Address')}
              </label>
              <div className="relative group/input">
                <div className={cn(
                  "absolute inset-y-0 flex items-center pointer-events-none text-slate-400 group-focus-within/input:text-[#00C7C7] transition-all duration-300",
                  isRtl ? "right-4" : "left-4"
                )}>
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  type="email"
                  name="email"
                  id="login-email"
                  autoComplete="off"
                  required
                  className={cn(
                    "w-full py-4 text-white bg-slate-950/45 border border-white/10 ",
                    "focus:border-[#00C7C7] focus:ring-2 focus:ring-[#00C7C7]/20 focus:bg-slate-950/70 ",
                    "outline-none transition-all duration-300 rounded-xl font-semibold text-base ",
                    "placeholder:text-white/25",
                    isRtl ? "pl-5 pr-12" : "pl-12 pr-5"
                  )}
                  placeholder={tx('CORPORATE@COMPANY.COM', 'corporate@company.com')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  dir="ltr"
                />
              </div>
            </div>

            {/* Password Field container */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                {tx('مفتاح الأمان / كلمة المرور', 'Security Key / Password')}
              </label>
              <div className="relative group/input">
                <div className={cn(
                  "absolute inset-y-0 flex items-center pointer-events-none text-slate-400 group-focus-within/input:text-[#00C7C7] transition-all duration-300",
                  isRtl ? "right-4" : "left-4"
                )}>
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  id="login-password"
                  autoComplete="new-password"
                  required
                  className={cn(
                    "w-full py-4 text-white bg-slate-950/45 border border-white/10 ",
                    "focus:border-[#00C7C7] focus:ring-2 focus:ring-[#00C7C7]/20 focus:bg-slate-950/70 ",
                    "outline-none transition-all duration-300 rounded-xl font-semibold text-base ",
                    "placeholder:text-white/25",
                    isRtl ? "pl-12 pr-12" : "pl-12 pr-12"
                  )}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={cn(
                    "absolute inset-y-0 flex items-center px-4 text-slate-400 hover:text-white transition-all duration-200",
                    isRtl ? "left-0" : "right-0"
                  )}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Remember Me Link & Forgot Password */}
            <div className="flex items-center justify-between text-sm pt-1">
              <label className="flex items-center gap-2.5 cursor-pointer select-none text-slate-300 font-medium">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={cn(
                    "w-5 h-5 rounded-md border flex items-center justify-center transition-all duration-200",
                    rememberMe 
                      ? "bg-[#25C99F] border-[#25C99F] text-white" 
                      : "border-white/12 bg-slate-950/45"
                  )}>
                    {rememberMe && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </div>
                <span>{tx('تذكرني', 'Remember Identity')}</span>
              </label>

              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                className="text-xs font-semibold text-slate-400 hover:text-[#00C7C7] transition-colors"
              >
                {tx('نسيت كلمة المرور؟', 'Forgot Password?')}
              </button>
            </div>

            {/* Error Message Box */}
            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -8 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  exit={{ opacity: 0, y: -8 }} 
                  className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold leading-relaxed text-center"
                >
                  <div>{error}</div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Authorize Input Button */}
            <button
              type="submit"
              disabled={loading}
              className={cn(
                "w-full py-4 bg-gradient-to-r from-[#00B7FF] via-[#00C7C7] to-[#D6C73A] ",
                "hover:shadow-[0_6px_25px_rgba(0,199,199,0.32)] hover:scale-[1.01] active:scale-95 ",
                "text-white flex items-center justify-center gap-3 disabled:opacity-50 ",
                "font-extrabold text-base transition-all duration-300 rounded-xl border border-white/15 mt-2 cursor-pointer"
              )}
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <>
                  <span>{tx('تسجيل الدخول', 'Login')}</span>
                  <LogIn className={cn("w-5 h-5 transition-transform duration-200", isRtl ? "rotate-180" : "")} />
                </>
              )}
            </button>
          </form>

          {/* Premium Switchers Bar & Minimal Security footnote */}
          <div className="mt-8">
            <div className="h-[1px] w-full bg-white/10 mb-6" />
            
            <div className="flex items-center justify-between">
              {/* Language Switcher */}
              <button
                type="button"
                onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all text-xs font-bold duration-200"
              >
                <Globe className="w-4 h-4 text-[#00C7C7] animate-spin-slow" />
                <span>{tx('English (US)', 'العربية (المتكامل الوظيفي)')}</span>
              </button>

              {/* Theme Switcher */}
              <button
                type="button"
                onClick={toggleTheme}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all text-xs font-bold duration-200"
              >
                {theme === 'dark' ? (
                  <>
                    <Sun className="w-4 h-4 text-[#D6C73A]" />
                    <span>{tx('الوضع المضيء', 'Light Mode')}</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 text-[#00B7FF]" />
                    <span>{tx('الوضع الداكن', 'Dark Mode')}</span>
                  </>
                )}
              </button>
            </div>

            {/* Safe enterprise notice */}
            <div className="mt-6 text-center select-none pointer-events-none">
              <p className="text-[10px] text-slate-400/80 font-bold tracking-wider uppercase">
                {tx('اتصال مشفر ذكي معتمد حكومياً ومؤسسياً', 'Secured Cryptographic Directory Exchange')}
              </p>
            </div>
          </div>

        </div>
      </motion.div>

      {/* Modern SaaS Reset Modal popup */}
      <AnimatePresence>
        {showForgotModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/60 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="w-full max-w-[420px] bg-[#0c1324]/90 backdrop-blur-2xl rounded-3xl shadow-3xl p-8 border border-white/12"
            >
              <div className="flex items-center gap-3.5 mb-4 text-[#D6C73A]">
                <AlertCircle className="w-7 h-7 shrink-0 stroke-[2]" />
                <h3 className="text-xl font-bold text-white">
                  {tx('استعادة مفتاح الأمان المعتمد', 'Authorized Key Restoration')}
                </h3>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed mb-6 font-medium">
                {tx(
                  'لاسترداد كلمة المرور أو مفتاح الأمان الخاص بهويتك المشفرة، يرجى تقديم طلب رسمي لفريق الدعم الفني للإدارة أو التنسيق مع أمين تكنولوجيا المعلومات والتشغيل بالمؤسسة.',
                  'To obtain a key restoration token, please submit an official request form to your systemic HR controller or get in touch with the authorized enterprise IT operations administrator.'
                )}
              </p>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="w-full py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-sm font-bold rounded-xl transition-all duration-200 cursor-pointer"
              >
                {tx('إغلاق نافذة المصادقة الثانوية', 'Close Session Help')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
