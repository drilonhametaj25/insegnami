import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://insegnami.pro';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Le pagine app vivono sotto il prefisso locale (localePrefix 'always'):
        // le regole devono coprire i path REALI, non quelli senza prefisso.
        disallow: [
          '/api/',
          '/dashboard/',
          '/it/dashboard/',
          '/en/dashboard/',
          '/fr/dashboard/',
          '/pt/dashboard/',
          '/it/auth/reset-password',
          '/en/auth/reset-password',
          '/fr/auth/reset-password',
          '/pt/auth/reset-password',
          '/it/auth/verify-email',
          '/en/auth/verify-email',
          '/fr/auth/verify-email',
          '/pt/auth/verify-email',
          '/it/checkout/',
          '/en/checkout/',
          '/fr/checkout/',
          '/pt/checkout/',
          '/*.json$',
          '/private/',
        ],
      },
      {
        userAgent: 'GPTBot',
        disallow: '/',
      },
      {
        userAgent: 'CCBot',
        disallow: '/',
      },
      {
        userAgent: 'ChatGPT-User',
        disallow: '/',
      },
      {
        userAgent: 'Google-Extended',
        disallow: '/',
      },
      {
        userAgent: 'anthropic-ai',
        disallow: '/',
      },
      {
        userAgent: 'Claude-Web',
        disallow: '/',
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
