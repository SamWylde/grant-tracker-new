import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Stack,
  Card,
  Group,
  Text,
  Badge,
  ActionIcon,
  Menu,
  Loader,
  Alert,
  Tooltip,
  Modal,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconDownload,
  IconTrash,
  IconDots,
  IconFile,
  IconFileText,
  IconFileSpreadsheet,
  IconPhoto,
  IconArchive,
  IconAlertCircle,
  IconHistory,
} from '@tabler/icons-react';
import { supabase } from '../lib/supabase';

interface Document {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  document_category: string | null;
  created_at: string;
  version: number;
  is_latest_version: boolean;
  uploaded_by_user: {
    email: string;
  };
}

interface DocumentListProps {
  orgId: string;
  grantId?: string;
  taskId?: string;
  documentCategory?: string;
  onDocumentDelete?: () => void;
}

export function DocumentList({
  orgId,
  grantId,
  taskId,
  documentCategory,
  onDocumentDelete,
}: DocumentListProps) {
  const queryClient = useQueryClient();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);

  // Fetch documents
  const { data, isLoading, error } = useQuery({
    queryKey: ['documents', orgId, grantId, taskId, documentCategory],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const params = new URLSearchParams({
        org_id: orgId,
        latest_only: 'true',
      });

      if (grantId) params.append('grant_id', grantId);
      if (taskId) params.append('task_id', taskId);
      if (documentCategory) params.append('document_category', documentCategory);

      const response = await fetch(`/api/documents/list?${params}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }

      return response.json();
    },
    enabled: !!orgId,
  });

  // Download mutation
  const downloadMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/documents/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ document_id: documentId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Open download URL in new tab
      window.open(data.download_url, '_blank');
      notifications.show({
        title: 'Download started',
        message: `Downloading ${data.file_name}`,
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Download failed',
        message: error.message,
        color: 'red',
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/documents/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ document_id: documentId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      notifications.show({
        title: 'Document deleted',
        message: 'The document has been removed',
        color: 'green',
      });
      setDeleteModalOpen(false);
      setDocumentToDelete(null);
      if (onDocumentDelete) onDocumentDelete();
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Delete failed',
        message: error.message,
        color: 'red',
      });
    },
  });

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return <IconFileText size={24} color="var(--mantine-color-red-6)" />;
    if (fileType.includes('word') || fileType.includes('document')) return <IconFileText size={24} color="var(--mantine-color-blue-6)" />;
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return <IconFileSpreadsheet size={24} color="var(--mantine-color-green-6)" />;
    if (fileType.includes('image')) return <IconPhoto size={24} color="var(--mantine-color-pink-6)" />;
    if (fileType.includes('zip') || fileType.includes('rar')) return <IconArchive size={24} color="var(--mantine-color-orange-6)" />;
    return <IconFile size={24} />;
  };

  const getCategoryBadge = (category: string | null) => {
    if (!category) return null;

    const colors: Record<string, string> = {
      budget: 'green',
      narrative: 'blue',
      letters: 'violet',
      financial: 'yellow',
      supporting: 'cyan',
      other: 'gray',
    };

    return (
      <Badge size="sm" color={colors[category] || 'gray'}>
        {category}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Group justify="center" p="xl">
        <Loader size="sm" />
        <Text c="dimmed">Loading documents...</Text>
      </Group>
    );
  }

  if (error) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} color="red" title="Error loading documents">
        {error instanceof Error ? error.message : 'Failed to load documents'}
      </Alert>
    );
  }

  const documents: Document[] = data?.documents || [];

  if (documents.length === 0) {
    return (
      <Alert icon={<IconFile size={16} />} color="blue" title="No documents yet">
        Upload your first document to get started
      </Alert>
    );
  }

  return (
    <>
      <Stack gap="sm">
        {documents.map((doc) => (
          <Card key={doc.id} padding="md" withBorder>
            <Group justify="space-between" wrap="nowrap">
              <Group gap="md" style={{ flex: 1, minWidth: 0 }}>
                {getFileIcon(doc.file_type)}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Group gap="xs" wrap="nowrap">
                    <Text fw={500} size="sm" truncate>
                      {doc.file_name}
                    </Text>
                    {!doc.is_latest_version && (
                      <Tooltip label="Older version">
                        <Badge size="xs" color="gray">
                          v{doc.version}
                        </Badge>
                      </Tooltip>
                    )}
                    {getCategoryBadge(doc.document_category)}
                  </Group>
                  <Group gap="xs" mt={4}>
                    <Text size="xs" c="dimmed">
                      {formatFileSize(doc.file_size)}
                    </Text>
                    <Text size="xs" c="dimmed">
                      •
                    </Text>
                    <Text size="xs" c="dimmed">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </Text>
                    <Text size="xs" c="dimmed">
                      •
                    </Text>
                    <Text size="xs" c="dimmed">
                      {doc.uploaded_by_user?.email}
                    </Text>
                  </Group>
                </div>
              </Group>

              <Group gap="xs">
                <Tooltip label="Download">
                  <ActionIcon
                    variant="subtle"
                    color="blue"
                    onClick={() => downloadMutation.mutate(doc.id)}
                    loading={downloadMutation.isPending}
                  >
                    <IconDownload size={18} />
                  </ActionIcon>
                </Tooltip>

                <Menu shadow="md" width={200}>
                  <Menu.Target>
                    <ActionIcon variant="subtle">
                      <IconDots size={18} />
                    </ActionIcon>
                  </Menu.Target>

                  <Menu.Dropdown>
                    <Menu.Item
                      leftSection={<IconDownload size={16} />}
                      onClick={() => downloadMutation.mutate(doc.id)}
                    >
                      Download
                    </Menu.Item>
                    <Menu.Item
                      leftSection={<IconHistory size={16} />}
                      disabled
                    >
                      Version History
                    </Menu.Item>
                    <Menu.Divider />
                    <Menu.Item
                      leftSection={<IconTrash size={16} />}
                      color="red"
                      onClick={() => {
                        setDocumentToDelete(doc);
                        setDeleteModalOpen(true);
                      }}
                    >
                      Delete
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Group>
            </Group>
          </Card>
        ))}
      </Stack>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Document"
      >
        <Stack gap="md">
          <Text>
            Are you sure you want to delete <strong>{documentToDelete?.file_name}</strong>?
          </Text>
          <Text size="sm" c="dimmed">
            This action can be undone by an administrator.
          </Text>
          <Group justify="flex-end">
            <ActionIcon
              variant="default"
              onClick={() => setDeleteModalOpen(false)}
            >
              Cancel
            </ActionIcon>
            <ActionIcon
              color="red"
              onClick={() => documentToDelete && deleteMutation.mutate(documentToDelete.id)}
              loading={deleteMutation.isPending}
            >
              Delete
            </ActionIcon>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
