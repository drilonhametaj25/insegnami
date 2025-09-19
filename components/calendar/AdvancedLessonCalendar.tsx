'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Title,
  Group,
  Button,
  Modal,
  Text,
  Badge,
  Stack,
  ActionIcon,
  Menu,
  Alert,
  Select,
  TextInput,
  Textarea,
  Switch,
  NumberInput,
  MultiSelect,
  Divider,
  LoadingOverlay,
  Notification,
  rem,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import {
  IconPlus,
  IconClock,
  IconMapPin,
  IconUsers,
  IconEdit,
  IconTrash,
  IconCopy,
  IconAlertCircle,
  IconCheck,
  IconX,
  IconCalendarEvent,
  IconRepeat,
  IconChevronDown,
} from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { format, addWeeks, addMonths, startOfWeek, endOfWeek } from 'date-fns';
import { it } from 'date-fns/locale';
import AdvancedCalendarComponent from './AdvancedCalendarComponent';

import {
  useLessons,
  useCreateLesson,
  useUpdateLesson,
  useDeleteLesson,
  useCheckConflicts,
  useCreateRecurringLessons,
  useBulkUpdateLessons,
  type LessonEvent,
  type CreateLessonData,
  type ConflictInfo,
} from '@/lib/hooks/useAdvancedLessons';

interface AdvancedLessonCalendarProps {
  classId?: string;
  teacherId?: string;
  initialView?: 'month' | 'week' | 'day';
  readonly?: boolean;
  showCreateButton?: boolean;
  onLessonSelect?: (lesson: LessonEvent) => void;
  height?: number;
}

interface LessonFormData {
  title: string;
  description: string;
  classId: string;
  teacherId: string;
  startTime: Date;
  endTime: Date;
  room: string;
  isRecurring: boolean;
  recurrence: {
    frequency: 'weekly' | 'monthly';
    interval: number;
    endDate?: Date;
    occurrences?: number;
    weekdays?: number[];
  };
}

interface ConflictModalProps {
  conflicts: ConflictInfo['conflicts'];
  onConfirm: () => void;
  onCancel: () => void;
}

const ConflictModal: React.FC<ConflictModalProps> = ({ conflicts, onConfirm, onCancel }) => {
  return (
    <Modal
      opened={true}
      onClose={onCancel}
      title="Conflitti Rilevati"
      size="md"
      centered
    >
      <Alert
        icon={<IconAlertCircle size={16} />}
        title="Attenzione!"
        color="orange"
        mb="md"
      >
        Sono stati rilevati conflitti di orario o aula. Procedere comunque?
      </Alert>

      <Stack gap="sm" mb="md">
        {conflicts.map((conflict) => (
          <Card key={conflict.id} withBorder p="sm" style={{ backgroundColor: '#fff5f5' }}>
            <Text fw={500} size="sm">{conflict.title}</Text>
            <Text size="xs" c="dimmed">
              {format(new Date(conflict.startTime), 'dd/MM/yyyy HH:mm', { locale: it })} -{' '}
              {format(new Date(conflict.endTime), 'HH:mm')}
            </Text>
            {conflict.room && <Text size="xs">Aula: {conflict.room}</Text>}
          </Card>
        ))}
      </Stack>

      <Group justify="flex-end">
        <Button variant="outline" onClick={onCancel}>
          Annulla
        </Button>
        <Button color="orange" onClick={onConfirm}>
          Procedi Comunque
        </Button>
      </Group>
    </Modal>
  );
};

