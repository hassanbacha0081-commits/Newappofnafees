import React, { useState } from 'react';
import { X, Lock, KeyRound } from 'lucide-react';
import { translations, type Language } from '../translations';

interface SecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerifySuccess: () => void;
  correctPin: string;
  lang: Language;
  actionName: string;
}

export function SecurityModal({ isOpen, onClose, onVerifySuccess, correctPin, lang, actionName }: SecurityModalProps) {
  const [pinInput, setPinInput] = useState('');
  const [error, setError] = useState(false);

  if (!isOpen) return null;

  const t = translations[lang];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === correctPin) {
      setError(false);
      setPinInput('');
      onVerifySuccess();
      onClose();
    } else {
      setError(true);
      setPinInput('');
    }
  };

  const titleUr = "مالک کی اجازت درکار ہے";
  const titleEn = "Owner Permission Required";
  
  const descUr = `"${actionName}" عمل انجام دینے کے لیے ایپ کا سیکیورٹی پاس ورڈ درج کریں:`;
  const descEn = `Please enter your app password/PIN to authorize "${actionName}":`;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-sky-100 relative">
        <div className="absolute top-0 left-0 w-full h-2 bg-gold"></div>
        
        {/* Header */}
        <div className="p-5 border-b flex justify-between items-center bg-sky-50">
          <div className="flex items-center gap-2.5 text-sky-900">
            <Lock size={20} className="text-gold-dark" />
            <h3 className="text-lg font-bold urdu-text">
              {lang === 'ur' ? titleUr : titleEn}
            </h3>
          </div>
          <button 
            onClick={() => {
              setPinInput('');
              setError(false);
              onClose();
            }}
            className="p-1.5 hover:bg-sky-100 rounded-full transition-colors text-sky-700"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="text-center space-y-2">
            <p className="text-zinc-600 text-sm urdu-text leading-relaxed">
              {lang === 'ur' ? descUr : descEn}
            </p>
          </div>

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
              className={`w-full px-4 py-4 rounded-xl border-2 outline-none text-center text-3xl font-bold tracking-[0.5em] transition-all ${
                error 
                  ? 'border-red-500 bg-red-50 animate-shake' 
                  : 'border-sky-100 focus:border-gold bg-sky-50 focus:bg-white shadow-inner'
              }`}
              placeholder="••••"
              autoFocus
            />
          </div>
          
          {error && (
            <p className="text-red-500 text-xs text-center font-bold uppercase tracking-widest animate-bounce">
              {t.invalidPin}
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button 
              type="submit"
              disabled={!pinInput}
              className="flex-1 bg-gold hover:bg-gold-light disabled:opacity-30 text-black font-bold py-3.5 rounded-xl transition-all urdu-text text-base shadow-lg shadow-gold/20 flex items-center justify-center gap-2"
            >
              <KeyRound size={18} />
              <span>{lang === 'ur' ? 'تصدیق کریں' : 'Verify'}</span>
            </button>
            <button 
              type="button"
              onClick={() => {
                setPinInput('');
                setError(false);
                onClose();
              }}
              className="flex-1 bg-zinc-100 text-zinc-700 font-bold py-3.5 rounded-xl hover:bg-zinc-200 transition-all urdu-text text-base"
            >
              {lang === 'ur' ? 'کینسل' : 'Cancel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
