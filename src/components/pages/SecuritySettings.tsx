import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheck, 
  Fingerprint, 
  Lock, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  EyeOff,
  User,
  Building2,
  X,
  Upload,
  Camera
} from 'lucide-react';
import { useAuth } from '../../AuthContext';
import { useData } from '../../contexts/DataContext';
import { cn } from '../../lib/utils';
import { uploadFile } from '../../api';
import { useLanguage } from '../../contexts/LanguageContext';

export const SecuritySettings: React.FC = () => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { user, profile, refreshProfile } = useAuth();
  const { systemSettings, refreshData } = useData();
  const [personalLockPassword, setPersonalLockPassword] = useState((profile as any)?.lockPassword || '');
  const [displayName, setDisplayName] = useState((profile as any)?.name || user?.displayName || '');
  const [showPassword, setShowPassword] = useState(false);
  const [photoUrl, setPhotoUrl] = useState((profile as any)?.photoUrl || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (profile) {
      setPersonalLockPassword((profile as any).lockPassword || '');
      setDisplayName((profile as any).name || (profile as any).displayName || user?.displayName || '');
      setPhotoUrl((profile as any).photoUrl || '');
    }
  }, [profile, user]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const url = await uploadFile(file);
      setPhotoUrl(url);
      setMessage({ type: 'success', text: t('تم تحميل الصورة بنجاح، اضغط حفظ للتثبيت') });
    } catch (err) {
      setMessage({ type: 'error', text: t('فشل تحميل الصورة') });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    if (personalLockPassword && personalLockPassword.length < 4) {
      setMessage({ type: 'error', text: t('يجب إدخال 4 أرقام على الأقل لضمان الحماية') });
      setSaving(false);
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/auth/update-profile', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          name: displayName,
          photoUrl: photoUrl,
          lockPassword: personalLockPassword 
        })
      });

      if (res.ok) {
        setMessage({ type: 'success', text: t('تم تحديث البيانات والأمان بنجاح') });
        if (refreshProfile) await refreshProfile();
        refreshData();
      } else {
        const err = await res.json();
        setMessage({ type: 'error', text: err.error || t('فشل التحديث') });
      }
    } catch (e) {
      setMessage({ type: 'error', text: t('حدث خطأ فني أثناء الاتصال بالسيرفر') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-center gap-4 border-b-2 border-border pb-6 transition-all duration-500">
        <div className="w-16 h-16 bg-primary/10 rounded-none flex items-center justify-center text-primary shadow-lg shadow-primary/5 hover:scale-110 transition-transform">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-foreground uppercase tracking-tight heading-gradient">{t('حماية النظام واليوزر')}</h1>
          <p className="text-muted-foreground font-bold text-xs uppercase tracking-widest opacity-60">Personal Terminal Security</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* User Card */}
        <div className="md:col-span-1 space-y-6">
          <section className="bg-card border-2 border-border p-8 text-center space-y-6 relative overflow-hidden group hover:border-primary/20 transition-all">
             <div className="absolute top-0 left-0 w-full h-1 bg-primary" />
             <div className="relative w-28 h-28 mx-auto group/photo">
               <div className="w-full h-full rounded-none overflow-hidden border-2 border-primary/20 bg-muted flex items-center justify-center shadow-xl group-hover:scale-105 transition-transform">
                  {photoUrl ? (
                    <img src={photoUrl} alt="User Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" crossOrigin="anonymous" />
                  ) : (
                    <User className="w-12 h-12 text-muted-foreground" />
                  )}
               </div>
               <label className="absolute inset-0 bg-primary/80 flex flex-col items-center justify-center opacity-0 group-hover/photo:opacity-100 transition-all cursor-pointer backdrop-blur-sm">
                  <Camera className="w-8 h-8 text-white mb-2 animate-bounce" />
                  <span className="text-[10px] text-white font-black uppercase tracking-tighter">{t('تغيير الصورة')}</span>
                  <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} disabled={uploading} />
               </label>
               {uploading && (
                 <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                   <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                 </div>
               )}
             </div>
             <div>
                <h2 className="text-xl font-black text-foreground uppercase tracking-tighter truncate">{displayName}</h2>
                <p className="text-[10px] text-primary font-black uppercase tracking-[0.2em] mt-1">{profile?.role || 'System User'}</p>
             </div>
             <div className="pt-4 border-t border-border flex flex-col gap-2">
                <div className="flex items-center justify-between text-[10px] font-black text-muted-foreground uppercase">
                   <span>ID:</span>
                   <span className="text-foreground tracking-widest font-mono">#{user?.uid?.slice(-6).toUpperCase() || 'EMP-001'}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-black text-muted-foreground uppercase">
                   <span>Security Status:</span>
                   <span className="text-emerald-500 flex items-center gap-1">Encrypted <ShieldCheck className="w-3 h-3" /></span>
                </div>
             </div>
          </section>

          <section className="bg-card border-2 border-border p-6 space-y-4 transition-all">
             <div className="flex items-center gap-3 text-foreground">
                <Building2 className="w-5 h-5 text-primary" />
                <h3 className="text-xs font-black uppercase tracking-widest">{t('معلومات المنشأة')}</h3>
             </div>
             <div className="space-y-4">
                <div className={cn(
                  "w-full aspect-video flex items-center justify-center bg-muted/30 border border-border",
                  systemSettings?.logoUrl ? "p-4" : ""
                )}>
                   {systemSettings?.logoUrl ? (
                     <img src={systemSettings.logoUrl} alt="Org Logo" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                   ) : (
                     <ShieldCheck className="w-10 h-10 text-muted-foreground/30" />
                   )}
                </div>
                <p className="text-center font-black text-sm uppercase tracking-tighter text-foreground/80">
                   {systemSettings?.organizationName}
                </p>
             </div>
          </section>
        </div>

        {/* Settings Form */}
        <div className="md:col-span-2">
          <form onSubmit={handleSave} className="space-y-8">
            <section className="bg-card border-2 border-border p-10 space-y-10 transition-all hover:border-primary/20 relative">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                 <Lock className="w-32 h-32 text-foreground" />
              </div>

              <div className="space-y-8">
                <div className="flex items-center gap-4 text-primary">
                  <div className="p-2 bg-primary/5">
                    <Fingerprint className="w-6 h-6" />
                  </div>
                  <h2 className="text-sm font-black uppercase tracking-[0.2em]">{t('الملف الشخصي والحماية (User Identity)')}</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] block">{t('اسم العرض (الاسم الكامل)')}</label>
                    <input 
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full bg-muted border-2 border-border focus:border-primary p-5 outline-none font-black text-lg tracking-tight transition-all text-foreground"
                      placeholder={t('أدخل اسمك الكامل...')}
                    />
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] block">{t('كود القفل (4 أرقام)')}</label>
                    <div className="relative group">
                      <input 
                        type={showPassword ? "text" : "password"}
                        maxLength={4}
                        value={personalLockPassword}
                        onChange={(e) => setPersonalLockPassword(e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-muted border-2 border-border focus:border-primary p-5 pl-14 outline-none font-black text-center text-2xl tracking-[1em] transition-all text-foreground placeholder:text-muted-foreground/30"
                        placeholder="0000"
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-all p-2 bg-muted-foreground/5"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground font-black leading-relaxed italic border-r-2 border-primary/20 pr-6 opacity-80 mt-6">{t('تُستخدم كلمة المرور هذه للقفل التلقائي للشاشة أو القفل اليدوي السريع. تختلف هذه الحماية عن كلمة مرور تسجيل الدخول الخاصة بك، فهي مخصصة "للوصول السريع" وحماية الجهاز أثناء تركك للمكتب.')}</p>
              </div>

              <div className="bg-primary/5 p-6 border-l-4 border-primary space-y-2">
                 <div className="flex items-center gap-2 text-primary">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase">{t('ملاحظات أمنية')}</span>
                 </div>
                 <ul className="text-[10px] text-muted-foreground font-black uppercase tracking-tighter space-y-1 list-disc list-inside opacity-70">
                    <li>يتم تفعيل القفل تلقائياً بعد {systemSettings?.idleTimeoutMinutes || 5} دقائق خمول</li>
                    <li>{t('يمكنك القفل يدوياً من أيقونة القفل في الأعلى')}</li>
                    <li>{t('كلمة السر هذه مشفرة بالكامل ولا تظهر لأي مدير')}</li>
                 </ul>
              </div>
            </section>

            <AnimatePresence>
              {message && (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className={cn(
                    "p-6 border-2 flex items-center justify-between font-black text-xs uppercase tracking-widest shadow-xl",
                    message.type === 'success' ? 'bg-emerald-500 border-emerald-600 text-white' : 'bg-destructive border-destructive text-white'
                  )}
                >
                  <div className="flex items-center gap-4">
                    {message.type === 'success' ? <CheckCircle2 className="w-6 h-6 shrink-0" /> : <AlertCircle className="w-6 h-6 shrink-0" />}
                    <span>{message.text}</span>
                  </div>
                  <button type="button" onClick={() => setMessage(null)} className="p-1 hover:bg-white/20 rounded-none transition-colors">
                     <X className="w-5 h-5" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex justify-end pt-4">
              <button 
                type="submit" 
                disabled={saving}
                className="group relative bg-primary text-primary-foreground font-black px-12 py-6 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 overflow-hidden shadow-2xl"
              >
                <div className="relative z-10 flex items-center justify-center gap-4 uppercase tracking-[0.3em] text-xs">
                  {saving ? (
                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <ShieldCheck className="w-5 h-5" />
                  )}
                  {saving ? t('جاري الحفظ...') : t('تثبيت إعدادات القفل')}
                </div>
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
