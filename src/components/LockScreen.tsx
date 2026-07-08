import React, { useState } from 'react';
import { translations, type Language } from '../translations';
import { Lock, Unlock } from 'lucide-react';
import { APP_CONFIG } from '../config';

interface LockScreenProps {
  lang: Language;
  correctPin: string;
  onUnlock: () => void;
  shopName: string;
}

export default function LockScreen({ lang, correctPin, onUnlock, shopName }: LockScreenProps) {
  const [pinInput, setPinInput] = useState('');
  const [error, setError] = useState(false);
  const t = translations[lang];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === correctPin) {
      setError(false);
      onUnlock();
    } else {
      setError(true);
      setPinInput('');
    }
  };

  return (
    <div className="fixed inset-0 bg-sky-200 flex flex-col items-center justify-center p-4 z-50">
      <div className="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-sm border border-sky-100 flex flex-col items-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gold"></div>
        
        <div className="w-28 h-28 bg-white border border-sky-50 rounded-2xl flex items-center justify-center mb-8 shadow-xl relative group">
          <div className="absolute inset-0 bg-gold blur-lg opacity-20 transition-opacity"></div>
          <img src={APP_CONFIG.appIcon} alt="Logo" className="w-20 h-20 object-contain relative z-10" referrerPolicy="no-referrer" />
        </div>
        
        <h1 className="text-3xl font-black urdu-text text-sky-900 mb-2 text-center tracking-tight">{shopName}</h1>
        <p className="text-sky-400 font-bold uppercase tracking-widest text-[10px] mb-10">{t.enterPin}</p>

        <form onSubmit={handleSubmit} className="w-full relative">
          <div className="relative">
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              dir="ltr"
              value={pinInput}
              onChange={(e) => {
                setPinInput(e.target.value);
                setError(false);
              }}
              className={`w-full px-6 py-6 rounded-2xl border-2 outline-none text-center text-4xl font-black tracking-[1em] transition-all ${
                error ? 'border-red-500 bg-red-50' : 'border-sky-50 focus:border-gold bg-sky-50 focus:bg-white shadow-inner'
              }`}
              placeholder="••••"
              autoFocus
            />
          </div>
          
          {error && (
            <p className="text-red-500 text-xs text-center mt-4 font-bold uppercase tracking-widest animate-bounce">{t.invalidPin}</p>
          )}

          <button
            type="submit"
            disabled={!pinInput}
            className="w-full mt-10 bg-sky-600 hover:bg-sky-700 disabled:opacity-30 text-white font-black py-5 rounded-2xl transition-all shadow-xl shadow-sky-200 flex items-center justify-center gap-3 hover:-translate-y-1 active:translate-y-0"
          >
            <Unlock size={24} className="text-gold" />
            <span className="urdu-text text-xl">{t.unlock}</span>
          </button>
        </form>

        <div className="mt-12 text-center">
            <p className="text-[10px] text-zinc-300 font-bold uppercase tracking-widest">Secure Access Only</p>
        </div>
      </div>
    </div>
  );
}
