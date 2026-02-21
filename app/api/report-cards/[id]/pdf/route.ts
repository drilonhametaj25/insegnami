import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import jsPDF from 'jspdf';

// GET /api/report-cards/[id]/pdf - Generate PDF for report card
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Fetch report card with all details
    const reportCard = await prisma.reportCard.findFirst({
      where: {
        id,
        ...(session.user.role !== 'SUPERADMIN' ? { tenantId: session.user.tenantId } : {}),
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentCode: true,
            dateOfBirth: true,
          },
        },
        class: {
          select: {
            id: true,
            name: true,
            code: true,
            course: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        period: {
          select: {
            id: true,
            name: true,
            type: true,
            startDate: true,
            endDate: true,
            academicYear: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        entries: {
          include: {
            subject: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
          orderBy: {
            subjectId: 'asc',
          },
        },
      },
    });

    if (!reportCard) {
      return NextResponse.json({ error: 'Pagella non trovata' }, { status: 404 });
    }

    // Access control - students/parents can only download PUBLISHED
    if (session.user.role === 'STUDENT') {
      const student = await prisma.student.findFirst({
        where: { userId: session.user.id },
      });
      if (!student || student.id !== reportCard.studentId) {
        return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
      }
      if (reportCard.status !== 'PUBLISHED') {
        return NextResponse.json({ error: 'Pagella non ancora pubblicata' }, { status: 403 });
      }
    } else if (session.user.role === 'PARENT') {
      const child = await prisma.student.findFirst({
        where: { parentUserId: session.user.id },
      });
      if (!child || child.id !== reportCard.studentId) {
        return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
      }
      if (reportCard.status !== 'PUBLISHED') {
        return NextResponse.json({ error: 'Pagella non ancora pubblicata' }, { status: 403 });
      }
    }

    // Generate PDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;

    // Colors
    const primaryColor: [number, number, number] = [59, 130, 246]; // Blue
    const textColor: [number, number, number] = [31, 41, 55]; // Gray-800
    const lightGray: [number, number, number] = [243, 244, 246]; // Gray-100

    // Header - School Name
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 35, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(reportCard.tenant.name.toUpperCase(), pageWidth / 2, 15, { align: 'center' });

    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text('PAGELLA SCOLASTICA', pageWidth / 2, 25, { align: 'center' });

    // Period info
    doc.setFontSize(11);
    doc.text(
      `${reportCard.period.name} - Anno Scolastico ${reportCard.period.academicYear.name}`,
      pageWidth / 2,
      32,
      { align: 'center' }
    );

    // Student Info Box
    let y = 45;
    doc.setTextColor(...textColor);
    doc.setFillColor(...lightGray);
    doc.roundedRect(margin, y, contentWidth, 30, 3, 3, 'F');

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    y += 8;
    doc.text('DATI STUDENTE', margin + 5, y);

    doc.setFont('helvetica', 'normal');
    y += 7;
    doc.text(`Cognome e Nome: ${reportCard.student.lastName} ${reportCard.student.firstName}`, margin + 5, y);

    y += 7;
    const dateOfBirth = reportCard.student.dateOfBirth
      ? new Date(reportCard.student.dateOfBirth).toLocaleDateString('it-IT')
      : '-';
    doc.text(`Data di nascita: ${dateOfBirth}`, margin + 5, y);
    doc.text(`Classe: ${reportCard.class.name}`, margin + 100, y);

    // Grades Table
    y += 20;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('VALUTAZIONI', margin, y);

    y += 5;

    // Table headers
    const colWidths = [55, 25, 25, 25, 25, 15]; // Subject, Oral, Written, Practical, Overall, Final
    const headers = ['Materia', 'Orale', 'Scritto', 'Pratico', 'Media', 'Voto'];

    // Draw header row
    doc.setFillColor(...primaryColor);
    doc.rect(margin, y, contentWidth, 8, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');

    let x = margin + 2;
    headers.forEach((header, i) => {
      doc.text(header, x, y + 5.5);
      x += colWidths[i];
    });

    y += 8;

    // Draw data rows
    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'normal');

    reportCard.entries.forEach((entry, index) => {
      // Alternate row background
      if (index % 2 === 0) {
        doc.setFillColor(...lightGray);
        doc.rect(margin, y, contentWidth, 7, 'F');
      }

      x = margin + 2;

      // Subject name
      doc.text(entry.subject.name.substring(0, 20), x, y + 5);
      x += colWidths[0];

      // Oral average
      const oral = entry.averageOral ? Number(entry.averageOral).toFixed(1) : '-';
      doc.text(oral, x, y + 5);
      x += colWidths[1];

      // Written average
      const written = entry.averageWritten ? Number(entry.averageWritten).toFixed(1) : '-';
      doc.text(written, x, y + 5);
      x += colWidths[2];

      // Practical average
      const practical = entry.averagePractical ? Number(entry.averagePractical).toFixed(1) : '-';
      doc.text(practical, x, y + 5);
      x += colWidths[3];

      // Overall average
      const overall = entry.overallAverage ? Number(entry.overallAverage).toFixed(2) : '-';
      doc.text(overall, x, y + 5);
      x += colWidths[4];

      // Final grade with color coding
      const finalGrade = Number(entry.finalGrade);
      if (finalGrade < 6) {
        doc.setTextColor(220, 38, 38); // Red
      } else if (finalGrade === 6) {
        doc.setTextColor(217, 119, 6); // Yellow/Orange
      } else {
        doc.setTextColor(22, 163, 74); // Green
      }
      doc.setFont('helvetica', 'bold');
      doc.text(finalGrade.toFixed(0), x, y + 5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...textColor);

      y += 7;
    });

    // Draw table border
    doc.setDrawColor(200, 200, 200);
    doc.rect(margin, y - (reportCard.entries.length * 7) - 8, contentWidth, (reportCard.entries.length * 7) + 8);

    // Behavior and overall comment
    y += 10;

    // Behavior grade
    if (reportCard.behaviorGrade) {
      doc.setFillColor(...lightGray);
      doc.roundedRect(margin, y, contentWidth / 2 - 5, 15, 2, 2, 'F');

      doc.setFont('helvetica', 'bold');
      doc.text('COMPORTAMENTO', margin + 5, y + 6);
      doc.setFont('helvetica', 'normal');
      doc.text(reportCard.behaviorGrade, margin + 5, y + 12);
    }

    // Overall comment
    y += 20;
    if (reportCard.overallComment) {
      doc.setFont('helvetica', 'bold');
      doc.text('GIUDIZIO GLOBALE', margin, y);

      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);

      // Word wrap for long comments
      const splitComment = doc.splitTextToSize(reportCard.overallComment, contentWidth);
      doc.text(splitComment, margin, y + 5);

      y += splitComment.length * 5 + 10;
    }

    // Footer
    const footerY = 270;

    // Approval info
    if (reportCard.approvedAt) {
      doc.setFontSize(9);
      doc.text(
        `Approvato il: ${new Date(reportCard.approvedAt).toLocaleDateString('it-IT')}`,
        margin,
        footerY
      );
    }

    // Signature line
    doc.setFontSize(10);
    doc.line(pageWidth - margin - 50, footerY + 5, pageWidth - margin, footerY + 5);
    doc.setFontSize(8);
    doc.text('Il Dirigente Scolastico', pageWidth - margin - 25, footerY + 10, { align: 'center' });

    // Status watermark for non-published
    if (reportCard.status !== 'PUBLISHED') {
      doc.setTextColor(200, 200, 200);
      doc.setFontSize(60);
      doc.setFont('helvetica', 'bold');
      doc.text('BOZZA', pageWidth / 2, 150, {
        align: 'center',
        angle: 45,
      });
    }

    // Generate filename
    const filename = `pagella_${reportCard.student.lastName}_${reportCard.student.firstName}_${reportCard.period.name.replace(/\s/g, '_')}.pdf`;

    // Convert to buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    // Update report card with generation timestamp
    await prisma.reportCard.update({
      where: { id },
      data: {
        generatedAt: new Date(),
      },
    });

    // Return PDF
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Report card PDF generation error:', error);
    return NextResponse.json(
      { error: 'Errore nella generazione del PDF' },
      { status: 500 }
    );
  }
}
