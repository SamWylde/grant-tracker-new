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
  Tooltip,
  Button,
  Modal,
  Loader,
} from '@mantine/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  IconAlertCircle,
  IconShieldCheck,
  IconEdit,
} from '@tabler/icons-react';
import { supabase } from '../../lib/supabase';
import { notifications } from '@mantine/notifications';

interface User {
  id: string;
  email: string;
  full_name: string | null;
  is_platform_admin: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  organizations: Array<{
    role: string;
    org_id: string;
    org_name: string;
  }>;
  org_count: number;
}

export function AdminUsersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editedName, setEditedName] = useState('');
  const queryClient = useQueryClient();

  // Fetch all users
  const { data: users, isLoading, error } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch users');
      }

      return response.json() as Promise<User[]>;
    },
  });

  // Update username mutation
  const updateUsernameMutation = useMutation({
    mutationFn: async ({ user_id, full_name }: { user_id: string; full_name: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/admin/update-username', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id, full_name }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update username');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      notifications.show({
        title: 'Success',
        message: 'Username updated successfully',
        color: 'green',
      });
      setEditingUser(null);
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red',
      });
    },
  });

  const filteredUsers = users?.filter(user =>
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.full_name?.toLowerCase()?.includes(searchQuery.toLowerCase()) ?? false)
  );

  const handleOpenEditModal = (user: User) => {
    setEditingUser(user);
    setEditedName(user.full_name || '');
  };

  const handleSaveUsername = () => {
    if (!editingUser) return;
    updateUsernameMutation.mutate({ user_id: editingUser.id, full_name: editedName });
  };

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>User Management</Title>
        <Text c="dimmed" size="sm">
          View all users on the platform (Platform Admin Only)
        </Text>
      </div>

      <Alert color="blue" icon={<IconAlertCircle size={16} />}>
        <Text size="sm" fw={500}>Platform Admin Area</Text>
        <Text size="xs" mt={4}>
          This page shows all users across the entire platform. Only platform administrators can access this page.
        </Text>
      </Alert>

      {error && (
        <Alert color="red" icon={<IconAlertCircle size={16} />}>
          <Text size="sm" fw={500}>Error loading users</Text>
          <Text size="xs" mt={4}>{error.message}</Text>
        </Alert>
      )}

      <Paper p="md" withBorder>
        <Stack gap="md">
          <Group justify="space-between">
            <Text fw={600} size="sm">All Users ({filteredUsers?.length || 0})</Text>
            <TextInput
              placeholder="Search by email or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: 300 }}
            />
          </Group>

          {isLoading ? (
            <Group justify="center" py="xl">
              <Loader size="sm" />
              <Text size="sm" c="dimmed">Loading users...</Text>
            </Group>
          ) : filteredUsers && filteredUsers.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="xl">
              {searchQuery ? 'No users match your search' : 'No users found'}
            </Text>
          ) : (
            <Table.ScrollContainer minWidth={1000}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>User</Table.Th>
                    <Table.Th>Organizations</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Created</Table.Th>
                    <Table.Th>Last Sign In</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredUsers?.map((user) => (
                    <Table.Tr key={user.id}>
                      <Table.Td>
                        <Group gap="xs">
                          {user.is_platform_admin && (
                            <Tooltip label="Platform Administrator">
                              <IconShieldCheck size={16} color="var(--mantine-color-grape-6)" />
                            </Tooltip>
                          )}
                          <div>
                            <Text size="sm" fw={500}>
                              {user.full_name || user.email}
                            </Text>
                            {user.full_name && (
                              <Text size="xs" c="dimmed">{user.email}</Text>
                            )}
                          </div>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        {user.organizations.length > 0 ? (
                          <Stack gap={4}>
                            {user.organizations.map((org, idx) => (
                              <Group key={idx} gap="xs">
                                <Text size="xs">{org.org_name}</Text>
                                <Badge size="xs" variant="dot" color={org.role === 'admin' ? 'grape' : 'gray'}>
                                  {org.role}
                                </Badge>
                              </Group>
                            ))}
                          </Stack>
                        ) : (
                          <Text size="xs" c="dimmed">No organizations</Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Badge size="sm" color="green" variant="light">
                          Active
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs">
                          {new Date(user.created_at).toLocaleDateString()}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed">
                          {user.last_sign_in_at
                            ? new Date(user.last_sign_in_at).toLocaleDateString()
                            : 'Never'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Button
                          size="xs"
                          variant="light"
                          leftSection={<IconEdit size={14} />}
                          onClick={() => handleOpenEditModal(user)}
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
        opened={!!editingUser}
        onClose={() => setEditingUser(null)}
        title="Edit User"
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label="Email"
            value={editingUser?.email || ''}
            disabled
            description="Email cannot be changed"
          />

          <TextInput
            label="Full Name"
            placeholder="Enter full name"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            required
          />

          <Group justify="flex-end" mt="md">
            <Button
              variant="subtle"
              onClick={() => setEditingUser(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveUsername}
              loading={updateUsernameMutation.isPending}
            >
              Save Changes
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
