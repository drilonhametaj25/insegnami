import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/platform/status — endpoint pubblico e leggero per la UI:
// segnala la modalità manutenzione della piattaforma (banner in dashboard).
// Nessun dato sensibile, nessuna auth. Fail-open: su errore → false.
export async function GET() {
  try {
    const settings = await prisma.platformSettings.findUnique({
      where: { id: 'platform' },
      select: { maintenanceMode: true },
    });
    return NextResponse.json({ maintenanceMode: settings?.maintenanceMode === true });
  } catch (error) {
    console.error('platform status error:', error);
    return NextResponse.json({ maintenanceMode: false });
  }
}
