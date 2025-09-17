import { NextRequest, NextResponse } from 'next/server';
import { getAuth, authOptions } from '@/lib/auth';
import { AutomationService } from '@/lib/automation-service';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const session = await getAuth();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    // Only admins can trigger automation
    if (!['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
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
    if (!['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    // Return automation status and configuration
    const status = {
      automationEnabled: true,
      lastDailyRun: null, // TODO: track this in database
      activeJobs: {
        attendanceReminders: 0, // TODO: get from queue
        paymentReminders: 0,
        recurringLessons: 0,
      },
      configuration: {
        attendanceReminderTimes: {
          beforeClass: 30, // minutes
          afterClass: 15,
        },
        paymentReminderDays: {
          dueSoon: 3,
          overdue: 7,
          finalNotice: 30,
        },
      },
    };

    return NextResponse.json(status);
  } catch (error) {
    logger.error('Automation status API error:', error);
    return NextResponse.json({ 
      error: 'Errore interno del server' 
    }, { status: 500 });
  }
}
