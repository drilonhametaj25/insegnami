'use client';

import { useState } from 'react';
import {
  Container,
  Title,
  Text,
  Card,
  Stack,
  Group,
  NumberInput,
  Button,
  Paper,
  ThemeIcon,
  Box,
  Anchor,
  Accordion,
  SimpleGrid,
  Badge,
  Progress,
  RingProgress,
  Divider,
} from '@mantine/core';
import { IconClipboardCheck, IconArrowLeft } from '@tabler/icons-react';
import Link from 'next/link';

export default function CalcolatorePresenzePage() {
  const [totalHours, setTotalHours] = useState<number | ''>(1000);
  const [attendedHours, setAttendedHours] = useState<number | ''>(850);
  const [minPercentage, setMinPercentage] = useState<number | ''>(75);
  const [result, setResult] = useState<{
    percentage: number;
    absences: number;
    remainingAllowed: number;
    isValid: boolean;
  } | null>(null);

  const calculate = () => {
    if (!totalHours || !attendedHours) {
      setResult(null);
      return;
    }

    const absences = totalHours - attendedHours;
    const percentage = (attendedHours / totalHours) * 100;
    const minRequired = minPercentage || 75;
    const minHoursRequired = (totalHours * minRequired) / 100;
    const maxAbsencesAllowed = totalHours - minHoursRequired;
    const remainingAllowed = Math.max(0, maxAbsencesAllowed - absences);

    setResult({
      percentage: Math.round(percentage * 100) / 100,
      absences,
      remainingAllowed: Math.round(remainingAllowed),
      isValid: percentage >= minRequired,
    });
  };

  const reset = () => {
    setTotalHours(1000);
    setAttendedHours(850);
    setMinPercentage(75);
    setResult(null);
  };

  const faqs = [
    {
      question: 'Qual è il minimo di presenze richiesto per legge?',
      answer:
        'In Italia, per la validità dell\'anno scolastico, è richiesta la frequenza di almeno il 75% del monte ore annuale personalizzato. Questo significa che uno studente può assentarsi al massimo per il 25% delle ore.',
    },
    {
      question: 'Come si calcola il monte ore annuale?',
      answer:
        'Il monte ore annuale si calcola moltiplicando le ore settimanali per il numero di settimane di scuola (solitamente 33-35 settimane). Ad esempio: 30 ore/settimana × 33 settimane = 990 ore annuali.',
    },
    {
      question: 'Le assenze giustificate contano nel calcolo?',
      answer:
        'Sì, anche le assenze giustificate vengono conteggiate nel monte ore di assenza. Tuttavia, alcune assenze possono essere escluse dal computo, come quelle per motivi di salute documentati, partecipazione ad attività sportive agonistiche, o altri motivi previsti dal regolamento scolastico.',
    },
    {
      question: 'Cosa succede se non si raggiunge il minimo?',
      answer:
        'Se lo studente non raggiunge il 75% di frequenza, il Consiglio di Classe deve deliberare sulla validità dell\'anno scolastico. In alcuni casi, possono essere concesse deroghe per motivi documentati.',
    },
  ];

  return (
    <>
      {/* Hero Section */}
      <Box
        style={{
          background: 'linear-gradient(135deg, var(--mantine-color-green-6) 0%, var(--mantine-color-teal-5) 100%)',
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
              <ThemeIcon size={60} radius="xl" variant="white" color="green">
                <IconClipboardCheck size={30} />
              </ThemeIcon>
              <div>
                <Title order={1}>Calcolatore Presenze</Title>
                <Text size="lg" mt="xs">
                  Calcola la percentuale di frequenza scolastica
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
                  Inserisci i dati
                </Title>

                <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                  <NumberInput
                    label="Monte ore totale"
                    description="Ore totali dell'anno"
                    placeholder="1000"
                    min={1}
                    value={totalHours}
                    onChange={(val) => setTotalHours(val === '' ? '' : Number(val))}
                  />
                  <NumberInput
                    label="Ore di presenza"
                    description="Ore effettivamente frequentate"
                    placeholder="850"
                    min={0}
                    max={typeof totalHours === 'number' ? totalHours : undefined}
                    value={attendedHours}
                    onChange={(val) => setAttendedHours(val === '' ? '' : Number(val))}
                  />
                  <NumberInput
                    label="Percentuale minima (%)"
                    description="Soglia minima richiesta"
                    placeholder="75"
                    min={1}
                    max={100}
                    value={minPercentage}
                    onChange={(val) => setMinPercentage(val === '' ? '' : Number(val))}
                  />
                </SimpleGrid>

                <Group>
                  <Button onClick={calculate} size="lg" color="green">
                    Calcola
                  </Button>
                  <Button variant="outline" onClick={reset} color="green">
                    Reset
                  </Button>
                </Group>

                {/* Result */}
                {result && (
                  <Paper p="xl" radius="md" bg={result.isValid ? 'green.0' : 'red.0'}>
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xl">
                      <Stack align="center" gap="sm">
                        <RingProgress
                          size={150}
                          thickness={12}
                          roundCaps
                          sections={[
                            {
                              value: result.percentage,
                              color: result.isValid ? 'green' : 'red',
                            },
                          ]}
                          label={
                            <Text ta="center" fw={700} size="xl">
                              {result.percentage.toFixed(1)}%
                            </Text>
                          }
                        />
                        <Badge
                          color={result.isValid ? 'green' : 'red'}
                          size="lg"
                          variant="filled"
                        >
                          {result.isValid ? 'Validità OK' : 'Sotto la soglia'}
                        </Badge>
                      </Stack>
                      <Stack gap="md">
                        <div>
                          <Text size="sm" c="dimmed">
                            Ore di assenza
                          </Text>
                          <Text size="xl" fw={700}>
                            {result.absences} ore
                          </Text>
                        </div>
                        <div>
                          <Text size="sm" c="dimmed">
                            Assenze ancora disponibili
                          </Text>
                          <Text
                            size="xl"
                            fw={700}
                            c={result.remainingAllowed > 0 ? 'green' : 'red'}
                          >
                            {result.remainingAllowed} ore
                          </Text>
                        </div>
                        <Progress
                          value={result.percentage}
                          color={result.isValid ? 'green' : 'red'}
                          size="lg"
                          radius="md"
                        />
                        <Text size="xs" c="dimmed">
                          Soglia minima: {minPercentage || 75}% ({Math.ceil(
                            ((totalHours || 0) * (minPercentage || 75)) / 100
                          )}{' '}
                          ore)
                        </Text>
                      </Stack>
                    </SimpleGrid>
                  </Paper>
                )}
              </Stack>
            </Card>

            {/* How it works */}
            <Card withBorder shadow="sm" radius="md" p="xl" mt="xl">
              <Title order={2} size="h3" mb="md">
                Come Funziona
              </Title>
              <Text mb="md">
                Il calcolatore presenze ti permette di verificare se uno studente ha
                raggiunto il minimo di frequenza richiesto per la validità dell&apos;anno
                scolastico.
              </Text>
              <Text mb="md">
                <strong>Formula del calcolo:</strong>
              </Text>
              <Paper p="md" bg="gray.0" radius="md" mb="md">
                <Text ta="center" ff="monospace">
                  Percentuale = (Ore di Presenza / Monte Ore Totale) × 100
                </Text>
              </Paper>
              <Text mb="md">
                <strong>Esempio pratico:</strong>
              </Text>
              <Text>
                Se il monte ore annuale è di 1000 ore e lo studente ha frequentato 850 ore:
                <br />
                Percentuale = (850 / 1000) × 100 = <strong>85%</strong>
                <br />
                Con una soglia minima del 75%, lo studente ha raggiunto la validità
                e può ancora assentarsi per altre 100 ore.
              </Text>
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
              <Card withBorder p="xl" radius="md" bg="green.0">
                <Stack gap="md">
                  <Title order={3} ta="center">
                    Monitora le Presenze Automaticamente
                  </Title>
                  <Text ta="center" size="sm" c="dimmed">
                    Con InsegnaMi.pro registri le presenze in tempo reale e ricevi
                    avvisi automatici quando uno studente si avvicina alla soglia.
                  </Text>
                  <Anchor
                    component={Link}
                    href="/auth/register"
                    style={{
                      backgroundColor: 'var(--mantine-color-green-6)',
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

              {/* Quick Reference */}
              <Card withBorder p="md">
                <Title order={4} mb="sm">
                  Riferimenti Rapidi
                </Title>
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="sm">Soglia standard:</Text>
                    <Badge color="green">75%</Badge>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm">Max assenze (25%):</Text>
                    <Badge color="yellow">250h su 1000h</Badge>
                  </Group>
                  <Divider my="xs" />
                  <Text size="xs" c="dimmed">
                    Riferimento: D.P.R. 122/2009, art. 14, comma 7
                  </Text>
                </Stack>
              </Card>

              {/* Related Tools */}
              <Card withBorder p="md">
                <Title order={4} mb="sm">
                  Strumenti Correlati
                </Title>
                <Stack gap="xs">
                  <Anchor component={Link} href="/it/tools/calcolatore-media-voti" size="sm">
                    Calcolatore Media Voti
                  </Anchor>
                  <Anchor component={Link} href="/it/tools/calcolatore-ore-corso" size="sm">
                    Calcolatore Ore Corso
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
