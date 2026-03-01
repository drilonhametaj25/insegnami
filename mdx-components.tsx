import type { MDXComponents } from 'mdx/types';
import { Title, Text, Anchor, Code, Table, Image, Box, Stack } from '@mantine/core';

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: ({ children }) => (
      <Title order={1} mb="lg" mt="xl">
        {children}
      </Title>
    ),
    h2: ({ children }) => (
      <Title order={2} mb="md" mt="lg">
        {children}
      </Title>
    ),
    h3: ({ children }) => (
      <Title order={3} mb="sm" mt="md">
        {children}
      </Title>
    ),
    h4: ({ children }) => (
      <Title order={4} mb="xs" mt="sm">
        {children}
      </Title>
    ),
    p: ({ children }) => (
      <Text mb="md" style={{ lineHeight: 1.7 }}>
        {children}
      </Text>
    ),
    a: ({ href, children }) => (
      <Anchor href={href} target={href?.startsWith('http') ? '_blank' : undefined}>
        {children}
      </Anchor>
    ),
    code: ({ children }) => <Code>{children}</Code>,
    pre: ({ children }) => (
      <Code block mb="md">
        {children}
      </Code>
    ),
    ul: ({ children }) => (
      <Box component="ul" mb="md" pl="md" style={{ lineHeight: 1.7 }}>
        {children}
      </Box>
    ),
    ol: ({ children }) => (
      <Box component="ol" mb="md" pl="md" style={{ lineHeight: 1.7 }}>
        {children}
      </Box>
    ),
    li: ({ children }) => (
      <Box component="li" mb="xs">
        {children}
      </Box>
    ),
    blockquote: ({ children }) => (
      <Box
        component="blockquote"
        mb="md"
        pl="md"
        style={{
          borderLeft: '4px solid var(--mantine-color-blue-5)',
          margin: '1rem 0',
          color: 'var(--mantine-color-dimmed)',
          fontStyle: 'italic',
        }}
      >
        {children}
      </Box>
    ),
    table: ({ children }) => (
      <Table mb="md" striped highlightOnHover>
        {children}
      </Table>
    ),
    img: ({ src, alt }) => (
      <Image src={src} alt={alt || ''} radius="md" mb="md" />
    ),
    strong: ({ children }) => <strong>{children}</strong>,
    em: ({ children }) => <em>{children}</em>,
    ...components,
  };
}
