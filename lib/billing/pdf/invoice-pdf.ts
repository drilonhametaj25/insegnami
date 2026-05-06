import jsPDF from 'jspdf';
import type {
  Invoice,
  InvoiceLine,
  InvoiceCustomerProfile,
  InvoiceSettings,
} from '@prisma/client';
import { formatInvoiceNumber } from '@/lib/billing/invoice-numbering';

/**
 * Generate the human-readable invoice PDF.
 *
 * Layout: A4 portrait, Italian convention.
 *  - Header: school identity (CedentePrestatore)
 *  - Customer block (CessionarioCommittente) on the right
 *  - Invoice metadata strip (numero/data/tipo)
 *  - Line items table
 *  - Totals + IVA breakdown
 *  - Footer with payment instructions
 *
 * The PDF is for the customer; SDI receives the XML separately. We don't
 * try to be 100% faithful to FatturaPA — readability wins.
 *
 * Status visualization: when invoice.status !== ISSUED/PAID/SENT/ACCEPTED
 * we overlay a diagonal "BOZZA" / "ANNULLATA" watermark so customers
 * never accidentally pay against a draft.
 */
export type InvoicePdfInput = {
  invoice: Invoice;
  lines: InvoiceLine[];
  customer: InvoiceCustomerProfile;
  settings: InvoiceSettings;
  seriesPrefix: string | null;
};

