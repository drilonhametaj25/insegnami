import { Worker } from 'bullmq';
import { redis } from '@/lib/redis';
import { sendEmail } from '@/lib/email';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { AutomationJob, AutomationService } from '@/lib/automation-service';

// Email templates for different automation types
const EMAIL_TEMPLATES = {
  attendanceReminder: {
    'before-class': {
      subject: 'Promemoria: Lezione tra poco - {{lessonTitle}}',
      template: `
        <h2>Ciao {{teacherName}},</h2>
        <p>Ti ricordiamo che hai una lezione tra 30 minuti:</p>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>{{lessonTitle}}</h3>
          <p><strong>Orario:</strong> {{startTime}} - {{endTime}}</p>
          <p><strong>Aula:</strong> {{room}}</p>
          <p><strong>Classe:</strong> {{className}}</p>
          <p><strong>Studenti iscritti:</strong> {{studentCount}}</p>
        </div>
        <p>Ricordati di:</p>
        <ul>
          <li>Preparare il materiale didattico</li>
          <li>Arrivare con qualche minuto di anticipo</li>
          <li>Registrare le presenze durante la lezione</li>
        </ul>
        <p>Buona lezione!</p>
      `,
    },
    'after-class': {
      subject: 'Registra presenze - {{lessonTitle}}',
      template: `
        <h2>Ciao {{teacherName}},</h2>
        <p>La lezione "{{lessonTitle}}" è appena terminata.</p>
        <p>Non dimenticare di registrare le presenze degli studenti se non l'hai già fatto.</p>
        <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Link rapido:</strong> <a href="{{attendanceLink}}">Registra presenze</a></p>
        </div>
        <p>Grazie!</p>
      `,
    },
  },
  paymentReminder: {
    'due-soon': {
      subject: 'Promemoria pagamento - Scadenza tra 3 giorni',
      template: `
        <h2>Gentile {{studentName}},</h2>
        <p>Ti ricordiamo che hai un pagamento in scadenza tra 3 giorni:</p>
        <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Dettagli Pagamento</h3>
          <p><strong>Importo:</strong> €{{amount}}</p>
          <p><strong>Descrizione:</strong> {{description}}</p>
          <p><strong>Scadenza:</strong> {{dueDate}}</p>
        </div>
        <p>Puoi effettuare il pagamento presso la segreteria o tramite bonifico bancario.</p>
        <p>Per informazioni contatta la segreteria.</p>
      `,
    },
    'overdue': {
      subject: 'Pagamento in ritardo - {{description}}',
      template: `
        <h2>Gentile {{studentName}},</h2>
        <p>Il seguente pagamento risulta in ritardo:</p>
        <div style="background: #f8d7da; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Pagamento Scaduto</h3>
          <p><strong>Importo:</strong> €{{amount}}</p>
          <p><strong>Descrizione:</strong> {{description}}</p>
          <p><strong>Scaduto il:</strong> {{dueDate}}</p>
          <p><strong>Giorni di ritardo:</strong> {{daysOverdue}}</p>
        </div>
        <p>Ti chiediamo di regolarizzare il pagamento il prima possibile.</p>
        <p>Per informazioni o per concordare un piano di pagamento, contatta la segreteria.</p>
      `,
    },
  },
};

// Create automation worker
export const automationWorker = new Worker<AutomationJob>(
  'automation',
  async (job) => {
    const { data } = job;
    logger.info(`Processing automation job: ${data.type}`, { jobId: job.id });

    try {
      switch (data.type) {
        case 'attendance-reminder':
          await processAttendanceReminder(data);
          break;
        case 'payment-reminder':
          await processPaymentReminder(data);
          break;
        case 'class-capacity-warning':
          await processClassCapacityWarning(data);
          break;
        case 'auto-enrollment':
          await processAutoEnrollment(data);
          break;
        case 'recurring-lesson':
          await processRecurringLesson(data);
          break;
        default:
          logger.warn(`Unknown automation job type: ${(data as any).type}`);
      }
    } catch (error) {
      logger.error(`Failed to process automation job: ${data.type}`, error);
      throw error;
    }
  },
  {
    connection: redis.getConnectionConfig(),
    concurrency: 5,
  }
);

// Job processors
async function processAttendanceReminder(data: any) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: data.lessonId },
    include: {
      teacher: true,
      class: {
        include: {
          students: {
            include: { student: true },
          },
        },
      },
    },
  });

  if (!lesson) {
    logger.error(`Lesson not found: ${data.lessonId}`);
    return;
  }

  const template = EMAIL_TEMPLATES.attendanceReminder[data.reminderTime as keyof typeof EMAIL_TEMPLATES.attendanceReminder];
  if (!template) {
    logger.error(`No template found for reminder type: ${data.reminderTime}`);
    return;
  }

  const teacherEmail = lesson.teacher.email;
  if (!teacherEmail) {
    logger.warn(`No email address for teacher: ${lesson.teacher.id}`);
    return;
  }

  // Replace template variables
  let emailContent = template.template
    .replace(/{{teacherName}}/g, `${lesson.teacher.firstName} ${lesson.teacher.lastName}`)
    .replace(/{{lessonTitle}}/g, lesson.title)
    .replace(/{{startTime}}/g, lesson.startTime.toLocaleString('it-IT'))
    .replace(/{{endTime}}/g, lesson.endTime.toLocaleString('it-IT'))
    .replace(/{{room}}/g, lesson.room || 'Non specificata')
    .replace(/{{className}}/g, lesson.class.name)
    .replace(/{{studentCount}}/g, lesson.class.students.length.toString());

  if (data.reminderTime === 'after-class') {
    const attendanceLink = `${process.env.NEXTAUTH_URL}/dashboard/attendance?lesson=${lesson.id}`;
    emailContent = emailContent.replace(/{{attendanceLink}}/g, attendanceLink);
  }

  const emailSubject = template.subject
    .replace(/{{lessonTitle}}/g, lesson.title);

  await sendEmail({
    to: teacherEmail,
    subject: emailSubject,
    html: emailContent,
  });

  logger.info(`Attendance reminder sent to teacher: ${teacherEmail}`);
}

