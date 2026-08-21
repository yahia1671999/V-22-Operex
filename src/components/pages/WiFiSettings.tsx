import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wifi, 
  Plus, 
  Trash2, 
  Edit3, 
  ShieldCheck, 
  Globe, 
  MapPin, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Search,
  Filter,
  Save,
  X,
  History,
  Activity,
  Navigation,
  Lock,
  Compass
} from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { cn } from '../../lib/utils';
import { addDoc, updateDoc, deleteDoc, getDocs } from '../../api';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { useLanguage } from '../../contexts/LanguageContext';

export const WiFiSettings: React.FC = () => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { refreshData } = useData();
  const [networks, setNetworks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNetwork, setEditingNetwork] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPublicIp, setCurrentPublicIp] = useState<string>('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  const [formData, setFormData] = useState({
    networkName: '',
    ssid: '',
    publicIp: '',
    gatewayIp: '',
    ipRangeCidr: '',
    allowedIpStart: '',
    allowedIpEnd: '',
    latitude: '',
    longitude: '',
    allowedRadiusMeters: '100',
    verificationMode: 'Flexible Mode',
    minimumRequiredMatches: '2',
    branchId: '',
    appliesToType: 'All',
    isActive: true,
    allowCheckIn: true,
    allowCheckOut: true,
    notes: ''
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs('wifi-networks' as any);
      const data = snapshot.docs.map(doc => doc.data());
      setNetworks(data);

      try {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipRes.json();
        setCurrentPublicIp(ipData.ip);
      } catch (e) {
        console.error('Cant fetch public IP', e);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        latitude: formData.latitude ? Number(formData.latitude) : null,
        longitude: formData.longitude ? Number(formData.longitude) : null,
        allowedRadiusMeters: formData.allowedRadiusMeters ? Number(formData.allowedRadiusMeters) : 100,
        minimumRequiredMatches: formData.minimumRequiredMatches ? Number(formData.minimumRequiredMatches) : 2,
      };

      if (editingNetwork) {
        await updateDoc({ collection: 'wifi-networks', id: editingNetwork.id }, payload);
      } else {
        await addDoc('wifi-networks', payload);
      }
      setIsModalOpen(false);
      setEditingNetwork(null);
      resetForm();
      loadData();
      refreshData();
    } catch (e) {
      console.error(e);
    }
  };

  const populateForm = (net: any) => {
    setEditingNetwork(net);
    setFormData({
      networkName: net.networkName || '',
      ssid: net.ssid || '',
      publicIp: net.publicIp || '',
      gatewayIp: net.gatewayIp || '',
      ipRangeCidr: net.ipRangeCidr || '',
      allowedIpStart: net.allowedIpStart || '',
      allowedIpEnd: net.allowedIpEnd || '',
      latitude: net.latitude !== null && net.latitude !== undefined ? net.latitude.toString() : '',
      longitude: net.longitude !== null && net.longitude !== undefined ? net.longitude.toString() : '',
      allowedRadiusMeters: net.allowedRadiusMeters !== null && net.allowedRadiusMeters !== undefined ? net.allowedRadiusMeters.toString() : '100',
      verificationMode: net.verificationMode || 'Flexible Mode',
      minimumRequiredMatches: net.minimumRequiredMatches !== null && net.minimumRequiredMatches !== undefined ? net.minimumRequiredMatches.toString() : '2',
      branchId: net.branchId || '',
      appliesToType: net.appliesToType || 'All',
      isActive: net.isActive !== false,
      allowCheckIn: net.allowCheckIn !== false,
      allowCheckOut: net.allowCheckOut !== false,
      notes: net.notes || ''
    });
  };

  const resetForm = () => {
    setFormData({
      networkName: '',
      ssid: '',
      publicIp: '',
      gatewayIp: '',
      ipRangeCidr: '',
      allowedIpStart: '',
      allowedIpEnd: '',
      latitude: '',
      longitude: '',
      allowedRadiusMeters: '100',
      verificationMode: 'Flexible Mode',
      minimumRequiredMatches: '2',
      branchId: '',
      appliesToType: 'All',
      isActive: true,
      allowCheckIn: true,
      allowCheckOut: true,
      notes: ''
    });
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("الـ GPS وتحديد الموقع غير مدعوم في هذا المتصفح");
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6)
        }));
        setGpsLoading(false);
      },
      (error) => {
        console.error("GPS Error Code:", error.code, "Message:", error.message);
        let errorMsg = t(t('فشل الحصول على الموقع الجغرافي (GPS).\n'));
        
        if (error.code === 1) { // PERMISSION_DENIED
          errorMsg += t(t('السبب: تم رفض صلاحية تحديد الموقع (Permission Denied).\n\n')) +
                      "⚠️ إذا كنت تتصفح داخل إطار معاينة AI Studio، يرجى فتح التطبيق في علامة تبويب مستقلة بالنقر على 'Open in new tab' أعلى نافذة المعاينة، وتفعيل إذن الموقع الجغرافي من أيقونة القفل بجانب شريط العنوان.";
        } else if (error.code === 2) { // POSITION_UNAVAILABLE
          errorMsg += t(t('السبب: معلومات الموقع غير متوفرة حالياً (Position Unavailable). يرجى التأكد من تشغيل نظام تحديد المواقع (GPS) بجهازك.'));
        } else if (error.code === 3) { // TIMEOUT
          errorMsg += t(t('السبب: انتهت المهلة المحددة لجلب الموقع (Timeout). يرجى المحاولة مرة أخرى.'));
        } else {
          errorMsg += `السبب: ${error.message || t('غير معروف')}`;
        }
        
        alert(errorMsg);
        setGpsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const handleDelete = async (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = async (id: string) => {
    await deleteDoc({ collection: 'wifi-networks', id });
    loadData();
    refreshData();
  };

  const filteredNetworks = networks.filter(n => 
    n.networkName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    n.publicIp?.includes(searchTerm)
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-foreground flex items-center gap-3">
             <Wifi className="w-8 h-8 text-primary" />{t('إعدادات مواقع وشبكات الحضور')}</h1>
          <p className="text-muted-foreground font-bold mt-1">Attendance Location & Network Settings</p>
        </div>
        <button 
          onClick={() => {
            resetForm();
            setEditingNetwork(null);
            setIsModalOpen(true);
          }}
          className="px-6 py-3 bg-primary text-primary-foreground font-black rounded-none shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />{t('إضافة موقع/شبكة جديدة')}</button>
      </div>

      {/* Stats/Quick Actions */}
      {currentPublicIp && (
        <div className="bg-primary p-4 rounded-none text-primary-foreground flex items-center justify-between shadow-lg shadow-primary/10">
          <div className="flex items-center gap-3">
             <Globe className="w-5 h-5 opacity-80" />
             <p className="font-bold text-sm">{t('عنوان الـ IP العام الخاص بك حالياً هو')}<span className="font-black underline">{currentPublicIp}</span>{t('. استخدمه للربط الجغرافي بالرقم التعريفي للمكتب.')}</p>
          </div>
          <button 
            onClick={() => setFormData({
              ...formData, 
              publicIp: currentPublicIp, 
              networkName: formData.networkName || t('موقع العمل الرئيسي'),
              verificationMode: 'Public IP Only'
            })} 
            className="px-4 py-1.5 bg-background text-primary text-xs font-black rounded-none hover:bg-muted transition-all"
          >{t('استخدام هذا الـ IP')}</button>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-card p-6 border border-border rounded-none shadow-sm flex items-center gap-4 font-bold">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-none flex items-center justify-center text-emerald-600">
               <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
               <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">{t('المواقع النشطة')}</p>
               <p className="text-xl font-black text-foreground">{networks.filter(n => n.isActive).length}</p>
            </div>
         </div>
         <div className="bg-card p-6 border border-border rounded-none shadow-sm flex items-center gap-4 font-bold">
            <div className="w-12 h-12 bg-primary/10 rounded-none flex items-center justify-center text-primary">
               <Activity className="w-6 h-6" />
            </div>
            <div>
               <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">{t('إجمالي المواقع والشبكات')}</p>
               <p className="text-xl font-black text-foreground">{networks.length}</p>
            </div>
         </div>
         <div className="bg-card p-6 border border-border rounded-none shadow-sm flex items-center gap-4 font-bold">
            <div className="w-12 h-12 bg-orange-500/10 rounded-none flex items-center justify-center text-orange-600">
               <Compass className="w-6 h-6" />
            </div>
            <div>
               <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">{t('نوع التحقق')}</p>
               <p className="text-sm font-black text-foreground">{t('خيارات مرنة / GPS وتحقق متعدد')}</p>
            </div>
         </div>
      </div>

      {/* Main Table */}
      <div className="bg-card border border-border rounded-none shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border flex flex-col md:flex-row justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder={t('ابحث باسم الموقع أو الـ IP...')} 
              className="w-full pr-10 pl-4 py-2.5 bg-muted/30 border border-border rounded-none outline-none focus:ring-2 focus:ring-primary font-bold text-sm text-foreground"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-right border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="px-6 py-4 text-xs font-black text-muted-foreground uppercase tracking-widest">{t('الموقع / الشبكة')}</th>
                <th className="px-6 py-4 text-xs font-black text-muted-foreground uppercase tracking-widest">{t('تفاصيل الاتصال والـ IP')}</th>
                <th className="px-6 py-4 text-xs font-black text-muted-foreground uppercase tracking-widest">{t('إحداثيات GPS المعتمدة')}</th>
                <th className="px-6 py-4 text-xs font-black text-muted-foreground uppercase tracking-widest">{t('وضع وغطاء التحقق')}</th>
                <th className="px-6 py-4 text-xs font-black text-muted-foreground uppercase tracking-widest">{t('الحالة')}</th>
                <th className="px-6 py-4 text-xs font-black text-muted-foreground uppercase tracking-widest">{t('الإجراءات')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-bold">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-20 text-muted-foreground font-bold uppercase tracking-widest">{t('جاري التحميل...')}</td></tr>
              ) : filteredNetworks.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-20 text-muted-foreground font-bold uppercase tracking-widest">{t('لا توجد شبكات مضافة')}</td></tr>
              ) : filteredNetworks.map((net) => (
                <tr key={net.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary/10 rounded-none flex items-center justify-center text-primary">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-foreground">{net.networkName}</p>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase">{net.branchId || t('كل الفروع')}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs">
                    <div className="space-y-1">
                      {net.publicIp && <p className="text-foreground flex items-center gap-1.5"><Globe className="w-3 h-3" /> Public: {net.publicIp}</p>}
                      {net.gatewayIp && <p className="text-muted-foreground flex items-center gap-1.5"><Activity className="w-3 h-3" /> Gateway: {net.gatewayIp}</p>}
                      {net.ipRangeCidr && <p className="text-indigo-600 flex items-center gap-1.5"><ShieldCheck className="w-3 h-3" /> CIDR: {net.ipRangeCidr}</p>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs">
                    {net.latitude && net.longitude ? (
                      <div className="space-y-1">
                        <p className="text-foreground flex items-center gap-1.5">Lat: {net.latitude}</p>
                        <p className="text-foreground flex items-center gap-1.5">Lon: {net.longitude}</p>
                        <p className="text-[10px] text-muted-foreground">القطر: {net.allowedRadiusMeters || 100}م</p>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs font-normal">{t('غير معرّف')}</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-tighter border border-indigo-500/20">
                      {net.verificationMode || 'Flexible Mode'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {net.isActive ? (
                      <span className="flex items-center gap-1.5 text-emerald-600 font-black text-xs"><CheckCircle2 className="w-4 h-4" />{t('نشط')}</span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-muted-foreground font-black text-xs"><XCircle className="w-4 h-4" />{t('معطل')}</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                       <button onClick={() => populateForm(net)} className="p-2 text-primary hover:bg-primary/10 transition-all rounded-none border border-transparent hover:border-primary/20"><Edit3 className="w-4 h-4" /></button>
                       <button onClick={() => handleDelete(net.id)} className="p-2 text-destructive hover:bg-destructive/10 transition-all rounded-none border border-transparent hover:border-destructive/20"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-card w-full max-w-2xl rounded-none shadow-2xl relative z-10 overflow-hidden border border-border my-8"
            >
              <div className="p-6 border-b border-border flex items-center justify-between bg-muted/30">
                <h3 className="text-xl font-black text-foreground flex items-center gap-2 uppercase tracking-tighter">
                  {editingNetwork ? t('تعديل موقع/شبكة الحضور') : t('إضافة موقع/شبكة حضور جديدة')}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-muted-foreground hover:text-foreground transition-colors"><X className="w-6 h-6" /></button>
              </div>

              <div className="px-6 pt-4">
                <div className="p-3 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs border border-amber-500/20 font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{t('ملاحظة: SSID اختياري للعلم فقط ولا يستخدم كشرط أساسي في التحقق الفعلي.')}</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                     <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">{t('اسم الموقع / الشبكة')}</label>
                     <input required className="w-full px-4 py-3 bg-muted/30 border border-border rounded-none outline-none focus:ring-2 focus:ring-primary font-bold text-foreground font-mono" value={formData.networkName} onChange={(e) => setFormData({...formData, networkName: e.target.value})} placeholder={t('مثال: مبنى الإدارة الرئيسي')} />
                   </div>
                   <div className="space-y-2">
                     <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">{t('SSID (اختياري)')}</label>
                     <input className="w-full px-4 py-3 bg-muted/30 border border-border rounded-none outline-none focus:ring-2 focus:ring-primary font-bold text-foreground font-mono" value={formData.ssid} onChange={(e) => setFormData({...formData, ssid: e.target.value})} placeholder="OPerix_HQ_Wifi" />
                   </div>
                   <div className="space-y-2">
                     <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">{t('عنوان IP العام (Public IP)')}</label>
                     <input className="w-full px-4 py-3 bg-muted/30 border border-border rounded-none outline-none focus:ring-2 focus:ring-primary font-bold text-foreground font-mono" value={formData.publicIp} onChange={(e) => setFormData({...formData, publicIp: e.target.value})} placeholder="92.100.20.15" />
                   </div>
                   <div className="space-y-2">
                     <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">{t('عنوان الـ Gateway (الموجه)')}</label>
                     <input className="w-full px-4 py-3 bg-muted/30 border border-border rounded-none outline-none focus:ring-2 focus:ring-primary font-bold text-foreground font-mono" value={formData.gatewayIp} onChange={(e) => setFormData({...formData, gatewayIp: e.target.value})} placeholder="192.168.1.1" />
                   </div>

                   <div className="space-y-2">
                     <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">{t('نطاق IP بصيغة CIDR')}</label>
                     <input className="w-full px-4 py-3 bg-muted/30 border border-border rounded-none outline-none focus:ring-2 focus:ring-primary font-bold text-foreground font-mono" value={formData.ipRangeCidr} onChange={(e) => setFormData({...formData, ipRangeCidr: e.target.value})} placeholder="192.168.100.0/24" />
                   </div>

                   <div className="space-y-2">
                     <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">{t('وضع التحقق (Verification Mode)')}</label>
                     <select className="w-full px-4 py-3 bg-muted/30 border border-border rounded-none outline-none focus:ring-2 focus:ring-primary font-bold text-foreground transition-all" value={formData.verificationMode || ''} onChange={(e) => setFormData({...formData, verificationMode: e.target.value})}>
                        <option value="Flexible Mode" className="bg-card">{t('التحقق المرن (Flexible Mode)')}</option>
                        <option value="Strict Mode" className="bg-card">{t('التحقق الصارم (Strict Mode)')}</option>
                        <option value="Network Only" className="bg-card">{t('الشبكة فقط (Network Only)')}</option>
                        <option value="GPS Only" className="bg-card">{t('الموقع الجغرافي فقط (GPS Only)')}</option>
                        <option value="Public IP Only" className="bg-card">{t('عنوان IP العام فقط')}</option>
                     </select>
                   </div>

                   <div className="space-y-2">
                     <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">{t('بداية الـ IP المسموح (Allowed IP Start)')}</label>
                     <input className="w-full px-4 py-3 bg-muted/30 border border-border rounded-none outline-none focus:ring-2 focus:ring-primary font-bold text-foreground font-mono" value={formData.allowedIpStart} onChange={(e) => setFormData({...formData, allowedIpStart: e.target.value})} placeholder="192.168.100.1" />
                   </div>
                   <div className="space-y-2">
                     <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">{t('نهاية الـ IP المسموح (Allowed IP End)')}</label>
                     <input className="w-full px-4 py-3 bg-muted/30 border border-border rounded-none outline-none focus:ring-2 focus:ring-primary font-bold text-foreground font-mono" value={formData.allowedIpEnd} onChange={(e) => setFormData({...formData, allowedIpEnd: e.target.value})} placeholder="192.168.100.254" />
                   </div>

                   {/* GPS Location Fields & Current Location Trigger */}
                   <div className="col-span-1 md:col-span-2 border border-border p-4 bg-muted/10 space-y-4">
                     <div className="flex justify-between items-center">
                       <span className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                         <MapPin className="w-4 h-4 text-primary" />{t('الإحداثيات الجغرافية لمقر الفرع (GPS Coordinates)')}</span>
                       <button
                         type="button"
                         onClick={handleUseCurrentLocation}
                         disabled={gpsLoading}
                         className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-black hover:bg-primary/90 transition-all flex items-center gap-1.5 disabled:opacity-50"
                       >
                         <Navigation className="w-3.5 h-3.5" />
                         {gpsLoading ? t('جاري القراءة...') : 'Use Current Location'}
                       </button>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                       <div className="space-y-1">
                         <label className="text-[10px] font-black text-muted-foreground uppercase uppercase">{t('خط العرض (Latitude)')}</label>
                         <input className="w-full px-3 py-2 bg-muted/35 border border-border rounded-none outline-none focus:ring-2 focus:ring-primary text-xs font-bold text-foreground font-mono" value={formData.latitude} onChange={(e) => setFormData({...formData, latitude: e.target.value})} placeholder={t('مثال: 21.4858')} />
                       </div>
                       <div className="space-y-1">
                         <label className="text-[10px] font-black text-muted-foreground uppercase">{t('خط الطول (Longitude)')}</label>
                         <input className="w-full px-3 py-2 bg-muted/35 border border-border rounded-none outline-none focus:ring-2 focus:ring-primary text-xs font-bold text-foreground font-mono" value={formData.longitude} onChange={(e) => setFormData({...formData, longitude: e.target.value})} placeholder={t('مثال: 39.1879')} />
                       </div>
                       <div className="space-y-1">
                         <label className="text-[10px] font-black text-muted-foreground uppercase">{t('النطاق والقطر بالمتر (Radius)')}</label>
                         <input className="w-full px-3 py-2 bg-muted/35 border border-border rounded-none outline-none focus:ring-2 focus:ring-primary text-xs font-bold text-foreground font-mono" value={formData.allowedRadiusMeters} onChange={(e) => setFormData({...formData, allowedRadiusMeters: e.target.value})} placeholder="100" />
                       </div>
                     </div>
                   </div>

                   {/* Minimum matches & applies to type */}
                   <div className="space-y-2">
                     <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">{t('عدد المطابقات المطلوبة للتحقق المرن')}</label>
                     <input type="number" min="1" max="4" className="w-full px-4 py-3 bg-muted/30 border border-border rounded-none outline-none focus:ring-2 focus:ring-primary font-bold text-foreground font-mono" value={formData.minimumRequiredMatches} onChange={(e) => setFormData({...formData, minimumRequiredMatches: e.target.value})} placeholder="2" />
                   </div>
                   <div className="space-y-2">
                     <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">{t('الفرع المطبق عليه الإعداد')}</label>
                     <select className="w-full px-4 py-3 bg-muted/30 border border-border rounded-none outline-none focus:ring-2 focus:ring-primary font-bold text-foreground transition-all" value={formData.branchId || ''} onChange={(e) => setFormData({...formData, branchId: e.target.value})}>
                        <option value="" className="bg-card">{t('كل الفروع')}</option>
                        <option value="HQ" className="bg-card">{t('المقر الرئيسي')}</option>
                        <option value="BR1" className="bg-card">{t('فرع جدة')}</option>
                     </select>
                   </div>
                </div>

                <div className="flex flex-wrap gap-6 pt-4 border-t border-border">
                   <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" className="w-5 h-5 rounded-none border-border bg-muted/50 text-primary focus:ring-primary" checked={formData.isActive} onChange={(e) => setFormData({...formData, isActive: e.target.checked})} />
                      <span className="text-sm font-black text-foreground">{t('الوضع نشط')}</span>
                   </label>
                   <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" className="w-5 h-5 rounded-none border-border bg-muted/50 text-primary focus:ring-primary" checked={formData.allowCheckIn} onChange={(e) => setFormData({...formData, allowCheckIn: e.target.checked})} />
                      <span className="text-sm font-black text-foreground">{t('السماح بتسجيل الحضور')}</span>
                   </label>
                   <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" className="w-5 h-5 rounded-none border-border bg-muted/50 text-primary focus:ring-primary" checked={formData.allowCheckOut} onChange={(e) => setFormData({...formData, allowCheckOut: e.target.checked})} />
                      <span className="text-sm font-black text-foreground">{t('السماح بتسجيل الانصراف')}</span>
                   </label>
                </div>

                <div className="pt-6 flex gap-4">
                  <button type="submit" className="flex-1 py-4 bg-primary text-primary-foreground font-black rounded-none shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-2">
                    <Save className="w-5 h-5" />{t('حفظ البيانات الإعدادية')}</button>
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-8 py-4 bg-muted text-muted-foreground font-black rounded-none transition-all">{t('إلغاء')}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <ConfirmDialog
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={async () => {
          if (deleteConfirmId) {
            await confirmDelete(deleteConfirmId);
            setDeleteConfirmId(null);
          }
        }}
        title={t('تأكيد حذف موقع/شبكة الحضور')}
        description={t('هل أنت متأكد من حذف هذا الموقع؟ الموظفون لن يتمكنوا من إثبات الحضور منه بعد الآن.')}
      />
    </div>
  );
};
