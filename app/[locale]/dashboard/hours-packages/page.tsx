'use client';

import { useState, useEffect } from 'react';
import {
  Container,
  Title,
  Grid,
  Card,
  Text,
  Button,
  Group,
  Table,
  Badge,
  ActionIcon,
  Menu,
  LoadingOverlay,
  Alert,
  Stack,
  TextInput,
  Select,
  Progress,
} from '@mantine/core';
import {
  IconPlus,
  IconSearch,
  IconFilter,
  IconDotsVertical,
  IconEdit,
  IconTrash,
  IconAlertCircle,
  IconClock,
  IconPackage,
  IconChartBar,
  IconCurrencyEuro,
} from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { ModernModal } from '@/components/modals/ModernModal';
import { ModernStatsCard } from '@/components/cards/ModernStatsCard';
import { HoursPackageForm, HoursPackageFormData } from '@/components/forms/HoursPackageForm';

interface HoursPackage {
  id: string;
  studentId: string;
  courseId: string;
  totalHours: number;
  remainingHours: number;
  purchaseDate: string;
  expiryDate: string | null;
  price: number | null;
  isActive: boolean;
  notes: string | null;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    studentCode: string;
  };
  course: {
    id: string;
    name: string;
    code: string;
  };
}

export default function HoursPackagesPage() {
  const t = useTranslations();
  const tc = useTranslations('common');
  const [packages, setPackages] = useState<HoursPackage[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);
  const [selectedPackage, setSelectedPackage] = useState<HoursPackage | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [packagesRes, studentsRes, coursesRes] = await Promise.all([
        fetch('/api/hours-packages'),
        fetch('/api/students'),
        fetch('/api/courses'),
      ]);

      if (packagesRes.ok) {
        const packagesData = await packagesRes.json();
        setPackages(packagesData);
      }

      if (studentsRes.ok) {
        const studentsData = await studentsRes.json();
        setStudents(studentsData);
      }

      if (coursesRes.ok) {
        const coursesData = await coursesRes.json();
        setCourses(coursesData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      notifications.show({
        title: t('common.error'),
        message: t('hoursPackages.loadError'),
        color: 'red',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = () => {
    setSelectedPackage(null);
    openModal();
  };

  const handleSubmit = async (data: HoursPackageFormData) => {
    try {
      setIsSubmitting(true);

      const response = await fetch('/api/hours-packages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          expiryDate: data.expiryDate?.toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create package');
      }

      notifications.show({
        title: t('common.success'),
        message: t('hoursPackages.created'),
        color: 'green',
      });

      closeModal();
      fetchData();
    } catch (error) {
      notifications.show({
        title: t('common.error'),
        message: t('hoursPackages.createError'),
        color: 'red',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedPackage) return;

    try {
      const response = await fetch(`/api/hours-packages/${selectedPackage.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete package');
      }

      notifications.show({
        title: t('common.success'),
        message: t('hoursPackages.deleted'),
        color: 'green',
      });

      closeDeleteModal();
      fetchData();
    } catch (error) {
      notifications.show({
        title: t('common.error'),
        message: t('hoursPackages.deleteError'),
        color: 'red',
      });
    }
  };

  // Filter packages
  const filteredPackages = packages.filter((pkg) => {
    const matchesSearch =
      pkg.student.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pkg.student.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pkg.course.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pkg.student.studentCode.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && pkg.isActive) ||
      (statusFilter === 'inactive' && !pkg.isActive);

    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const totalPackages = packages.length;
  const activePackages = packages.filter((p) => p.isActive).length;
  const totalHoursSold = packages.reduce((sum, p) => sum + parseFloat(p.totalHours.toString()), 0);
  const totalHoursRemaining = packages.reduce((sum, p) => sum + parseFloat(p.remainingHours.toString()), 0);
  const totalRevenue = packages.reduce((sum, p) => sum + (p.price ? parseFloat(p.price.toString()) : 0), 0);

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" mb="xl">
        <div>
          <Title order={2}>{t('hoursPackages.title')}</Title>
          <Text c="dimmed" size="sm">
            {t('hoursPackages.subtitle')}
          </Text>
        </div>
        <Button leftSection={<IconPlus size="1rem" />} onClick={handleCreate}>
          {t('hoursPackages.addPackage')}
        </Button>
      </Group>

      {/* Stats Cards */}
      <Grid mb="xl">
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <ModernStatsCard
            title={t('hoursPackages.totalPackages')}
            value={totalPackages.toString()}
            icon={<IconPackage size="1.5rem" />}
            gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <ModernStatsCard
            title={t('hoursPackages.hoursSold')}
            value={totalHoursSold.toFixed(1)}
            icon={<IconClock size="1.5rem" />}
            gradient="linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <ModernStatsCard
            title={t('hoursPackages.hoursRemaining')}
            value={totalHoursRemaining.toFixed(1)}
            icon={<IconChartBar size="1.5rem" />}
            gradient="linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <ModernStatsCard
            title={t('hoursPackages.totalRevenue')}
            value={`€ ${totalRevenue.toFixed(2)}`}
            icon={<IconCurrencyEuro size="1.5rem" />}
            gradient="linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)"
          />
        </Grid.Col>
      </Grid>

      {/* Filters */}
      <Card withBorder mb="md">
        <Group>
          <TextInput
            placeholder={tc('search')}
            leftSection={<IconSearch size="1rem" />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1 }}
          />
          <Select
            placeholder={tc('status')}
            leftSection={<IconFilter size="1rem" />}
            value={statusFilter}
            onChange={(value) => setStatusFilter(value || 'all')}
            data={[
              { value: 'all', label: tc('all') },
              { value: 'active', label: tc('active') },
              { value: 'inactive', label: tc('inactive') },
            ]}
            style={{ width: 150 }}
          />
        </Group>
      </Card>

      {/* Packages Table */}
      <Card withBorder>
        <LoadingOverlay visible={isLoading} />
        
        {filteredPackages.length === 0 ? (
          <Alert icon={<IconAlertCircle size="1rem" />} title={tc('noData')} color="gray">
            {t('hoursPackages.noPackages')}
          </Alert>
        ) : (
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('students.student')}</Table.Th>
                <Table.Th>{t('course')}</Table.Th>
                <Table.Th>{t('hoursPackages.hours')}</Table.Th>
                <Table.Th>{t('hoursPackages.progress')}</Table.Th>
                <Table.Th>{t('price')}</Table.Th>
                <Table.Th>{tc('status')}</Table.Th>
                <Table.Th>{t('hoursPackages.expiryDate')}</Table.Th>
                <Table.Th>{tc('actions')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredPackages.map((pkg) => {
                const usedHours = parseFloat(pkg.totalHours.toString()) - parseFloat(pkg.remainingHours.toString());
                const usagePercent = (usedHours / parseFloat(pkg.totalHours.toString())) * 100;
                const isExpired = pkg.expiryDate && new Date(pkg.expiryDate) < new Date();
                const isLowHours = usagePercent > 80;

                return (
                  <Table.Tr key={pkg.id}>
                    <Table.Td>
                      <div>
                        <Text fw={500} size="sm">
                          {pkg.student.firstName} {pkg.student.lastName}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {pkg.student.studentCode}
                        </Text>
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{pkg.course.name}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={4}>
                        <Text size="sm" fw={500}>
                          {parseFloat(pkg.remainingHours.toString()).toFixed(1)} / {parseFloat(pkg.totalHours.toString()).toFixed(1)}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {usedHours.toFixed(1)} {t('hoursPackages.used')}
                        </Text>
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Progress
                        value={usagePercent}
                        color={isLowHours ? 'red' : 'blue'}
                        size="sm"
                        style={{ minWidth: 100 }}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {pkg.price ? `€ ${parseFloat(pkg.price.toString()).toFixed(2)}` : '-'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={pkg.isActive ? (isLowHours ? 'orange' : 'green') : 'gray'} variant="light">
                        {isExpired
                          ? tc('expired')
                          : pkg.isActive
                          ? isLowHours
                            ? t('hoursPackages.lowHours')
                            : tc('active')
                          : tc('inactive')}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {pkg.expiryDate
                          ? new Date(pkg.expiryDate).toLocaleDateString()
                          : tc('noExpiry')}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Menu shadow="md" width={200}>
                        <Menu.Target>
                          <ActionIcon variant="subtle" color="gray">
                            <IconDotsVertical size="1rem" />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item
                            leftSection={<IconTrash size="1rem" />}
                            color="red"
                            onClick={() => {
                              setSelectedPackage(pkg);
                              openDeleteModal();
                            }}
                          >
                            {tc('delete')}
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      {/* Create/Edit Modal */}
      <ModernModal
        opened={modalOpened}
        onClose={closeModal}
        title={selectedPackage ? t('hoursPackages.editPackage') : t('hoursPackages.addPackage')}
        size="lg"
      >
        <HoursPackageForm
          students={students}
          courses={courses}
          onSubmit={handleSubmit}
          onCancel={closeModal}
          isSubmitting={isSubmitting}
        />
      </ModernModal>

      {/* Delete Confirmation Modal */}
      <ModernModal
        opened={deleteModalOpened}
        onClose={closeDeleteModal}
        title={tc('confirmDelete')}
        size="sm"
      >
        <Stack>
          <Text>
            {t('hoursPackages.deleteConfirm', {
              student: selectedPackage
                ? `${selectedPackage.student.firstName} ${selectedPackage.student.lastName}`
                : '',
              course: selectedPackage?.course.name || '',
            })}
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={closeDeleteModal}>
              {tc('cancel')}
            </Button>
            <Button color="red" onClick={handleDelete}>
              {tc('delete')}
            </Button>
          </Group>
        </Stack>
      </ModernModal>
    </Container>
  );
}
