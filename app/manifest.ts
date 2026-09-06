import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'InsegnaMi.pro',
    short_name: 'InsegnaMi',
    description:
      'Gestionale per scuole private: registro elettronico, presenze, pagamenti e comunicazioni.',
    start_url: '/it',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0ea5e9',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  };
}
