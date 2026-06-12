import {
  Alert,
  Anchor,
  Badge,
  Card,
  Container,
  Divider,
  Group,
  List,
  ListItem,
  Paper,
  Stack,
  Table,
  TableScrollContainer,
  TableTbody,
  TableTd,
  TableTh,
  TableThead,
  TableTr,
  Text,
  ThemeIcon,
  Title,
  rem,
} from '@mantine/core';
import {
  IconAdjustments,
  IconAlertCircle,
  IconCheck,
  IconCookie,
  IconMail,
  IconRefresh,
  IconScale,
  IconSettings,
  IconShield,
  IconTable,
  IconWorld,
} from '@tabler/icons-react';
import Link from 'next/link';
import { Metadata } from 'next';
import type { ComponentType, ReactNode } from 'react';
import { PUB_GRADIENT } from '@/components/public/PublicUI';

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description: 'Informativa sui cookie utilizzati dalla piattaforma InsegnaMi.pro. Scopri come gestiamo i cookie.',
};

// Indice delle sezioni (anchor interni alla pagina)
const INDICE = [
  { id: 'cosa-sono', label: '1. Cosa sono i Cookie' },
  { id: 'tipi-di-cookie', label: '2. Tipi di Cookie Utilizzati' },
  { id: 'elenco-cookie', label: '3. Elenco Cookie Utilizzati' },
  { id: 'terze-parti', label: '4. Cookie di Terze Parti' },
  { id: 'gestione', label: '5. Come Gestire i Cookie' },
  { id: 'base-giuridica', label: '6. Base Giuridica' },
  { id: 'aggiornamenti', label: '7. Aggiornamenti della Policy' },
  { id: 'contatti', label: '8. Contatti' },
];

/** Card di sezione numerata: icona indigo uniforme + titolo + contenuto. */
function SezioneLegale({
  id,
  icon: Icon,
  title,
  children,
}: {
  id: string;
  icon: ComponentType<{ size?: number | string }>;
  title: string;
  children: ReactNode;
}) {
  return (
    <Card id={id} padding="xl" radius="lg" withBorder style={{ scrollMarginTop: 96 }}>
      <Group gap="sm" mb="md" wrap="nowrap">
        <ThemeIcon size="lg" radius="md" color="indigo" variant="light">
          <Icon size={20} />
        </ThemeIcon>
        <Title order={2} fz={rem(20)} fw={700} c="var(--pub-ink)">
          {title}
        </Title>
      </Group>
      {children}
    </Card>
  );
}

