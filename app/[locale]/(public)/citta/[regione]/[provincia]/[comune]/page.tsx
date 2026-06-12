import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  Anchor,
  Badge,
  Box,
  Breadcrumbs,
  Button,
  Card,
  Container,
  Grid,
  GridCol,
  Group,
  List,
  ListItem,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
  rem,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconArrowRight,
  IconCalendar,
  IconCheck,
  IconCreditCard,
  IconMapPin,
  IconMessage,
  IconSchool,
  IconUsers,
} from '@tabler/icons-react';
import Link from 'next/link';
import { comuni, getComuneWithContext } from '@/data/italia';
import { CtaBanner, PUB_GRADIENT } from '@/components/public/PublicUI';

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
    return { title: 'Comune non trovato' };
  }

  const { comune, provincia, regione } = context;

  return {
    title: `Software Gestione Scuola a ${comune.nome}`,
    description: `Cerchi un software gestionale per la tua scuola a ${comune.nome}? InsegnaMi.pro è la soluzione per scuole private, accademie e centri di formazione a ${comune.nome}, ${provincia.nome}. Prova gratis!`,
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

  // Comuni vicini (stessa provincia, comune diverso)
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

  // Motivi della checklist "Perché le scuole ci scelgono"
  const reasons = [
    { title: 'Prova gratuita 14 giorni', desc: 'Testa tutte le funzionalità senza impegno' },
    { title: 'Nessuna carta di credito', desc: 'Inizia subito, paghi solo se ti piace' },
    { title: 'Supporto in italiano', desc: 'Team dedicato disponibile via chat, email e telefono' },
    { title: 'Conforme GDPR', desc: 'Dati protetti e conformità alle normative sulla privacy' },
    { title: 'Aggiornamenti inclusi', desc: 'Nuove funzionalità e miglioramenti costanti' },
    { title: 'Import dati', desc: 'Migra facilmente da Excel o altri software' },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero */}
      <Box className="pub-hero" py={{ base: 40, sm: 56 }}>
        <Container size="xl">
          <Stack gap="lg">
            <Breadcrumbs>
              <Anchor component={Link} href={`/${locale}`} size="sm" c="indigo.6" underline="hover">
                Home
              </Anchor>
              <Anchor
                component={Link}
                href={`/${locale}/citta`}
                size="sm"
                c="indigo.6"
                underline="hover"
              >
                Città
              </Anchor>
              <Anchor
                component={Link}
                href={`/${locale}/citta/${regione.slug}`}
                size="sm"
                c="indigo.6"
                underline="hover"
              >
                {regione.nome}
              </Anchor>
              <Anchor
                component={Link}
                href={`/${locale}/citta/${regione.slug}/${provincia.slug}`}
                size="sm"
                c="indigo.6"
                underline="hover"
              >
                {provincia.nome}
              </Anchor>
              <Text size="sm" c="dimmed">
                {comune.nome}
              </Text>
            </Breadcrumbs>

            <Group gap="lg" wrap="nowrap" align="flex-start">
              <ThemeIcon size={64} radius="lg" variant="gradient" gradient={PUB_GRADIENT}>
                <IconMapPin size={34} />
              </ThemeIcon>
              <Box>
                <Badge size="lg" variant="light" color="indigo" radius="xl" mb="sm">
                  Comune
                </Badge>
                <Title fz={{ base: rem(28), sm: rem(34) }} fw={900} lh={1.15} c="var(--pub-ink)" mb={8}>
                  Software Gestione Scuola a {comune.nome}
                </Title>
                <Text size="lg" c="dimmed">
                  Il gestionale per scuole private e accademie
                </Text>
                <Group gap="sm" mt="md">
                  <Badge variant="light" color="indigo" size="lg" radius="xl">
                    {provincia.sigla}
                  </Badge>
                  {comune.popolazione && (
                    <Badge
                      variant="light"
                      color="indigo"
                      size="lg"
                      radius="xl"
                      leftSection={<IconUsers size={14} />}
                    >
                      {comune.popolazione.toLocaleString('it-IT')} abitanti
                    </Badge>
                  )}
                  <Badge variant="light" color="indigo" size="lg" radius="xl">
                    CAP {comune.cap}
                  </Badge>
                </Group>
              </Box>
            </Group>
          </Stack>
        </Container>
      </Box>

      {/* Contenuto principale + sidebar */}
      <Box bg="white" py={{ base: 32, sm: 48 }}>
        <Container size="xl">
          <Stack gap="xl">
            {/* Link di ritorno */}
            <Anchor
              component={Link}
              href={`/${locale}/citta/${regione.slug}/${provincia.slug}`}
              size="sm"
              c="indigo.6"
              fw={500}
              underline="hover"
              display="inline-block"
            >
              <Group gap={6} wrap="nowrap">
                <IconArrowLeft size={16} />
                Provincia di {provincia.nome}
              </Group>
            </Anchor>

            <Grid gutter={{ base: 'lg', md: 'xl' }}>
              {/* Colonna principale */}
              <GridCol span={{ base: 12, md: 8 }}>
                <Stack gap="xl">
                  {/* Introduzione */}
                  <Box>
                    <Title
                      order={2}
                      fz={{ base: rem(26), sm: rem(30) }}
                      fw={800}
                      c="var(--pub-ink)"
                      mb="md"
                    >
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

                  {/* Funzionalità */}
                  <Box>
                    <Title
                      order={2}
                      fz={{ base: rem(26), sm: rem(30) }}
                      fw={800}
                      c="var(--pub-ink)"
                      mb="lg"
                    >
                      Cosa Puoi Fare con InsegnaMi.pro a {comune.nome}
                    </Title>
                    <Stack gap="md">
                      {features.map((feature) => (
                        <Card key={feature.title} withBorder radius="lg" padding="lg">
                          <Group gap="md" align="flex-start" wrap="nowrap">
                            <ThemeIcon size={44} radius="md" variant="light" color="indigo">
                              <feature.icon size={24} />
                            </ThemeIcon>
                            <Box style={{ flex: 1 }}>
                              <Title order={4} fz={rem(18)} fw={700} c="var(--pub-ink)" mb={4}>
                                {feature.title}
                              </Title>
                              <Text size="sm" c="dimmed" lh={1.6}>
                                {feature.description}
                              </Text>
                            </Box>
                          </Group>
                        </Card>
                      ))}
                    </Stack>
                  </Box>

                  {/* Perché sceglierci */}
                  <Card withBorder radius="lg" padding="xl">
                    <Title order={2} fz={rem(22)} fw={700} c="var(--pub-ink)" mb="lg">
                      Perché le Scuole di {comune.nome} Scelgono InsegnaMi.pro
                    </Title>
                    <List
                      spacing="md"
                      icon={
                        <ThemeIcon size={24} radius="xl" color="teal" variant="light">
                          <IconCheck size={14} />
                        </ThemeIcon>
                      }
                    >
                      {reasons.map((item) => (
                        <ListItem key={item.title}>
                          <Text size="sm" fw={600} c="var(--pub-ink)">
                            {item.title}
                          </Text>
                          <Text size="sm" c="dimmed">
                            {item.desc}
                          </Text>
                        </ListItem>
                      ))}
                    </List>
                  </Card>
                </Stack>
              </GridCol>

              {/* Sidebar */}
              <GridCol span={{ base: 12, md: 4 }}>
                <Stack gap="lg" style={{ position: 'sticky', top: 88 }}>
                  {/* Card CTA */}
                  <Card padding="xl" radius="lg" style={{ background: 'var(--pub-brand-gradient)' }}>
                    <Stack gap="md">
                      <Title order={3} fz={rem(20)} fw={700} c="white" ta="center">
                        Prova Gratis
                      </Title>
                      <Text ta="center" size="sm" c="white" opacity={0.9}>
                        14 giorni di prova gratuita per la tua scuola a {comune.nome}
                      </Text>
                      <Button
                        component={Link}
                        href={`/${locale}/auth/register`}
                        variant="white"
                        c="indigo.7"
                        radius="xl"
                        fw={700}
                        fullWidth
                        rightSection={<IconArrowRight size={16} />}
                      >
                        Inizia la Prova Gratuita
                      </Button>
                      <Text ta="center" size="xs" c="white" opacity={0.85}>
                        Nessuna carta di credito richiesta
                      </Text>
                    </Stack>
                  </Card>

                  {/* Card informazioni */}
                  <Card withBorder radius="lg" padding="xl">
                    <Stack gap="sm">
                      <Title order={4} fz={rem(16)} fw={700} c="var(--pub-ink)">
                        Informazioni su {comune.nome}
                      </Title>
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

                  {/* Card contatti */}
                  <Card withBorder radius="lg" padding="xl">
                    <Stack gap="sm">
                      <Title order={4} fz={rem(16)} fw={700} c="var(--pub-ink)">
                        Hai Domande?
                      </Title>
                      <Text size="sm" c="dimmed">
                        Il nostro team è disponibile per aiutarti a scegliere il piano giusto
                        per la tua scuola a {comune.nome}.
                      </Text>
                      <Button
                        component={Link}
                        href={`/${locale}/contact`}
                        variant="light"
                        color="indigo"
                        radius="xl"
                        fullWidth
                      >
                        Contattaci
                      </Button>
                    </Stack>
                  </Card>
                </Stack>
              </GridCol>
            </Grid>
          </Stack>
        </Container>
      </Box>

      {/* Comuni vicini */}
      {nearbyCities.length > 0 && (
        <Box bg="var(--pub-surface)" py={{ base: 32, sm: 48 }}>
          <Container size="xl">
            <Title
              order={2}
              fz={{ base: rem(26), sm: rem(30) }}
              fw={800}
              c="var(--pub-ink)"
              mb="lg"
            >
              InsegnaMi.pro in Altri Comuni di {provincia.nome}
            </Title>
            <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="md">
              {nearbyCities.map((city) => (
                <Card
                  key={city.codice}
                  component={Link}
                  href={`/${locale}/citta/${regione.slug}/${provincia.slug}/${city.slug}`}
                  className="pub-card"
                  padding="md"
                  radius="lg"
                  bg="white"
                  style={{ textDecoration: 'none' }}
                >
                  <Text size="sm" fw={600} c="var(--pub-ink)" ta="center">
                    {city.nome}
                  </Text>
                </Card>
              ))}
            </SimpleGrid>
          </Container>
        </Box>
      )}

      {/* CTA finale */}
      <CtaBanner
        locale={locale}
        title={`Inizia Oggi con InsegnaMi.pro a ${comune.nome}`}
        subtitle={`Unisciti alle scuole di ${comune.nome} e ${provincia.nome} che hanno già scelto InsegnaMi.pro per semplificare la gestione quotidiana. Prova gratuita di 14 giorni, nessuna carta di credito richiesta.`}
      />
    </>
  );
}
