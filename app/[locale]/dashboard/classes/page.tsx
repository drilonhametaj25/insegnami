'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { 
  IconBook, 
  IconUsers, 
  IconClock, 
  IconEye, 
  IconEdit, 
  IconTrash, 
  IconPlus 
} from '@tabler/icons-react';
import { ProfessionalPageLayout } from '@/components/layouts/ProfessionalPageLayout';
import { ProfessionalButton, ProfessionalStatsCard } from '@/components/design-system/ProfessionalComponents';
import { ProfessionalTable } from '@/components/tables/ProfessionalTable';
import { ProfessionalModal, ProfessionalConfirmModal } from '@/components/modals/ProfessionalModal';
import { ProfessionalInput, ProfessionalSelect, ProfessionalTextarea } from '@/components/forms/ProfessionalFormFields';

interface Class {
  id: string;
  name: string;
  description: string;
  maxStudents: number;
  currentStudents: number;
  course: {
    id: string;
    name: string;
    level: string;
  };
  teacher: {
    id: string;
    name: string;
    email: string;
  };
  schedule: string;
  status: 'active' | 'inactive' | 'full';
  startDate: string;
  endDate: string;
}

interface CreateClassForm {
  name: string;
  description: string;
  maxStudents: string;
  courseId: string;
  teacherId: string;
  schedule: string;
  startDate: string;
  endDate: string;
}

const initialForm: CreateClassForm = {
  name: '',
  description: '',
  maxStudents: '',
  courseId: '',
  teacherId: '',
  schedule: '',
  startDate: '',
  endDate: '',
};

