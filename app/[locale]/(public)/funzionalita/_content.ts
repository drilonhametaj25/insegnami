import type { ElementType } from 'react';
import {
  IconBell,
  IconCalendarEvent,
  IconCertificate,
  IconChartBar,
  IconChecklist,
  IconClipboardCheck,
  IconClock,
  IconCreditCard,
  IconDoor,
  IconFileEuro,
  IconFileText,
  IconLanguage,
  IconMail,
  IconMailForward,
  IconMusic,
  IconNotebook,
  IconNotes,
  IconPackage,
  IconReceipt,
  IconReportAnalytics,
  IconSchool,
  IconSpeakerphone,
  IconStar,
  IconTableExport,
  IconUsers,
  IconUsersGroup,
} from '@tabler/icons-react';

/**
 * Dati NON testuali delle 6 pagine funzionalità pubbliche (slug, icone,
 * screenshot). Tutti i testi vivono in messages/*.json sotto
 * `public.features.pages.<slug>` e vengono riuniti ai dati qui sotto da
 * buildFeaturePage() con il translator di next-intl.
 */

export interface FeatureFaq {
  question: string;
  answer: string;
}

export interface FeatureCapability {
  icon: ElementType;
  title: string;
  text: string;
}

export interface FeaturePage {
  slug: string;
  /** Label breve per menu e footer. */
  navLabel: string;
  /** Titolo SEO (senza suffisso sito). */
  metaTitle: string;
  metaDescription: string;
  badge: string;
  /** H1: parte normale + parte evidenziata con gradiente. */
  h1: string;
  h1Highlight: string;
  sub: string;
  /** Testo breve per la card nella pagina indice. */
  cardText: string;
  capabilities: FeatureCapability[];
  screenshot: { src: string; alt: string };
  faqs: FeatureFaq[];
}

interface FeatureMedia {
  slug: string;
  /** Icone delle 6 capability, nello stesso ordine dei testi in messages. */
  icons: ElementType[];
  screenshotSrc: string;
}

const FEATURE_MEDIA: FeatureMedia[] = [
  {
    slug: 'registro-elettronico',
    icons: [IconClipboardCheck, IconStar, IconNotes, IconFileText, IconChecklist, IconNotebook],
    screenshotSrc: '/images/screenshots/voti.png',
  },
  {
    slug: 'gestione-presenze',
    icons: [IconClipboardCheck, IconChartBar, IconBell, IconTableExport, IconClock, IconChecklist],
    screenshotSrc: '/images/screenshots/registro-lezione.png',
  },
  {
    slug: 'gestione-pagamenti-scuola',
    icons: [
      IconCreditCard,
      IconMailForward,
      IconReceipt,
      IconPackage,
      IconFileEuro,
      IconReportAnalytics,
    ],
    screenshotSrc: '/images/screenshots/pagamenti.png',
  },
  {
    slug: 'comunicazioni-scuola-famiglia',
    icons: [IconSpeakerphone, IconMail, IconUsersGroup, IconBell, IconFileText, IconChecklist],
    screenshotSrc: '/images/screenshots/comunicazioni.png',
  },
  {
    slug: 'gestionale-scuole-di-lingue',
    icons: [
      IconLanguage,
      IconPackage,
      IconCertificate,
      IconClock,
      IconCalendarEvent,
      IconCreditCard,
    ],
    screenshotSrc: '/images/screenshots/dashboard-admin.png',
  },
  {
    slug: 'gestionale-scuole-musica-danza',
    icons: [IconMusic, IconDoor, IconCalendarEvent, IconSchool, IconUsers, IconCreditCard],
    screenshotSrc: '/images/screenshots/portale-genitori.png',
  },
];

/** Slug delle pagine funzionalità, in ordine di navigazione. */
export const FEATURE_SLUGS = FEATURE_MEDIA.map((f) => f.slug);

/**
 * Forma minima del translator next-intl accettata dai builder: sia quello di
 * useTranslations (client/RSC) che quello di getTranslations sono compatibili.
 * Deve essere scoped al namespace 'public.features'.
 */
export type FeaturesTranslator = {
  (key: string, values?: Record<string, string | number | Date>): string;
  raw: (key: string) => unknown;
};

/**
 * Ricompone la pagina funzionalità localizzata (testi da messages +
 * icone/screenshot da FEATURE_MEDIA). `t` è scoped a 'public.features'.
 */
export function buildFeaturePage(slug: string, t: FeaturesTranslator): FeaturePage | undefined {
  const media = FEATURE_MEDIA.find((f) => f.slug === slug);
  if (!media) return undefined;

  const p = (key: string) => t(`pages.${slug}.${key}`);
  const texts = t.raw(`pages.${slug}.capabilities`) as { title: string; text: string }[];
  const faqs = t.raw(`pages.${slug}.faqs`) as FeatureFaq[];

  return {
    slug,
    navLabel: p('navLabel'),
    metaTitle: p('metaTitle'),
    metaDescription: p('metaDescription'),
    badge: p('badge'),
    h1: p('h1'),
    h1Highlight: p('h1Highlight'),
    sub: p('sub'),
    cardText: p('cardText'),
    capabilities: media.icons.map((icon, i) => ({
      icon,
      title: texts[i]?.title ?? '',
      text: texts[i]?.text ?? '',
    })),
    screenshot: { src: media.screenshotSrc, alt: p('screenshotAlt') },
    faqs,
  };
}

/** Tutte le pagine funzionalità localizzate, in ordine di navigazione. */
export function buildFeaturePages(t: FeaturesTranslator): FeaturePage[] {
  return FEATURE_SLUGS.map((slug) => buildFeaturePage(slug, t)!)
}
