/**
 * documentHeaderFooter.ts — Shared Document Header, Footer, and Typography System
 * for Kanchi Ambal Catering PDF Generation & Print Layouts.
 *
 * Ensures:
 * - Completely partitioned, non-overlapping header layout (Left: Branding, Right: Badge).
 * - Full Tamil Unicode and English typography with native ligature shaping.
 * - Dynamic text fitting and wrapping to eliminate clipping and overlap.
 * - Professional computer-generated document notice on every page.
 * - Unified brand theme: Orange (#EA580C), Gold (#F59E0B), Navy (#1E293B), White (#FFFFFF).
 */

import { siteConfig, getBusinessName } from '../config/site';

export const COMPUTER_GENERATED_NOTICE = {
  en: 'This is a computer-generated document from Kanchi Ambal Catering. No handwritten signature is required.',
  ta: 'இது காஞ்சி அம்பாள் கேட்டரிங் இணையதளம் மூலம் கணினியில் உருவாக்கப்பட்ட ஆவணமாகும். கையொப்பம் தேவையில்லை.',
} as const;

export function getComputerGeneratedNotice(lang: 'en' | 'ta' | string = 'en'): string {
  return lang === 'ta' ? COMPUTER_GENERATED_NOTICE.ta : COMPUTER_GENERATED_NOTICE.en;
}

export const BRAND_COLORS = {
  primary: '#EA580C',        // Primary Orange
  primaryDark: '#C2410C',    // Deep Orange
  primaryLight: '#FFF7ED',   // Light Warm Orange Tint
  accentGold: '#F59E0B',     // Warm Amber Gold
  accentLightGold: '#FEF3C7',// Pale Gold Accent
  darkNavy: '#1E293B',       // Slate 800 Dark Navy
  textDark: '#0F172A',       // Slate 900
  textBody: '#334155',       // Slate 700
  textMuted: '#64748B',      // Slate 500
  textSubtle: '#94A3B8',     // Slate 400
  border: '#E2E8F0',         // Slate 200
  borderWarm: '#FED7AA',     // Orange 200
  cardBg: '#F8FAFC',         // Slate 50
  white: '#FFFFFF',
} as const;

export const PAGE_GEOMETRY = {
  PAGE_WIDTH: 1240,
  PAGE_HEIGHT: 1754,
  MARGIN_X: 45,
  CONTENT_WIDTH: 1150, // 1240 - 90
  HEADER_Y: 48,
  HEADER_HEIGHT: 140,
  BADGE_WIDTH: 270,
  BADGE_HEIGHT: 108,
} as const;

/**
 * Ensures web fonts (Noto Sans Tamil, Inter) are loaded before canvas drawing.
 */
export async function ensureFontsReady(): Promise<void> {
  if (typeof document !== 'undefined' && document.fonts && typeof document.fonts.ready === 'object') {
    try {
      await document.fonts.ready;
    } catch {
      // Continue gracefully if font API is unavailable
    }
  }
}

/**
 * Loads an image asset with timeout and cross-origin handling.
 */
export function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
    setTimeout(() => resolve(null), 2500);
  });
}

/**
 * Splits text into wrapped lines that strictly do not exceed maxWidth.
 * Handles both space-separated words and continuous complex strings.
 */
export function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  if (!text) return [];
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = ctx.measureText(testLine).width;

    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      // If single word is wider than maxWidth, break character by character
      if (ctx.measureText(word).width > maxWidth) {
        let chunk = '';
        for (const char of word) {
          if (ctx.measureText(chunk + char).width <= maxWidth) {
            chunk += char;
          } else {
            if (chunk) lines.push(chunk);
            chunk = char;
          }
        }
        currentLine = chunk;
      } else {
        currentLine = word;
      }
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Measures text width and dynamically scales font size down until it fits within maxWidth.
 */
