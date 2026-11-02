/**
 * generateRentalPDF — Generates professional downloadable rental invoices / agreements
 * Supports both English ('en') and Tamil ('ta') with complete native Unicode typography.
 * Filename format: Kanchi-Ambal-Rental-[RentalNo]-[EN|TA].pdf
 */
import jsPDF from 'jspdf';
import type { RentalDocument } from '../types/rental';
import { siteConfig, getBusinessName } from '../config/site';
import logoImg from '../assets/LOGO.png';

function loadImage(src: string): Promise<HTMLImageElement | null> {
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
    setTimeout(() => resolve(null), 2000);
  });
}

function formatDate(isoDate?: string, isTa = false): string {
  if (!isoDate) return '—';
  try {
    const d = new Date(isoDate.includes('T') ? isoDate : isoDate + 'T00:00:00');
    return d.toLocaleDateString(isTa ? 'ta-IN' : 'en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return isoDate;
  }
}

function formatInr(amount: number): string {
  return `₹ ${(amount || 0).toLocaleString('en-IN')}`;
}

export async function generateRentalPDF(
  doc: RentalDocument,
  language: 'en' | 'ta' = 'en',
  onProgress?: (percent: number, status: string) => void
): Promise<void> {
  onProgress?.(10, 'Preparing rental document layout…');

  const isTa = language === 'ta';
  const logo = await loadImage(logoImg);

  // Canvas A4 dimensions at 2x resolution (1240 x 1754 px)
  const PAGE_WIDTH = 1240;
  const PAGE_HEIGHT = 1754;

  // Dynamic continuous page calculation for compact, waste-free layout
  const rowH = 42;
  const maxTableY = 1640;
  const summaryH = 280;

  const p1StartY = 48 + 135 + 148 + 36; // 367
  const p1CapWithSummary = Math.min(18, Math.floor((maxTableY - summaryH - p1StartY) / rowH));
  const p1CapWithoutSummary = Math.min(24, Math.floor((maxTableY - p1StartY) / rowH));

  const pNextStartY = 48 + 135 + 10 + 36; // 229
  const pNextCapWithSummary = Math.min(24, Math.floor((maxTableY - summaryH - pNextStartY) / rowH));
  const pNextCapWithoutSummary = Math.min(30, Math.floor((maxTableY - pNextStartY) / rowH));

  const pages: (typeof doc.items)[] = [];
  if (doc.items.length === 0) {
    pages.push([]);
  } else if (doc.items.length <= p1CapWithSummary) {
    pages.push(doc.items);
  } else {
    let remaining = [...doc.items];
    let pIdx = 0;
    while (remaining.length > 0) {
      const isFirst = pIdx === 0;
      const capWithSummary = isFirst ? p1CapWithSummary : pNextCapWithSummary;
      const capWithoutSummary = isFirst ? p1CapWithoutSummary : pNextCapWithoutSummary;

      if (remaining.length <= capWithSummary) {
        pages.push(remaining);
        break;
      }

      let take = capWithoutSummary;
      const leftOver = remaining.length - take;
      if (leftOver > 0 && leftOver < 3 && take > 5) {
        take = take - (3 - leftOver);
      }
      pages.push(remaining.slice(0, take));
      remaining = remaining.slice(take);
      pIdx++;
    }
  }

  const totalPages = pages.length;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const canvas = document.createElement('canvas');
  canvas.width = PAGE_WIDTH;
  canvas.height = PAGE_HEIGHT;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }

  // Multilingual Strings
  const L = {
    title: isTa ? 'பாத்திரங்கள் மற்றும் உபகரணங்கள் வாடகை ரசீது' : 'RENTAL ITEMS INVOICE & AGREEMENT',
    subtitle: isTa
      ? 'விசேஷங்களுக்கான பாத்திரங்கள் & உபகரணங்கள் வாடகை சேவை'
      : 'Function Catering & Cooking Equipment Rental Services',
    docNo: isTa ? 'வாடகை எண்:' : 'Rental No:',
    docDate: isTa ? 'ரசீது தேதி:' : 'Date:',
    funcDate: isTa ? 'விசேஷ தேதி:' : 'Function Date:',
    issueDate: isTa ? 'வழங்கிய தேதி:' : 'Issue Date:',
    expReturn: isTa ? 'திருப்பித் தரும் தேதி:' : 'Expected Return:',
    actReturn: isTa ? 'பெறப்பட்ட தேதி:' : 'Actual Return:',
    status: isTa ? 'வாடகை நிலை:' : 'Status:',
    custDetails: isTa ? 'வாடிக்கையாளர் விவரங்கள் (Customer Details)' : 'CUSTOMER DETAILS',
    custName: isTa ? 'வாடிக்கையாளர் பெயர்:' : 'Customer Name:',
    mobile: isTa ? 'கைப்பேசி எண்:' : 'Mobile Number:',
    address: isTa ? 'முகவரி / மண்டபம்:' : 'Event Address:',
    funcName: isTa ? 'நிகழ்ச்சி பெயர்:' : 'Function / Event:',
    delivery: isTa ? 'டெலிவரி குறிப்பு:' : 'Delivery Details:',
    tblSno: isTa ? 'வ.எண்' : 'S.No.',
    tblItem: isTa ? 'பொருள் பெயர் (Item Name & Code)' : 'Item Name & Code',
    tblQty: isTa ? 'அளவு' : 'Quantity',
    tblPrice: isTa ? 'விலை / அலகு' : 'Price / Unit',
    tblUnit: isTa ? 'கால அளவு' : 'Unit / Period',
    tblTotal: isTa ? 'மொத்தம் (₹)' : 'Total (₹)',
    tblNotes: isTa ? 'குறிப்புகள்' : 'Item Notes',
    summaryTitle: isTa ? 'கட்டண விவரங்கள் & முன்பணம்' : 'PAYMENT & DEPOSIT SUMMARY',
    totalItems: isTa ? 'மொத்த வாடகை பொருட்கள்:' : 'Total Items Rented:',
    subtotal: isTa ? 'வாடகைத் தொகை (Subtotal):' : 'Rental Subtotal:',
    additional: isTa ? 'கூடுதல் கட்டணம் / வண்டி:' : 'Additional Charges:',
    discount: isTa ? 'தள்ளுபடி (Discount):' : 'Special Discount:',
    deposit: isTa ? 'பாதுகாப்பு வைப்புத்தொகை (Deposit):' : 'Security Deposit:',
    grandTotal: isTa ? 'மொத்தத் தொகை (Grand Total):' : 'Grand Total:',
    advance: isTa ? 'செலுத்தப்பட்ட முன்பணம் (Advance):' : 'Advance Paid:',
    balance: isTa ? 'மீதமுள்ள தொகை (Balance Due):' : 'Balance Due:',
    termsTitle: isTa ? 'வாடகை நிபந்தனைகள் (Terms & Conditions):' : 'RENTAL TERMS & CONDITIONS:',
    terms: isTa
      ? [
          '1. அனைத்து வாடகை பாத்திரங்களும் காஞ்சி அம்பாள் கேட்டரிங் நிறுவனத்திற்கு உரியவை. சுத்தமாகவும் சேதமின்றியும் ஒப்படைக்க வேண்டும்.',
          '2. பொருட்கள் அனைத்தும் சரியான முறையில் திரும்ப ஒப்படைக்கப்பட்டதும் பாதுகாப்பு வைப்புத்தொகை முழுமையாகத் திருப்பித் தரப்படும்.',
          '3. ஏதேனும் சேதம் அல்லது இழப்பு ஏற்பட்டால் அதற்கான தொகை வைப்புத்தொகையிலிருந்து கழிக்கப்படும் அல்லது தனியாக வசூலிக்கப்படும்.',
          '4. கூடுதல் நாளுக்கான வாடகையைத் தவிர்க்க குறிப்பிட்ட தேதிக்குள் பொருட்களைத் திரும்ப ஒப்படைக்கவும்.',
        ]
      : [
          `1. All rented items remain the property of ${getBusinessName(language)} and must be returned clean, dry, and undamaged.`,
          '2. Refundable security deposit will be settled promptly upon safe inspection and verification of all returned inventory.',
          '3. Any breakage, dent, or missing items will be deducted from the security deposit or charged at replacement cost.',
          '4. Please adhere to the agreed return schedule to avoid additional daily rental charges.',
        ],
    custSign: isTa ? 'வாடிக்கையாளர் கையொப்பம்' : 'Customer Signature',
    repSign: isTa ? 'காஞ்சி அம்பாள் கேட்டரிங் சார்பாக' : `For ${getBusinessName(language)}`,
    pageOf: isTa ? 'பக்கம்' : 'Page',
    of: isTa ? '/' : 'of',
  };

  const totalQuantityRented = doc.items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
  let runningItemOffset = 0;

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    onProgress?.(
      20 + Math.round(((pageIdx + 1) / totalPages) * 70),
      `Rendering page ${pageIdx + 1} of ${totalPages}…`
    );

    const pageItems = pages[pageIdx];
    const startIdx = runningItemOffset;
    runningItemOffset += pageItems.length;

    // Clear background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);

    // Decorative Borders
    ctx.strokeStyle = '#FFF7ED';
    ctx.lineWidth = 14;
    ctx.strokeRect(20, 20, PAGE_WIDTH - 40, PAGE_HEIGHT - 40);

    ctx.strokeStyle = '#EA580C';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(32, 32, PAGE_WIDTH - 64, PAGE_HEIGHT - 64);

    let y = 48;

    // ─── TOP HEADER BAND ──────────────────────────────────────
    ctx.fillStyle = '#EA580C';
    ctx.fillRect(45, y, PAGE_WIDTH - 90, 115);

    // Accent line
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(45, y + 111, PAGE_WIDTH - 90, 4);

    // Logo
    if (logo) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(110, y + 58, 42, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.clip();
      ctx.drawImage(logo, 68, y + 16, 84, 84);
      ctx.restore();
    }

    // Business Name & Title
    const bizName = getBusinessName(language);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 30px "Noto Sans Tamil", "Inter", sans-serif';
    ctx.fillText(bizName, 175, y + 44);

    ctx.font = 'bold 16px "Noto Sans Tamil", "Inter", sans-serif';
    ctx.fillStyle = '#FEF3C7';
    ctx.fillText(L.title, 175, y + 74);

    ctx.font = '13px "Inter", "Segoe UI", sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(
      `Ph: +91 ${siteConfig.whatsappNumber}  •  Kanchipuram, Tamil Nadu  •  ${L.subtitle}`,
      175,
      y + 98
    );

    // Right Header Box (Rental Doc Badge)
    const badgeW = 240;
    const badgeX = PAGE_WIDTH - 45 - badgeW;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(badgeX, y + 18, badgeW, 78);
    ctx.strokeStyle = '#FDBA74';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(badgeX, y + 18, badgeW, 78);

    ctx.fillStyle = '#9A3412';
    ctx.font = 'bold 12px "Inter", sans-serif';
    ctx.fillText('RENTAL DOCUMENT', badgeX + 16, y + 40);

    ctx.fillStyle = '#EA580C';
    ctx.font = 'bold 22px "Inter", sans-serif';
    ctx.fillText(doc.rentalNumber, badgeX + 16, y + 68);

    ctx.fillStyle = '#475569';
    ctx.font = 'bold 11px "Inter", sans-serif';
    ctx.fillText(`STATUS: ${doc.status.toUpperCase()}`, badgeX + 16, y + 86);

    y += 135;

    // ─── CUSTOMER & DATES SECTION (Page 1 only) ───────────────
    if (pageIdx === 0) {
      const colW = (PAGE_WIDTH - 110) / 2;

      // Box 1: Customer Details
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(45, y, colW, 130);
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.strokeRect(45, y, colW, 130);

      // Box 1 Header
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(45, y, colW, 28);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 13px "Noto Sans Tamil", "Inter", sans-serif';
      ctx.fillText(L.custDetails, 58, y + 19);

      let cy = y + 48;
      ctx.fillStyle = '#1E293B';
      ctx.font = 'bold 12px "Noto Sans Tamil", "Inter", sans-serif';
      ctx.fillText(L.custName, 58, cy);
      ctx.font = 'bold 13px "Inter", sans-serif';
      ctx.fillStyle = '#0F172A';
      ctx.fillText(doc.customerName || '—', 190, cy);

      cy += 24;
      ctx.font = 'bold 12px "Noto Sans Tamil", "Inter", sans-serif';
      ctx.fillStyle = '#1E293B';
      ctx.fillText(L.mobile, 58, cy);
      ctx.font = '13px "Inter", sans-serif';
      ctx.fillText(doc.mobile || '—', 190, cy);

      if (doc.functionName) {
        cy += 24;
        ctx.font = 'bold 12px "Noto Sans Tamil", "Inter", sans-serif';
        ctx.fillText(L.funcName, 58, cy);
        ctx.font = '12px "Noto Sans Tamil", "Inter", sans-serif';
        ctx.fillText(doc.functionName, 190, cy);
      }

      if (doc.address) {
        cy += 24;
        ctx.font = 'bold 12px "Noto Sans Tamil", "Inter", sans-serif';
        ctx.fillText(L.address, 58, cy);
        ctx.font = '12px "Noto Sans Tamil", "Inter", sans-serif';
        const addrShort = doc.address.length > 40 ? doc.address.substring(0, 38) + '…' : doc.address;
        ctx.fillText(addrShort, 190, cy);
      }

      // Box 2: Rental Dates & Logistics
      const rightX = 45 + colW + 20;
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(rightX, y, colW, 130);
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.strokeRect(rightX, y, colW, 130);

      // Box 2 Header
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(rightX, y, colW, 28);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 13px "Noto Sans Tamil", "Inter", sans-serif';
      ctx.fillText(isTa ? 'தேதி & விநியோக விவரங்கள்' : 'RENTAL SCHEDULE & DATES', rightX + 14, y + 19);

      let dy = y + 48;
      ctx.fillStyle = '#1E293B';
      ctx.font = 'bold 12px "Noto Sans Tamil", "Inter", sans-serif';
      ctx.fillText(L.docDate, rightX + 14, dy);
      ctx.font = '12px "Inter", sans-serif';
      ctx.fillText(formatDate(doc.documentDate, isTa), rightX + 160, dy);

      dy += 24;
      ctx.font = 'bold 12px "Noto Sans Tamil", "Inter", sans-serif';
      ctx.fillText(L.funcDate, rightX + 14, dy);
      ctx.font = '12px "Inter", sans-serif';
      ctx.fillText(formatDate(doc.functionDate, isTa), rightX + 160, dy);

      dy += 24;
      ctx.font = 'bold 12px "Noto Sans Tamil", "Inter", sans-serif';
      ctx.fillText(L.issueDate, rightX + 14, dy);
      ctx.font = '12px "Inter", sans-serif';
      ctx.fillText(formatDate(doc.rentalStartDate || doc.documentDate, isTa), rightX + 160, dy);

      dy += 24;
      ctx.font = 'bold 12px "Noto Sans Tamil", "Inter", sans-serif';
      ctx.fillStyle = '#B45309';
      ctx.fillText(L.expReturn, rightX + 14, dy);
      ctx.font = 'bold 12px "Inter", sans-serif';
      ctx.fillText(formatDate(doc.expectedReturnDate, isTa), rightX + 160, dy);

      y += 148;
    } else {
      y += 10;
    }

    // ─── RENTAL ITEMS TABLE ───────────────────────────────────
    const tableW = PAGE_WIDTH - 90;
    const colWidths = [60, 420, 110, 140, 150, 140, 130];
    const colX = [
      45,
      45 + colWidths[0],
      45 + colWidths[0] + colWidths[1],
      45 + colWidths[0] + colWidths[1] + colWidths[2],
      45 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3],
      45 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4],
      45 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5],
    ];

    // Table Header
    ctx.fillStyle = '#EA580C';
    ctx.fillRect(45, y, tableW, 36);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px "Noto Sans Tamil", "Inter", sans-serif';
    ctx.fillText(L.tblSno, colX[0] + 12, y + 23);
    ctx.fillText(L.tblItem, colX[1] + 12, y + 23);
    ctx.fillText(L.tblQty, colX[2] + 12, y + 23);
    ctx.fillText(L.tblPrice, colX[3] + 12, y + 23);
    ctx.fillText(L.tblUnit, colX[4] + 12, y + 23);
    ctx.fillText(L.tblTotal, colX[5] + 12, y + 23);
    ctx.fillText(L.tblNotes, colX[6] + 12, y + 23);

    y += 36;

    // Table Rows
    for (let r = 0; r < pageItems.length; r++) {
      const itm = pageItems[r];
      const isAlt = r % 2 === 1;

      ctx.fillStyle = isAlt ? '#F8FAFC' : '#FFFFFF';
      ctx.fillRect(45, y, tableW, rowH);
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.strokeRect(45, y, tableW, rowH);

      // S.No
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 12px "Inter", sans-serif';
      ctx.fillText(String(startIdx + r + 1), colX[0] + 18, y + 28);

      // Item Name
      const primaryName = isTa ? (itm.nameTa || itm.nameEn) : (itm.nameEn || itm.nameTa);
      const secondaryName = isTa ? itm.nameEn : itm.nameTa;

      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 13px "Noto Sans Tamil", "Inter", sans-serif';
      ctx.fillText(primaryName, colX[1] + 12, y + 20);

      if (secondaryName && secondaryName !== primaryName) {
        ctx.fillStyle = '#64748B';
        ctx.font = '11px "Noto Sans Tamil", "Inter", sans-serif';
        ctx.fillText(`(${secondaryName}) • Code: ${itm.itemCode}`, colX[1] + 12, y + 36);
      } else {
        ctx.fillStyle = '#64748B';
        ctx.font = '11px "Inter", sans-serif';
        ctx.fillText(`Code: ${itm.itemCode}`, colX[1] + 12, y + 36);
      }

      // Quantity
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 14px "Inter", sans-serif';
      ctx.fillText(String(itm.quantity), colX[2] + 24, y + 28);

      // Price / Unit
      ctx.font = '12px "Inter", sans-serif';
      ctx.fillStyle = '#334155';
      ctx.fillText(formatInr(itm.pricePerUnit), colX[3] + 12, y + 28);

      // Unit / Period
      ctx.font = '11px "Noto Sans Tamil", "Inter", sans-serif';
      ctx.fillText(itm.pricingUnit || 'Per Day', colX[4] + 12, y + 28);

      // Line Total
      ctx.fillStyle = '#EA580C';
      ctx.font = 'bold 13px "Inter", sans-serif';
      ctx.fillText(formatInr(itm.lineTotal), colX[5] + 12, y + 28);

      // Notes
      ctx.fillStyle = '#64748B';
      ctx.font = '11px "Noto Sans Tamil", "Inter", sans-serif';
      const itemNote = itm.notes || '—';
      ctx.fillText(itemNote.length > 15 ? itemNote.substring(0, 14) + '…' : itemNote, colX[6] + 12, y + 28);

      y += rowH;
    }

    // ─── SUMMARY & FINANCIALS (Last page only) ────────────────
    if (pageIdx === totalPages - 1) {
      y += 18;

      const summaryW = 460;
      const summaryX = PAGE_WIDTH - 45 - summaryW;
      const summaryH = 220;

      // Summary Container
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(summaryX, y, summaryW, summaryH);
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(summaryX, y, summaryW, summaryH);

      // Summary Header Stripe
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(summaryX, y, summaryW, 30);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px "Noto Sans Tamil", "Inter", sans-serif';
      ctx.fillText(L.summaryTitle, summaryX + 16, y + 20);

      let sy = y + 54;
      const sRow = (label: string, val: string, isBold = false, isOrange = false, isGreen = false) => {
        ctx.fillStyle = '#334155';
        ctx.font = isBold ? 'bold 12px "Noto Sans Tamil", "Inter", sans-serif' : '12px "Noto Sans Tamil", "Inter", sans-serif';
        ctx.fillText(label, summaryX + 18, sy);

        if (isOrange) ctx.fillStyle = '#EA580C';
        else if (isGreen) ctx.fillStyle = '#16A34A';
        else ctx.fillStyle = '#0F172A';

        ctx.font = isBold ? 'bold 13px "Inter", sans-serif' : '12px "Inter", sans-serif';
        ctx.fillText(val, summaryX + summaryW - 120, sy);
        sy += 22;
      };

      sRow(L.totalItems, `${totalQuantityRented} units`, false);
      sRow(L.subtotal, formatInr(doc.subtotal), false);

      if (doc.additionalCharges > 0) {
        sRow(L.additional, formatInr(doc.additionalCharges), false);
      }
      if (doc.discount > 0) {
        sRow(L.discount, `- ${formatInr(doc.discount)}`, false, false, true);
      }
      if (doc.securityDeposit > 0) {
        sRow(L.deposit, formatInr(doc.securityDeposit), false);
      }

      // Grand Total Line
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1;
      ctx.strokeRect(summaryX + 12, sy - 14, summaryW - 24, 28);
      ctx.fillStyle = '#FFF7ED';
      ctx.fillRect(summaryX + 12, sy - 14, summaryW - 24, 28);

      sRow(L.grandTotal, formatInr(doc.grandTotal), true, true);
      sy += 6;

      sRow(L.advance, formatInr(doc.advancePaid), true, false, true);
      sRow(L.balance, formatInr(doc.balanceDue), true, true);

      // Left Box: Terms & Conditions
      const termsW = PAGE_WIDTH - 90 - summaryW - 24;
      ctx.fillStyle = '#FAFAFA';
      ctx.fillRect(45, y, termsW, summaryH);
      ctx.strokeStyle = '#FED7AA';
      ctx.lineWidth = 1;
      ctx.strokeRect(45, y, termsW, summaryH);

      ctx.fillStyle = '#EA580C';
      ctx.font = 'bold 12px "Noto Sans Tamil", "Inter", sans-serif';
      ctx.fillText(L.termsTitle, 58, y + 26);

      let ty = y + 50;
      ctx.fillStyle = '#475569';
      ctx.font = '11px "Noto Sans Tamil", "Inter", sans-serif';
      for (const term of L.terms) {
        const words = term.split(' ');
        let line = '';
        for (let n = 0; n < words.length; n++) {
          const testLine = line + words[n] + ' ';
          const metrics = ctx.measureText(testLine);
          if (metrics.width > termsW - 30 && n > 0) {
            ctx.fillText(line, 58, ty);
            line = words[n] + ' ';
            ty += 16;
          } else {
            line = testLine;
          }
        }
        ctx.fillText(line, 58, ty);
        ty += 20;
      }

      y += summaryH + 30;

      // ─── SIGNATURE BLOCKS ──────────────────────────────────
      const signW = 320;
      // Customer Sign
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 1;
      ctx.strokeRect(70, y + 40, signW, 1);
      ctx.fillStyle = '#334155';
      ctx.font = 'bold 12px "Noto Sans Tamil", "Inter", sans-serif';
      ctx.fillText(L.custSign, 70, y + 58);

      // Rep Sign
      const repX = PAGE_WIDTH - 70 - signW;
      ctx.strokeRect(repX, y + 40, signW, 1);
      ctx.fillText(L.repSign, repX, y + 58);
      ctx.font = '11px "Noto Sans Tamil", "Inter", sans-serif';
      ctx.fillStyle = '#64748B';
      ctx.fillText(bizName, repX, y + 74);
    }

    // ─── FOOTER ───────────────────────────────────────────────
    const footerY = PAGE_HEIGHT - 65;
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(45, footerY, PAGE_WIDTH - 90, 1.5);

    ctx.fillStyle = '#64748B';
    ctx.font = '12px "Noto Sans Tamil", "Inter", sans-serif';
    ctx.fillText(
      `${bizName}  •  Ph: +91 ${siteConfig.whatsappNumber}  •  ${doc.rentalNumber}  •  ${isTa ? 'அனைத்து உரிமைகளும் பாதுகாக்கப்பட்டவை' : 'All rights reserved'}`,
      45,
      footerY + 22
    );

    ctx.font = 'bold 12px "Inter", sans-serif';
    ctx.fillStyle = '#EA580C';
    ctx.fillText(
      `${L.pageOf} ${pageIdx + 1} ${L.of} ${totalPages}`,
      PAGE_WIDTH - 130,
      footerY + 22
    );

    // Convert Canvas to Image & Add to jsPDF
    const pageDataUrl = canvas.toDataURL('image/jpeg', 0.95);
    if (pageIdx > 0) {
      pdf.addPage();
    }
    pdf.addImage(pageDataUrl, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
  }

  onProgress?.(98, 'Finalizing PDF download…');

  // Exact required naming: Kanchi-Ambal-Rental-[RentalNo]-[EN|TA].pdf
  const filename = `Kanchi-Ambal-Rental-${doc.rentalNumber}-${language.toUpperCase()}.pdf`;
  pdf.save(filename);

  onProgress?.(100, 'Complete!');
}
