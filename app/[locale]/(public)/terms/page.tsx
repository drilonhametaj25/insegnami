import { Container, Title, Text, Stack, Paper, List, ThemeIcon, Anchor, Box, Divider, Group, Badge, Alert } from '@mantine/core';
import { IconFileText, IconCheck, IconAlertCircle, IconCreditCard, IconShieldCheck, IconScale, IconBan, IconRefresh } from '@tabler/icons-react';
import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Termini di Servizio | InsegnaMi.pro',
  description: 'Termini e condizioni di utilizzo della piattaforma InsegnaMi.pro per la gestione scolastica.',
};

export default async function TermsPage({
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
            <ThemeIcon size="xl" radius="md" variant="gradient" gradient={{ from: 'violet', to: 'indigo' }}>
              <IconFileText size={28} />
            </ThemeIcon>
            <div>
              <Title order={1}>Termini di Servizio</Title>
              <Text c="dimmed" size="sm">Ultimo aggiornamento: {lastUpdated}</Text>
            </div>
          </Group>
        </Box>

        {/* Introduction */}
        <Paper p="lg" radius="md" withBorder>
          <Text size="lg">
            Benvenuto su <strong>InsegnaMi.pro</strong>. Utilizzando la nostra piattaforma, accetti i seguenti termini e condizioni.
            Ti preghiamo di leggerli attentamente prima di registrarti o utilizzare i nostri servizi.
          </Text>
        </Paper>

        {/* Definizioni */}
        <Paper p="lg" radius="md" withBorder>
          <Group gap="sm" mb="md">
            <ThemeIcon size="lg" radius="md" color="blue" variant="light">
              <IconFileText size={20} />
            </ThemeIcon>
            <Title order={2} size="h3">1. Definizioni</Title>
          </Group>
          <Stack gap="sm">
            <Text><strong>"Piattaforma"</strong>: Il software InsegnaMi.pro accessibile via web</Text>
            <Text><strong>"Utente"</strong>: Qualsiasi persona che accede alla Piattaforma</Text>
            <Text><strong>"Cliente"</strong>: Scuola, accademia o ente che sottoscrive un abbonamento</Text>
            <Text><strong>"Servizio"</strong>: Le funzionalità offerte dalla Piattaforma</Text>
            <Text><strong>"Contenuto"</strong>: Qualsiasi dato inserito dall'Utente nella Piattaforma</Text>
          </Stack>
        </Paper>

        {/* Accettazione */}
        <Paper p="lg" radius="md" withBorder>
          <Group gap="sm" mb="md">
            <ThemeIcon size="lg" radius="md" color="green" variant="light">
              <IconCheck size={20} />
            </ThemeIcon>
            <Title order={2} size="h3">2. Accettazione dei Termini</Title>
          </Group>
          <Stack gap="md">
            <Text>
              Registrandoti o utilizzando InsegnaMi.pro, dichiari di:
            </Text>
            <List spacing="sm" icon={
              <ThemeIcon size="sm" radius="xl" color="green">
                <IconCheck size={12} />
              </ThemeIcon>
            }>
              <List.Item>Avere almeno 18 anni o l'autorizzazione di un tutore legale</List.Item>
              <List.Item>Possedere la capacità legale di stipulare contratti</List.Item>
              <List.Item>Accettare integralmente questi Termini di Servizio</List.Item>
              <List.Item>Accettare la nostra Privacy Policy</List.Item>
            </List>
          </Stack>
        </Paper>

        {/* Descrizione del Servizio */}
        <Paper p="lg" radius="md" withBorder>
          <Group gap="sm" mb="md">
            <ThemeIcon size="lg" radius="md" color="violet" variant="light">
              <IconShieldCheck size={20} />
            </ThemeIcon>
            <Title order={2} size="h3">3. Descrizione del Servizio</Title>
          </Group>
          <Text mb="md">InsegnaMi.pro è una piattaforma SaaS (Software as a Service) per la gestione scolastica che offre:</Text>
          <List spacing="sm">
            <List.Item>Gestione anagrafica studenti, docenti e genitori</List.Item>
            <List.Item>Calendario lezioni e presenze digitali</List.Item>
            <List.Item>Gestione pagamenti e fatturazione</List.Item>
            <List.Item>Comunicazioni scuola-famiglia</List.Item>
            <List.Item>Report e statistiche</List.Item>
            <List.Item>Registro voti e pagelle</List.Item>
          </List>
        </Paper>

        {/* Account */}
        <Paper p="lg" radius="md" withBorder>
          <Group gap="sm" mb="md">
            <ThemeIcon size="lg" radius="md" color="cyan" variant="light">
              <IconShieldCheck size={20} />
            </ThemeIcon>
            <Title order={2} size="h3">4. Account Utente</Title>
          </Group>
          <Stack gap="md">
            <Text fw={500}>4.1 Registrazione</Text>
            <Text>
              Per utilizzare il Servizio, devi creare un account fornendo informazioni accurate e complete.
              Sei responsabile della sicurezza del tuo account e delle credenziali di accesso.
            </Text>

            <Text fw={500}>4.2 Responsabilità</Text>
            <List spacing="xs" size="sm">
              <List.Item>Mantieni riservate le tue credenziali di accesso</List.Item>
              <List.Item>Sei responsabile di tutte le attività svolte con il tuo account</List.Item>
              <List.Item>Notificaci immediatamente qualsiasi uso non autorizzato</List.Item>
              <List.Item>Non condividere l'accesso con persone non autorizzate</List.Item>
            </List>
          </Stack>
        </Paper>

        {/* Piani e Pagamenti */}
        <Paper p="lg" radius="md" withBorder>
          <Group gap="sm" mb="md">
            <ThemeIcon size="lg" radius="md" color="orange" variant="light">
              <IconCreditCard size={20} />
            </ThemeIcon>
            <Title order={2} size="h3">5. Piani e Pagamenti</Title>
          </Group>
          <Stack gap="md">
            <Text fw={500}>5.1 Piani di Abbonamento</Text>
            <Text>
              InsegnaMi.pro offre diversi piani di abbonamento (Starter, Professional, Enterprise) e un'opzione
              di installazione on-premise. I prezzi e le funzionalità sono indicati nella pagina Prezzi.
            </Text>

            <Text fw={500}>5.2 Periodo di Prova</Text>
            <Text>
              Offriamo un periodo di prova gratuito di 30 giorni. Non è richiesta carta di credito.
              Al termine del periodo di prova, dovrai sottoscrivere un abbonamento per continuare a utilizzare il servizio.
            </Text>

            <Text fw={500}>5.3 Fatturazione</Text>
            <List spacing="xs" size="sm">
              <List.Item>Gli abbonamenti sono fatturati mensilmente o annualmente (con sconto)</List.Item>
              <List.Item>I pagamenti sono processati tramite Stripe in modo sicuro</List.Item>
              <List.Item>Le fatture sono emesse elettronicamente</List.Item>
              <List.Item>I prezzi sono IVA esclusa dove applicabile</List.Item>
            </List>

            <Text fw={500}>5.4 Rinnovo Automatico</Text>
            <Text>
              Gli abbonamenti si rinnovano automaticamente alla scadenza. Puoi disattivare il rinnovo automatico
              in qualsiasi momento dalle impostazioni del tuo account.
            </Text>
          </Stack>
        </Paper>

        {/* Diritto di Recesso */}
        <Paper p="lg" radius="md" withBorder>
          <Group gap="sm" mb="md">
            <ThemeIcon size="lg" radius="md" color="teal" variant="light">
              <IconRefresh size={20} />
            </ThemeIcon>
            <Title order={2} size="h3">6. Diritto di Recesso</Title>
          </Group>
          <Stack gap="md">
            <Alert color="blue" variant="light" icon={<IconAlertCircle size={20} />}>
              <Text size="sm">
                Ai sensi del D.Lgs. 206/2005 (Codice del Consumo), per i contratti conclusi a distanza,
                i consumatori hanno diritto di recedere entro 14 giorni dalla sottoscrizione.
              </Text>
            </Alert>

            <Text fw={500}>6.1 Esercizio del Recesso</Text>
            <Text>
              Per esercitare il diritto di recesso, invia una comunicazione scritta a{' '}
              <Anchor href="mailto:info@insegnami.pro">info@insegnami.pro</Anchor> entro 14 giorni
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
        </Paper>

        {/* Uso Accettabile */}
        <Paper p="lg" radius="md" withBorder>
          <Group gap="sm" mb="md">
            <ThemeIcon size="lg" radius="md" color="red" variant="light">
              <IconBan size={20} />
            </ThemeIcon>
            <Title order={2} size="h3">7. Uso Accettabile</Title>
          </Group>
          <Text mb="md">Ti impegni a non utilizzare il Servizio per:</Text>
          <List spacing="sm" icon={
            <ThemeIcon size="sm" radius="xl" color="red">
              <IconBan size={12} />
            </ThemeIcon>
          }>
            <List.Item>Violare leggi o regolamenti applicabili</List.Item>
            <List.Item>Caricare contenuti illegali, diffamatori o offensivi</List.Item>
            <List.Item>Interferire con il funzionamento del Servizio</List.Item>
            <List.Item>Tentare di accedere a dati di altri utenti</List.Item>
            <List.Item>Utilizzare bot, scraper o strumenti automatizzati non autorizzati</List.Item>
            <List.Item>Rivendere o sublicenziare l'accesso al Servizio</List.Item>
            <List.Item>Effettuare attività di reverse engineering</List.Item>
          </List>
        </Paper>

        {/* Proprietà Intellettuale */}
        <Paper p="lg" radius="md" withBorder>
          <Group gap="sm" mb="md">
            <ThemeIcon size="lg" radius="md" color="pink" variant="light">
              <IconShieldCheck size={20} />
            </ThemeIcon>
            <Title order={2} size="h3">8. Proprietà Intellettuale</Title>
          </Group>
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
        </Paper>

        {/* Limitazione di Responsabilità */}
        <Paper p="lg" radius="md" withBorder>
          <Group gap="sm" mb="md">
            <ThemeIcon size="lg" radius="md" color="gray" variant="light">
              <IconScale size={20} />
            </ThemeIcon>
            <Title order={2} size="h3">9. Limitazione di Responsabilità</Title>
          </Group>
          <Stack gap="md">
            <Text>
              Nei limiti consentiti dalla legge, InsegnaMi.pro non sarà responsabile per:
            </Text>
            <List spacing="xs" size="sm">
              <List.Item>Danni indiretti, incidentali o consequenziali</List.Item>
              <List.Item>Perdita di dati causata da eventi al di fuori del nostro controllo</List.Item>
              <List.Item>Interruzioni del servizio dovute a manutenzione programmata</List.Item>
              <List.Item>Azioni di terze parti o cause di forza maggiore</List.Item>
            </List>

            <Text>
              La nostra responsabilità complessiva è limitata all'importo pagato dall'Utente negli ultimi 12 mesi.
            </Text>
          </Stack>
        </Paper>

        {/* Modifiche */}
        <Paper p="lg" radius="md" withBorder>
          <Title order={2} size="h3" mb="md">10. Modifiche ai Termini</Title>
          <Text>
            Ci riserviamo il diritto di modificare questi Termini. Le modifiche saranno comunicate via email
            o tramite avviso sulla Piattaforma almeno 30 giorni prima dell'entrata in vigore.
            L'uso continuato del Servizio dopo tale data costituisce accettazione delle modifiche.
          </Text>
        </Paper>

        {/* Risoluzione */}
        <Paper p="lg" radius="md" withBorder>
          <Title order={2} size="h3" mb="md">11. Risoluzione</Title>
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
        </Paper>

        {/* Legge Applicabile */}
        <Paper p="lg" radius="md" withBorder>
          <Group gap="sm" mb="md">
            <ThemeIcon size="lg" radius="md" color="indigo" variant="light">
              <IconScale size={20} />
            </ThemeIcon>
            <Title order={2} size="h3">12. Legge Applicabile e Foro Competente</Title>
          </Group>
          <Text>
            Questi Termini sono regolati dalla legge italiana. Per qualsiasi controversia sarà competente
            in via esclusiva il Foro di Firenze, salvo diversa disposizione di legge inderogabile
            a favore del consumatore.
          </Text>
        </Paper>

        {/* Contatti */}
        <Paper p="lg" radius="md" withBorder>
          <Title order={2} size="h3" mb="md">13. Contatti</Title>
          <Text mb="md">Per domande sui presenti Termini:</Text>
          <Paper p="md" radius="md" bg="gray.0">
            <Text><strong>InsegnaMi.pro</strong></Text>
            <Text>P.IVA: 07327360488</Text>
            <Text>Email: <Anchor href="mailto:info@insegnami.pro">info@insegnami.pro</Anchor></Text>
          </Paper>
        </Paper>

        <Divider />

        {/* Footer Links */}
        <Group justify="center" gap="lg">
          <Anchor component={Link} href={`/${locale}/privacy`} size="sm">Privacy Policy</Anchor>
          <Anchor component={Link} href={`/${locale}/cookies`} size="sm">Cookie Policy</Anchor>
          <Anchor component={Link} href={`/${locale}/contact`} size="sm">Contattaci</Anchor>
        </Group>
      </Stack>
    </Container>
  );
}