export function drawFittedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  targetFontSize: number,
  minFontSize = 11,
  fontFamily = '"Noto Sans Tamil", "Inter", sans-serif',
  fontWeight = 'bold',
  color: string = BRAND_COLORS.textDark,
  align: CanvasTextAlign = 'left'
): void {
  let size = targetFontSize;
  ctx.save();
  ctx.textAlign = align;
  ctx.fillStyle = color;

  while (size > minFontSize) {
    ctx.font = `${fontWeight} ${size}px ${fontFamily}`;
    if (ctx.measureText(text).width <= maxWidth) {
      break;
    }
    size -= 1;
  }

  ctx.font = `${fontWeight} ${size}px ${fontFamily}`;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/**
 * Draws rounded rectangle on canvas.
 */
export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Renders signature double page border frame (Warm Ivory + Vibrant Orange).
 */
export function renderDecorativePageFrame(
  ctx: CanvasRenderingContext2D,
  width = PAGE_GEOMETRY.PAGE_WIDTH,
  height = PAGE_GEOMETRY.PAGE_HEIGHT
): void {
  ctx.save();
  // Outer Ivory Frame
  ctx.strokeStyle = BRAND_COLORS.primaryLight;
  ctx.lineWidth = 14;
  ctx.strokeRect(20, 20, width - 40, height - 40);

  // Inner Brand Orange Border
  ctx.strokeStyle = BRAND_COLORS.primary;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(32, 32, width - 64, height - 64);
  ctx.restore();
}

export interface DocumentHeaderOptions {
  ctx: CanvasRenderingContext2D;
  pageWidth?: number;
  y?: number;
  headerHeight?: number;
  language: 'en' | 'ta' | string;
  logo: HTMLImageElement | null;
  bizName?: string;
  title: string;
  subtitle?: string;
  badgeType: string;
  docNumber: string;
  statusOrDateLabel?: string;
  contactText?: string;
}

/**
 * Renders the standardized, non-overlapping document header on Page 1.
 * Divides layout into strictly isolated Left (Branding) and Right (Badge) zones.
 * Returns the recommended Y coordinate for the next document section.
 */
export function renderDocumentHeader(options: DocumentHeaderOptions): number {
  const {
    ctx,
    pageWidth = PAGE_GEOMETRY.PAGE_WIDTH,
    y = PAGE_GEOMETRY.HEADER_Y,
    headerHeight = PAGE_GEOMETRY.HEADER_HEIGHT,
    language,
    logo,
    title,
    subtitle,
    badgeType,
    docNumber,
    statusOrDateLabel,
    contactText,
  } = options;

  const isTa = language === 'ta';
  const bizName = options.bizName || getBusinessName(isTa ? 'ta' : 'en');
  const leftX = PAGE_GEOMETRY.MARGIN_X;
  const contentWidth = pageWidth - leftX * 2;

  ctx.save();

  // 1. Header Background & Accent Stripe
  ctx.fillStyle = BRAND_COLORS.primary;
  ctx.fillRect(leftX, y, contentWidth, headerHeight);

  ctx.fillStyle = BRAND_COLORS.accentGold;
  ctx.fillRect(leftX, y + headerHeight - 4, contentWidth, 4);

  // 2. Right-Side Badge Box (Dedicated, non-overlapping column)
  const badgeW = PAGE_GEOMETRY.BADGE_WIDTH;
  const badgeH = PAGE_GEOMETRY.BADGE_HEIGHT;
  const badgeX = pageWidth - leftX - badgeW - 14;
  const badgeY = y + 16;

  // Badge Container
  ctx.fillStyle = BRAND_COLORS.white;
  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 10);
  ctx.fill();

  ctx.strokeStyle = '#FDBA74';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Badge Header Pill
  const pillW = badgeW - 28;
  const pillX = badgeX + 14;
  const pillY = badgeY + 10;
  ctx.fillStyle = BRAND_COLORS.primaryLight;
  roundRect(ctx, pillX, pillY, pillW, 22, 5);
  ctx.fill();
  ctx.strokeStyle = BRAND_COLORS.borderWarm;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = BRAND_COLORS.primaryDark;
  ctx.font = 'bold 11px "Inter", "Noto Sans Tamil", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(badgeType.toUpperCase(), badgeX + badgeW / 2, pillY + 15);

  // Badge Document Number (Auto-scales so it never overflows card width)
  drawFittedText(
    ctx,
    docNumber,
    badgeX + badgeW / 2,
    badgeY + 62,
    badgeW - 24,
    21,
    13,
    '"Inter", "Noto Sans Tamil", sans-serif',
    'bold',
    BRAND_COLORS.primary,
    'center'
  );

  // Badge Status / Date Line
  if (statusOrDateLabel) {
    ctx.fillStyle = BRAND_COLORS.textBody;
    ctx.font = 'bold 11px "Inter", "Noto Sans Tamil", sans-serif';
    ctx.textAlign = 'center';
    const statusText = statusOrDateLabel.length > 28
      ? statusOrDateLabel.substring(0, 26) + '…'
      : statusOrDateLabel;
    ctx.fillText(statusText, badgeX + badgeW / 2, badgeY + 92);
  }

  // 3. Left-Side Branding Section (Strictly bounded to textMaxW)
  const logoRadius = 45;
  const logoCenterX = leftX + 22 + logoRadius;
  const logoCenterY = y + 20 + logoRadius;
  const logoSize = 82;

  // Logo Circle with Ivory Clip
  if (logo) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(logoCenterX, logoCenterY, logoRadius, 0, Math.PI * 2);
    ctx.fillStyle = BRAND_COLORS.white;
    ctx.fill();
    ctx.clip();
    ctx.drawImage(
      logo,
      logoCenterX - logoSize / 2,
      logoCenterY - logoSize / 2,
      logoSize,
      logoSize
    );
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(logoCenterX, logoCenterY, logoRadius, 0, Math.PI * 2);
    ctx.strokeStyle = BRAND_COLORS.borderWarm;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  // Text Area Bounds (guaranteed no overlap with badge)
  const textX = leftX + (logo ? 130 : 20);
  const textMaxW = badgeX - textX - 25; // ~730px safe drawable width

  ctx.textAlign = 'left';

  // Line 1: Business Name
  drawFittedText(
    ctx,
    bizName,
    textX,
    y + 40,
    textMaxW,
    28,
    18,
    '"Noto Sans Tamil", "Inter", sans-serif',
    'bold',
    BRAND_COLORS.white,
    'left'
  );

  // Line 2: Document Title
  drawFittedText(
    ctx,
    title,
    textX,
    y + 68,
    textMaxW,
    16,
    12,
    '"Noto Sans Tamil", "Inter", sans-serif',
    'bold',
    BRAND_COLORS.accentLightGold,
    'left'
  );

  // Line 3: Subtitle / Tagline (Wrapped safely if long)
  const defaultSub = isTa
    ? 'சுபகாரியங்களுக்கான பாரம்பரிய சுத்த சைவ கேட்டரிங் சர்வீஸ்'
    : 'Traditional Pure Vegetarian Feast & Catering Services';
  const subText = subtitle || defaultSub;

  ctx.font = '12.5px "Noto Sans Tamil", "Inter", sans-serif';
  ctx.fillStyle = BRAND_COLORS.white;
  const subLines = wrapCanvasText(ctx, subText, textMaxW);
  if (subLines.length > 0) {
    ctx.fillText(subLines[0], textX, y + 92);
  }

  // Line 4: Contact & Location Line
  const defaultContact = `Ph: +91 ${siteConfig.whatsappNumber}  •  Kanchipuram, Tamil Nadu`;
  const contactStr = contactText || defaultContact;
  drawFittedText(
    ctx,
    contactStr,
    textX,
    y + 116,
    textMaxW,
    12,
    10,
    '"Inter", "Noto Sans Tamil", sans-serif',
    'normal',
    '#FFEDD5',
    'left'
  );

  ctx.restore();

  // Return next section's starting Y coordinate
  return y + headerHeight + 16;
}

