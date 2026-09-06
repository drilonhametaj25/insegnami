import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { resolveSafeUploadPath } from '@/lib/uploads/safe-path';

/**
 * Restituisce il file locale (sotto public/uploads) come download,
 * oppure un redirect se il materiale punta a un URL esterno.
 */
export async function serveMaterialFile(
  url: string,
  name: string,
  mimeType: string | null
): Promise<NextResponse> {
  if (/^https?:\/\//i.test(url)) {
    return NextResponse.redirect(url);
  }

  const filePath = resolveSafeUploadPath(url);
  if (!filePath) {
    return NextResponse.json({ error: 'File non disponibile' }, { status: 404 });
  }

  try {
    const buffer = await readFile(filePath);
    const ext = path.extname(url);
    const safeName = `${name.replace(/[^a-zA-Z0-9._ -]/g, '_')}${
      name.toLowerCase().endsWith(ext.toLowerCase()) ? '' : ext
    }`;
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': mimeType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${safeName}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'File non trovato' }, { status: 404 });
  }
}
