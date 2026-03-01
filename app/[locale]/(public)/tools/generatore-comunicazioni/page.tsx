'use client';

import { useState } from 'react';
import {
  Container,
  Title,
  Text,
  Card,
  Stack,
  Group,
  TextInput,
  Textarea,
  Button,
  Paper,
  ThemeIcon,
  Box,
  Anchor,
  Accordion,
  SimpleGrid,
  Select,
  Badge,
  CopyButton,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import { IconFileText, IconArrowLeft, IconCopy, IconCheck } from '@tabler/icons-react';
import Link from 'next/link';

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

export default function GeneratoreComunicazioniPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('assenza');
  const [variables, setVariables] = useState<{ [key: string]: string }>({
    STUDENTE: 'Mario Rossi',
    DATA: new Date().toLocaleDateString('it-IT'),
    SCUOLA: 'Nome Scuola',
    MESE: 'Gennaio 2024',
    IMPORTO: '150,00',
    SCADENZA: '15/01/2024',
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
    DATA_INIZIO: '11/09/2024',
    MOTIVO: 'Festività',
    DATA_RIAPERTURA: '08/01/2024',
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

  const faqs = [
    {
      question: 'Posso personalizzare i template?',
      answer:
        'Sì, puoi modificare i valori delle variabili per adattare il messaggio. Per template completamente personalizzati e salvataggio, usa InsegnaMi.pro.',
    },
    {
      question: 'Come invio la comunicazione?',
      answer:
        'Questo strumento genera il testo. Puoi copiarlo e incollarlo nella tua email o sistema di messaggistica. InsegnaMi.pro invia automaticamente le comunicazioni.',
    },
    {
      question: 'Posso inviare comunicazioni di massa?',
      answer:
        'Con questo strumento puoi generare un messaggio alla volta. Per invii massivi a tutti i genitori o classi specifiche, InsegnaMi.pro gestisce tutto automaticamente.',
    },
    {
      question: 'Le comunicazioni sono conformi al GDPR?',
      answer:
        'I template sono generici. Assicurati di rispettare la privacy e di avere il consenso per le comunicazioni. InsegnaMi.pro include la gestione completa del consenso GDPR.',
    },
  ];

  return (
    <>
      {/* Hero Section */}
      <Box
        style={{
          background: 'linear-gradient(135deg, var(--mantine-color-pink-6) 0%, var(--mantine-color-grape-5) 100%)',
          color: 'white',
          padding: '3rem 0',
        }}
      >
        <Container size="lg">
          <Stack gap="md">
            <Anchor component={Link} href="/it/tools" c="white" size="sm">
              <Group gap={4}>
                <IconArrowLeft size={16} />
                Tutti gli strumenti
              </Group>
            </Anchor>
            <Group gap="lg" align="center">
              <ThemeIcon size={60} radius="xl" variant="white" color="pink">
                <IconFileText size={30} />
              </ThemeIcon>
              <div>
                <Title order={1}>Generatore Comunicazioni</Title>
                <Text size="lg" mt="xs">
                  Template pronti per comunicazioni scuola-famiglia
                </Text>
              </div>
            </Group>
          </Stack>
        </Container>
      </Box>

      <Container size="lg" py="xl">
        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="xl">
          {/* Main Tool */}
          <Box style={{ gridColumn: 'span 2' }}>
            <Card withBorder shadow="sm" radius="md" p="xl">
              <Stack gap="lg">
                <Title order={2} size="h3">
                  Scegli il template
                </Title>

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
                    <Title order={3} size="h5">
                      Personalizza i campi
                    </Title>
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                      {templateVariables.map((variable) => (
                        <TextInput
                          key={variable}
                          label={variable.replace(/_/g, ' ')}
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
            </Card>

            {/* Preview */}
            {template && (
              <Card withBorder shadow="sm" radius="md" p="xl" mt="xl">
                <Group justify="space-between" mb="md">
                  <Title order={2} size="h3">
                    Anteprima
                  </Title>
                  <CopyButton
                    value={`Oggetto: ${getFilledText(template.subject)}\n\n${getFilledText(template.body)}`}
                  >
                    {({ copied, copy }) => (
                      <Tooltip label={copied ? 'Copiato!' : 'Copia tutto'}>
                        <Button
                          variant={copied ? 'filled' : 'light'}
                          color={copied ? 'green' : 'pink'}
                          leftSection={
                            copied ? <IconCheck size={16} /> : <IconCopy size={16} />
                          }
                          onClick={copy}
                        >
                          {copied ? 'Copiato!' : 'Copia'}
                        </Button>
                      </Tooltip>
                    )}
                  </CopyButton>
                </Group>

                <Paper p="md" radius="md" bg="gray.0">
                  <Text size="sm" fw={500} c="dimmed" mb="xs">
                    Oggetto:
                  </Text>
                  <Text fw={500} mb="md">
                    {getFilledText(template.subject)}
                  </Text>
                  <Text size="sm" fw={500} c="dimmed" mb="xs">
                    Corpo:
                  </Text>
                  <Text style={{ whiteSpace: 'pre-line' }}>
                    {getFilledText(template.body)}
                  </Text>
                </Paper>
              </Card>
            )}

            {/* All Templates */}
            <Card withBorder shadow="sm" radius="md" p="xl" mt="xl">
              <Title order={2} size="h3" mb="md">
                Tutti i Template Disponibili
              </Title>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                {templates.map((t) => (
                  <Card
                    key={t.id}
                    withBorder
                    p="md"
                    radius="md"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedTemplate(t.id)}
                    bg={selectedTemplate === t.id ? 'pink.0' : undefined}
                  >
                    <Group justify="space-between" mb="xs">
                      <Text fw={500}>{t.name}</Text>
                      <Badge color="pink" variant="light" size="sm">
                        {t.category}
                      </Badge>
                    </Group>
                    <Text size="xs" c="dimmed" lineClamp={2}>
                      {t.body.substring(0, 100)}...
                    </Text>
                  </Card>
                ))}
              </SimpleGrid>
            </Card>

            {/* FAQ */}
            <Card withBorder shadow="sm" radius="md" p="xl" mt="xl">
              <Title order={2} size="h3" mb="md">
                Domande Frequenti
              </Title>
              <Accordion>
                {faqs.map((faq, index) => (
                  <Accordion.Item key={index} value={`faq-${index}`}>
                    <Accordion.Control>{faq.question}</Accordion.Control>
                    <Accordion.Panel>
                      <Text size="sm" c="dimmed">
                        {faq.answer}
                      </Text>
                    </Accordion.Panel>
                  </Accordion.Item>
                ))}
              </Accordion>
            </Card>
          </Box>

          {/* Sidebar */}
          <Box>
            <Stack gap="lg" style={{ position: 'sticky', top: 100 }}>
              {/* CTA Card */}
              <Card withBorder p="xl" radius="md" bg="pink.0">
                <Stack gap="md">
                  <Title order={3} ta="center">
                    Automatizza le Comunicazioni
                  </Title>
                  <Text ta="center" size="sm" c="dimmed">
                    Con InsegnaMi.pro invii comunicazioni automatiche
                    a genitori e studenti con un click.
                  </Text>
                  <Anchor
                    component={Link}
                    href="/auth/register"
                    style={{
                      backgroundColor: 'var(--mantine-color-pink-6)',
                      color: 'white',
                      padding: '0.75rem 1.5rem',
                      borderRadius: 'var(--mantine-radius-md)',
                      textDecoration: 'none',
                      fontWeight: 500,
                      textAlign: 'center',
                      display: 'block',
                    }}
                  >
                    Prova Gratis 14 Giorni
                  </Anchor>
                  <Text ta="center" size="xs" c="dimmed">
                    Nessuna carta di credito
                  </Text>
                </Stack>
              </Card>

              {/* Tips */}
              <Card withBorder p="md">
                <Title order={4} mb="sm">
                  Best Practice
                </Title>
                <Stack gap="xs">
                  <Text size="sm" c="dimmed">
                    • Usa un tono formale ma cordiale
                  </Text>
                  <Text size="sm" c="dimmed">
                    • Includi sempre i contatti
                  </Text>
                  <Text size="sm" c="dimmed">
                    • Sii chiaro e conciso
                  </Text>
                  <Text size="sm" c="dimmed">
                    • Verifica i dati prima di inviare
                  </Text>
                  <Text size="sm" c="dimmed">
                    • Rispetta la privacy (GDPR)
                  </Text>
                </Stack>
              </Card>

              {/* Related Tools */}
              <Card withBorder p="md">
                <Title order={4} mb="sm">
                  Strumenti Correlati
                </Title>
                <Stack gap="xs">
                  <Anchor component={Link} href="/it/tools/calcolatore-presenze" size="sm">
                    Calcolatore Presenze
                  </Anchor>
                  <Anchor component={Link} href="/it/tools/calcolatore-media-voti" size="sm">
                    Calcolatore Media Voti
                  </Anchor>
                  <Anchor component={Link} href="/it/tools/generatore-calendario-scolastico" size="sm">
                    Generatore Calendario
                  </Anchor>
                </Stack>
              </Card>
            </Stack>
          </Box>
        </SimpleGrid>
      </Container>
    </>
  );
}