export interface CompactHeaderOptions {
  ctx: CanvasRenderingContext2D;
  pageWidth?: number;
  y?: number;
  language: 'en' | 'ta' | string;
  logo: HTMLImageElement | null;
  bizName?: string;
  title: string;
  docNumber: string;
}

/**
 * Renders a compact, space-efficient header on subsequent pages (Page 2+).
 */
export function renderCompactDocumentHeader(options: CompactHeaderOptions): number {
  const {
    ctx,
    pageWidth = PAGE_GEOMETRY.PAGE_WIDTH,
    y = PAGE_GEOMETRY.HEADER_Y,
    language,
    logo,
    title,
    docNumber,
  } = options;

  const isTa = language === 'ta';
  const bizName = options.bizName || getBusinessName(isTa ? 'ta' : 'en');
  const leftX = PAGE_GEOMETRY.MARGIN_X;
  const contentWidth = pageWidth - leftX * 2;
  const headerHeight = 64;

  ctx.save();

  // Background
  ctx.fillStyle = BRAND_COLORS.primary;
  ctx.fillRect(leftX, y, contentWidth, headerHeight);

  ctx.fillStyle = BRAND_COLORS.accentGold;
  ctx.fillRect(leftX, y + headerHeight - 3, contentWidth, 3);

  // Logo Icon
  if (logo) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(leftX + 26, y + 32, 20, 0, Math.PI * 2);
    ctx.fillStyle = BRAND_COLORS.white;
    ctx.fill();
    ctx.clip();
    ctx.drawImage(logo, leftX + 8, y + 14, 36, 36);
    ctx.restore();
  }

  // Left Title
  const textX = leftX + (logo ? 58 : 16);
  const badgeW = 270;
  const badgeX = pageWidth - leftX - badgeW - 14;
  const maxTitleW = badgeX - textX - 20;

  drawFittedText(
    ctx,
    `${bizName}  •  ${title}`,
    textX,
    y + 38,
    maxTitleW,
    16,
    12,
    '"Noto Sans Tamil", "Inter", sans-serif',
    'bold',
    BRAND_COLORS.white,
    'left'
  );

  // Right Badge
  ctx.fillStyle = BRAND_COLORS.white;
  roundRect(ctx, badgeX, y + 10, badgeW, 44, 6);
  ctx.fill();
  ctx.strokeStyle = '#FDBA74';
  ctx.lineWidth = 1;
  ctx.stroke();

  drawFittedText(
    ctx,
    docNumber,
    badgeX + badgeW / 2,
    y + 30,
    badgeW - 20,
    15,
    11,
    '"Inter", "Noto Sans Tamil", sans-serif',
    'bold',
    BRAND_COLORS.primary,
    'center'
  );

  ctx.fillStyle = BRAND_COLORS.textMuted;
  ctx.font = '10px "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`Ph: +91 ${siteConfig.whatsappNumber}`, badgeX + badgeW / 2, y + 46);

  ctx.restore();

  return y + headerHeight + 14;
}

