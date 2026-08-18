import React, { useState, useEffect } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { db, collection, setDoc, doc, deleteDoc, OperationType, handleApiError } from '../../api';
import { useData } from '../../contexts/DataContext';
import { AllowanceType } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { useLanguage } from '../../contexts/LanguageContext';

export const AllowanceTypes: React.FC = () => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { allowanceTypes: types, refreshData } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const docRef = doc(collection(db, 'allowanceTypes'));
    await setDoc(docRef, { name: newName });
    await refreshData();
    setNewName('');
    setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, 'allowanceTypes', id));
    await refreshData();
    setDeleteConfirmId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-black text-foreground">{t('أنواع البدلات')}</h3>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-2xl transition-all shadow-lg shadow-primary/20"
        >
          <Plus className="w-5 h-5" />
          <span>{t('إضافة نوع جديد')}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {types.map((type) => (
          <div key={type.id} className="bg-card p-6 rounded-3xl border border-border shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
            <span className="font-bold text-foreground text-lg">{type.name}</span>
            <button 
              onClick={() => setDeleteConfirmId(type.id)}
              className="p-2 text-destructive hover:bg-destructive/10 rounded-xl transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-card w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 border border-border">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-black text-foreground">{t('إضافة نوع بدل')}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-muted rounded-xl transition-colors"><X className="w-6 h-6 text-muted-foreground" /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-muted-foreground mr-2">{t('اسم البدل')}</label>
                  <input 
                    required
                    autoFocus
                    className="w-full px-5 py-3 bg-muted border border-border rounded-2xl focus:ring-2 focus:ring-primary outline-none font-medium text-foreground"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={t('مثال: بدل سكن، بدل تمثيل...')}
                  />
                </div>
                <button type="submit" className="w-full py-4 bg-primary hover:bg-primary/90 text-primary-foreground font-black rounded-2xl transition-all shadow-lg shadow-primary/20">{t('حفظ النوع')}</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => deleteConfirmId && handleDelete(deleteConfirmId)}
        title={t('تأكيد حذف نوع البدل')}
        description={t('هل أنت متأكد من حذف هذا النوع؟ قد يؤثر ذلك على ملفات الموظفين. لا يمكن التراجع عن هذا الإجراء.')}
      />
    </div>
  );
};
