'use client';

import {
  Badge,
  Button,
  Card,
  CopyButton,
  Group,
  List,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
  rem,
} from '@mantine/core';
import { IconCheck, IconCopy, IconFileText } from '@tabler/icons-react';
import { useState } from 'react';
import {
  RelatedToolsCard,
  ToolCtaCard,
  ToolFaq,
  ToolHero,
  ToolInfoCard,
  ToolLayout,
  ToolSection,
  type FaqItem,
} from '@/components/public/ToolPageShell';

interface Template {
  id: string;
  name: string;
  category: string;
  subject: string;
  body: string;
}

const templates: Template[] = [
  {
    id: 'assenza',
    name: 'Comunicazione assenza studente',
    category: 'Presenze',
    subject: 'Comunicazione assenza - {{STUDENTE}}',
    body: `Gentili Genitori di {{STUDENTE}},

vi informiamo che in data {{DATA}} risulta assente dalle lezioni.

Vi preghiamo di giustificare l'assenza al rientro a scuola.

Per qualsiasi informazione, siamo a vostra disposizione.

Cordiali saluti,
{{SCUOLA}}`,
  },
  {
    id: 'pagamento',
    name: 'Sollecito pagamento retta',
    category: 'Amministrazione',
    subject: 'Promemoria pagamento retta - {{MESE}}',
    body: `Gentili Genitori di {{STUDENTE}},

vi ricordiamo che la retta del mese di {{MESE}} risulta ancora da saldare.

Importo dovuto: €{{IMPORTO}}
Scadenza: {{SCADENZA}}

Per effettuare il pagamento potete utilizzare:
- Bonifico bancario: {{IBAN}}
- Pagamento in segreteria

Per qualsiasi chiarimento, non esitate a contattarci.

Cordiali saluti,
{{SCUOLA}}`,
  },
  {
    id: 'riunione',
    name: 'Convocazione riunione genitori',
    category: 'Eventi',
    subject: 'Convocazione riunione genitori - {{DATA}}',
    body: `Gentili Genitori,

siete cordialmente invitati alla riunione genitori che si terrà:

Data: {{DATA}}
Orario: {{ORARIO}}
Luogo: {{LUOGO}}

Ordine del giorno:
1. {{PUNTO1}}
2. {{PUNTO2}}
3. Varie ed eventuali

Vi preghiamo di confermare la vostra partecipazione.

Cordiali saluti,
{{SCUOLA}}`,
  },
  {
    id: 'voti',
    name: 'Comunicazione esiti valutazioni',
    category: 'Didattica',
    subject: 'Esiti valutazioni - {{PERIODO}}',
    body: `Gentili Genitori di {{STUDENTE}},

vi comunichiamo gli esiti delle valutazioni del {{PERIODO}}:

{{MATERIA1}}: {{VOTO1}}
{{MATERIA2}}: {{VOTO2}}
{{MATERIA3}}: {{VOTO3}}

Media generale: {{MEDIA}}

Note del docente:
{{NOTE}}

Per un colloquio approfondito, potete prenotare un appuntamento.

Cordiali saluti,
{{SCUOLA}}`,
  },
  {
    id: 'benvenuto',
    name: 'Benvenuto nuovo iscritto',
    category: 'Amministrazione',
    subject: 'Benvenuto a {{SCUOLA}}!',
    body: `Gentili Genitori di {{STUDENTE}},

siamo lieti di darvi il benvenuto nella nostra scuola!

L'iscrizione è stata completata con successo. Di seguito i dettagli:

Studente: {{STUDENTE}}
Classe: {{CLASSE}}
Inizio lezioni: {{DATA_INIZIO}}

Documenti da portare il primo giorno:
- Certificato medico (se richiesto)
- Foto tessera
- Materiale didattico

Per qualsiasi domanda, siamo a vostra disposizione.

A presto!
{{SCUOLA}}`,
  },
  {
    id: 'chiusura',
    name: 'Avviso chiusura straordinaria',
    category: 'Eventi',
    subject: 'Avviso: chiusura scuola {{DATA}}',
    body: `Gentili Genitori,

vi informiamo che la scuola resterà chiusa nella seguente data:

Data: {{DATA}}
Motivo: {{MOTIVO}}

Le lezioni riprenderanno regolarmente il {{DATA_RIAPERTURA}}.

Ci scusiamo per eventuali disagi.

Cordiali saluti,
{{SCUOLA}}`,
  },
];

const bestPractice = [
  'Usa un tono formale ma cordiale',
  'Includi sempre i contatti',
  'Sii chiaro e conciso',
  'Verifica i dati prima di inviare',
  'Rispetta la privacy (GDPR)',
];

const strumentiCorrelati = [
  { slug: 'calcolatore-presenze', title: 'Calcolatore Presenze' },
  { slug: 'calcolatore-media-voti', title: 'Calcolatore Media Voti' },
  { slug: 'generatore-calendario-scolastico', title: 'Generatore Calendario' },
];

