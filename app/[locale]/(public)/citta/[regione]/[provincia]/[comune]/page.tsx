import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  Container,
  Title,
  Text,
  SimpleGrid,
  Card,
  Stack,
  Badge,
  Group,
  Anchor,
  Breadcrumbs,
  Box,
  ThemeIcon,
  Divider,
} from '@mantine/core';
import {
  IconMapPin,
  IconUsers,
  IconArrowLeft,
  IconCheck,
  IconSchool,
  IconCreditCard,
  IconCalendar,
  IconMessage,
} from '@tabler/icons-react';
import Link from 'next/link';
import {
  regioni,
  province,
  comuni,
  getRegione,
  getProvincia,
  getComuneWithContext,
} from '@/data/italia';

export async function generateStaticParams() {
  const locales = ['it', 'en', 'fr', 'pt'];
  const params: { locale: string; regione: string; provincia: string; comune: string }[] = [];

  for (const locale of locales) {
    for (const comune of comuni) {
      const context = getComuneWithContext(comune.slug);
      if (context) {
        params.push({
          locale,
          regione: context.regione.slug,
          provincia: context.provincia.slug,
          comune: comune.slug,
        });
      }
    }
  }

  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; regione: string; provincia: string; comune: string }>;
}): Promise<Metadata> {
  const { locale, comune: comuneSlug } = await params;
  const context = getComuneWithContext(comuneSlug);

  if (!context) {
    return { title: 'Comune non trovato | InsegnaMi.pro' };
  }

  const { comune, provincia, regione } = context;

  return {
    title: `Software Gestione Scuola a ${comune.nome} | InsegnaMi.pro`,
    description: `Cerchi un software gestionale per la tua scuola a ${comune.nome}? InsegnaMi.pro è la soluzione #1 per scuole private, accademie e centri di formazione a ${comune.nome}, ${provincia.nome}. Prova gratis!`,
    keywords: [
      `software gestione scuola ${comune.nome}`,
      `gestionale scolastico ${comune.nome}`,
      `scuola privata ${comune.nome}`,
      `registro elettronico ${comune.nome}`,
      `software scuola ${provincia.sigla}`,
    ],
    openGraph: {
      title: `Software Gestione Scuola a ${comune.nome} | InsegnaMi.pro`,
      description: `Il miglior software gestionale per scuole a ${comune.nome}. Gestisci studenti, docenti, pagamenti e molto altro.`,
      type: 'website',
    },
    alternates: {
      canonical: `https://insegnami.pro/${locale}/citta/${regione.slug}/${provincia.slug}/${comune.slug}`,
    },
  };
}

