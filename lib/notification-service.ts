import { prisma } from '@/lib/db';

export interface CreateNotificationData {
  tenantId: string;
  userId: string;
  title: string;
  content: string;
  type: 'SYSTEM' | 'CLASS' | 'PAYMENT' | 'ATTENDANCE' | 'MESSAGE' | 'CALENDAR' | 'ANNOUNCEMENT' | 'REMINDER';
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  actionUrl?: string;
  actionLabel?: string;
  sourceType?: string;
  sourceId?: string;
  scheduledFor?: Date;
  expiresAt?: Date;
  sendEmail?: boolean;
  sendPush?: boolean;
}

export class NotificationService {
  
  /**
   * Crea una singola notifica
   */
  static async createNotification(data: CreateNotificationData) {
    try {
      return await prisma.notification.create({
        data: {
          tenantId: data.tenantId,
          userId: data.userId,
          title: data.title,
          content: data.content,
          type: data.type,
          priority: data.priority || 'NORMAL',
          actionUrl: data.actionUrl,
          actionLabel: data.actionLabel,
          sourceType: data.sourceType,
          sourceId: data.sourceId,
          scheduledFor: data.scheduledFor,
          expiresAt: data.expiresAt,
          emailSent: !(data.sendEmail || false),
          pushSent: !(data.sendPush || true),
        }
      });
    } catch (error) {
      console.error('Errore nella creazione notifica:', error);
      throw error;
    }
  }

  /**
   * Crea notifiche per più utenti contemporaneamente
   */
  static async createBulkNotifications(notifications: CreateNotificationData[]) {
    try {
      const data = notifications.map(notif => ({
        tenantId: notif.tenantId,
        userId: notif.userId,
        title: notif.title,
        content: notif.content,
        type: notif.type,
        priority: notif.priority || 'NORMAL',
        actionUrl: notif.actionUrl,
        actionLabel: notif.actionLabel,
        sourceType: notif.sourceType,
        sourceId: notif.sourceId,
        scheduledFor: notif.scheduledFor,
        expiresAt: notif.expiresAt,
        emailSent: !(notif.sendEmail || false),
        pushSent: !(notif.sendPush || true),
      }));

      return await prisma.notification.createMany({
        data,
      });
    } catch (error) {
      console.error('Errore nella creazione notifiche bulk:', error);
      throw error;
    }
  }

  /**
   * Notifica per nuovo studente iscritto
   */
  static async notifyNewStudentEnrollment(
    tenantId: string,
    studentId: string,
    studentName: string,
    className: string,
    adminUserIds: string[]
  ) {
    const notifications = adminUserIds.map(adminId => ({
      tenantId,
      userId: adminId,
      title: 'Nuovo studente iscritto',
      content: `${studentName} si è iscritto alla classe ${className}`,
      type: 'CLASS' as const,
      priority: 'NORMAL' as const,
      actionUrl: `/dashboard/students/${studentId}`,
      actionLabel: 'Vedi dettagli',
      sourceType: 'student',
      sourceId: studentId,
      sendEmail: true,
    }));

    return await this.createBulkNotifications(notifications);
  }

  /**
   * Notifica per pagamento ricevuto
   */
  static async notifyPaymentReceived(
    tenantId: string,
    paymentId: string,
    studentName: string,
    amount: number,
    adminUserIds: string[]
  ) {
    const notifications = adminUserIds.map(adminId => ({
      tenantId,
      userId: adminId,
      title: 'Pagamento ricevuto',
      content: `Ricevuto pagamento di €${amount} da ${studentName}`,
      type: 'PAYMENT' as const,
      priority: 'NORMAL' as const,
      actionUrl: `/dashboard/payments`,
      actionLabel: 'Vedi pagamenti',
      sourceType: 'payment',
      sourceId: paymentId,
      sendEmail: false,
    }));

    return await this.createBulkNotifications(notifications);
  }

  /**
   * Notifica per pagamento in scadenza
   */
  static async notifyUpcomingPayment(
    tenantId: string,
    paymentId: string,
    studentUserId: string,
    parentUserId: string | null,
    amount: number,
    dueDate: Date,
    studentName: string
  ) {
    const userIds = parentUserId ? [studentUserId, parentUserId] : [studentUserId];
    
    const notifications = userIds.map(userId => ({
      tenantId,
      userId,
      title: 'Pagamento in scadenza',
      content: `Il pagamento di €${amount} per ${studentName} scade il ${dueDate.toLocaleDateString('it-IT')}`,
      type: 'PAYMENT' as const,
      priority: 'HIGH' as const,
      actionUrl: `/dashboard/payments`,
      actionLabel: 'Vedi dettagli',
      sourceType: 'payment',
      sourceId: paymentId,
      sendEmail: true,
      expiresAt: dueDate,
    }));

    return await this.createBulkNotifications(notifications);
  }

