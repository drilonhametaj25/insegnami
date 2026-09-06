import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authError } from '@/lib/api-auth';
import { AutomationService } from '@/lib/automation-service';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db';
import { automationQueue } from '@/lib/automation-service';
import { triggerCronJob, type CronJobName } from '@/lib/workers/cron-scheduler';

export async function POST(request: NextRequest) {
  try {
    // Solo SUPERADMIN: le azioni operano su code/job di piattaforma, non scoped per tenant
    await requireAuth({ roles: ['SUPERADMIN'] });

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

      // 'generate-recurring-lesson' rimosso: la generazione delle ricorrenze
      // è eager nell'endpoint POST /api/lessons/recurring.

      case 'trigger-cron': {
        // Enqueue an immediate run of a recurring cron job.
        // Useful for ops dashboards and post-incident catch-up.
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
    const r = authError(error);
    if (r) return r;
    logger.error('Automation API error:', error);
    return NextResponse.json({ 
      error: 'Errore interno del server' 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Solo SUPERADMIN (contratto RBAC): stato di piattaforma non filtrato.
    // La vista ADMIN filtrata per tenant vive in GET /api/automation/runs.
    await requireAuth({ roles: ['SUPERADMIN'] });

    // Look up the most recent successful daily-automation run.
    const lastDailyRun = await prisma.automationRun.findFirst({
      where: { jobName: 'daily-automation', status: 'SUCCESS' },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true, finishedAt: true, resultJson: true },
    });

    const recentRuns = await prisma.automationRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: 20,
      select: { id: true, jobName: true, tenantId: true, startedAt: true, finishedAt: true, status: true, error: true },
    });

    // Heartbeat del container worker (badge salute in dashboard)
    const { readWorkerHeartbeat } = await import('@/lib/workers/heartbeat-status');
    const workerHeartbeat = await readWorkerHeartbeat();

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
      scope: 'platform',
      lastDailyRun,
      recentRuns,
      activeJobs,
      workerHeartbeat,
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
    const r = authError(error);
    if (r) return r;
    logger.error('Automation status API error:', error);
    return NextResponse.json({ 
      error: 'Errore interno del server' 
    }, { status: 500 });
  }
}
