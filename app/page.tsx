import { permanentRedirect } from 'next/navigation';

/**
 * La homepage canonica vive sotto il prefisso locale (/it): servire lo stesso
 * contenuto anche su '/' creerebbe un duplicato con segnali SEO divisi.
 * 308 → /it (x-default).
 */
export default function RootPage() {
  permanentRedirect('/it');
}
