import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Stack,
  Title,
  Text,
  Paper,
  Button,
  Group,
  Badge,
  Progress,
  Alert,
  Divider,
  Card,
  Modal,
  Radio,
  Checkbox,
  Timeline,
  Code,
  CopyButton,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconDownload,
  IconCheck,
  IconClock,
  IconAlertCircle,
  IconFileDownload,
  IconShieldCheck,
  IconCopy,
  IconExternalLink,
} from '@tabler/icons-react';
import { SettingsLayout } from '../../components/SettingsLayout';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface ExportRequest {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired';
  format: 'json' | 'csv' | 'both';
  progress_percentage: number;
  current_step: string;
  file_size: number | null;
  requested_at: string;
  completed_at: string | null;
  expires_at: string | null;
  download_url: string | null;
  time_remaining_days: number | null;
  error_message: string | null;
}

export function PrivacyDataPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const [requestModal, setRequestModal] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<'json' | 'csv' | 'both'>('json');
  const [includeDeleted, setIncludeDeleted] = useState(false);

  // Fetch export requests history
  const { data: exportRequests, isLoading } = useQuery({
    queryKey: ['exportRequests'],
    queryFn: async () => {
      const response = await fetch('/api/data-export/request', {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch export requests');
      }

      const data = await response.json();
      return data.requests as ExportRequest[];
    },
    enabled: !!session,
    refetchInterval: (data) => {
      // Refetch every 5 seconds if there's a pending/processing request
      const hasPending = data?.some(
        (req: ExportRequest) => req.status === 'pending' || req.status === 'processing'
      );
      return hasPending ? 5000 : false;
    },
  });

  // Create export request mutation
  const createExportMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/data-export/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          format: selectedFormat,
          include_deleted: includeDeleted,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create export request');
      }

      return response.json();
    },
    onSuccess: () => {
      setRequestModal(false);
      queryClient.invalidateQueries({ queryKey: ['exportRequests'] });
      notifications.show({
        title: 'Export Requested',
        message: 'Your personal data export has been requested. You will receive an email when it\'s ready.',
        color: 'green',
        icon: <IconCheck size={18} />,
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red',
        icon: <IconAlertCircle size={18} />,
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'green';
      case 'processing':
        return 'blue';
      case 'pending':
        return 'yellow';
      case 'failed':
        return 'red';
      case 'expired':
        return 'gray';
      default:
        return 'gray';
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'N/A';
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${bytes} bytes`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const activeRequest = exportRequests?.find(
    (req) => req.status === 'pending' || req.status === 'processing'
  );

  const completedRequests = exportRequests?.filter((req) => req.status === 'completed') || [];

  return (
    <ProtectedRoute>
      <SettingsLayout>
        <Stack gap="lg">
          {/* Header */}
          <div>
            <Title order={1}>Privacy & Data Export</Title>
            <Text c="dimmed" size="lg" mt="sm">
              Download your personal data and manage your privacy rights
            </Text>
          </div>

          <Divider />

          {/* GDPR Info */}
          <Alert color="blue" icon={<IconShieldCheck />} title="Your Data Rights">
            <Text size="sm">
              Under GDPR and other privacy regulations, you have the right to access and download all personal
              data we hold about you. This export includes your profile, grants, tasks, comments, and all other
              data associated with your account.
            </Text>
          </Alert>

          {/* Active Export Request */}
          {activeRequest && (
            <Card withBorder shadow="sm">
              <Stack gap="md">
                <Group justify="space-between">
                  <div>
                    <Text fw={600} size="lg">
                      Export in Progress
                    </Text>
                    <Text size="sm" c="dimmed">
                      Requested {formatDate(activeRequest.requested_at)}
                    </Text>
                  </div>
                  <Badge color={getStatusColor(activeRequest.status)} size="lg">
                    {activeRequest.status}
                  </Badge>
                </Group>

                {activeRequest.status === 'processing' && (
                  <>
                    <Progress value={activeRequest.progress_percentage} size="lg" animated />
                    <Text size="sm" c="dimmed">
                      {activeRequest.current_step} ({activeRequest.progress_percentage}%)
                    </Text>
                  </>
                )}

                {activeRequest.status === 'pending' && (
                  <Alert color="blue" icon={<IconClock />}>
                    <Text size="sm">
                      Your export request is queued and will begin processing shortly.
                      Estimated time: 5-10 minutes.
                    </Text>
                  </Alert>
                )}
              </Stack>
            </Card>
          )}

          {/* Request New Export */}
          {!activeRequest && (
            <Paper p="xl" withBorder>
              <Stack gap="md">
                <div>
                  <Title order={3}>Request Data Export</Title>
                  <Text size="sm" c="dimmed" mt="xs">
                    Generate a complete copy of your personal data
                  </Text>
                </div>

                <Divider />

                <Text size="sm">
                  Your export will include:
                </Text>
                <ul style={{ marginTop: 0, paddingLeft: '1.5rem' }}>
                  <li>
                    <Text size="sm">User profile and account information</Text>
                  </li>
                  <li>
                    <Text size="sm">All grants you've saved or created</Text>
                  </li>
                  <li>
                    <Text size="sm">Tasks assigned to you</Text>
                  </li>
                  <li>
                    <Text size="sm">Comments and activity history</Text>
                  </li>
                  <li>
                    <Text size="sm">Organization memberships and roles</Text>
                  </li>
                  <li>
                    <Text size="sm">Documents you've uploaded (metadata only)</Text>
                  </li>
                  <li>
                    <Text size="sm">Preferences and notification settings</Text>
                  </li>
                </ul>

                <Alert color="yellow" icon={<IconAlertCircle />}>
                  <Text size="sm">
                    Export files are available for 7 days and then permanently deleted for your security.
                    You can request a new export at any time.
                  </Text>
                </Alert>

                <Button
                  size="md"
                  leftSection={<IconDownload size={18} />}
                  onClick={() => setRequestModal(true)}
                >
                  Request New Export
                </Button>
              </Stack>
            </Paper>
          )}

          {/* Completed Exports */}
          {completedRequests.length > 0 && (
            <div>
              <Title order={3} mb="md">
                Available Downloads
              </Title>

              <Stack gap="md">
                {completedRequests.map((request) => (
                  <Card key={request.id} withBorder shadow="sm">
                    <Group justify="space-between" align="flex-start">
                      <div style={{ flex: 1 }}>
                        <Group gap="sm" mb="xs">
                          <Badge color={getStatusColor(request.status)}>
                            {request.status}
                          </Badge>
                          <Badge variant="light">{request.format.toUpperCase()}</Badge>
                          <Text size="sm" c="dimmed">
                            {formatFileSize(request.file_size)}
                          </Text>
                        </Group>

                        <Text size="sm" c="dimmed">
                          Requested: {formatDate(request.requested_at)}
                        </Text>

                        {request.expires_at && (
                          <Text size="sm" c={request.time_remaining_days && request.time_remaining_days <= 2 ? 'red' : 'dimmed'}>
                            Expires: {formatDate(request.expires_at)}
                            {request.time_remaining_days !== null && ` (${request.time_remaining_days} ${request.time_remaining_days === 1 ? 'day' : 'days'} remaining)`}
                          </Text>
                        )}
                      </div>

                      {request.download_url && (
                        <Group gap="xs">
                          <CopyButton value={`${window.location.origin}${request.download_url}`}>
                            {({ copied, copy }) => (
                              <Tooltip label={copied ? 'Copied!' : 'Copy download link'}>
                                <ActionIcon
                                  color={copied ? 'green' : 'gray'}
                                  variant="light"
                                  onClick={copy}
                                >
                                  {copied ? <IconCheck size={18} /> : <IconCopy size={18} />}
                                </ActionIcon>
                              </Tooltip>
                            )}
                          </CopyButton>

                          <Button
                            leftSection={<IconFileDownload size={18} />}
                            component="a"
                            href={request.download_url}
                            download
                          >
                            Download
                          </Button>
                        </Group>
                      )}
                    </Group>
                  </Card>
                ))}
              </Stack>
            </div>
          )}

          {/* Export History */}
          {exportRequests && exportRequests.length > 0 && (
            <div>
              <Title order={3} mb="md">
                Export History
              </Title>

              <Timeline active={-1} bulletSize={24} lineWidth={2}>
                {exportRequests.slice(0, 10).map((request) => (
                  <Timeline.Item
                    key={request.id}
                    bullet={
                      request.status === 'completed' ? (
                        <IconCheck size={12} />
                      ) : request.status === 'failed' ? (
                        <IconAlertCircle size={12} />
                      ) : (
                        <IconClock size={12} />
                      )
                    }
                    title={
                      <Group gap="xs">
                        <Text size="sm" fw={500}>
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </Text>
                        <Badge size="xs" variant="light">
                          {request.format}
                        </Badge>
                      </Group>
                    }
                  >
                    <Text size="xs" c="dimmed">
                      {formatDate(request.requested_at)}
                    </Text>
                    {request.error_message && (
                      <Text size="xs" c="red" mt="xs">
                        Error: {request.error_message}
                      </Text>
                    )}
                  </Timeline.Item>
                ))}
              </Timeline>
            </div>
          )}
        </Stack>

        {/* Request Modal */}
        <Modal
          opened={requestModal}
          onClose={() => setRequestModal(false)}
          title="Request Personal Data Export"
          size="lg"
        >
          <Stack gap="md">
            <Alert color="blue" icon={<IconShieldCheck />}>
              <Text size="sm">
                This export will contain all your personal data stored in our system.
                The download link will be valid for 7 days.
              </Text>
            </Alert>

            <div>
              <Text size="sm" fw={600} mb="xs">
                Export Format
              </Text>
              <Radio.Group value={selectedFormat} onChange={(val) => setSelectedFormat(val as any)}>
                <Stack gap="xs">
                  <Radio
                    value="json"
                    label="JSON - Structured data format, best for developers"
                    description="Hierarchical format with complete data structure"
                  />
                  <Radio
                    value="csv"
                    label="CSV - Spreadsheet format, best for analysis"
                    description="Comma-separated values, open in Excel or Google Sheets"
                  />
                  <Radio
                    value="both"
                    label="Both - Get JSON and CSV formats"
                    description="Receive both formats in a single export"
                  />
                </Stack>
              </Radio.Group>
            </div>

            <Checkbox
              label="Include deleted items (if available)"
              description="Include soft-deleted data if it still exists in the system"
              checked={includeDeleted}
              onChange={(e) => setIncludeDeleted(e.currentTarget.checked)}
            />

            <Divider />

            <Alert color="yellow" icon={<IconAlertCircle />}>
              <Text size="sm">
                Export generation may take 5-10 minutes depending on data volume.
                You'll receive an email notification when it's ready.
              </Text>
            </Alert>

            <Group justify="flex-end">
              <Button variant="light" onClick={() => setRequestModal(false)}>
                Cancel
              </Button>
              <Button
                leftSection={<IconDownload size={18} />}
                loading={createExportMutation.isPending}
                onClick={() => createExportMutation.mutate()}
              >
                Request Export
              </Button>
            </Group>
          </Stack>
        </Modal>
      </SettingsLayout>
    </ProtectedRoute>
  );
}