async function processPaymentReminder(data: any) {
  const payment = await prisma.payment.findUnique({
    where: { id: data.paymentId },
    include: {
      student: true,
    },
  });

  if (!payment) {
    logger.error(`Payment not found: ${data.paymentId}`);
    return;
  }

  const template = EMAIL_TEMPLATES.paymentReminder[data.reminderType as keyof typeof EMAIL_TEMPLATES.paymentReminder];
  if (!template) {
    logger.error(`No template found for payment reminder type: ${data.reminderType}`);
    return;
  }

  // Send to student email first, then parent email if available
  const emailAddresses = [
    payment.student.email,
    payment.student.parentEmail,
  ].filter(Boolean);

  if (emailAddresses.length === 0) {
    logger.warn(`No email addresses for student: ${payment.student.id}`);
    return;
  }

  const daysOverdue = data.reminderType === 'overdue' || data.reminderType === 'final-notice'
    ? Math.floor((Date.now() - payment.dueDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  for (const email of emailAddresses) {
    if (email) {
      let emailContent = template.template
        .replace(/{{studentName}}/g, `${payment.student.firstName} ${payment.student.lastName}`)
        .replace(/{{amount}}/g, payment.amount.toString())
        .replace(/{{description}}/g, payment.description)
        .replace(/{{dueDate}}/g, payment.dueDate.toLocaleDateString('it-IT'));

      if (daysOverdue > 0) {
        emailContent = emailContent.replace(/{{daysOverdue}}/g, daysOverdue.toString());
      }

      await sendEmail({
        to: email,
        subject: template.subject.replace(/{{description}}/g, payment.description),
        html: emailContent,
      });
    }
  }

  logger.info(`Payment reminder sent for payment: ${payment.id}`);
}

async function processClassCapacityWarning(data: any) {
  const classData = await prisma.class.findUnique({
    where: { id: data.classId },
    include: {
      teacher: true,
      tenant: true,
    },
  });

  if (!classData) {
    logger.error(`Class not found: ${data.classId}`);
    return;
  }

  // Get admin users for the tenant through UserTenant relation
  const adminUserTenants = await prisma.userTenant.findMany({
    where: {
      tenantId: data.tenantId,
      role: { in: ['ADMIN', 'SUPERADMIN'] },
    },
    include: {
      user: true,
    },
  });

  const adminEmails = adminUserTenants.map(ut => ut.user.email).filter(Boolean);
  const teacherEmail = classData.teacher.email;

  const emailAddresses = [...adminEmails];
  if (teacherEmail) emailAddresses.push(teacherEmail);

  const capacityPercentage = Math.round((data.currentCapacity / data.maxCapacity) * 100);

  const emailContent = `
    <h2>Avviso Capacità Classe</h2>
    <p>La classe "${classData.name}" ha raggiunto il ${capacityPercentage}% della sua capacità massima.</p>
    <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3>Dettagli Classe</h3>
      <p><strong>Nome:</strong> ${classData.name}</p>
      <p><strong>Studenti attuali:</strong> ${data.currentCapacity}</p>
      <p><strong>Capacità massima:</strong> ${data.maxCapacity}</p>
      <p><strong>Posti disponibili:</strong> ${data.maxCapacity - data.currentCapacity}</p>
    </div>
    <p>Considera di:</p>
    <ul>
      <li>Creare una lista d'attesa per nuovi studenti</li>
      <li>Aprire una nuova sezione della classe</li>
      <li>Valutare l'aumento della capacità se l'aula lo permette</li>
    </ul>
  `;

  for (const email of emailAddresses) {
    if (email) {
      await sendEmail({
        to: email,
        subject: `Avviso Capacità - Classe ${classData.name}`,
        html: emailContent,
      });
    }
  }

  logger.info(`Class capacity warning sent for class: ${classData.id}`);
}

async function processAutoEnrollment(data: any) {
  // Implement auto enrollment logic when waiting list is implemented
  logger.info(`Auto enrollment processing for student: ${data.studentId}`);
}

async function processRecurringLesson(data: any) {
  await AutomationService.generateRecurringLesson(data.templateLessonId, data.nextDate);
}

// Worker event handlers
automationWorker.on('completed', (job) => {
  logger.info(`Automation job completed: ${job.data.type}`, { jobId: job.id });
});

automationWorker.on('failed', (job, err) => {
  logger.error(`Automation job failed: ${job?.data.type}`, err, { jobId: job?.id });
});

automationWorker.on('error', (err) => {
  logger.error('Automation worker error:', err);
});

export default automationWorker;
