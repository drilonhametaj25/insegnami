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
  Text,
  ThemeIcon,
  Title,
  rem,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconBan,
  IconCheck,
  IconCreditCard,
  IconDoorExit,
  IconEdit,
  IconFileText,
  IconMail,
  IconRefresh,
  IconScale,
  IconShieldCheck,
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
    path: '/terms',
    title: 'Termini di Servizio',
    description:
      'Termini e condizioni di utilizzo della piattaforma InsegnaMi.pro per la gestione scolastica.',
  });
}

// Indice delle sezioni (anchor interni alla pagina)
const INDICE = [
  { id: 'definizioni', label: '1. Definizioni' },
  { id: 'accettazione', label: '2. Accettazione dei Termini' },
  { id: 'servizio', label: '3. Descrizione del Servizio' },
  { id: 'account', label: '4. Account Utente' },
  { id: 'piani-pagamenti', label: '5. Piani e Pagamenti' },
  { id: 'recesso', label: '6. Diritto di Recesso' },
  { id: 'uso-accettabile', label: '7. Uso Accettabile' },
  { id: 'proprieta-intellettuale', label: '8. Proprietà Intellettuale' },
  { id: 'responsabilita', label: '9. Limitazione di Responsabilità' },
  { id: 'modifiche', label: '10. Modifiche ai Termini' },
  { id: 'risoluzione', label: '11. Risoluzione' },
  { id: 'legge-applicabile', label: '12. Legge Applicabile e Foro Competente' },
  { id: 'contatti', label: '13. Contatti' },
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

export default async function TermsPage({
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
            <IconFileText size={34} />
          </ThemeIcon>
          <Stack gap={6}>
            <Title fz={rem(34)} fw={900} lh={1.15} c="var(--pub-ink)">
              Termini di Servizio
            </Title>
            <Text c="dimmed" size="sm">Ultimo aggiornamento: {lastUpdated}</Text>
            <Badge variant="light" color="indigo" size="lg" radius="xl">
              D.Lgs. 206/2005 (Codice del Consumo)
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
            Benvenuto su <strong>InsegnaMi.pro</strong>. Utilizzando la nostra piattaforma, accetti i seguenti termini e condizioni.
            Ti preghiamo di leggerli attentamente prima di registrarti o utilizzare i nostri servizi.
          </Text>
        </Card>

        {/* Definizioni */}
        <SezioneLegale id="definizioni" icon={IconFileText} title="1. Definizioni">
          <Stack gap="sm">
            <Text><strong>"Piattaforma"</strong>: Il software InsegnaMi.pro accessibile via web</Text>
            <Text><strong>"Utente"</strong>: Qualsiasi persona che accede alla Piattaforma</Text>
            <Text><strong>"Cliente"</strong>: Scuola, accademia o ente che sottoscrive un abbonamento</Text>
            <Text><strong>"Servizio"</strong>: Le funzionalità offerte dalla Piattaforma</Text>
            <Text><strong>"Contenuto"</strong>: Qualsiasi dato inserito dall'Utente nella Piattaforma</Text>
          </Stack>
        </SezioneLegale>

        {/* Accettazione */}
        <SezioneLegale id="accettazione" icon={IconCheck} title="2. Accettazione dei Termini">
          <Stack gap="md">
            <Text>
              Registrandoti o utilizzando InsegnaMi.pro, dichiari di:
            </Text>
            <List spacing="sm" icon={
              <ThemeIcon size="sm" radius="xl" color="teal" variant="light">
                <IconCheck size={12} />
              </ThemeIcon>
            }>
              <ListItem>Avere almeno 18 anni o l'autorizzazione di un tutore legale</ListItem>
              <ListItem>Possedere la capacità legale di stipulare contratti</ListItem>
              <ListItem>Accettare integralmente questi Termini di Servizio</ListItem>
              <ListItem>Accettare la nostra Privacy Policy</ListItem>
            </List>
          </Stack>
        </SezioneLegale>

        {/* Descrizione del Servizio */}
        <SezioneLegale id="servizio" icon={IconShieldCheck} title="3. Descrizione del Servizio">
          <Text mb="md">InsegnaMi.pro è una piattaforma SaaS (Software as a Service) per la gestione scolastica che offre:</Text>
          <List spacing="sm">
            <ListItem>Gestione anagrafica studenti, docenti e genitori</ListItem>
            <ListItem>Calendario lezioni e presenze digitali</ListItem>
            <ListItem>Gestione pagamenti e fatturazione</ListItem>
            <ListItem>Comunicazioni scuola-famiglia</ListItem>
            <ListItem>Report e statistiche</ListItem>
            <ListItem>Registro voti e pagelle</ListItem>
          </List>
        </SezioneLegale>

        {/* Account */}
        <SezioneLegale id="account" icon={IconShieldCheck} title="4. Account Utente">
          <Stack gap="md">
            <Text fw={500}>4.1 Registrazione</Text>
            <Text>
              Per utilizzare il Servizio, devi creare un account fornendo informazioni accurate e complete.
              Sei responsabile della sicurezza del tuo account e delle credenziali di accesso.
            </Text>

            <Text fw={500}>4.2 Responsabilità</Text>
            <List spacing="xs" size="sm">
              <ListItem>Mantieni riservate le tue credenziali di accesso</ListItem>
              <ListItem>Sei responsabile di tutte le attività svolte con il tuo account</ListItem>
              <ListItem>Notificaci immediatamente qualsiasi uso non autorizzato</ListItem>
              <ListItem>Non condividere l'accesso con persone non autorizzate</ListItem>
            </List>
          </Stack>
        </SezioneLegale>

        {/* Piani e Pagamenti */}
        <SezioneLegale id="piani-pagamenti" icon={IconCreditCard} title="5. Piani e Pagamenti">
          <Stack gap="md">
            <Text fw={500}>5.1 Piani di Abbonamento</Text>
            <Text>
              InsegnaMi.pro offre diversi piani di abbonamento (Starter, Professional, Enterprise) e un'opzione
              di installazione on-premise. I prezzi e le funzionalità sono indicati nella pagina Prezzi.
            </Text>

            <Text fw={500}>5.2 Periodo di Prova</Text>
            <Text>
              Offriamo un periodo di prova gratuito di 14 giorni. Non è richiesta carta di credito.
              Al termine del periodo di prova, dovrai sottoscrivere un abbonamento per continuare a utilizzare il servizio.
            </Text>

            <Text fw={500}>5.3 Fatturazione</Text>
            <List spacing="xs" size="sm">
              <ListItem>Gli abbonamenti sono fatturati mensilmente o annualmente (con sconto)</ListItem>
              <ListItem>I pagamenti sono processati tramite Stripe in modo sicuro</ListItem>
              <ListItem>Le fatture sono emesse elettronicamente</ListItem>
              <ListItem>I prezzi sono IVA esclusa dove applicabile</ListItem>
            </List>

            <Text fw={500}>5.4 Rinnovo Automatico</Text>
            <Text>
              Gli abbonamenti si rinnovano automaticamente alla scadenza. Puoi disattivare il rinnovo automatico
              in qualsiasi momento dalle impostazioni del tuo account.
            </Text>
          </Stack>
        </SezioneLegale>

        {/* Diritto di Recesso */}
        <SezioneLegale id="recesso" icon={IconRefresh} title="6. Diritto di Recesso">
          <Stack gap="md">
            <Alert color="indigo" variant="light" icon={<IconAlertCircle size={20} />}>
              <Text size="sm">
                Ai sensi del D.Lgs. 206/2005 (Codice del Consumo), per i contratti conclusi a distanza,
                i consumatori hanno diritto di recedere entro 14 giorni dalla sottoscrizione.
              </Text>
            </Alert>

            <Text fw={500}>6.1 Esercizio del Recesso</Text>
            <Text>
              Per esercitare il diritto di recesso, invia una comunicazione scritta a{' '}
              <Anchor href="mailto:info@drilonhametaj.it" c="indigo.6" underline="hover">info@drilonhametaj.it</Anchor> entro 14 giorni
              dalla sottoscrizione dell'abbonamento.
            </Text>

            <Text fw={500}>6.2 Rimborso</Text>
            <Text>
              In caso di recesso, rimborseremo l'importo pagato entro 14 giorni dalla ricezione della comunicazione,
              utilizzando lo stesso metodo di pagamento.
            </Text>

            <Text fw={500}>6.3 Cancellazione</Text>
            <Text>
              Puoi cancellare il tuo abbonamento in qualsiasi momento. La cancellazione avrà effetto alla fine
              del periodo di fatturazione corrente. Non sono previsti rimborsi per periodi parziali.
            </Text>
          </Stack>
        </SezioneLegale>

        {/* Uso Accettabile */}
        <SezioneLegale id="uso-accettabile" icon={IconBan} title="7. Uso Accettabile">
          <Text mb="md">Ti impegni a non utilizzare il Servizio per:</Text>
          <List spacing="sm" icon={
            <ThemeIcon size="sm" radius="xl" color="red" variant="light">
              <IconBan size={12} />
            </ThemeIcon>
          }>
            <ListItem>Violare leggi o regolamenti applicabili</ListItem>
            <ListItem>Caricare contenuti illegali, diffamatori o offensivi</ListItem>
            <ListItem>Interferire con il funzionamento del Servizio</ListItem>
            <ListItem>Tentare di accedere a dati di altri utenti</ListItem>
            <ListItem>Utilizzare bot, scraper o strumenti automatizzati non autorizzati</ListItem>
            <ListItem>Rivendere o sublicenziare l'accesso al Servizio</ListItem>
            <ListItem>Effettuare attività di reverse engineering</ListItem>
          </List>
        </SezioneLegale>

        {/* Proprietà Intellettuale */}
        <SezioneLegale id="proprieta-intellettuale" icon={IconShieldCheck} title="8. Proprietà Intellettuale">
          <Stack gap="md">
            <Text fw={500}>8.1 Nostri Diritti</Text>
            <Text>
              InsegnaMi.pro, inclusi software, design, marchi e contenuti, è di nostra proprietà esclusiva
              o dei nostri licenzianti. Tutti i diritti sono riservati.
            </Text>

            <Text fw={500}>8.2 I Tuoi Contenuti</Text>
            <Text>
              Mantieni tutti i diritti sui contenuti che carichi sulla Piattaforma. Ci concedi una licenza
              limitata per elaborare e visualizzare tali contenuti ai fini dell'erogazione del Servizio.
            </Text>
          </Stack>
        </SezioneLegale>

        {/* Limitazione di Responsabilità */}
        <SezioneLegale id="responsabilita" icon={IconScale} title="9. Limitazione di Responsabilità">
          <Stack gap="md">
            <Text>
              Nei limiti consentiti dalla legge, InsegnaMi.pro non sarà responsabile per:
            </Text>
            <List spacing="xs" size="sm">
              <ListItem>Danni indiretti, incidentali o consequenziali</ListItem>
              <ListItem>Perdita di dati causata da eventi al di fuori del nostro controllo</ListItem>
              <ListItem>Interruzioni del servizio dovute a manutenzione programmata</ListItem>
              <ListItem>Azioni di terze parti o cause di forza maggiore</ListItem>
            </List>

            <Text>
              La nostra responsabilità complessiva è limitata all'importo pagato dall'Utente negli ultimi 12 mesi.
            </Text>
          </Stack>
        </SezioneLegale>

        {/* Modifiche */}
        <SezioneLegale id="modifiche" icon={IconEdit} title="10. Modifiche ai Termini">
          <Text>
            Ci riserviamo il diritto di modificare questi Termini. Le modifiche saranno comunicate via email
            o tramite avviso sulla Piattaforma almeno 30 giorni prima dell'entrata in vigore.
            L'uso continuato del Servizio dopo tale data costituisce accettazione delle modifiche.
          </Text>
        </SezioneLegale>

        {/* Risoluzione */}
        <SezioneLegale id="risoluzione" icon={IconDoorExit} title="11. Risoluzione">
          <Stack gap="md">
            <Text fw={500}>11.1 Da parte dell'Utente</Text>
            <Text>
              Puoi chiudere il tuo account in qualsiasi momento dalle impostazioni o contattandoci.
            </Text>

            <Text fw={500}>11.2 Da parte nostra</Text>
            <Text>
              Possiamo sospendere o terminare il tuo accesso in caso di violazione di questi Termini,
              con preavviso salvo casi di grave violazione.
            </Text>

            <Text fw={500}>11.3 Effetti della Risoluzione</Text>
            <Text>
              Alla risoluzione, potrai esportare i tuoi dati entro 30 giorni. Successivamente,
              i dati saranno eliminati in conformità con la nostra Privacy Policy.
            </Text>
          </Stack>
        </SezioneLegale>

        {/* Legge Applicabile */}
        <SezioneLegale id="legge-applicabile" icon={IconScale} title="12. Legge Applicabile e Foro Competente">
          <Text>
            Questi Termini sono regolati dalla legge italiana. Per qualsiasi controversia sarà competente
            in via esclusiva il Foro di Firenze, salvo diversa disposizione di legge inderogabile
            a favore del consumatore.
          </Text>
        </SezioneLegale>

        {/* Contatti */}
        <SezioneLegale id="contatti" icon={IconMail} title="13. Contatti">
          <Text mb="md">Per domande sui presenti Termini:</Text>
          <Paper p="md" radius="md" bg="var(--pub-surface)">
            <Text><strong>InsegnaMi.pro</strong></Text>
            <Text>P.IVA: 07327360488</Text>
            <Text>Email: <Anchor href="mailto:info@drilonhametaj.it" c="indigo.6" underline="hover">info@drilonhametaj.it</Anchor></Text>
          </Paper>
        </SezioneLegale>

        <Divider />

        {/* Cross-link legali */}
        <Group justify="center" gap="lg">
          <Anchor component={Link} href={`/${locale}/privacy`} size="sm" c="indigo.6" underline="hover">Privacy Policy</Anchor>
          <Anchor component={Link} href={`/${locale}/cookies`} size="sm" c="indigo.6" underline="hover">Cookie Policy</Anchor>
          <Anchor component={Link} href={`/${locale}/contact`} size="sm" c="indigo.6" underline="hover">Contattaci</Anchor>
        </Group>
      </Stack>
    </Container>
  );
}
