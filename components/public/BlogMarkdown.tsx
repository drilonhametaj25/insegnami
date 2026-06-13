import {
  Anchor,
  Code,
  Divider,
  List,
  ListItem,
  Paper,
  Table,
  TableScrollContainer,
  TableTbody,
  TableTd,
  TableTh,
  TableThead,
  TableTr,
  Text,
  Title,
  rem,
} from '@mantine/core';
import { isValidElement, type ReactNode } from 'react';
import type { Components } from 'react-markdown';

/**
 * Mapping tipografico Mantine per ReactMarkdown (corpo articoli del blog).
 * Tailwind typography NON esiste nel progetto: senza questo mapping il
 * markdown resterebbe privo di stili. Tenuto in un file separato per essere
 * riusabile e testabile.
 * NB: solo import nominali (ListItem, TableThead...) — niente dot-notation
 * nei Server Components (in build di produzione risolvono a undefined).
 */

/** Estrae il testo "piatto" da un sottoalbero React (per i blocchi di codice). */
function testoDa(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(testoDa).join('');
  if (isValidElement(node)) {
    return testoDa((node.props as { children?: ReactNode }).children);
  }
  return '';
}

export const blogMarkdownComponents: Components = {
  // Negli articoli l'h1 è già il titolo di pagina: il primo livello del corpo resta h2.
  h1: ({ children }) => (
    <Title order={2} fz={rem(28)} fw={800} c="var(--pub-ink)" mt="xl" mb="sm">
      {children}
    </Title>
  ),
  h2: ({ children }) => (
    <Title order={2} fz={rem(24)} fw={800} c="var(--pub-ink)" mt="xl" mb="sm">
      {children}
    </Title>
  ),
  h3: ({ children }) => (
    <Title order={3} fz={rem(20)} fw={700} c="var(--pub-ink)" mt="lg" mb="xs">
      {children}
    </Title>
  ),
  p: ({ children }) => (
    <Text size="md" lh={1.7} mb="md" c="gray.8">
      {children}
    </Text>
  ),
  ul: ({ children }) => (
    <List spacing="sm" mb="md">
      {children}
    </List>
  ),
  ol: ({ children }) => (
    <List type="ordered" spacing="sm" mb="md">
      {children}
    </List>
  ),
  li: ({ children }) => <ListItem>{children}</ListItem>,
  a: ({ href, children }) => {
    const esterno = /^https?:\/\//.test(href ?? '');
    return (
      <Anchor
        href={href}
        c="navy.6"
        underline="hover"
        fw={500}
        {...(esterno ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {children}
      </Anchor>
    );
  },
  blockquote: ({ children }) => (
    <Paper
      p="md"
      mb="md"
      radius="md"
      bg="gray.0"
      style={{ borderLeft: '3px solid var(--mantine-color-navy-6)', fontStyle: 'italic' }}
    >
      {children}
    </Paper>
  ),
  table: ({ children }) => (
    <TableScrollContainer minWidth={480} mb="md">
      <Table striped withTableBorder>
        {children}
      </Table>
    </TableScrollContainer>
  ),
  thead: ({ children }) => <TableThead>{children}</TableThead>,
  tbody: ({ children }) => <TableTbody>{children}</TableTbody>,
  tr: ({ children }) => <TableTr>{children}</TableTr>,
  th: ({ children }) => <TableTh>{children}</TableTh>,
  td: ({ children }) => <TableTd>{children}</TableTd>,
  // Codice inline; i blocchi passano da `pre` qui sotto.
  code: ({ children }) => <Code>{children}</Code>,
  // Blocco di codice: estraiamo il testo per evitare Code annidato dentro Code.
  pre: ({ children }) => (
    <Code block mb="md">
      {testoDa(children)}
    </Code>
  ),
  hr: () => <Divider my="lg" />,
};
