import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';

interface LowHoursPackage {
  id: string;
  remainingHours: number;
  totalHours: number;
  student: {
    firstName: string;
    lastName: string;
    email: string | null;
  };
  course: {
    name: string;
  };
}

/**
 * Check for hours packages that are running low and send notifications
 * Should be called periodically (e.g., daily cron job or after attendance updates)
 */
export async function checkLowHoursPackages(tenantId: string): Promise<void> {
  try {
    // Find all active packages
    const packages = await prisma.hoursPackage.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      include: {
        student: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        course: {
          select: {
            name: true,
          },
        },
      },
    });

    const lowHoursPackages: LowHoursPackage[] = [];

    // Check each package for low hours (less than 20%)
    for (const pkg of packages) {
      const remainingHours = parseFloat(pkg.remainingHours.toString());
      const totalHours = parseFloat(pkg.totalHours.toString());
      const percentageRemaining = (remainingHours / totalHours) * 100;

      if (percentageRemaining <= 20 && percentageRemaining > 0) {
        lowHoursPackages.push({
          id: pkg.id,
          remainingHours,
          totalHours,
          student: pkg.student,
          course: pkg.course,
        });
      }
    }

    // Send email notifications for low hours packages
    for (const pkg of lowHoursPackages) {
      if (pkg.student.email) {
        await sendLowHoursNotification(pkg);
      }
    }

    console.log(`Checked ${packages.length} packages, found ${lowHoursPackages.length} with low hours`);
  } catch (error) {
    console.error('Error checking low hours packages:', error);
    throw error;
  }
}

/**
 * Send email notification for a low hours package
 */
async function sendLowHoursNotification(pkg: LowHoursPackage): Promise<void> {
  const subject = `⚠️ Pacchetto Ore in Esaurimento - ${pkg.course.name}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #f59e0b;">⚠️ Attenzione: Pacchetto Ore in Esaurimento</h2>
      
      <p>Gentile ${pkg.student.firstName} ${pkg.student.lastName},</p>
      
      <p>Ti informiamo che il tuo pacchetto ore per il corso <strong>${pkg.course.name}</strong> sta per esaurirsi.</p>
      
      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
        <h3 style="margin: 0 0 10px 0; color: #92400e;">Riepilogo Ore</h3>
        <p style="margin: 5px 0;"><strong>Ore Rimanenti:</strong> ${pkg.remainingHours.toFixed(1)} ore</p>
        <p style="margin: 5px 0;"><strong>Ore Totali:</strong> ${pkg.totalHours.toFixed(1)} ore</p>
        <p style="margin: 5px 0;"><strong>Percentuale Rimanente:</strong> ${((pkg.remainingHours / pkg.totalHours) * 100).toFixed(0)}%</p>
      </div>
      
      <p>Ti consigliamo di contattare la segreteria per rinnovare il tuo pacchetto ore e continuare le lezioni senza interruzioni.</p>
      
      <p style="margin-top: 30px;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" 
           style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Visualizza Dashboard
        </a>
      </p>
      
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;" />
      
      <p style="color: #6b7280; font-size: 12px;">
        Questo è un messaggio automatico. Per qualsiasi domanda, contatta la segreteria.
      </p>
    </div>
  `;

  try {
    await sendEmail({
      to: pkg.student.email!,
      subject,
      html,
    });
    
    console.log(`Sent low hours notification to ${pkg.student.email} for package ${pkg.id}`);
  } catch (error) {
    console.error(`Failed to send low hours notification for package ${pkg.id}:`, error);
    // Don't throw - continue with other notifications
  }
}

/**
 * Check if a specific package is low on hours (less than 20%)
 */
export function isPackageLowOnHours(remainingHours: number, totalHours: number): boolean {
  const percentageRemaining = (remainingHours / totalHours) * 100;
  return percentageRemaining <= 20 && percentageRemaining > 0;
}

/**
 * Get all students with low hours packages for a tenant
 */
export async function getStudentsWithLowHours(tenantId: string) {
  const packages = await prisma.hoursPackage.findMany({
    where: {
      tenantId,
      isActive: true,
    },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          studentCode: true,
        },
      },
      course: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
  });

  return packages
    .filter(pkg => {
      const remainingHours = parseFloat(pkg.remainingHours.toString());
      const totalHours = parseFloat(pkg.totalHours.toString());
      return isPackageLowOnHours(remainingHours, totalHours);
    })
    .map(pkg => ({
      packageId: pkg.id,
      student: pkg.student,
      course: pkg.course,
      remainingHours: parseFloat(pkg.remainingHours.toString()),
      totalHours: parseFloat(pkg.totalHours.toString()),
      percentageRemaining: (parseFloat(pkg.remainingHours.toString()) / parseFloat(pkg.totalHours.toString())) * 100,
    }));
}
