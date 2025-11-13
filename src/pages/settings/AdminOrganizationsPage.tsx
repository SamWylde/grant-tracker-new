import { useState } from 'react';
import {
  Stack,
  Title,
  Text,
  Paper,
  Table,
  Group,
  Badge,
  TextInput,
  Alert,
  Button,
  Modal,
  Select,
  Loader,
} from '@mantine/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  IconAlertCircle,
  IconEdit,
  IconBuilding,
} from '@tabler/icons-react';
import { supabase } from '../../lib/supabase';
import { notifications } from '@mantine/notifications';

interface Organization {
  id: string;
  name: string;
  created_at: string;
  plan_name: string;
  plan_status: string;
  trial_ends_at: string | null;
  next_renewal_at: string | null;
  member_count: number;
}

export function AdminOrganizationsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [editedName, setEditedName] = useState('');
  const [editedPlan, setEditedPlan] = useState('');
  const [editedStatus, setEditedStatus] = useState('');
  const queryClient = useQueryClient();

  // Fetch all organizations
  const { data: organizations, isLoading, error } = useQuery({
    queryKey: ['admin-organizations'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/admin/organizations', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch organizations');
      }

      return response.json() as Promise<Organization[]>;
    },
  });

  // Update organization name mutation
  const updateNameMutation = useMutation({
    mutationFn: async ({ org_id, name }: { org_id: string; name: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/admin/update-org-name', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ org_id, name }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update organization name');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-organizations'] });
      notifications.show({
        title: 'Success',
        message: 'Organization name updated successfully',
        color: 'green',
      });
      setEditingOrg(null);
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red',
      });
    },
  });

  // Update organization plan mutation
  const updatePlanMutation = useMutation({
    mutationFn: async ({ org_id, plan_name, plan_status }: { org_id: string; plan_name: string; plan_status: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/admin/update-plan', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ org_id, plan_name, plan_status }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update organization plan');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-organizations'] });
      notifications.show({
        title: 'Success',
        message: 'Organization plan updated successfully',
        color: 'green',
      });
      setEditingOrg(null);
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red',
      });
    },
  });

  const filteredOrgs = organizations?.filter(org =>
    org.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenEditModal = (org: Organization) => {
    setEditingOrg(org);
    setEditedName(org.name);
    setEditedPlan(org.plan_name);
    setEditedStatus(org.plan_status);
  };

  const handleSaveChanges = () => {
    if (!editingOrg) return;

    const nameChanged = editedName !== editingOrg.name;
    const planChanged = editedPlan !== editingOrg.plan_name || editedStatus !== editingOrg.plan_status;

    if (nameChanged) {
      updateNameMutation.mutate({ org_id: editingOrg.id, name: editedName });
    }

    if (planChanged) {
      updatePlanMutation.mutate({
        org_id: editingOrg.id,
        plan_name: editedPlan,
        plan_status: editedStatus,
      });
    }

    if (!nameChanged && !planChanged) {
      setEditingOrg(null);
    }
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'free': return 'gray';
      case 'starter': return 'blue';
      case 'pro': return 'grape';
      case 'enterprise': return 'violet';
      default: return 'gray';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'green';
      case 'trialing': return 'blue';
      case 'past_due': return 'orange';
      case 'canceled': return 'red';
      case 'suspended': return 'red';
      default: return 'gray';
    }
  };

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Organization Management</Title>
        <Text c="dimmed" size="sm">
          Manage all organizations on the platform (Platform Admin Only)
        </Text>
      </div>

      <Alert color="blue" icon={<IconAlertCircle size={16} />}>
        <Text size="sm" fw={500}>Platform Admin Area</Text>
        <Text size="xs" mt={4}>
          This page shows all organizations across the entire platform. Only platform administrators can access this page.
        </Text>
      </Alert>

      {error && (
        <Alert color="red" icon={<IconAlertCircle size={16} />}>
          <Text size="sm" fw={500}>Error loading organizations</Text>
          <Text size="xs" mt={4}>{error.message}</Text>
        </Alert>
      )}

      <Paper p="md" withBorder>
        <Stack gap="md">
          <Group justify="space-between">
            <Text fw={600} size="sm">All Organizations ({filteredOrgs?.length || 0})</Text>
            <TextInput
              placeholder="Search organizations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: 300 }}
            />
          </Group>

          {isLoading ? (
            <Group justify="center" py="xl">
              <Loader size="sm" />
              <Text size="sm" c="dimmed">Loading organizations...</Text>
            </Group>
          ) : filteredOrgs && filteredOrgs.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="xl">
              {searchQuery ? 'No organizations match your search' : 'No organizations found'}
            </Text>
          ) : (
            <Table.ScrollContainer minWidth={1000}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Organization</Table.Th>
                    <Table.Th>Plan</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Members</Table.Th>
                    <Table.Th>Created</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredOrgs?.map((org) => (
                    <Table.Tr key={org.id}>
                      <Table.Td>
                        <Group gap="xs">
                          <IconBuilding size={16} />
                          <div>
                            <Text size="sm" fw={500}>{org.name}</Text>
                            <Text size="xs" c="dimmed">{org.id}</Text>
                          </div>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Badge size="sm" color={getPlanColor(org.plan_name)} variant="light">
                          {org.plan_name}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge size="sm" color={getStatusColor(org.plan_status)} variant="light">
                          {org.plan_status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{org.member_count}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs">
                          {new Date(org.created_at).toLocaleDateString()}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Button
                          size="xs"
                          variant="light"
                          leftSection={<IconEdit size={14} />}
                          onClick={() => handleOpenEditModal(org)}
                        >
                          Edit
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </Stack>
      </Paper>

      {/* Edit Modal */}
      <Modal
        opened={!!editingOrg}
        onClose={() => setEditingOrg(null)}
        title="Edit Organization"
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label="Organization Name"
            placeholder="Enter organization name"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            required
          />

          <Select
            label="Plan"
            placeholder="Select plan"
            value={editedPlan}
            onChange={(value) => setEditedPlan(value || 'free')}
            data={[
              { value: 'free', label: 'Free' },
              { value: 'starter', label: 'Starter' },
              { value: 'pro', label: 'Pro' },
              { value: 'enterprise', label: 'Enterprise' },
            ]}
            required
          />

          <Select
            label="Plan Status"
            placeholder="Select status"
            value={editedStatus}
            onChange={(value) => setEditedStatus(value || 'active')}
            data={[
              { value: 'active', label: 'Active' },
              { value: 'trialing', label: 'Trialing' },
              { value: 'past_due', label: 'Past Due' },
              { value: 'canceled', label: 'Canceled' },
              { value: 'suspended', label: 'Suspended' },
            ]}
            required
          />

          <Group justify="flex-end" mt="md">
            <Button
              variant="subtle"
              onClick={() => setEditingOrg(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveChanges}
              loading={updateNameMutation.isPending || updatePlanMutation.isPending}
            >
              Save Changes
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
