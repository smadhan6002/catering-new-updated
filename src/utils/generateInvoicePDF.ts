/**
 * generateInvoicePDF — generates and downloads a professional catering invoice PDF
 * Uses jsPDF + jspdf-autotable
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Order } from '../types/admin';
import type { Invoice } from '../types/admin';
import { siteConfig, getBusinessName } from '../config/site';

import { normalizeOrderPayments, getOrderTotalPaid, getOrderBalanceDue, getOrderPaymentStatus } from '../services/orderService';

function formatDate(isoDate: string): string {
  if (!isoDate) return '';
  const d = new Date(isoDate.includes('T') ? isoDate : isoDate + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

// jsPDF Helvetica does NOT support the Rs. symbol — use "Rs." text instead
function inr(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-IN')}`;
}

export function generateInvoicePDF(order: Order, invoice: Invoice, lang: 'en' | 'ta' = 'en'): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const bizName = getBusinessName(lang);

  const primaryColor: [number, number, number] = [234, 88, 12]; // #EA580C Primary Orange
  const darkColor: [number, number, number] = [30, 41, 59];     // #1E293B Body Text
  const lightGray: [number, number, number] = [255, 247, 237];  // #FFF7ED Light Orange
  const borderGray: [number, number, number] = [254, 215, 170]; // #FED7AA Light Border

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  let y = 0;

  // ─── HEADER BAND ───────────────────────────────────────
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageW, 34, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(bizName, 14, 13);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Ph: ${siteConfig.whatsappNumber}`, 14, 21);
  doc.text('Professional Catering Services', 14, 28);

  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', pageW - 14, 20, { align: 'right' });

  y = 44;

  // ─── META + BILL TO (2 columns) ──────────────────────────
  doc.setTextColor(...darkColor);
  doc.setFontSize(9);

  const metaLeft = 14;
  const metaRight = pageW / 2 + 8;
  const colLabelW = 28;

  const leftRows = [
    ['Invoice No :', invoice.id],
    ['Order ID   :', order.id],
    ['Invoice Date:', formatDate(invoice.generatedAt)],
    ['Order Date  :', formatDate(order.orderDate)],
  ];

  for (let i = 0; i < leftRows.length; i++) {
    doc.setFont('helvetica', 'bold');
    doc.text(leftRows[i][0], metaLeft, y + i * 7);
    doc.setFont('helvetica', 'normal');
    doc.text(leftRows[i][1], metaLeft + colLabelW + 2, y + i * 7);
  }

  // Bill To
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('BILL TO', metaRight, y);
  doc.setTextColor(...darkColor);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(order.customerName, metaRight, y + 8);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Mobile  : ${order.mobile}`, metaRight, y + 16);
  if (order.eventType) {
    doc.text(`Event   : ${order.eventType}`, metaRight, y + 23);
  }
  if (order.eventAddress) {
    const wrapped = doc.splitTextToSize(`Address : ${order.eventAddress}`, pageW - metaRight - 14);
    doc.text(wrapped, metaRight, y + (order.eventType ? 30 : 23));
  }
  if (order.guestCount) {
    doc.text(`Guests  : ${order.guestCount}`, metaRight, y + 38);
  }

  y += 40;

  // ─── DIVIDER ──────────────────────────────────────────
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.5);
  doc.line(14, y, pageW - 14, y);
  y += 7;

  // ─── SECTION TITLE ─────────────────────────────────────
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('ITEMS ORDERED', 14, y);
  y += 4;

  // ─── ITEMS TABLE ───────────────────────────────────────
  const tableBody = order.items.map((item, i) => [
    String(i + 1),
    item.dishName,
    item.categoryId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
  ]);

  autoTable(doc, {
    startY: y,
    head: [['#', 'Dish Name', 'Category']],
    body: tableBody,
    theme: 'striped',
    showHead: 'everyPage',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: 2.5,
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 2,
      textColor: darkColor,
    },
    alternateRowStyles: { fillColor: lightGray },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 55 },
    },
    margin: { left: 14, right: 14 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 6;

  // ─── PAYMENT SUMMARY BOX WITH MULTIPLE INSTALLMENTS ───
  const payments = normalizeOrderPayments(order);
  const totalPaid = getOrderTotalPaid(order);
  const remaining = getOrderBalanceDue(order);
  const status = getOrderPaymentStatus(order).toUpperCase();

  const boxW = 104;
  const boxX = pageW - 14 - boxW;
  const rowH = 7;

  const payRows: [string, string][] = [
    ['Total Amount', inr(order.totalAmount)],
  ];

  payments.forEach((p, idx) => {
    const dStr = p.date ? new Date(p.date + (p.date.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
    const label = `Pay #${idx + 1} (${p.method}${dStr ? ' · ' + dStr : ''})`;
    payRows.push([label, inr(p.amount)]);
  });

  payRows.push(['Total Paid', inr(totalPaid)]);
  payRows.push(['Balance Due', inr(remaining)]);

  const boxH = 14 + payRows.length * rowH + 12;

  // Add page if not enough space
  if (y + boxH > pageH - 18) {
    doc.addPage();
    y = 16;
  }

  // Box background
  doc.setFillColor(...lightGray);
  doc.setDrawColor(...borderGray);
  doc.setLineWidth(0.4);
  doc.roundedRect(boxX, y, boxW, boxH, 2, 2, 'FD');

  // Box header stripe
  doc.setFillColor(...primaryColor);
  doc.roundedRect(boxX, y, boxW, 10, 2, 2, 'F');
  doc.rect(boxX, y + 5, boxW, 5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('PAYMENT SUMMARY', boxX + boxW / 2, y + 7, { align: 'center' });

  const lx = boxX + 5;
  const rx = boxX + boxW - 5;
  let ry = y + 17;

  doc.setTextColor(...darkColor);
  doc.setFontSize(8.5);
  for (const [label, val] of payRows) {
    const isHighlight = label === 'Total Amount' || label === 'Total Paid' || label === 'Balance Due';
    doc.setFont('helvetica', isHighlight ? 'bold' : 'normal');
    doc.text(label, lx, ry);
    doc.setFont('helvetica', 'bold');
    doc.text(val, rx, ry, { align: 'right' });
    doc.setDrawColor(...borderGray);
    doc.setLineWidth(0.15);
    doc.line(lx, ry + 2, rx, ry + 2);
    ry += rowH;
  }

  // Status badge
  const badgeColor: [number, number, number] =
    remaining <= 0 && order.totalAmount > 0 ? [22, 163, 74] : totalPaid > 0 ? [234, 88, 12] : [220, 38, 38];
  doc.setFillColor(...badgeColor);
  doc.roundedRect(lx, ry + 1, boxW - 10, 8.5, 1.5, 1.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(status, lx + (boxW - 10) / 2, ry + 6.5, { align: 'center' });

  // ─── NOTES (left of payment box) ────────────────────────
  if (order.notes && order.notes.trim()) {
    const notesW = boxX - metaLeft - 8;
    doc.setTextColor(...darkColor);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text('Notes:', metaLeft, y + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const wrapped = doc.splitTextToSize(order.notes, notesW);
    doc.text(wrapped, metaLeft, y + 16);
  }

  y = y + boxH + 12;

  // ─── THANK YOU ───────────────────────────────────────────
  if (y < pageH - 30) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(120, 120, 120);
    doc.text('Thank you for your business! We wish you a wonderful event.', metaLeft, y);
  }

  // ─── FOOTER BAND ────────────────────────────────────────
  const footerY = pageH - 12;
  doc.setFillColor(...primaryColor);
  doc.rect(0, footerY - 3, pageW, 15, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `${bizName}  |  Ph: ${siteConfig.whatsappNumber}  |  Generated: ${new Date().toLocaleDateString('en-IN')}`,
    pageW / 2,
    footerY + 4,
    { align: 'center' }
  );

  // ─── SAVE ───────────────────────────────────────────────
  doc.save(`Kanchi-Ambal-Invoice-${invoice.id}.pdf`);
}
