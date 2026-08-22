import React, { useState } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, Download, MessageCircle, Check, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { shareImageToWhatsApp } from '../lib/utils';

interface ImageLightboxProps {
  src: string;
  onClose: () => void;
  title?: string;
  phone?: string;
  caption?: string;
}

export default function ImageLightbox({ src, onClose, title, phone, caption }: ImageLightboxProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [customPhone, setCustomPhone] = useState(phone || '');
  const [showPhonePrompt, setShowPhonePrompt] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Close on Escape key press
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleWhatsAppShare = async (targetPhone?: string) => {
    setIsSharing(true);
    const res = await shareImageToWhatsApp({
      imageSrc: src,
      phone: targetPhone !== undefined ? targetPhone : customPhone,
      caption: caption || `نفیس جیولرز - ${title || 'زیورات ڈیزائن تصویر'}`,
      title: title || 'Jewellery Photo | تصویر'
    });
    setIsSharing(false);
    setShowPhonePrompt(false);
    if (res.message) {
      setFeedback(res.message);
      setTimeout(() => setFeedback(null), 4500);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/95 p-4 backdrop-blur-md animate-in fade-in duration-200">
      {/* Header */}
      <div className="absolute top-0 inset-x-0 bg-black/70 backdrop-blur-md p-4 flex flex-wrap justify-between items-center text-white z-10 gap-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm tracking-wide font-sans">{title || 'Image Viewer | تصویر'}</span>
          {phone && (
            <span className="text-xs bg-white/10 px-2 py-0.5 rounded text-gray-300 font-mono" dir="ltr">
              {phone}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* WhatsApp Direct Share Button */}
          <button 
            type="button"
            onClick={() => {
              if (phone) {
                handleWhatsAppShare(phone);
              } else {
                setShowPhonePrompt(prev => !prev);
              }
            }}
            disabled={isSharing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold text-xs shadow-lg transition-all active:scale-95 disabled:opacity-50"
            title="Share via WhatsApp"
          >
            <MessageCircle size={16} />
            <span>{isSharing ? 'بھیج رہے ہیں...' : 'واٹس ایپ کریں'}</span>
          </button>

          <button 
            type="button"
            onClick={() => setScale(s => Math.min(s + 0.25, 3.5))}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-300 hover:text-white"
            title="Zoom In"
          >
            <ZoomIn size={18} />
          </button>
          <button 
            type="button"
            onClick={() => setScale(s => Math.max(s - 0.25, 0.4))}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-300 hover:text-white"
            title="Zoom Out"
          >
            <ZoomOut size={18} />
          </button>
          <button 
            type="button"
            onClick={() => setRotation(r => (r + 90) % 360)}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-300 hover:text-white"
            title="Rotate"
          >
            <RotateCw size={18} />
          </button>
          <button 
            type="button"
            onClick={async () => {
              try {
                let downloadUrl = src;
                let isBlobUrl = false;
                
                if (src.startsWith('data:')) {
                  const res = await fetch(src);
                  const blob = await res.blob();
                  downloadUrl = URL.createObjectURL(blob);
                  isBlobUrl = true;
                }
                
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = downloadUrl;
                a.download = `jewellery-image-${Date.now()}.jpg`;
                document.body.appendChild(a);
                a.click();
                
                setTimeout(() => {
                  document.body.removeChild(a);
                  if (isBlobUrl) {
                    URL.revokeObjectURL(downloadUrl);
                  }
                }, 200);
              } catch (err) {
                console.error('Download failed', err);
                alert('Failed to download image.');
              }
            }}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-300 hover:text-white"
            title="Download"
          >
            <Download size={18} />
          </button>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 bg-white/10 rounded-full transition-colors text-red-400 hover:text-red-300"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Optional Phone input prompt if no phone was pre-associated */}
      <AnimatePresence>
        {showPhonePrompt && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-16 right-4 sm:right-16 z-20 bg-zinc-900 border border-green-500/50 p-4 rounded-xl shadow-2xl w-80 text-white"
          >
            <p className="text-xs text-zinc-300 font-bold mb-2 urdu-text">
              کسٹمر کا واٹس ایپ نمبر درج کریں یا براہ راست چیٹ پر بھیجیں:
            </p>
            <div className="flex gap-2">
              <input 
                type="tel"
                placeholder="03XXXXXXXXX"
                value={customPhone}
                onChange={(e) => setCustomPhone(e.target.value)}
                className="flex-1 bg-black/60 border border-zinc-700 px-3 py-1.5 rounded-lg text-sm text-white focus:outline-none focus:border-green-500 font-mono"
                dir="ltr"
                autoFocus
              />
              <button 
                onClick={() => handleWhatsAppShare(customPhone)}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-bold flex items-center gap-1"
              >
                <Send size={14} />
                <span>بھیجیں</span>
              </button>
            </div>
            <button 
              onClick={() => handleWhatsAppShare('')}
              className="mt-2 w-full text-center text-[11px] text-zinc-400 hover:text-white py-1 underline"
            >
              عام واٹس ایپ شیئر (نمبر کے بغیر)
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating feedback toast */}
      <AnimatePresence>
        {feedback && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-6 z-30 px-5 py-3 bg-zinc-900/95 border border-green-500 text-white rounded-xl shadow-2xl text-xs font-bold flex items-center gap-2 max-w-md text-center urdu-text"
          >
            <Check size={16} className="text-green-400 flex-shrink-0" />
            <span>{feedback}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Container */}
      <div className="w-full h-full flex items-center justify-center overflow-auto py-16 px-4">
        <motion.img 
          src={src} 
          alt="View Large" 
          animate={{ scale, rotate: rotation }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl origin-center cursor-move"
          referrerPolicy="no-referrer"
        />
      </div>

      {/* Bottom quick bar */}
      <div className="absolute bottom-3 inset-x-0 flex justify-center items-center gap-3 z-10 pointer-events-none">
        <button
          onClick={() => {
            if (phone) {
              handleWhatsAppShare(phone);
            } else {
              setShowPhonePrompt(prev => !prev);
            }
          }}
          className="pointer-events-auto flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-full font-bold text-sm shadow-xl active:scale-95 transition-all border border-green-400/40 urdu-text"
        >
          <MessageCircle size={18} />
          <span>واٹس ایپ پر تصویر بھیجیں</span>
        </button>
      </div>

      {/* Semi-transparent Backdrop click triggers close */}
      <div 
        className="absolute inset-0 -z-10 cursor-zoom-out" 
        onClick={onClose}
      />
    </div>
  );
}

