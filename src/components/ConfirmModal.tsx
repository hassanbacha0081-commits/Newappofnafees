import React from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { translations, type Language } from '../translations';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  lang: Language;
}

export function ConfirmModal({ isOpen, onClose, onConfirm, title, message, lang }: ConfirmModalProps) {
  if (!isOpen) return null;

  const t = translations[lang];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black-60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-4 border-b flex justify-between items-center bg-red-50">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle size={24} />
            <h3 className="text-xl font-bold urdu-text">{title}</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-red-100 rounded-full transition-colors text-red-600"
          >
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6">
          <p className="text-zinc-600 text-lg urdu-text text-center leading-relaxed">
            {message}
          </p>
        </div>
        
        <div className="p-4 bg-zinc-50 flex gap-3">
          <button 
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 transition-all urdu-text text-lg shadow-lg shadow-red-200"
          >
            {lang === 'ur' ? 'ہاں، ڈیلیٹ کریں' : 'Yes, Delete'}
          </button>
          <button 
            onClick={onClose}
            className="flex-1 bg-zinc-200 text-zinc-700 font-bold py-3 rounded-xl hover:bg-zinc-300 transition-all urdu-text text-lg"
          >
            {lang === 'ur' ? 'کینسل' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}
