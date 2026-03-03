import { Container, Title, Text, Stack, Paper, List, ThemeIcon, Anchor, Box, Divider, Group, Badge, Table, Alert } from '@mantine/core';
import { IconCookie, IconCheck, IconSettings, IconShield, IconAlertCircle } from '@tabler/icons-react';
import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cookie Policy | InsegnaMi.pro',
  description: 'Informativa sui cookie utilizzati dalla piattaforma InsegnaMi.pro. Scopri come gestiamo i cookie.',
};

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
    <Container size="md" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Box>
          <Group gap="sm" mb="md">
            <ThemeIcon size="xl" radius="md" variant="gradient" gradient={{ from: 'yellow', to: 'orange' }}>
              <IconCookie size={28} />
            </ThemeIcon>
            <div>
              <Title order={1}>Cookie Policy</Title>
              <Text c="dimmed" size="sm">Ultimo aggiornamento: {lastUpdated}</Text>
            </div>
          </Group>
          <Badge color="blue" variant="light" size="lg">Conforme alla Direttiva ePrivacy</Badge>
        </Box>

        {/* Introduction */}
        <Paper p="lg" radius="md" withBorder>
          <Text size="lg">
            Questa Cookie Policy spiega cosa sono i cookie, come li utilizziamo su <strong>InsegnaMi.pro</strong>
            e come puoi gestire le tue preferenze. La presente informativa è parte integrante della nostra{' '}
            <Anchor component={Link} href={`/${locale}/privacy`}>Privacy Policy</Anchor>.
          </Text>
        </Paper>

        {/* Cosa sono i Cookie */}
        <Paper p="lg" radius="md" withBorder>
          <Group gap="sm" mb="md">
            <ThemeIcon size="lg" radius="md" color="orange" variant="light">
              <IconCookie size={20} />
            </ThemeIcon>
            <Title order={2} size="h3">1. Cosa sono i Cookie</Title>
          </Group>
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
        </Paper>

        {/* Tipi di Cookie */}
        <Paper p="lg" radius="md" withBorder>
          <Group gap="sm" mb="md">
            <ThemeIcon size="lg" radius="md" color="blue" variant="light">
              <IconSettings size={20} />
            </ThemeIcon>
            <Title order={2} size="h3">2. Tipi di Cookie Utilizzati</Title>
          </Group>

          <Stack gap="lg">
            {/* Cookie Tecnici */}
            <Paper p="md" radius="md" bg="green.0">
              <Group gap="xs" mb="sm">
                <Badge color="green">Essenziali</Badge>
                <Text fw={600}>Cookie Tecnici</Text>
              </Group>
              <Text size="sm" mb="md">
                Questi cookie sono necessari per il funzionamento della piattaforma e non possono essere disattivati.
                Senza di essi, alcune funzionalità del sito non sarebbero disponibili.
              </Text>
              <List size="sm" spacing="xs" icon={
                <ThemeIcon size="xs" radius="xl" color="green">
                  <IconCheck size={10} />
                </ThemeIcon>
              }>
                <List.Item>Autenticazione e gestione sessione</List.Item>
                <List.Item>Sicurezza e protezione CSRF</List.Item>
                <List.Item>Memorizzazione preferenze essenziali</List.Item>
              </List>
            </Paper>

            {/* Cookie Funzionali */}
            <Paper p="md" radius="md" bg="blue.0">
              <Group gap="xs" mb="sm">
                <Badge color="blue">Funzionali</Badge>
                <Text fw={600}>Cookie di Preferenza</Text>
              </Group>
              <Text size="sm" mb="md">
                Questi cookie permettono di ricordare le tue preferenze (come la lingua) per offrirti
                un'esperienza più personalizzata.
              </Text>
              <List size="sm" spacing="xs" icon={
                <ThemeIcon size="xs" radius="xl" color="blue">
                  <IconCheck size={10} />
                </ThemeIcon>
              }>
                <List.Item>Preferenza lingua</List.Item>
                <List.Item>Impostazioni di visualizzazione</List.Item>
              </List>
            </Paper>

            <Alert color="green" variant="light" icon={<IconShield size={20} />}>
              <Text size="sm" fw={500}>
                InsegnaMi.pro NON utilizza cookie di profilazione o marketing.
              </Text>
              <Text size="sm">
                Non tracciamo i tuoi comportamenti per scopi pubblicitari né condividiamo dati con reti pubblicitarie.
              </Text>
            </Alert>
          </Stack>
        </Paper>

        {/* Tabella Cookie */}
        <Paper p="lg" radius="md" withBorder>
          <Title order={2} size="h3" mb="md">3. Elenco Cookie Utilizzati</Title>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nome</Table.Th>
                <Table.Th>Scopo</Table.Th>
                <Table.Th>Durata</Table.Th>
                <Table.Th>Tipo</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {technicalCookies.map((cookie) => (
                <Table.Tr key={cookie.name}>
                  <Table.Td><Text size="sm" ff="monospace">{cookie.name}</Text></Table.Td>
                  <Table.Td><Text size="sm">{cookie.purpose}</Text></Table.Td>
                  <Table.Td><Text size="sm">{cookie.duration}</Text></Table.Td>
                  <Table.Td>
                    <Badge size="sm" color={cookie.type === 'Essenziale' ? 'green' : 'blue'}>
                      {cookie.type}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>

        {/* Cookie di Terze Parti */}
        <Paper p="lg" radius="md" withBorder>
          <Title order={2} size="h3" mb="md">4. Cookie di Terze Parti</Title>
          <Stack gap="md">
            <Text>
              Utilizziamo servizi di terze parti che potrebbero impostare i propri cookie:
            </Text>

            <Paper p="md" radius="md" bg="gray.0">
              <Text fw={500} mb="xs">Stripe (Pagamenti)</Text>
              <Text size="sm" c="dimmed">
                Per l'elaborazione sicura dei pagamenti. Stripe utilizza cookie per la prevenzione delle frodi
                e l'autenticazione. <Anchor href="https://stripe.com/privacy" target="_blank">Privacy Policy Stripe</Anchor>
              </Text>
            </Paper>
          </Stack>
        </Paper>

        {/* Come Gestire i Cookie */}
        <Paper p="lg" radius="md" withBorder>
          <Group gap="sm" mb="md">
            <ThemeIcon size="lg" radius="md" color="violet" variant="light">
              <IconSettings size={20} />
            </ThemeIcon>
            <Title order={2} size="h3">5. Come Gestire i Cookie</Title>
          </Group>
          <Stack gap="md">
            <Text>
              Puoi gestire le tue preferenze sui cookie in diversi modi:
            </Text>

            <Text fw={500}>5.1 Impostazioni del Browser</Text>
            <Text size="sm">
              Puoi configurare il tuo browser per bloccare o eliminare i cookie. Tieni presente che questo
              potrebbe compromettere il funzionamento di alcune funzionalità della piattaforma.
            </Text>

            <Paper p="md" radius="md" bg="gray.0">
              <Text size="sm" fw={500} mb="xs">Link alle guide dei principali browser:</Text>
              <List size="sm" spacing="xs">
                <List.Item>
                  <Anchor href="https://support.google.com/chrome/answer/95647" target="_blank">Google Chrome</Anchor>
                </List.Item>
                <List.Item>
                  <Anchor href="https://support.mozilla.org/it/kb/Gestione%20dei%20cookie" target="_blank">Mozilla Firefox</Anchor>
                </List.Item>
                <List.Item>
                  <Anchor href="https://support.apple.com/it-it/guide/safari/sfri11471/mac" target="_blank">Safari</Anchor>
                </List.Item>
                <List.Item>
                  <Anchor href="https://support.microsoft.com/it-it/windows/gestire-i-cookie-in-microsoft-edge-visualizzare-consentire-bloccare-eliminare-e-usare-168dab11-0753-043d-7c16-ede5947fc64d" target="_blank">Microsoft Edge</Anchor>
                </List.Item>
              </List>
            </Paper>

            <Alert color="yellow" variant="light" icon={<IconAlertCircle size={20} />}>
              <Text size="sm">
                <strong>Nota:</strong> Se disabiliti i cookie essenziali, non potrai accedere alla piattaforma
                o utilizzare le sue funzionalità principali.
              </Text>
            </Alert>
          </Stack>
        </Paper>

        {/* Base Giuridica */}
        <Paper p="lg" radius="md" withBorder>
          <Title order={2} size="h3" mb="md">6. Base Giuridica</Title>
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
        </Paper>

        {/* Aggiornamenti */}
        <Paper p="lg" radius="md" withBorder>
          <Title order={2} size="h3" mb="md">7. Aggiornamenti della Policy</Title>
          <Text>
            Questa Cookie Policy può essere aggiornata periodicamente. Ti invitiamo a consultarla
            regolarmente. In caso di modifiche sostanziali, ti informeremo tramite avviso sulla piattaforma.
          </Text>
        </Paper>

        {/* Contatti */}
        <Paper p="lg" radius="md" withBorder>
          <Title order={2} size="h3" mb="md">8. Contatti</Title>
          <Text mb="md">Per domande sulla nostra Cookie Policy:</Text>
          <Paper p="md" radius="md" bg="gray.0">
            <Text><strong>InsegnaMi.pro</strong></Text>
            <Text>P.IVA: 07327360488</Text>
            <Text>Email: <Anchor href="mailto:privacy@insegnami.pro">privacy@insegnami.pro</Anchor></Text>
          </Paper>
        </Paper>

        <Divider />

        {/* Footer Links */}
        <Group justify="center" gap="lg">
          <Anchor component={Link} href={`/${locale}/privacy`} size="sm">Privacy Policy</Anchor>
          <Anchor component={Link} href={`/${locale}/terms`} size="sm">Termini di Servizio</Anchor>
          <Anchor component={Link} href={`/${locale}/contact`} size="sm">Contattaci</Anchor>
        </Group>
      </Stack>
    </Container>
  );
}
