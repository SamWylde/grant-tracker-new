import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Stack,
  Title,
  Text,
  Divider,
  Paper,
  Button,
  Group,
  SimpleGrid,
  Modal,
  TextInput,
  Select,
  Alert,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconDownload,
  IconTransfer,
  IconTrash,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { SettingsLayout } from '../../components/SettingsLayout';
import { ProtectedRoute, AccessDenied } from '../../components/ProtectedRoute';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useAuth } from '../../contexts/AuthContext';
import { usePermission } from '../../hooks/usePermission';
import { supabase } from '../../lib/supabase';

export function DangerZonePage() {
  const { currentOrg, refreshOrgs } = useOrganization();
  const { user } = useAuth();
  const { hasPermission, isAdmin } = usePermission();
  const navigate = useNavigate();

  const [exportModal, setExportModal] = useState(false);
  const [transferModal, setTransferModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);

  const [transferUserId, setTransferUserId] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  const canDelete = hasPermission('delete_org');

  // Load team members for transfer ownership
  const { data: members } = useQuery({
    queryKey: ['teamMembers', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];

      const { data, error } = await supabase
        .from('org_members')
        .select(`
          id,
          user_id,
          role,
          user_profiles (
            id,
            full_name
          )
        `)
        .eq('org_id', currentOrg.id)
        .neq('user_id', user?.id); // Exclude current user

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrg && isAdmin,
  });

  // Export data mutation (stub for V1)
  const exportMutation = useMutation({
    mutationFn: async () => {
      if (!currentOrg) throw new Error('No organization');

      // In V1, this is a stub. In production, this would:
      // 1. Call an API endpoint to generate CSV
      // 2. Download the file
      // For now, we'll just show a success message
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Fetch grants data
      const { data: grants } = await supabase
        .from('org_grants_saved')
        .select('*')
        .eq('org_id', currentOrg.id);

      // Simple CSV generation (stub)
      const csv = [
        ['Title', 'Agency', 'Close Date', 'Saved At'].join(','),
        ...(grants || []).map((g: any) =>
          [g.title, g.agency, g.close_date, g.saved_at].join(',')
        ),
      ].join('\n');

      // Download CSV
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `grants-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      setExportModal(false);
      notifications.show({
        title: 'Export started',
        message: 'Your data export has been downloaded.',
        color: 'green',
      });
    },
    onError: () => {
      notifications.show({
        title: 'Export failed',
        message: 'Failed to export data. Please try again.',
        color: 'red',
      });
    },
  });

  // Transfer ownership mutation
  const transferMutation = useMutation({
    mutationFn: async () => {
      if (!currentOrg || !transferUserId || !user) throw new Error('Missing data');

      // Update current owner to contributor
      const { error: demoteError } = await (supabase as any)
        .from('org_members')
        .update({ role: 'contributor' })
        .eq('org_id', currentOrg.id)
        .eq('user_id', user.id);

      if (demoteError) throw demoteError;

      // Update new owner to admin
      const { error: promoteError } = await (supabase as any)
        .from('org_members')
        .update({ role: 'admin' })
        .eq('org_id', currentOrg.id)
        .eq('user_id', transferUserId);

      if (promoteError) throw promoteError;
    },
    onSuccess: () => {
      refreshOrgs();
      setTransferModal(false);
      setTransferUserId(null);
      notifications.show({
        title: 'Ownership transferred',
        message: 'Organization ownership has been transferred successfully.',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to transfer ownership',
        color: 'red',
      });
    },
  });

  // Delete organization mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!currentOrg) throw new Error('No organization');

      // Delete the organization (cascade will handle related records)
      const { error } = await supabase
        .from('organizations')
        .delete()
        .eq('id', currentOrg.id);

      if (error) throw error;
    },
    onSuccess: () => {
      setDeleteModal(false);
      notifications.show({
        title: 'Organization deleted',
        message: 'Your organization has been permanently deleted.',
        color: 'green',
      });
      // Redirect to home after deletion
      setTimeout(() => {
        navigate('/');
      }, 1500);
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to delete organization',
        color: 'red',
      });
    },
  });

  if (!currentOrg) {
    return (
      <ProtectedRoute>
        <SettingsLayout>
          <Text>Loading...</Text>
        </SettingsLayout>
      </ProtectedRoute>
    );
  }

  if (!canDelete) {
    return (
      <ProtectedRoute>
        <SettingsLayout>
          <AccessDenied
            title="Admin Access Required"
            message="Only organization admins can access the Danger Zone. Contact your admin if you need to perform these actions."
          />
        </SettingsLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <SettingsLayout>
        <Stack gap="lg">
          {/* Header */}
          <Stack gap="sm">
            <Group>
              <IconAlertTriangle size={32} color="var(--mantine-color-red-6)" />
              <div>
                <Title order={1}>Danger Zone</Title>
                <Text c="dimmed" size="lg">
                  Irreversible and destructive actions
                </Text>
              </div>
            </Group>
          </Stack>

          <Alert color="red" title="Warning" icon={<IconAlertTriangle />}>
            These actions are permanent and cannot be undone. Please proceed with caution.
          </Alert>

          <Divider />

          {/* Main Content - Two Column Layout */}
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
            {/* Left Column - Danger Actions */}
            <Stack gap="lg">
              {/* Export Data */}
              <Paper p="md" withBorder style={{ borderColor: 'var(--mantine-color-gray-4)' }}>
                <Stack gap="md">
                  <Group>
                    <IconDownload size={24} />
                    <div>
                      <Title order={3} size="h4" mb="xs">
                        Export Organization Data
                      </Title>
                      <Text size="sm" c="dimmed">
                        Download all your grants, deadlines, and tasks as CSV
                      </Text>
                    </div>
                  </Group>

                  <Divider />

                  <Text size="sm">
                    Export a complete copy of your organization's data including saved grants,
                    deadlines, tasks, and team information.
                  </Text>

                  <Button
                    variant="light"
                    color="blue"
                    leftSection={<IconDownload size={16} />}
                    onClick={() => setExportModal(true)}
                  >
                    Export Data
                  </Button>
                </Stack>
              </Paper>

              {/* Transfer Ownership */}
              <Paper
                p="md"
                withBorder
                style={{ borderColor: 'var(--mantine-color-orange-4)' }}
              >
                <Stack gap="md">
                  <Group>
                    <IconTransfer size={24} color="var(--mantine-color-orange-6)" />
                    <div>
                      <Title order={3} size="h4" mb="xs">
                        Transfer Ownership
                      </Title>
                      <Text size="sm" c="dimmed">
                        Transfer admin control to another team member
                      </Text>
                    </div>
                  </Group>

                  <Divider />

                  <Text size="sm">
                    Transfer ownership of this organization to another admin. You will become a
                    regular contributor after the transfer.
                  </Text>

                  <Button
                    variant="light"
                    color="orange"
                    leftSection={<IconTransfer size={16} />}
                    onClick={() => setTransferModal(true)}
                    disabled={!members || members.length === 0}
                  >
                    Transfer Ownership
                  </Button>

                  {(!members || members.length === 0) && (
                    <Text size="xs" c="dimmed">
                      No other team members to transfer to
                    </Text>
                  )}
                </Stack>
              </Paper>

              {/* Delete Organization */}
              <Paper p="md" withBorder style={{ borderColor: 'var(--mantine-color-red-4)' }}>
                <Stack gap="md">
                  <Group>
                    <IconTrash size={24} color="var(--mantine-color-red-6)" />
                    <div>
                      <Title order={3} size="h4" mb="xs">
                        Delete Organization
                      </Title>
                      <Text size="sm" c="dimmed">
                        Permanently delete this organization and all data
                      </Text>
                    </div>
                  </Group>

                  <Divider />

                  <Alert color="red" icon={<IconAlertTriangle />}>
                    This action cannot be undone. All grants, tasks, team members, and settings
                    will be permanently deleted.
                  </Alert>

                  <Button
                    color="red"
                    leftSection={<IconTrash size={16} />}
                    onClick={() => setDeleteModal(true)}
                  >
                    Delete Organization
                  </Button>
                </Stack>
              </Paper>
            </Stack>

            {/* Right Column - Help */}
            <Stack gap="lg">
              <Paper p="md" withBorder bg="var(--mantine-color-blue-0)">
                <Stack gap="sm">
                  <Title order={4}>Before You Export</Title>
                  <Text size="sm">
                    The export includes all saved grants, deadlines, tasks, and team member
                    information in CSV format.
                  </Text>
                  <Text size="sm">
                    You can use this to create backups or migrate to another system. The export is
                    generated instantly and downloaded to your device.
                  </Text>
                </Stack>
              </Paper>

              <Paper p="md" withBorder bg="var(--mantine-color-orange-0)">
                <Stack gap="sm">
                  <Title order={4}>About Ownership Transfer</Title>
                  <Text size="sm">
                    Transferring ownership gives another team member full admin control, including
                    billing and the ability to delete the organization.
                  </Text>
                  <Text size="sm">
                    You'll remain on the team as a contributor unless the new owner removes you.
                  </Text>
                </Stack>
              </Paper>

              <Paper p="md" withBorder bg="var(--mantine-color-red-0)">
                <Stack gap="sm">
                  <Title order={4}>About Deletion</Title>
                  <Text size="sm" fw={600}>
                    Deleting your organization is permanent and immediate.
                  </Text>
                  <Text size="sm">All data will be erased, including:</Text>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                    <li>
                      <Text size="sm">All saved grants and deadlines</Text>
                    </li>
                    <li>
                      <Text size="sm">Tasks and notes</Text>
                    </li>
                    <li>
                      <Text size="sm">Team member access</Text>
                    </li>
                    <li>
                      <Text size="sm">Settings and integrations</Text>
                    </li>
                  </ul>
                  <Text size="sm" fw={600} c="red">
                    We recommend exporting your data before deletion.
                  </Text>
                </Stack>
              </Paper>
            </Stack>
          </SimpleGrid>
        </Stack>

        {/* Export Confirmation Modal */}
        <Modal
          opened={exportModal}
          onClose={() => setExportModal(false)}
          title="Export Organization Data"
        >
          <Stack gap="md">
            <Text>
              This will download a CSV file containing all your organization's grants, deadlines,
              and tasks.
            </Text>
            <Text size="sm" c="dimmed">
              The export includes: saved grants, deadlines, task lists, and team member
              information.
            </Text>
            <Group justify="flex-end">
              <Button variant="light" onClick={() => setExportModal(false)}>
                Cancel
              </Button>
              <Button
                color="blue"
                loading={exportMutation.isPending}
                leftSection={<IconDownload size={16} />}
                onClick={() => exportMutation.mutate()}
              >
                Download Export
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* Transfer Ownership Modal */}
        <Modal
          opened={transferModal}
          onClose={() => setTransferModal(false)}
          title="Transfer Ownership"
        >
          <Stack gap="md">
            <Text>
              Select a team member to become the new owner of <strong>{currentOrg.name}</strong>.
            </Text>
            <Alert color="orange" icon={<IconAlertTriangle />}>
              You will lose admin privileges and become a contributor.
            </Alert>
            <Select
              label="New Owner"
              placeholder="Select a team member"
              value={transferUserId}
              onChange={setTransferUserId}
              data={
                members?.map((m: any) => ({
                  value: m.user_id,
                  label: m.user_profiles?.full_name || 'Unknown',
                })) || []
              }
            />
            <Group justify="flex-end">
              <Button variant="light" onClick={() => setTransferModal(false)}>
                Cancel
              </Button>
              <Button
                color="orange"
                loading={transferMutation.isPending}
                disabled={!transferUserId}
                onClick={() => transferMutation.mutate()}
              >
                Transfer Ownership
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* Delete Organization Modal */}
        <Modal
          opened={deleteModal}
          onClose={() => setDeleteModal(false)}
          title="Delete Organization"
        >
          <Stack gap="md">
            <Alert color="red" icon={<IconAlertTriangle />}>
              This action cannot be undone!
            </Alert>
            <Text>
              Are you absolutely sure you want to delete <strong>{currentOrg.name}</strong>?
            </Text>
            <Text size="sm">
              All data, including saved grants, tasks, and team members, will be permanently
              deleted.
            </Text>
            <TextInput
              label={`Type "${currentOrg.name}" to confirm`}
              placeholder={currentOrg.name}
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
            />
            <Group justify="flex-end">
              <Button variant="light" onClick={() => setDeleteModal(false)}>
                Cancel
              </Button>
              <Button
                color="red"
                loading={deleteMutation.isPending}
                disabled={deleteConfirmation !== currentOrg.name}
                leftSection={<IconTrash size={16} />}
                onClick={() => deleteMutation.mutate()}
              >
                Delete Organization
              </Button>
            </Group>
          </Stack>
        </Modal>
      </SettingsLayout>
    </ProtectedRoute>
  );
}
