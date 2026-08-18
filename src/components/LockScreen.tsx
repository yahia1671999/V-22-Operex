import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Unlock, ShieldAlert, KeyRound, ShieldCheck, User } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../AuthContext';
import { cn } from '../lib/utils';

interface LockScreenProps {
  onUnlock: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ onUnlock }) => {
  const { systemSettings } = useData();
  const { user, profile } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    setError(false);

    // Order of priority for password:
    // 1. User's personal lock password
    // 2. Global system lock password
    // 3. Default '0000'
    const userLockPassword = (profile as any)?.lockPassword;
    const globalLockPassword = systemSettings?.lockPassword || '0000';
    
    // If user has set a personal password, only that works. 
    // Otherwise fallback to global.
    const correctPassword = userLockPassword || globalLockPassword;

    if (password === correctPassword) {
      onUnlock();
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
      setIsVerifying(false);
      setPassword('');
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950 flex items-center justify-center p-6 sm:p-10 overflow-hidden">
      {/* Background decoration with animated wavy mesh gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none mix-blend-screen opacity-30 filter blur-[100px]">
        <div className="absolute top-[-10%] left-[-10%] w-[45vw] h-[45vw] rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 animate-mesh-1" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-gradient-to-tr from-emerald-500 to-teal-600 animate-mesh-2" />
        <div className="absolute top-[40%] left-[30%] w-[35vw] h-[35vw] rounded-full bg-gradient-to-r from-blue-700 to-indigo-600 animate-mesh-3" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-lg bg-white/5 dark:bg-slate-900/40 border-2 border-white/10 dark:border-slate-800/50 p-12 md:p-16 rounded-none shadow-[0_60px_120px_-20px_rgba(0,0,0,0.7)] text-center relative overflow-hidden backdrop-blur-3xl"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-emerald-500 to-blue-600" />
        
        <div className="relative z-10 flex flex-col items-center">
          {/* Org Logo & Name */}
          <div className="mb-10 flex flex-col items-center">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-36 h-36 mb-6 flex items-center justify-center transition-all duration-700 overflow-hidden bg-transparent relative"
            >
              {/* Soft logo backdrop glow */}
              <div className="absolute inset-2 rounded-full bg-primary/10 blur-xl opacity-60 animate-pulse" />
              
              {systemSettings?.logoUrl ? (
                <img 
                  src={systemSettings.logoUrl} 
                  alt="Logo" 
                  className="max-w-full max-h-full object-contain filter drop-shadow-[0_0_15px_rgba(14,165,233,0.3)]" 
                  referrerPolicy="no-referrer" 
                />
              ) : (
                <div className="p-5 border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl rounded-3xl flex items-center justify-center">
                  <ShieldCheck className="w-16 h-16 text-white drop-shadow-[0_0_10px_rgba(14,165,233,0.5)]" />
                </div>
              )}
            </motion.div>
            <h1 className="text-4xl font-black text-white uppercase tracking-tighter mb-2 font-sans italic">
              {systemSettings?.organizationName || 'OPerix'}
            </h1>
            <div className="flex items-center gap-3">
               <span className="h-[2px] w-6 bg-primary/40 text-transparent" />
               <p className="text-[10px] font-black text-primary uppercase tracking-[0.5em] opacity-80">
                 Secure Terminal Locked
               </p>
               <span className="h-[2px] w-6 bg-primary/40 text-transparent" />
            </div>
          </div>

          <div className="mb-10 flex flex-col items-center px-8 py-4 bg-white/5 border-y border-white/5 w-full">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 overflow-hidden rounded-none border border-primary/30 relative bg-slate-900">
                {(profile as any)?.photoUrl || (profile as any)?.image ? (
                  <img 
                    src={(profile as any)?.photoUrl || (profile as any)?.image} 
                    alt="User" 
                    className="w-full h-full object-cover opacity-80" 
                    referrerPolicy="no-referrer" 
                    crossOrigin="anonymous" 
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-primary/10">
                     <User className="w-6 h-6 text-primary" />
                  </div>
                )}
              </div>
              <div className="text-right">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Active Session</p>
                <p className="text-lg font-black text-white uppercase tracking-tight">
                  {(profile as any)?.name || user?.displayName || 'Authorized Admin'}
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleUnlock} className="w-full space-y-8">
            <div className="relative group max-w-sm mx-auto">
              <div className="absolute inset-y-0 right-0 pr-6 flex items-center pointer-events-none text-slate-500 group-focus-within:text-primary transition-all duration-300">
                <Lock className="w-5 h-5" />
              </div>
              <input 
                type="password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={cn(
                  "w-full bg-slate-950/60 border-2 p-6 pr-14 outline-none font-black text-center tracking-[1.5em] text-white transition-all text-2xl focus:shadow-[0_0_60px_-15px_var(--primary)]",
                  error ? 'border-destructive animate-shake shadow-[0_0_30px_rgba(239,68,68,0.3)]' : 'border-white/10 dark:border-slate-800 focus:border-primary'
                )}
                placeholder="••••"
                maxLength={4}
              />
            </div>

            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center gap-3 text-destructive text-[11px] font-black uppercase tracking-widest justify-center bg-destructive/10 py-4 border-y border-destructive/20"
                >
                  <ShieldAlert className="w-4 h-4" />
                  رمز الحماية غير صحيح (Invalid Terminal Key)
                </motion.div>
              )}
            </AnimatePresence>

            <button 
              type="submit"
              disabled={isVerifying}
              className="w-full bg-white text-slate-950 py-6 flex items-center justify-center gap-4 disabled:opacity-50 group hover:bg-primary hover:text-white transition-all duration-300 font-black text-xs uppercase tracking-[0.3em] overflow-hidden relative shadow-2xl"
            >
              <div className="relative z-10 flex items-center gap-3">
                {isVerifying ? (
                  <div className="w-6 h-6 border-3 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Unlock className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                    إلغاء قفل النظام (Unlock Session)
                  </>
                )}
              </div>
            </button>
          </form>

          <footer className="mt-16 pt-10 border-t border-white/5 w-full flex justify-between items-center px-4">
            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
              Biometric Relay Encrypted
            </p>
            <ShieldCheck className="w-4 h-4 text-slate-700" />
          </footer>
        </div>
      </motion.div>
      
      {/* CSS for shake and custom mesh animations */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          75% { transform: translateX(8px); }
        }
        .animate-shake {
          animation: shake 0.2s ease-in-out infinite;
        }
        @keyframes mesh-1 {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.15); }
          66% { transform: translate(-15px, 15px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        @keyframes mesh-2 {
          0% { transform: translate(0px, 0px) scale(1.1); }
          33% { transform: translate(-40px, 30px) scale(0.95); }
          66% { transform: translate(25px, -25px) scale(1.1); }
          100% { transform: translate(0px, 0px) scale(1.1); }
        }
        @keyframes mesh-3 {
          0% { transform: translate(0px, 0px) scale(0.95); }
          50% { transform: translate(25px, 40px) scale(1.05); }
          100% { transform: translate(0px, 0px) scale(0.95); }
        }
        .animate-mesh-1 { animation: mesh-1 15s infinite ease-in-out; }
        .animate-mesh-2 { animation: mesh-2 18s infinite ease-in-out; }
        .animate-mesh-3 { animation: mesh-3 12s infinite ease-in-out; }
      `}</style>
    </div>
  );
};
