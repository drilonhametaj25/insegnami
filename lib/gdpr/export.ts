import { prisma } from '@/lib/db';

/**
 * GDPR Article 20 — Right to Data Portability.
 *
 * Aggregates everything personal we hold about a User into a single JSON
 * document. Excludes:
 *   - password hash, verification tokens, JWT tokens, reset tokens
 *   - other users' data (parent's other children stay in their own export)
 *   - SaaS-internal billing/audit metadata not directly about the user
 *
 * Includes:
 *   - account profile (User row, sanitized)
 *   - tenant memberships + roles
 *   - studentProfile + grades + attendance + reportCards + homework
 *     submissions + parent meetings + disciplinary notes
 *   - childrenAsParent (parent perspective): children's identity + the
 *     same per-child data (grades/attendance/etc.) so a parent gets ONE
 *     export covering the whole family relationship
 *   - notifications received
 *   - payments + invoices addressed to them or to their child
 *   - notes written ABOUT them (disciplinary notes for students,
 *     parent meetings they're in)
 *
 * Output is plain JSON — no PII filtering needed because the recipient
 * IS the data subject. The Content-Disposition: attachment header on the
 * route makes the browser download it.
 */

export type GdprExport = Record<string, unknown> & {
  __version: '1.0';
  __generatedAt: string;
  __subjectUserId: string;
};

const USER_SAFE_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  avatar: true,
  status: true,
  emailVerified: true,
  createdAt: true,
  updatedAt: true,
  lastLogin: true,
} as const;

const STUDENT_SAFE_SELECT = {
  id: true,
  studentCode: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  dateOfBirth: true,
  address: true,
  emergencyContact: true,
  medicalNotes: true,
  specialNeeds: true,
  status: true,
  enrollmentDate: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function exportUserData(userId: string): Promise<GdprExport> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...USER_SAFE_SELECT,
      tenants: {
        select: {
          tenantId: true,
          role: true,
          permissions: true,
          createdAt: true,
          tenant: { select: { id: true, name: true, slug: true } },
        },
      },
      studentProfile: {
        select: {
          ...STUDENT_SAFE_SELECT,
          grades: { orderBy: { createdAt: 'desc' } },
          attendance: {
            include: {
              lesson: { select: { id: true, title: true, startTime: true, endTime: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
          reportCards: {
            include: { entries: { include: { subject: { select: { name: true, code: true } } } } },
            orderBy: { createdAt: 'desc' },
          },
          homeworkSubmissions: {
            include: { homework: { select: { title: true, dueDate: true } } },
            orderBy: { submittedAt: 'desc' },
          },
          parentMeetings: { orderBy: { createdAt: 'desc' } },
          disciplinaryNotes: { orderBy: { createdAt: 'desc' } },
          payments: { orderBy: { createdAt: 'desc' } },
          hoursPackages: { orderBy: { purchaseDate: 'desc' } },
        },
      },
      childrenAsParent: {
        select: {
          ...STUDENT_SAFE_SELECT,
          grades: { orderBy: { createdAt: 'desc' } },
          attendance: {
            include: { lesson: { select: { id: true, title: true, startTime: true } } },
            orderBy: { createdAt: 'desc' },
          },
          reportCards: { orderBy: { createdAt: 'desc' } },
          payments: { orderBy: { createdAt: 'desc' } },
          parentMeetings: { orderBy: { createdAt: 'desc' } },
        },
      },
      notifications: {
        select: {
          id: true, title: true, content: true, type: true, priority: true,
          status: true, createdAt: true, scheduledFor: true,
          actionUrl: true, sourceType: true, sourceId: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      sentMessages: {
        select: {
          id: true, subject: true, content: true, type: true, status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      messageRecipients: {
        select: {
          id: true, status: true, inAppReadAt: true, emailReadAt: true,
          message: { select: { id: true, subject: true, content: true, createdAt: true } },
        },
        orderBy: { id: 'desc' },
      },
      invoiceCustomerProfiles: {
        select: {
          id: true, denominazione: true, nome: true, cognome: true,
          codiceFiscale: true, partitaIva: true, pec: true,
          codiceDestinatario: true, indirizzo: true, cap: true, comune: true,
          provincia: true, nazione: true, email: true, telefono: true,
          createdAt: true,
        },
      },
    } as any,
  });

  if (!user) {
    throw new Error(`User ${userId} not found`);
  }

  return {
    __version: '1.0',
    __generatedAt: new Date().toISOString(),
    __subjectUserId: userId,
    profile: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatar: user.avatar,
      status: user.status,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLogin: user.lastLogin,
    },
    tenantMemberships: (user as any).tenants,
    studentProfile: (user as any).studentProfile,
    childrenAsParent: (user as any).childrenAsParent,
    notifications: (user as any).notifications,
    sentMessages: (user as any).sentMessages,
    receivedMessages: (user as any).messageRecipients,
    invoiceCustomerProfiles: (user as any).invoiceCustomerProfiles,
  };
}
