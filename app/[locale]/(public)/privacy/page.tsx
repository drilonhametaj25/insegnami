import {
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
  Text,
  ThemeIcon,
  Title,
  rem,
} from '@mantine/core';
import {
  IconCheck,
  IconCookie,
  IconDatabase,
  IconEdit,
  IconLock,
  IconMail,
  IconScale,
  IconShield,
  IconTarget,
  IconUser,
} from '@tabler/icons-react';
import Link from 'next/link';
import { Metadata } from 'next';
import type { ComponentType, ReactNode } from 'react';
import { buildPublicMetadata } from '@/lib/seo';
import { PUB_GRADIENT } from '@/components/public/PublicUI';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildPublicMetadata({
    locale,
    path: '/privacy',
    title: 'Privacy Policy',
    description:
      'Informativa sulla privacy e trattamento dei dati personali di InsegnaMi.pro. Conforme al GDPR.',
  });
}

// Indice delle sezioni (anchor interni alla pagina)
const INDICE = [
  { id: 'titolare', label: '1. Titolare del Trattamento' },
  { id: 'dati-raccolti', label: '2. Dati Personali Raccolti' },
  { id: 'finalita', label: '3. Finalità del Trattamento' },
  { id: 'base-giuridica', label: '4. Base Giuridica del Trattamento' },
  { id: 'condivisione', label: '5. Condivisione dei Dati' },
  { id: 'conservazione', label: '6. Conservazione dei Dati' },
  { id: 'diritti', label: '7. I Tuoi Diritti (GDPR)' },
  { id: 'sicurezza', label: '8. Sicurezza dei Dati' },
  { id: 'cookie', label: '9. Cookie' },
  { id: 'modifiche', label: '10. Modifiche alla Privacy Policy' },
  { id: 'contatti', label: '11. Contatti' },
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

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const lastUpdated = '3 Marzo 2026';

  return (
    <Container size="md" py={{ base: 32, sm: 48 }}>
      <Stack gap="xl">
        {/* Header */}
        <Group gap="lg" wrap="nowrap" align="flex-start">
          <ThemeIcon size={64} radius="lg" variant="gradient" gradient={PUB_GRADIENT}>
            <IconShield size={34} />
          </ThemeIcon>
          <Stack gap={6}>
            <Title fz={rem(34)} fw={900} lh={1.15} c="var(--pub-ink)">
              Privacy Policy
            </Title>
            <Text c="dimmed" size="sm">Ultimo aggiornamento: {lastUpdated}</Text>
            <Badge variant="light" color="indigo" size="lg" radius="xl">
              Conforme GDPR (UE) 2016/679
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
            La presente informativa sulla privacy descrive come <strong>InsegnaMi.pro</strong> (di seguito "noi", "nostro" o "Piattaforma")
            raccoglie, utilizza, conserva e protegge i tuoi dati personali in conformità con il Regolamento Generale sulla Protezione dei Dati (GDPR)
            e la normativa italiana vigente.
          </Text>
        </Card>

        {/* Titolare del Trattamento */}
        <SezioneLegale id="titolare" icon={IconUser} title="1. Titolare del Trattamento">
          <Stack gap="xs">
            <Text>Il Titolare del trattamento dei dati personali è:</Text>
            <Paper p="md" radius="md" bg="var(--pub-surface)">
              <Text fw={500}>InsegnaMi.pro</Text>
              <Text>P.IVA: 07327360488</Text>
              <Text>Email: <Anchor href="mailto:privacy@insegnami.pro" c="indigo.6" underline="hover">privacy@insegnami.pro</Anchor></Text>
            </Paper>
          </Stack>
        </SezioneLegale>

        {/* Dati Raccolti */}
        <SezioneLegale id="dati-raccolti" icon={IconDatabase} title="2. Dati Personali Raccolti">
          <Text mb="md">Raccogliamo le seguenti categorie di dati personali:</Text>

          <Stack gap="md">
            <Paper p="md" radius="md" bg="var(--pub-surface)">
              <Text fw={500} mb="xs">Dati identificativi</Text>
              <List size="sm" spacing="xs">
                <ListItem>Nome e cognome</ListItem>
                <ListItem>Indirizzo email</ListItem>
                <ListItem>Numero di telefono</ListItem>
                <ListItem>Indirizzo di residenza</ListItem>
              </List>
            </Paper>

            <Paper p="md" radius="md" bg="var(--pub-surface)">
              <Text fw={500} mb="xs">Dati di accesso</Text>
              <List size="sm" spacing="xs">
                <ListItem>Credenziali di autenticazione (password criptate)</ListItem>
                <ListItem>Log di accesso e indirizzi IP</ListItem>
                <ListItem>Informazioni sul dispositivo e browser</ListItem>
              </List>
            </Paper>

            <Paper p="md" radius="md" bg="var(--pub-surface)">
              <Text fw={500} mb="xs">Dati scolastici (per scuole e utenti)</Text>
              <List size="sm" spacing="xs">
                <ListItem>Informazioni sugli studenti e genitori</ListItem>
                <ListItem>Presenze e registri scolastici</ListItem>
                <ListItem>Pagamenti e fatturazione</ListItem>
                <ListItem>Comunicazioni scuola-famiglia</ListItem>
              </List>
            </Paper>

            <Paper p="md" radius="md" bg="var(--pub-surface)">
              <Text fw={500} mb="xs">Dati di pagamento</Text>
              <List size="sm" spacing="xs">
                <ListItem>Dati di fatturazione</ListItem>
                <ListItem>Storico transazioni (processate da Stripe)</ListItem>
              </List>
            </Paper>
          </Stack>
        </SezioneLegale>

        {/* Finalità del Trattamento */}
        <SezioneLegale id="finalita" icon={IconTarget} title="3. Finalità del Trattamento">
          <Text mb="md">I tuoi dati personali vengono trattati per le seguenti finalità:</Text>

          <List spacing="sm" icon={
            <ThemeIcon size="sm" radius="xl" color="teal" variant="light">
              <IconCheck size={12} />
            </ThemeIcon>
          }>
            <ListItem><strong>Erogazione del servizio:</strong> Fornire accesso alla piattaforma e alle sue funzionalità</ListItem>
            <ListItem><strong>Gestione account:</strong> Creazione e mantenimento del tuo account utente</ListItem>
            <ListItem><strong>Comunicazioni di servizio:</strong> Invio di notifiche importanti relative al servizio</ListItem>
            <ListItem><strong>Fatturazione:</strong> Gestione pagamenti e invio fatture</ListItem>
            <ListItem><strong>Supporto clienti:</strong> Risposta alle tue richieste di assistenza</ListItem>
            <ListItem><strong>Miglioramento del servizio:</strong> Analisi aggregate per migliorare la piattaforma</ListItem>
            <ListItem><strong>Obblighi legali:</strong> Adempimento di obblighi di legge</ListItem>
          </List>
        </SezioneLegale>

        {/* Base Giuridica */}
        <SezioneLegale id="base-giuridica" icon={IconScale} title="4. Base Giuridica del Trattamento">
          <Text mb="md">Il trattamento dei tuoi dati si basa su:</Text>

          <Stack gap="sm">
            <Paper p="md" radius="md" bg="var(--pub-surface)">
              <Text fw={500}>Esecuzione del contratto (Art. 6.1.b GDPR)</Text>
              <Text size="sm" c="dimmed">Per fornire i servizi richiesti e gestire il tuo account</Text>
            </Paper>
            <Paper p="md" radius="md" bg="var(--pub-surface)">
              <Text fw={500}>Consenso (Art. 6.1.a GDPR)</Text>
              <Text size="sm" c="dimmed">Per comunicazioni marketing e cookie non essenziali</Text>
            </Paper>
            <Paper p="md" radius="md" bg="var(--pub-surface)">
              <Text fw={500}>Legittimo interesse (Art. 6.1.f GDPR)</Text>
              <Text size="sm" c="dimmed">Per migliorare i nostri servizi e prevenire frodi</Text>
            </Paper>
            <Paper p="md" radius="md" bg="var(--pub-surface)">
              <Text fw={500}>Obbligo legale (Art. 6.1.c GDPR)</Text>
              <Text size="sm" c="dimmed">Per adempiere a obblighi fiscali e normativi</Text>
            </Paper>
          </Stack>
        </SezioneLegale>

        {/* Condivisione Dati */}
        <SezioneLegale id="condivisione" icon={IconLock} title="5. Condivisione dei Dati">
          <Text mb="md">
            Non vendiamo né condividiamo i tuoi dati personali con terze parti per scopi commerciali.
            I tuoi dati possono essere condivisi solo con:
          </Text>

          <List spacing="sm">
            <ListItem><strong>Stripe:</strong> Per l'elaborazione sicura dei pagamenti</ListItem>
            <ListItem><strong>Resend:</strong> Per l'invio di email transazionali</ListItem>
            <ListItem><strong>Hetzner:</strong> Provider di hosting con server in UE</ListItem>
            <ListItem><strong>Autorità competenti:</strong> Quando richiesto dalla legge</ListItem>
          </List>

          <Text mt="md" size="sm" c="dimmed">
            Tutti i nostri fornitori di servizi sono conformi al GDPR e hanno sottoscritto accordi di trattamento dati (DPA).
          </Text>
        </SezioneLegale>

        {/* Conservazione Dati */}
        <SezioneLegale id="conservazione" icon={IconDatabase} title="6. Conservazione dei Dati">
          <Stack gap="sm">
            <Text><strong>Dati dell'account:</strong> Conservati per tutta la durata del rapporto contrattuale e per 10 anni dopo la cessazione (obblighi fiscali)</Text>
            <Text><strong>Dati di navigazione:</strong> Conservati per 12 mesi</Text>
            <Text><strong>Dati di fatturazione:</strong> Conservati per 10 anni (obblighi fiscali)</Text>
            <Text><strong>Log di sicurezza:</strong> Conservati per 6 mesi</Text>
          </Stack>
        </SezioneLegale>

        {/* Diritti dell'Interessato */}
        <SezioneLegale id="diritti" icon={IconUser} title="7. I Tuoi Diritti (GDPR)">
          <Text mb="md">In qualità di interessato, hai diritto a:</Text>

          <List spacing="sm" icon={
            <ThemeIcon size="sm" radius="xl" color="teal" variant="light">
              <IconCheck size={12} />
            </ThemeIcon>
          }>
            <ListItem><strong>Accesso:</strong> Ottenere copia dei tuoi dati personali</ListItem>
            <ListItem><strong>Rettifica:</strong> Correggere dati inesatti o incompleti</ListItem>
            <ListItem><strong>Cancellazione:</strong> Richiedere la cancellazione dei tuoi dati ("diritto all'oblio")</ListItem>
            <ListItem><strong>Limitazione:</strong> Limitare il trattamento in determinate circostanze</ListItem>
            <ListItem><strong>Portabilità:</strong> Ricevere i tuoi dati in formato strutturato</ListItem>
            <ListItem><strong>Opposizione:</strong> Opporti al trattamento basato su legittimo interesse</ListItem>
            <ListItem><strong>Revoca del consenso:</strong> Revocare il consenso in qualsiasi momento</ListItem>
          </List>

          <Paper p="md" radius="md" bg="var(--pub-surface)" mt="md">
            <Text size="sm">
              Per esercitare i tuoi diritti, contattaci a: <Anchor href="mailto:privacy@insegnami.pro" c="indigo.6" underline="hover">privacy@insegnami.pro</Anchor>
              <br />
              Risponderemo entro 30 giorni dalla richiesta.
            </Text>
          </Paper>

          <Text mt="md" size="sm">
            Hai inoltre il diritto di proporre reclamo al <strong>Garante per la Protezione dei Dati Personali</strong>:
            <Anchor href="https://www.garanteprivacy.it" target="_blank" c="indigo.6" underline="hover"> www.garanteprivacy.it</Anchor>
          </Text>
        </SezioneLegale>

        {/* Sicurezza */}
        <SezioneLegale id="sicurezza" icon={IconLock} title="8. Sicurezza dei Dati">
          <Text mb="md">Adottiamo misure tecniche e organizzative adeguate per proteggere i tuoi dati:</Text>

          <List spacing="sm">
            <ListItem>Crittografia SSL/TLS per tutte le comunicazioni</ListItem>
            <ListItem>Password criptate con algoritmi sicuri</ListItem>
            <ListItem>Accesso ai dati limitato al personale autorizzato</ListItem>
            <ListItem>Backup regolari e disaster recovery</ListItem>
            <ListItem>Monitoraggio continuo della sicurezza</ListItem>
            <ListItem>Server ubicati in data center UE certificati</ListItem>
          </List>
        </SezioneLegale>

        {/* Cookie */}
        <SezioneLegale id="cookie" icon={IconCookie} title="9. Cookie">
          <Text>
            Utilizziamo cookie tecnici necessari per il funzionamento della piattaforma.
            Per informazioni dettagliate sui cookie utilizzati, consulta la nostra{' '}
            <Anchor component={Link} href={`/${locale}/cookies`} c="indigo.6" underline="hover">Cookie Policy</Anchor>.
          </Text>
        </SezioneLegale>

        {/* Modifiche */}
        <SezioneLegale id="modifiche" icon={IconEdit} title="10. Modifiche alla Privacy Policy">
          <Text>
            Ci riserviamo il diritto di aggiornare questa informativa. In caso di modifiche sostanziali,
            ti informeremo via email o tramite avviso sulla piattaforma. Ti invitiamo a consultare
            periodicamente questa pagina per essere sempre aggiornato.
          </Text>
        </SezioneLegale>

        {/* Contatti */}
        <SezioneLegale id="contatti" icon={IconMail} title="11. Contatti">
          <Text mb="md">Per domande sulla privacy o per esercitare i tuoi diritti:</Text>
          <Paper p="md" radius="md" bg="var(--pub-surface)">
            <Text>Email: <Anchor href="mailto:privacy@insegnami.pro" c="indigo.6" underline="hover">privacy@insegnami.pro</Anchor></Text>
            <Text>Supporto: <Anchor href="mailto:info@drilonhametaj.it" c="indigo.6" underline="hover">info@drilonhametaj.it</Anchor></Text>
          </Paper>
        </SezioneLegale>

        <Divider />

        {/* Cross-link legali */}
        <Group justify="center" gap="lg">
          <Anchor component={Link} href={`/${locale}/terms`} size="sm" c="indigo.6" underline="hover">Termini di Servizio</Anchor>
          <Anchor component={Link} href={`/${locale}/cookies`} size="sm" c="indigo.6" underline="hover">Cookie Policy</Anchor>
          <Anchor component={Link} href={`/${locale}/contact`} size="sm" c="indigo.6" underline="hover">Contattaci</Anchor>
        </Group>
      </Stack>
    </Container>
  );
}
