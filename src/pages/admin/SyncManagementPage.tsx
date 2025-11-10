import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Container,
  Title,
  Stack,
  Paper,
  Group,
  Text,
  Button,
  Badge,
  Table,
  Select,
  Loader,
  Alert,
  ActionIcon,
  TextInput,
} from '@mantine/core';
import {
  IconRefresh,
  IconClock,
  IconCheck,
  IconX,
  IconAlertCircle,
  IconDatabase,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { AppHeader } from '../../components/AppHeader';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { supabase } from '../../lib/supabase';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

interface GrantSource {
  id: string;
  source_key: string;
  source_name: string;
  source_type: string;
  sync_enabled: boolean;
  sync_frequency: string;
  last_sync_at?: string;
}

interface SyncJob {
  id: string;
  source_id: string;
  job_type: string;
  status: string;
  grants_fetched: number;
  grants_created: number;
  grants_updated: number;
  grants_skipped: number;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
}

export function SyncManagementPage() {
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [externalId, setExternalId] = useState('');
  const queryClient = useQueryClient();

  // Fetch grant sources
  const { data: sources, isLoading: sourcesLoading } = useQuery<GrantSource[]>({
    queryKey: ['grant_sources'],
    queryFn: async () => {
      const { data, error } = await supabase.from('grant_sources').select('*').order('source_name');

      if (error) throw error;
      return data;
    },
  });

  // Fetch sync history for selected source
  const { data: syncHistory, isLoading: historyLoading } = useQuery<SyncJob[]>({
    queryKey: ['sync_history', selectedSource],
    queryFn: async () => {
      if (!selectedSource) return [];

      const source = sources?.find((s) => s.source_key === selectedSource);
      if (!source) return [];

      const { data, error } = await supabase
        .from('sync_jobs')
        .select('*')
        .eq('source_id', source.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
    enabled: !!selectedSource && !!sources,
  });

  // Trigger sync mutation
  const triggerSyncMutation = useMutation({
    mutationFn: async ({ source_key, job_type, external_id }: any) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/admin/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ source_key, job_type, external_id }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || 'Sync failed');
      }

      return response.json();
    },
    onSuccess: () => {
      notifications.show({
        title: 'Sync Started',
        message: 'Grant synchronization job has been initiated',
        color: 'green',
      });
      queryClient.invalidateQueries({ queryKey: ['sync_history'] });
      queryClient.invalidateQueries({ queryKey: ['grant_sources'] });
    },
    onError: (error) => {
      notifications.show({
        title: 'Sync Failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
    },
  });

  const handleFullSync = () => {
    if (!selectedSource) {
      notifications.show({
        title: 'Error',
        message: 'Please select a source',
        color: 'red',
      });
      return;
    }

    triggerSyncMutation.mutate({
      source_key: selectedSource,
      job_type: 'full',
    });
  };

  const handleIncrementalSync = () => {
    if (!selectedSource) return;

    triggerSyncMutation.mutate({
      source_key: selectedSource,
      job_type: 'incremental',
    });
  };

  const handleSingleGrantSync = () => {
    if (!selectedSource || !externalId.trim()) {
      notifications.show({
        title: 'Error',
        message: 'Please select a source and enter a grant ID',
        color: 'red',
      });
      return;
    }

    triggerSyncMutation.mutate({
      source_key: selectedSource,
      job_type: 'single',
      external_id: externalId.trim(),
    });

    setExternalId('');
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      completed: 'green',
      failed: 'red',
      running: 'blue',
      pending: 'gray',
    };

    const icons: Record<string, React.ReactNode> = {
      completed: <IconCheck size={14} />,
      failed: <IconX size={14} />,
      running: <IconClock size={14} />,
    };

    return (
      <Badge color={colors[status] || 'gray'} leftSection={icons[status]}>
        {status}
      </Badge>
    );
  };

  return (
    <ProtectedRoute>
      <AppHeader subtitle="Admin Tools" />
      <Container size="xl" p="md">
        <Stack gap="lg">
          <div>
            <Title order={1}>Grant Source Synchronization</Title>
            <Text c="dimmed">Manage grant data ingestion from external sources</Text>
          </div>

          {/* Source Selection */}
          <Paper p="lg" withBorder>
            <Stack gap="md">
              <Title order={3}>Select Grant Source</Title>

              {sourcesLoading ? (
                <Loader />
              ) : (
                <>
                  <Select
                    label="Grant Source"
                    placeholder="Choose a source"
                    value={selectedSource}
                    onChange={(value) => setSelectedSource(value || '')}
                    data={
                      sources?.map((s) => ({
                        value: s.source_key,
                        label: `${s.source_name} (${s.source_type})`,
                      })) || []
                    }
                  />

                  {selectedSource && sources && (
                    <Paper p="md" bg="gray.0" withBorder>
                      <Stack gap="xs">
                        {sources
                          .filter((s) => s.source_key === selectedSource)
                          .map((source) => (
                            <div key={source.id}>
                              <Group justify="space-between">
                                <Text size="sm" fw={500}>
                                  Sync Enabled
                                </Text>
                                <Badge color={source.sync_enabled ? 'green' : 'gray'}>
                                  {source.sync_enabled ? 'Yes' : 'No'}
                                </Badge>
                              </Group>
                              <Group justify="space-between">
                                <Text size="sm" fw={500}>
                                  Sync Frequency
                                </Text>
                                <Text size="sm">{source.sync_frequency}</Text>
                              </Group>
                              <Group justify="space-between">
                                <Text size="sm" fw={500}>
                                  Last Sync
                                </Text>
                                <Text size="sm">
                                  {source.last_sync_at ? dayjs(source.last_sync_at).fromNow() : 'Never'}
                                </Text>
                              </Group>
                            </div>
                          ))}
                      </Stack>
                    </Paper>
                  )}
                </>
              )}
            </Stack>
          </Paper>

          {/* Sync Actions */}
          {selectedSource && (
            <Paper p="lg" withBorder>
              <Stack gap="md">
                <Title order={3}>Sync Actions</Title>

                <Group>
                  <Button
                    leftSection={<IconDatabase size={16} />}
                    onClick={handleFullSync}
                    loading={triggerSyncMutation.isPending}
                  >
                    Full Sync
                  </Button>

                  <Button
                    leftSection={<IconRefresh size={16} />}
                    onClick={handleIncrementalSync}
                    loading={triggerSyncMutation.isPending}
                    variant="light"
                  >
                    Incremental Sync
                  </Button>
                </Group>

                <div>
                  <Text size="sm" fw={500} mb="xs">
                    Re-ingest Single Grant
                  </Text>
                  <Group>
                    <TextInput
                      placeholder="Enter grant external ID"
                      value={externalId}
                      onChange={(e) => setExternalId(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <Button
                      onClick={handleSingleGrantSync}
                      loading={triggerSyncMutation.isPending}
                      disabled={!externalId.trim()}
                    >
                      Sync Grant
                    </Button>
                  </Group>
                </div>

                <Alert icon={<IconAlertCircle size={16} />} color="blue">
                  <Text size="sm">
                    <strong>Full Sync:</strong> Fetches all grants from source (may take several minutes)
                    <br />
                    <strong>Incremental Sync:</strong> Only fetches grants modified since last sync
                    <br />
                    <strong>Single Grant:</strong> Re-ingest a specific grant by its external ID
                  </Text>
                </Alert>
              </Stack>
            </Paper>
          )}

          {/* Sync History */}
          {selectedSource && (
            <Paper p="lg" withBorder>
              <Stack gap="md">
                <Group justify="space-between">
                  <Title order={3}>Sync History</Title>
                  <ActionIcon
                    onClick={() => queryClient.invalidateQueries({ queryKey: ['sync_history'] })}
                    variant="subtle"
                  >
                    <IconRefresh size={16} />
                  </ActionIcon>
                </Group>

                {historyLoading ? (
                  <Loader />
                ) : syncHistory && syncHistory.length > 0 ? (
                  <Table>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Status</Table.Th>
                        <Table.Th>Type</Table.Th>
                        <Table.Th>Fetched</Table.Th>
                        <Table.Th>Created</Table.Th>
                        <Table.Th>Updated</Table.Th>
                        <Table.Th>Started</Table.Th>
                        <Table.Th>Completed</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {syncHistory.map((job) => (
                        <Table.Tr key={job.id}>
                          <Table.Td>{getStatusBadge(job.status)}</Table.Td>
                          <Table.Td>
                            <Badge variant="light">{job.job_type}</Badge>
                          </Table.Td>
                          <Table.Td>{job.grants_fetched}</Table.Td>
                          <Table.Td>{job.grants_created}</Table.Td>
                          <Table.Td>{job.grants_updated}</Table.Td>
                          <Table.Td>{job.started_at ? dayjs(job.started_at).format('MMM D, h:mm A') : '-'}</Table.Td>
                          <Table.Td>
                            {job.completed_at ? dayjs(job.completed_at).format('MMM D, h:mm A') : '-'}
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                ) : (
                  <Text c="dimmed">No sync history available</Text>
                )}
              </Stack>
            </Paper>
          )}
        </Stack>
      </Container>
    </ProtectedRoute>
  );
}
