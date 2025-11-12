import { useState } from 'react';
import {
  Stack,
  Title,
  Text,
  Paper,
  Table,
  Button,
  Group,
  Badge,
  Modal,
  Select,
  TextInput,
  Alert,
} from '@mantine/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconX,
  IconAlertCircle,
  IconEdit,
} from '@tabler/icons-react';
import { supabase } from '../../lib/supabase';

interface Organization {
  id: string;
  name: string;
  plan_name: string;
  plan_status: string;
  trial_ends_at: string | null;
  next_renewal_at: string | null;
  member_count: number;
  created_at: string;
}

const PLAN_OPTIONS = [
  { value: 'free', label: 'Free' },
  { value: 'starter', label: 'Starter' },
  { value: 'professional', label: 'Professional' },
  { value: 'enterprise', label: 'Enterprise' },
];

const PLAN_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'trialing', label: 'Trialing' },
  { value: 'past_due', label: 'Past Due' },
  { value: 'canceled', label: 'Canceled' },
  { value: 'suspended', label: 'Suspended' },
];

export function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [editPlanName, setEditPlanName] = useState('');
  const [editPlanStatus, setEditPlanStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch all organizations with their settings
  const { data: organizations, isLoading } = useQuery({
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

  // Update plan mutation
  const updatePlanMutation = useMutation({
    mutationFn: async ({ orgId, planName, planStatus }: {
      orgId: string;
      planName: string;
      planStatus: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/admin/update-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          org_id: orgId,
          plan_name: planName,
          plan_status: planStatus,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update plan');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-organizations'] });
      setEditModalOpen(false);
      notifications.show({
        title: 'Success',
        message: 'Organization plan updated successfully',
        color: 'green',
        icon: <IconCheck size={16} />,
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red',
        icon: <IconX size={16} />,
      });
    },
  });

  const handleEditPlan = (org: Organization) => {
    setSelectedOrg(org);
    setEditPlanName(org.plan_name);
    setEditPlanStatus(org.plan_status);
    setEditModalOpen(true);
  };

  const handleSavePlan = () => {
    if (!selectedOrg) return;

    updatePlanMutation.mutate({
      orgId: selectedOrg.id,
      planName: editPlanName,
      planStatus: editPlanStatus,
    });
  };

  const filteredOrgs = organizations?.filter(org =>
    org.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getPlanBadgeColor = (planName: string) => {
    switch (planName) {
      case 'free': return 'gray';
      case 'starter': return 'blue';
      case 'professional': return 'green';
      case 'enterprise': return 'purple';
      default: return 'gray';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active': return 'green';
      case 'trialing': return 'blue';
      case 'past_due': return 'yellow';
      case 'canceled': return 'red';
      case 'suspended': return 'red';
      default: return 'gray';
    }
  };

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>User Management</Title>
        <Text c="dimmed" size="sm">
          Manage organization plans and subscriptions (Admin Only)
        </Text>
      </div>

      <Alert color="blue" icon={<IconAlertCircle size={16} />}>
          <Text size="sm" fw={500}>Admin Area</Text>
          <Text size="xs" mt={4}>
            This page is only accessible to admin users. You can view and modify organization plans and subscription statuses.
          </Text>
        </Alert>

        <Paper p="md" withBorder>
          <Stack gap="md">
            <Group justify="space-between">
              <Text fw={600} size="sm">Organizations ({filteredOrgs?.length || 0})</Text>
              <TextInput
                placeholder="Search organizations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: 300 }}
              />
            </Group>

            {isLoading ? (
              <Text size="sm" c="dimmed">Loading organizations...</Text>
            ) : (
              <Table.ScrollContainer minWidth={800}>
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
                          <Text size="sm" fw={500}>{org.name}</Text>
                          <Text size="xs" c="dimmed">{org.id}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge color={getPlanBadgeColor(org.plan_name)} variant="light">
                            {org.plan_name}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Badge color={getStatusBadgeColor(org.plan_status)} variant="light">
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
                            variant="subtle"
                            leftSection={<IconEdit size={14} />}
                            onClick={() => handleEditPlan(org)}
                          >
                            Edit Plan
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

        {/* Edit Plan Modal */}
        <Modal
          opened={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          title="Edit Organization Plan"
          size="md"
        >
          <Stack gap="md">
            {selectedOrg && (
              <>
                <div>
                  <Text size="sm" fw={600} mb={4}>Organization</Text>
                  <Text size="sm">{selectedOrg.name}</Text>
                  <Text size="xs" c="dimmed">{selectedOrg.id}</Text>
                </div>

                <Select
                  label="Plan"
                  value={editPlanName}
                  onChange={(value) => setEditPlanName(value || 'free')}
                  data={PLAN_OPTIONS}
                  required
                />

                <Select
                  label="Status"
                  value={editPlanStatus}
                  onChange={(value) => setEditPlanStatus(value || 'active')}
                  data={PLAN_STATUS_OPTIONS}
                  required
                />

                <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
                  <Text size="xs">
                    Changing the plan will immediately affect the organization's access to features and limits.
                  </Text>
                </Alert>

                <Group justify="flex-end" mt="md">
                  <Button
                    variant="default"
                    onClick={() => setEditModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSavePlan}
                    loading={updatePlanMutation.isPending}
                  >
                    Save Changes
                  </Button>
                </Group>
              </>
            )}
          </Stack>
        </Modal>
      </Stack>
    </Stack>
  );
}
