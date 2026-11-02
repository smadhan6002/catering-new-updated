/**
 * generateInventoryPDF — Generates high-resolution downloadable PDF documents
 * for Grocery & Vegetable Purchase / Stock Lists.
 *
 * Supports both English ('en') and Tamil ('ta') with complete native Unicode typography
 * rendered via HTML5 canvas, guaranteeing 100% correct Tamil ligature shaping, pulli, kombu, and vowel markings.
 */
import jsPDF from 'jspdf';
import type { InventoryDocument, InventoryDocumentItem } from '../types/inventory';
import { siteConfig, getBusinessName } from '../config/site';
import { formatUnitLabel } from '../services/inventoryService';
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

function formatInr(amount?: number): string {
  if (amount === undefined || isNaN(amount) || amount <= 0) return '—';
  return `₹ ${(amount || 0).toLocaleString('en-IN')}`;
}

export async function generateInventoryPDF(
  doc: InventoryDocument,
  language: 'en' | 'ta' = 'en',
  onProgress?: (percent: number, status: string) => void
): Promise<void> {
  onProgress?.(10, 'Preparing inventory document layout…');

  const isTa = language === 'ta';
  const logo = await loadImage(logoImg);

  // A4 dimensions at 2x resolution for ultra-crisp print quality (1240 x 1754 px)
  const PAGE_WIDTH = 1240;
  const PAGE_HEIGHT = 1754;

  const hasAnyPrice = doc.items.some((it) => it.unitPrice !== undefined && it.unitPrice > 0);
  const hasNotes = Boolean(doc.notes && doc.notes.trim());

  // Dynamic continuous page distribution based on actual vertical height
  const rowHeight = 36;
  const maxTableY = 1640;
  const summaryH = hasAnyPrice ? 120 : 95;

  // Page 1 capacities
  const p1StartY = 48 + 132 + 94 + (hasNotes ? 44 : 0) + 36; // 310 or 354
  const p1CapacityWithSummary = Math.floor((maxTableY - summaryH - p1StartY) / rowHeight); // ~28-32 items
  const p1CapacityWithoutSummary = Math.floor((maxTableY - p1StartY) / rowHeight); // ~34-37 items

  // Subsequent page capacities
  const pNextStartY = 48 + 132 + 44 + 36; // 260
  const pNextCapacityWithSummary = Math.floor((maxTableY - summaryH - pNextStartY) / rowHeight); // ~34-36 items
  const pNextCapacityWithoutSummary = Math.floor((maxTableY - pNextStartY) / rowHeight); // ~38-40 items

  // Partition items into pages dynamically
  const pages: InventoryDocumentItem[][] = [];
  if (doc.items.length === 0) {
    pages.push([]);
  } else if (doc.items.length <= p1CapacityWithSummary) {
    pages.push(doc.items);
  } else {
    let remaining = [...doc.items];
    let pIdx = 0;
    while (remaining.length > 0) {
      const isFirst = pIdx === 0;
      const capWithSummary = isFirst ? p1CapacityWithSummary : pNextCapacityWithSummary;
      const capWithoutSummary = isFirst ? p1CapacityWithoutSummary : pNextCapacityWithoutSummary;

      if (remaining.length <= capWithSummary) {
        pages.push(remaining);
        break;
      }

      let take = capWithoutSummary;
      const leftOver = remaining.length - take;
      // Prevent orphaned 1-3 items on next page
      if (leftOver > 0 && leftOver < 4 && take > 6) {
        take = take - (4 - leftOver);
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

  // Localized string dictionary
  const L = {
    title: isTa ? 'மளிகைப் பொருட்கள் & காய்கறி கொள்முதல் பட்டியல்' : 'Grocery & Vegetable Purchase / Stock List',
    docNo: isTa ? 'ஆவண எண்' : 'Doc No.',
    docDate: isTa ? 'ஆவணத் தேதி' : 'Doc Date',
    eventDate: isTa ? 'நிகழ்வுத் தேதி' : 'Event Date',
    eventName: isTa ? 'நிகழ்வு / சுபமுகூர்த்தம்' : 'Event / Function',
    customer: isTa ? 'வாடிக்கையாளர்' : 'Customer Name',
    preparedBy: isTa ? 'தயாரித்தவர்' : 'Prepared By',
    notes: isTa ? 'குறிப்புகள்' : 'Special Notes',
    sNo: isTa ? 'வ.எண்' : 'S.No.',
    item: isTa ? 'பொருளின் பெயர்' : 'Item Description',
    category: isTa ? 'வகை' : 'Category',
    quantity: isTa ? 'தேவையான அளவு' : 'Required Qty',
    unitPrice: isTa ? 'விலை / அலகு' : 'Unit Price',
    totalPrice: isTa ? 'மொத்த விலை' : 'Total Amount',
    itemNotes: isTa ? 'குறிப்பு' : 'Remarks',
    totalItems: isTa ? 'மொத்த பொருட்கள்' : 'Total Selected Items',
    grandTotal: isTa ? 'மதிப்பிடப்பட்ட மொத்தத் தொகை' : 'Estimated Total Amount',
    page: isTa ? 'பக்கம்' : 'Page',
    of: isTa ? 'இல்' : 'of',
    prepSign: isTa ? 'தயாரித்தவர் கையொப்பம்' : 'Prepared by',
    checkSign: isTa ? 'சரிபார்த்தவர் கையொப்பம்' : 'Verified by',
    vendorSign: isTa ? 'வியாபாரி / சப்ளையர் கையொப்பம்' : 'Supplier / Vendor Sign',
    tagline: isTa
      ? 'காஞ்சி அம்பாள் பாரம்பரிய சுத்த சைவ கேட்டரிங் சர்வீஸ்  •  காஞ்சிபுரம்'
      : 'Pure Vegetarian Catering Services  •  Kanchipuram, Tamil Nadu',
  };

  let runningItemIndex = 0;

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    onProgress?.(
      20 + Math.floor((pageIdx / totalPages) * 70),
      `Rendering page ${pageIdx + 1} of ${totalPages}…`
    );

    const pageItems = pages[pageIdx];
    const pageItemStartIdx = runningItemIndex;
    runningItemIndex += pageItems.length;

    // 1. Background fill
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);

    // 2. Decorative double border (Warm orange theme)
    ctx.strokeStyle = '#FFF7ED';
    ctx.lineWidth = 14;
    ctx.strokeRect(20, 20, PAGE_WIDTH - 40, PAGE_HEIGHT - 40);

    ctx.strokeStyle = '#EA580C';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(32, 32, PAGE_WIDTH - 64, PAGE_HEIGHT - 64);

    let y = 48;

    // 3. Header Band
    ctx.fillStyle = '#EA580C';
    ctx.fillRect(45, y, PAGE_WIDTH - 90, 115);

    // Accent gold stripe
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

    // Business Header Info
    const bizName = getBusinessName(language);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 30px "Noto Sans Tamil", "Inter", sans-serif';
    ctx.fillText(bizName, 175, y + 42);

    ctx.font = 'bold 16px "Noto Sans Tamil", "Inter", sans-serif';
    ctx.fillStyle = '#FEF3C7';
    ctx.fillText(L.title, 175, y + 72);

    ctx.font = '13px "Noto Sans Tamil", "Inter", sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`Ph: +91 ${siteConfig.whatsappNumber}  •  ${L.tagline}`, 175, y + 96);

    // Document Meta Badge on Header Right
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(PAGE_WIDTH - 290, y + 16, 230, 80);
    ctx.strokeStyle = '#FED7AA';
    ctx.lineWidth = 1;
    ctx.strokeRect(PAGE_WIDTH - 290, y + 16, 230, 80);

    ctx.fillStyle = '#9A3412';
    ctx.font = 'bold 11px "Inter", sans-serif';
    ctx.fillText('DOCUMENT NO.', PAGE_WIDTH - 275, y + 36);

    ctx.fillStyle = '#EA580C';
    ctx.font = 'bold 18px "Inter", sans-serif';
    ctx.fillText(doc.docNumber, PAGE_WIDTH - 275, y + 58);

    ctx.fillStyle = '#64748B';
    ctx.font = '11px "Noto Sans Tamil", "Inter", sans-serif';
    ctx.fillText(`${L.docDate}: ${formatDate(doc.documentDate, isTa)}`, PAGE_WIDTH - 275, y + 80);

    y += 132;

    // 4. Event / Function Details Section (Shown prominently on Page 1)
    if (pageIdx === 0) {
      ctx.fillStyle = '#FAFAFA';
      ctx.fillRect(45, y, PAGE_WIDTH - 90, 78);
      ctx.strokeStyle = '#FED7AA';
      ctx.lineWidth = 1;
      ctx.strokeRect(45, y, PAGE_WIDTH - 90, 78);

      const col1X = 65;
      const col2X = 460;
      const col3X = 860;

      // Col 1: Event Name
      ctx.fillStyle = '#9A3412';
      ctx.font = 'bold 11px "Noto Sans Tamil", "Inter", sans-serif';
      ctx.fillText(L.eventName.toUpperCase(), col1X, y + 26);
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 16px "Noto Sans Tamil", "Inter", sans-serif';
      ctx.fillText(doc.eventName || '—', col1X, y + 52);

      // Col 2: Customer Name & Event Date
      ctx.fillStyle = '#9A3412';
      ctx.font = 'bold 11px "Noto Sans Tamil", "Inter", sans-serif';
      ctx.fillText(L.customer.toUpperCase(), col2X, y + 26);
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 14px "Noto Sans Tamil", "Inter", sans-serif';
      ctx.fillText(doc.customerName || '—', col2X, y + 50);

      // Col 3: Event Date & Prepared By
      ctx.fillStyle = '#9A3412';
      ctx.font = 'bold 11px "Noto Sans Tamil", "Inter", sans-serif';
      ctx.fillText(L.eventDate.toUpperCase(), col3X, y + 26);
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 14px "Noto Sans Tamil", "Inter", sans-serif';
      ctx.fillText(formatDate(doc.eventDate, isTa), col3X, y + 50);

      y += 94;

      // Optional Notes banner if present
      if (doc.notes && doc.notes.trim()) {
        ctx.fillStyle = '#FFF7ED';
        ctx.fillRect(45, y, PAGE_WIDTH - 90, 32);
        ctx.strokeStyle = '#FDBA74';
        ctx.strokeRect(45, y, PAGE_WIDTH - 90, 32);

        ctx.fillStyle = '#9A3412';
        ctx.font = 'bold 11px "Noto Sans Tamil", "Inter", sans-serif';
        ctx.fillText(`★ ${L.notes}:`, 60, y + 21);

        ctx.fillStyle = '#1E293B';
        ctx.font = '12px "Noto Sans Tamil", "Inter", sans-serif';
        const truncatedNotes = doc.notes.length > 110 ? doc.notes.substring(0, 108) + '…' : doc.notes;
        ctx.fillText(truncatedNotes, 160, y + 21);

        y += 44;
      }
    } else {
      // Continuation header on subsequent pages
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(45, y, PAGE_WIDTH - 90, 32);
      ctx.strokeStyle = '#E2E8F0';
      ctx.strokeRect(45, y, PAGE_WIDTH - 90, 32);

      ctx.fillStyle = '#64748B';
      ctx.font = 'bold 12px "Noto Sans Tamil", "Inter", sans-serif';
      ctx.fillText(
        `${doc.title} — ${doc.eventName}  (${L.page} ${pageIdx + 1} ${L.of} ${totalPages})`,
        60,
        y + 21
      );

      y += 44;
    }

    // 5. Items Table
    const tableW = PAGE_WIDTH - 90;
    const startX = 45;

    // Define columns based on whether prices are used
    let cols: { label: string; width: number; align: 'left' | 'center' | 'right' }[];

    if (hasAnyPrice) {
      cols = [
        { label: L.sNo, width: 60, align: 'center' },
        { label: L.item, width: 340, align: 'left' },
        { label: L.category, width: 220, align: 'left' },
        { label: L.quantity, width: 150, align: 'right' },
        { label: L.unitPrice, width: 140, align: 'right' },
        { label: L.totalPrice, width: 140, align: 'right' },
        { label: L.itemNotes, width: 100, align: 'left' },
      ];
    } else {
      cols = [
        { label: L.sNo, width: 70, align: 'center' },
        { label: L.item, width: 440, align: 'left' },
        { label: L.category, width: 260, align: 'left' },
        { label: L.quantity, width: 200, align: 'center' },
        { label: L.itemNotes, width: 180, align: 'left' },
      ];
    }

    // Table Header Bar
    const headerHeight = 36;
    ctx.fillStyle = '#EA580C';
    ctx.fillRect(startX, y, tableW, headerHeight);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px "Noto Sans Tamil", "Inter", sans-serif';

    let colCurX = startX;
    cols.forEach((col) => {
      let tx = colCurX + 12;
      if (col.align === 'center') tx = colCurX + col.width / 2;
      if (col.align === 'right') tx = colCurX + col.width - 14;

      ctx.textAlign = col.align;
      ctx.fillText(col.label, tx, y + 23);
      colCurX += col.width;
    });

    y += headerHeight;
    ctx.textAlign = 'left';

    // Table Rows
    pageItems.forEach((item, rIdx) => {
      const globalIdx = pageItemStartIdx + rIdx + 1;
      const isEven = rIdx % 2 === 0;

      // Row background
      ctx.fillStyle = isEven ? '#FFFFFF' : '#FFFBF5';
      ctx.fillRect(startX, y, tableW, rowHeight);

      // Bottom row border
      ctx.strokeStyle = '#F1F5F9';
      ctx.lineWidth = 1;
      ctx.strokeRect(startX, y, tableW, rowHeight);

      colCurX = startX;

      const itemName = isTa ? item.nameTa || item.nameEn : item.nameEn;
      const categoryName = isTa
        ? item.categoryNameTa || item.categoryNameEn || '—'
        : item.categoryNameEn || item.categoryNameTa || '—';
      const unitLabel = formatUnitLabel(item.unit, language);
      const qtyText = `${item.quantity} ${unitLabel}`;

      if (hasAnyPrice) {
        // 1. S.No
        ctx.fillStyle = '#64748B';
        ctx.font = 'bold 12px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(globalIdx), colCurX + 30, y + 23);
        colCurX += cols[0].width;

        // 2. Item Name
        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 13px "Noto Sans Tamil", "Inter", sans-serif';
        ctx.textAlign = 'left';
        const truncName = itemName.length > 28 ? itemName.substring(0, 26) + '…' : itemName;
        ctx.fillText(truncName, colCurX + 12, y + 23);
        colCurX += cols[1].width;

        // 3. Category
        ctx.fillStyle = '#64748B';
        ctx.font = '11px "Noto Sans Tamil", "Inter", sans-serif';
        const truncCat = categoryName.length > 20 ? categoryName.substring(0, 18) + '…' : categoryName;
        ctx.fillText(truncCat, colCurX + 10, y + 23);
        colCurX += cols[2].width;

        // 4. Quantity & Unit
        ctx.fillStyle = '#9A3412';
        ctx.font = 'bold 13px "Noto Sans Tamil", "Inter", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(qtyText, colCurX + cols[3].width - 14, y + 23);
        colCurX += cols[3].width;

        // 5. Unit Price
        ctx.fillStyle = '#334155';
        ctx.font = '12px "Inter", sans-serif';
        ctx.fillText(item.unitPrice ? formatInr(item.unitPrice) : '—', colCurX + cols[4].width - 14, y + 23);
        colCurX += cols[4].width;

        // 6. Total Price
        ctx.fillStyle = '#EA580C';
        ctx.font = 'bold 13px "Inter", sans-serif';
        ctx.fillText(item.totalPrice ? formatInr(item.totalPrice) : '—', colCurX + cols[5].width - 14, y + 23);
        colCurX += cols[5].width;

        // 7. Notes
        ctx.fillStyle = '#64748B';
        ctx.font = '11px "Noto Sans Tamil", "Inter", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(item.notes || '—', colCurX + 10, y + 23);
      } else {
        // NO PRICES MODE: Clean & generous layout
        // 1. S.No
        ctx.fillStyle = '#64748B';
        ctx.font = 'bold 13px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(globalIdx), colCurX + 35, y + 23);
        colCurX += cols[0].width;

        // 2. Item Name
        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 14px "Noto Sans Tamil", "Inter", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(itemName, colCurX + 16, y + 23);
        colCurX += cols[1].width;

        // 3. Category
        ctx.fillStyle = '#64748B';
        ctx.font = '12px "Noto Sans Tamil", "Inter", sans-serif';
        ctx.fillText(categoryName, colCurX + 12, y + 23);
        colCurX += cols[2].width;

        // 4. Quantity & Unit
        ctx.fillStyle = '#EA580C';
        ctx.font = 'bold 15px "Noto Sans Tamil", "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(qtyText, colCurX + cols[3].width / 2, y + 23);
        colCurX += cols[3].width;

        // 5. Notes
        ctx.fillStyle = '#64748B';
        ctx.font = '11px "Noto Sans Tamil", "Inter", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(item.notes || '—', colCurX + 12, y + 23);
      }

      ctx.textAlign = 'left';
      y += rowHeight;
    });

    // 6. Summary Footer on Last Page
    if (pageIdx === totalPages - 1) {
      y += 16;

      // Summary Card
      const summaryW = 420;
      const summaryX = PAGE_WIDTH - 45 - summaryW;
      const summaryH = hasAnyPrice && doc.totalAmount ? 70 : 44;

      ctx.fillStyle = '#FFF7ED';
      ctx.fillRect(summaryX, y, summaryW, summaryH);
      ctx.strokeStyle = '#FED7AA';
      ctx.lineWidth = 1;
      ctx.strokeRect(summaryX, y, summaryW, summaryH);

      // Total Items row
      ctx.fillStyle = '#334155';
      ctx.font = '13px "Noto Sans Tamil", "Inter", sans-serif';
      ctx.fillText(`${L.totalItems}:`, summaryX + 20, y + 28);
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 14px "Inter", sans-serif';
      ctx.fillText(`${doc.items.length}`, summaryX + summaryW - 50, y + 28);

      // Grand Total if prices are used
      if (hasAnyPrice && doc.totalAmount) {
        ctx.fillStyle = '#9A3412';
        ctx.font = 'bold 13px "Noto Sans Tamil", "Inter", sans-serif';
        ctx.fillText(`${L.grandTotal}:`, summaryX + 20, y + 54);
        ctx.fillStyle = '#EA580C';
        ctx.font = 'bold 18px "Inter", sans-serif';
        ctx.fillText(formatInr(doc.totalAmount), summaryX + summaryW - 140, y + 54);
      }

      // Sign-off blocks on the left
      const signBlockY = y + 10;
      ctx.font = '11px "Noto Sans Tamil", "Inter", sans-serif';
      ctx.fillStyle = '#64748B';

      ctx.fillText(`${L.prepSign}: ____________________`, 60, signBlockY + 18);
      ctx.fillText(`${L.checkSign}: ____________________`, 60, signBlockY + 44);
    }

    // 7. Page Footer
    const footerY = PAGE_HEIGHT - 65;
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(45, footerY, PAGE_WIDTH - 90, 1);

    ctx.fillStyle = '#64748B';
    ctx.font = '11px "Noto Sans Tamil", "Inter", sans-serif';
    ctx.fillText(
      `${bizName}  •  Ph: +91 ${siteConfig.whatsappNumber}  •  ${isTa ? 'மளிகைப் பொருட்கள் துறை' : 'Grocery & Vegetable Department'}`,
      45,
      footerY + 22
    );

    ctx.font = 'bold 12px "Inter", sans-serif';
    ctx.fillStyle = '#EA580C';
    ctx.textAlign = 'right';
    ctx.fillText(`${L.page} ${pageIdx + 1} ${L.of} ${totalPages}`, PAGE_WIDTH - 45, footerY + 22);
    ctx.textAlign = 'left';

    // Convert canvas to image and add to PDF
    const imgData = canvas.toDataURL('image/jpeg', 0.94);
    if (pageIdx > 0) {
      pdf.addPage();
    }
    pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
  }

  onProgress?.(98, 'Finalizing download…');
  const safeTitle = (doc.eventName || 'Inventory').replace(/[^a-zA-Z0-9_-]/g, '_');
  pdf.save(`Kanchi-Ambal-Inventory-${doc.docNumber}-${safeTitle}-${language.toUpperCase()}.pdf`);
  onProgress?.(100, 'Complete!');
}

/**
 * Trigger clean browser print preview
 */
export function printInventoryDocument(doc: InventoryDocument, language: 'en' | 'ta' = 'en'): void {
  const isTa = language === 'ta';
  const hasAnyPrice = doc.items.some((it) => it.unitPrice !== undefined && it.unitPrice > 0);

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to print the document.');
    return;
  }

  const itemsHtml = doc.items
    .map((item, idx) => {
      const name = isTa ? item.nameTa || item.nameEn : item.nameEn;
      const cat = isTa ? item.categoryNameTa || item.categoryNameEn || '—' : item.categoryNameEn || '—';
      const unit = formatUnitLabel(item.unit, language);
      const unitPriceStr = item.unitPrice ? `₹${item.unitPrice.toLocaleString('en-IN')}` : '—';
      const totalStr = item.totalPrice ? `₹${item.totalPrice.toLocaleString('en-IN')}` : '—';

      return `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td><strong>${name}</strong></td>
          <td>${cat}</td>
          <td style="text-align: center; font-weight: bold; color: #ea580c;">${item.quantity} ${unit}</td>
          ${hasAnyPrice ? `<td style="text-align: right;">${unitPriceStr}</td>` : ''}
          ${hasAnyPrice ? `<td style="text-align: right; font-weight: bold;">${totalStr}</td>` : ''}
          <td>${item.notes || '—'}</td>
        </tr>
      `;
    })
    .join('');

  const html = `
    <!DOCTYPE html>
    <html lang="${language}">
    <head>
      <meta charset="utf-8">
      <title>${doc.title} - ${doc.docNumber}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 10mm;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans Tamil", sans-serif;
          color: #1e293b;
          margin: 0;
          padding: 16px;
        }
        .header {
          border-bottom: 3px solid #ea580c;
          padding-bottom: 12px;
          margin-bottom: 14px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .brand {
          font-size: 22px;
          font-weight: 800;
          color: #ea580c;
        }
        .sub {
          font-size: 12px;
          color: #64748b;
          margin-top: 3px;
        }
        .doc-title {
          font-size: 16px;
          font-weight: bold;
          color: #0f172a;
          margin-top: 4px;
        }
        .meta-box {
          text-align: right;
          font-size: 12px;
        }
        .meta-badge {
          display: inline-block;
          background: #fff7ed;
          border: 1px solid #fed7aa;
          color: #c2410c;
          font-weight: bold;
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 13px;
          margin-bottom: 4px;
        }
        .details-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 10px 14px;
          margin-bottom: 14px;
          font-size: 12px;
          gap: 10px;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .details-grid dt {
          font-size: 10px;
          text-transform: uppercase;
          color: #9a3412;
          font-weight: bold;
        }
        .details-grid dd {
          margin: 2px 0 0 0;
          font-weight: 600;
          color: #0f172a;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
          margin-bottom: 16px;
        }
        thead {
          display: table-header-group;
        }
        th {
          background-color: #ea580c;
          color: #ffffff;
          padding: 8px 10px;
          text-align: left;
        }
        td {
          padding: 7px 10px;
          border-bottom: 1px solid #e2e8f0;
        }
        tr {
          page-break-inside: avoid;
          break-inside: avoid;
        }
        tr:nth-child(even) {
          background-color: #fffbf5;
        }
        .footer-summary {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-top: 16px;
          padding-top: 14px;
          border-top: 1px solid #e2e8f0;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .signatures {
          font-size: 11px;
          color: #64748b;
          line-height: 2.2;
        }
        .summary-card {
          background: #fff7ed;
          border: 1px solid #fed7aa;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 12px;
          min-width: 220px;
        }
        @media print {
          body { padding: 0; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="brand">${getBusinessName(language)}</div>
          <div class="sub">${isTa ? siteConfig.name : siteConfig.tamilName} • Ph: +91 ${siteConfig.whatsappNumber}</div>
          <div class="doc-title">${isTa ? 'மளிகைப் பொருட்கள் & காய்கறி கொள்முதல் பட்டியல்' : 'Grocery & Vegetable Purchase / Stock List'}</div>
        </div>
        <div class="meta-box">
          <div class="meta-badge">${doc.docNumber}</div>
          <div>${isTa ? 'தேதி' : 'Date'}: ${formatDate(doc.documentDate, isTa)}</div>
        </div>
      </div>

      <div class="details-grid">
        <div>
          <dt>${isTa ? 'நிகழ்வு / சுபமுகூர்த்தம்' : 'Event / Function'}</dt>
          <dd>${doc.eventName || '—'}</dd>
        </div>
        <div>
          <dt>${isTa ? 'வாடிக்கையாளர்' : 'Customer Name'}</dt>
          <dd>${doc.customerName || '—'}</dd>
        </div>
        <div>
          <dt>${isTa ? 'நிகழ்வுத் தேதி' : 'Event Date'}</dt>
          <dd>${formatDate(doc.eventDate, isTa)}</dd>
        </div>
      </div>

      ${
        doc.notes
          ? `<div style="background:#fff7ed; border:1px solid #fed7aa; padding:8px 12px; border-radius:6px; font-size:12px; margin-bottom:16px;">
               <strong>${isTa ? 'குறிப்பு' : 'Notes'}:</strong> ${doc.notes}
             </div>`
          : ''
      }

      <table>
        <thead>
          <tr>
            <th style="width: 40px; text-align: center;">#</th>
            <th>${isTa ? 'பொருளின் பெயர்' : 'Item Name'}</th>
            <th>${isTa ? 'வகை' : 'Category'}</th>
            <th style="text-align: center;">${isTa ? 'அளவு' : 'Quantity'}</th>
            ${hasAnyPrice ? `<th style="text-align: right;">${isTa ? 'விலை' : 'Unit Price'}</th>` : ''}
            ${hasAnyPrice ? `<th style="text-align: right;">${isTa ? 'மொத்தம்' : 'Total'}</th>` : ''}
            <th>${isTa ? 'குறிப்பு' : 'Remarks'}</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div class="footer-summary">
        <div class="signatures">
          <div>${isTa ? 'தயாரித்தவர்' : 'Prepared By'}: ${doc.preparedBy || '____________________'}</div>
          <div>${isTa ? 'சரிபார்த்தவர்' : 'Verified By'}: ____________________</div>
        </div>
        <div class="summary-card">
          <div>${isTa ? 'மொத்த பொருட்கள்' : 'Total Items'}: <strong>${doc.items.length}</strong></div>
          ${
            hasAnyPrice && doc.totalAmount
              ? `<div style="margin-top:6px; font-size:15px; color:#ea580c;"><strong>${
                  isTa ? 'மொத்தத் தொகை' : 'Total Amount'
                }: ₹${doc.totalAmount.toLocaleString('en-IN')}</strong></div>`
              : ''
          }
        </div>
      </div>

      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

