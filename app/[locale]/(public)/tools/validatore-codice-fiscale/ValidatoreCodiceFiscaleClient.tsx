'use client';

import {
  Alert,
  Badge,
  Box,
  Button,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import { IconCheck, IconId, IconInfoCircle, IconX } from '@tabler/icons-react';
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

interface CFResult {
  isValid: boolean;
  errors: string[];
  data?: {
    surname: string;
    name: string;
    birthDate: string;
    gender: string;
    birthPlace: string;
  };
}

// Codici mese del codice fiscale
const monthCodes: { [key: string]: number } = {
  A: 1, B: 2, C: 3, D: 4, E: 5, H: 6,
  L: 7, M: 8, P: 9, R: 10, S: 11, T: 12,
};

// Valori per le posizioni dispari
const oddValues: { [key: string]: number } = {
  '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
  'A': 1, 'B': 0, 'C': 5, 'D': 7, 'E': 9, 'F': 13, 'G': 15, 'H': 17, 'I': 19, 'J': 21,
  'K': 2, 'L': 4, 'M': 18, 'N': 20, 'O': 11, 'P': 3, 'Q': 6, 'R': 8, 'S': 12, 'T': 14,
  'U': 16, 'V': 10, 'W': 22, 'X': 25, 'Y': 24, 'Z': 23,
};

// Valori per le posizioni pari
const evenValues: { [key: string]: number } = {
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4, 'F': 5, 'G': 6, 'H': 7, 'I': 8, 'J': 9,
  'K': 10, 'L': 11, 'M': 12, 'N': 13, 'O': 14, 'P': 15, 'Q': 16, 'R': 17, 'S': 18, 'T': 19,
  'U': 20, 'V': 21, 'W': 22, 'X': 23, 'Y': 24, 'Z': 25,
};

const controlChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function validateCF(cf: string): CFResult {
  const errors: string[] = [];
  const cfUpper = cf.toUpperCase().trim();

  // Check length
  if (cfUpper.length !== 16) {
    errors.push('Il codice fiscale deve essere di 16 caratteri');
    return { isValid: false, errors };
  }

  // Check format
  const cfRegex = /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/;
  if (!cfRegex.test(cfUpper)) {
    errors.push('Formato del codice fiscale non valido');
    return { isValid: false, errors };
  }

  // Validate check character
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    const char = cfUpper[i];
    if (i % 2 === 0) {
      sum += oddValues[char] || 0;
    } else {
      sum += evenValues[char] || 0;
    }
  }
  const expectedControl = controlChars[sum % 26];
  if (cfUpper[15] !== expectedControl) {
    errors.push(`Carattere di controllo non valido (atteso: ${expectedControl})`);
    return { isValid: false, errors };
  }

  // Extract data
  const surname = cfUpper.substring(0, 3);
  const name = cfUpper.substring(3, 6);
  const yearCode = cfUpper.substring(6, 8);
  const monthCode = cfUpper[8];
  const dayCode = parseInt(cfUpper.substring(9, 11));
  const birthPlaceCode = cfUpper.substring(11, 15);

  // Determine gender and birth day
  const gender = dayCode > 40 ? 'F' : 'M';
  const birthDay = dayCode > 40 ? dayCode - 40 : dayCode;

  // Determine year (assuming 1900s or 2000s)
  const year = parseInt(yearCode);
  const currentYear = new Date().getFullYear() % 100;
  const fullYear = year <= currentYear ? 2000 + year : 1900 + year;

  // Get month
  const month = monthCodes[monthCode];
  if (!month) {
    errors.push('Codice mese non valido');
    return { isValid: false, errors };
  }

  // Validate day
  const daysInMonth = new Date(fullYear, month, 0).getDate();
  if (birthDay < 1 || birthDay > daysInMonth) {
    errors.push('Giorno di nascita non valido');
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    errors: [],
    data: {
      surname: `${surname} (codice cognome)`,
      name: `${name} (codice nome)`,
      birthDate: `${birthDay.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${fullYear}`,
      gender: gender === 'M' ? 'Maschio' : 'Femmina',
      birthPlace: `${birthPlaceCode} (codice comune/stato estero)`,
    },
  };
}

// Struttura del codice fiscale per la tabella educativa
const cfStructure = [
  { position: '1-3', chars: '3 lettere', meaning: 'Cognome' },
  { position: '4-6', chars: '3 lettere', meaning: 'Nome' },
  { position: '7-8', chars: '2 cifre', meaning: 'Anno di nascita' },
  { position: '9', chars: '1 lettera', meaning: 'Mese di nascita' },
  { position: '10-11', chars: '2 cifre', meaning: 'Giorno (+40 se femmina)' },
  { position: '12-15', chars: '4 caratteri', meaning: 'Codice comune/stato' },
  { position: '16', chars: '1 lettera', meaning: 'Carattere di controllo' },
];

const strumentiCorrelati = [
  { slug: 'calcolatore-media-voti', title: 'Calcolatore Media Voti' },
  { slug: 'calcolatore-presenze', title: 'Calcolatore Presenze' },
  { slug: 'generatore-comunicazioni', title: 'Generatore Comunicazioni' },
];