export default async function CookiePolicyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const lastUpdated = '3 Marzo 2026';

  const technicalCookies = [
    { name: 'next-auth.session-token', purpose: 'Gestione sessione utente', duration: 'Sessione', type: 'Essenziale' },
    { name: 'next-auth.csrf-token', purpose: 'Protezione CSRF', duration: 'Sessione', type: 'Essenziale' },
    { name: '__Secure-next-auth.callback-url', purpose: 'URL di callback autenticazione', duration: 'Sessione', type: 'Essenziale' },
    { name: 'locale', purpose: 'Preferenza lingua utente', duration: '1 anno', type: 'Funzionale' },
  ];

  return (
    <Container size="md" py={{ base: 32, sm: 48 }}>
      <Stack gap="xl">
        {/* Header */}
        <Group gap="lg" wrap="nowrap" align="flex-start">
          <ThemeIcon size={64} radius="lg" variant="gradient" gradient={PUB_GRADIENT}>
            <IconCookie size={34} />
          </ThemeIcon>
          <Stack gap={6}>
            <Title fz={rem(34)} fw={900} lh={1.15} c="var(--pub-ink)">
              Cookie Policy
            </Title>
            <Text c="dimmed" size="sm">Ultimo aggiornamento: {lastUpdated}</Text>
            <Badge variant="light" color="indigo" size="lg" radius="xl">
              Conforme alla Direttiva ePrivacy
            </Badge>
          </Stack>
        </Group>

        {/* Indice dei contenuti */}
        <Card padding="xl" radius="lg" withBorder>
          <Text fw={700} c="var(--pub-ink)" mb="sm">Indice dei contenuti</Text>
          <List listStyleType="none" spacing={6} size="sm">
            {INDICE.map((voce) => (
              <ListItem key={voce.id}>
                <Anchor href={`#${voce.id}`} size="sm" c="indigo.6" underline="hover">
                  {voce.label}
                </Anchor>
              </ListItem>
            ))}
          </List>
        </Card>

        {/* Introduzione */}
        <Card padding="xl" radius="lg" withBorder>
          <Text size="lg">
            Questa Cookie Policy spiega cosa sono i cookie, come li utilizziamo su <strong>InsegnaMi.pro</strong>
            e come puoi gestire le tue preferenze. La presente informativa è parte integrante della nostra{' '}
            <Anchor component={Link} href={`/${locale}/privacy`} c="indigo.6" underline="hover">Privacy Policy</Anchor>.
          </Text>
        </Card>

        {/* Cosa sono i Cookie */}
        <SezioneLegale id="cosa-sono" icon={IconCookie} title="1. Cosa sono i Cookie">
          <Stack gap="md">
            <Text>
              I cookie sono piccoli file di testo che vengono salvati sul tuo dispositivo (computer, tablet, smartphone)
              quando visiti un sito web. Servono a memorizzare informazioni sulla tua visita e a migliorare
              la tua esperienza di navigazione.
            </Text>
            <Text>
              I cookie possono essere "di sessione" (cancellati alla chiusura del browser) o "persistenti"
              (rimangono sul dispositivo per un periodo definito).
            </Text>
          </Stack>
        </SezioneLegale>

        {/* Tipi di Cookie */}
        <SezioneLegale id="tipi-di-cookie" icon={IconSettings} title="2. Tipi di Cookie Utilizzati">
          <Stack gap="lg">
            {/* Cookie Tecnici */}
            <Paper p="md" radius="md" bg="var(--pub-surface)">
              <Group gap="xs" mb="sm">
                <Badge variant="light" color="indigo">Essenziali</Badge>
                <Text fw={600}>Cookie Tecnici</Text>
              </Group>
              <Text size="sm" mb="md">
                Questi cookie sono necessari per il funzionamento della piattaforma e non possono essere disattivati.
                Senza di essi, alcune funzionalità del sito non sarebbero disponibili.
              </Text>
              <List size="sm" spacing="xs" icon={
                <ThemeIcon size="xs" radius="xl" color="teal" variant="light">
                  <IconCheck size={10} />
                </ThemeIcon>
              }>
                <ListItem>Autenticazione e gestione sessione</ListItem>
                <ListItem>Sicurezza e protezione CSRF</ListItem>
                <ListItem>Memorizzazione preferenze essenziali</ListItem>
              </List>
            </Paper>

            {/* Cookie Funzionali */}
            <Paper p="md" radius="md" bg="var(--pub-surface)">
              <Group gap="xs" mb="sm">
                <Badge variant="light" color="violet">Funzionali</Badge>
                <Text fw={600}>Cookie di Preferenza</Text>
              </Group>
              <Text size="sm" mb="md">
                Questi cookie permettono di ricordare le tue preferenze (come la lingua) per offrirti
                un'esperienza più personalizzata.
              </Text>
              <List size="sm" spacing="xs" icon={
                <ThemeIcon size="xs" radius="xl" color="teal" variant="light">
                  <IconCheck size={10} />
                </ThemeIcon>
              }>
                <ListItem>Preferenza lingua</ListItem>
                <ListItem>Impostazioni di visualizzazione</ListItem>
              </List>
            </Paper>

            <Alert color="teal" variant="light" icon={<IconShield size={20} />}>
              <Text size="sm" fw={500}>
                InsegnaMi.pro NON utilizza cookie di profilazione o marketing.
              </Text>
              <Text size="sm">
                Non tracciamo i tuoi comportamenti per scopi pubblicitari né condividiamo dati con reti pubblicitarie.
              </Text>
            </Alert>
          </Stack>
        </SezioneLegale>

        {/* Tabella Cookie */}
        <SezioneLegale id="elenco-cookie" icon={IconTable} title="3. Elenco Cookie Utilizzati">
          <TableScrollContainer minWidth={640}>
            <Table striped highlightOnHover>
              <TableThead>
                <TableTr>
                  <TableTh>Nome</TableTh>
                  <TableTh>Scopo</TableTh>
                  <TableTh>Durata</TableTh>
                  <TableTh>Tipo</TableTh>
                </TableTr>
              </TableThead>
              <TableTbody>
                {technicalCookies.map((cookie) => (
                  <TableTr key={cookie.name}>
                    <TableTd><Text size="sm" ff="monospace">{cookie.name}</Text></TableTd>
                    <TableTd><Text size="sm">{cookie.purpose}</Text></TableTd>
                    <TableTd><Text size="sm">{cookie.duration}</Text></TableTd>
                    <TableTd>
                      <Badge size="sm" variant="light" color={cookie.type === 'Essenziale' ? 'indigo' : 'violet'}>
                        {cookie.type}
                      </Badge>
                    </TableTd>
                  </TableTr>
                ))}
              </TableTbody>
            </Table>
          </TableScrollContainer>
        </SezioneLegale>

        {/* Cookie di Terze Parti */}
        <SezioneLegale id="terze-parti" icon={IconWorld} title="4. Cookie di Terze Parti">
          <Stack gap="md">
            <Text>
              Utilizziamo servizi di terze parti che potrebbero impostare i propri cookie:
            </Text>

            <Paper p="md" radius="md" bg="var(--pub-surface)">
              <Text fw={500} mb="xs">Stripe (Pagamenti)</Text>
              <Text size="sm" c="dimmed">
                Per l'elaborazione sicura dei pagamenti. Stripe utilizza cookie per la prevenzione delle frodi
                e l'autenticazione. <Anchor href="https://stripe.com/privacy" target="_blank" c="indigo.6" underline="hover">Privacy Policy Stripe</Anchor>
              </Text>
            </Paper>
          </Stack>
        </SezioneLegale>

        {/* Come Gestire i Cookie */}
        <SezioneLegale id="gestione" icon={IconAdjustments} title="5. Come Gestire i Cookie">
          <Stack gap="md">
            <Text>
              Puoi gestire le tue preferenze sui cookie in diversi modi:
            </Text>

            <Text fw={500}>5.1 Impostazioni del Browser</Text>
            <Text size="sm">
              Puoi configurare il tuo browser per bloccare o eliminare i cookie. Tieni presente che questo
              potrebbe compromettere il funzionamento di alcune funzionalità della piattaforma.
            </Text>

            <Paper p="md" radius="md" bg="var(--pub-surface)">
              <Text size="sm" fw={500} mb="xs">Link alle guide dei principali browser:</Text>
              <List size="sm" spacing="xs">
                <ListItem>
                  <Anchor href="https://support.google.com/chrome/answer/95647" target="_blank" c="indigo.6" underline="hover">Google Chrome</Anchor>
                </ListItem>
                <ListItem>
                  <Anchor href="https://support.mozilla.org/it/kb/Gestione%20dei%20cookie" target="_blank" c="indigo.6" underline="hover">Mozilla Firefox</Anchor>
                </ListItem>
                <ListItem>
                  <Anchor href="https://support.apple.com/it-it/guide/safari/sfri11471/mac" target="_blank" c="indigo.6" underline="hover">Safari</Anchor>
                </ListItem>
                <ListItem>
                  <Anchor href="https://support.microsoft.com/it-it/windows/gestire-i-cookie-in-microsoft-edge-visualizzare-consentire-bloccare-eliminare-e-usare-168dab11-0753-043d-7c16-ede5947fc64d" target="_blank" c="indigo.6" underline="hover">Microsoft Edge</Anchor>
                </ListItem>
              </List>
            </Paper>

            <Alert color="orange" variant="light" icon={<IconAlertCircle size={20} />}>
              <Text size="sm">
                <strong>Nota:</strong> Se disabiliti i cookie essenziali, non potrai accedere alla piattaforma
                o utilizzare le sue funzionalità principali.
              </Text>
            </Alert>
          </Stack>
        </SezioneLegale>

        {/* Base Giuridica */}
        <SezioneLegale id="base-giuridica" icon={IconScale} title="6. Base Giuridica">
          <Stack gap="sm">
            <Text>
              <strong>Cookie tecnici:</strong> Non richiedono consenso in quanto strettamente necessari
              per l'erogazione del servizio richiesto (Art. 122 Codice Privacy).
            </Text>
            <Text>
              <strong>Cookie funzionali:</strong> Utilizziamo il legittimo interesse per migliorare
              l'esperienza utente, con possibilità di opt-out.
            </Text>
          </Stack>
        </SezioneLegale>

        {/* Aggiornamenti */}
        <SezioneLegale id="aggiornamenti" icon={IconRefresh} title="7. Aggiornamenti della Policy">
          <Text>
            Questa Cookie Policy può essere aggiornata periodicamente. Ti invitiamo a consultarla
            regolarmente. In caso di modifiche sostanziali, ti informeremo tramite avviso sulla piattaforma.
          </Text>
        </SezioneLegale>

        {/* Contatti */}
        <SezioneLegale id="contatti" icon={IconMail} title="8. Contatti">
          <Text mb="md">Per domande sulla nostra Cookie Policy:</Text>
          <Paper p="md" radius="md" bg="var(--pub-surface)">
            <Text><strong>InsegnaMi.pro</strong></Text>
            <Text>P.IVA: 07327360488</Text>
            <Text>Email: <Anchor href="mailto:privacy@insegnami.pro" c="indigo.6" underline="hover">privacy@insegnami.pro</Anchor></Text>
          </Paper>
        </SezioneLegale>

        <Divider />

        {/* Cross-link legali */}
        <Group justify="center" gap="lg">
          <Anchor component={Link} href={`/${locale}/privacy`} size="sm" c="indigo.6" underline="hover">Privacy Policy</Anchor>
          <Anchor component={Link} href={`/${locale}/terms`} size="sm" c="indigo.6" underline="hover">Termini di Servizio</Anchor>
          <Anchor component={Link} href={`/${locale}/contact`} size="sm" c="indigo.6" underline="hover">Contattaci</Anchor>
        </Group>
      </Stack>
    </Container>
  );
}
