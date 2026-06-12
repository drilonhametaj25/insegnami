'use client';

import {
  Badge,
  Button,
  Divider,
  Grid,
  Group,
  NumberInput,
  Paper,
  Progress,
  RingProgress,
  SimpleGrid,
  Stack,
  Text,
} from '@mantine/core';
import { IconClipboardCheck } from '@tabler/icons-react';
import { useState } from 'react';
import { PUB_GRADIENT } from '@/components/public/PublicUI';
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

interface RisultatoPresenze {
  percentage: number;
  absences: number;
  remainingAllowed: number;
  isValid: boolean;
}

/** Calcolo presenze: percentuale (2 decimali), assenze e margine residuo rispetto alla soglia. */
function calcolaPresenze(
  totalHours: number,
  attendedHours: number,
  minPercentage: number | ''
): RisultatoPresenze {
  const absences = totalHours - attendedHours;
  const percentage = (attendedHours / totalHours) * 100;
  const minRequired = minPercentage || 75;
  const minHoursRequired = (totalHours * minRequired) / 100;
  const maxAbsencesAllowed = totalHours - minHoursRequired;
  const remainingAllowed = Math.max(0, maxAbsencesAllowed - absences);

  return {
    percentage: Math.round(percentage * 100) / 100,
    absences,
    remainingAllowed: Math.round(remainingAllowed),
    isValid: percentage >= minRequired,
  };
}

const strumentiCorrelati = [
  { slug: 'calcolatore-media-voti', title: 'Calcolatore Media Voti' },
  { slug: 'calcolatore-ore-corso', title: 'Calcolatore Ore Corso' },
  { slug: 'generatore-calendario-scolastico', title: 'Generatore Calendario' },
];

export function CalcolatorePresenzeClient({
  locale,
  faqs,
}: {
  locale: string;
  faqs: FaqItem[];
}) {
  const [totalHours, setTotalHours] = useState<number | ''>(1000);
  const [attendedHours, setAttendedHours] = useState<number | ''>(850);
  const [minPercentage, setMinPercentage] = useState<number | ''>(75);
  // Risultato calcolato subito sui valori di default: il pannello è visibile fin dal primo render
  const [result, setResult] = useState<RisultatoPresenze | null>(() =>
    calcolaPresenze(1000, 850, 75)
  );

  const calculate = () => {
    if (!totalHours || !attendedHours) {
      setResult(null);
      return;
    }
    setResult(calcolaPresenze(totalHours, attendedHours, minPercentage));
  };

  const reset = () => {
    setTotalHours(1000);
    setAttendedHours(850);
    setMinPercentage(75);
    setResult(calcolaPresenze(1000, 850, 75));
  };

  return (
    <>
      <ToolHero
        locale={locale}
        icon={IconClipboardCheck}
        title="Calcolatore Presenze"
        description="Calcola la percentuale di frequenza scolastica e verifica il raggiungimento del monte ore minimo"
      />

      <ToolLayout
        aside={
          <>
            <ToolCtaCard locale={locale} />

            <ToolInfoCard title="Riferimenti rapidi">
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="sm">Soglia standard:</Text>
                  <Badge variant="light" color="indigo">
                    75%
                  </Badge>
                </Group>
                <Text size="sm" c="dimmed">
                  Esempio: max assenze (25%) = 250h su 1000h
                </Text>
                <Divider my="xs" />
                <Text size="xs" c="dimmed">
                  Riferimento: D.P.R. 122/2009, art. 14, comma 7
                </Text>
              </Stack>
            </ToolInfoCard>

            <RelatedToolsCard locale={locale} tools={strumentiCorrelati} />
          </>
        }
      >
        <ToolSection title="Inserisci i dati">
          <Stack gap="lg">
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
              <Button
                onClick={calculate}
                size="lg"
                radius="xl"
                variant="gradient"
                gradient={PUB_GRADIENT}
                fw={700}
              >
                Calcola
              </Button>
              <Button variant="default" radius="xl" onClick={reset}>
                Reset
              </Button>
            </Group>

            {/* Risultato: verde/rosso sono semantici (frequenza valida / sotto soglia) */}
            {result && (
              <Paper p="xl" radius="lg" bg={result.isValid ? 'green.0' : 'red.0'}>
                <Grid gutter="xl" align="center">
                  <Grid.Col span={{ base: 12, sm: 6 }}>
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
                      <Badge color={result.isValid ? 'green' : 'red'} size="lg" variant="filled">
                        {result.isValid ? 'Frequenza valida' : 'Sotto la soglia'}
                      </Badge>
                    </Stack>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
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
                        <Text size="xl" fw={700} c={result.remainingAllowed > 0 ? 'green' : 'red'}>
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
                  </Grid.Col>
                </Grid>
              </Paper>
            )}
          </Stack>
        </ToolSection>

        <ToolSection title="Come Funziona">
          <Text mb="md">
            Il calcolatore presenze ti permette di verificare se uno studente ha raggiunto il
            minimo di frequenza richiesto per la validità dell&apos;anno scolastico.
          </Text>
          <Text mb="md">
            <strong>Formula del calcolo:</strong>
          </Text>
          <Paper p="md" bg="var(--pub-surface)" radius="md" mb="md">
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
            Con una soglia minima del 75%, lo studente ha raggiunto la validità e può ancora
            assentarsi per altre 100 ore.
          </Text>
        </ToolSection>

        <ToolFaq items={faqs} />
      </ToolLayout>
    </>
  );
}
