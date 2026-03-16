'use client';

import {
  Container,
  Title,
  Text,
  Button,
  Group,
  Stack,
  Card,
  Badge,
  ThemeIcon,
  Grid,
  Paper,
  Divider,
  Anchor,
  Box,
  Center,
  SimpleGrid,
  rem
} from '@mantine/core';
import {
  IconCheck,
  IconUsers,
  IconCalendarEvent,
  IconClipboardCheck,
  IconCreditCard,
  IconBell,
  IconFileText,
  IconShield,
  IconHeadset,
  IconStar,
  IconArrowRight,
  IconSchool,
  IconChartBar,
  IconMail,
  IconSparkles,
  IconRocket,
  IconTrendingUp,
  IconCalculator,
  IconCalendar,
  IconTable,
  IconClock
} from '@tabler/icons-react';
import Link from 'next/link';

const features = [
  {
    icon: IconUsers,
    title: 'Gestione Studenti',
    description: 'Anagrafica completa, iscrizioni, classi e comunicazioni con i genitori',
    color: 'blue'
  },
  {
    icon: IconCalendarEvent,
    title: 'Calendario & Lezioni',
    description: 'Pianificazione lezioni, calendario integrato e gestione orari',
    color: 'cyan'
  },
  {
    icon: IconClipboardCheck,
    title: 'Presenze Digitali',
    description: 'Registro presenze digitale con statistiche e notifiche automatiche',
    color: 'green'
  },
  {
    icon: IconCreditCard,
    title: 'Gestione Pagamenti',
    description: 'Fatturazione, rate, promemoria e tracking pagamenti',
    color: 'orange'
  },
  {
    icon: IconBell,
    title: 'Comunicazioni',
    description: 'Bacheca, notifiche email/SMS e comunicazioni scuola-famiglia',
    color: 'grape'
  },
  {
    icon: IconFileText,
    title: 'Materiali Didattici',
    description: 'Upload e condivisione di materiali, documenti e risorse',
    color: 'indigo'
  },
  {
    icon: IconChartBar,
    title: 'Report & Analytics',
    description: 'Dashboard con statistiche, report personalizzati e analytics',
    color: 'pink'
  },
  {
    icon: IconShield,
    title: 'Sicurezza GDPR',
    description: 'Conforme alle normative privacy e protezione dati',
    color: 'red'
  }
];

const stats = [
  { value: '500+', label: 'Scuole Attive', icon: IconSchool },
  { value: '50k+', label: 'Studenti', icon: IconUsers },
  { value: '99.9%', label: 'Uptime', icon: IconTrendingUp },
  { value: '24/7', label: 'Supporto', icon: IconHeadset }
];

const toolsShowcase = [
  {
    slug: 'calcolatore-media-voti',
    title: 'Calcolatore Media Voti',
    description: 'Calcola la media dei voti con pesi personalizzati.',
    icon: IconCalculator,
    color: 'blue',
  },
  {
    slug: 'calcolatore-presenze',
    title: 'Calcolatore Presenze',
    description: 'Calcola la percentuale di frequenza e verifica il monte ore.',
    icon: IconClipboardCheck,
    color: 'green',
  },
  {
    slug: 'generatore-calendario-scolastico',
    title: 'Generatore Calendario',
    description: 'Genera un calendario scolastico con festività e vacanze.',
    icon: IconCalendar,
    color: 'violet',
  },
  {
    slug: 'generatore-orario-settimanale',
    title: 'Generatore Orario',
    description: 'Crea un orario settimanale delle lezioni da stampare.',
    icon: IconTable,
    color: 'cyan',
  },
];

