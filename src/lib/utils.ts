import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: Date | string, locale: string = 'en-GB') {
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat(locale).format(d);
  } catch (e) {
    return String(date);
  }
}

export async function compressImage(base64Str: string, maxWidth = 800, maxHeight = 800, quality = 0.7): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      console.error('Image compression failed');
      resolve(base64Str); // Fallback to original
    };
  });
}

export function formatWhatsAppUrl(phone: string, message: string) {
  if (!phone) return '';
  
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  if (!cleaned) return '';
  
  // Handle common Pakistan number formats
  if (cleaned.startsWith('0092')) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.startsWith('0')) {
    cleaned = '92' + cleaned.substring(1);
  } else if (cleaned.length === 10 && (cleaned.startsWith('3'))) {
    // Likely a 10-digit number without country code (e.g. 315...)
    cleaned = '92' + cleaned;
  } else if (!cleaned.startsWith('92') && cleaned.length < 12 && cleaned.length > 0) {
    // Fallback: prepend 92 if not present and length is short
    cleaned = '92' + cleaned;
  }

  return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
}

export async function shareImageToWhatsApp({
  imageSrc,
  phone = '',
  caption = '',
  title = 'تصویر (Jewellery Photo)'
}: {
  imageSrc: string;
  phone?: string;
  caption?: string;
  title?: string;
}): Promise<{ success: boolean; message?: string }> {
  if (!imageSrc) return { success: false, message: 'کوئی تصویر موجود نہیں ہے' };

  try {
    // 1. Process base64 or URL into a Blob
    let blob: Blob;
    if (imageSrc.startsWith('data:')) {
      const parts = imageSrc.split(',');
      const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      blob = new Blob([u8arr], { type: mime });
    } else {
      const res = await fetch(imageSrc);
      blob = await res.blob();
    }

    const file = new File([blob], `nafees-jewellery-${Date.now()}.${blob.type.includes('png') ? 'png' : 'jpg'}`, {
      type: blob.type || 'image/jpeg',
    });

    // 2. Native Capacitor App Sharing (Android/iOS)
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform()) {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const { Share } = await import('@capacitor/share');

      let base64Data = imageSrc;
      if (!imageSrc.startsWith('data:')) {
        base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }

      const fileName = `nafees-photo-${Date.now()}.jpg`;
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: base64Data.split(',')[1],
        directory: Directory.Cache
      });

      await Share.share({
        title: title,
        text: caption,
        url: savedFile.uri,
        dialogTitle: 'WhatsApp پر شیئر کریں (Share to WhatsApp)'
      });
      return { success: true };
    }

    // 3. Web Share API with File (Mobile Chrome, Safari, etc.)
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: title,
        text: caption || 'نفیس جیولرز (Nafees Jewellers)'
      });
      return { success: true };
    }

    // 4. Desktop / Web Fallback:
    // Copy image directly to Clipboard so user can Paste (Ctrl+V) into WhatsApp Web / Desktop
    let copied = false;
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        // Convert to PNG blob for clipboard API standard
        let pngBlob = blob;
        if (blob.type !== 'image/png') {
          const img = new Image();
          img.src = imageSrc;
          await new Promise((resolve) => (img.onload = resolve));
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0);
          pngBlob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b || blob), 'image/png'));
        }
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': pngBlob })
        ]);
        copied = true;
      }
    } catch (e) {
      console.warn('Clipboard image write failed:', e);
    }

    // Also download the image file
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `nafees-jewellery-${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    }, 500);

    // Open WhatsApp Chat
    const waUrl = phone
      ? formatWhatsAppUrl(phone, caption || 'نفیس جیولرز تصویر')
      : `https://wa.me/?text=${encodeURIComponent(caption || 'نفیس جیولرز تصویر')}`;

    window.open(waUrl, '_blank');

    return {
      success: true,
      message: copied
        ? 'تصویر کاپی اور ڈاؤن لوڈ ہوگئی ہے! واٹس ایپ چیٹ میں Paste (Ctrl+V) کریں۔'
        : 'تصویر ڈاؤن لوڈ ہو گئی ہے! واٹس ایپ چیٹ میں اٹیچ کریں۔'
    };
  } catch (err: any) {
    const isCancel = err?.name === 'AbortError' || err?.message?.toLowerCase().includes('cancel') || err?.message?.toLowerCase().includes('abort');
    if (!isCancel) {
      console.error('Failed to share image to WhatsApp:', err);
    }
    return { success: false, message: isCancel ? '' : (err?.message || 'تصویر شیئر نہیں ہو سکی') };
  }
}

