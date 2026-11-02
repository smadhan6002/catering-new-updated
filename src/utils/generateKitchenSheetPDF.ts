/**
 * generateKitchenSheetPDF — generates and downloads a professional Kitchen Order Sheet PDF
 * Compatible with jsPDF + jspdf-autotable, with full Tamil Unicode & English rendering.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { KitchenOrderSheet } from '../types/admin';
import { siteConfig, getBusinessName } from '../config/site';
import { formatUnitLabel } from '../services/kitchenSheetService';
import logoImg from '../assets/LOGO.png';

function formatDate(isoDate: string): string {
  if (!isoDate) return '—';
  const d = new Date(isoDate.includes('T') ? isoDate : isoDate + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

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

/**
 * Generates vector-based PDF for English output using jsPDF + autoTable.
 * Produces crisp, 100% selectable, scalable vector text.
 */
function generateEnglishVectorPDF(sheet: KitchenOrderSheet): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const primaryColor: [number, number, number] = [234, 88, 12]; // #EA580C Primary Orange
  const darkColor: [number, number, number] = [30, 41, 59];     // #1E293B Body Text
  const slate600: [number, number, number] = [100, 116, 139];   // #64748B Muted Text
  const lightGray: [number, number, number] = [255, 247, 237];  // #FFF7ED Light Orange
  const borderGray: [number, number, number] = [254, 215, 170]; // #FED7AA Light Border

  let y = 0;

  // ─── TOP HEADER BAND ──────────────────────────────────────
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageW, 30, 'F');

  // Business Name & Subtitle
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(getBusinessName('en'), 14, 12);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Ph: +91 ${siteConfig.whatsappNumber}  |  Authentic Feast Catering`, 14, 19);
  doc.text('KITCHEN PREPARATION & COOKING MASTER SHEET', 14, 25);

  // Title Box on Right
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('KITCHEN SHEET', pageW - 14, 18, { align: 'right' });

  y = 36;

  // ─── METADATA SUMMARY CARD (2 columns) ────────────────────
  const metaLeft = 14;
  const metaRight = pageW / 2 + 4;
  const colW = (pageW - 28 - 8) / 2;
  const boxH = 34;

  // Left card - Order & Event Info
  doc.setFillColor(...lightGray);
  doc.setDrawColor(...borderGray);
  doc.setLineWidth(0.3);
  doc.roundedRect(metaLeft, y, colW, boxH, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setTextColor(...slate600);
  doc.setFont('helvetica', 'bold');
  doc.text('ORDER DETAILS', metaLeft + 4, y + 6);

  doc.setFontSize(9);
  doc.setTextColor(...darkColor);
  doc.setFont('helvetica', 'bold');
  doc.text(`Order ID: ${sheet.orderId}`, metaLeft + 4, y + 13);
  doc.setFont('helvetica', 'normal');
  doc.text(`Delivery Date: ${formatDate(sheet.orderDate)}${sheet.deliveryTime ? ` (${sheet.deliveryTime})` : ''}`, metaLeft + 4, y + 19);

  let peopleInfo = '—';
  if (sheet.guestCount && sheet.guestCount > 0) {
    peopleInfo = `${sheet.guestCount} Guests / People`;
  }
  doc.text(`People Count: ${peopleInfo}`, metaLeft + 4, y + 25);
  doc.text(`Prep Status: ${sheet.status.toUpperCase()}`, metaLeft + 4, y + 31);

  // Right card - Customer & Venue Info
  doc.setFillColor(...lightGray);
  doc.roundedRect(metaRight, y, colW, boxH, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setTextColor(...slate600);
  doc.setFont('helvetica', 'bold');
  doc.text('CUSTOMER & VENUE', metaRight + 4, y + 6);

  doc.setFontSize(9);
  doc.setTextColor(...darkColor);
  doc.setFont('helvetica', 'bold');
  doc.text(`Customer: ${sheet.customerName}`, metaRight + 4, y + 13);
  doc.setFont('helvetica', 'normal');
  doc.text(`Mobile: ${sheet.mobile}${sheet.alternativeMobile ? ` / ${sheet.alternativeMobile}` : ''}`, metaRight + 4, y + 19);

  const venueText = sheet.eventAddress ? (sheet.eventAddress.length > 36 ? sheet.eventAddress.substring(0, 34) + '…' : sheet.eventAddress) : 'Venue: As confirmed';
  doc.text(`Venue: ${venueText}`, metaRight + 4, y + 25);
  doc.text(`Event Type: ${sheet.eventType || 'Catering Function'}`, metaRight + 4, y + 31);

  y += boxH + 6;

  // ─── FOOD PREPARATION TABLE ───────────────────────────────
  const tableData = sheet.items.map((item, idx) => {
    const custQtyStr = item.customerQuantity !== null && item.customerQuantity !== undefined
      ? `${item.customerQuantity} ${item.customerUnit || item.unit}`
      : '—';

    const prepQtyStr = `${item.prepQuantity || '—'}`;
    const unitStr = formatUnitLabel(item.unit, false);

    return [
      String(idx + 1),
      item.dishName,
      custQtyStr,
      prepQtyStr,
      unitStr,
      item.kitchenNotes || '—',
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['#', 'Food Item / Dish Name', 'Customer Qty', 'Final Prep Qty', 'Unit', 'Kitchen Notes']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: darkColor,
      cellPadding: 2.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 55, fontStyle: 'bold' },
      2: { cellWidth: 26, halign: 'center' },
      3: { cellWidth: 26, halign: 'center', fontStyle: 'bold', textColor: primaryColor },
      4: { cellWidth: 20, halign: 'center' },
      5: { cellWidth: 'auto' },
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
      // Header for subsequent pages
      if (data.pageNumber > 1) {
        doc.setFillColor(...primaryColor);
        doc.rect(0, 0, pageW, 14, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(`${getBusinessName('en')}  •  Kitchen Sheet: ${sheet.orderId} (${sheet.customerName})`, 14, 9);
      }

      // Footer band on every page
      const footerY = pageH - 10;
      doc.setFillColor(241, 245, 249);
      doc.rect(0, footerY - 2, pageW, 12, 'F');
      doc.setDrawColor(...borderGray);
      doc.setLineWidth(0.2);
      doc.line(0, footerY - 2, pageW, footerY - 2);

      doc.setTextColor(...slate600);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Generated: ${new Date().toLocaleString('en-IN')}  |  Cooking Master Copy  |  Order: ${sheet.orderId}`,
        14,
        footerY + 4
      );
      doc.text(`Page ${data.pageNumber}`, pageW - 14, footerY + 4, { align: 'right' });
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 8;

  // ─── CHEF INSTRUCTIONS & SIGN-OFF ────────────────────────
  if (y + 40 > pageH - 15) {
    doc.addPage();
    y = 20;
  }

  // Cooking Instructions Box
  const notesW = pageW - 28;
  if (sheet.cookingInstructions && sheet.cookingInstructions.trim()) {
    doc.setFillColor(254, 243, 199); // amber-100
    doc.setDrawColor(245, 158, 11);  // amber-500
    doc.setLineWidth(0.3);
    doc.roundedRect(14, y, notesW, 16, 1.5, 1.5, 'FD');

    doc.setTextColor(146, 64, 14); // amber-800
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('SPECIAL COOKING INSTRUCTIONS:', 18, y + 5);

    doc.setFont('helvetica', 'normal');
    const noteLines = doc.splitTextToSize(sheet.cookingInstructions, notesW - 8);
    doc.text(noteLines, 18, y + 10);

    y += 22;
  }

  // Signature Block
  if (y + 22 > pageH - 15) {
    doc.addPage();
    y = 20;
  }

  doc.setDrawColor(...borderGray);
  doc.setLineWidth(0.3);
  doc.line(14, y, pageW - 14, y);
  y += 6;

  const signColW = (pageW - 28) / 3;
  doc.setFontSize(8);
  doc.setTextColor(...slate600);
  doc.setFont('helvetica', 'normal');

  doc.text('Prepared by: ____________________', 14, y + 8);
  doc.text('Cooking Master Sign: ____________________', 14 + signColW, y + 8);
  doc.text('Verified & Dispatched by: ________________', 14 + signColW * 2, y + 8);

  // Save PDF
  doc.save(`Kanchi-Ambal-Kitchen-Order-${sheet.orderId}.pdf`);
}