  /**
   * Notifica per lezione cancellata
   */
  static async notifyLessonCancelled(
    tenantId: string,
    lessonId: string,
    lessonTitle: string,
    lessonDate: Date,
    studentUserIds: string[],
    teacherUserId?: string
  ) {
    const allUserIds = teacherUserId ? [...studentUserIds, teacherUserId] : studentUserIds;
    
    const notifications = allUserIds.map(userId => ({
      tenantId,
      userId,
      title: 'Lezione cancellata',
      content: `La lezione "${lessonTitle}" del ${lessonDate.toLocaleDateString('it-IT')} è stata cancellata`,
      type: 'CLASS' as const,
      priority: 'HIGH' as const,
      actionUrl: `/dashboard/lessons/${lessonId}`,
      actionLabel: 'Vedi dettagli',
      sourceType: 'lesson',
      sourceId: lessonId,
      sendEmail: true,
      sendPush: true,
    }));

    return await this.createBulkNotifications(notifications);
  }

  /**
   * Notifica per assenza studente
   */
  static async notifyStudentAbsence(
    tenantId: string,
    attendanceId: string,
    studentName: string,
    lessonTitle: string,
    lessonDate: Date,
    parentUserId: string | null,
    teacherUserId: string
  ) {
    const userIds = parentUserId ? [parentUserId, teacherUserId] : [teacherUserId];
    
    const notifications = userIds.map(userId => ({
      tenantId,
      userId,
      title: 'Assenza studente',
      content: `${studentName} è assente alla lezione "${lessonTitle}" del ${lessonDate.toLocaleDateString('it-IT')}`,
      type: 'ATTENDANCE' as const,
      priority: 'NORMAL' as const,
      actionUrl: `/dashboard/attendance`,
      actionLabel: 'Vedi presenze',
      sourceType: 'attendance',
      sourceId: attendanceId,
      sendEmail: parentUserId === userId, // Solo ai genitori via email
    }));

    return await this.createBulkNotifications(notifications);
  }

  /**
   * Notifica per nuovo annuncio
   */
  static async notifyNewAnnouncement(
    tenantId: string,
    noticeId: string,
    title: string,
    content: string,
    targetRoles: string[],
    isUrgent: boolean = false
  ) {
    // Ottieni tutti gli utenti con i ruoli target
    const userTenants = await prisma.userTenant.findMany({
      where: {
        tenantId,
        role: { in: targetRoles as any[] }
      },
      select: { userId: true }
    });

    if (userTenants.length === 0) return;

    const notifications = userTenants.map(({ userId }) => ({
      tenantId,
      userId,
      title: isUrgent ? `🚨 URGENTE: ${title}` : `📢 ${title}`,
      content: content.length > 100 ? content.substring(0, 100) + '...' : content,
      type: 'ANNOUNCEMENT' as const,
      priority: isUrgent ? 'URGENT' as const : 'NORMAL' as const,
      actionUrl: `/dashboard/notices/${noticeId}`,
      actionLabel: 'Leggi annuncio',
      sourceType: 'notice',
      sourceId: noticeId,
      sendEmail: isUrgent,
      sendPush: true,
    }));

    return await this.createBulkNotifications(notifications);
  }

  /**
   * Pulisce le notifiche scadute
   */
  static async cleanupExpiredNotifications() {
    try {
      const result = await prisma.notification.deleteMany({
        where: {
          expiresAt: {
            lt: new Date()
          }
        }
      });
      
      console.log(`Rimosse ${result.count} notifiche scadute`);
      return result.count;
    } catch (error) {
      console.error('Errore nella pulizia notifiche scadute:', error);
      throw error;
    }
  }

  /**
   * Statistiche notifiche
   */
  static async getNotificationStats(tenantId: string) {
    try {
      const stats = await prisma.notification.groupBy({
        by: ['type', 'status'],
        where: { tenantId },
        _count: true,
      });

      const totalByType = await prisma.notification.groupBy({
        by: ['type'],
        where: { tenantId },
        _count: true,
      });

      return {
        byTypeAndStatus: stats,
        totalByType,
      };
    } catch (error) {
      console.error('Errore nel recupero statistiche notifiche:', error);
      throw error;
    }
  }
}

export default NotificationService;
