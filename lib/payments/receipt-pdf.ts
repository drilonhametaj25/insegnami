import jsPDF from 'jspdf';

/**
 * PDF ricevuta di pagamento — stesso stile di lib/billing/pdf/invoice-pdf.ts
 * ma volutamente più asciutto: la ricevuta NON è un documento fiscale
 * (per quello ci sono le fatture), è la prova di incasso per la famiglia.
 */
export type PaymentReceiptPdfInput = {
  receiptNumber: string; // es. REC-2026-0012
  school: {
    name: string;
    address?: string | null;
    email?: string | null;
    phone?: string | null;
    vatNumber?: string | null;
  };
  student: {
    firstName: string;
    lastName: string;
    studentCode?: string | null;
  };
  payment: {
    description: string;
    amount: unknown;
    currency?: string | null;
    paidDate?: Date | null;
    paymentMethod?: string | null;
    reference?: string | null;
    className?: string | null;
  };
};

export function buildPaymentReceiptPdf(input: PaymentReceiptPdfInput): Buffer {
  const { receiptNumber, school, student, payment } = input;

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
  doc.text(school.name.toUpperCase(), margin, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const headerLine = [
    school.vatNumber ? `P.IVA ${school.vatNumber}` : null,
    school.address ?? null,
  ].filter(Boolean).join(' — ');
  if (headerLine) doc.text(headerLine, margin, 20);
  const contactLine = [school.email, school.phone ? `Tel. ${school.phone}` : null]
    .filter(Boolean).join('   ');
  if (contactLine) doc.text(contactLine, margin, 25);

  // ---- Title ----
  doc.setTextColor(...text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('RICEVUTA DI PAGAMENTO', margin, 45);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`Numero: ${receiptNumber}`, margin, 53);
  const paidDate = payment.paidDate ?? new Date();
  doc.text(`Data pagamento: ${paidDate.toLocaleDateString('it-IT')}`, margin, 59);

  // ---- Student block ----
  const custX = pageWidth / 2 + 5;
  doc.setFillColor(...lightBg);
  doc.roundedRect(custX, 40, pageWidth - custX - margin, 26, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('INTESTATA A', custX + 4, 46);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`${student.firstName} ${student.lastName}`, custX + 4, 52);
  doc.setTextColor(...muted);
  doc.setFontSize(9);
  if (student.studentCode) doc.text(`Codice studente: ${student.studentCode}`, custX + 4, 58);
  doc.setTextColor(...text);

  // ---- Detail table ----
  let y = 80;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(...primary);
  doc.setTextColor(255, 255, 255);
  doc.rect(margin, y, contentWidth, 8, 'F');
  doc.text('Descrizione', margin + 2, y + 5.5);
  doc.text('Importo', pageWidth - margin - 2, y + 5.5, { align: 'right' });
  y += 8;

  doc.setTextColor(...text);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setFillColor(...lightBg);
  doc.rect(margin, y, contentWidth, 8, 'F');
  const desc = doc.splitTextToSize(payment.description, contentWidth - 50)[0];
  doc.text(desc, margin + 2, y + 5.5);
  doc.text(`€ ${num(payment.amount)}`, pageWidth - margin - 2, y + 5.5, { align: 'right' });
  y += 12;

  if (payment.className) {
    doc.setTextColor(...muted);
    doc.setFontSize(9);
    doc.text(`Classe/Corso: ${payment.className}`, margin + 2, y);
    y += 5;
  }
  if (payment.paymentMethod) {
    doc.setTextColor(...muted);
    doc.setFontSize(9);
    doc.text(`Metodo di pagamento: ${payment.paymentMethod}`, margin + 2, y);
    y += 5;
  }
  if (payment.reference) {
    doc.setTextColor(...muted);
    doc.setFontSize(9);
    doc.text(`Riferimento: ${payment.reference}`, margin + 2, y);
    y += 5;
  }

  // ---- Total ----
  y += 10;
  const totalsX = pageWidth - margin - 70;
  doc.setDrawColor(...muted);
  doc.line(totalsX, y, pageWidth - margin, y);
  y += 8;
  doc.setTextColor(...text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('TOTALE INCASSATO:', totalsX, y);
  doc.text(`€ ${num(payment.amount)}`, pageWidth - margin, y, { align: 'right' });

  // ---- Footer ----
  doc.setTextColor(...muted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    'Ricevuta generata automaticamente. Non valida ai fini fiscali (non sostituisce la fattura).',
    pageWidth / 2,
    pageHeight - 8,
    { align: 'center' },
  );

  return Buffer.from(doc.output('arraybuffer'));
}

function num(v: any): string {
  return Number(v).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
