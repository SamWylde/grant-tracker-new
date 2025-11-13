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
  SimpleGrid,
  Badge,
  Modal,
  TextInput,
  Textarea,
  Checkbox,
  Accordion,
  Table,
  ActionIcon,
  ScrollArea,
  Alert,
  Tabs,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconShieldCheck,
  IconPlus,
  IconEdit,
  IconTrash,
  IconInfoCircle,
  IconUsers,
} from '@tabler/icons-react';
import { SettingsLayout } from '../../components/SettingsLayout';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useAuth } from '../../contexts/AuthContext';
import { usePermission } from '../../hooks/usePermission';
import {
  getAvailableRoles,
  getAllPermissions,
  getRoleWithPermissions,
  createCustomRole,
  updateCustomRole,
  deleteCustomRole,
  getOrgRoleAssignments,
  Role,
  RoleWithPermissions,
  Permission,
} from '../../lib/rbac';

interface CreateRoleForm {
  name: string;
  displayName: string;
  description: string;
  selectedPermissions: string[];
}

export function RoleManagementPage() {
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  const { hasPermission } = usePermission();
  const queryClient = useQueryClient();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleWithPermissions | null>(null);

  const [formData, setFormData] = useState<CreateRoleForm>({
    name: '',
    displayName: '',
    description: '',
    selectedPermissions: [],
  });

  const canManageRoles = hasPermission('admin:manage_roles');

  // Load all roles
  const { data: roles, isLoading: rolesLoading } = useQuery({
    queryKey: ['roles', currentOrg?.id],
    queryFn: () => getAvailableRoles(currentOrg?.id),
    enabled: !!currentOrg,
  });

  // Load all permissions
  const { data: permissions, isLoading: permissionsLoading } = useQuery({
    queryKey: ['permissions'],
    queryFn: getAllPermissions,
  });

  // Load role assignments
  const { data: roleAssignments } = useQuery({
    queryKey: ['roleAssignments', currentOrg?.id],
    queryFn: () => currentOrg ? getOrgRoleAssignments(currentOrg.id) : Promise.resolve([]),
    enabled: !!currentOrg,
  });

  // Group permissions by category
  const permissionsByCategory = permissions?.reduce((acc, perm) => {
    if (!acc[perm.category]) {
      acc[perm.category] = [];
    }
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>) || {};

  // Create role mutation
  const createRoleMutation = useMutation({
    mutationFn: async () => {
      if (!currentOrg || !user) throw new Error('No organization or user');

      const result = await createCustomRole(
        currentOrg.id,
        formData.name,
        formData.displayName,
        formData.description,
        formData.selectedPermissions
      );

      if (!result) throw new Error('Failed to create role');
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setCreateModalOpen(false);
      resetForm();
      notifications.show({
        title: 'Role created',
        message: 'The custom role has been created successfully',
        color: 'green',
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to create role',
        color: 'red',
      });
    },
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRole) throw new Error('No role selected');

      const success = await updateCustomRole(
        selectedRole.id,
        formData.displayName,
        formData.description,
        formData.selectedPermissions
      );

      if (!success) throw new Error('Failed to update role');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setEditModalOpen(false);
      setSelectedRole(null);
      resetForm();
      notifications.show({
        title: 'Role updated',
        message: 'The role has been updated successfully',
        color: 'green',
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to update role',
        color: 'red',
      });
    },
  });

  // Delete role mutation
  const deleteRoleMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRole) throw new Error('No role selected');

      const success = await deleteCustomRole(selectedRole.id);
      if (!success) throw new Error('Failed to delete role');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setDeleteModalOpen(false);
      setSelectedRole(null);
      notifications.show({
        title: 'Role deleted',
        message: 'The role has been deleted successfully',
        color: 'green',
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to delete role',
        color: 'red',
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      displayName: '',
      description: '',
      selectedPermissions: [],
    });
  };

  const handleEditRole = async (role: Role) => {
    const roleWithPerms = await getRoleWithPermissions(role.id);
    if (roleWithPerms) {
      setSelectedRole(roleWithPerms);
      setFormData({
        name: roleWithPerms.name,
        displayName: roleWithPerms.display_name,
        description: roleWithPerms.description || '',
        selectedPermissions: roleWithPerms.permissions.map((p) => p.id),
      });
      setEditModalOpen(true);
    }
  };

  const handleDeleteRole = (role: Role) => {
    setSelectedRole(role as RoleWithPermissions);
    setDeleteModalOpen(true);
  };

  const togglePermission = (permissionId: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedPermissions: prev.selectedPermissions.includes(permissionId)
        ? prev.selectedPermissions.filter((id) => id !== permissionId)
        : [...prev.selectedPermissions, permissionId],
    }));
  };

  const getRoleUsageCount = (roleId: string): number => {
    return roleAssignments?.filter((ra) => ra.role_id === roleId).length || 0;
  };

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
          <Stack gap="sm">
            <Group justify="space-between">
              <div>
                <Title order={1}>Role Management</Title>
                <Text c="dimmed" size="lg">
                  Configure roles and permissions for your organization
                </Text>
              </div>
              {canManageRoles && (
                <Button
                  leftSection={<IconPlus size={16} />}
                  onClick={() => setCreateModalOpen(true)}
                >
                  Create Custom Role
                </Button>
              )}
            </Group>
          </Stack>

          <Divider />

          {!canManageRoles && (
            <Alert icon={<IconInfoCircle size={16} />} color="blue">
              You need the <strong>admin:manage_roles</strong> permission to create or modify custom
              roles. Contact your organization admin for access.
            </Alert>
          )}

          {/* Roles List */}
          <Tabs defaultValue="system">
            <Tabs.List>
              <Tabs.Tab value="system" leftSection={<IconShieldCheck size={16} />}>
                System Roles
              </Tabs.Tab>
              <Tabs.Tab value="custom" leftSection={<IconUsers size={16} />}>
                Custom Roles
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="system" pt="md">
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                {roles
                  ?.filter((role) => role.is_system_role)
                  .map((role) => (
                    <Paper key={role.id} p="md" withBorder>
                      <Stack gap="sm">
                        <Group justify="space-between">
                          <div>
                            <Group gap="xs">
                              <Text fw={600} size="lg">
                                {role.display_name}
                              </Text>
                              <Badge size="xs" color="grape" variant="light">
                                System
                              </Badge>
                              <Badge size="xs" color="gray" variant="outline">
                                {getRoleUsageCount(role.id)} users
                              </Badge>
                            </Group>
                            <Text size="sm" c="dimmed" mt={4}>
                              {role.description}
                            </Text>
                          </div>
                        </Group>

                        <Button
                          variant="light"
                          size="xs"
                          onClick={() => handleEditRole(role)}
                        >
                          View Permissions
                        </Button>
                      </Stack>
                    </Paper>
                  ))}
              </SimpleGrid>
            </Tabs.Panel>

            <Tabs.Panel value="custom" pt="md">
              {roles?.filter((role) => !role.is_system_role).length === 0 ? (
                <Paper p="xl" withBorder>
                  <Stack align="center" gap="sm">
                    <IconShieldCheck size={48} stroke={1.5} color="var(--mantine-color-dimmed)" />
                    <Text c="dimmed" ta="center">
                      No custom roles yet. Create custom roles to define specific permission sets for
                      your organization.
                    </Text>
                    {canManageRoles && (
                      <Button
                        leftSection={<IconPlus size={16} />}
                        onClick={() => setCreateModalOpen(true)}
                        mt="sm"
                      >
                        Create Custom Role
                      </Button>
                    )}
                  </Stack>
                </Paper>
              ) : (
                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                  {roles
                    ?.filter((role) => !role.is_system_role)
                    .map((role) => (
                      <Paper key={role.id} p="md" withBorder>
                        <Stack gap="sm">
                          <Group justify="space-between">
                            <div>
                              <Group gap="xs">
                                <Text fw={600} size="lg">
                                  {role.display_name}
                                </Text>
                                <Badge size="xs" color="blue" variant="light">
                                  Custom
                                </Badge>
                                <Badge size="xs" color="gray" variant="outline">
                                  {getRoleUsageCount(role.id)} users
                                </Badge>
                              </Group>
                              <Text size="sm" c="dimmed" mt={4}>
                                {role.description}
                              </Text>
                            </div>
                          </Group>

                          {canManageRoles && (
                            <Group gap="xs">
                              <Button
                                variant="light"
                                size="xs"
                                leftSection={<IconEdit size={14} />}
                                onClick={() => handleEditRole(role)}
                              >
                                Edit
                              </Button>
                              <ActionIcon
                                variant="light"
                                color="red"
                                onClick={() => handleDeleteRole(role)}
                              >
                                <IconTrash size={14} />
                              </ActionIcon>
                            </Group>
                          )}
                        </Stack>
                      </Paper>
                    ))}
                </SimpleGrid>
              )}
            </Tabs.Panel>
          </Tabs>
        </Stack>

        {/* Create Role Modal */}
        <Modal
          opened={createModalOpen}
          onClose={() => {
            setCreateModalOpen(false);
            resetForm();
          }}
          title="Create Custom Role"
          size="lg"
        >
          <Stack gap="md">
            <TextInput
              label="Role Name"
              placeholder="grant_manager"
              description="Internal name (lowercase, underscores only)"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />

            <TextInput
              label="Display Name"
              placeholder="Grant Manager"
              description="Human-readable name"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              required
            />

            <Textarea
              label="Description"
              placeholder="Can manage grants and related tasks..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              minRows={2}
            />

            <Divider label="Permissions" />

            <ScrollArea h={400}>
              <Accordion>
                {Object.entries(permissionsByCategory).map(([category, perms]) => (
                  <Accordion.Item key={category} value={category}>
                    <Accordion.Control>
                      <Group justify="space-between" pr="md">
                        <Text fw={500} tt="capitalize">
                          {category}
                        </Text>
                        <Badge size="sm" variant="light">
                          {perms.filter((p) => formData.selectedPermissions.includes(p.id)).length} /{' '}
                          {perms.length}
                        </Badge>
                      </Group>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <Stack gap="xs">
                        {perms.map((perm) => (
                          <Checkbox
                            key={perm.id}
                            label={
                              <div>
                                <Text size="sm" fw={500}>
                                  {perm.name}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  {perm.description}
                                </Text>
                              </div>
                            }
                            checked={formData.selectedPermissions.includes(perm.id)}
                            onChange={() => togglePermission(perm.id)}
                          />
                        ))}
                      </Stack>
                    </Accordion.Panel>
                  </Accordion.Item>
                ))}
              </Accordion>
            </ScrollArea>

            <Group justify="flex-end" mt="md">
              <Button
                variant="light"
                onClick={() => {
                  setCreateModalOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                loading={createRoleMutation.isPending}
                disabled={!formData.name || !formData.displayName}
                onClick={() => createRoleMutation.mutate()}
              >
                Create Role
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* Edit Role Modal */}
        <Modal
          opened={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setSelectedRole(null);
            resetForm();
          }}
          title={selectedRole?.is_system_role ? 'View Role Permissions' : 'Edit Custom Role'}
          size="lg"
        >
          <Stack gap="md">
            {!selectedRole?.is_system_role && (
              <>
                <TextInput
                  label="Display Name"
                  placeholder="Grant Manager"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  required
                />

                <Textarea
                  label="Description"
                  placeholder="Can manage grants and related tasks..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  minRows={2}
                />

                <Divider label="Permissions" />
              </>
            )}

            {selectedRole?.is_system_role && (
              <>
                <Alert icon={<IconInfoCircle size={16} />} color="blue">
                  This is a system role. Permissions cannot be modified.
                </Alert>
                <Divider label="Permissions" />
              </>
            )}

            <ScrollArea h={400}>
              <Accordion>
                {Object.entries(permissionsByCategory).map(([category, perms]) => (
                  <Accordion.Item key={category} value={category}>
                    <Accordion.Control>
                      <Group justify="space-between" pr="md">
                        <Text fw={500} tt="capitalize">
                          {category}
                        </Text>
                        <Badge size="sm" variant="light">
                          {perms.filter((p) => formData.selectedPermissions.includes(p.id)).length} /{' '}
                          {perms.length}
                        </Badge>
                      </Group>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <Stack gap="xs">
                        {perms.map((perm) => (
                          <Checkbox
                            key={perm.id}
                            label={
                              <div>
                                <Text size="sm" fw={500}>
                                  {perm.name}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  {perm.description}
                                </Text>
                              </div>
                            }
                            checked={formData.selectedPermissions.includes(perm.id)}
                            onChange={() => !selectedRole?.is_system_role && togglePermission(perm.id)}
                            disabled={selectedRole?.is_system_role}
                          />
                        ))}
                      </Stack>
                    </Accordion.Panel>
                  </Accordion.Item>
                ))}
              </Accordion>
            </ScrollArea>

            <Group justify="flex-end" mt="md">
              <Button
                variant="light"
                onClick={() => {
                  setEditModalOpen(false);
                  setSelectedRole(null);
                  resetForm();
                }}
              >
                {selectedRole?.is_system_role ? 'Close' : 'Cancel'}
              </Button>
              {!selectedRole?.is_system_role && (
                <Button
                  loading={updateRoleMutation.isPending}
                  disabled={!formData.displayName}
                  onClick={() => updateRoleMutation.mutate()}
                >
                  Update Role
                </Button>
              )}
            </Group>
          </Stack>
        </Modal>

        {/* Delete Role Modal */}
        <Modal
          opened={deleteModalOpen}
          onClose={() => {
            setDeleteModalOpen(false);
            setSelectedRole(null);
          }}
          title="Delete Custom Role"
        >
          <Stack gap="md">
            <Text>
              Are you sure you want to delete the role <strong>{selectedRole?.display_name}</strong>?
            </Text>
            {getRoleUsageCount(selectedRole?.id || '') > 0 && (
              <Alert icon={<IconInfoCircle size={16} />} color="orange">
                This role is currently assigned to {getRoleUsageCount(selectedRole?.id || '')} user(s).
                They will lose these permissions when the role is deleted.
              </Alert>
            )}
            <Group justify="flex-end">
              <Button
                variant="light"
                onClick={() => {
                  setDeleteModalOpen(false);
                  setSelectedRole(null);
                }}
              >
                Cancel
              </Button>
              <Button color="red" loading={deleteRoleMutation.isPending} onClick={() => deleteRoleMutation.mutate()}>
                Delete Role
              </Button>
            </Group>
          </Stack>
        </Modal>
      </SettingsLayout>
    </ProtectedRoute>
  );
}
