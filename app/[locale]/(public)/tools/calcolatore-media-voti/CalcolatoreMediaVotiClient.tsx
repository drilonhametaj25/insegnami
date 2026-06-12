'use client';

import { useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  List,
  NumberInput,
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
  rem,
} from '@mantine/core';
import { IconCalculator, IconPlus, IconTrash } from '@tabler/icons-react';
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

interface Grade {
  id: string;
  subject: string;
  grade: number | '';
  weight: number;
}

// Fix BUG-054: costante delle righe iniziali fuori dal componente
const INITIAL_GRADES: Grade[] = [
  { id: '1', subject: '', grade: '', weight: 1 },
];

export function CalcolatoreMediaVotiClient({
  locale,
  faqs,
}: {
  locale?: string;
  faqs: FaqItem[];
}) {
  // Fix BUG-034/035/052: locale dal server con fallback sicuro su 'it'
  const safeLocale = locale || 'it';

  const [grades, setGrades] = useState<Grade[]>(INITIAL_GRADES);
  const [result, setResult] = useState<{ average: number; totalWeight: number } | null>(null);

  const addGrade = () => {
    setGrades([
      ...grades,
      { id: Date.now().toString(), subject: '', grade: '', weight: 1 },
    ]);
  };

  const removeGrade = (id: string) => {
    if (grades.length > 1) {
      setGrades(grades.filter((g) => g.id !== id));
    }
  };

  const updateGrade = (id: string, field: keyof Grade, value: string | number) => {
    setGrades(
      grades.map((g) => (g.id === id ? { ...g, [field]: value } : g))
    );
  };

  const calculateAverage = () => {
    const validGrades = grades.filter((g) => g.grade !== '' && typeof g.grade === 'number');

    if (validGrades.length === 0) {
      setResult(null);
      return;
    }

    const totalWeight = validGrades.reduce((sum, g) => sum + g.weight, 0);
    const weightedSum = validGrades.reduce(
      (sum, g) => sum + (g.grade as number) * g.weight,
      0
    );
    const average = weightedSum / totalWeight;

    setResult({
      average: Math.round(average * 100) / 100,
      totalWeight,
    });
  };

  // Fix BUG-054: clona INITIAL_GRADES per evitare mutazioni
  const reset = () => {
    setGrades([...INITIAL_GRADES]);
    setResult(null);
  };

  return (
    <>
      <ToolHero
        locale={safeLocale}
        icon={IconCalculator}
        title="Calcolatore Media Voti"
        description="Calcola la media pesata dei voti scolastici"
      />

      <ToolLayout
        aside={
          <>
            <ToolCtaCard locale={safeLocale} />

            <ToolInfoCard title="Suggerimenti">
              <List size="sm" spacing={6} c="dimmed">
                <List.Item>Usa peso 2 per i compiti in classe</List.Item>
                <List.Item>Usa peso 1 per le interrogazioni</List.Item>
                <List.Item>Usa peso 0.5 per i compiti a casa</List.Item>
                <List.Item>La scala voti italiana va da 0 a 10</List.Item>
              </List>
            </ToolInfoCard>

            <RelatedToolsCard
              locale={safeLocale}
              tools={[
                { slug: 'calcolatore-presenze', title: 'Calcolatore Presenze' },
                { slug: 'generatore-calendario-scolastico', title: 'Generatore Calendario' },
                { slug: 'calcolatore-costo-studente', title: 'Calcolatore Costi' },
              ]}
            />
          </>
        }
      >
        <ToolSection title="Inserisci i voti">
          <Stack gap="lg">
            <Table.ScrollContainer minWidth={480}>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Materia/Descrizione</Table.Th>
                    <Table.Th miw={100}>Voto</Table.Th>
                    <Table.Th miw={100}>Peso</Table.Th>
                    <Table.Th miw={50} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {grades.map((grade) => (
                    <Table.Tr key={grade.id}>
                      <Table.Td>
                        <TextInput
                          placeholder="Es. Matematica"
                          value={grade.subject}
                          onChange={(e) =>
                            updateGrade(grade.id, 'subject', e.target.value)
                          }
                        />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          placeholder="7"
                          min={0}
                          max={10}
                          step={0.5}
                          decimalScale={2}
                          value={grade.grade}
                          onChange={(val) =>
                            updateGrade(grade.id, 'grade', val || '')
                          }
                        />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          min={1}
                          max={10}
                          value={grade.weight}
                          onChange={(val) =>
                            updateGrade(grade.id, 'weight', val || 1)
                          }
                        />
                      </Table.Td>
                      <Table.Td>
                        <ActionIcon
                          color="red"
                          variant="subtle"
                          onClick={() => removeGrade(grade.id)}
                          disabled={grades.length === 1}
                        >
                          <IconTrash size={18} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>

            <Group>
              <Button
                variant="light"
                color="indigo"
                radius="xl"
                leftSection={<IconPlus size={18} />}
                onClick={addGrade}
              >
                Aggiungi voto
              </Button>
            </Group>

            <Group>
              <Button
                onClick={calculateAverage}
                size="lg"
                radius="xl"
                variant="gradient"
                gradient={PUB_GRADIENT}
                fw={700}
              >
                Calcola Media
              </Button>
              <Button variant="default" radius="xl" onClick={reset}>
                Reset
              </Button>
            </Group>

            {/* Risultato */}
            {result && (
              <Paper p="xl" radius="lg" withBorder bg="var(--pub-surface)">
                <Stack align="center" gap="sm">
                  <Text size="sm" c="dimmed">
                    Media Pesata
                  </Text>
                  <Text fz={rem(48)} fw={900} lh={1} c="var(--pub-ink)">
                    {result.average.toFixed(2)}
                  </Text>
                  <Text size="sm" c="dimmed">
                    Calcolata su {grades.filter((g) => g.grade !== '').length} voti
                    (peso totale: {result.totalWeight})
                  </Text>
                  <Badge
                    variant="light"
                    color={
                      result.average >= 6
                        ? 'green'
                        : result.average >= 5
                        ? 'yellow'
                        : 'red'
                    }
                    size="lg"
                  >
                    {result.average >= 6
                      ? 'Sufficiente'
                      : result.average >= 5
                      ? 'Quasi sufficiente'
                      : 'Insufficiente'}
                  </Badge>
                </Stack>
              </Paper>
            )}
          </Stack>
        </ToolSection>

        <ToolSection title="Come Funziona">
          <Text mb="md">
            Il calcolatore della media voti pesata ti permette di calcolare la media
            scolastica tenendo conto del diverso peso che possono avere le varie
            valutazioni.
          </Text>
          <Text mb="md">
            <strong>Formula della media pesata:</strong>
          </Text>
          <Paper p="md" bg="var(--pub-surface)" radius="md" mb="md">
            <Text ta="center" ff="monospace">
              Media = (Voto₁ × Peso₁ + Voto₂ × Peso₂ + ... + Votoₙ × Pesoₙ) / (Peso₁ + Peso₂ + ... + Pesoₙ)
            </Text>
          </Paper>
          <Text>
            Ad esempio, se hai un 7 con peso 2 e un 8 con peso 1:
            <br />
            Media = (7 × 2 + 8 × 1) / (2 + 1) = (14 + 8) / 3 = 22 / 3 = <strong>7.33</strong>
          </Text>
        </ToolSection>

        <ToolFaq items={faqs} />
      </ToolLayout>
    </>
  );
}
