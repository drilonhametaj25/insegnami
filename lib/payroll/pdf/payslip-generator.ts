import jsPDF from 'jspdf';
import type { Payroll, PayrollLineItem, PayrollWithholding, Teacher, PayrollPeriod, InvoiceSettings } from '@prisma/client';

/**
 * Render the payslip (cedolino) PDF for a Payroll row.
 *
 * Layout: A4 portrait, Italian convention.
 *   - Header strip (school identity from InvoiceSettings)
 *   - Teacher block + period
 *   - Line items table (HOURS rows + extras)
 *   - Withholdings table
 *   - Totals (gross / extras / withholdings / NET)
 *   - Mandatory disclaimer footer:
 *     "Strumento di costing — non sostitutivo di consulente del lavoro
 *      o busta paga ufficiale."
 *   - DRAFT/PAID watermark when applicable
 *
 * Settings are optional: the cedolino remains usable for tenants that
 * haven't completed InvoiceSettings yet (the school identity falls back
 * to the tenant name).
 */
export type PayslipInput = {
  payroll: Payroll;
  lineItems: PayrollLineItem[];
  withholdings: PayrollWithholding[];
  teacher: Pick<Teacher, 'firstName' | 'lastName' | 'teacherCode' | 'email'>;
  period: Pick<PayrollPeriod, 'year' | 'month'>;
  settings: Pick<InvoiceSettings, 'denominazione' | 'partitaIva' | 'indirizzo' | 'cap' | 'comune'> | null;
  tenantName: string;
};

export function buildPayslipPdf(input: PayslipInput): Buffer {
  const { payroll, lineItems, withholdings, teacher, period, settings, tenantName } = input;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  const primary: [number, number, number] = [22, 163, 74];   // green-600 — different from invoice blue
  const text: [number, number, number] = [31, 41, 55];
  const muted: [number, number, number] = [107, 114, 128];
  const lightBg: [number, number, number] = [243, 244, 246];

  const schoolName = settings?.denominazione ?? tenantName;

  // Header
  doc.setFillColor(...primary);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(schoolName.toUpperCase(), margin, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  if (settings) {
    doc.text(`P.IVA ${settings.partitaIva} — ${settings.indirizzo}, ${settings.cap} ${settings.comune}`, margin, 20);
  }

  // Title
  doc.setTextColor(...text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('CEDOLINO COMPENSO', margin, 45);

  // Period
  const monthNames = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`Periodo: ${monthNames[period.month - 1]} ${period.year}`, margin, 53);

  // Teacher block
  const tx = pageWidth / 2 + 5;
  doc.setFillColor(...lightBg);
  doc.roundedRect(tx, 40, pageWidth - tx - margin, 28, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('DOCENTE', tx + 4, 46);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`${teacher.lastName} ${teacher.firstName}`, tx + 4, 52);
  doc.setTextColor(...muted);
  doc.setFontSize(9);
  doc.text(`Codice: ${teacher.teacherCode}`, tx + 4, 58);
  if (teacher.email) doc.text(teacher.email, tx + 4, 63);
  doc.setTextColor(...text);

  // Line items table
  let y = 78;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Compensi', margin, y);
  y += 5;

  doc.setFillColor(...primary);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.rect(margin, y, contentWidth, 8, 'F');
  doc.text('Descrizione', margin + 2, y + 5.5);
  doc.text('Q.tà', margin + 105, y + 5.5, { align: 'right' });
  doc.text('Importo unit.', margin + 130, y + 5.5, { align: 'right' });
  doc.text('Totale', pageWidth - margin - 2, y + 5.5, { align: 'right' });
  y += 8;

  doc.setTextColor(...text);
  doc.setFont('helvetica', 'normal');
  for (const [i, l] of lineItems.entries()) {
    if (i % 2 === 0) {
      doc.setFillColor(...lightBg);
      doc.rect(margin, y, contentWidth, 6, 'F');
    }
    const desc = doc.splitTextToSize(l.description, 88)[0];
    doc.text(desc, margin + 2, y + 4.5);
    doc.text(num(l.quantity ?? 1), margin + 105, y + 4.5, { align: 'right' });
    doc.text('€ ' + num(l.unitAmount), margin + 130, y + 4.5, { align: 'right' });
    doc.text('€ ' + num(l.total), pageWidth - margin - 2, y + 4.5, { align: 'right' });
    y += 6;
    if (y > pageHeight - 80) {
      doc.addPage();
      y = margin;
    }
  }

  // Withholdings
  if (withholdings.length > 0) {
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Ritenute', margin, y);
    y += 5;

    doc.setFillColor(...muted);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.rect(margin, y, contentWidth, 8, 'F');
    doc.text('Voce', margin + 2, y + 5.5);
    doc.text('Aliquota', margin + 110, y + 5.5, { align: 'right' });
    doc.text('Imponibile', margin + 145, y + 5.5, { align: 'right' });
    doc.text('Importo', pageWidth - margin - 2, y + 5.5, { align: 'right' });
    y += 8;

    doc.setTextColor(...text);
    doc.setFont('helvetica', 'normal');
    for (const w of withholdings) {
      doc.text(w.label, margin + 2, y + 4.5);
      doc.text(num(w.rate) + '%', margin + 110, y + 4.5, { align: 'right' });
      doc.text('€ ' + num(w.base), margin + 145, y + 4.5, { align: 'right' });
      doc.text('-€ ' + num(w.amount), pageWidth - margin - 2, y + 4.5, { align: 'right' });
      y += 6;
    }
  }

  // Totals
  y += 8;
  const totalsX = pageWidth - margin - 70;
  doc.setDrawColor(...muted);
  doc.line(totalsX, y, pageWidth - margin, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.text('Compenso lordo:', totalsX, y);
  doc.text('€ ' + num(payroll.grossBase), pageWidth - margin, y, { align: 'right' });
  if (Number(payroll.extrasTotal) !== 0) {
    y += 6;
    doc.text('Voci aggiuntive:', totalsX, y);
    doc.text('€ ' + num(payroll.extrasTotal), pageWidth - margin, y, { align: 'right' });
  }
  if (Number(payroll.withholdingsTotal) !== 0) {
    y += 6;
    doc.text('Totale ritenute:', totalsX, y);
    doc.text('-€ ' + num(payroll.withholdingsTotal), pageWidth - margin, y, { align: 'right' });
  }
  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('NETTO:', totalsX, y);
  doc.text('€ ' + num(payroll.netAmount), pageWidth - margin, y, { align: 'right' });

  // Status watermark
  if (payroll.status === 'DRAFT') {
    doc.setTextColor(220, 38, 38);
    doc.setFontSize(72);
    doc.setFont('helvetica', 'bold');
    doc.text('BOZZA', pageWidth / 2, pageHeight / 2, { align: 'center', angle: 35 });
  } else if (payroll.status === 'PAID') {
    doc.setTextColor(22, 163, 74);
    doc.setFontSize(60);
    doc.setFont('helvetica', 'bold');
    doc.text('PAGATO', pageWidth / 2, pageHeight / 2, { align: 'center', angle: 35 });
  }

  // Mandatory disclaimer
  doc.setTextColor(...muted);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  const disclaimer =
    "Documento generato da InsegnaMi.pro come strumento di costing. " +
    "Non sostituisce la busta paga ufficiale predisposta da consulente del lavoro o studio paghe.";
  const wrap = doc.splitTextToSize(disclaimer, contentWidth);
  doc.text(wrap, margin, pageHeight - 14);

  return Buffer.from(doc.output('arraybuffer'));
}

function num(v: any): string {
  return Number(v).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