export default function ClassesPage() {
  const t = useTranslations();
  
  // State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [form, setForm] = useState<CreateClassForm>(initialForm);
  const [formErrors, setFormErrors] = useState<Partial<CreateClassForm>>({});
  const [currentPage, setCurrentPage] = useState(1);

  // Mock data since hooks may not be working
  const classes: Class[] = [
    {
      id: '1',
      name: 'Inglese A1 Mattina',
      description: 'Corso base per principianti',
      maxStudents: 15,
      currentStudents: 12,
      course: { id: '1', name: 'Inglese Base', level: 'A1' },
      teacher: { id: '1', name: 'Mario Rossi', email: 'mario.rossi@example.com' },
      schedule: 'Lun, Mer, Ven 09:00-11:00',
      status: 'active',
      startDate: '2024-01-15',
      endDate: '2024-06-15'
    },
    {
      id: '2',
      name: 'Inglese B1 Pomeriggio',
      description: 'Corso intermedio',
      maxStudents: 12,
      currentStudents: 12,
      course: { id: '2', name: 'Inglese Intermedio', level: 'B1' },
      teacher: { id: '2', name: 'Anna Bianchi', email: 'anna.bianchi@example.com' },
      schedule: 'Mar, Gio 14:00-16:00',
      status: 'full',
      startDate: '2024-02-01',
      endDate: '2024-07-01'
    }
  ];

  const totalClasses = classes.length;
  const activeClasses = classes.filter(c => c.status === 'active').length;
  const totalStudents = classes.reduce((sum, c) => sum + c.currentStudents, 0);
  const averageStudentsPerClass = totalClasses > 0 ? Math.round(totalStudents / totalClasses) : 0;

  const statsCards = [
    {
      title: 'Classi Totali',
      value: totalClasses.toString(),
      icon: <IconBook size={24} />,
      trend: { value: 12, isPositive: true },
    },
    {
      title: 'Classi Attive',
      value: activeClasses.toString(),
      icon: <IconUsers size={24} />,
      trend: { value: 8, isPositive: true },
    },
    {
      title: 'Studenti Totali',
      value: totalStudents.toString(),
      icon: <IconUsers size={24} />,
      trend: { value: 15, isPositive: true },
    },
    {
      title: 'Media Studenti/Classe',
      value: averageStudentsPerClass.toString(),
      icon: <IconClock size={24} />,
      trend: { value: 5, isPositive: false },
    },
  ];

  // Table columns
  const columns = [
    { key: 'name', label: 'Nome Classe', sortable: true },
    { key: 'course', label: 'Corso', sortable: false },
    { key: 'teacher', label: 'Insegnante', sortable: false },
    { key: 'students', label: 'Studenti', sortable: true, align: 'center' as const },
    { key: 'schedule', label: 'Orari', sortable: false },
    { key: 'status', label: 'Stato', sortable: true, align: 'center' as const },
    { key: 'actions', label: 'Azioni', sortable: false, align: 'center' as const },
  ];

  // Prepare table data
  const tableData = classes.map(classItem => ({
    id: classItem.id,
    name: classItem.name,
    course: (
      <div>
        <div style={{ fontWeight: 600 }}>{classItem.course.name}</div>
        <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{classItem.course.level}</div>
      </div>
    ),
    teacher: (
      <div>
        <div style={{ fontWeight: 600 }}>{classItem.teacher.name}</div>
        <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{classItem.teacher.email}</div>
      </div>
    ),
    students: `${classItem.currentStudents}/${classItem.maxStudents}`,
    schedule: classItem.schedule,
    status: (
      <span style={{
        padding: '4px 12px',
        borderRadius: '20px',
        fontSize: '0.75rem',
        fontWeight: 600,
        background: classItem.status === 'active' ? 'rgba(34, 197, 94, 0.1)' : 
                   classItem.status === 'full' ? 'rgba(245, 158, 11, 0.1)' : 
                   'rgba(239, 68, 68, 0.1)',
        color: classItem.status === 'active' ? '#22c55e' : 
               classItem.status === 'full' ? '#f59e0b' : 
               '#ef4444',
      }}>
        {classItem.status === 'active' ? 'Attiva' : 
         classItem.status === 'full' ? 'Al completo' : 
         'Inattiva'}
      </span>
    ),
    actions: (
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
        <button
          onClick={() => handleView(classItem)}
          style={{
            padding: '8px',
            background: 'rgba(59, 130, 246, 0.1)',
            border: 'none',
            borderRadius: '6px',
            color: '#3b82f6',
            cursor: 'pointer',
          }}
          title="Visualizza dettagli"
        >
          <IconEye size={16} />
        </button>
        <button
          onClick={() => handleEdit(classItem)}
          style={{
            padding: '8px',
            background: 'rgba(245, 158, 11, 0.1)',
            border: 'none',
            borderRadius: '6px',
            color: '#f59e0b',
            cursor: 'pointer',
          }}
          title="Modifica classe"
        >
          <IconEdit size={16} />
        </button>
        <button
          onClick={() => handleDelete(classItem)}
          style={{
            padding: '8px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: 'none',
            borderRadius: '6px',
            color: '#ef4444',
            cursor: 'pointer',
          }}
          title="Elimina classe"
        >
          <IconTrash size={16} />
        </button>
      </div>
    ),
  }));

  // Handlers
  const handleCreate = () => {
    setForm(initialForm);
    setFormErrors({});
    setIsCreateModalOpen(true);
  };

  const handleView = (classItem: Class) => {
    console.log('View class:', classItem.id);
  };

  const handleEdit = (classItem: Class) => {
    setSelectedClass(classItem);
    setForm({
      name: classItem.name,
      description: classItem.description,
      maxStudents: classItem.maxStudents.toString(),
      courseId: classItem.course.id,
      teacherId: classItem.teacher.id,
      schedule: classItem.schedule,
      startDate: classItem.startDate,
      endDate: classItem.endDate,
    });
    setFormErrors({});
    setIsEditModalOpen(true);
  };

  const handleDelete = (classItem: Class) => {
    setSelectedClass(classItem);
    setIsDeleteModalOpen(true);
  };

  const validateForm = (): boolean => {
    const errors: Partial<CreateClassForm> = {};
    
    if (!form.name.trim()) errors.name = 'Il nome è obbligatorio';
    if (!form.courseId) errors.courseId = 'Il corso è obbligatorio';
    if (!form.teacherId) errors.teacherId = "L'insegnante è obbligatorio";
    if (!form.maxStudents || parseInt(form.maxStudents) < 1) {
      errors.maxStudents = 'Il numero massimo di studenti deve essere maggiore di 0';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setIsCreateModalOpen(false);
    setIsEditModalOpen(false);
    console.log('Form submitted:', form);
  };

  const handleDeleteConfirm = async () => {
    setIsDeleteModalOpen(false);
    setSelectedClass(null);
    console.log('Class deleted:', selectedClass?.id);
  };

  const courseOptions = [
    { value: '1', label: 'Inglese Base (A1)' },
    { value: '2', label: 'Inglese Intermedio (B1)' },
    { value: '3', label: 'Inglese Avanzato (C1)' }
  ];

  const teacherOptions = [
    { value: '1', label: 'Mario Rossi' },
    { value: '2', label: 'Anna Bianchi' },
    { value: '3', label: 'Luca Verde' }
  ];

  return (
    <ProfessionalPageLayout
      title="Gestione Classi"
      subtitle="Organizza e monitora tutte le classi della scuola"
      stats={statsCards}
      actions={[
        <ProfessionalButton
          key="create"
          variant="primary"
          icon={<IconPlus size={20} />}
          onClick={handleCreate}
        >
          Nuova Classe
        </ProfessionalButton>
      ]}
      loading={false}
    >
      <ProfessionalTable
        columns={columns}
        data={tableData}
        loading={false}
        emptyMessage="Nessuna classe trovata"
        pagination={{
          current: currentPage,
          total: Math.ceil(totalClasses / 10),
          onChange: setCurrentPage,
        }}
      />

      {/* Create/Edit Modal */}
      <ProfessionalModal
        isOpen={isCreateModalOpen || isEditModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setIsEditModalOpen(false);
          setForm(initialForm);
          setFormErrors({});
        }}
        title={isEditModalOpen ? 'Modifica Classe' : 'Nuova Classe'}
        size="lg"
        onConfirm={handleSubmit}
        onCancel={() => {
          setIsCreateModalOpen(false);
          setIsEditModalOpen(false);
        }}
        confirmText={isEditModalOpen ? 'Salva Modifiche' : 'Crea Classe'}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <ProfessionalInput
            label="Nome Classe"
            value={form.name}
            onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
            error={formErrors.name}
            required
            placeholder="es. Inglese A1 - Mattina"
          />

          <ProfessionalSelect
            label="Corso"
            value={form.courseId}
            onChange={(value) => setForm(prev => ({ ...prev, courseId: value }))}
            options={courseOptions}
            error={formErrors.courseId}
            required
            placeholder="Seleziona corso"
          />

          <ProfessionalSelect
            label="Insegnante"
            value={form.teacherId}
            onChange={(value) => setForm(prev => ({ ...prev, teacherId: value }))}
            options={teacherOptions}
            error={formErrors.teacherId}
            required
            placeholder="Seleziona insegnante"
          />

          <ProfessionalInput
            label="Numero Massimo Studenti"
            type="number"
            value={form.maxStudents}
            onChange={(e) => setForm(prev => ({ ...prev, maxStudents: e.target.value }))}
            error={formErrors.maxStudents}
            required
            min="1"
            max="50"
          />

          <ProfessionalInput
            label="Data Inizio"
            type="date"
            value={form.startDate}
            onChange={(e) => setForm(prev => ({ ...prev, startDate: e.target.value }))}
            error={formErrors.startDate}
          />

          <ProfessionalInput
            label="Data Fine"
            type="date"
            value={form.endDate}
            onChange={(e) => setForm(prev => ({ ...prev, endDate: e.target.value }))}
            error={formErrors.endDate}
          />
        </div>

        <div style={{ marginTop: '1rem' }}>
          <ProfessionalInput
            label="Orari"
            value={form.schedule}
            onChange={(e) => setForm(prev => ({ ...prev, schedule: e.target.value }))}
            placeholder="es. Lunedì, Mercoledì, Venerdì 09:00-11:00"
          />

          <ProfessionalTextarea
            label="Descrizione"
            value={form.description}
            onChange={(value) => setForm(prev => ({ ...prev, description: value }))}
            placeholder="Descrizione della classe, obiettivi e note varie..."
            rows={3}
          />
        </div>
      </ProfessionalModal>

      {/* Delete Confirmation Modal */}
      <ProfessionalConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedClass(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Elimina Classe"
        message={`Sei sicuro di voler eliminare la classe "${selectedClass?.name}"? Questa azione non può essere annullata.`}
        variant="danger"
        confirmText="Elimina"
        cancelText="Annulla"
      />
    </ProfessionalPageLayout>
  );
}

