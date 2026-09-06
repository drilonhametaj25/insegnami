/**
 * Umami analytics (cookieless, GDPR-friendly senza banner).
 * Server component: legge le env NEXT_PUBLIC_* a render time e non
 * renderizza nulla se la configurazione è assente (default in dev/self-hosted).
 *
 * Config (vedi .env.example):
 * - NEXT_PUBLIC_UMAMI_URL: URL base dell'istanza Umami (es. https://analytics.example.com)
 *   oppure URL completo dello script (termina con .js)
 * - NEXT_PUBLIC_UMAMI_WEBSITE_ID: UUID del sito registrato in Umami
 */
export function AnalyticsScript() {
  const baseUrl = process.env.NEXT_PUBLIC_UMAMI_URL;
  const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;

  if (!baseUrl || !websiteId) return null;

  const src = baseUrl.endsWith('.js')
    ? baseUrl
    : `${baseUrl.replace(/\/+$/, '')}/script.js`;

  return <script defer src={src} data-website-id={websiteId} />;
}

export default AnalyticsScript;
