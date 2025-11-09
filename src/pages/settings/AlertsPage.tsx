import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Stack,
  Title,
  Text,
  Divider,
  Paper,
  Button,
  Group,
  Badge,
  Modal,
  TextInput,
  Textarea,
  Select,
  Switch,
  NumberInput,
  ActionIcon,
  Tooltip,
  Table,
  Loader,
  Center,
  Card,
  Alert,
} from '@mantine/core';
import {
  IconPlus,
  IconBell,
  IconBellOff,
  IconEdit,
  IconTrash,
  IconAlertCircle,
  IconCheck,
  IconClock,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { SettingsLayout } from '../../components/SettingsLayout';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { useOrganization } from '../../contexts/OrganizationContext';
import { supabase } from '../../lib/supabase';
import { FUNDING_CATEGORIES, FEDERAL_AGENCIES } from '../../types/grants';

interface GrantAlert {
  id: string;
  name: string;
  description: string | null;
  keyword: string | null;
  category: string | null;
  agency: string | null;
  status_posted: boolean;
  status_forecasted: boolean;
  due_in_days: number | null;
  min_amount: number | null;
  max_amount: number | null;
  frequency: 'realtime' | 'daily' | 'weekly';
  notify_email: boolean;
  notify_in_app: boolean;
  is_active: boolean;
  last_checked_at: string | null;
  last_alert_sent_at: string | null;
  alert_count: number;
  created_at: string;
}

export function AlertsPage() {
  const { currentOrg } = useOrganization();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState<GrantAlert | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [agency, setAgency] = useState<string | null>(null);
  const [statusPosted, setStatusPosted] = useState(true);
  const [statusForecasted, setStatusForecasted] = useState(true);
  const [dueInDays, setDueInDays] = useState<number | string>('');
  const [minAmount, setMinAmount] = useState<number | string>('');
  const [maxAmount, setMaxAmount] = useState<number | string>('');
  const [frequency, setFrequency] = useState<string>('daily');
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyInApp, setNotifyInApp] = useState(true);

  // Fetch alerts
  const { data: alertsData, isLoading } = useQuery({
    queryKey: ['grant-alerts', currentOrg?.id],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('No session');

      const response = await fetch(`/api/alerts?org_id=${currentOrg?.id}`, {
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch alerts');

      return response.json();
    },
    enabled: !!currentOrg,
  });

  // Create alert mutation
  const createMutation = useMutation({
    mutationFn: async (alertData: any) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('No session');

      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify(alertData),
      });

      if (!response.ok) throw new Error('Failed to create alert');

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grant-alerts'] });
      notifications.show({
        title: 'Alert created',
        message: 'Your grant alert has been created successfully.',
        color: 'green',
        icon: <IconCheck size={16} />,
      });
      handleCloseModal();
    },
    onError: () => {
      notifications.show({
        title: 'Error',
        message: 'Failed to create alert',
        color: 'red',
      });
    },
  });

  // Update alert mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('No session');

      const response = await fetch(`/api/alerts?alert_id=${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) throw new Error('Failed to update alert');

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grant-alerts'] });
      notifications.show({
        title: 'Alert updated',
        message: 'Your grant alert has been updated successfully.',
        color: 'green',
        icon: <IconCheck size={16} />,
      });
      handleCloseModal();
    },
    onError: () => {
      notifications.show({
        title: 'Error',
        message: 'Failed to update alert',
        color: 'red',
      });
    },
  });

  // Delete alert mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('No session');

      const response = await fetch(`/api/alerts?alert_id=${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to delete alert');

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grant-alerts'] });
      notifications.show({
        title: 'Alert deleted',
        message: 'Your grant alert has been deleted.',
        color: 'green',
        icon: <IconCheck size={16} />,
      });
    },
    onError: () => {
      notifications.show({
        title: 'Error',
        message: 'Failed to delete alert',
        color: 'red',
      });
    },
  });

  const handleOpenModal = (alert?: GrantAlert) => {
    if (alert) {
      setEditingAlert(alert);
      setName(alert.name);
      setDescription(alert.description || '');
      setKeyword(alert.keyword || '');
      setCategory(alert.category);
      setAgency(alert.agency);
      setStatusPosted(alert.status_posted);
      setStatusForecasted(alert.status_forecasted);
      setDueInDays(alert.due_in_days || '');
      setMinAmount(alert.min_amount || '');
      setMaxAmount(alert.max_amount || '');
      setFrequency(alert.frequency);
      setNotifyEmail(alert.notify_email);
      setNotifyInApp(alert.notify_in_app);
    } else {
      resetForm();
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingAlert(null);
    resetForm();
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setKeyword('');
    setCategory(null);
    setAgency(null);
    setStatusPosted(true);
    setStatusForecasted(true);
    setDueInDays('');
    setMinAmount('');
    setMaxAmount('');
    setFrequency('daily');
    setNotifyEmail(true);
    setNotifyInApp(true);
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      notifications.show({
        title: 'Validation error',
        message: 'Alert name is required',
        color: 'red',
      });
      return;
    }

    const alertData = {
      org_id: currentOrg?.id,
      name: name.trim(),
      description: description.trim() || null,
      keyword: keyword.trim() || null,
      category,
      agency,
      status_posted: statusPosted,
      status_forecasted: statusForecasted,
      due_in_days: dueInDays ? Number(dueInDays) : null,
      min_amount: minAmount ? Number(minAmount) : null,
      max_amount: maxAmount ? Number(maxAmount) : null,
      frequency,
      notify_email: notifyEmail,
      notify_in_app: notifyInApp,
    };

    if (editingAlert) {
      updateMutation.mutate({ id: editingAlert.id, updates: alertData });
    } else {
      createMutation.mutate(alertData);
    }
  };

  const handleToggleActive = (alert: GrantAlert) => {
    updateMutation.mutate({
      id: alert.id,
      updates: { is_active: !alert.is_active },
    });
  };

  const alerts = alertsData?.alerts || [];

  if (!currentOrg) {
    return (
      <ProtectedRoute>
        <SettingsLayout>
          <Text>Loading...</Text>
        </SettingsLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <SettingsLayout>
        <Stack gap="lg">
          {/* Header */}
          <Group justify="space-between">
            <div>
              <Title order={1}>Grant Alerts</Title>
              <Text c="dimmed" size="lg">
                Get notified when new grants match your criteria
              </Text>
            </div>
            <Button leftSection={<IconPlus size={16} />} onClick={() => handleOpenModal()}>
              Create Alert
            </Button>
          </Group>

          <Divider />

          {/* Info Alert */}
          <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
            <Text size="sm">
              Alerts automatically check for new grants matching your specified criteria. You'll
              receive notifications via your chosen channels (email, in-app, or webhook).
            </Text>
          </Alert>

          {/* Loading state */}
          {isLoading && (
            <Center py="xl">
              <Loader />
            </Center>
          )}

          {/* Empty state */}
          {!isLoading && alerts.length === 0 && (
            <Card padding="xl">
              <Stack align="center" gap="md">
                <IconBellOff size={48} style={{ opacity: 0.5 }} />
                <Text fw={600}>No alerts yet</Text>
                <Text c="dimmed" ta="center">
                  Create your first alert to get notified when new grants match your criteria
                </Text>
                <Button leftSection={<IconPlus size={16} />} onClick={() => handleOpenModal()}>
                  Create Alert
                </Button>
              </Stack>
            </Card>
          )}

          {/* Alerts table */}
          {!isLoading && alerts.length > 0 && (
            <Paper withBorder>
              <Table highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Alert Name</Table.Th>
                    <Table.Th>Criteria</Table.Th>
                    <Table.Th>Frequency</Table.Th>
                    <Table.Th>Notifications</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {alerts.map((alert: GrantAlert) => (
                    <Table.Tr key={alert.id}>
                      <Table.Td>
                        <Stack gap={4}>
                          <Text fw={500}>{alert.name}</Text>
                          {alert.description && (
                            <Text size="sm" c="dimmed">
                              {alert.description}
                            </Text>
                          )}
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          {alert.keyword && <Badge size="sm">"{alert.keyword}"</Badge>}
                          {alert.category && (
                            <Badge size="sm" variant="light">
                              {FUNDING_CATEGORIES.find((c) => c.value === alert.category)?.label}
                            </Badge>
                          )}
                          {alert.agency && (
                            <Badge size="sm" variant="light">
                              {FEDERAL_AGENCIES.find((a) => a.value === alert.agency)?.label}
                            </Badge>
                          )}
                          {alert.due_in_days && (
                            <Badge size="sm" variant="outline">
                              Due ≤ {alert.due_in_days}d
                            </Badge>
                          )}
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          size="sm"
                          leftSection={<IconClock size={12} />}
                          variant="light"
                          color="blue"
                        >
                          {alert.frequency}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          {alert.notify_email && (
                            <Tooltip label="Email">
                              <Badge size="xs" variant="dot">
                                Email
                              </Badge>
                            </Tooltip>
                          )}
                          {alert.notify_in_app && (
                            <Tooltip label="In-app">
                              <Badge size="xs" variant="dot">
                                In-app
                              </Badge>
                            </Tooltip>
                          )}
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={alert.is_active ? 'green' : 'gray'} size="sm">
                          {alert.is_active ? 'Active' : 'Paused'}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <Tooltip label={alert.is_active ? 'Pause' : 'Activate'}>
                            <ActionIcon
                              variant="light"
                              color={alert.is_active ? 'orange' : 'green'}
                              onClick={() => handleToggleActive(alert)}
                            >
                              {alert.is_active ? <IconBellOff size={16} /> : <IconBell size={16} />}
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Edit">
                            <ActionIcon
                              variant="light"
                              color="blue"
                              onClick={() => handleOpenModal(alert)}
                            >
                              <IconEdit size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Delete">
                            <ActionIcon
                              variant="light"
                              color="red"
                              onClick={() => {
                                if (
                                  confirm(
                                    `Are you sure you want to delete the alert "${alert.name}"?`
                                  )
                                ) {
                                  deleteMutation.mutate(alert.id);
                                }
                              }}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>
          )}

          {/* Create/Edit Modal */}
          <Modal
            opened={modalOpen}
            onClose={handleCloseModal}
            title={editingAlert ? 'Edit Alert' : 'Create Alert'}
            size="lg"
          >
            <Stack gap="md">
              <TextInput
                label="Alert Name"
                placeholder="e.g., Education Grants"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />

              <Textarea
                label="Description"
                placeholder="Optional description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                minRows={2}
              />

              <Divider label="Search Criteria" />

              <TextInput
                label="Keyword"
                placeholder="Search for specific keywords..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />

              <Select
                label="Category"
                placeholder="Select a category"
                data={FUNDING_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
                value={category}
                onChange={setCategory}
                clearable
                searchable
              />

              <Select
                label="Agency"
                placeholder="Select an agency"
                data={FEDERAL_AGENCIES.map((a) => ({ value: a.value, label: a.label }))}
                value={agency}
                onChange={setAgency}
                clearable
                searchable
              />

              <Group grow>
                <Switch
                  label="Posted Grants"
                  checked={statusPosted}
                  onChange={(e) => setStatusPosted(e.currentTarget.checked)}
                />
                <Switch
                  label="Forecasted Grants"
                  checked={statusForecasted}
                  onChange={(e) => setStatusForecasted(e.currentTarget.checked)}
                />
              </Group>

              <NumberInput
                label="Due in (days)"
                placeholder="e.g., 30"
                value={dueInDays}
                onChange={setDueInDays}
                min={0}
                description="Only alert for grants closing within this many days"
              />

              <Group grow>
                <NumberInput
                  label="Min Amount"
                  placeholder="e.g., 10000"
                  value={minAmount}
                  onChange={setMinAmount}
                  min={0}
                  prefix="$"
                  thousandSeparator=","
                />
                <NumberInput
                  label="Max Amount"
                  placeholder="e.g., 500000"
                  value={maxAmount}
                  onChange={setMaxAmount}
                  min={0}
                  prefix="$"
                  thousandSeparator=","
                />
              </Group>

              <Divider label="Alert Settings" />

              <Select
                label="Check Frequency"
                data={[
                  { value: 'daily', label: 'Daily' },
                  { value: 'weekly', label: 'Weekly' },
                ]}
                value={frequency}
                onChange={(value) => setFrequency(value || 'daily')}
              />

              <Group grow>
                <Switch label="Email Notifications" checked={notifyEmail} onChange={(e) => setNotifyEmail(e.currentTarget.checked)} />
                <Switch label="In-App Notifications" checked={notifyInApp} onChange={(e) => setNotifyInApp(e.currentTarget.checked)} />
              </Group>

              <Group justify="flex-end" mt="md">
                <Button variant="light" onClick={handleCloseModal}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  loading={createMutation.isPending || updateMutation.isPending}
                >
                  {editingAlert ? 'Update Alert' : 'Create Alert'}
                </Button>
              </Group>
            </Stack>
          </Modal>
        </Stack>
      </SettingsLayout>
    </ProtectedRoute>
  );
}
