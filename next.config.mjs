import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "127.0.0.1:3000"],
    },
  },
  env: {
    MODE: process.env.MODE || 'self-hosted',
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // Rimuovo i redirect automatici per evitare loop
  // La gestione del redirect sarà fatta dal middleware
};

export default withNextIntl(nextConfig);
