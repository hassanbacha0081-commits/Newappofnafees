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
      tempCtx.globalCompositeOperation = 'copy';
      tempCtx.fillStyle = 'rgba(1, 2, 3, 0.4)'; // sentinel value
      tempCtx.fillStyle = trimmed;

      if (tempCtx.fillStyle !== 'rgba(1, 2, 3, 0.4)' && tempCtx.fillStyle !== '#01020300') {
        const resolved = tempCtx.fillStyle;

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
            const a = Math.round((parseInt(hex.slice(6, 8), 16) / 255) * 100) / 100;
            return `rgba(${r}, ${g}, ${b}, ${a})`;
          }
        } else if (resolved.startsWith('rgb(') || resolved.startsWith('rgba(')) {
          return resolved;
        }

        // Fallback for browsers returning oklch/color() string from fillStyle
        tempCtx.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = tempCtx.getImageData(0, 0, 1, 1).data;
        const alpha = Math.round((a / 255) * 100) / 100;
        if (alpha < 1) {
          return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
        return `rgb(${r}, ${g}, ${b})`;
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
  const oklabMatch = colorStr.match(/oklab\(\s*([^\s,/]+)\s*[,/ ]\s*([^\s,/]+)\s*[,/ ]\s*([^\s,/]+)(?:\s*[,/ ]\s*([^\s,/]+))?\s*\)/i);
  if (oklabMatch) {
    const [, lStr, aStr, bStr, alphaStr] = oklabMatch;
    let l = parseFloat(lStr);
    if (isNaN(l)) l = 0;
    if (lStr.includes('%')) l = l / 100;

    let a = parseFloat(aStr);
    if (isNaN(a)) a = 0;
    if (aStr.includes('%')) a = (a / 100) * 0.4;

    let b = parseFloat(bStr);
    if (isNaN(b)) b = 0;
    if (bStr.includes('%')) b = (b / 100) * 0.4;

    let alpha = 1;
    if (alphaStr) {
      alpha = alphaStr.includes('%') ? parseFloat(alphaStr) / 100 : parseFloat(alphaStr);
      if (isNaN(alpha)) alpha = 1;
    }
    return oklabToRgb(l, a, b, alpha);
  }

  // oklch(L C H / A) or oklch(L, C, H, A)
  const oklchMatch = colorStr.match(/oklch\(\s*([^\s,/]+)\s*[,/ ]\s*([^\s,/]+)\s*[,/ ]\s*([^\s,/]+)(?:\s*[,/ ]\s*([^\s,/]+))?\s*\)/i);
  if (oklchMatch) {
    const [, lStr, cStr, hStr, alphaStr] = oklchMatch;
    let l = parseFloat(lStr);
    if (isNaN(l)) l = 0;
    if (lStr.includes('%')) l = l / 100;

    let c = parseFloat(cStr);
    if (isNaN(c)) c = 0;
    if (cStr.includes('%')) c = (c / 100) * 0.4;

    let h = parseFloat(hStr);
    if (isNaN(h)) h = 0;
    if (hStr.includes('rad')) h = parseFloat(hStr) * (180 / Math.PI);
    else if (hStr.includes('turn')) h = parseFloat(hStr) * 360;
    else if (hStr.includes('grad')) h = parseFloat(hStr) * 0.9;

    let alpha = 1;
    if (alphaStr) {
      alpha = alphaStr.includes('%') ? parseFloat(alphaStr) / 100 : parseFloat(alphaStr);
      if (isNaN(alpha)) alpha = 1;
    }
    return oklchToRgb(l, c, h, alpha);
  }

  return 'rgb(120, 120, 120)';
}

