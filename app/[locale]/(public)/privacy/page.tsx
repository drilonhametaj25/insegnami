import { Container, Title, Text, Stack, Paper, List, ThemeIcon, Anchor, Box, Divider, Group, Badge } from '@mantine/core';
import { IconShield, IconLock, IconUser, IconDatabase, IconMail, IconCookie, IconScale, IconCheck } from '@tabler/icons-react';
import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | InsegnaMi.pro',
  description: 'Informativa sulla privacy e trattamento dei dati personali di InsegnaMi.pro. Conforme al GDPR.',
};

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const lastUpdated = '3 Marzo 2026';

  return (
    <Container size="md" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Box>
          <Group gap="sm" mb="md">
            <ThemeIcon size="xl" radius="md" variant="gradient" gradient={{ from: 'blue', to: 'cyan' }}>
              <IconShield size={28} />
            </ThemeIcon>
            <div>
              <Title order={1}>Privacy Policy</Title>
              <Text c="dimmed" size="sm">Ultimo aggiornamento: {lastUpdated}</Text>
            </div>
          </Group>
          <Badge color="green" variant="light" size="lg">Conforme GDPR (UE) 2016/679</Badge>
        </Box>

        {/* Introduction */}
        <Paper p="lg" radius="md" withBorder>
          <Text size="lg">
            La presente informativa sulla privacy descrive come <strong>InsegnaMi.pro</strong> (di seguito "noi", "nostro" o "Piattaforma")
            raccoglie, utilizza, conserva e protegge i tuoi dati personali in conformità con il Regolamento Generale sulla Protezione dei Dati (GDPR)
            e la normativa italiana vigente.
          </Text>
        </Paper>

        {/* Titolare del Trattamento */}
        <Paper p="lg" radius="md" withBorder>
          <Group gap="sm" mb="md">
            <ThemeIcon size="lg" radius="md" color="blue" variant="light">
              <IconUser size={20} />
            </ThemeIcon>
            <Title order={2} size="h3">1. Titolare del Trattamento</Title>
          </Group>
          <Stack gap="xs">
            <Text>Il Titolare del trattamento dei dati personali è:</Text>
            <Paper p="md" radius="md" bg="gray.0">
              <Text fw={500}>InsegnaMi.pro</Text>
              <Text>P.IVA: 07327360488</Text>
              <Text>Email: <Anchor href="mailto:privacy@insegnami.pro">privacy@insegnami.pro</Anchor></Text>
            </Paper>
          </Stack>
        </Paper>

        {/* Dati Raccolti */}
        <Paper p="lg" radius="md" withBorder>
          <Group gap="sm" mb="md">
            <ThemeIcon size="lg" radius="md" color="violet" variant="light">
              <IconDatabase size={20} />
            </ThemeIcon>
            <Title order={2} size="h3">2. Dati Personali Raccolti</Title>
          </Group>
          <Text mb="md">Raccogliamo le seguenti categorie di dati personali:</Text>

          <Stack gap="md">
            <Paper p="md" radius="md" bg="gray.0">
              <Text fw={500} mb="xs">Dati identificativi</Text>
              <List size="sm" spacing="xs">
                <List.Item>Nome e cognome</List.Item>
                <List.Item>Indirizzo email</List.Item>
                <List.Item>Numero di telefono</List.Item>
                <List.Item>Indirizzo di residenza</List.Item>
              </List>
            </Paper>

            <Paper p="md" radius="md" bg="gray.0">
              <Text fw={500} mb="xs">Dati di accesso</Text>
              <List size="sm" spacing="xs">
                <List.Item>Credenziali di autenticazione (password criptate)</List.Item>
                <List.Item>Log di accesso e indirizzi IP</List.Item>
                <List.Item>Informazioni sul dispositivo e browser</List.Item>
              </List>
            </Paper>

            <Paper p="md" radius="md" bg="gray.0">
              <Text fw={500} mb="xs">Dati scolastici (per scuole e utenti)</Text>
              <List size="sm" spacing="xs">
                <List.Item>Informazioni sugli studenti e genitori</List.Item>
                <List.Item>Presenze e registri scolastici</List.Item>
                <List.Item>Pagamenti e fatturazione</List.Item>
                <List.Item>Comunicazioni scuola-famiglia</List.Item>
              </List>
            </Paper>

            <Paper p="md" radius="md" bg="gray.0">
              <Text fw={500} mb="xs">Dati di pagamento</Text>
              <List size="sm" spacing="xs">
                <List.Item>Dati di fatturazione</List.Item>
                <List.Item>Storico transazioni (processate da Stripe)</List.Item>
              </List>
            </Paper>
          </Stack>
        </Paper>

        {/* Finalità del Trattamento */}
        <Paper p="lg" radius="md" withBorder>
          <Group gap="sm" mb="md">
            <ThemeIcon size="lg" radius="md" color="green" variant="light">
              <IconCheck size={20} />
            </ThemeIcon>
            <Title order={2} size="h3">3. Finalità del Trattamento</Title>
          </Group>
          <Text mb="md">I tuoi dati personali vengono trattati per le seguenti finalità:</Text>

          <List spacing="sm" icon={
            <ThemeIcon size="sm" radius="xl" color="green">
              <IconCheck size={12} />
            </ThemeIcon>
          }>
            <List.Item><strong>Erogazione del servizio:</strong> Fornire accesso alla piattaforma e alle sue funzionalità</List.Item>
            <List.Item><strong>Gestione account:</strong> Creazione e mantenimento del tuo account utente</List.Item>
            <List.Item><strong>Comunicazioni di servizio:</strong> Invio di notifiche importanti relative al servizio</List.Item>
            <List.Item><strong>Fatturazione:</strong> Gestione pagamenti e invio fatture</List.Item>
            <List.Item><strong>Supporto clienti:</strong> Risposta alle tue richieste di assistenza</List.Item>
            <List.Item><strong>Miglioramento del servizio:</strong> Analisi aggregate per migliorare la piattaforma</List.Item>
            <List.Item><strong>Obblighi legali:</strong> Adempimento di obblighi di legge</List.Item>
          </List>
        </Paper>

        {/* Base Giuridica */}
        <Paper p="lg" radius="md" withBorder>
          <Group gap="sm" mb="md">
            <ThemeIcon size="lg" radius="md" color="orange" variant="light">
              <IconScale size={20} />
            </ThemeIcon>
            <Title order={2} size="h3">4. Base Giuridica del Trattamento</Title>
          </Group>
          <Text mb="md">Il trattamento dei tuoi dati si basa su:</Text>

          <Stack gap="sm">
            <Paper p="md" radius="md" bg="gray.0">
              <Text fw={500}>Esecuzione del contratto (Art. 6.1.b GDPR)</Text>
              <Text size="sm" c="dimmed">Per fornire i servizi richiesti e gestire il tuo account</Text>
            </Paper>
            <Paper p="md" radius="md" bg="gray.0">
              <Text fw={500}>Consenso (Art. 6.1.a GDPR)</Text>
              <Text size="sm" c="dimmed">Per comunicazioni marketing e cookie non essenziali</Text>
            </Paper>
            <Paper p="md" radius="md" bg="gray.0">
              <Text fw={500}>Legittimo interesse (Art. 6.1.f GDPR)</Text>
              <Text size="sm" c="dimmed">Per migliorare i nostri servizi e prevenire frodi</Text>
            </Paper>
            <Paper p="md" radius="md" bg="gray.0">
              <Text fw={500}>Obbligo legale (Art. 6.1.c GDPR)</Text>
              <Text size="sm" c="dimmed">Per adempiere a obblighi fiscali e normativi</Text>
            </Paper>
          </Stack>
        </Paper>

        {/* Condivisione Dati */}
        <Paper p="lg" radius="md" withBorder>
          <Group gap="sm" mb="md">
            <ThemeIcon size="lg" radius="md" color="cyan" variant="light">
              <IconLock size={20} />
            </ThemeIcon>
            <Title order={2} size="h3">5. Condivisione dei Dati</Title>
          </Group>
          <Text mb="md">
            Non vendiamo né condividiamo i tuoi dati personali con terze parti per scopi commerciali.
            I tuoi dati possono essere condivisi solo con:
          </Text>

          <List spacing="sm">
            <List.Item><strong>Stripe:</strong> Per l'elaborazione sicura dei pagamenti</List.Item>
            <List.Item><strong>Resend:</strong> Per l'invio di email transazionali</List.Item>
            <List.Item><strong>Hetzner:</strong> Provider di hosting con server in UE</List.Item>
            <List.Item><strong>Autorità competenti:</strong> Quando richiesto dalla legge</List.Item>
          </List>

          <Text mt="md" size="sm" c="dimmed">
            Tutti i nostri fornitori di servizi sono conformi al GDPR e hanno sottoscritto accordi di trattamento dati (DPA).
          </Text>
        </Paper>

        {/* Conservazione Dati */}
        <Paper p="lg" radius="md" withBorder>
          <Group gap="sm" mb="md">
            <ThemeIcon size="lg" radius="md" color="pink" variant="light">
              <IconDatabase size={20} />
            </ThemeIcon>
            <Title order={2} size="h3">6. Conservazione dei Dati</Title>
          </Group>
          <Stack gap="sm">
            <Text><strong>Dati dell'account:</strong> Conservati per tutta la durata del rapporto contrattuale e per 10 anni dopo la cessazione (obblighi fiscali)</Text>
            <Text><strong>Dati di navigazione:</strong> Conservati per 12 mesi</Text>
            <Text><strong>Dati di fatturazione:</strong> Conservati per 10 anni (obblighi fiscali)</Text>
            <Text><strong>Log di sicurezza:</strong> Conservati per 6 mesi</Text>
          </Stack>
        </Paper>

        {/* Diritti dell'Interessato */}
        <Paper p="lg" radius="md" withBorder>
          <Group gap="sm" mb="md">
            <ThemeIcon size="lg" radius="md" color="indigo" variant="light">
              <IconUser size={20} />
            </ThemeIcon>
            <Title order={2} size="h3">7. I Tuoi Diritti (GDPR)</Title>
          </Group>
          <Text mb="md">In qualità di interessato, hai diritto a:</Text>

          <List spacing="sm" icon={
            <ThemeIcon size="sm" radius="xl" color="indigo">
              <IconCheck size={12} />
            </ThemeIcon>
          }>
            <List.Item><strong>Accesso:</strong> Ottenere copia dei tuoi dati personali</List.Item>
            <List.Item><strong>Rettifica:</strong> Correggere dati inesatti o incompleti</List.Item>
            <List.Item><strong>Cancellazione:</strong> Richiedere la cancellazione dei tuoi dati ("diritto all'oblio")</List.Item>
            <List.Item><strong>Limitazione:</strong> Limitare il trattamento in determinate circostanze</List.Item>
            <List.Item><strong>Portabilità:</strong> Ricevere i tuoi dati in formato strutturato</List.Item>
            <List.Item><strong>Opposizione:</strong> Opporti al trattamento basato su legittimo interesse</List.Item>
            <List.Item><strong>Revoca del consenso:</strong> Revocare il consenso in qualsiasi momento</List.Item>
          </List>

          <Paper p="md" radius="md" bg="blue.0" mt="md">
            <Text size="sm">
              Per esercitare i tuoi diritti, contattaci a: <Anchor href="mailto:privacy@insegnami.pro">privacy@insegnami.pro</Anchor>
              <br />
              Risponderemo entro 30 giorni dalla richiesta.
            </Text>
          </Paper>

          <Text mt="md" size="sm">
            Hai inoltre il diritto di proporre reclamo al <strong>Garante per la Protezione dei Dati Personali</strong>:
            <Anchor href="https://www.garanteprivacy.it" target="_blank"> www.garanteprivacy.it</Anchor>
          </Text>
        </Paper>

        {/* Sicurezza */}
        <Paper p="lg" radius="md" withBorder>
          <Group gap="sm" mb="md">
            <ThemeIcon size="lg" radius="md" color="red" variant="light">
              <IconLock size={20} />
            </ThemeIcon>
            <Title order={2} size="h3">8. Sicurezza dei Dati</Title>
          </Group>
          <Text mb="md">Adottiamo misure tecniche e organizzative adeguate per proteggere i tuoi dati:</Text>

          <List spacing="sm">
            <List.Item>Crittografia SSL/TLS per tutte le comunicazioni</List.Item>
            <List.Item>Password criptate con algoritmi sicuri</List.Item>
            <List.Item>Accesso ai dati limitato al personale autorizzato</List.Item>
            <List.Item>Backup regolari e disaster recovery</List.Item>
            <List.Item>Monitoraggio continuo della sicurezza</List.Item>
            <List.Item>Server ubicati in data center UE certificati</List.Item>
          </List>
        </Paper>

        {/* Cookie */}
        <Paper p="lg" radius="md" withBorder>
          <Group gap="sm" mb="md">
            <ThemeIcon size="lg" radius="md" color="yellow" variant="light">
              <IconCookie size={20} />
            </ThemeIcon>
            <Title order={2} size="h3">9. Cookie</Title>
          </Group>
          <Text>
            Utilizziamo cookie tecnici necessari per il funzionamento della piattaforma.
            Per informazioni dettagliate sui cookie utilizzati, consulta la nostra{' '}
            <Anchor component={Link} href={`/${locale}/cookies`}>Cookie Policy</Anchor>.
          </Text>
        </Paper>

        {/* Modifiche */}
        <Paper p="lg" radius="md" withBorder>
          <Title order={2} size="h3" mb="md">10. Modifiche alla Privacy Policy</Title>
          <Text>
            Ci riserviamo il diritto di aggiornare questa informativa. In caso di modifiche sostanziali,
            ti informeremo via email o tramite avviso sulla piattaforma. Ti invitiamo a consultare
            periodicamente questa pagina per essere sempre aggiornato.
          </Text>
        </Paper>

        {/* Contatti */}
        <Paper p="lg" radius="md" withBorder>
          <Group gap="sm" mb="md">
            <ThemeIcon size="lg" radius="md" color="teal" variant="light">
              <IconMail size={20} />
            </ThemeIcon>
            <Title order={2} size="h3">11. Contatti</Title>
          </Group>
          <Text mb="md">Per domande sulla privacy o per esercitare i tuoi diritti:</Text>
          <Paper p="md" radius="md" bg="gray.0">
            <Text>Email: <Anchor href="mailto:privacy@insegnami.pro">privacy@insegnami.pro</Anchor></Text>
            <Text>Supporto: <Anchor href="mailto:info@drilonhametaj.it">info@drilonhametaj.it</Anchor></Text>
          </Paper>
        </Paper>

        <Divider />

        {/* Footer Links */}
        <Group justify="center" gap="lg">
          <Anchor component={Link} href={`/${locale}/terms`} size="sm">Termini di Servizio</Anchor>
          <Anchor component={Link} href={`/${locale}/cookies`} size="sm">Cookie Policy</Anchor>
          <Anchor component={Link} href={`/${locale}/contact`} size="sm">Contattaci</Anchor>
        </Group>
      </Stack>
    </Container>
  );
}
