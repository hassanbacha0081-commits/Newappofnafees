import html2canvas, { Options } from 'html2canvas';

/**
 * Converts OKLCH color space values to sRGB.
 * Formula source: https://bottosson.github.io/posts/oklab/
 */
function oklchToRgb(l: number, c: number, h: number, alpha: number = 1): string {
  // Hue to radians
  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.2914855480 * b;

  const lCube = l_ * l_ * l_;
  const mCube = m_ * m_ * m_;
  const sCube = s_ * s_ * s_;

  const r = 4.0767416621 * lCube - 3.3077115913 * mCube + 0.2309699292 * sCube;
  const g = -1.2684380046 * lCube + 2.6097574011 * mCube - 0.3413193965 * sCube;
  const b_ = -0.0041960863 * lCube - 0.7034186147 * mCube + 1.7076147010 * sCube;

  const gamma = (val: number) => {
    if (val > 0.0031308) {
      return 1.055 * Math.pow(val, 1 / 2.4) - 0.055;
    }
    return 12.92 * val;
  };

  const R = Math.max(0, Math.min(255, Math.round(gamma(r) * 255)));
  const G = Math.max(0, Math.min(255, Math.round(gamma(g) * 255)));
  const B = Math.max(0, Math.min(255, Math.round(gamma(b_) * 255)));

  if (alpha < 1) {
    return `rgba(${R}, ${G}, ${B}, ${alpha})`;
  }
  return `rgb(${R}, ${G}, ${B})`;
}

/**
 * Searches and replaces all oklch() color functions in a CSS text with standard rgb() equivalents.
 */
export function convertOklchInText(text: string): string {
  // Regex to match oklch(L C H) or oklch(L C H / A)
  const oklchRegex = /oklch\(\s*([0-9.]+%?)\s+([0-9.]+%?)\s+([0-9.]+(?:deg|rad|grad|turn)?)\s*(?:\/\s*([0-9.]+%?))?\s*\)/gi;
  // Regex to match comma-separated oklch(L, C, H) or oklch(L, C, H, A)
  const oklchCommaRegex = /oklch\(\s*([0-9.]+%?)\s*,\s*([0-9.]+%?)\s*,\s*([0-9.]+(?:deg|rad|grad|turn)?)\s*(?:,\s*([0-9.]+%?))?\s*\)/gi;

  const parser = (match: string, lStr: string, cStr: string, hStr: string, aStr?: string) => {
    try {
      let l = parseFloat(lStr);
      if (lStr.includes('%')) l = l / 100;
      
      let c = parseFloat(cStr);
      if (cStr.includes('%')) c = c / 100;
      
      let h = parseFloat(hStr);
      if (hStr.includes('rad')) {
        h = parseFloat(hStr) * (180 / Math.PI);
      } else if (hStr.includes('turn')) {
        h = parseFloat(hStr) * 360;
      } else if (hStr.includes('grad')) {
        h = parseFloat(hStr) * 0.9;
      }
      
      let alpha = 1;
      if (aStr) {
        if (aStr.includes('%')) {
          alpha = parseFloat(aStr) / 100;
        } else {
          alpha = parseFloat(aStr);
        }
      }
      
      return oklchToRgb(l, c, h, alpha);
    } catch (e) {
      console.error("Failed to parse oklch color:", match, e);
      return 'rgb(120, 120, 120)'; // safe neutral fallback
    }
  };

  let result = text.replace(oklchRegex, parser);
  result = result.replace(oklchCommaRegex, parser);
  return result;
}

/**
 * Prepares the DOM stylesheets for rendering with html2canvas by replacing all unsupported oklch color values.
 * Returns a cleanup callback function to restore original stylesheets.
 */
export async function prepareStylesForHtml2Canvas(): Promise<() => void> {
  const tempStyles: HTMLStyleElement[] = [];
  const disabledLinks: HTMLLinkElement[] = [];

  // 1. Process all inline <style> tags
  const styleTags = Array.from(document.querySelectorAll('style'));
  for (const style of styleTags) {
    if (style.innerHTML.includes('oklch') && !style.hasAttribute('data-temp-html2canvas')) {
      const originalHtml = style.innerHTML;
      const convertedHtml = convertOklchInText(originalHtml);
      
      const tempStyle = document.createElement('style');
      tempStyle.innerHTML = convertedHtml;
      tempStyle.setAttribute('data-temp-html2canvas', 'true');
      document.head.appendChild(tempStyle);
      
      style.disabled = true; // disable original stylesheet safely
      tempStyles.push(tempStyle);
    }
  }

  // 2. Process all <link rel="stylesheet"> tags (same-origin files)
  const linkTags = Array.from(document.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[];
  for (const link of linkTags) {
    try {
      const response = await fetch(link.href);
      if (response.ok) {
        const cssText = await response.text();
        if (cssText.includes('oklch')) {
          const convertedCss = convertOklchInText(cssText);
          
          const tempStyle = document.createElement('style');
          tempStyle.innerHTML = convertedCss;
          tempStyle.setAttribute('data-temp-html2canvas', 'true');
          document.head.appendChild(tempStyle);
          
          link.disabled = true; // disable original stylesheet safely
          disabledLinks.push(link);
          tempStyles.push(tempStyle);
        }
      }
    } catch (e) {
      console.warn("Could not load external stylesheet for conversion:", link.href, e);
    }
  }

  // Return the cleanup function to revert stylesheet states
  return () => {
    // Enable original style tags
    const styleTagsToRestore = Array.from(document.querySelectorAll('style'));
    for (const style of styleTagsToRestore) {
      if (!style.hasAttribute('data-temp-html2canvas')) {
        style.disabled = false;
      }
    }
    
    // Enable original link tags
    for (const link of disabledLinks) {
      link.disabled = false;
    }
    
    // Remove temporary style tags
    for (const temp of tempStyles) {
      temp.remove();
    }
  };
}

/**
 * Drop-in replacement for html2canvas that automatically intercepts, 
 * translates and restores CSS stylesheet rules with oklch colors before rendering.
 */
export async function html2canvasWithOklch(element: HTMLElement, options?: Partial<Options>): Promise<HTMLCanvasElement> {
  const cleanup = await prepareStylesForHtml2Canvas();
  try {
    const canvas = await html2canvas(element, options);
    return canvas;
  } finally {
    cleanup();
  }
}
