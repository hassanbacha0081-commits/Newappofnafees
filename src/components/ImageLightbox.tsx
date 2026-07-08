import React from 'react';
import { X, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { motion } from 'motion/react';

interface ImageLightboxProps {
  src: string;
  onClose: () => void;
  title?: string;
}

export default function ImageLightbox({ src, onClose, title }: ImageLightboxProps) {
  const [scale, setScale] = React.useState(1);
  const [rotation, setRotation] = React.useState(0);

  // Close on Escape key press
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/95 p-4 backdrop-blur-md animate-in fade-in duration-200">
      {/* Header */}
      <div className="absolute top-0 inset-x-0 bg-black/60 backdrop-blur-md p-4 flex justify-between items-center text-white z-10">
        <span className="font-bold text-sm tracking-wide font-sans">{title || 'Image Viewer | تصویر'}</span>
        <div className="flex items-center gap-4">
          <button 
            type="button"
            onClick={() => setScale(s => Math.min(s + 0.25, 3.5))}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-300 hover:text-white"
            title="Zoom In"
          >
            <ZoomIn size={20} />
          </button>
          <button 
            type="button"
            onClick={() => setScale(s => Math.max(s - 0.25, 0.4))}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-300 hover:text-white"
            title="Zoom Out"
          >
            <ZoomOut size={20} />
          </button>
          <button 
            type="button"
            onClick={() => setRotation(r => (r + 90) % 360)}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-300 hover:text-white"
            title="Rotate"
          >
            <RotateCw size={20} />
          </button>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 bg-white/10 rounded-full transition-colors text-red-400 hover:text-red-300"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>
      </div>

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

      {/* Semi-transparent Backdrop click triggers close */}
      <div 
        className="absolute inset-0 -z-10 cursor-zoom-out" 
        onClick={onClose}
      />
    </div>
  );
}