export function ValidatoreCodiceFiscaleClient({
  locale,
  faqs,
}: {
  locale: string;
  faqs: FaqItem[];
}) {
  const [cf, setCf] = useState('');
  const [result, setResult] = useState<CFResult | null>(null);

  const validate = () => {
    if (!cf.trim()) {
      setResult(null);
      return;
    }
    setResult(validateCF(cf));
  };

  const reset = () => {
    setCf('');
    setResult(null);
  };

  return (
    <>
      <ToolHero
        locale={locale}
        icon={IconId}
        title="Validatore Codice Fiscale"
        description="Verifica la correttezza di un codice fiscale italiano"
      />

      <ToolLayout
        aside={
          <>
            <ToolCtaCard locale={locale} />

            <ToolInfoCard title="Codici Mese">
              <SimpleGrid cols={3} spacing="xs">
                {Object.entries(monthCodes).map(([code, month]) => (
                  <Badge key={code} variant="light" color="gray">
                    {code} = {month.toString().padStart(2, '0')}
                  </Badge>
                ))}
              </SimpleGrid>
            </ToolInfoCard>

            <RelatedToolsCard locale={locale} tools={strumentiCorrelati} />
          </>
        }
      >
        <ToolSection title="Inserisci il codice fiscale">
          <Stack gap="lg">
            <TextInput
              label="Codice Fiscale"
              placeholder="RSSMRA85M01H501Z"
              value={cf}
              onChange={(e) => setCf(e.target.value.toUpperCase())}
              maxLength={16}
              size="lg"
              styles={{
                input: {
                  fontFamily: 'monospace',
                  fontSize: '1.2rem',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                },
              }}
            />

            <Group>
              <Button
                onClick={validate}
                size="lg"
                radius="xl"
                variant="gradient"
                gradient={PUB_GRADIENT}
                fw={700}
              >
                Verifica
              </Button>
              <Button variant="default" radius="xl" onClick={reset}>
                Reset
              </Button>
            </Group>

            {/* Risultato: verde/rosso sono semantici (valido / non valido) */}
            <Box aria-live="polite">
              {result && (
                <Paper p="xl" radius="lg" withBorder bg={result.isValid ? 'green.0' : 'red.0'}>
                  <Stack gap="md">
                    <Group>
                      <ThemeIcon size={40} radius="xl" color={result.isValid ? 'green' : 'red'}>
                        {result.isValid ? <IconCheck size={24} /> : <IconX size={24} />}
                      </ThemeIcon>
                      <div>
                        <Text fw={700} size="lg">
                          {result.isValid ? 'Codice Fiscale Valido' : 'Codice Fiscale Non Valido'}
                        </Text>
                        <Text size="sm" c="dimmed">
                          {result.isValid
                            ? 'Il formato e il carattere di controllo sono corretti'
                            : 'Sono stati trovati errori'}
                        </Text>
                      </div>
                    </Group>

                    {result.errors.length > 0 && (
                      <Alert color="red" icon={<IconX size={16} />}>
                        <Stack gap="xs">
                          {result.errors.map((error, i) => (
                            <Text key={i} size="sm">
                              {error}
                            </Text>
                          ))}
                        </Stack>
                      </Alert>
                    )}

                    {result.data && (
                      <Table.ScrollContainer minWidth={420}>
                        <Table>
                          <Table.Tbody>
                            <Table.Tr>
                              <Table.Td fw={500}>Cognome</Table.Td>
                              <Table.Td>{result.data.surname}</Table.Td>
                            </Table.Tr>
                            <Table.Tr>
                              <Table.Td fw={500}>Nome</Table.Td>
                              <Table.Td>{result.data.name}</Table.Td>
                            </Table.Tr>
                            <Table.Tr>
                              <Table.Td fw={500}>Data di nascita</Table.Td>
                              <Table.Td>{result.data.birthDate}</Table.Td>
                            </Table.Tr>
                            <Table.Tr>
                              <Table.Td fw={500}>Sesso</Table.Td>
                              <Table.Td>
                                <Badge
                                  variant="light"
                                  color={result.data.gender === 'Maschio' ? 'indigo' : 'violet'}
                                >
                                  {result.data.gender}
                                </Badge>
                              </Table.Td>
                            </Table.Tr>
                            <Table.Tr>
                              <Table.Td fw={500}>Luogo di nascita</Table.Td>
                              <Table.Td>{result.data.birthPlace}</Table.Td>
                            </Table.Tr>
                          </Table.Tbody>
                        </Table>
                      </Table.ScrollContainer>
                    )}
                  </Stack>
                </Paper>
              )}
            </Box>
          </Stack>
        </ToolSection>

        <ToolSection title="Come Funziona">
          <Text mb="md">
            Il validatore codice fiscale verifica la correttezza formale di un codice fiscale
            italiano controllando il formato e il carattere di controllo.
          </Text>
          <Text mb="md">
            <strong>Struttura del codice fiscale:</strong>
          </Text>
          <Table.ScrollContainer minWidth={480}>
            <Table mb="md">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Posizione</Table.Th>
                  <Table.Th>Caratteri</Table.Th>
                  <Table.Th>Significato</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {cfStructure.map((row) => (
                  <Table.Tr key={row.position}>
                    <Table.Td>{row.position}</Table.Td>
                    <Table.Td>{row.chars}</Table.Td>
                    <Table.Td>{row.meaning}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
          <Alert icon={<IconInfoCircle size={16} />} color="indigo" variant="light">
            Questo strumento verifica solo la correttezza formale del codice fiscale. Non
            verifica se il codice è effettivamente assegnato a una persona reale.
          </Alert>
        </ToolSection>

        <ToolFaq items={faqs} />
      </ToolLayout>
    </>
  );
}
