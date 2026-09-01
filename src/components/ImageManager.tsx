import React, { useRef, useState } from 'react';
import { Camera, ImageIcon, Trash2, RotateCcw, MessageCircle, Eye, Upload, Check, X } from 'lucide-react';
import { compressImage, shareImageToWhatsApp } from '../lib/utils';
import type { Language } from '../translations';

export interface ImageManagerProps {
  image: string | null | undefined;
  onChange: (newImage: string | null) => void;
  lang?: Language;
  label?: string;
  subLabel?: string;
  title?: string;
  phone?: string;
  caption?: string;
  compact?: boolean;
  disabled?: boolean;
  aspectRatio?: 'square' | 'video' | 'portrait' | 'auto';
  idPrefix?: string;
  allowWhatsApp?: boolean;
  onPreviewClick?: (src: string) => void;
  className?: string;
}

export const ImageManager: React.FC<ImageManagerProps> = ({
  image,
  onChange,
  lang = 'ur',
  label,
  subLabel,
  title,
  phone,
  caption,
  compact = false,
  disabled = false,
  aspectRatio = 'auto',
  idPrefix = 'img-mgr',
  allowWhatsApp = true,
  onPreviewClick,
  className = ''
}) => {
  const isUrdu = lang === 'ur';
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  const uniqueId = useRef(`${idPrefix}-${Math.random().toString(36).substring(2, 9)}`).current;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const rawBase64 = event.target?.result as string;
          if (rawBase64) {
            const compressed = await compressImage(rawBase64, 1000, 1000, 0.75);
            onChange(compressed);
          }
        } catch (err) {
          console.error('Failed to compress image:', err);
          if (event.target?.result) {
            onChange(event.target.result as string);
          }
        } finally {
          setIsProcessing(false);
          setShowOptions(false);
          // reset input so same file can be re-selected if needed
          e.target.value = '';
        }
      };
      reader.onerror = () => {
        setIsProcessing(false);
        alert(isUrdu ? 'تصویر لوڈ کرنے میں خرابی ہوئی' : 'Failed to read image');
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setIsProcessing(false);
    }
  };

  const handleWhatsAppShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!image) return;
    const res = await shareImageToWhatsApp({
      imageSrc: image,
      phone: phone || '',
      caption: caption || title || 'تصویر (Jewellery Pic)',
      title: title || 'Jewellery Pic'
    });
    if (res.message) {
      alert(res.message);
    }
  };

  const getHeightClass = () => {
    if (compact) return 'h-28';
    switch (aspectRatio) {
      case 'square': return 'h-52';
      case 'video': return 'h-44';
      case 'portrait': return 'h-64';
      default: return 'h-52';
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Hidden File Inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        disabled={disabled || isProcessing}
        onChange={handleFileChange}
        className="hidden"
        id={`${uniqueId}-camera`}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        disabled={disabled || isProcessing}
        onChange={handleFileChange}
        className="hidden"
        id={`${uniqueId}-gallery`}
      />

      {/* Optional Label */}
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-zinc-600 urdu-text flex items-center gap-1.5">
            <ImageIcon size={14} className="text-sky-600" />
            <span>{label}</span>
          </label>
          {subLabel && <span className="text-[10px] text-zinc-400 font-mono">{subLabel}</span>}
        </div>
      )}

      {/* When Image is Present */}
      {image ? (
        <div className="space-y-2 w-full">
          <div
            onClick={() => onPreviewClick && onPreviewClick(image)}
            className={`relative group rounded-xl overflow-hidden border border-sky-200 bg-zinc-50 flex items-center justify-center ${getHeightClass()} ${
              onPreviewClick ? 'cursor-pointer hover:border-gold transition-all' : ''
            }`}
          >
            <img
              src={image}
              alt={title || 'Preview'}
              className="w-full h-full object-contain group-hover:scale-102 transition-transform duration-300"
            />

            {/* Quick action overlay buttons on image */}
            <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
              {allowWhatsApp && (
                <button
                  type="button"
                  onClick={handleWhatsAppShare}
                  className="p-2 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors shadow-md flex items-center justify-center"
                  title={isUrdu ? 'واٹس ایپ پر بھیجیں' : 'Share to WhatsApp'}
                >
                  <MessageCircle size={15} />
                </button>
              )}
              {onPreviewClick && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPreviewClick(image);
                  }}
                  className="p-2 bg-sky-600 text-white rounded-full hover:bg-sky-700 transition-colors shadow-md flex items-center justify-center"
                  title={isUrdu ? 'بڑی تصویر دیکھیں' : 'View Full Image'}
                >
                  <Eye size={15} />
                </button>
              )}
            </div>

            {isProcessing && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex items-center justify-center z-20">
                <div className="w-6 h-6 border-2 border-sky-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>

          {/* Action Buttons (Change and Delete) */}
          <div className="flex gap-2">
            {/* Change Pic Button with direct options */}
            <div className="flex-1 flex gap-1">
              <button
                type="button"
                disabled={disabled || isProcessing}
                onClick={() => cameraInputRef.current?.click()}
                className="flex-1 py-2.5 px-3 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white rounded-lg transition-colors font-bold text-xs urdu-text flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                title={isUrdu ? 'کیمرہ سے تصویر بدلیں' : 'Change via Camera'}
              >
                <Camera size={15} />
                <span>{isUrdu ? 'کیمرہ سے بدلیں' : 'Change (Cam)'}</span>
              </button>
              <button
                type="button"
                disabled={disabled || isProcessing}
                onClick={() => galleryInputRef.current?.click()}
                className="py-2.5 px-3 bg-sky-100 hover:bg-sky-200 text-sky-800 rounded-lg transition-colors font-bold text-xs urdu-text flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                title={isUrdu ? 'گیلری سے تصویر بدلیں' : 'Change via Gallery'}
              >
                <ImageIcon size={15} />
                <span className="hidden sm:inline">{isUrdu ? 'گیلری' : 'Gallery'}</span>
              </button>
            </div>

            {/* Delete Pic Button */}
            <button
              type="button"
              disabled={disabled || isProcessing}
              onClick={() => onChange(null)}
              className="py-2.5 px-4 bg-red-100 hover:bg-red-200 active:bg-red-300 text-red-600 rounded-lg transition-colors font-bold text-xs urdu-text flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
              title={isUrdu ? 'تصویر حذف کریں' : 'Delete Image'}
            >
              <Trash2 size={15} />
              <span>{isUrdu ? 'حذف کریں' : 'Delete'}</span>
            </button>
          </div>
        </div>
      ) : (
        /* When No Image is Present */
        <div className="space-y-2 w-full">
          <div className="flex gap-2">
            <button
              type="button"
              disabled={disabled || isProcessing}
              onClick={() => cameraInputRef.current?.click()}
              className={`flex-1 p-3 border-2 border-dashed border-sky-200 rounded-xl bg-sky-50/50 hover:bg-sky-100/60 hover:border-sky-400 text-sky-700 transition-all flex items-center justify-center gap-2 cursor-pointer font-bold text-xs urdu-text disabled:opacity-50 ${
                compact ? 'py-2.5' : 'py-3.5'
              }`}
            >
              <Camera size={18} className="text-sky-600" />
              <span>{isUrdu ? 'کیمرہ سے تصویر' : 'Take Photo'}</span>
            </button>

            <button
              type="button"
              disabled={disabled || isProcessing}
              onClick={() => galleryInputRef.current?.click()}
              className={`flex-1 p-3 border-2 border-dashed border-amber-200 rounded-xl bg-amber-50/50 hover:bg-amber-100/60 hover:border-amber-400 text-amber-800 transition-all flex items-center justify-center gap-2 cursor-pointer font-bold text-xs urdu-text disabled:opacity-50 ${
                compact ? 'py-2.5' : 'py-3.5'
              }`}
            >
              <ImageIcon size={18} className="text-amber-600" />
              <span>{isUrdu ? 'گیلری سے منتخب کریں' : 'From Gallery'}</span>
            </button>
          </div>

          {isProcessing && (
            <div className="p-2 bg-sky-50 rounded-lg border border-sky-200 flex items-center justify-center gap-2 text-xs text-sky-700">
              <div className="w-3.5 h-3.5 border-2 border-sky-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="urdu-text font-bold">{isUrdu ? 'تصویر پروسیس ہو رہی ہے...' : 'Processing image...'}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ImageManager;
