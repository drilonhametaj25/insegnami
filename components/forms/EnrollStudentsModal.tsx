'use client';

import { useState, useEffect } from 'react';
import {
  Modal,
  Title,
  Text,
  Button,
  Group,
  Stack,
  TextInput,
  Checkbox,
  Avatar,
  Badge,
  Paper,
  LoadingOverlay,
  Alert,
  Divider,
  Progress,
  ScrollArea,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconUsers,
  IconSearch,
  IconUserCheck,
  IconX,
  IconInfoCircle,
  IconMail,
  IconPhone,
} from '@tabler/icons-react';

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  studentCode?: string;
  dateOfBirth?: string;
}

interface EnrollStudentsModalProps {
  opened: boolean;
  onClose: () => void;
  classId: string;
  className: string;
  currentCapacity: number;
  maxCapacity: number;
  currentStudentIds: string[];
  onEnrollComplete: () => void;
}

export function EnrollStudentsModal({
  opened,
  onClose,
  classId,
  className,
  currentCapacity,
  maxCapacity,
  currentStudentIds,
  onEnrollComplete,
}: EnrollStudentsModalProps) {
  const [availableStudents, setAvailableStudents] = useState<Student[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch] = useDebouncedValue(searchQuery, 300);
  const [loading, setLoading] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableCapacity = maxCapacity - currentCapacity;
  const canEnrollCount = Math.min(availableCapacity, selectedStudentIds.size);

  // Fetch available students
  const fetchAvailableStudents = async () => {
    if (!opened) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      params.set('excludeClassId', classId);
      params.set('limit', '50');

      const response = await fetch(`/api/students?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Errore nel caricamento degli studenti');
      }
      
      const data = await response.json();
      
      // Filter out already enrolled students
      const filtered = data.students?.filter(
        (student: Student) => !currentStudentIds.includes(student.id)
      ) || [];
      
      setAvailableStudents(filtered);
    } catch (error: any) {
      console.error('Error fetching students:', error);
      setError(error.message || 'Errore nel caricamento degli studenti');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAvailableStudents();
  }, [opened, debouncedSearch, classId, currentStudentIds]);

  // Handle student selection
  const handleStudentToggle = (studentId: string) => {
    const newSelection = new Set(selectedStudentIds);
    
    if (newSelection.has(studentId)) {
      newSelection.delete(studentId);
    } else {
      // Controlla se c'è spazio disponibile
      const totalAfterEnrollment = currentCapacity + newSelection.size + 1;
      
      if (totalAfterEnrollment > maxCapacity) {
        notifications.show({
          title: 'Capacità massima raggiunta',
          message: `La classe può contenere al massimo ${maxCapacity} studenti. Attualmente ci sono ${currentCapacity} studenti iscritti.`,
          color: 'orange',
          icon: <IconInfoCircle size={18} />,
        });
        return;
      }
      
      newSelection.add(studentId);
    }
    
    setSelectedStudentIds(newSelection);
  };

  // Handle enroll students
  const handleEnrollStudents = async () => {
    if (selectedStudentIds.size === 0) return;
    
    setEnrolling(true);
    
    try {
      const response = await fetch(`/api/classes/${classId}/enroll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentIds: Array.from(selectedStudentIds),
          sendNotification: true,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Errore durante l\'iscrizione');
      }
      
      notifications.show({
        title: 'Iscrizione completata',
        message: `${selectedStudentIds.size} student${selectedStudentIds.size > 1 ? 'i iscritti' : 'e iscritto'} con successo`,
        color: 'green',
        icon: <IconUserCheck size={18} />,
      });
      
      onEnrollComplete();
      onClose();
    } catch (error: any) {
      console.error('Error enrolling students:', error);
      notifications.show({
        title: 'Errore',
        message: error.message || 'Errore durante l\'iscrizione degli studenti',
        color: 'red',
        icon: <IconX size={18} />,
      });
    } finally {
      setEnrolling(false);
    }
  };

  // Reset state on close
  const handleClose = () => {
    setSelectedStudentIds(new Set());
    setSearchQuery('');
    setError(null);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Group gap="sm">
          <IconUsers size={24} />
          <div>
            <Title order={4}>Iscrivi Studenti</Title>
            <Text size="sm" c="dimmed">
              {className}
            </Text>
          </div>
        </Group>
      }
      size="lg"
      centered
    >
      <Stack gap="md">
        {/* Capacity Info */}
        <Paper p="md" withBorder style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
          <Group justify="space-between" mb="sm">
            <Text fw={500}>Capacità Classe</Text>
            <Text fw={700}>{currentCapacity}/{maxCapacity}</Text>
          </Group>
          <Progress 
            value={(currentCapacity / maxCapacity) * 100} 
            color="rgba(255,255,255,0.7)"
            size="sm"
          />
          <Text size="sm" mt="xs" style={{ opacity: 0.9 }}>
            {availableCapacity} post{availableCapacity !== 1 ? 'i disponibili' : 'o disponibile'}
          </Text>
        </Paper>

        {/* Search */}
        <TextInput
          placeholder="Cerca studenti per nome o email..."
          leftSection={<IconSearch size={16} />}
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.currentTarget.value)}
        />

        {/* Selected Count */}
        {selectedStudentIds.size > 0 && (
          <Alert color="blue" icon={<IconUserCheck />}>
            {selectedStudentIds.size} student{selectedStudentIds.size > 1 ? 'i selezionati' : 'e selezionato'}
          </Alert>
        )}

        {/* Error Alert */}
        {error && (
          <Alert color="red" icon={<IconX />}>
            {error}
          </Alert>
        )}

        {/* Students List */}
        <ScrollArea h={400} offsetScrollbars>
          <LoadingOverlay visible={loading} />
          
          {availableStudents.length === 0 && !loading ? (
            <Paper p="xl" style={{ textAlign: 'center' }}>
              <IconUsers size={48} color="var(--mantine-color-gray-4)" />
              <Text size="lg" fw={500} mt="md" c="dimmed">
                {debouncedSearch ? 'Nessuno studente trovato' : 'Tutti gli studenti sono già iscritti'}
              </Text>
              <Text size="sm" c="dimmed">
                {debouncedSearch ? 'Prova con un altro termine di ricerca' : 'Non ci sono studenti disponibili per l\'iscrizione'}
              </Text>
            </Paper>
          ) : (
            <Stack gap="sm">
              {availableStudents.map((student) => {
                const totalAfterEnrollment = currentCapacity + selectedStudentIds.size;
                const isDisabled = totalAfterEnrollment >= maxCapacity && !selectedStudentIds.has(student.id);
                
                return (
                  <Paper
                    key={student.id}
                    p="sm"
                    withBorder
                    style={{
                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                      opacity: isDisabled ? 0.5 : 1,
                    }}
                    onClick={() => !isDisabled && handleStudentToggle(student.id)}
                  >
                    <Group justify="space-between">
                      <Group gap="sm">
                        <Checkbox
                          checked={selectedStudentIds.has(student.id)}
                          onChange={() => handleStudentToggle(student.id)}
                          disabled={isDisabled}
                        />
                        <Avatar size="sm" color="blue">
                          {student.firstName[0]}{student.lastName[0]}
                        </Avatar>
                        <div>
                          <Text fw={500} size="sm">
                            {student.firstName} {student.lastName}
                          </Text>
                          <Group gap="xs">
                            {student.studentCode && (
                              <Badge size="xs" variant="light" color="gray">
                                #{student.studentCode}
                              </Badge>
                            )}
                            <Group gap={4}>
                              <IconMail size={12} />
                              <Text size="xs" c="dimmed">{student.email}</Text>
                            </Group>
                            {student.phone && (
                              <Group gap={4}>
                                <IconPhone size={12} />
                                <Text size="xs" c="dimmed">{student.phone}</Text>
                              </Group>
                            )}
                          </Group>
                        </div>
                      </Group>
                    </Group>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </ScrollArea>

        <Divider />

        {/* Actions */}
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            {selectedStudentIds.size > 0 && (
              <>Verranno iscritti {selectedStudentIds.size} student{selectedStudentIds.size > 1 ? 'i' : 'e'}</>
            )}
          </Text>
          <Group>
            <Button variant="outline" onClick={handleClose}>
              Annulla
            </Button>
            <Button
              onClick={handleEnrollStudents}
              disabled={selectedStudentIds.size === 0}
              loading={enrolling}
            >
              Iscrivi {selectedStudentIds.size > 0 && `(${selectedStudentIds.size})`}
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
