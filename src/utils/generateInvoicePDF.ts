/**
 * generateInvoicePDF — Generates high-resolution downloadable Customer Invoice PDF
 * with native Unicode typography (Tamil & English), logo, payment breakdown, and
 * standard computer-generated document notice on every page.
 */
import jsPDF from 'jspdf';
import type { Order, Invoice } from '../types/admin';
import { siteConfig, getBusinessName } from '../config/site';
import logoImg from '../assets/LOGO.png';
import {
  normalizeOrderPayments,
  getOrderTotalPaid,
  getOrderBalanceDue,
  getOrderPaymentStatus,
} from '../services/orderService';
import {
  renderDocumentHeader,
  renderCompactDocumentHeader,
  renderDocumentFooter,
  renderDecorativePageFrame,
  ensureFontsReady,
  loadImage,
  drawFittedText,
  roundRect,
  BRAND_COLORS,
  PAGE_GEOMETRY,
} from './documentHeaderFooter';

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

export async function generateInvoicePDF(
  order: Order,
  invoice: Invoice,
  lang: 'en' | 'ta' = 'en'
): Promise<void> {
  await ensureFontsReady();

  const isTa = lang === 'ta';
  const logo = await loadImage(logoImg);
  const bizName = getBusinessName(isTa ? 'ta' : 'en');

  const PAGE_WIDTH = PAGE_GEOMETRY.PAGE_WIDTH;
  const PAGE_HEIGHT = PAGE_GEOMETRY.PAGE_HEIGHT;

  const payments = normalizeOrderPayments(order);
  const totalPaid = getOrderTotalPaid(order);
  const balanceDue = getOrderBalanceDue(order);
  const paymentStatus = getOrderPaymentStatus(order).toUpperCase();

  // Dynamic layout calculations
  const rowH = 38;
  const maxTableY = 1640;
  const summaryH = 14 + payments.length * 24 + 130;

  const p1StartY = 48 + 140 + 16 + 124 + 18 + 36; // 382
  const p1CapWithSummary = Math.max(8, Math.floor((maxTableY - summaryH - p1StartY) / rowH));
  const p1CapWithoutSummary = Math.max(12, Math.floor((maxTableY - p1StartY) / rowH));

  const pNextStartY = 48 + 64 + 14 + 32 + 10 + 36; // 204
  const pNextCapWithSummary = Math.max(12, Math.floor((maxTableY - summaryH - pNextStartY) / rowH));
  const pNextCapWithoutSummary = Math.max(16, Math.floor((maxTableY - pNextStartY) / rowH));

  // Partition order items into pages dynamically
  const pages: (typeof order.items)[] = [];
  if (order.items.length === 0) {
    pages.push([]);
  } else if (order.items.length <= p1CapWithSummary) {
    pages.push(order.items);
  } else {
    let remaining = [...order.items];
    let pIdx = 0;
    while (remaining.length > 0) {
      const isFirst = pIdx === 0;
      const capWith = isFirst ? p1CapWithSummary : pNextCapWithSummary;
      const capWithout = isFirst ? p1CapWithoutSummary : pNextCapWithoutSummary;

      if (remaining.length <= capWith) {
        pages.push(remaining);
        break;
      }

      let take = capWithout;
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

  // Multilingual strings
  const L = {
    title: isTa ? 'கேட்டரிங் ரசீது (INVOICE)' : 'CATERING INVOICE & BILL',
    subtitle: isTa
      ? 'சுபகாரியங்களுக்கான பாரம்பரிய சுத்த சைவ கேட்டரிங் சர்வீஸ்'
      : 'Traditional Pure Vegetarian Feast & Catering Services',
    badgeType: isTa ? 'வாடிக்கையாளர் ரசீது' : 'CUSTOMER INVOICE',
    billTo: isTa ? 'வாடிக்கையாளர் விவரங்கள்' : 'CUSTOMER & BILLING DETAILS',
    orderInfo: isTa ? 'ஆர்டர் & விசேஷ விவரங்கள்' : 'ORDER & FUNCTION DETAILS',
    custName: isTa ? 'பெயர்:' : 'Customer Name:',
    mobile: isTa ? 'கைப்பேசி:' : 'Mobile Number:',
    address: isTa ? 'முகவரி / மண்டபம்:' : 'Event Address:',
    guests: isTa ? 'நபர்கள் எண்ணிக்கை:' : 'Guests Count:',
    orderNo: isTa ? 'ஆர்டர் எண்:' : 'Order ID:',
    invDate: isTa ? 'ரசீது தேதி:' : 'Invoice Date:',
    eventDate: isTa ? 'விசேஷ தேதி:' : 'Function Date:',
    eventType: isTa ? 'நிகழ்ச்சி வகை:' : 'Event Type:',
    tblSno: isTa ? 'வ.எண்' : 'S.No.',
    tblDish: isTa ? 'உணவு வகை / பதார்த்தம்' : 'Food Item / Dish Name',
    tblCat: isTa ? 'வகை (Category)' : 'Category',
    summaryTitle: isTa ? 'கட்டண விவரங்கள் (PAYMENT SUMMARY)' : 'PAYMENT SUMMARY',
    totalAmt: isTa ? 'மொத்த கட்டணம் (Total Amount):' : 'Total Amount:',
    totalPaid: isTa ? 'செலுத்தப்பட்ட தொகை (Total Paid):' : 'Total Paid:',
    balanceDue: isTa ? 'மீதமுள்ள தொகை (Balance Due):' : 'Balance Due:',
    notesTitle: isTa ? 'குறிப்புகள் (Customer Notes):' : 'Special Instructions / Notes:',
    thankYou: isTa
      ? 'காஞ்சி அம்பாள் கேட்டரிங் சேவையைத் தேர்ந்தெடுத்தமைக்கு நன்றி! சுபநிகழ்ச்சி இனிதே அமைய வாழ்த்துகிறோம்.'
      : 'Thank you for choosing Kanchi Ambal Catering! We wish you a wonderful and joyous celebration.',
  };

  let runningItemOffset = 0;

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const pageItems = pages[pageIdx];
    const startIdx = runningItemOffset;
    runningItemOffset += pageItems.length;

    // Clear background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);

    // Decorative Borders
    renderDecorativePageFrame(ctx, PAGE_WIDTH, PAGE_HEIGHT);

    let y = 48;

    if (pageIdx === 0) {
      // ─── TOP HEADER (Page 1) ────────────────────────────────
      y = renderDocumentHeader({
        ctx,
        pageWidth: PAGE_WIDTH,
        y: 48,
        headerHeight: 140,
        language: lang,
        logo,
        bizName,
        title: L.title,
        subtitle: L.subtitle,
        badgeType: L.badgeType,
        docNumber: invoice.id,
        statusOrDateLabel: `${formatDate(invoice.generatedAt, isTa)} • ${paymentStatus}`,
        contactText: `Ph: +91 ${siteConfig.whatsappNumber}  •  Kanchipuram, Tamil Nadu`,
      });

      // ─── BILL TO & ORDER METADATA (Page 1) ──────────────────
      const colW = (PAGE_WIDTH - 110) / 2;
      const boxH = 124;

      // Box 1: Customer Details
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(45, y, colW, boxH);
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.strokeRect(45, y, colW, boxH);

      ctx.fillStyle = BRAND_COLORS.darkNavy;
      ctx.fillRect(45, y, colW, 26);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12.5px "Noto Sans Tamil", "Inter", sans-serif';
      ctx.fillText(L.billTo, 58, y + 18);

      let cy = y + 46;
      ctx.fillStyle = BRAND_COLORS.textBody;
      ctx.font = 'bold 12px "Noto Sans Tamil", "Inter", sans-serif';
      ctx.fillText(L.custName, 58, cy);
      drawFittedText(ctx, order.customerName, 185, cy, colW - 195, 13, 11, '"Noto Sans Tamil", "Inter", sans-serif', 'bold', BRAND_COLORS.textDark, 'left');

      cy += 24;
      ctx.font = 'bold 12px "Noto Sans Tamil", "Inter", sans-serif';
      ctx.fillStyle = BRAND_COLORS.textBody;
      ctx.fillText(L.mobile, 58, cy);
      ctx.font = '13px "Inter", sans-serif';
      ctx.fillStyle = BRAND_COLORS.textDark;
      ctx.fillText(order.mobile || '—', 185, cy);

      if (order.eventAddress) {
        cy += 24;
        ctx.font = 'bold 12px "Noto Sans Tamil", "Inter", sans-serif';
        ctx.fillStyle = BRAND_COLORS.textBody;
        ctx.fillText(L.address, 58, cy);
        drawFittedText(ctx, order.eventAddress, 185, cy, colW - 195, 12, 10, '"Noto Sans Tamil", "Inter", sans-serif', 'normal', BRAND_COLORS.textDark, 'left');
      }

      if (order.guestCount) {
        cy += 24;
        ctx.font = 'bold 12px "Noto Sans Tamil", "Inter", sans-serif';
        ctx.fillStyle = BRAND_COLORS.textBody;
        ctx.fillText(L.guests, 58, cy);
        ctx.font = '12px "Noto Sans Tamil", "Inter", sans-serif';
        ctx.fillStyle = BRAND_COLORS.textDark;
        ctx.fillText(`${order.guestCount} ${isTa ? 'நபர்கள்' : 'Guests'}`, 185, cy);
      }

      // Box 2: Order & Function Details
      const rightX = 45 + colW + 20;
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(rightX, y, colW, boxH);
      ctx.strokeStyle = '#E2E8F0';
      ctx.strokeRect(rightX, y, colW, boxH);

      ctx.fillStyle = BRAND_COLORS.darkNavy;
      ctx.fillRect(rightX, y, colW, 26);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12.5px "Noto Sans Tamil", "Inter", sans-serif';
      ctx.fillText(L.orderInfo, rightX + 14, y + 18);

      let dy = y + 46;
      ctx.fillStyle = BRAND_COLORS.textBody;
      ctx.font = 'bold 12px "Noto Sans Tamil", "Inter", sans-serif';
      ctx.fillText(L.orderNo, rightX + 14, dy);
      ctx.font = 'bold 13px "Inter", sans-serif';
      ctx.fillStyle = BRAND_COLORS.primary;
      ctx.fillText(order.id, rightX + 160, dy);

      dy += 24;
      ctx.font = 'bold 12px "Noto Sans Tamil", "Inter", sans-serif';
      ctx.fillStyle = BRAND_COLORS.textBody;
      ctx.fillText(L.invDate, rightX + 14, dy);
      ctx.font = '12px "Inter", sans-serif';
      ctx.fillStyle = BRAND_COLORS.textDark;
      ctx.fillText(formatDate(invoice.generatedAt, isTa), rightX + 160, dy);

      dy += 24;
      ctx.font = 'bold 12px "Noto Sans Tamil", "Inter", sans-serif';
      ctx.fillStyle = BRAND_COLORS.textBody;
      ctx.fillText(L.eventDate, rightX + 14, dy);
      ctx.font = '12px "Inter", sans-serif';
      ctx.fillStyle = BRAND_COLORS.textDark;
      ctx.fillText(formatDate(order.orderDate, isTa), rightX + 160, dy);

      if (order.eventType) {
        dy += 24;
        ctx.font = 'bold 12px "Noto Sans Tamil", "Inter", sans-serif';
        ctx.fillStyle = BRAND_COLORS.textBody;
        ctx.fillText(L.eventType, rightX + 14, dy);
        drawFittedText(ctx, order.eventType, rightX + 160, dy, colW - 170, 12, 10, '"Noto Sans Tamil", "Inter", sans-serif', 'normal', BRAND_COLORS.textDark, 'left');
      }

      y += boxH + 18;
    } else {
      // Compact header on subsequent pages
      y = renderCompactDocumentHeader({
        ctx,
        pageWidth: PAGE_WIDTH,
        y: 48,
        language: lang,
        logo,
        bizName,
        title: L.title,
        docNumber: invoice.id,
      });

      // Continuation strip
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(45, y, PAGE_WIDTH - 90, 32);
      ctx.strokeStyle = '#E2E8F0';
      ctx.strokeRect(45, y, PAGE_WIDTH - 90, 32);

      ctx.fillStyle = BRAND_COLORS.textMuted;
      ctx.font = 'bold 12px "Noto Sans Tamil", "Inter", sans-serif';
      ctx.fillText(
        `${bizName} — ${invoice.id} (${isTa ? 'பக்கம்' : 'Page'} ${pageIdx + 1} ${isTa ? '/' : 'of'} ${totalPages})`,
        60,
        y + 21
      );

      y += 42;
    }

    // ─── ITEMS TABLE ──────────────────────────────────────────
    const tableW = PAGE_WIDTH - 90;
    const colWidths = [70, 680, 400];
    const colX = [45, 45 + colWidths[0], 45 + colWidths[0] + colWidths[1]];

    // Table Header
    ctx.fillStyle = BRAND_COLORS.primary;
    ctx.fillRect(45, y, tableW, 36);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px "Noto Sans Tamil", "Inter", sans-serif';
    ctx.fillText(L.tblSno, colX[0] + 16, y + 23);
    ctx.fillText(L.tblDish, colX[1] + 14, y + 23);
    ctx.fillText(L.tblCat, colX[2] + 14, y + 23);

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
      ctx.fillStyle = BRAND_COLORS.textMuted;
      ctx.font = 'bold 12px "Inter", sans-serif';
      ctx.fillText(String(startIdx + r + 1), colX[0] + 20, y + 24);

      // Dish Name (Fitted to width)
      drawFittedText(
        ctx,
        itm.dishName,
        colX[1] + 14,
        y + 24,
        colWidths[1] - 28,
        13,
        10,
        '"Noto Sans Tamil", "Inter", sans-serif',
        'bold',
        BRAND_COLORS.textDark,
        'left'
      );

      // Category Name
      const catFormatted = (itm.categoryId || '')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      drawFittedText(
        ctx,
        catFormatted,
        colX[2] + 14,
        y + 24,
        colWidths[2] - 28,
        12,
        10,
        '"Noto Sans Tamil", "Inter", sans-serif',
        'normal',
        BRAND_COLORS.textBody,
        'left'
      );

      y += rowH;
    }

    // ─── PAYMENT SUMMARY (Final Page Only) ───────────────────
    if (pageIdx === totalPages - 1) {
      y += 18;

      const summaryCardW = 460;
      const summaryCardX = PAGE_WIDTH - 45 - summaryCardW;

      // Left Box: Special Notes & Thank You
      const notesW = summaryCardX - 45 - 20;
      if (order.notes && order.notes.trim()) {
        ctx.fillStyle = '#FFF7ED';
        roundRect(ctx, 45, y, notesW, 90, 8);
        ctx.fill();
        ctx.strokeStyle = BRAND_COLORS.borderWarm;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = BRAND_COLORS.primaryDark;
        ctx.font = 'bold 12px "Noto Sans Tamil", "Inter", sans-serif';
        ctx.fillText(`★ ${L.notesTitle}`, 58, y + 26);

        ctx.fillStyle = BRAND_COLORS.textBody;
        ctx.font = '12px "Noto Sans Tamil", "Inter", sans-serif';
        const notesStr = order.notes.length > 180 ? order.notes.substring(0, 178) + '…' : order.notes;
        ctx.fillText(notesStr, 58, y + 52);
      }

      // Thank You Message
      ctx.fillStyle = BRAND_COLORS.textMuted;
      ctx.font = 'italic 11.5px "Noto Sans Tamil", "Inter", sans-serif';
      ctx.fillText(L.thankYou, 45, y + 120);

      // Right Box: Financials Card
      const payRows: [string, string, boolean][] = [
        [L.totalAmt, formatInr(order.totalAmount), true],
      ];

      payments.forEach((p, idx) => {
        const dStr = p.date ? formatDate(p.date, isTa) : '';
        const payLabel = isTa
          ? `முன்பணம் #${idx + 1} (${p.method}${dStr ? ' · ' + dStr : ''}):`
          : `Payment #${idx + 1} (${p.method}${dStr ? ' · ' + dStr : ''}):`;
        payRows.push([payLabel, formatInr(p.amount), false]);
      });

      payRows.push([L.totalPaid, formatInr(totalPaid), true]);
      payRows.push([L.balanceDue, formatInr(balanceDue), true]);

      const cardH = 34 + payRows.length * 24 + 36;
      ctx.fillStyle = BRAND_COLORS.cardBg;
      roundRect(ctx, summaryCardX, y, summaryCardW, cardH, 8);
      ctx.fill();
      ctx.strokeStyle = BRAND_COLORS.borderWarm;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Card Header
      ctx.fillStyle = BRAND_COLORS.primary;
      roundRect(ctx, summaryCardX, y, summaryCardW, 30, 8);
      ctx.fill();
      ctx.fillRect(summaryCardX, y + 16, summaryCardW, 14);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px "Noto Sans Tamil", "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(L.summaryTitle, summaryCardX + summaryCardW / 2, y + 20);
      ctx.textAlign = 'left';

      let py = y + 54;
      for (const [label, val, isBold] of payRows) {
        ctx.fillStyle = isBold ? BRAND_COLORS.textDark : BRAND_COLORS.textBody;
        ctx.font = isBold ? 'bold 12px "Noto Sans Tamil", "Inter", sans-serif' : '11.5px "Noto Sans Tamil", "Inter", sans-serif';
        ctx.fillText(label, summaryCardX + 18, py);

        ctx.font = isBold ? 'bold 13px "Inter", sans-serif' : '12px "Inter", sans-serif';
        ctx.fillStyle = isBold ? BRAND_COLORS.primary : BRAND_COLORS.textDark;
        ctx.textAlign = 'right';
        ctx.fillText(val, summaryCardX + summaryCardW - 18, py);
        ctx.textAlign = 'left';

        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(summaryCardX + 18, py + 6);
        ctx.lineTo(summaryCardX + summaryCardW - 18, py + 6);
        ctx.stroke();

        py += 24;
      }

      // Status Pill
      const isSettled = balanceDue <= 0 && order.totalAmount > 0;
      const statusBg = isSettled ? '#16A34A' : totalPaid > 0 ? '#EA580C' : '#DC2626';
      ctx.fillStyle = statusBg;
      roundRect(ctx, summaryCardX + 18, py + 2, summaryCardW - 36, 24, 6);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`STATUS: ${paymentStatus}`, summaryCardX + summaryCardW / 2, py + 18);
      ctx.textAlign = 'left';
    }

    // ─── FOOTER ON EVERY PAGE ─────────────────────────────────
    renderDocumentFooter({
      ctx,
      pageWidth: PAGE_WIDTH,
      pageHeight: PAGE_HEIGHT,
      language: lang,
      currentPage: pageIdx + 1,
      totalPages,
      docNumber: invoice.id,
      bizName,
    });

    // Convert Canvas to Image & Add to jsPDF
    const pageDataUrl = canvas.toDataURL('image/jpeg', 0.95);
    if (pageIdx > 0) {
      pdf.addPage();
    }
    pdf.addImage(pageDataUrl, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
  }

  // Exact download filename
  pdf.save(`Kanchi-Ambal-Invoice-${invoice.id}.pdf`);
}