export function AdvancedLessonCalendar({
  classId,
  teacherId,
  initialView = 'week',
  readonly = false,
  showCreateButton = true,
  onLessonSelect,
  height = 600,
}: AdvancedLessonCalendarProps) {
  const t = useTranslations('common');
  
  // State
  const [selectedLesson, setSelectedLesson] = useState<LessonEvent | null>(null);
  const [modalOpened, setModalOpened] = useState(false);
  const [createModalOpened, setCreateModalOpened] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentView, setCurrentView] = useState(initialView);
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    const start = startOfWeek(now, { weekStartsOn: 1 });
    const end = endOfWeek(now, { weekStartsOn: 1 });
    return {
      startDate: format(start, 'yyyy-MM-dd'),
      endDate: format(end, 'yyyy-MM-dd'),
    };
  });
  
  const [conflictInfo, setConflictInfo] = useState<ConflictInfo | null>(null);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [pendingLessonData, setPendingLessonData] = useState<CreateLessonData | null>(null);

  // Form state
  const [formData, setFormData] = useState<LessonFormData>({
    title: '',
    description: '',
    classId: classId || '',
    teacherId: teacherId || '',
    startTime: new Date(),
    endTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour later
    room: '',
    isRecurring: false,
    recurrence: {
      frequency: 'weekly',
      interval: 1,
      weekdays: [],
    },
  });

  // Hooks
  const { data: lessons, isLoading } = useLessons({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    classId,
    teacherId,
  });

  const createMutation = useCreateLesson();
  const updateMutation = useUpdateLesson();
  const deleteMutation = useDeleteLesson();
  const checkConflictsMutation = useCheckConflicts();
  const createRecurringMutation = useCreateRecurringLessons();
  const bulkUpdateMutation = useBulkUpdateLessons();

  // Update date range when view changes
  const handleViewChange = useCallback((view: string, date: Date) => {
    setCurrentView(view as 'month' | 'week' | 'day');
    
    let start: Date;
    let end: Date;

    if (view === 'month') {
      start = new Date(date.getFullYear(), date.getMonth(), 1);
      end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    } else if (view === 'week') {
      start = startOfWeek(date, { weekStartsOn: 1 });
      end = endOfWeek(date, { weekStartsOn: 1 });
    } else {
      start = new Date(date);
      end = new Date(date);
    }

    setDateRange({
      startDate: format(start, 'yyyy-MM-dd'),
      endDate: format(end, 'yyyy-MM-dd'),
    });
  }, []);

  // Handle lesson selection
  const handleSelectEvent = useCallback((event: any) => {
    const lesson = event.resource as LessonEvent;
    setSelectedLesson(lesson);
    setModalOpened(true);
    onLessonSelect?.(lesson);
  }, [onLessonSelect]);

  // Handle slot selection (create new lesson)
  const handleSelectSlot = useCallback(({ start, end }: { start: Date; end: Date }) => {
    if (readonly) return;
    
    setFormData(prev => ({
      ...prev,
      startTime: start,
      endTime: end,
    }));
    setEditMode(false);
    setCreateModalOpened(true);
  }, [readonly]);

  // Handle drag and drop
  const handleEventDrop = useCallback(async ({ 
    event, 
    start, 
    end 
  }: { 
    event: any; 
    start: Date; 
    end: Date; 
  }) => {
    if (readonly) return;

    const lesson = event.resource as LessonEvent;
    
    try {
      // Check for conflicts first
      const conflicts = await checkConflictsMutation.mutateAsync({
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        teacherId: lesson.teacher.id,
        room: lesson.room,
        excludeLessonId: lesson.id,
      });

      if (conflicts.hasConflict) {
        setConflictInfo(conflicts);
        setPendingLessonData({
          title: lesson.title,
          description: lesson.description,
          classId: lesson.class.id,
          teacherId: lesson.teacher.id,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          room: lesson.room,
        });
        setShowConflictModal(true);
        return;
      }

      // No conflicts, update directly
      await updateMutation.mutateAsync({
        id: lesson.id,
        data: {
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        },
      });

    } catch (error) {
      console.error('Error during drag and drop:', error);
    }
  }, [readonly, checkConflictsMutation, updateMutation]);

  // Handle conflict resolution
  const handleConflictConfirm = useCallback(async () => {
    if (!pendingLessonData || !selectedLesson) return;

    try {
      await updateMutation.mutateAsync({
        id: selectedLesson.id,
        data: {
          startTime: pendingLessonData.startTime,
          endTime: pendingLessonData.endTime,
        },
      });
    } catch (error) {
      console.error('Error updating lesson after conflict confirmation:', error);
    } finally {
      setShowConflictModal(false);
      setConflictInfo(null);
      setPendingLessonData(null);
    }
  }, [pendingLessonData, selectedLesson, updateMutation]);

  const handleConflictCancel = useCallback(() => {
    setShowConflictModal(false);
    setConflictInfo(null);
    setPendingLessonData(null);
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    try {
      // Check for conflicts first
      const conflicts = await checkConflictsMutation.mutateAsync({
        startTime: formData.startTime.toISOString(),
        endTime: formData.endTime.toISOString(),
        teacherId: formData.teacherId,
        room: formData.room,
        ...(editMode && selectedLesson && { excludeLessonId: selectedLesson.id }),
      });

      const lessonData: CreateLessonData = {
        title: formData.title,
        description: formData.description,
        classId: formData.classId,
        teacherId: formData.teacherId,
        startTime: formData.startTime.toISOString(),
        endTime: formData.endTime.toISOString(),
        room: formData.room,
        isRecurring: formData.isRecurring,
        recurrenceRule: formData.isRecurring ? JSON.stringify({
          ...formData.recurrence,
          endDate: formData.recurrence.endDate?.toISOString(),
        }) : undefined,
      };

      if (conflicts.hasConflict) {
        setConflictInfo(conflicts);
        setPendingLessonData(lessonData);
        setShowConflictModal(true);
        return;
      }

      // No conflicts, proceed
      if (editMode && selectedLesson) {
        await updateMutation.mutateAsync({
          id: selectedLesson.id,
          data: lessonData,
        });
      } else if (formData.isRecurring) {
        await createRecurringMutation.mutateAsync({
          lessonData,
          recurrence: {
            ...formData.recurrence,
            endDate: formData.recurrence.endDate?.toISOString(),
          },
        });
      } else {
        await createMutation.mutateAsync(lessonData);
      }

      setCreateModalOpened(false);
      setFormData({
        title: '',
        description: '',
        classId: classId || '',
        teacherId: teacherId || '',
        startTime: new Date(),
        endTime: new Date(Date.now() + 60 * 60 * 1000),
        room: '',
        isRecurring: false,
        recurrence: {
          frequency: 'weekly',
          interval: 1,
          weekdays: [],
        },
      });

    } catch (error) {
      console.error('Error submitting lesson form:', error);
    }
  }, [formData, editMode, selectedLesson, checkConflictsMutation, updateMutation, createMutation, createRecurringMutation, classId, teacherId]);

  const handleDelete = useCallback(() => {
    if (!selectedLesson) return;

    modals.openConfirmModal({
      title: 'Elimina lezione',
      children: (
        <Text>
          Sei sicuro di voler eliminare la lezione "{selectedLesson.title}"?
          {selectedLesson.isRecurring && (
            <Text size="sm" c="dimmed" mt="xs">
              Questa lezione fa parte di una serie ricorrente.
            </Text>
          )}
        </Text>
      ),
      labels: { confirm: 'Elimina', cancel: 'Annulla' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await deleteMutation.mutateAsync(selectedLesson.id);
          setModalOpened(false);
        } catch (error) {
          console.error('Error deleting lesson:', error);
        }
      },
    });
  }, [selectedLesson, deleteMutation]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return 'blue';
      case 'IN_PROGRESS':
        return 'yellow';
      case 'COMPLETED':
        return 'green';
      case 'CANCELLED':
        return 'red';
      default:
        return 'gray';
    }
  };

  return (
    <>
      <Card withBorder radius="md" p="lg" style={{ position: 'relative' }}>
        <LoadingOverlay visible={isLoading} />
        
        <Group justify="space-between" mb="md">
          <Group>
            <Title order={3}>Calendario Avanzato</Title>
            <Badge color="blue" variant="light">
              {lessons?.length || 0} lezioni
            </Badge>
          </Group>
          
          <Group>
            <Select
              value={currentView}
              onChange={(value) => value && setCurrentView(value as any)}
              data={[
                { value: 'month', label: 'Mese' },
                { value: 'week', label: 'Settimana' },
                { value: 'day', label: 'Giorno' },
              ]}
              size="sm"
            />
            
            {!readonly && showCreateButton && (
              <Button
                leftSection={<IconPlus size={16} />}
                size="sm"
                onClick={() => {
                  setEditMode(false);
                  setCreateModalOpened(true);
                }}
              >
                Nuova Lezione
              </Button>
            )}
          </Group>
        </Group>

        <div style={{ height }}>
          <AdvancedCalendarComponent
            lessons={lessons || []}
            onSelectEvent={handleSelectEvent}
            onSelectSlot={handleSelectSlot}
            onEventDrop={handleEventDrop}
            view={currentView}
            onViewChange={handleViewChange}
            readonly={readonly}
            height={height}
          />
        </div>
      </Card>

      {/* Lesson Details Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title="Dettagli Lezione"
        size="md"
      >
        {selectedLesson && (
          <Stack gap="md">
            <Group justify="space-between">
              <Title order={4}>{selectedLesson.title}</Title>
              <Group>
                <Badge color={getStatusColor(selectedLesson.status)}>
                  {selectedLesson.status}
                </Badge>
                {selectedLesson.isRecurring && (
                  <Badge color="violet" leftSection={<IconRepeat size={12} />}>
                    Ricorrente
                  </Badge>
                )}
              </Group>
            </Group>

            {selectedLesson.description && (
              <Text size="sm" c="dimmed">
                {selectedLesson.description}
              </Text>
            )}

            <Group gap="xs">
              <IconClock size={16} />
              <Text size="sm">
                {format(new Date(selectedLesson.startTime), 'dd/MM/yyyy HH:mm', { locale: it })} -{' '}
                {format(new Date(selectedLesson.endTime), 'HH:mm')}
              </Text>
            </Group>

            <Group gap="xs">
              <IconUsers size={16} />
              <Text size="sm">
                {selectedLesson.class.course.name} - {selectedLesson.class.name}
              </Text>
            </Group>

            <Group gap="xs">
              <Text size="sm">
                <strong>Docente:</strong> {selectedLesson.teacher.firstName}{' '}
                {selectedLesson.teacher.lastName}
              </Text>
            </Group>

            {selectedLesson.room && (
              <Group gap="xs">
                <IconMapPin size={16} />
                <Text size="sm">Aula: {selectedLesson.room}</Text>
              </Group>
            )}

            {selectedLesson.attendance && (
              <Group gap="xs">
                <IconUsers size={16} />
                <Text size="sm">
                  Presenze: {selectedLesson.attendance.present}/{selectedLesson.attendance.total}
                </Text>
              </Group>
            )}

            {!readonly && (
              <Divider />
            )}

            {!readonly && (
              <Group justify="flex-end">
                <ActionIcon
                  variant="subtle"
                  color="blue"
                  onClick={() => {
                    setFormData({
                      title: selectedLesson.title,
                      description: selectedLesson.description || '',
                      classId: selectedLesson.class.id,
                      teacherId: selectedLesson.teacher.id,
                      startTime: new Date(selectedLesson.startTime),
                      endTime: new Date(selectedLesson.endTime),
                      room: selectedLesson.room || '',
                      isRecurring: selectedLesson.isRecurring,
                      recurrence: selectedLesson.recurrenceRule 
                        ? JSON.parse(selectedLesson.recurrenceRule)
                        : {
                            frequency: 'weekly',
                            interval: 1,
                            weekdays: [],
                          },
                    });
                    setEditMode(true);
                    setModalOpened(false);
                    setCreateModalOpened(true);
                  }}
                  title="Modifica"
                >
                  <IconEdit size={16} />
                </ActionIcon>
                
                <ActionIcon
                  variant="subtle"
                  color="red"
                  onClick={handleDelete}
                  title="Elimina"
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            )}
          </Stack>
        )}
      </Modal>

      {/* Create/Edit Lesson Modal */}
      <Modal
        opened={createModalOpened}
        onClose={() => setCreateModalOpened(false)}
        title={editMode ? 'Modifica Lezione' : 'Nuova Lezione'}
        size="lg"
      >
        <Stack gap="md">
          <TextInput
            label="Titolo"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            required
          />

          <Textarea
            label="Descrizione"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            rows={3}
          />

          <Group grow>
            <DateTimePicker
              label="Inizio"
              value={formData.startTime}
              onChange={(date) => date && setFormData(prev => ({ ...prev, startTime: date }))}
              required
            />

            <DateTimePicker
              label="Fine"
              value={formData.endTime}
              onChange={(date) => date && setFormData(prev => ({ ...prev, endTime: date }))}
              required
            />
          </Group>

          <TextInput
            label="Aula"
            value={formData.room}
            onChange={(e) => setFormData(prev => ({ ...prev, room: e.target.value }))}
          />

          {!editMode && (
            <>
              <Switch
                label="Lezione ricorrente"
                checked={formData.isRecurring}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  isRecurring: e.currentTarget.checked 
                }))}
              />

              {formData.isRecurring && (
                <Card withBorder p="md" style={{ backgroundColor: '#f8f9fa' }}>
                  <Stack gap="sm">
                    <Select
                      label="Frequenza"
                      value={formData.recurrence.frequency}
                      onChange={(value) => setFormData(prev => ({
                        ...prev,
                        recurrence: { 
                          ...prev.recurrence, 
                          frequency: value as 'weekly' | 'monthly' 
                        }
                      }))}
                      data={[
                        { value: 'weekly', label: 'Settimanale' },
                        { value: 'monthly', label: 'Mensile' },
                      ]}
                      required
                    />

                    <NumberInput
                      label={formData.recurrence.frequency === 'weekly' ? 'Ogni X settimane' : 'Ogni X mesi'}
                      value={formData.recurrence.interval}
                      onChange={(value) => setFormData(prev => ({
                        ...prev,
                        recurrence: { 
                          ...prev.recurrence, 
                          interval: Number(value) || 1 
                        }
                      }))}
                      min={1}
                      max={12}
                      required
                    />

                    <Group grow>
                      <DateTimePicker
                        label="Data di fine (opzionale)"
                        value={formData.recurrence.endDate}
                        onChange={(date) => setFormData(prev => ({
                          ...prev,
                          recurrence: { 
                            ...prev.recurrence, 
                            endDate: date || undefined 
                          }
                        }))}
                        clearable
                      />

                      <NumberInput
                        label="Numero occorrenze (opzionale)"
                        value={formData.recurrence.occurrences}
                        onChange={(value) => setFormData(prev => ({
                          ...prev,
                          recurrence: { 
                            ...prev.recurrence, 
                            occurrences: Number(value) || undefined 
                          }
                        }))}
                        min={1}
                        max={100}
                        placeholder="Illimitato"
                      />
                    </Group>

                    {formData.recurrence.frequency === 'weekly' && (
                      <MultiSelect
                        label="Giorni della settimana"
                        value={formData.recurrence.weekdays?.map(String) || []}
                        onChange={(values) => setFormData(prev => ({
                          ...prev,
                          recurrence: { 
                            ...prev.recurrence, 
                            weekdays: values.map(Number) 
                          }
                        }))}
                        data={[
                          { value: '1', label: 'Lunedì' },
                          { value: '2', label: 'Martedì' },
                          { value: '3', label: 'Mercoledì' },
                          { value: '4', label: 'Giovedì' },
                          { value: '5', label: 'Venerdì' },
                          { value: '6', label: 'Sabato' },
                          { value: '0', label: 'Domenica' },
                        ]}
                      />
                    )}
                  </Stack>
                </Card>
              )}
            </>
          )}

          <Group justify="flex-end">
            <Button 
              variant="outline" 
              onClick={() => setCreateModalOpened(false)}
            >
              Annulla
            </Button>
            <Button 
              onClick={handleSubmit}
              loading={createMutation.isPending || updateMutation.isPending || createRecurringMutation.isPending}
            >
              {editMode ? 'Aggiorna' : 'Crea'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Conflict Modal */}
      {showConflictModal && conflictInfo && (
        <ConflictModal
          conflicts={conflictInfo.conflicts}
          onConfirm={handleConflictConfirm}
          onCancel={handleConflictCancel}
        />
      )}
    </>
  );
}

export default AdvancedLessonCalendar;