export function HomepageContent({ locale }: { locale: string }) {
  return (
    <Box style={{ overflow: 'hidden' }}>
      {/* Hero Section */}
      <Box style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <Box style={{
          position: 'absolute',
          top: '10%',
          right: '10%',
          width: '300px',
          height: '300px',
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '50%',
          filter: 'blur(60px)',
        }} />
        <Box style={{
          position: 'absolute',
          bottom: '10%',
          left: '5%',
          width: '400px',
          height: '400px',
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '50%',
          filter: 'blur(80px)',
        }} />

        <Container size="xl" style={{ position: 'relative', zIndex: 1 }} py={120}>
          <Grid align="center" gutter={50}>
            <Grid.Col span={{ base: 12, md: 7 }}>
              <Badge
                size="lg"
                variant="light"
                color="yellow"
                leftSection={<IconSparkles size={16} />}
                mb="md"
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.3)'
                }}
              >
                Il Futuro della Gestione Scolastica
              </Badge>

              <Title
                style={{
                  fontSize: rem(56),
                  fontWeight: 900,
                  color: 'white',
                  lineHeight: 1.2,
                  marginBottom: rem(20)
                }}
              >
                <Text component="span" inherit style={{
                  background: 'linear-gradient(45deg, #ffd700, #ffed4e)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  display: 'inline-block'
                }}>
                  InsegnaMi.pro
                </Text>
                <br />
                Gestione Scolastica<br />
                Ridefinita
              </Title>

              <Text size="xl" c="white" mb={30} style={{ opacity: 0.95, maxWidth: '600px' }}>
                La piattaforma all-in-one che trasforma la gestione della tua scuola.
                Tutto in un unico posto: studenti, presenze, pagamenti e molto altro.
              </Text>

              <Group gap="md">
                <Button
                  component={Link}
                  href={`/${locale}/auth/register`}
                  size="xl"
                  radius="xl"
                  style={{
                    background: 'white',
                    color: '#667eea',
                    fontWeight: 700,
                    padding: '0 40px'
                  }}
                  rightSection={<IconRocket size={20} />}
                >
                  Inizia Gratis
                </Button>
                <Button
                  component={Link}
                  href={`/${locale}/auth/login?demo=true`}
                  variant="outline"
                  size="xl"
                  radius="xl"
                  style={{
                    borderColor: 'white',
                    color: 'white',
                    backdropFilter: 'blur(10px)',
                    background: 'rgba(255, 255, 255, 0.1)'
                  }}
                >
                  Demo Live
                </Button>
              </Group>

              <Group mt="md">
                <Anchor component={Link} href={`/${locale}/auth/login`} c="white" size="sm" style={{ opacity: 0.9 }}>
                  Sei già registrato? Accedi
                </Anchor>
              </Group>

              <Group mt={30} gap={40}>
                <Group gap="xs">
                  <IconCheck size={20} color="white" />
                  <Text c="white" size="sm" fw={500}>14 giorni gratis</Text>
                </Group>
                <Group gap="xs">
                  <IconCheck size={20} color="white" />
                  <Text c="white" size="sm" fw={500}>No carta richiesta</Text>
                </Group>
                <Group gap="xs">
                  <IconCheck size={20} color="white" />
                  <Text c="white" size="sm" fw={500}>Cancella quando vuoi</Text>
                </Group>
              </Group>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 5 }}>
              <Box style={{
                position: 'relative',
                padding: rem(40)
              }}>
                <Card
                  shadow="xl"
                  radius="xl"
                  p="xl"
                  style={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    transform: 'rotate(-3deg)'
                  }}
                >
                  <SimpleGrid cols={2} spacing="md">
                    {stats.map((stat, index) => (
                      <Box key={index} style={{ textAlign: 'center' }}>
                        <stat.icon size={32} color="white" />
                        <Text size="xl" fw={900} c="white" mt="xs">{stat.value}</Text>
                        <Text size="sm" c="white" style={{ opacity: 0.9 }}>{stat.label}</Text>
                      </Box>
                    ))}
                  </SimpleGrid>
                </Card>
              </Box>
            </Grid.Col>
          </Grid>
        </Container>
      </Box>

      {/* Features Section */}
      <Box id="features" py={100} style={{ background: '#f8f9fa' }}>
        <Container size="xl">
          <Center mb={60}>
            <Stack gap="md" style={{ textAlign: 'center', maxWidth: '700px' }}>
              <Badge size="lg" variant="light" color="violet">Funzionalità Complete</Badge>
              <Title order={2} size={rem(42)} fw={900}>
                Tutto quello che ti serve,
                <Text component="span" inherit c="violet"> in un unico posto</Text>
              </Title>
              <Text size="lg" c="dimmed">
                Una piattaforma completa che semplifica ogni aspetto della gestione scolastica
              </Text>
            </Stack>
          </Center>

          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="lg">
            {features.map((feature, index) => (
              <Card
                key={index}
                padding="xl"
                radius="lg"
                className="homepage-feature-card"
                style={{
                  height: '100%',
                  border: '2px solid transparent',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                }}
              >
                <ThemeIcon
                  size={60}
                  radius="lg"
                  color={feature.color}
                  variant="light"
                  mb="md"
                >
                  <feature.icon size={32} />
                </ThemeIcon>
                <Text fw={700} size="lg" mb="xs">
                  {feature.title}
                </Text>
                <Text size="sm" c="dimmed" style={{ lineHeight: 1.6 }}>
                  {feature.description}
                </Text>
              </Card>
            ))}
          </SimpleGrid>
        </Container>
      </Box>

      {/* Tools Showcase Section */}
      <Box py={100}>
        <Container size="xl">
          <Center mb={60}>
            <Stack gap="md" style={{ textAlign: 'center', maxWidth: '700px' }}>
              <Badge size="lg" variant="light" color="teal">100% Gratuiti</Badge>
              <Title order={2} size={rem(42)} fw={900}>
                Strumenti Gratuiti per la Tua Scuola
              </Title>
              <Text size="lg" c="dimmed">
                Calcolatori e generatori utili per la gestione quotidiana. Nessuna registrazione richiesta.
              </Text>
            </Stack>
          </Center>

          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="lg">
            {toolsShowcase.map((tool) => (
              <Card
                key={tool.slug}
                component={Link}
                href={`/${locale}/tools/${tool.slug}`}
                shadow="sm"
                padding="xl"
                radius="lg"
                withBorder
                style={{ textDecoration: 'none', transition: 'all 0.3s ease' }}
                className="homepage-feature-card"
              >
                <ThemeIcon size={50} radius="md" color={tool.color} variant="light" mb="md">
                  <tool.icon size={28} />
                </ThemeIcon>
                <Text fw={700} size="lg" mb="xs">{tool.title}</Text>
                <Text size="sm" c="dimmed">{tool.description}</Text>
              </Card>
            ))}
          </SimpleGrid>

          <Center mt="xl">
            <Button
              component={Link}
              href={`/${locale}/tools`}
              variant="outline"
              color="teal"
              size="lg"
              radius="xl"
              rightSection={<IconArrowRight size={18} />}
            >
              Vedi tutti gli strumenti
            </Button>
          </Center>
        </Container>
      </Box>

      {/* Pricing Section */}
      <Box id="pricing" py={100} style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
        position: 'relative'
      }}>
        <Container size="xl">
          <Center mb={60}>
            <Stack gap="md" style={{ textAlign: 'center', maxWidth: '700px' }}>
              <Badge size="lg" variant="light" color="yellow">Prezzi Trasparenti</Badge>
              <Title order={2} size={rem(42)} fw={900} c="white">
                Scegli il piano perfetto per te
              </Title>
              <Text size="lg" style={{ color: 'rgba(255,255,255,0.8)' }}>
                Nessun costo nascosto. Cancella quando vuoi.
              </Text>
            </Stack>
          </Center>

          <Grid gutter={30}>
            {/* SaaS Plans */}
            <Grid.Col span={{ base: 12, lg: 7 }}>
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
                {/* Starter */}
                <Card padding="xl" radius="xl" style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <Badge size="md" variant="light" color="blue" mb="md">Starter</Badge>
                  <Group align="baseline" gap={4} mb="md">
                    <Text size={rem(48)} fw={900} c="white">€29</Text>
                    <Text c="dimmed">/mese</Text>
                  </Group>
                  <Text c="dimmed" size="sm" mb="lg">Fino a 50 studenti</Text>
                  <Button
                    component={Link}
                    href={`/${locale}/pricing?plan=starter`}
                    fullWidth
                    radius="xl"
                    variant="light"
                    color="blue"
                    mb="lg"
                  >
                    Inizia Ora
                  </Button>
                  <Stack gap="xs">
                    {['Funzionalità base', 'Supporto email', 'Backup automatico'].map((item, i) => (
                      <Group key={i} gap="xs">
                        <ThemeIcon size="sm" radius="xl" color="blue" variant="light">
                          <IconCheck size={14} />
                        </ThemeIcon>
                        <Text size="sm" c="white">{item}</Text>
                      </Group>
                    ))}
                  </Stack>
                </Card>

                {/* Professional */}
                <Card padding="xl" radius="xl" style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  backdropFilter: 'blur(20px)',
                  border: '2px solid var(--mantine-color-green-6)',
                  position: 'relative',
                  transform: 'scale(1.05)'
                }}>
                  <Badge
                    size="md"
                    variant="filled"
                    color="green"
                    mb="md"
                    leftSection={<IconStar size={14} />}
                  >
                    Popolare
                  </Badge>
                  <Group align="baseline" gap={4} mb="md">
                    <Text size={rem(48)} fw={900} c="white">€59</Text>
                    <Text c="dimmed">/mese</Text>
                  </Group>
                  <Text c="dimmed" size="sm" mb="lg">Fino a 200 studenti</Text>
                  <Button
                    component={Link}
                    href={`/${locale}/pricing?plan=professional`}
                    fullWidth
                    radius="xl"
                    color="green"
                    mb="lg"
                  >
                    Inizia Ora
                  </Button>
                  <Stack gap="xs">
                    {['Tutto di Starter', 'Analytics avanzate', 'API & integrazioni', 'White-label'].map((item, i) => (
                      <Group key={i} gap="xs">
                        <ThemeIcon size="sm" radius="xl" color="green">
                          <IconCheck size={14} />
                        </ThemeIcon>
                        <Text size="sm" c="white">{item}</Text>
                      </Group>
                    ))}
                  </Stack>
                </Card>

                {/* Enterprise */}
                <Card padding="xl" radius="xl" style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <Badge size="md" variant="light" color="violet" mb="md">Enterprise</Badge>
                  <Group align="baseline" gap={4} mb="md">
                    <Text size={rem(48)} fw={900} c="white">€199</Text>
                    <Text c="dimmed">/mese</Text>
                  </Group>
                  <Text c="dimmed" size="sm" mb="lg">Studenti illimitati</Text>
                  <Button
                    component={Link}
                    href={`/${locale}/contact?subject=enterprise`}
                    fullWidth
                    radius="xl"
                    variant="light"
                    color="violet"
                    mb="lg"
                  >
                    Contattaci
                  </Button>
                  <Stack gap="xs">
                    {['Tutto di Pro', 'Multi-tenant', 'SLA 99.9%', 'Supporto dedicato'].map((item, i) => (
                      <Group key={i} gap="xs">
                        <ThemeIcon size="sm" radius="xl" color="violet" variant="light">
                          <IconCheck size={14} />
                        </ThemeIcon>
                        <Text size="sm" c="white">{item}</Text>
                      </Group>
                    ))}
                  </Stack>
                </Card>
              </SimpleGrid>
            </Grid.Col>

            {/* Full Installation */}
            <Grid.Col span={{ base: 12, lg: 5 }}>
              <Card
                padding="xl"
                radius="xl"
                style={{
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  height: '100%',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <Box style={{
                  position: 'absolute',
                  top: '-50px',
                  right: '-50px',
                  width: '200px',
                  height: '200px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '50%'
                }} />

                <Stack style={{ position: 'relative', zIndex: 1 }}>
                  <Badge
                    size="lg"
                    variant="filled"
                    style={{
                      background: 'rgba(0,0,0,0.2)',
                      alignSelf: 'flex-start'
                    }}
                    leftSection={<IconStar size={16} />}
                  >
                    Più Richiesto
                  </Badge>

                  <Title order={2} c="white" size={rem(32)}>
                    Installazione Full
                  </Title>
                  <Text c="white" size="lg" style={{ opacity: 0.95 }}>
                    La tua scuola, i tuoi server, il tuo controllo totale
                  </Text>

                  <Divider color="rgba(255,255,255,0.3)" my="md" />

                  <Stack gap="lg">
                    <Box>
                      <Group align="baseline" gap={4}>
                        <Text size={rem(42)} fw={900} c="white">€699</Text>
                        <Text c="white" style={{ opacity: 0.9 }}>una tantum</Text>
                      </Group>
                      <Text size="sm" c="white" style={{ opacity: 0.8 }}>
                        Setup + installazione + formazione
                      </Text>
                    </Box>

                    <Box>
                      <Group align="baseline" gap={4}>
                        <Text size={rem(42)} fw={900} c="white">€299</Text>
                        <Text c="white" style={{ opacity: 0.9 }}>/anno</Text>
                      </Group>
                      <Text size="sm" c="white" style={{ opacity: 0.8 }}>
                        Manutenzione + aggiornamenti
                      </Text>
                    </Box>

                    <Paper p="md" radius="md" style={{ background: 'rgba(0,0,0,0.2)' }}>
                      <Text c="white" fw={700} mb="xs">Totale primo anno:</Text>
                      <Text c="white" size="xl" fw={900}>€998</Text>
                      <Text c="white" size="sm" style={{ opacity: 0.9 }} mt="xs">
                        Poi solo €299/anno
                      </Text>
                    </Paper>
                  </Stack>

                  <Divider color="rgba(255,255,255,0.3)" my="md" />

                  <SimpleGrid cols={2} spacing="xs">
                    {['Server proprietari', 'Personalizzazione', 'Codice sorgente', 'Dati tuoi',
                      'No limiti', 'Priorità supporto', 'Formazione inclusa', 'Integrazioni custom'].map((item, i) => (
                      <Group key={i} gap="xs">
                        <ThemeIcon size="sm" radius="xl" style={{ background: 'rgba(255,255,255,0.2)' }}>
                          <IconCheck size={14} />
                        </ThemeIcon>
                        <Text size="sm" c="white">{item}</Text>
                      </Group>
                    ))}
                  </SimpleGrid>

                  <Button
                    size="xl"
                    fullWidth
                    radius="xl"
                    mt="md"
                    style={{
                      background: 'white',
                      color: '#d97706',
                      fontWeight: 700
                    }}
                    component={Link}
                    href={`/${locale}/contact?subject=full-installation`}
                    rightSection={<IconArrowRight size={20} />}
                  >
                    Richiedi Preventivo
                  </Button>
                </Stack>
              </Card>
            </Grid.Col>
          </Grid>
        </Container>
      </Box>

      {/* CTA Section */}
      <Box py={100} style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        position: 'relative'
      }}>
        <Container size="md">
          <Center>
            <Stack gap="xl" style={{ textAlign: 'center' }}>
              <Title order={2} size={rem(48)} fw={900} c="white">
                Pronto a Iniziare?
              </Title>
              <Text size="xl" c="white" style={{ opacity: 0.95 }}>
                Unisciti a centinaia di scuole che hanno già digitalizzato la loro gestione
              </Text>
              <Group justify="center" gap="md">
                <Button
                  size="xl"
                  radius="xl"
                  style={{
                    background: 'white',
                    color: '#667eea',
                    fontWeight: 700,
                    padding: '0 50px'
                  }}
                  component={Link}
                  href={`/${locale}/auth/register`}
                  rightSection={<IconRocket size={20} />}
                >
                  Prova Gratis 14 Giorni
                </Button>
              </Group>
              <Group justify="center" gap={30}>
                <Group gap="xs">
                  <IconCheck size={20} color="white" />
                  <Text c="white" size="sm">Nessuna carta richiesta</Text>
                </Group>
                <Group gap="xs">
                  <IconCheck size={20} color="white" />
                  <Text c="white" size="sm">Setup in 5 minuti</Text>
                </Group>
                <Group gap="xs">
                  <IconCheck size={20} color="white" />
                  <Text c="white" size="sm">Supporto in italiano</Text>
                </Group>
              </Group>
            </Stack>
          </Center>
        </Container>
      </Box>
    </Box>
  );
}
