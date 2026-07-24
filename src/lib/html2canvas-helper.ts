import html2canvas, { Options } from 'html2canvas';

/**
 * Converts OKLAB color space values to sRGB.
 * Formula source: https://bottosson.github.io/posts/oklab/
 */
function oklabToRgb(l: number, a: number, b: number, alpha: number = 1): string {
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
 * Converts OKLCH color space values to sRGB.
 */
function oklchToRgb(l: number, c: number, h: number, alpha: number = 1): string {
  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);
  return oklabToRgb(l, a, b, alpha);
}

// Global offscreen canvas context for resolving modern CSS colors natively in browser
let tempCtx: CanvasRenderingContext2D | null = null;
if (typeof document !== 'undefined') {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    tempCtx = canvas.getContext('2d');
  } catch (e) {
    tempCtx = null;
  }
}

/**
 * Converts any single color expression (oklab, oklch, color-mix, color, etc.) to rgb()/rgba().
 */
export function colorToRgb(colorStr: string): string {
  if (!colorStr) return colorStr;
  const trimmed = colorStr.trim();

  // 1. Try browser canvas 2D context conversion first (native browser color engine)
  if (tempCtx) {
    try {
      tempCtx.fillStyle = 'rgba(0, 0, 0, 0)';
      tempCtx.fillStyle = trimmed;
      const resolved = tempCtx.fillStyle;
      if (resolved && resolved !== 'rgba(0, 0, 0, 0)' && resolved !== '#00000000') {
        if (resolved.startsWith('#')) {
          const hex = resolved.slice(1);
          if (hex.length === 6) {
            const r = parseInt(hex.slice(0, 2), 16);
            const g = parseInt(hex.slice(2, 4), 16);
            const b = parseInt(hex.slice(4, 6), 16);
            return `rgb(${r}, ${g}, ${b})`;
          } else if (hex.length === 8) {
            const r = parseInt(hex.slice(0, 2), 16);
            const g = parseInt(hex.slice(2, 4), 16);
            const b = parseInt(hex.slice(4, 6), 16);
            const a = parseFloat((parseInt(hex.slice(6, 8), 16) / 255).toFixed(3));
            return `rgba(${r}, ${g}, ${b}, ${a})`;
          }
        }
        return resolved;
      }
    } catch (e) {
      // Fallback to math parser
    }
  }

  // 2. Math parser fallback if canvas conversion is unavailable or failed
  return mathColorFallback(trimmed);
}

function mathColorFallback(colorStr: string): string {
  // oklab(L a b / A) or oklab(L, a, b, A)
  const oklabMatch = colorStr.match(/oklab\(\s*([-+]?[0-9.]+%?)\s*[,/ ]\s*([-+]?[0-9.]+%?)\s*[,/ ]\s*([-+]?[0-9.]+%?)(?:\s*[,/ ]\s*([0-9.]+%?))?\s*\)/i);
  if (oklabMatch) {
    const [, lStr, aStr, bStr, alphaStr] = oklabMatch;
    let l = parseFloat(lStr);
    if (lStr.includes('%')) l = l / 100;

    let a = parseFloat(aStr);
    if (aStr.includes('%')) a = (a / 100) * 0.4;

    let b = parseFloat(bStr);
    if (bStr.includes('%')) b = (b / 100) * 0.4;

    let alpha = 1;
    if (alphaStr) {
      alpha = alphaStr.includes('%') ? parseFloat(alphaStr) / 100 : parseFloat(alphaStr);
    }
    return oklabToRgb(l, a, b, alpha);
  }

  // oklch(L C H / A) or oklch(L, C, H, A)
  const oklchMatch = colorStr.match(/oklch\(\s*([0-9.]+%?)\s*[,/ ]\s*([0-9.]+%?)\s*[,/ ]\s*([0-9.]+(?:deg|rad|grad|turn)?)(?:\s*[,/ ]\s*([0-9.]+%?))?\s*\)/i);
  if (oklchMatch) {
    const [, lStr, cStr, hStr, alphaStr] = oklchMatch;
    let l = parseFloat(lStr);
    if (lStr.includes('%')) l = l / 100;

    let c = parseFloat(cStr);
    if (cStr.includes('%')) c = (c / 100) * 0.4;

    let h = parseFloat(hStr);
    if (hStr.includes('rad')) h = parseFloat(hStr) * (180 / Math.PI);
    else if (hStr.includes('turn')) h = parseFloat(hStr) * 360;
    else if (hStr.includes('grad')) h = parseFloat(hStr) * 0.9;

    let alpha = 1;
    if (alphaStr) {
      alpha = alphaStr.includes('%') ? parseFloat(alphaStr) / 100 : parseFloat(alphaStr);
    }
    return oklchToRgb(l, c, h, alpha);
  }

  return 'rgb(120, 120, 120)';
}