/** Trasforma la chiave variabile (es. DATA_RIAPERTURA) in label leggibile (es. "Data riapertura"). */
function formatVariableLabel(variable: string): string {
  const label = variable.replace(/_/g, ' ').toLowerCase();
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function GeneratoreComunicazioniClient({
  locale,
  faqs,
}: {
  locale: string;
  faqs: FaqItem[];
}) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('assenza');
  const [variables, setVariables] = useState<{ [key: string]: string }>({
    STUDENTE: 'Mario Rossi',
    DATA: new Date().toLocaleDateString('it-IT'),
    SCUOLA: 'Nome Scuola',
    MESE: 'Gennaio 2026',
    IMPORTO: '150,00',
    SCADENZA: '15/01/2026',
    IBAN: 'IT00X0000000000000000000000',
    ORARIO: '17:00',
    LUOGO: 'Aula Magna',
    PUNTO1: 'Presentazione programma',
    PUNTO2: 'Organizzazione attività',
    PERIODO: 'Primo Quadrimestre',
    MATERIA1: 'Italiano',
    VOTO1: '7',
    MATERIA2: 'Matematica',
    VOTO2: '8',
    MATERIA3: 'Inglese',
    VOTO3: '7',
    MEDIA: '7.3',
    NOTE: 'Studente attento e partecipativo.',
    CLASSE: '1A',
    DATA_INIZIO: '11/09/2026',
    MOTIVO: 'Festività',
    DATA_RIAPERTURA: '07/01/2027',
  });

  const template = templates.find((t) => t.id === selectedTemplate);

  const getFilledText = (text: string) => {
    let result = text;
    Object.entries(variables).forEach(([key, value]) => {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    return result;
  };

  const extractVariables = (text: string): string[] => {
    const matches = text.match(/{{(\w+)}}/g) || [];
    return [...new Set(matches.map((m) => m.replace(/[{}]/g, '')))];
  };

  const templateVariables = template
    ? extractVariables(template.subject + template.body)
    : [];

  return (
    <>
      <ToolHero
        locale={locale}
        icon={IconFileText}
        title="Generatore Comunicazioni"
        description="Template pronti per comunicazioni scuola-famiglia"
      />

      <ToolLayout
        aside={
          <>
            <ToolCtaCard locale={locale} />

            <ToolInfoCard title="Best Practice">
              <List
                spacing={8}
                size="sm"
                center
                icon={
                  <ThemeIcon size={18} radius="xl" variant="light" color="teal">
                    <IconCheck size={12} />
                  </ThemeIcon>
                }
              >
                {bestPractice.map((tip) => (
                  <List.Item key={tip}>
                    <Text size="sm" c="dimmed">
                      {tip}
                    </Text>
                  </List.Item>
                ))}
              </List>
            </ToolInfoCard>

            <RelatedToolsCard locale={locale} tools={strumentiCorrelati} />
          </>
        }
      >
        <ToolSection title="Scegli il template">
          <Stack gap="lg">
            <Select
              label="Tipo di comunicazione"
              data={templates.map((t) => ({
                value: t.id,
                label: `${t.name} (${t.category})`,
              }))}
              value={selectedTemplate}
              onChange={(val) => setSelectedTemplate(val || 'assenza')}
            />

            {template && (
              <>
                <Title order={3} fz={rem(18)} fw={700} c="var(--pub-ink)">
                  Personalizza i campi
                </Title>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  {templateVariables.map((variable) => (
                    <TextInput
                      key={variable}
                      label={formatVariableLabel(variable)}
                      value={variables[variable] || ''}
                      onChange={(e) =>
                        setVariables({
                          ...variables,
                          [variable]: e.target.value,
                        })
                      }
                      size="sm"
                    />
                  ))}
                </SimpleGrid>
              </>
            )}
          </Stack>
        </ToolSection>

        {/* Anteprima */}
        {template && (
          <ToolSection>
            <Group justify="space-between" mb="md">
              <Title order={2} fz={rem(22)} fw={700} c="var(--pub-ink)">
                Anteprima
              </Title>
              <CopyButton
                value={`Oggetto: ${getFilledText(template.subject)}\n\n${getFilledText(template.body)}`}
              >
                {({ copied, copy }) => (
                  <Tooltip label={copied ? 'Copiato!' : 'Copia tutto'}>
                    <Button
                      variant={copied ? 'filled' : 'light'}
                      color={copied ? 'teal' : 'indigo'}
                      radius="xl"
                      leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                      onClick={copy}
                    >
                      {copied ? 'Copiato!' : 'Copia'}
                    </Button>
                  </Tooltip>
                )}
              </CopyButton>
            </Group>

            <Paper p="md" radius="md" bg="var(--pub-surface)">
              <Text size="sm" fw={500} c="dimmed" mb="xs">
                Oggetto:
              </Text>
              <Text fw={500} mb="md">
                {getFilledText(template.subject)}
              </Text>
              <Text size="sm" fw={500} c="dimmed" mb="xs">
                Corpo:
              </Text>
              <Text style={{ whiteSpace: 'pre-line' }}>{getFilledText(template.body)}</Text>
            </Paper>
          </ToolSection>
        )}

        <ToolSection title="Tutti i Template Disponibili">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            {templates.map((t) => (
              <Card
                key={t.id}
                component="button"
                type="button"
                onClick={() => setSelectedTemplate(t.id)}
                aria-pressed={selectedTemplate === t.id}
                p="md"
                radius="md"
                bg="white"
                style={{
                  cursor: 'pointer',
                  textAlign: 'left',
                  border:
                    selectedTemplate === t.id
                      ? '2px solid var(--mantine-color-indigo-6)'
                      : '1px solid var(--pub-border)',
                }}
              >
                <Group justify="space-between" mb="xs">
                  <Text fw={600} c="var(--pub-ink)">
                    {t.name}
                  </Text>
                  <Badge color="indigo" variant="light" size="sm">
                    {t.category}
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed" lineClamp={2}>
                  {t.body}
                </Text>
              </Card>
            ))}
          </SimpleGrid>
        </ToolSection>

        <ToolFaq items={faqs} />
      </ToolLayout>
    </>
  );
}