export function buildInvoicePdf(input: InvoicePdfInput): Buffer {
  const { invoice, lines, customer, settings, seriesPrefix } = input;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  const primary: [number, number, number] = [37, 99, 235];   // blue-600
  const text: [number, number, number] = [31, 41, 55];       // gray-800
  const muted: [number, number, number] = [107, 114, 128];   // gray-500
  const lightBg: [number, number, number] = [243, 244, 246]; // gray-100

  // ---- Header strip ----
  doc.setFillColor(...primary);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(settings.denominazione.toUpperCase(), margin, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`P.IVA ${settings.partitaIva} — ${settings.indirizzo}, ${settings.cap} ${settings.comune}`, margin, 20);
  doc.text(`${settings.email ?? ''}${settings.telefono ? `   Tel. ${settings.telefono}` : ''}`, margin, 25);

  // ---- Document title ----
  doc.setTextColor(...text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  const title = invoice.documentType === 'TD04' ? 'NOTA DI CREDITO' : 'FATTURA';
  doc.text(title, margin, 45);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const formattedNumber = invoice.number > 0
    ? formatInvoiceNumber(seriesPrefix, invoice.year, invoice.number)
    : 'BOZZA — non ancora emessa';
  doc.text(`Numero: ${formattedNumber}`, margin, 53);
  doc.text(`Data: ${invoice.issueDate.toLocaleDateString('it-IT')}`, margin, 59);
  doc.text(`Tipo documento: ${invoice.documentType}`, margin, 65);

  // ---- Customer block (right side) ----
  const custX = pageWidth / 2 + 5;
  doc.setFillColor(...lightBg);
  doc.roundedRect(custX, 40, pageWidth - custX - margin, 38, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('INTESTATARIO', custX + 4, 46);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const customerName = customer.denominazione
    ?? `${customer.nome ?? ''} ${customer.cognome ?? ''}`.trim()
    ?? '-';
  doc.text(customerName, custX + 4, 52);
  doc.setTextColor(...muted);
  doc.setFontSize(9);
  doc.text(customer.indirizzo, custX + 4, 58);
  doc.text(`${customer.cap} ${customer.comune}${customer.provincia ? ' (' + customer.provincia + ')' : ''}`, custX + 4, 63);
  if (customer.partitaIva) doc.text(`P.IVA: ${customer.partitaIva}`, custX + 4, 68);
  if (customer.codiceFiscale) doc.text(`CF: ${customer.codiceFiscale}`, custX + 4, customer.partitaIva ? 73 : 68);
  doc.setTextColor(...text);

  // ---- Lines table ----
  let y = 85;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(...primary);
  doc.setTextColor(255, 255, 255);
  doc.rect(margin, y, contentWidth, 8, 'F');

  // columns: Descrizione | Q.tà | Prezzo | Sconto | IVA | Totale
  const cols = [
    { x: margin + 2, w: 90, label: 'Descrizione', align: 'left' as const },
    { x: margin + 92, w: 18, label: 'Q.tà', align: 'right' as const },
    { x: margin + 110, w: 24, label: 'Prezzo', align: 'right' as const },
    { x: margin + 134, w: 16, label: 'Sconto', align: 'right' as const },
    { x: margin + 150, w: 14, label: 'IVA', align: 'right' as const },
    { x: margin + 164, w: contentWidth - 162, label: 'Totale', align: 'right' as const },
  ];
  cols.forEach((c) => {
    doc.text(c.label, c.align === 'right' ? c.x + c.w : c.x, y + 5.5, { align: c.align });
  });
  y += 8;

  doc.setTextColor(...text);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  const sortedLines = [...lines].sort((a, b) => a.lineNumber - b.lineNumber);
  for (const [i, line] of sortedLines.entries()) {
    if (i % 2 === 0) {
      doc.setFillColor(...lightBg);
      doc.rect(margin, y, contentWidth, 7, 'F');
    }
    const desc = doc.splitTextToSize(line.description, cols[0].w)[0]; // truncate to 1 line
    doc.text(desc, cols[0].x, y + 5);
    doc.text(num(line.quantity), cols[1].x + cols[1].w, y + 5, { align: 'right' });
    doc.text('€ ' + num(line.unitPrice), cols[2].x + cols[2].w, y + 5, { align: 'right' });
    doc.text(line.discountPercent ? num(line.discountPercent) + '%' : '-', cols[3].x + cols[3].w, y + 5, { align: 'right' });
    doc.text(num(line.vatRate) + '%', cols[4].x + cols[4].w, y + 5, { align: 'right' });
    doc.text('€ ' + num(line.total), cols[5].x + cols[5].w, y + 5, { align: 'right' });
    y += 7;
    if (y > pageHeight - 60) {
      doc.addPage();
      y = margin;
    }
  }

  // ---- Totals ----
  y += 8;
  const totalsX = pageWidth - margin - 70;
  doc.setDrawColor(...muted);
  doc.line(totalsX, y, pageWidth - margin, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.text('Imponibile:', totalsX, y);
  doc.text('€ ' + num(invoice.subtotal), pageWidth - margin, y, { align: 'right' });
  y += 6;
  doc.text('IVA:', totalsX, y);
  doc.text('€ ' + num(invoice.vatTotal), pageWidth - margin, y, { align: 'right' });
  if (Number(invoice.withholdingTotal) !== 0) {
    y += 6;
    doc.text('Ritenuta:', totalsX, y);
    doc.text('-€ ' + num(invoice.withholdingTotal), pageWidth - margin, y, { align: 'right' });
  }
  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('TOTALE:', totalsX, y);
  doc.text('€ ' + num(invoice.total), pageWidth - margin, y, { align: 'right' });

  // ---- Payment block ----
  if (invoice.paymentMethod || invoice.paymentTerms) {
    y += 14;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Modalità di pagamento', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    if (invoice.paymentMethod) {
      y += 5;
      doc.text(`Codice SDI: ${invoice.paymentMethod}`, margin, y);
    }
  }

  // ---- Watermark for non-issued ----
  const draftStates = ['DRAFT', 'CANCELLED', 'REJECTED'] as const;
  if ((draftStates as readonly string[]).includes(invoice.status)) {
    doc.setTextColor(220, 38, 38);
    doc.setFontSize(72);
    doc.setFont('helvetica', 'bold');
    const watermark = invoice.status === 'CANCELLED' ? 'ANNULLATA'
      : invoice.status === 'REJECTED' ? 'SCARTATA'
      : 'BOZZA';
    doc.text(watermark, pageWidth / 2, pageHeight / 2, { align: 'center', angle: 35 });
  }

  // ---- Footer ----
  doc.setTextColor(...muted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    `Documento generato automaticamente. Per assistenza: ${settings.email ?? ''}`,
    pageWidth / 2,
    pageHeight - 8,
    { align: 'center' },
  );

  return Buffer.from(doc.output('arraybuffer'));
}

function num(v: any): string {
  return Number(v).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
