'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  TextInput,
  Select,
  Textarea,
  Badge,
  ActionIcon,
  Alert,
  Tooltip,
} from '@mantine/core';
import {
  IconPlus,
  IconSearch,
  IconEdit,
  IconTrash,
  IconUsers,
  IconChalkboard,
  IconUserCheck,
  IconUserX,
  IconRefresh,
} from '@tabler/icons-react';
import { useSession } from 'next-auth/react';
import { notifications } from '@mantine/notifications';
import { useTeachers, useTeacherStats, useCreateTeacher, useUpdateTeacher, useDeleteTeacher } from '@/lib/hooks/useTeachers';
import { ModernPageLayout } from '@/components/layouts/ModernPageLayout';
import { SimpleTable } from '@/components/tables/SimpleTable';
import { ModernButton } from '@/components/ui/ModernButton';
import { ModernModal, ModernFormField } from '@/components/modals/ModernModal';

export default function TeachersPage() {
  const { data: session } = useSession();
  const t = useTranslations('teachers');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('lastName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [modalOpened, setModalOpened] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<any>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    qualifications: '',
    specializations: '',
    hireDate: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED',
    notes: '',
  });

  // TanStack Query hooks
  const {
    data: teachersData,
    isLoading: teachersLoading,
    error: teachersError,
    refetch: refetchTeachers,
  } = useTeachers(page, 20, {
    search,
    status: statusFilter,
    sortBy,
    sortOrder,
  });

  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
  } = useTeacherStats();

  const createTeacherMutation = useCreateTeacher();
  const updateTeacherMutation = useUpdateTeacher();
  const deleteTeacherMutation = useDeleteTeacher();

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingTeacher) {
        await updateTeacherMutation.mutateAsync({
          id: editingTeacher.id,
          data: formData,
        });
        notifications.show({
          title: tCommon('success'),
          message: t('teacherUpdated'),
          color: 'green',
        });
      } else {
        await createTeacherMutation.mutateAsync(formData);
        notifications.show({
          title: tCommon('success'),
          message: t('teacherCreated'),
          color: 'green',
        });
      }

      setModalOpened(false);
      setEditingTeacher(null);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        qualifications: '',
        specializations: '',
        hireDate: '',
        status: 'ACTIVE',
        notes: '',
      });
    } catch (error) {
      notifications.show({
        title: tCommon('error'),
        message: editingTeacher ? t('updateError') : t('createError'),
        color: 'red',
      });
    }
  };

  // Handle delete
  const handleDelete = async (teacherId: string) => {
    try {
      await deleteTeacherMutation.mutateAsync(teacherId);
      notifications.show({
        title: tCommon('success'),
        message: t('teacherDeleted'),
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: tCommon('error'),
        message: t('deleteError'),
        color: 'red',
      });
    }
  };

  // Handle edit
  const handleEdit = (teacher: any) => {
    setEditingTeacher(teacher);
    setFormData({
      firstName: teacher.firstName || '',
      lastName: teacher.lastName || '',
      email: teacher.email || '',
      phone: teacher.phone || '',
      qualifications: teacher.qualifications || '',
      specializations: teacher.specializations || '',
      hireDate: teacher.hireDate ? new Date(teacher.hireDate).toISOString().split('T')[0] : '',
      status: teacher.status || 'ACTIVE',
      notes: teacher.notes || '',
    });
    setModalOpened(true);
  };

  if (!session?.user) {
    return (
      <div style={{ padding: '20px' }}>
        <Alert color="red">You must be logged in to view this page.</Alert>
      </div>
    );
  }

  // Table columns
  const columns = [
    { key: 'name', label: t('name'), sortable: true },
    { key: 'email', label: t('email'), sortable: true },
    { key: 'phone', label: t('phone'), sortable: false },
    { key: 'status', label: t('status'), sortable: true },
    { key: 'hireDate', label: t('hireDate'), sortable: true },
    { key: 'actions', label: t('actions'), sortable: false },
  ];

  // Prepare table data
  const tableData = teachersData?.teachers?.map((teacher: any) => ({
    ...teacher,
    name: `${teacher.firstName} ${teacher.lastName}`,
    status: (
      <Badge 
        color={teacher.status === 'ACTIVE' ? 'green' : teacher.status === 'SUSPENDED' ? 'red' : 'gray'}
        variant="light"
      >
        {teacher.status}
      </Badge>
    ),
    hireDate: teacher.hireDate ? new Date(teacher.hireDate).toLocaleDateString(locale) : '-',
    actions: (
      <div style={{ display: 'flex', gap: '8px' }}>
        <Tooltip label={t('edit')}>
          <ActionIcon
            size="sm"
            variant="subtle"
            onClick={() => handleEdit(teacher)}
          >
            <IconEdit size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={t('delete')}>
          <ActionIcon
            size="sm"
            variant="subtle"
            color="red"
            onClick={() => handleDelete(teacher.id)}
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Tooltip>
      </div>
    ),
  })) || [];

  return (
    <ModernPageLayout title={t('title')}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <ModernButton variant="secondary" onClick={() => refetchTeachers()}>
            <IconRefresh size={16} style={{ marginRight: '6px' }} />
            {tCommon('refresh')}
          </ModernButton>
          <ModernButton onClick={() => setModalOpened(true)}>
            <IconPlus size={16} style={{ marginRight: '6px' }} />
            {t('addTeacher')}
          </ModernButton>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
        gap: '20px',
        marginBottom: '32px' 
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '16px',
          padding: '24px',
          color: 'white',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <IconUsers size={24} />
            <div>
              <h3 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
                {stats?.totalTeachers || 0}
              </h3>
              <p style={{ margin: 0, fontSize: '14px', opacity: 0.9 }}>
                {t('totalTeachers')}
              </p>
            </div>
          </div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          borderRadius: '16px',
          padding: '24px',
          color: 'white',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <IconUserCheck size={24} />
            <div>
              <h3 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
                {stats?.activeTeachers || 0}
              </h3>
              <p style={{ margin: 0, fontSize: '14px', opacity: 0.9 }}>
                {t('activeTeachers')}
              </p>
            </div>
          </div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
          borderRadius: '16px',
          padding: '24px',
          color: 'white',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <IconUserX size={24} />
            <div>
              <h3 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
                {stats?.inactiveTeachers || 0}
              </h3>
              <p style={{ margin: 0, fontSize: '14px', opacity: 0.9 }}>
                {t('inactiveTeachers')}
              </p>
            </div>
          </div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          borderRadius: '16px',
          padding: '24px',
          color: 'white',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <IconChalkboard size={24} />
            <div>
              <h3 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
                {stats?.avgClassesPerTeacher?.toFixed(1) || '0'}
              </h3>
              <p style={{ margin: 0, fontSize: '14px', opacity: 0.9 }}>
                Avg Classes/Teacher
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ 
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '24px',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <TextInput
            placeholder={t('searchPlaceholder')}
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            styles={{
              input: {
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'white',
                '&::placeholder': { color: 'rgba(255, 255, 255, 0.5)' },
                '&:focus': {
                  borderColor: 'rgba(59, 130, 246, 0.5)',
                  boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)',
                }
              }
            }}
          />
          <Select
            placeholder={t('allStatuses')}
            data={[
              { value: '', label: t('allStatuses') },
              { value: 'ACTIVE', label: t('active') },
              { value: 'INACTIVE', label: t('inactive') },
              { value: 'SUSPENDED', label: t('suspended') },
            ]}
            value={statusFilter}
            onChange={(value) => setStatusFilter(value || '')}
            styles={{
              input: {
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'white',
                '&::placeholder': { color: 'rgba(255, 255, 255, 0.5)' },
              },
              dropdown: {
                background: '#1e293b',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              },
              option: {
                color: 'white',
                '&:hover': { background: 'rgba(59, 130, 246, 0.2)' },
                '&[dataComboboxSelected]': { background: 'rgba(59, 130, 246, 0.3)' }
              }
            }}
          />
        </div>
      </div>

      {/* Table */}
      {teachersError ? (
        <Alert color="red" style={{ marginBottom: '24px' }}>
          {t('teachersError')}
        </Alert>
      ) : (
        <SimpleTable data={tableData} loading={teachersLoading} />
      )}

      {/* Add/Edit Modal */}
      <ModernModal
        opened={modalOpened}
        onClose={() => {
          setModalOpened(false);
          setEditingTeacher(null);
          setFormData({
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            qualifications: '',
            specializations: '',
            hireDate: '',
            status: 'ACTIVE',
            notes: '',
          });
        }}
        title={editingTeacher ? t('editTeacher') : t('addTeacher')}
        size="lg"
      >
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <ModernFormField
              component={TextInput}
              label={t('firstName')}
              required
              value={formData.firstName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, firstName: e.target.value })
              }
            />
            <ModernFormField
              component={TextInput}
              label={t('lastName')}
              required
              value={formData.lastName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, lastName: e.target.value })
              }
            />
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <ModernFormField
              component={TextInput}
              label={t('email')}
              type="email"
              required
              value={formData.email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, email: e.target.value })
              }
            />
            <ModernFormField
              component={TextInput}
              label={t('phone')}
              value={formData.phone}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, phone: e.target.value })
              }
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <ModernFormField
              component={TextInput}
              label={t('hireDate')}
              type="date"
              value={formData.hireDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, hireDate: e.target.value })
              }
            />
            <ModernFormField
              component={Select}
              label={t('status')}
              required
              data={[
                { value: 'ACTIVE', label: t('active') },
                { value: 'INACTIVE', label: t('inactive') },
                { value: 'SUSPENDED', label: t('suspended') },
              ]}
              value={formData.status}
              onChange={(value: string) =>
                setFormData({ ...formData, status: value as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' })
              }
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <ModernFormField
              component={Textarea}
              label={t('qualifications')}
              rows={3}
              value={formData.qualifications}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setFormData({ ...formData, qualifications: e.target.value })
              }
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <ModernFormField
              component={Textarea}
              label={t('specializations')}
              rows={3}
              value={formData.specializations}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setFormData({ ...formData, specializations: e.target.value })
              }
            />
          </div>

          <ModernFormField
            component={Textarea}
            label={t('notes')}
            rows={3}
            value={formData.notes}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setFormData({ ...formData, notes: e.target.value })
            }
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
            <ModernButton variant="secondary" type="button" onClick={() => setModalOpened(false)}>
              {tCommon('cancel')}
            </ModernButton>
            <ModernButton type="submit" loading={createTeacherMutation.isPending || updateTeacherMutation.isPending}>
              {editingTeacher ? tCommon('update') : tCommon('create')}
            </ModernButton>
          </div>
        </form>
      </ModernModal>
    </ModernPageLayout>
  );
}
