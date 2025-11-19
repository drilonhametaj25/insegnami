'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Container, Paper, Title, Text, LoadingOverlay } from '@mantine/core';

export default function NewLessonPage() {
  const router = useRouter();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const classId = searchParams.get('classId');

  useEffect(() => {
    // Redirect to lessons page with the classId filter
    const redirectUrl = classId 
      ? `/${locale}/dashboard/lessons?classId=${classId}&action=create`
      : `/${locale}/dashboard/lessons?action=create`;
    
    router.replace(redirectUrl);
  }, [classId, locale, router]);

  return (
    <Container size="lg" py="xl">
      <Paper p="xl" style={{ textAlign: 'center' }}>
        <LoadingOverlay visible />
        <Title order={2} mb="md">Reindirizzamento...</Title>
        <Text c="dimmed">
          Stai per essere reindirizzato alla pagina di gestione lezioni
        </Text>
      </Paper>
    </Container>
  );
}