export function needsConversion(str: string): boolean {
  if (!str || typeof str !== 'string') return false;
  return /oklch|oklab|color-mix|color\(|hwb\(|lab\(|lch\(/i.test(str);
}

/**
 * Searches and replaces all oklch(), oklab(), color-mix(), color(), etc. color functions
 * in a CSS text with standard rgb()/rgba() equivalents using balanced parenthesis matching.
 */
export function convertOklchInText(text: string): string {
  if (!needsConversion(text)) return text;

  const funcRegex = /(?:oklch|oklab|color-mix|color|hwb|lab|lch)\s*\(/gi;
  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = funcRegex.exec(text)) !== null) {
    const startIndex = match.index;
    const openParenIndex = startIndex + match[0].length - 1;

    let depth = 1;
    let currentIndex = openParenIndex + 1;
    while (currentIndex < text.length && depth > 0) {
      const char = text[currentIndex];
      if (char === '(') depth++;
      else if (char === ')') depth--;
      currentIndex++;
    }

    if (depth === 0) {
      const fullExpr = text.substring(startIndex, currentIndex);
      const converted = colorToRgb(fullExpr);
      result += text.substring(lastIndex, startIndex) + converted;
      lastIndex = currentIndex;
      funcRegex.lastIndex = currentIndex;
    }
  }

  result += text.substring(lastIndex);
  return result;
}

function getSheetCssText(sheet: CSSStyleSheet | null | undefined): string {
  if (!sheet) return '';
  try {
    const rules = sheet.cssRules || (sheet as any).rules;
    if (!rules) return '';
    const parts: string[] = [];
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      if (rule instanceof CSSImportRule && rule.styleSheet) {
        parts.push(getSheetCssText(rule.styleSheet));
      } else if (rule.cssText) {
        parts.push(rule.cssText);
      }
    }
    return parts.join('\n');
  } catch (e) {
    return '';
  }
}

/**
 * Prepares the DOM stylesheets for rendering with html2canvas by replacing all unsupported oklch/oklab color values in place.
 * Returns a cleanup callback function to restore original stylesheets.
 */
export async function prepareStylesForHtml2Canvas(): Promise<() => void> {
  const restores: Array<() => void> = [];

  const styleNodes = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')) as Array<HTMLStyleElement | HTMLLinkElement>;

  for (const node of styleNodes) {
    let cssText = '';

    // 1. Try CSSOM first (handles @import rules transparently)
    if (node.sheet) {
      cssText = getSheetCssText(node.sheet);
    }

    // 2. Fall back to textContent / innerHTML or fetch
    if (!cssText) {
      if (node.tagName.toLowerCase() === 'style') {
        cssText = node.textContent || node.innerHTML || '';
      } else if (node.tagName.toLowerCase() === 'link') {
        try {
          const href = (node as HTMLLinkElement).href;
          if (href) {
            const res = await fetch(href);
            if (res.ok) cssText = await res.text();
          }
        } catch (e) {}
      }
    }

    if (cssText && needsConversion(cssText)) {
      const converted = convertOklchInText(cssText);

      if (node.tagName.toLowerCase() === 'style') {
        const originalContent = node.textContent;
        node.textContent = converted;
        restores.push(() => {
          node.textContent = originalContent;
        });
      } else if (node.tagName.toLowerCase() === 'link') {
        const tempStyle = document.createElement('style');
        tempStyle.textContent = converted;
        tempStyle.setAttribute('data-temp-html2canvas', 'true');
        if (node.parentNode) {
          node.parentNode.insertBefore(tempStyle, node.nextSibling);
        } else {
          document.head.appendChild(tempStyle);
        }

        const originalDisabled = (node as HTMLLinkElement).disabled;
        (node as HTMLLinkElement).disabled = true;

        restores.push(() => {
          tempStyle.remove();
          (node as HTMLLinkElement).disabled = originalDisabled;
        });
      }
    }
  }

  // Return the cleanup function
  return () => {
    for (const restore of restores) {
      try {
        restore();
      } catch (e) {}
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
    'borderColor',
    'borderTopColor',
    'borderRightColor',
    'borderBottomColor',
    'borderLeftColor',
    'outlineColor',
    'textDecorationColor',
    'fill',
    'stroke',
    'boxShadow',
    'textShadow',
    'backgroundImage',
    'caretColor'
  ];

  const mergedOptions: Partial<Options> = {
    ...options,
    onclone: (clonedDoc: Document, clonedEl: HTMLElement) => {
      try {
        // 1. Convert ALL <style> and <link> tags inside the cloned document
        const clonedStyleNodes = Array.from(clonedDoc.querySelectorAll('style, link[rel="stylesheet"]')) as Array<HTMLStyleElement | HTMLLinkElement>;
        for (const node of clonedStyleNodes) {
          let cssText = '';
          try {
            if (node.sheet) {
              cssText = getSheetCssText(node.sheet);
            }
          } catch (e) {}
          if (!cssText) {
            cssText = node.textContent || node.innerHTML || '';
          }

          if (cssText && needsConversion(cssText)) {
            const converted = convertOklchInText(cssText);
            const newStyle = clonedDoc.createElement('style');
            newStyle.textContent = converted;
            if (node.parentNode) {
              node.parentNode.replaceChild(newStyle, node);
            } else {
              node.textContent = converted;
            }
          }
        }

        // 2. Fix inline style attributes and computed colors on all cloned elements
        const win = clonedDoc.defaultView || window;
        const allNodes = Array.from(clonedDoc.querySelectorAll('*')) as HTMLElement[];
        allNodes.push(clonedEl);

        for (const node of allNodes) {
          if (!node.style) continue;

          // Check style attribute
          const rawStyle = node.getAttribute('style');
          if (rawStyle && needsConversion(rawStyle)) {
            node.setAttribute('style', convertOklchInText(rawStyle));
          }

          if (node.style.cssText && needsConversion(node.style.cssText)) {
            node.style.cssText = convertOklchInText(node.style.cssText);
          }

          let computed: CSSStyleDeclaration | null = null;
          try {
            computed = win.getComputedStyle(node);
          } catch (e) {
            continue;
          }
          if (!computed) continue;

          for (const prop of colorProps) {
            const val = computed[prop as any];
            if (val && typeof val === 'string' && needsConversion(val)) {
              const converted = convertOklchInText(val);
              const cssPropName = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
              node.style.setProperty(cssPropName, converted, 'important');
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