export default async function ComunePage({
  params,
}: {
  params: Promise<{ locale: string; regione: string; provincia: string; comune: string }>;
}) {
  const { locale, comune: comuneSlug } = await params;
  const context = getComuneWithContext(comuneSlug);

  if (!context) {
    notFound();
  }

  const { comune, provincia, regione } = context;

  // Get nearby cities (same province, different comune)
  const nearbyCities = comuni
    .filter((c) => c.provincia === provincia.codice && c.slug !== comune.slug)
    .slice(0, 6);

  // JSON-LD LocalBusiness schema for SEO
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'InsegnaMi.pro',
    description: `Software gestionale per scuole a ${comune.nome}`,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'EUR',
      description: 'Prova gratuita 14 giorni',
    },
    areaServed: {
      '@type': 'City',
      name: comune.nome,
      containedInPlace: {
        '@type': 'AdministrativeArea',
        name: provincia.nome,
        containedInPlace: {
          '@type': 'AdministrativeArea',
          name: regione.nome,
          containedInPlace: {
            '@type': 'Country',
            name: 'Italia',
          },
        },
      },
    },
    provider: {
      '@type': 'Organization',
      name: 'InsegnaMi.pro',
      url: 'https://insegnami.pro',
    },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: `https://insegnami.pro/${locale}`,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Città',
          item: `https://insegnami.pro/${locale}/citta`,
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: regione.nome,
          item: `https://insegnami.pro/${locale}/citta/${regione.slug}`,
        },
        {
          '@type': 'ListItem',
          position: 4,
          name: provincia.nome,
          item: `https://insegnami.pro/${locale}/citta/${regione.slug}/${provincia.slug}`,
        },
        {
          '@type': 'ListItem',
          position: 5,
          name: comune.nome,
          item: `https://insegnami.pro/${locale}/citta/${regione.slug}/${provincia.slug}/${comune.slug}`,
        },
      ],
    },
  };

  const features = [
    {
      icon: IconSchool,
      title: 'Gestione Studenti',
      description: `Gestisci facilmente tutti gli studenti della tua scuola a ${comune.nome}. Iscrizioni, anagrafica, documenti e storico in un unico posto.`,
    },
    {
      icon: IconUsers,
      title: 'Gestione Docenti',
      description: 'Organizza docenti, orari, disponibilità e compensi. Assegna classi e monitora le ore di lezione.',
    },
    {
      icon: IconCreditCard,
      title: 'Fatturazione e Pagamenti',
      description: 'Genera fatture, gestisci pagamenti e monitora gli incassi. Integrazione con i principali metodi di pagamento.',
    },
    {
      icon: IconCalendar,
      title: 'Calendario e Presenze',
      description: 'Calendario condiviso, gestione presenze e registro elettronico. Notifiche automatiche per genitori e studenti.',
    },
    {
      icon: IconMessage,
      title: 'Comunicazioni',
      description: `Comunica con famiglie e studenti di ${comune.nome} via email, SMS e notifiche push. Newsletter e avvisi automatici.`,
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero Section */}
      <Box
        style={{
          background: 'linear-gradient(135deg, var(--mantine-color-blue-6) 0%, var(--mantine-color-cyan-5) 100%)',
          color: 'white',
          padding: '3rem 0',
        }}
      >
        <Container size="xl">
          <Stack gap="md">
            <Breadcrumbs
              styles={{
                breadcrumb: { color: 'rgba(255,255,255,0.8)' },
                separator: { color: 'rgba(255,255,255,0.5)' },
              }}
            >
              <Anchor component={Link} href={`/${locale}`} c="white">
                Home
              </Anchor>
              <Anchor component={Link} href={`/${locale}/citta`} c="white">
                Città
              </Anchor>
              <Anchor component={Link} href={`/${locale}/citta/${regione.slug}`} c="white">
                {regione.nome}
              </Anchor>
              <Anchor component={Link} href={`/${locale}/citta/${regione.slug}/${provincia.slug}`} c="white">
                {provincia.nome}
              </Anchor>
              <Text c="white">{comune.nome}</Text>
            </Breadcrumbs>

            <Group gap="lg" align="flex-start">
              <ThemeIcon size={70} radius="xl" variant="white" color="blue">
                <IconMapPin size={35} />
              </ThemeIcon>
              <Stack gap="xs" style={{ flex: 1 }}>
                <Title order={1}>
                  Software Gestione Scuola a {comune.nome}
                </Title>
                <Text size="xl">
                  Il gestionale scolastico #1 per scuole private e accademie
                </Text>
                <Group gap="md" mt="xs">
                  <Badge color="white" variant="filled" c="blue" size="lg">
                    {provincia.sigla}
                  </Badge>
                  {comune.popolazione && (
                    <Badge color="white" variant="light" size="lg">
                      <Group gap={4}>
                        <IconUsers size={14} />
                        {comune.popolazione.toLocaleString('it-IT')} abitanti
                      </Group>
                    </Badge>
                  )}
                  <Badge color="white" variant="light" size="lg">
                    CAP {comune.cap}
                  </Badge>
                </Group>
              </Stack>
            </Group>
          </Stack>
        </Container>
      </Box>

      <Container size="xl" py="xl">
        <Stack gap="xl">
          {/* Back link */}
          <Anchor component={Link} href={`/${locale}/citta/${regione.slug}/${provincia.slug}`} size="sm">
            <Group gap={4}>
              <IconArrowLeft size={16} />
              Provincia di {provincia.nome}
            </Group>
          </Anchor>

          {/* Main Content */}
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="xl">
            {/* Left Column - Main Content */}
            <Box style={{ gridColumn: 'span 2' }}>
              <Stack gap="xl">
                {/* Introduction */}
                <Box>
                  <Title order={2} mb="md">
                    InsegnaMi.pro per le Scuole di {comune.nome}
                  </Title>
                  <Text size="lg" mb="md">
                    Stai cercando un software gestionale per la tua scuola privata, accademia musicale,
                    scuola di danza o centro di formazione a {comune.nome}? InsegnaMi.pro è la soluzione
                    completa e professionale che ti permette di gestire ogni aspetto della tua attività
                    educativa.
                  </Text>
                  <Text c="dimmed">
                    Con InsegnaMi.pro, le scuole di {comune.nome} e della provincia di {provincia.nome} ({provincia.sigla})
                    possono finalmente dire addio a fogli Excel, registri cartacei e software complicati.
                    La nostra piattaforma è stata progettata pensando alle esigenze specifiche delle
                    scuole italiane, con conformità GDPR e supporto in italiano.
                  </Text>
                </Box>

                {/* Features */}
                <Box>
                  <Title order={2} mb="lg">
                    Cosa Puoi Fare con InsegnaMi.pro a {comune.nome}
                  </Title>
                  <Stack gap="md">
                    {features.map((feature) => (
                      <Card key={feature.title} withBorder p="md">
                        <Group gap="md" align="flex-start">
                          <ThemeIcon size={40} radius="md" color="blue" variant="light">
                            <feature.icon size={20} />
                          </ThemeIcon>
                          <Box style={{ flex: 1 }}>
                            <Title order={4} mb={4}>
                              {feature.title}
                            </Title>
                            <Text size="sm" c="dimmed">
                              {feature.description}
                            </Text>
                          </Box>
                        </Group>
                      </Card>
                    ))}
                  </Stack>
                </Box>

                {/* Why Choose Us */}
                <Box p="xl" style={{ backgroundColor: 'var(--mantine-color-gray-0)', borderRadius: 'var(--mantine-radius-md)' }}>
                  <Title order={2} mb="lg">
                    Perché le Scuole di {comune.nome} Scelgono InsegnaMi.pro
                  </Title>
                  <Stack gap="sm">
                    {[
                      { title: 'Prova gratuita 14 giorni', desc: 'Testa tutte le funzionalità senza impegno' },
                      { title: 'Nessuna carta di credito', desc: 'Inizia subito, paghi solo se ti piace' },
                      { title: 'Supporto in italiano', desc: 'Team dedicato disponibile via chat, email e telefono' },
                      { title: 'Conforme GDPR', desc: 'Dati protetti e conformità alle normative sulla privacy' },
                      { title: 'Aggiornamenti inclusi', desc: 'Nuove funzionalità e miglioramenti costanti' },
                      { title: 'Import dati', desc: 'Migra facilmente da Excel o altri software' },
                    ].map((item, index) => (
                      <Group key={index} gap="sm" align="flex-start">
                        <ThemeIcon color="green" size={24} radius="xl">
                          <IconCheck size={16} />
                        </ThemeIcon>
                        <Text size="md">
                          <strong>{item.title}</strong> - {item.desc}
                        </Text>
                      </Group>
                    ))}
                  </Stack>
                </Box>
              </Stack>
            </Box>

            {/* Right Column - Sidebar */}
            <Box>
              <Stack gap="lg" style={{ position: 'sticky', top: 100 }}>
                {/* CTA Card */}
                <Card withBorder p="xl" radius="md" bg="blue.0">
                  <Stack gap="md">
                    <Title order={3} ta="center">
                      Prova Gratis
                    </Title>
                    <Text ta="center" size="sm" c="dimmed">
                      14 giorni di prova gratuita per la tua scuola a {comune.nome}
                    </Text>
                    <Anchor
                      component={Link}
                      href="/auth/register"
                      style={{
                        backgroundColor: 'var(--mantine-color-blue-6)',
                        color: 'white',
                        padding: '0.75rem 1.5rem',
                        borderRadius: 'var(--mantine-radius-md)',
                        textDecoration: 'none',
                        fontWeight: 500,
                        textAlign: 'center',
                        display: 'block',
                      }}
                    >
                      Inizia la Prova Gratuita
                    </Anchor>
                    <Text ta="center" size="xs" c="dimmed">
                      Nessuna carta di credito richiesta
                    </Text>
                  </Stack>
                </Card>

                {/* Info Card */}
                <Card withBorder p="md">
                  <Stack gap="sm">
                    <Title order={4}>Informazioni su {comune.nome}</Title>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Provincia</Text>
                      <Text size="sm" fw={500}>{provincia.nome} ({provincia.sigla})</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Regione</Text>
                      <Text size="sm" fw={500}>{regione.nome}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">CAP</Text>
                      <Text size="sm" fw={500}>{comune.cap}</Text>
                    </Group>
                    {comune.popolazione && (
                      <Group justify="space-between">
                        <Text size="sm" c="dimmed">Popolazione</Text>
                        <Text size="sm" fw={500}>
                          {comune.popolazione.toLocaleString('it-IT')}
                        </Text>
                      </Group>
                    )}
                  </Stack>
                </Card>

                {/* Contact Card */}
                <Card withBorder p="md">
                  <Stack gap="sm">
                    <Title order={4}>Hai Domande?</Title>
                    <Text size="sm" c="dimmed">
                      Il nostro team è disponibile per aiutarti a scegliere il piano giusto
                      per la tua scuola a {comune.nome}.
                    </Text>
                    <Anchor
                      component={Link}
                      href={`/${locale}/contact`}
                      style={{
                        borderColor: 'var(--mantine-color-blue-6)',
                        color: 'var(--mantine-color-blue-6)',
                        border: '1px solid',
                        padding: '0.5rem 1rem',
                        borderRadius: 'var(--mantine-radius-md)',
                        textDecoration: 'none',
                        textAlign: 'center',
                        display: 'block',
                      }}
                    >
                      Contattaci
                    </Anchor>
                  </Stack>
                </Card>
              </Stack>
            </Box>
          </SimpleGrid>

          <Divider />

          {/* Nearby Cities */}
          {nearbyCities.length > 0 && (
            <Box>
              <Title order={2} mb="lg">
                InsegnaMi.pro in Altri Comuni di {provincia.nome}
              </Title>
              <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} spacing="md">
                {nearbyCities.map((city) => (
                  <Card
                    key={city.codice}
                    component={Link}
                    href={`/${locale}/citta/${regione.slug}/${provincia.slug}/${city.slug}`}
                    withBorder
                    p="sm"
                    radius="md"
                    style={{ textDecoration: 'none' }}
                  >
                    <Text size="sm" fw={500} ta="center">
                      {city.nome}
                    </Text>
                  </Card>
                ))}
              </SimpleGrid>
            </Box>
          )}

          {/* Bottom CTA */}
          <Card withBorder p="xl" radius="md" bg="blue.0" ta="center" mt="xl">
            <Stack align="center" gap="md">
              <Title order={2}>
                Inizia Oggi con InsegnaMi.pro a {comune.nome}
              </Title>
              <Text c="dimmed" maw={600}>
                Unisciti alle scuole di {comune.nome} e {provincia.nome} che hanno già scelto
                InsegnaMi.pro per semplificare la gestione quotidiana. Prova gratuita di 14 giorni,
                nessuna carta di credito richiesta.
              </Text>
              <Group gap="md">
                <Anchor
                  component={Link}
                  href="/auth/register"
                  style={{
                    backgroundColor: 'var(--mantine-color-blue-6)',
                    color: 'white',
                    padding: '0.75rem 2rem',
                    borderRadius: 'var(--mantine-radius-md)',
                    textDecoration: 'none',
                    fontWeight: 500,
                  }}
                >
                  Inizia la Prova Gratuita
                </Anchor>
                <Anchor
                  component={Link}
                  href={`/${locale}/pricing`}
                  style={{
                    borderColor: 'var(--mantine-color-blue-6)',
                    color: 'var(--mantine-color-blue-6)',
                    border: '1px solid',
                    padding: '0.75rem 2rem',
                    borderRadius: 'var(--mantine-radius-md)',
                    textDecoration: 'none',
                    fontWeight: 500,
                  }}
                >
                  Vedi i Prezzi
                </Anchor>
              </Group>
            </Stack>
          </Card>
        </Stack>
      </Container>
    </>
  );
}
