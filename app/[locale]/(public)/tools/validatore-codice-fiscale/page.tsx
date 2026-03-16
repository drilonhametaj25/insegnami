'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import {
  Container,
  Title,
  Text,
  Card,
  Stack,
  Group,
  TextInput,
  Button,
  Paper,
  ThemeIcon,
  Box,
  Anchor,
  Accordion,
  SimpleGrid,
  Badge,
  Table,
  Alert,
} from '@mantine/core';
import { IconId, IconArrowLeft, IconCheck, IconX, IconInfoCircle } from '@tabler/icons-react';
import Link from 'next/link';

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

// Month codes for CF
const monthCodes: { [key: string]: number } = {
  A: 1, B: 2, C: 3, D: 4, E: 5, H: 6,
  L: 7, M: 8, P: 9, R: 10, S: 11, T: 12,
};

// Odd position values
const oddValues: { [key: string]: number } = {
  '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
  'A': 1, 'B': 0, 'C': 5, 'D': 7, 'E': 9, 'F': 13, 'G': 15, 'H': 17, 'I': 19, 'J': 21,
  'K': 2, 'L': 4, 'M': 18, 'N': 20, 'O': 11, 'P': 3, 'Q': 6, 'R': 8, 'S': 12, 'T': 14,
  'U': 16, 'V': 10, 'W': 22, 'X': 25, 'Y': 24, 'Z': 23,
};

// Even position values
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

export default function ValidatoreCodiceFiscalePage() {
  const locale = useLocale();
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

  const faqs = [
    {
      question: 'Come è composto il codice fiscale?',
      answer:
        'Il codice fiscale italiano è composto da 16 caratteri: 3 lettere per il cognome, 3 per il nome, 2 cifre per l\'anno di nascita, 1 lettera per il mese, 2 cifre per il giorno (per le donne si aggiunge 40), 4 caratteri per il comune di nascita (o stato estero), e 1 carattere di controllo.',
    },
    {
      question: 'Cosa significa il carattere di controllo?',
      answer:
        'L\'ultimo carattere del codice fiscale è un carattere di controllo calcolato con un algoritmo specifico sui primi 15 caratteri. Serve a verificare che il codice non contenga errori di trascrizione.',
    },
    {
      question: 'Perché il giorno di nascita può essere superiore a 31?',
      answer:
        'Per le persone di sesso femminile, al giorno di nascita viene sommato 40. Quindi se una donna è nata il 15 del mese, nel codice fiscale apparirà 55.',
    },
    {
      question: 'Questo strumento verifica l\'esistenza del codice fiscale?',
      answer:
        'No, questo strumento verifica solo la correttezza formale del codice fiscale (formato e carattere di controllo). Non verifica se il codice fiscale è effettivamente assegnato a una persona.',
    },
  ];

  return (
    <>
      {/* Hero Section */}
      <Box
        style={{
          background: 'linear-gradient(135deg, var(--mantine-color-red-6) 0%, var(--mantine-color-pink-5) 100%)',
          color: 'white',
          padding: '3rem 0',
        }}
      >
        <Container size="lg">
          <Stack gap="md">
            <Anchor component={Link} href={`/${locale}/tools`} c="white" size="sm">
              <Group gap={4}>
                <IconArrowLeft size={16} />
                Tutti gli strumenti
              </Group>
            </Anchor>
            <Group gap="lg" align="center">
              <ThemeIcon size={60} radius="xl" variant="white" color="red">
                <IconId size={30} />
              </ThemeIcon>
              <div>
                <Title order={1}>Validatore Codice Fiscale</Title>
                <Text size="lg" mt="xs">
                  Verifica la correttezza di un codice fiscale italiano
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
                  Inserisci il codice fiscale
                </Title>

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
                  <Button onClick={validate} size="lg" color="red">
                    Verifica
                  </Button>
                  <Button variant="outline" onClick={reset} color="red">
                    Reset
                  </Button>
                </Group>

                {/* Result */}
                {result && (
                  <Paper p="xl" radius="md" bg={result.isValid ? 'green.0' : 'red.0'}>
                    <Stack gap="md">
                      <Group>
                        <ThemeIcon
                          size={40}
                          radius="xl"
                          color={result.isValid ? 'green' : 'red'}
                        >
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
                                <Badge color={result.data.gender === 'Maschio' ? 'blue' : 'pink'}>
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
                      )}
                    </Stack>
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
                Il validatore codice fiscale verifica la correttezza formale di un codice
                fiscale italiano controllando il formato e il carattere di controllo.
              </Text>
              <Text mb="md">
                <strong>Struttura del codice fiscale:</strong>
              </Text>
              <Table mb="md">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Posizione</Table.Th>
                    <Table.Th>Caratteri</Table.Th>
                    <Table.Th>Significato</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  <Table.Tr>
                    <Table.Td>1-3</Table.Td>
                    <Table.Td>3 lettere</Table.Td>
                    <Table.Td>Cognome</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>4-6</Table.Td>
                    <Table.Td>3 lettere</Table.Td>
                    <Table.Td>Nome</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>7-8</Table.Td>
                    <Table.Td>2 cifre</Table.Td>
                    <Table.Td>Anno di nascita</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>9</Table.Td>
                    <Table.Td>1 lettera</Table.Td>
                    <Table.Td>Mese di nascita</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>10-11</Table.Td>
                    <Table.Td>2 cifre</Table.Td>
                    <Table.Td>Giorno (+40 se femmina)</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>12-15</Table.Td>
                    <Table.Td>4 caratteri</Table.Td>
                    <Table.Td>Codice comune/stato</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>16</Table.Td>
                    <Table.Td>1 lettera</Table.Td>
                    <Table.Td>Carattere di controllo</Table.Td>
                  </Table.Tr>
                </Table.Tbody>
              </Table>
              <Alert icon={<IconInfoCircle size={16} />} color="blue">
                Questo strumento verifica solo la correttezza formale del codice fiscale.
                Non verifica se il codice è effettivamente assegnato a una persona reale.
              </Alert>
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
              <Card withBorder p="xl" radius="md" bg="red.0">
                <Stack gap="md">
                  <Title order={3} ta="center">
                    Gestisci le Anagrafiche
                  </Title>
                  <Text ta="center" size="sm" c="dimmed">
                    Con InsegnaMi.pro gestisci tutti i dati anagrafici degli studenti
                    con validazione automatica del codice fiscale.
                  </Text>
                  <Anchor
                    component={Link}
                    href="/auth/register"
                    style={{
                      backgroundColor: 'var(--mantine-color-red-6)',
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

              {/* Month Codes Reference */}
              <Card withBorder p="md">
                <Title order={4} mb="sm">
                  Codici Mese
                </Title>
                <SimpleGrid cols={3} spacing="xs">
                  {Object.entries(monthCodes).map(([code, month]) => (
                    <Badge key={code} variant="light" color="gray">
                      {code} = {month.toString().padStart(2, '0')}
                    </Badge>
                  ))}
                </SimpleGrid>
              </Card>

              {/* Related Tools */}
              <Card withBorder p="md">
                <Title order={4} mb="sm">
                  Strumenti Correlati
                </Title>
                <Stack gap="xs">
                  <Anchor component={Link} href={`/${locale}/tools/calcolatore-media-voti`} size="sm">
                    Calcolatore Media Voti
                  </Anchor>
                  <Anchor component={Link} href={`/${locale}/tools/calcolatore-presenze`} size="sm">
                    Calcolatore Presenze
                  </Anchor>
                  <Anchor component={Link} href={`/${locale}/tools/generatore-comunicazioni`} size="sm">
                    Generatore Comunicazioni
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