/**
 * Generates high-resolution multi-page canvas-rendered PDF with native Tamil Unicode font support.
 * Guaranteed 100% correct Tamil ligature shaping, pulli, kombu, and vowel markings.
 */
async function generateTamilCanvasPDF(
  sheet: KitchenOrderSheet,
  includeEnglish = true
): Promise<void> {
  const PAGE_WIDTH = 1240;
  const PAGE_HEIGHT = 1754;

  const logo = await loadImage(logoImg);

  // Dynamic continuous page distribution based on actual vertical height
  const rowHeight = 44;
  const maxTableY = 1640;
  const footerBlocksH = sheet.cookingInstructions && sheet.cookingInstructions.trim() ? 150 : 90;

  const p1StartY = 50 + 130 + 128 + 44; // 352
  const p1CapWithBlocks = Math.floor((maxTableY - footerBlocksH - p1StartY) / rowHeight); // ~24
  const p1CapWithoutBlocks = Math.floor((maxTableY - p1StartY) / rowHeight); // ~29

  const pNextStartY = 50 + 130 + 50 + 44; // 274
  const pNextCapWithBlocks = Math.floor((maxTableY - footerBlocksH - pNextStartY) / rowHeight); // ~27
  const pNextCapWithoutBlocks = Math.floor((maxTableY - pNextStartY) / rowHeight); // ~31

  const pages: (typeof sheet.items)[] = [];
  if (sheet.items.length === 0) {
    pages.push([]);
  } else if (sheet.items.length <= p1CapWithBlocks) {
    pages.push(sheet.items);
  } else {
    let remaining = [...sheet.items];
    let pIdx = 0;
    while (remaining.length > 0) {
      const isFirst = pIdx === 0;
      const capWith = isFirst ? p1CapWithBlocks : pNextCapWithBlocks;
      const capWithout = isFirst ? p1CapWithoutBlocks : pNextCapWithoutBlocks;

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

  const doc = new jsPDF({
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

  let runningItemOffset = 0;

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const pageItems = pages[pageIdx];
    const startIdx = runningItemOffset;
    runningItemOffset += pageItems.length;

    // Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);

    // Decorative Borders
    ctx.strokeStyle = '#F1F5F9';
    ctx.lineWidth = 12;
    ctx.strokeRect(20, 20, PAGE_WIDTH - 40, PAGE_HEIGHT - 40);

    ctx.strokeStyle = '#EA580C';
    ctx.lineWidth = 2;
    ctx.strokeRect(32, 32, PAGE_WIDTH - 64, PAGE_HEIGHT - 64);

    let y = 50;

    // ─── HEADER BAND ──────────────────────────────────────
    ctx.fillStyle = '#EA580C';
    ctx.fillRect(45, y, PAGE_WIDTH - 90, 110);

    // Accent stripe
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(45, y + 106, PAGE_WIDTH - 90, 4);

    // Logo (if available)
    if (logo) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(105, y + 55, 38, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.clip();
      ctx.drawImage(logo, 67, y + 17, 76, 76);
      ctx.restore();
    }

    // Business Name & Title
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 30px "Noto Sans Tamil", "Inter", sans-serif';
    ctx.fillText(getBusinessName('ta'), 160, y + 42);

    ctx.font = 'bold 18px "Noto Sans Tamil", "Inter", sans-serif';
    ctx.fillStyle = '#FEF3C7';
    ctx.fillText('சமையல் தயாரிப்பு பட்டியல் (KITCHEN ORDER SHEET)', 160, y + 72);

    ctx.font = '14px "Noto Sans Tamil", "Inter", sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`Ph: +91 ${siteConfig.whatsappNumber}  •  காஞ்சி அம்பாள் பாரம்பரிய கேட்டரிங் சர்வீஸ்`, 160, y + 96);

    // Header Right: Order ID badge
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(PAGE_WIDTH - 270, y + 20, 210, 70);
    ctx.fillStyle = '#9A3412';
    ctx.font = 'bold 13px "Inter", sans-serif';
    ctx.fillText('ORDER ID', PAGE_WIDTH - 250, y + 42);
    ctx.font = 'bold 24px "Inter", sans-serif';
    ctx.fillStyle = '#EA580C';
    ctx.fillText(sheet.orderId, PAGE_WIDTH - 250, y + 74);

    y += 130;

    // ─── METADATA SECTION (Page 1 only or compact on subsequent) ──
    if (pageIdx === 0) {
      // 2 columns
      const colW = (PAGE_WIDTH - 110) / 2;

      // Card 1
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(45, y, colW, 110);
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.strokeRect(45, y, colW, 110);

      ctx.fillStyle = '#EA580C';
      ctx.fillRect(45, y, 6, 110);

      ctx.fillStyle = '#1E293B';
      ctx.font = 'bold 15px "Noto Sans Tamil", "Inter", sans-serif';
      ctx.fillText(`வாடிக்கையாளர் பெயர்: ${sheet.customerName}`, 62, y + 28);
      ctx.font = '14px "Noto Sans Tamil", "Inter", sans-serif';
      ctx.fillStyle = '#475569';
      ctx.fillText(`கைப்பேசி எண்: ${sheet.mobile}${sheet.alternativeMobile ? ` / ${sheet.alternativeMobile}` : ''}`, 62, y + 54);
      const addr = sheet.eventAddress ? (sheet.eventAddress.length > 36 ? sheet.eventAddress.substring(0, 34) + '…' : sheet.eventAddress) : 'முகவரி: உறுதிசெய்யப்பட்டது';
      ctx.fillText(`நிகழ்வு இடம்: ${addr}`, 62, y + 80);
      ctx.fillText(`நிகழ்வு வகை: ${sheet.eventType || 'கேட்டரிங் சுபநிகழ்ச்சி'}`, 62, y + 102);

      // Card 2
      const card2X = 45 + colW + 20;
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(card2X, y, colW, 110);
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.strokeRect(card2X, y, colW, 110);

      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(card2X, y, 6, 110);

      ctx.fillStyle = '#1E293B';
      ctx.font = 'bold 15px "Noto Sans Tamil", "Inter", sans-serif';
      ctx.fillText(`டெலிவரி தேதி: ${formatDate(sheet.orderDate)}${sheet.deliveryTime ? ` (${sheet.deliveryTime})` : ''}`, card2X + 18, y + 28);

      let guestStr = '—';
      if (sheet.guestCount && sheet.guestCount > 0) {
        guestStr = `${sheet.guestCount} நபர்கள் (Guests)`;
      }
      ctx.font = '14px "Noto Sans Tamil", "Inter", sans-serif';
      ctx.fillStyle = '#475569';
      ctx.fillText(`நபர்கள் எண்ணிக்கை: ${guestStr}`, card2X + 18, y + 54);
      ctx.fillText(`தயாரிப்பு நிலை: ${sheet.status}`, card2X + 18, y + 80);
      ctx.fillText(`ஆர்டர் உருவாக்கப்பட்ட தேதி: ${formatDate(sheet.createdAt)}`, card2X + 18, y + 102);

      y += 128;
    } else {
      // Compact page header
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(45, y, PAGE_WIDTH - 90, 36);
      ctx.strokeStyle = '#E2E8F0';
      ctx.strokeRect(45, y, PAGE_WIDTH - 90, 36);

      ctx.fillStyle = '#EA580C';
      ctx.fillRect(45, y, 6, 36);

      ctx.fillStyle = '#1E293B';
      ctx.font = 'bold 14px "Noto Sans Tamil", "Inter", sans-serif';
      ctx.fillText(`ஆர்டர்: ${sheet.orderId}  •  வாடிக்கையாளர்: ${sheet.customerName}  •  தேதி: ${formatDate(sheet.orderDate)}`, 62, y + 24);

      y += 50;
    }

    // ─── FOOD PREPARATION TABLE ─────────────────────────────
    const tableX = 45;
    const tableW = PAGE_WIDTH - 90;
    const colWidths = [50, 480, 150, 160, 120, tableW - 960]; // total: tableW

    // Table Header
    ctx.fillStyle = '#EA580C';
    ctx.fillRect(tableX, y, tableW, 44);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px "Noto Sans Tamil", "Inter", sans-serif';

    let currX = tableX;
    ctx.fillText('எண்', currX + 12, y + 28);
    currX += colWidths[0];

    ctx.fillText('உணவுப் பெயர் (Dish Name)', currX + 12, y + 28);
    currX += colWidths[1];

    ctx.fillText('வாடிக்கையாளர் அளவு', currX + 10, y + 28);
    currX += colWidths[2];

    ctx.fillText('தயாரிக்க வேண்டிய அளவு', currX + 10, y + 28);
    currX += colWidths[3];

    ctx.fillText('அலகு (Unit)', currX + 10, y + 28);
    currX += colWidths[4];

    ctx.fillText('சமையல் குறிப்பு (Notes)', currX + 12, y + 28);

    y += 44;

    // Table Rows
    pageItems.forEach((item, rIdx) => {
      const globalIdx = startIdx + rIdx + 1;
      const rowY = y;

      // Zebra striping
      ctx.fillStyle = rIdx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
      ctx.fillRect(tableX, rowY, tableW, rowHeight);

      // Border lines
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.strokeRect(tableX, rowY, tableW, rowHeight);

      let x = tableX;

      // Col 1: S.No
      ctx.fillStyle = '#64748B';
      ctx.font = 'bold 13px "Inter", sans-serif';
      ctx.fillText(String(globalIdx), x + 16, rowY + 28);
      x += colWidths[0];

      // Col 2: Dish Name
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 14px "Noto Sans Tamil", "Inter", sans-serif';

      const tamilName = item.dishNameTa || '';
      if (includeEnglish && tamilName) {
        ctx.fillText(tamilName, x + 12, rowY + 20);
        ctx.fillStyle = '#64748B';
        ctx.font = '12px "Inter", sans-serif';
        const truncatedEn = item.dishName.length > 32 ? item.dishName.substring(0, 30) + '…' : item.dishName;
        ctx.fillText(truncatedEn, x + 12, rowY + 36);
      } else {
        const displayName = tamilName || item.dishName;
        ctx.fillText(displayName, x + 12, rowY + 28);
      }
      x += colWidths[1];

      // Col 3: Customer Qty
      ctx.fillStyle = '#64748B';
      ctx.font = '13px "Noto Sans Tamil", "Inter", sans-serif';
      const custQtyStr = item.customerQuantity !== null && item.customerQuantity !== undefined
        ? `${item.customerQuantity} ${formatUnitLabel(item.customerUnit || item.unit, true)}`
        : '—';
      ctx.fillText(custQtyStr, x + 20, rowY + 28);
      x += colWidths[2];

      // Col 4: Final Preparation Qty (Highlighted in Bold)
      ctx.fillStyle = '#EA580C';
      ctx.font = 'bold 16px "Inter", sans-serif';
      const prepQtyVal = item.prepQuantity ? String(item.prepQuantity) : '—';
      ctx.fillText(prepQtyVal, x + 25, rowY + 28);
      x += colWidths[3];

      // Col 5: Unit
      ctx.fillStyle = '#334155';
      ctx.font = 'bold 13px "Noto Sans Tamil", "Inter", sans-serif';
      const unitLabel = formatUnitLabel(item.unit, true);
      ctx.fillText(unitLabel, x + 15, rowY + 28);
      x += colWidths[4];

      // Col 6: Kitchen Notes
      ctx.fillStyle = '#64748B';
      ctx.font = 'italic 12px "Noto Sans Tamil", "Inter", sans-serif';
      const notes = item.kitchenNotes ? (item.kitchenNotes.length > 28 ? item.kitchenNotes.substring(0, 26) + '…' : item.kitchenNotes) : '—';
      ctx.fillText(notes, x + 12, rowY + 28);

      y += rowHeight;
    });

    // ─── CHEF NOTES ON FINAL PAGE ───────────────────────────
    if (pageIdx === totalPages - 1) {
      y += 18;

      if (sheet.cookingInstructions && sheet.cookingInstructions.trim()) {
        ctx.fillStyle = '#FFFBEB';
        ctx.fillRect(tableX, y, tableW, 60);
        ctx.strokeStyle = '#FCD34D';
        ctx.lineWidth = 1;
        ctx.strokeRect(tableX, y, tableW, 60);

        ctx.fillStyle = '#92400E';
        ctx.font = 'bold 13px "Noto Sans Tamil", "Inter", sans-serif';
        ctx.fillText('முக்கிய சமையல் குறிப்புகள் (Special Cooking Instructions):', tableX + 16, y + 24);

        ctx.font = '13px "Noto Sans Tamil", "Inter", sans-serif';
        ctx.fillText(sheet.cookingInstructions, tableX + 16, y + 46);

        y += 75;
      } else {
        y += 10;
      }

      // Verification sign-off
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tableX, y);
      ctx.lineTo(tableX + tableW, y);
      ctx.stroke();

      y += 30;

      ctx.fillStyle = '#475569';
      ctx.font = '13px "Noto Sans Tamil", "Inter", sans-serif';
      ctx.fillText('சமையல் மாஸ்டர் கையொப்பம்: _____________________', tableX + 20, y);
      ctx.fillText('சரிபார்த்தவர்: _____________________', tableX + 460, y);
      ctx.fillText('டெலிவரி நேரம்: _____________________', tableX + 800, y);
    }

    // ─── FOOTER ─────────────────────────────────────────────
    const footerY = PAGE_HEIGHT - 65;
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(45, footerY, PAGE_WIDTH - 90, 1);

    ctx.fillStyle = '#64748B';
    ctx.font = '12px "Noto Sans Tamil", "Inter", sans-serif';
    ctx.fillText(
      `${getBusinessName('ta')}  •  Ph: ${siteConfig.whatsappNumber}  •  சமையல் மாஸ்டர் நகல் (Master Cooking Copy)  •  ${sheet.orderId}`,
      45,
      footerY + 24
    );

    ctx.font = 'bold 12px "Inter", sans-serif';
    ctx.fillStyle = '#EA580C';
    ctx.fillText(`பக்கம் ${pageIdx + 1} / ${totalPages}`, PAGE_WIDTH - 140, footerY + 24);

    // Add canvas to jsPDF
    const pageDataUrl = canvas.toDataURL('image/jpeg', 0.95);
    if (pageIdx > 0) {
      doc.addPage();
    }
    doc.addImage(pageDataUrl, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');

    // Add invisible selectable text layer in jsPDF so text remains searchable/selectable
    try {
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(1);
      doc.text(
        `Order ${sheet.orderId} Customer: ${sheet.customerName} Phone: ${sheet.mobile} Date: ${sheet.orderDate} Items: ${pageItems.map((i) => `${i.dishName} ${i.prepQuantity} ${i.unit}`).join(', ')}`,
        1,
        1
      );
    } catch {
      // safe fallback
    }
  }

  doc.save(`Kanchi-Ambal-Kitchen-Order-${sheet.orderId}.pdf`);
}

/**
 * Main export: generates Kitchen Order Sheet PDF
 * Automatically chooses vector or high-res Tamil unicode based on language preference.
 */
export async function generateKitchenSheetPDF(
  sheet: KitchenOrderSheet,
  language: 'en' | 'ta' | 'both' = 'en'
): Promise<void> {
  if (language === 'en') {
    generateEnglishVectorPDF(sheet);
  } else {
    await generateTamilCanvasPDF(sheet, language === 'both' || language === 'ta');
  }
}
