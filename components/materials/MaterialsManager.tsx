'use client';

import React, { useState, useCallback } from 'react';
import {
  Paper,
  Title,
  Group,
  Button,
  Badge,
  Text,
  Table,
  Avatar,
  ActionIcon,
  Alert,
  LoadingOverlay,
  Stack,
  Card,
  Grid,
  Tooltip,
  Menu,
  FileButton,
  Progress,
  Modal,
  TextInput,
  Textarea,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconUpload,
  IconX,
  IconFile,
  IconDownload,
  IconEdit,
  IconTrash,
  IconEye,
  IconFileText,
  IconFileZip,
  IconPhoto,
  IconVideo,
  IconMusic,
  IconDotsVertical,
  IconFolderPlus,
  IconSearch,
  IconCalendar,
  IconUser,
  IconFileDescription,
} from '@tabler/icons-react';

interface Material {
  id: string;
  name: string;
  description?: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileUrl: string;
  uploadedAt: string;
  uploadedBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
  downloads: number;
  tags?: string[];
}

interface MaterialsManagerProps {
  classId: string;
  materials: Material[];
  canEdit?: boolean;
  onMaterialsUpdate?: () => void;
}

const getFileIcon = (fileType: string, size = 20) => {
  if (fileType.includes('image')) return <IconPhoto size={size} />;
  if (fileType.includes('video')) return <IconVideo size={size} />;
  if (fileType.includes('audio')) return <IconMusic size={size} />;
  if (fileType.includes('pdf')) return <IconFileText size={size} />;
  if (fileType.includes('zip') || fileType.includes('rar')) return <IconFileZip size={size} />;
  if (fileType.includes('text') || fileType.includes('document')) return <IconFileText size={size} />;
  return <IconFile size={size} />;
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export function MaterialsManager({ 
  classId, 
  materials = [], 
  canEdit = false,
  onMaterialsUpdate 
}: MaterialsManagerProps) {
  const [localMaterials, setLocalMaterials] = useState<Material[]>(materials);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploading, setUploading] = useState(false);
  const [editModalOpened, { open: openEditModal, close: closeEditModal }] = useDisclosure(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', tags: '' });

  // Handle file upload via FileButton
  const handleFileUpload = useCallback(async (files: File[]) => {
    if (!canEdit || files.length === 0) return;

    setUploading(true);
    
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('classId', classId);
        formData.append('name', file.name);

        const fileKey = `${file.name}-${Date.now()}`;
        setUploadProgress(prev => ({ ...prev, [fileKey]: 0 }));

        const response = await fetch(`/api/classes/${classId}/materials`, {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const newMaterial = await response.json();
          setLocalMaterials(prev => [newMaterial, ...prev]);
          setUploadProgress(prev => ({ ...prev, [fileKey]: 100 }));
          
          notifications.show({
            title: 'Successo',
            message: `File "${file.name}" caricato con successo`,
            color: 'green',
          });
          
          // Clear progress after delay
          setTimeout(() => {
            setUploadProgress(prev => {
              const { [fileKey]: _, ...rest } = prev;
              return rest;
            });
          }, 2000);
        } else {
          throw new Error(`Errore nel caricamento di ${file.name}`);
        }
      }

      if (onMaterialsUpdate) {
        onMaterialsUpdate();
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      notifications.show({
        title: 'Errore',
        message: error.message || 'Errore durante il caricamento',
        color: 'red',
      });
    } finally {
      setUploading(false);
    }
  }, [classId, canEdit, onMaterialsUpdate]);

  // Delete material
  const deleteMaterial = async (materialId: string) => {
    if (!canEdit) return;

    try {
      const response = await fetch(`/api/classes/${classId}/materials/${materialId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setLocalMaterials(prev => prev.filter(m => m.id !== materialId));
        notifications.show({
          title: 'Successo',
          message: 'Materiale eliminato con successo',
          color: 'green',
        });
        
        if (onMaterialsUpdate) {
          onMaterialsUpdate();
        }
      } else {
        throw new Error('Errore nella eliminazione');
      }
    } catch (error: any) {
      console.error('Delete error:', error);
      notifications.show({
        title: 'Errore',
        message: error.message || 'Errore durante l\'eliminazione',
        color: 'red',
      });
    }
  };

  // Edit material
  const openEditMaterial = (material: Material) => {
    setSelectedMaterial(material);
    setEditForm({
      name: material.name,
      description: material.description || '',
      tags: material.tags?.join(', ') || ''
    });
    openEditModal();
  };

  const saveMaterialEdit = async () => {
    if (!selectedMaterial || !canEdit) return;

    try {
      const response = await fetch(`/api/classes/${classId}/materials/${selectedMaterial.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editForm.name,
          description: editForm.description,
          tags: editForm.tags.split(',').map(tag => tag.trim()).filter(Boolean),
        }),
      });

      if (response.ok) {
        const updatedMaterial = await response.json();
        setLocalMaterials(prev => 
          prev.map(m => m.id === selectedMaterial.id ? updatedMaterial : m)
        );
        
        notifications.show({
          title: 'Successo',
          message: 'Materiale aggiornato con successo',
          color: 'green',
        });
        
        closeEditModal();
        if (onMaterialsUpdate) {
          onMaterialsUpdate();
        }
      } else {
        throw new Error('Errore nell\'aggiornamento');
      }
    } catch (error: any) {
      console.error('Update error:', error);
      notifications.show({
        title: 'Errore',
        message: error.message || 'Errore durante l\'aggiornamento',
        color: 'red',
      });
    }
  };

  // Download file
  const downloadFile = async (material: Material) => {
    try {
      // Track download
      await fetch(`/api/classes/${classId}/materials/${material.id}/download`, {
        method: 'POST',
      });
      
      // Trigger download
      const link = document.createElement('a');
      link.href = material.fileUrl;
      link.download = material.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Update download count locally
      setLocalMaterials(prev => 
        prev.map(m => m.id === material.id ? { ...m, downloads: m.downloads + 1 } : m)
      );
    } catch (error) {
      console.error('Download error:', error);
      notifications.show({
        title: 'Errore',
        message: 'Errore durante il download',
        color: 'red',
      });
    }
  };

  if (localMaterials.length === 0 && !canEdit) {
    return (
      <Paper p="xl" withBorder style={{ textAlign: 'center' }}>
        <IconFileDescription size={48} color="var(--mantine-color-gray-4)" />
        <Text size="lg" fw={500} mt="md" c="dimmed">
          Nessun materiale disponibile
        </Text>
        <Text size="sm" c="dimmed">
          Non ci sono materiali didattici per questa classe
        </Text>
      </Paper>
    );
  }

  return (
    <Stack gap="md">
      {/* Header with Upload */}
      {canEdit && (
        <Paper p="md" withBorder>
          <Group justify="space-between" mb="md">
            <div>
              <Title order={4}>Gestione Materiali</Title>
              <Text size="sm" c="dimmed">
                Carica e organizza i materiali didattici per questa classe
              </Text>
            </div>
            <Group>
              <FileButton
                onChange={handleFileUpload}
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.ppt,.pptx,.txt,.zip,.rar"
                multiple
              >
                {(props) => (
                  <Button
                    {...props}
                    loading={uploading}
                    leftSection={<IconUpload size={16} />}
                  >
                    Carica File
                  </Button>
                )}
              </FileButton>
            </Group>
          </Group>

          {/* Simple Upload Area */}
          <Paper p="xl" withBorder style={{ textAlign: 'center' }}>
            <Group justify="center" gap="xl" mih={120}>
              <div>
                <IconUpload size={48} color="var(--mantine-color-dimmed)" />
                <Text size="lg" inline mt="md">
                  Area di caricamento file
                </Text>
                <Text size="sm" c="dimmed" inline mt={7}>
                  Clicca sul pulsante "Carica File" per selezionare i file da caricare
                </Text>
              </div>
            </Group>
          </Paper>

          {/* Upload Progress */}
          {Object.keys(uploadProgress).length > 0 && (
            <Stack gap="xs" mt="md">
              {Object.entries(uploadProgress).map(([key, progress]) => (
                <div key={key}>
                  <Text size="sm">{key.split('-')[0]}</Text>
                  <Progress value={progress} size="sm" />
                </div>
              ))}
            </Stack>
          )}
        </Paper>
      )}

      {/* Materials List */}
      {localMaterials.length > 0 ? (
        <Paper p="md" withBorder>
          <LoadingOverlay visible={uploading} />
          
          <Group justify="space-between" mb="md">
            <Text fw={500}>Materiali Caricati ({localMaterials.length})</Text>
          </Group>

          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>File</Table.Th>
                <Table.Th>Dimensione</Table.Th>
                <Table.Th>Caricato da</Table.Th>
                <Table.Th>Data</Table.Th>
                <Table.Th>Download</Table.Th>
                <Table.Th>Azioni</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {localMaterials.map(material => (
                <Table.Tr key={material.id}>
                  <Table.Td>
                    <Group gap="sm">
                      {getFileIcon(material.fileType)}
                      <div>
                        <Text fw={500} size="sm">
                          {material.name}
                        </Text>
                        {material.description && (
                          <Text size="xs" c="dimmed">
                            {material.description}
                          </Text>
                        )}
                        {material.tags && material.tags.length > 0 && (
                          <Group gap={4} mt={4}>
                            {material.tags.slice(0, 3).map(tag => (
                              <Badge key={tag} size="xs" variant="light">
                                {tag}
                              </Badge>
                            ))}
                            {material.tags.length > 3 && (
                              <Text size="xs" c="dimmed">+{material.tags.length - 3}</Text>
                            )}
                          </Group>
                        )}
                      </div>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{formatFileSize(material.fileSize)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Avatar size="sm" color="blue">
                        {material.uploadedBy.firstName[0]}{material.uploadedBy.lastName[0]}
                      </Avatar>
                      <Text size="sm">
                        {material.uploadedBy.firstName} {material.uploadedBy.lastName}
                      </Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {new Date(material.uploadedAt).toLocaleDateString('it-IT')}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color="blue">
                      {material.downloads}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={2}>
                      <Tooltip label="Visualizza">
                        <ActionIcon
                          variant="subtle"
                          size="sm"
                          onClick={() => window.open(material.fileUrl, '_blank')}
                        >
                          <IconEye size={14} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Download">
                        <ActionIcon
                          variant="subtle"
                          size="sm"
                          onClick={() => downloadFile(material)}
                        >
                          <IconDownload size={14} />
                        </ActionIcon>
                      </Tooltip>
                      {canEdit && (
                        <Menu withinPortal>
                          <Menu.Target>
                            <ActionIcon variant="subtle" size="sm">
                              <IconDotsVertical size={14} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item
                              leftSection={<IconEdit size={14} />}
                              onClick={() => openEditMaterial(material)}
                            >
                              Modifica
                            </Menu.Item>
                            <Menu.Divider />
                            <Menu.Item
                              leftSection={<IconTrash size={14} />}
                              color="red"
                              onClick={() => deleteMaterial(material.id)}
                            >
                              Elimina
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      ) : canEdit ? (
        <Alert icon={<IconFileDescription />} color="blue">
          Nessun materiale caricato. Usa l'area di caricamento sopra per aggiungere i primi materiali.
        </Alert>
      ) : null}

      {/* Edit Modal */}
      <Modal
        opened={editModalOpened}
        onClose={closeEditModal}
        title="Modifica Materiale"
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label="Nome"
            value={editForm.name}
            onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
            required
          />
          <Textarea
            label="Descrizione"
            value={editForm.description}
            onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
            minRows={3}
          />
          <TextInput
            label="Tag (separati da virgola)"
            value={editForm.tags}
            onChange={(e) => setEditForm(prev => ({ ...prev, tags: e.target.value }))}
            placeholder="matematica, esercizi, teoria"
          />
          <Group justify="flex-end" gap="sm">
            <Button variant="outline" onClick={closeEditModal}>
              Annulla
            </Button>
            <Button onClick={saveMaterialEdit}>
              Salva
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
