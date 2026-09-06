import { NextRequest, NextResponse } from 'next/server';
import { isAdminRole } from '@/lib/auth';
import { requireAuth, authError, getTeacherIdForUser } from '@/lib/api-auth';
import { prisma } from '@/lib/db';

// Riga normalizzata condivisa dai tre formati (csv/xlsx/pdf).
// I contatti genitore sono presenti solo quando canSeeParentContacts.
type ExportRow = {
  date: string;
  student: string;
  studentCode: string;
  studentEmail: string;
  parent: string;
  parentEmail?: string;
  parentPhone?: string;
  className: string;
  courseName: string;
  teacher: string;
  lessonTitle: string;
  status: string;
  notes: string;
  recordedAt: string;
};

function buildRows(records: any[], canSeeParentContacts: boolean): ExportRow[] {
  return records.map((record: any) => {
    const student = record.student;
    const studentUser = student.user;
    const parentUser = student.parentUser;
    const lesson = record.lesson;
    const teacher = lesson.teacher;
    const classInfo = lesson.class;

    return {
      date: lesson.startTime ? new Date(lesson.startTime).toLocaleDateString('it-IT') : '',
      student: `${studentUser?.firstName || ''} ${studentUser?.lastName || ''}`.trim(),
      studentCode: student.studentCode || '',
      studentEmail: studentUser?.email || '',
      parent: parentUser ? `${parentUser.firstName} ${parentUser.lastName}` : '',
      ...(canSeeParentContacts
        ? {
            parentEmail: parentUser?.email || '',
            parentPhone: parentUser?.phone || '',
          }
        : {}),
      className: classInfo?.name || '',
      courseName: classInfo?.course?.name || '',
      teacher: teacher ? `${teacher.firstName} ${teacher.lastName}` : '',
      lessonTitle: lesson.title || '',
      status: record.status,
      notes: record.notes || '',
      recordedAt: new Date(record.createdAt).toLocaleString('it-IT'),
    };
  });
}

