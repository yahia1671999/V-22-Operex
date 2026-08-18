import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Settings, 
  Building2, 
  Upload, 
  Lock, 
  Save, 
  Eye, 
  EyeOff,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  X,
  Palette,
  Globe,
  Moon,
  Sun,
  Layout,
  Check
} from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { cn } from '../../lib/utils';
import { uploadFile } from '../../api';
import { useLanguage } from '../../contexts/LanguageContext';

export const OrganizationSettings: React.FC = () => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { refreshData } = useData();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  const [settings, setSettings] = useState({
    id: 'global',
    organizationName: 'OPerix',
    logoUrl: '',
    lockPassword: '',
    idleTimeoutMinutes: 5,
    isLockEnabled: false,
    primaryColor: '#0ea5e9',
    secondaryColor: '#10b981',
    sidebarColor: '#0f172a',
    buttonColor: '#0ea5e9',
    darkModeEnabled: false,
    defaultLanguage: 'ar'
  });

  // Apply visual settings live as user configures them!
  useEffect(() => {
    if (loading) return;
    const root = document.documentElement;
    if (settings.primaryColor) {
      root.style.setProperty('--primary', settings.primaryColor);
    }
    if (settings.secondaryColor) {
      root.style.setProperty('--secondary', settings.secondaryColor);
    }
    if (settings.sidebarColor) {
      root.style.setProperty('--sidebar', settings.sidebarColor);
    }
    if (settings.buttonColor) {
      root.style.setProperty('--button-primary', settings.buttonColor);
    }
  }, [settings.primaryColor, settings.secondaryColor, settings.sidebarColor, settings.buttonColor, loading]);

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch('/api/system-settings/admin', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setSettings(prev => ({ 
            ...prev, 
            ...data,
            // Guard default fallbacks
            primaryColor: data.primaryColor || '#0ea5e9',
            secondaryColor: data.secondaryColor || '#10b981',
            sidebarColor: data.sidebarColor || '#0f172a',
            buttonColor: data.buttonColor || '#0ea5e9',
            darkModeEnabled: data.darkModeEnabled ?? false,
            defaultLanguage: data.defaultLanguage || 'ar'
          }));
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/system-settings/admin', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        setMessage({ type: 'success', text: t('تم حفظ الإعدادات بنجاح') });
        refreshData();
      } else {
        throw new Error('Save failed');
      }
    } catch (err) {
      console.error('Save failed:', err);
      setMessage({ type: 'error', text: t('فشل حفظ الإعدادات') });
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
      setMessage({ type: 'error', text: t('حجم الصورة يجب أن يكون أقل من 500 كيلو بايت') });
      return;
    }

    try {
      setSaving(true);
      const result = await uploadFile(file);
      setSettings(prev => ({ ...prev, logoUrl: result.url }));
      setMessage({ type: 'success', text: t('تم رفع الشعار بنجاح') });
    } catch (err) {
      setMessage({ type: 'error', text: t('فشل رفع الشعار') });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-center gap-4 border-b-2 border-border pb-6 transition-all duration-500">
        <div className="w-16 h-16 bg-primary/10 rounded-none flex items-center justify-center text-primary shadow-lg shadow-primary/5 hover:scale-110 transition-transform">
          <Settings className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-foreground uppercase tracking-tight heading-gradient">{t('إعدادات المنشأة')}</h1>
          <p className="text-muted-foreground font-bold text-xs uppercase tracking-widest opacity-60">Identity & System Security</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* Organization Info */}
        <section className="bg-card border-2 border-border p-10 space-y-8 transition-all hover:border-primary/20">
          <div className="flex items-center gap-4 text-primary">
            <div className="p-2 bg-primary/5 rounded-none">
              <Building2 className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-black uppercase tracking-[0.2em]">{t('هوية المنشأة (Organization Identity)')}</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">{t('اسم المنشأة / النظام')}</label>
              <input 
                type="text" 
                value={settings.organizationName}
                onChange={e => setSettings(prev => ({ ...prev, organizationName: e.target.value }))}
                className="w-full bg-muted border-2 border-border focus:border-primary p-5 outline-none font-black text-xl tracking-tighter"
                placeholder="OPerix"
              />
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block text-right">{t('شعار المنشأة (شفاف PNG)')}</label>
              <div className="flex items-start gap-8 pt-2">
                <div className="w-36 h-36 bg-muted border-2 border-dashed border-border flex items-center justify-center relative group overflow-hidden transition-all hover:border-primary/40">
                  {settings.logoUrl ? (
                    <img src={settings.logoUrl} alt="Logo Preview" className="max-w-full max-h-full object-contain p-2" referrerPolicy="no-referrer" crossOrigin="anonymous" />
                  ) : (
                    <ImageIcon className="w-12 h-12 text-muted-foreground/30" />
                  )}
                  <div className="absolute inset-0 bg-primary/90 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer backdrop-blur-sm">
                    <label className="cursor-pointer flex flex-col items-center">
                      <Upload className="w-8 h-8 text-white animate-bounce" />
                      <span className="text-[10px] text-white font-black mt-3 uppercase tracking-tighter">{t('رفع شعار جديد')}</span>
                      <input type="file" className="hidden" accept="image/png,image/jpeg" onChange={handleLogoUpload} />
                    </label>
                  </div>
                </div>
                <div className="flex-1 space-y-4">
                  <p className="text-[10px] text-muted-foreground leading-relaxed font-black uppercase tracking-wider italic opacity-70">
                    * Recommended: PNG Transparent
                    <br />
                    * Max size: 500 KB
                    <br />
                    * Preferred ratio: Square or Landscape
                  </p>
                  <label className="inline-flex items-center gap-3 px-6 py-3 bg-foreground text-background font-black text-[10px] cursor-pointer hover:scale-105 transition-all uppercase tracking-widest border border-border">
                    <Upload className="w-4 h-4" />{t('تحميل الشعار')}<input type="file" className="hidden" accept="image/png,image/jpeg" onChange={handleLogoUpload} />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Branding & Visual Identity Settings */}
        <section className="bg-card border-2 border-border p-10 space-y-10 transition-all hover:border-primary/20">
          <div className="flex items-center gap-4 text-primary">
            <div className="p-2 bg-primary/5 rounded-none">
              <Palette className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-black uppercase tracking-[0.2em]">{t('الهوية البصرية والمظهر (Branding & Identity)')}</h2>
          </div>

          {/* Preset Palettes */}
          <div className="space-y-4">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block text-right">{t('قوالب ألوان جاهزة (Preset Color Palettes)')}</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {[
                { name: t('الافتراضي الزاهي'), desc: 'OPerix Default', primary: '#0ea5e9', secondary: '#10b981', sidebar: '#0f172a', button: '#0ea5e9' },
                { name: t('الغابة والنعناع'), desc: 'Forest Mint', primary: '#10b981', secondary: '#0ea5e9', sidebar: '#064e3b', button: '#10b981' },
                { name: t('الملكي الفاخر'), desc: 'Royal Luxury', primary: '#d97706', secondary: '#1e3a8a', sidebar: '#1e1e24', button: '#d97706' },
                { name: t('التكنولوجي الداكن'), desc: 'Deep Tech', primary: '#4f46e5', secondary: '#06b6d4', sidebar: '#020617', button: '#4f46e5' },
                { name: t('القرمزي الجريء'), desc: 'Crimson Bold', primary: '#e11d48', secondary: '#f59e0b', sidebar: '#111827', button: '#e11d48' }
              ].map((p, idx) => {
                const isSelected = 
                  settings.primaryColor === p.primary &&
                  settings.secondaryColor === p.secondary &&
                  settings.sidebarColor === p.sidebar &&
                  settings.buttonColor === p.button;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSettings(prev => ({
                      ...prev,
                      primaryColor: p.primary,
                      secondaryColor: p.secondary,
                      sidebarColor: p.sidebar,
                      buttonColor: p.button
                    }))}
                    className={cn(
                      "p-4 border-2 rounded-none text-right transition-all duration-300 relative overflow-hidden flex flex-col justify-between h-28 hover:border-primary/60",
                      isSelected ? "border-primary bg-primary/5 shadow-md" : "border-border bg-muted/30"
                    )}
                  >
                    <div>
                      <h4 className="font-bold text-xs text-foreground tracking-tight">{p.name}</h4>
                      <p className="text-[9px] text-muted-foreground uppercase font-semibold">{p.desc}</p>
                    </div>
                    <div className="flex gap-1.5 items-center mt-3" dir="ltr">
                      <span className="w-3.5 h-3.5 inline-block border border-black/10" style={{ backgroundColor: p.primary }} title="Primary" />
                      <span className="w-3.5 h-3.5 inline-block border border-black/10" style={{ backgroundColor: p.secondary }} title="Secondary" />
                      <span className="w-3.5 h-3.5 inline-block border border-black/10" style={{ backgroundColor: p.sidebar }} title="Sidebar" />
                    </div>
                    {isSelected && (
                      <div className="absolute top-1 left-1 bg-primary text-primary-foreground p-0.5 rounded-full">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color Pickers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">{t('اللون الأساسي (Primary Color)')}</label>
              <div className="flex items-center gap-3 border-2 border-border p-3 bg-muted">
                <input 
                  type="color" 
                  value={settings.primaryColor}
                  onChange={e => setSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
                  className="w-12 h-12 border-0 cursor-pointer p-0 bg-transparent"
                />
                <input 
                  type="text" 
                  value={settings.primaryColor}
                  onChange={e => setSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
                  className="bg-transparent border-0 font-mono text-sm uppercase font-bold outline-none flex-1 py-1"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">{t('اللون الثانوي (Secondary Color)')}</label>
              <div className="flex items-center gap-3 border-2 border-border p-3 bg-muted">
                <input 
                  type="color" 
                  value={settings.secondaryColor}
                  onChange={e => setSettings(prev => ({ ...prev, secondaryColor: e.target.value }))}
                  className="w-12 h-12 border-0 cursor-pointer p-0 bg-transparent"
                />
                <input 
                  type="text" 
                  value={settings.secondaryColor}
                  onChange={e => setSettings(prev => ({ ...prev, secondaryColor: e.target.value }))}
                  className="bg-transparent border-0 font-mono text-sm uppercase font-bold outline-none flex-1 py-1"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">{t('لون القائمة (Sidebar Color)')}</label>
              <div className="flex items-center gap-3 border-2 border-border p-3 bg-muted">
                <input 
                  type="color" 
                  value={settings.sidebarColor}
                  onChange={e => setSettings(prev => ({ ...prev, sidebarColor: e.target.value }))}
                  className="w-12 h-12 border-0 cursor-pointer p-0 bg-transparent"
                />
                <input 
                  type="text" 
                  value={settings.sidebarColor}
                  onChange={e => setSettings(prev => ({ ...prev, sidebarColor: e.target.value }))}
                  className="bg-transparent border-0 font-mono text-sm uppercase font-bold outline-none flex-1 py-1"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">{t('لون الأزرار (Buttons Color)')}</label>
              <div className="flex items-center gap-3 border-2 border-border p-3 bg-muted">
                <input 
                  type="color" 
                  value={settings.buttonColor}
                  onChange={e => setSettings(prev => ({ ...prev, buttonColor: e.target.value }))}
                  className="w-12 h-12 border-0 cursor-pointer p-0 bg-transparent"
                />
                <input 
                  type="text" 
                  value={settings.buttonColor}
                  onChange={e => setSettings(prev => ({ ...prev, buttonColor: e.target.value }))}
                  className="bg-transparent border-0 font-mono text-sm uppercase font-bold outline-none flex-1 py-1"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-4 border-t border-border">
            {/* Dark Mode Default Option */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs font-black text-foreground block">{t('تفعيل الوضع الداكن كوضع افتراضي')}</span>
                <span className="text-[9px] font-black text-muted-foreground leading-relaxed block max-w-sm">{t('سيتم توجيه المستخدمين الجدد أو الأجهزة غير المعينة إلى المظهر الداكن تلقائياً.')}</span>
              </div>
              <button
                type="button"
                onClick={() => setSettings(prev => ({ ...prev, darkModeEnabled: !prev.darkModeEnabled }))}
                className={cn(
                  "w-14 h-7 rounded-full transition-all flex items-center p-1 border-2",
                  settings.darkModeEnabled ? "bg-primary border-primary" : "bg-muted border-border"
                )}
              >
                <div className={cn(
                  "w-4 h-4 rounded-full transition-all shadow-sm",
                  settings.darkModeEnabled ? "translate-x-7 bg-white" : "translate-x-0 bg-muted-foreground"
                )} />
              </button>
            </div>

            {/* Default Language Selector */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs font-black text-foreground block">{t('اللغة الافتراضية للنظام (Default Language)')}</span>
                <span className="text-[9px] font-black text-muted-foreground block">{t('سيتم تنشيط هذه اللغة كخيار افتراضي قبل تصفح المستخدم.')}</span>
              </div>
              <select
                value={settings.defaultLanguage}
                onChange={e => setSettings(prev => ({ ...prev, defaultLanguage: e.target.value }))}
                className="bg-muted border-2 border-border focus:border-primary p-3 pr-8 outline-none font-bold text-xs"
              >
                <option value="ar">{t('العربية (Arabic - RTL)')}</option>
                <option value="en">English (LTR)</option>
              </select>
            </div>
          </div>

          {/* Live System Preview */}
          <div className="pt-6 border-t border-border space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">{t('المعاينة الحية للنظام (Live Dashboard Preview)')}</label>
              <div className="text-[9px] font-black text-primary px-3 py-1 bg-primary/10 tracking-widest uppercase animate-pulse">{t('شاشة تفاعلية لمحاكاة الألوان')}</div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div className="border border-border p-6 bg-background/50 relative overflow-hidden flex flex-col md:flex-row gap-6" dir="rtl">
                
                {/* Simulated Sidebar */}
                <div 
                  className="w-full md:w-52 p-4 text-white overflow-hidden flex flex-col justify-between shrink-0 border border-black/10 transition-colors duration-500"
                  style={{ backgroundColor: settings.sidebarColor }}
                >
                  <div className="space-y-5">
                    <div className="flex items-center gap-2.5 pb-4 border-b border-white/10">
                      <div className="w-8 h-8 rounded-none bg-white/10 flex items-center justify-center shrink-0">
                        {settings.logoUrl ? (
                          <img src={settings.logoUrl} alt="logo" className="w-full h-full object-contain p-0.5" referrerPolicy="no-referrer" />
                        ) : (
                          <Layout className="w-4 h-4 text-white" />
                        )}
                      </div>
                      <span className="text-xs font-black tracking-tight truncate">{settings.organizationName || 'OPerix'}</span>
                    </div>

                    <div className="space-y-2">
                      <div className="text-[8px] font-bold text-white/40 uppercase tracking-widest text-right">{t('المحتويات')}</div>
                      <div className="px-3 py-2 text-[10px] font-bold bg-white/10 border-r-2 border-white flex items-center gap-2">
                        <Layout className="w-3.5 h-3.5" />
                        <span>{t('لوحة التحكم الرئيسية')}</span>
                      </div>
                      <div className="px-3 py-2 text-[10px] font-bold text-white/60 hover:text-white flex items-center gap-2 cursor-pointer">
                        <Building2 className="w-3.5 h-3.5" />
                        <span>{t('إدارة الموظفين')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-[8px] text-white/30 font-semibold tracking-wider pt-6 border-t border-white/10 mt-6 text-right">
                    OPerix Enterprise Client
                  </div>
                </div>

                {/* Simulated Content Area */}
                <div className="flex-1 space-y-6">
                  {/* Simulated Header */}
                  <div className="flex justify-between items-center pb-4 border-b border-border">
                    <div className="space-y-0.5">
                      <h4 className="text-sm font-black text-foreground">{t('المشروع الحالي والمستجدات')}</h4>
                      <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">System Overview Statistics</p>
                    </div>
                    <span className="text-[9px] font-mono text-muted-foreground">UTC-04 / Live</span>
                  </div>

                  {/* Simulated Cards / Widgets */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-card border-2 border-border p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: settings.primaryColor }} />
                        <h5 className="font-bold text-xs text-foreground">{t('لوحة مؤشرات الأداء')}</h5>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">{t('تُظهر الهوية البصرية الحالية نسبة السطوع المتناسقة مع الألوان والخطوط.')}</p>
                      <div className="pt-2">
                        <span className="text-xs font-bold font-mono" style={{ color: settings.primaryColor }}>{t('84.5% مستقر')}</span>
                      </div>
                    </div>

                    <div className="bg-card border-2 border-border p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: settings.secondaryColor }} />
                        <h5 className="font-bold text-xs text-foreground">{t('صيانة قاعدة البيانات')}</h5>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">{t('تحديثات أوقات العمل التلقائية متزامنة بشكل كامل.')}</p>
                      <div className="pt-2">
                        <span className="text-xs font-bold font-mono" style={{ color: settings.secondaryColor }}>{t('100% نجاح')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Simulated Buttons */}
                  <div className="flex flex-wrap items-center gap-4 pt-2">
                    <button 
                      type="button" 
                      className="px-5 py-2.5 text-[10px] font-black text-white hover:scale-105 active:scale-95 transition-all outline-none"
                      style={{ backgroundColor: settings.buttonColor }}
                    >{t('زر أساسي مبهر')}</button>
                    <button 
                      type="button" 
                      className="px-5 py-2.5 text-[10px] font-black text-white hover:scale-105 active:scale-95 transition-all outline-none"
                      style={{ backgroundColor: settings.secondaryColor }}
                    >{t('زر المساعدة والتوثيق')}</button>
                    <button 
                      type="button" 
                      className="px-5 py-2.5 text-[10px] font-black border-2 border-border text-muted-foreground hover:text-foreground bg-muted/40 transition-colors"
                    >{t('زر خشن محايد')}</button>
                  </div>

                </div>

              </div>
            </div>
          </div>
        </section>

        {/* Security & Lock Settings */}
        <section className="bg-card border-2 border-border p-10 space-y-10 transition-all hover:border-primary/20">
          <div className="flex items-center justify-between border-b border-border pb-6">
            <div className="flex items-center gap-4 text-primary">
              <div className="p-2 bg-primary/5 rounded-none">
                <Lock className="w-5 h-5" />
              </div>
              <h2 className="text-sm font-black uppercase tracking-[0.2em]">{t('أمن النظام (Security Controls)')}</h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black text-muted-foreground uppercase opacity-60">{t('تفعيل قفل الشاشة')}</span>
              <button
                type="button"
                onClick={() => setSettings(prev => ({ ...prev, isLockEnabled: !prev.isLockEnabled }))}
                className={cn(
                  "w-14 h-7 rounded-full transition-all flex items-center p-1 border-2",
                  settings.isLockEnabled ? "bg-primary border-primary" : "bg-muted border-border"
                )}
              >
                <div className={cn(
                  "w-4 h-4 rounded-full transition-all shadow-sm",
                  settings.isLockEnabled ? "translate-x-7 bg-white" : "translate-x-0 bg-muted-foreground"
                )} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-4">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">{t('كلمة مرور قفل النظام (العامة)')}</label>
              <div className="relative group">
                <input 
                  type={showPassword ? "text" : "password"}
                  value={settings.lockPassword || ''}
                  onChange={e => setSettings(prev => ({ ...prev, lockPassword: e.target.value }))}
                  className="w-full bg-muted border-2 border-border focus:border-primary p-5 pl-14 outline-none font-black text-xl tracking-[0.5em] transition-all text-foreground"
                  placeholder="0000"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                >
                  {showPassword ? <EyeOff className="w-6 h-6" /> : <Eye className="w-6 h-6" />}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground font-black uppercase italic tracking-tighter opacity-70 border-r-2 border-primary/20 pr-4">{t('تُستخدم هذه الكلمة ككلمة عامة في حالة عدم تعيين الموظف لكلمة مرور لقفل شاشته الشخصية.')}</p>
            </div>

            <div className={cn("space-y-4 transition-all duration-500", settings.isLockEnabled ? "opacity-100" : "opacity-30 pointer-events-none")}>
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">{t('وقت الخمول للقفل التلقائي (بالدقائق)')}</label>
              <div className="flex items-center gap-4">
                 <input 
                   type="number"
                   min={1}
                   max={60}
                   value={settings.idleTimeoutMinutes}
                   onChange={e => setSettings(prev => ({ ...prev, idleTimeoutMinutes: parseInt(e.target.value) }))}
                   className="w-24 bg-muted border-2 border-border focus:border-primary p-5 outline-none font-black text-center text-xl transition-all text-foreground"
                 />
                 <div className="flex-1">
                    <div className="flex justify-between mb-2">
                       <span className="text-[9px] font-black text-muted-foreground">1 min</span>
                       <span className="text-[9px] font-black text-muted-foreground">60 min</span>
                    </div>
                    <input 
                      type="range"
                      min={1}
                      max={60}
                      value={settings.idleTimeoutMinutes}
                      onChange={e => setSettings(prev => ({ ...prev, idleTimeoutMinutes: parseInt(e.target.value) }))}
                      className="w-full transition-all accent-primary h-2 bg-muted rounded-none appearance-none"
                    />
                 </div>
              </div>
              <p className="text-[10px] text-muted-foreground font-black uppercase italic tracking-tighter opacity-70 border-r-2 border-primary/20 pr-4">
                سيقوم النظام بقفل الشاشة تلقائياً بعد {settings.idleTimeoutMinutes} دقائق من عدم النشاط.
              </p>
            </div>
          </div>
        </section>

        {/* Feedback Messages */}
        <AnimatePresence>
          {message && (
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className={cn(
                "p-6 border-2 flex items-center justify-between font-black text-xs uppercase tracking-widest shadow-lg",
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

        {/* Actions */}
        <div className="flex justify-end pt-8 relative">
          <div className="absolute inset-x-0 top-0 h-px bg-border group-hover:bg-primary transition-colors" />
          <button 
            type="submit" 
            disabled={saving}
            className="group relative bg-foreground text-background font-black px-16 py-6 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 overflow-hidden shadow-2xl border border-border"
          >
            <div className="relative z-10 flex items-center justify-center gap-4 uppercase tracking-[0.3em] text-xs">
              {saving ? (
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Save className="w-5 h-5" />
              )}
              {saving ? t('جاري الحفظ...') : t('تثبيت الإعدادات النهائية')}
            </div>
            <div className="absolute inset-0 bg-primary translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
          </button>
        </div>
      </form>
    </div>
  );
};
