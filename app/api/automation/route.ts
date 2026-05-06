import { NextRequest, NextResponse } from 'next/server';
import { getAuth, authOptions, isAdminRole } from '@/lib/auth';
import { AutomationService } from '@/lib/automation-service';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db';
import { automationQueue } from '@/lib/automation-service';
import { triggerCronJob, type CronJobName } from '@/lib/workers/cron-scheduler';

export async function POST(request: NextRequest) {
  try {
    const session = await getAuth();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    // Only admins can trigger automation
    if (!isAdminRole(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case 'setup-daily-reminders':
        await AutomationService.setupDailyReminders();
        return NextResponse.json({ 
          success: true, 
          message: 'Promemoria giornalieri configurati con successo' 
        });

      case 'setup-payment-reminders':
        await AutomationService.setupPaymentReminders();
        return NextResponse.json({ 
          success: true, 
          message: 'Promemoria pagamenti configurati con successo' 
        });

      case 'run-daily-automation':
        await AutomationService.runDailyAutomation();
        return NextResponse.json({ 
          success: true, 
          message: 'Automazione giornaliera eseguita con successo' 
        });

      case 'schedule-attendance-reminder':
        if (!data.lessonId || !data.reminderTime) {
          return NextResponse.json({ 
            error: 'lessonId e reminderTime sono obbligatori' 
          }, { status: 400 });
        }
        
        await AutomationService.scheduleAttendanceReminder(
          data.lessonId,
          data.reminderTime,
          data.delay || 0
        );
        return NextResponse.json({ 
          success: true, 
          message: 'Promemoria presenza programmato' 
        });

      case 'schedule-payment-reminder':
        if (!data.paymentId || !data.reminderType) {
          return NextResponse.json({ 
            error: 'paymentId e reminderType sono obbligatori' 
          }, { status: 400 });
        }
        
        await AutomationService.schedulePaymentReminder(
          data.paymentId,
          data.reminderType,
          data.delay || 0
        );
        return NextResponse.json({ 
          success: true, 
          message: 'Promemoria pagamento programmato' 
        });

      case 'check-class-capacity':
        if (!data.classId) {
          return NextResponse.json({ 
            error: 'classId è obbligatorio' 
          }, { status: 400 });
        }
        
        await AutomationService.checkClassCapacity(data.classId);
        return NextResponse.json({ 
          success: true, 
          message: 'Controllo capacità classe eseguito' 
        });

      case 'generate-recurring-lesson':
        if (!data.templateLessonId || !data.nextDate) {
          return NextResponse.json({ 
            error: 'templateLessonId e nextDate sono obbligatori' 
          }, { status: 400 });
        }
        
        const newLesson = await AutomationService.generateRecurringLesson(
          data.templateLessonId,
          new Date(data.nextDate)
        );
        return NextResponse.json({ 
          success: true, 
          message: 'Lezione ricorrente generata',
          lesson: newLesson
        });

      case 'trigger-cron': {
        // SUPERADMIN-only: enqueue an immediate run of a recurring cron job.
        // Useful for ops dashboards and post-incident catch-up.
        if (session.user.role !== 'SUPERADMIN') {
          return NextResponse.json({ error: 'Solo SUPERADMIN' }, { status: 403 });
        }
        if (!data?.jobName) {
          return NextResponse.json({ error: 'jobName richiesto' }, { status: 400 });
        }
        await triggerCronJob(data.jobName as CronJobName);
        return NextResponse.json({
          success: true,
          message: `Cron ${data.jobName} accodato per esecuzione immediata`,
        });
      }

      default:
        return NextResponse.json({
          error: 'Azione non riconosciuta'
        }, { status: 400 });
    }
  } catch (error) {
    logger.error('Automation API error:', error);
    return NextResponse.json({ 
      error: 'Errore interno del server' 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getAuth();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    // Only admins can view automation status
    if (!isAdminRole(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    // Look up the most recent successful daily-automation run.
    const lastDailyRun = await prisma.automationRun.findFirst({
      where: { jobName: 'daily-automation', status: 'SUCCESS' },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true, finishedAt: true, resultJson: true },
    });

    const recentRuns = await prisma.automationRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: 20,
      select: { id: true, jobName: true, startedAt: true, finishedAt: true, status: true, error: true },
    });

    // Live counts from BullMQ — best-effort. If Redis is down we return zeros
    // rather than failing the dashboard.
    let activeJobs = { waiting: 0, active: 0, delayed: 0, failed: 0 };
    try {
      const q = automationQueue.get();
      if (q) {
        const counts = await q.getJobCounts('waiting', 'active', 'delayed', 'failed');
        activeJobs = {
          waiting: counts.waiting ?? 0,
          active: counts.active ?? 0,
          delayed: counts.delayed ?? 0,
          failed: counts.failed ?? 0,
        };
      }
    } catch (err) {
      logger.warn('Could not fetch automation queue counts', err);
    }

    return NextResponse.json({
      automationEnabled: true,
      lastDailyRun,
      recentRuns,
      activeJobs,
      configuration: {
        attendanceReminderTimes: {
          beforeClass: 30,
          afterClass: 15,
        },
        paymentReminderDays: {
          dueSoon: 3,
          overdue: 7,
          finalNotice: 30,
        },
      },
    });
  } catch (error) {
    logger.error('Automation status API error:', error);
    return NextResponse.json({ 
      error: 'Errore interno del server' 
    }, { status: 500 });
  }
}