export function needsConversion(str: string): boolean {
  if (!str || typeof str !== 'string') return false;
  return str.includes('oklch') || str.includes('oklab') || str.includes('color-mix') || str.includes('color(');
}

/**
 * Searches and replaces all oklch(), oklab(), color-mix(), color() color functions in a CSS text with standard rgb()/rgba() equivalents.
 */
export function convertOklchInText(text: string): string {
  if (!needsConversion(text)) return text;

  // Matches oklab(...), oklch(...), color-mix(...), color(...) with up to 2 levels of nested parens
  const colorFuncRegex = /(?:oklab|oklch|color-mix|color)\((?:[^()]+|\((?:[^()]+|\([^()]*\))*\))*\)/gi;

  return text.replace(colorFuncRegex, (match) => {
    return colorToRgb(match);
  });
}

/**
 * Prepares the DOM stylesheets for rendering with html2canvas by replacing all unsupported oklch/oklab color values.
 * Returns a cleanup callback function to restore original stylesheets.
 */
export async function prepareStylesForHtml2Canvas(): Promise<() => void> {
  const tempStyles: HTMLStyleElement[] = [];
  const disabledLinks: HTMLLinkElement[] = [];

  // 1. Process all inline <style> tags
  const styleTags = Array.from(document.querySelectorAll('style'));
  for (const style of styleTags) {
    const cssContent = style.innerHTML || (style.sheet ? Array.from(style.sheet.cssRules || []).map(r => r.cssText).join('\n') : '');
    if (needsConversion(cssContent) && !style.hasAttribute('data-temp-html2canvas')) {
      const convertedHtml = convertOklchInText(cssContent);
      
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
        if (needsConversion(cssText)) {
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
 * translates and restores CSS stylesheet rules with oklch/oklab colors before rendering.
 */
export async function html2canvasWithOklch(element: HTMLElement, options?: Partial<Options>): Promise<HTMLCanvasElement> {
  const cleanup = await prepareStylesForHtml2Canvas();

  const userOnClone = options?.onclone;

  const colorProps = [
    'color',
    'backgroundColor',
    'borderTopColor',
    'borderRightColor',
    'borderBottomColor',
    'borderLeftColor',
    'outlineColor',
    'textDecorationColor',
    'fill',
    'stroke',
    'boxShadow',
    'textShadow'
  ];

  const mergedOptions: Partial<Options> = {
    ...options,
    onclone: (clonedDoc: Document, clonedEl: HTMLElement) => {
      try {
        // 1. Convert any style tags inside the cloned document
        const styleTags = Array.from(clonedDoc.querySelectorAll('style'));
        for (const style of styleTags) {
          if (needsConversion(style.innerHTML)) {
            style.innerHTML = convertOklchInText(style.innerHTML);
          }
        }

        // 2. Fix computed colors on all cloned elements
        const win = clonedDoc.defaultView || window;
        const allNodes = Array.from(clonedDoc.querySelectorAll('*')) as HTMLElement[];
        allNodes.push(clonedEl);

        for (const node of allNodes) {
          if (!node.style) continue;
          let computed: CSSStyleDeclaration | null = null;
          try {
            computed = win.getComputedStyle(node);
          } catch (e) {
            continue;
          }
          if (!computed) continue;

          for (const prop of colorProps) {
            const val = computed[prop as any] || node.style[prop as any];
            if (val && typeof val === 'string' && needsConversion(val)) {
              node.style[prop as any] = convertOklchInText(val);
            }
          }
        }
      } catch (err) {
        console.warn("Error during cloned document style cleanup:", err);
      }

      if (userOnClone) {
        userOnClone(clonedDoc, clonedEl);
      }
    }
  };

  try {
    const canvas = await html2canvas(element, mergedOptions);
    return canvas;
  } finally {
    cleanup();
  }
}
