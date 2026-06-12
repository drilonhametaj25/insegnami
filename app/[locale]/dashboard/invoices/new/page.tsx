'use client';

import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import {
  Container,
  Title,
  Paper,
  Button,
  Group,
  Stack,
  Alert,
  Skeleton,
  ActionIcon,
  Text,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconAlertTriangle } from '@tabler/icons-react';
import {
  useInvoiceSeries,
  useInvoiceSettings,
  useCustomerProfiles,
  useCreateInvoice,
  useCreateCustomerProfile,
  type CreateInvoiceData,
  type CreateCustomerProfileData,
} from '@/lib/hooks/useInvoices';
import { InvoiceForm } from '@/components/forms/InvoiceForm';

/**
 * Nuova fattura (C2.4): crea una bozza con righe dinamiche e anteprima totali
 * coincidente col server (computeInvoiceTotals), poi redirige al dettaglio.
 */
export default function NewInvoicePage() {
  const router = useRouter();
  const locale = useLocale();

  const { data: settingsData, isLoading: settingsLoading } = useInvoiceSettings();
  const { data: seriesData, isLoading: seriesLoading } = useInvoiceSeries();
  const { data: profilesData, isLoading: profilesLoading } = useCustomerProfiles();
  const createInvoice = useCreateInvoice();
  const createProfile = useCreateCustomerProfile();

  const series = seriesData?.series ?? [];
  const profiles = profilesData?.profiles ?? [];
  const isLoading = settingsLoading || seriesLoading || profilesLoading;

  const setupMissing = !isLoading && (!settingsData?.settings || series.filter((s) => s.isActive).length === 0);

  const handleSubmit = (data: CreateInvoiceData) => {
    createInvoice.mutate(data, {
      onSuccess: (res) => {
        notifications.show({
          title: 'Successo',
          message: 'Bozza fattura creata',
          color: 'green',
        });
        router.push(`/${locale}/dashboard/invoices/${res.invoice.id}`);
      },
      onError: (error) => {
        notifications.show({
          title: 'Errore',
          message: error.message || 'Errore nella creazione della fattura',
          color: 'red',
        });
      },
    });
  };

  const handleCreateProfile = async (data: CreateCustomerProfileData) => {
    const res = await createProfile.mutateAsync(data);
    return res.profile;
  };

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        <Group>
          <ActionIcon
            variant="light"
            size="lg"
            title="Torna alle fatture"
            onClick={() => router.push(`/${locale}/dashboard/invoices`)}
          >
            <IconArrowLeft size={18} />
          </ActionIcon>
          <Title order={2}>Nuova fattura</Title>
        </Group>

        {isLoading ? (
          <Paper p="lg" radius="md" withBorder>
            <Stack gap="sm">
              <Skeleton height={36} />
              <Skeleton height={36} />
              <Skeleton height={120} />
            </Stack>
          </Paper>
        ) : setupMissing ? (
          <Alert
            icon={<IconAlertTriangle size={16} />}
            color="yellow"
            variant="light"
            title="Configura la fatturazione"
          >
            <Stack gap="sm">
              <Text size="sm">
                Prima di creare una fattura configura i dati fiscali della scuola e almeno un
                sezionale attivo.
              </Text>
              <Group>
                <Button
                  size="xs"
                  color="yellow"
                  onClick={() => router.push(`/${locale}/dashboard/invoices/settings`)}
                >
                  Vai alle impostazioni
                </Button>
              </Group>
            </Stack>
          </Alert>
        ) : (
          <Paper p="lg" radius="md" withBorder>
            <InvoiceForm
              series={series}
              profiles={profiles}
              onSubmit={handleSubmit}
              onCreateProfile={handleCreateProfile}
              isSubmitting={createInvoice.isPending}
              isCreatingProfile={createProfile.isPending}
            />
          </Paper>
        )}
      </Stack>
    </Container>
  );
}