// Intestazioni coerenti tra i formati; le colonne genitore sono gated.
function buildHeaders(canSeeParentContacts: boolean): { key: keyof ExportRow; label: string }[] {
  return [
    { key: 'date', label: 'Date' },
    { key: 'student', label: 'Student' },
    { key: 'studentCode', label: 'Student Code' },
    { key: 'studentEmail', label: 'Student Email' },
    { key: 'parent', label: 'Parent' },
    ...(canSeeParentContacts
      ? ([
          { key: 'parentEmail', label: 'Parent Email' },
          { key: 'parentPhone', label: 'Parent Phone' },
        ] as { key: keyof ExportRow; label: string }[])
      : []),
    { key: 'className', label: 'Class' },
    { key: 'courseName', label: 'Course' },
    { key: 'teacher', label: 'Teacher' },
    { key: 'lessonTitle', label: 'Lesson Title' },
    { key: 'status', label: 'Status' },
    { key: 'notes', label: 'Notes' },
    { key: 'recordedAt', label: 'Recorded At' },
  ];
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuth({ permission: { action: 'export', resource: 'attendance' } });

    // I contatti del genitore (email/telefono) sono PII riservate ai ruoli
    // amministrativi: per i TEACHER non vengono né letti dal DB né esportati.
    const canSeeParentContacts = isAdminRole(ctx.role);

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv';
    const classId = searchParams.get('classId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');

    // Tenant scope lives on Lesson (Attendance has no tenantId field).
    // Without this, the previous `where.tenantId = ...` was a silent no-op
    // and would have leaked attendance across tenants the moment the
    // include/select changed.
    const where: any = {
      lesson: {
        tenantId: ctx.tenantId,
        ...(classId ? { classId } : {}),
      },
    };

    // I docenti esportano solo le presenze delle proprie lezioni (deny se il
    // profilo Teacher non risolve)
    if (ctx.role === 'TEACHER') {
      const teacherId = await getTeacherIdForUser(ctx);
      if (!teacherId) {
        return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
      }
      where.lesson.teacherId = teacherId;
    }

    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    if (status) {
      where.status = status;
    }

    const attendanceRecords = await prisma.attendance.findMany({
      where,
      include: {
        student: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            parentUser: {
              select: {
                firstName: true,
                lastName: true,
                // Email/telefono solo per i ruoli amministrativi
                ...(canSeeParentContacts ? { email: true, phone: true } : {}),
              },
            },
          },
        },
        lesson: {
          include: {
            class: {
              select: {
                name: true,
                code: true,
                course: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            teacher: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      } as any,
      orderBy: [
        { createdAt: 'desc' },
        { lesson: { startTime: 'desc' } },
      ],
    });

    const today = new Date().toISOString().split('T')[0];
    const headers = buildHeaders(canSeeParentContacts);
    const rows = buildRows(attendanceRecords, canSeeParentContacts);

    if (format === 'csv') {
      const csvHeader = headers.map((h) => h.label).join(',') + '\n';
      const csvData = rows
        .map((row) =>
          headers
            .map((h) => {
              const value = String(row[h.key] ?? '');
              // Quotatura sistematica: nomi/note/date it-IT contengono virgole
              return /[",\n]/.test(value) || h.key !== 'status'
                ? `"${value.replace(/"/g, '""')}"`
                : value;
            })
            .join(',')
        )
        .join('\n');

      // BOM forces Excel (in IT locale) to read the file as UTF-8 instead of
      // the system codepage — without it accents in names render as mojibake.
      const csv = '﻿' + csvHeader + csvData;

      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="attendance-export-${today}.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    if (format === 'xlsx') {
      // Import dinamico: exceljs pesa ~1MB, caricato solo quando serve
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Presenze');

      sheet.columns = headers.map((h) => ({
        header: h.label,
        key: h.key,
        width: Math.max(14, h.label.length + 4),
      }));
      sheet.getRow(1).font = { bold: true };

      for (const row of rows) {
        sheet.addRow(row);
      }

      const buffer = await workbook.xlsx.writeBuffer();

      return new Response(buffer as any, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="attendance-export-${today}.xlsx"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    if (format === 'pdf') {
      // Pattern jsPDF di lib/billing/pdf/invoice-pdf.ts: A4 landscape,
      // tabella disegnata a mano con paginazione.
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;

      // Colonne compatte per stare in pagina (le note escono dal PDF)
      const pdfCols: { key: keyof ExportRow; label: string; width: number }[] = [
        { key: 'date', label: 'Data', width: 22 },
        { key: 'student', label: 'Studente', width: 42 },
        { key: 'studentCode', label: 'Codice', width: 18 },
        { key: 'parent', label: 'Genitore', width: 38 },
        { key: 'className', label: 'Classe', width: 30 },
        { key: 'teacher', label: 'Docente', width: 38 },
        { key: 'lessonTitle', label: 'Lezione', width: 60 },
        { key: 'status', label: 'Stato', width: 24 },
      ];

      const drawHeader = (y: number): number => {
        doc.setFillColor(37, 99, 235);
        doc.rect(margin, y, pageWidth - margin * 2, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        let x = margin + 2;
        for (const col of pdfCols) {
          doc.text(col.label, x, y + 5.5);
          x += col.width;
        }
        doc.setTextColor(31, 41, 55);
        doc.setFont('helvetica', 'normal');
        return y + 10;
      };

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('Export Presenze', margin, 12);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Generato il ${new Date().toLocaleDateString('it-IT')} — ${rows.length} record`, margin, 18);

      let y = drawHeader(24);
      doc.setFontSize(7.5);

      for (const row of rows) {
        if (y > pageHeight - 12) {
          doc.addPage();
          y = drawHeader(12);
          doc.setFontSize(7.5);
        }
        let x = margin + 2;
        for (const col of pdfCols) {
          const value = String(row[col.key] ?? '');
          // Tronca per non invadere la colonna successiva
          const clipped = doc.splitTextToSize(value, col.width - 3)[0] ?? '';
          doc.text(clipped, x, y);
          x += col.width;
        }
        y += 5;
      }

      const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

      return new Response(pdfBuffer as any, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="attendance-export-${today}.pdf"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    return NextResponse.json({ error: 'Formato non supportato' }, { status: 400 });
  } catch (error) {
    const r = authError(error);
    if (r) return r;
    console.error('Error exporting attendance:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
