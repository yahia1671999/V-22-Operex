import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Trash2, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'تأكيد الحذف',
  cancelLabel = 'إلغاء',
  variant = 'danger'
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-card w-full max-w-md max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden border border-border overflow-y-auto"
          >
            <div className="p-8 text-center">
              <div className={cn(
                "w-20 h-20 mx-auto rounded-3xl flex items-center justify-center mb-6",
                variant === 'danger' ? "bg-red-500/10 text-red-500" : 
                variant === 'warning' ? "bg-amber-500/10 text-amber-500" : "bg-primary/10 text-primary"
              )}>
                {variant === 'danger' ? <Trash2 className="w-10 h-10" /> : <AlertCircle className="w-10 h-10" />}
              </div>
              
              <h3 className="text-2xl font-black text-foreground mb-3">{title}</h3>
              <p className="text-muted-foreground font-medium leading-relaxed mb-8">
                {description}
              </p>
              
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className={cn(
                    "flex-1 py-4 font-black rounded-2xl transition-all shadow-lg active:scale-95",
                    variant === 'danger' ? "bg-destructive text-destructive-foreground shadow-destructive/20 hover:bg-destructive/90" :
                    variant === 'warning' ? "bg-amber-500 text-white shadow-amber-500/20 hover:bg-amber-600" :
                    "bg-primary text-primary-foreground shadow-primary/20 hover:bg-primary/90"
                  )}
                >
                  {confirmLabel}
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-4 bg-muted text-muted-foreground font-black rounded-2xl hover:bg-muted/80 transition-colors border border-border active:scale-95"
                >
                  {cancelLabel}
                </button>
              </div>
            </div>
            
            <button 
              onClick={onClose}
              className="absolute top-6 left-6 p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