export interface DocumentFooterOptions {
  ctx: CanvasRenderingContext2D;
  pageWidth?: number;
  pageHeight?: number;
  language: 'en' | 'ta' | string;
  currentPage: number;
  totalPages: number;
  docNumber?: string;
  bizName?: string;
}

/**
 * Renders standard document footer on every page:
 * - Line 1: Clear Computer-Generated Document Notice.
 * - Line 2: Business copyright/contact details + Page X of Y.
 */
export function renderDocumentFooter(options: DocumentFooterOptions): void {
  const {
    ctx,
    pageWidth = PAGE_GEOMETRY.PAGE_WIDTH,
    pageHeight = PAGE_GEOMETRY.PAGE_HEIGHT,
    language,
    currentPage,
    totalPages,
    docNumber,
  } = options;

  const isTa = language === 'ta';
  const bizName = options.bizName || getBusinessName(isTa ? 'ta' : 'en');
  const leftX = PAGE_GEOMETRY.MARGIN_X;
  const contentWidth = pageWidth - leftX * 2;
  const footerY = pageHeight - 68;

  ctx.save();

  // Top Hairline Divider
  ctx.strokeStyle = BRAND_COLORS.border;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(leftX, footerY);
  ctx.lineTo(leftX + contentWidth, footerY);
  ctx.stroke();

  // Row 1: Official Computer-Generated Document Notice
  const notice = getComputerGeneratedNotice(isTa ? 'ta' : 'en');
  ctx.font = 'italic 11px "Noto Sans Tamil", "Inter", sans-serif';
  ctx.fillStyle = BRAND_COLORS.textBody;
  ctx.textAlign = 'center';
  ctx.fillText(notice, pageWidth / 2, footerY + 18);

  // Row 2: Metadata (Left) & Page Counter (Right)
  ctx.font = '11.5px "Noto Sans Tamil", "Inter", sans-serif';
  ctx.fillStyle = BRAND_COLORS.textMuted;
  ctx.textAlign = 'left';
  const metaStr = `${bizName}  •  Ph: +91 ${siteConfig.whatsappNumber}  •  Kanchipuram, Tamil Nadu${
    docNumber ? `  •  ${docNumber}` : ''
  }`;
  ctx.fillText(metaStr, leftX, footerY + 40);

  // Page Counter
  const pageLabel = isTa ? 'பக்கம்' : 'Page';
  const ofLabel = isTa ? '/' : 'of';
  ctx.font = 'bold 12px "Inter", "Noto Sans Tamil", sans-serif';
  ctx.fillStyle = BRAND_COLORS.primary;
  ctx.textAlign = 'right';
  ctx.fillText(`${pageLabel} ${currentPage} ${ofLabel} ${totalPages}`, pageWidth - leftX, footerY + 40);

  ctx.restore();
}
