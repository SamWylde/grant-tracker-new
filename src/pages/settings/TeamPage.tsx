import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Stack,
  Title,
  Text,
  Divider,
  Paper,
  TextInput,
  Select,
  Button,
  Group,
  Badge,
  ActionIcon,
  SimpleGrid,
  Modal,
  Avatar,
  MultiSelect,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconTrash, IconX, IconUserEdit, IconCopy, IconChartBar, IconShieldCheck } from '@tabler/icons-react';
import { SettingsLayout } from '../../components/SettingsLayout';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useAuth } from '../../contexts/AuthContext';
import { usePermission } from '../../hooks/usePermission';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';
import { getAvailableRoles, assignRoleToUser, removeRoleFromUser } from '../../lib/rbac';

// Legacy roles for backward compatibility
const LEGACY_ROLES = [
  { value: 'contributor', label: 'Contributor' },
  { value: 'admin', label: 'Admin' },
];

export function TeamPage() {
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  const { hasPermission, isAdmin } = usePermission();
  const queryClient = useQueryClient();

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('contributor');

  // Modal states
  const [removeModal, setRemoveModal] = useState<{ open: boolean; memberId?: string; name?: string }>({ open: false });
  const [changeRoleModal, setChangeRoleModal] = useState<{
    open: boolean;
    memberId?: string;
    userId?: string;
    name?: string;
    currentRoles?: any[];
  }>({ open: false });
  const [newRole, setNewRole] = useState<string>('contributor');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  const canManageTeam = hasPermission('manage_team');

  // Load available roles for role assignment
  const { data: availableRoles } = useQuery({
    queryKey: ['availableRoles', currentOrg?.id],
    queryFn: () => currentOrg ? getAvailableRoles(currentOrg.id) : Promise.resolve([]),
    enabled: !!currentOrg && canManageTeam,
  });

  // Load team members using RPC function
  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['teamMembers', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];

      const { data, error } = await (supabase.rpc as any)("get_org_team_members", { org_uuid: currentOrg.id });

      if (error) {
        console.error("Failed to fetch team members:", error);
        throw error;
      }

      return data || [];
    },
    enabled: !!currentOrg,
  });

  // Load pending invitations
  const { data: invitations } = useQuery({
    queryKey: ['teamInvitations', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];

      const { data, error } = await supabase
        .from('team_invitations')
        .select('*')
        .eq('org_id', currentOrg.id)
        .is('accepted_at', null)
        .is('revoked_at', null);

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrg,
  });

  // Send invitation mutation
  const inviteMutation = useMutation({
    mutationFn: async () => {
      if (!currentOrg || !user) throw new Error('No organization or user');

      const invitation: Database['public']['Tables']['team_invitations']['Insert'] = {
        org_id: currentOrg.id,
        email: inviteEmail,
        role: inviteRole,
        invited_by: user.id,
      };

      // @ts-expect-error - Supabase PostgREST type inference limitation with generated Database types
      const { error } = await supabase.from('team_invitations').insert(invitation);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamInvitations'] });
      setInviteEmail('');
      setInviteRole('contributor');
      notifications.show({
        title: 'Invitation sent',
        message: `Invitation sent to ${inviteEmail}`,
        color: 'green',
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to send invitation',
        color: 'red',
      });
    },
  });

  // Revoke invitation mutation
  const revokeMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const update: Database['public']['Tables']['team_invitations']['Update'] = {
        revoked_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('team_invitations')
        // @ts-expect-error - Supabase PostgREST type inference limitation with generated Database types
        .update(update)
        .eq('id', invitationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamInvitations'] });
      notifications.show({
        title: 'Invitation revoked',
        message: 'The invitation has been revoked',
        color: 'green',
      });
    },
  });

  // Remove member mutation
  const removeMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.from('org_members').delete().eq('id', memberId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamMembers'] });
      setRemoveModal({ open: false });
      notifications.show({
        title: 'Member removed',
        message: 'The team member has been removed',
        color: 'green',
      });
    },
  });

  // Change role mutation
  const changeRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: string }) => {
      const update: Database['public']['Tables']['org_members']['Update'] = {
        role,
      };

      // @ts-expect-error - Supabase PostgREST type inference limitation with generated Database types
      const { error } = await supabase.from('org_members').update(update).eq('id', memberId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamMembers'] });
      setChangeRoleModal({ open: false });
      notifications.show({
        title: 'Role updated',
        message: 'The member\'s role has been updated',
        color: 'green',
      });
    },
  });

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
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
                <Title order={1}>Team</Title>
                <Text c="dimmed" size="lg">
                  Manage team members and their roles
                </Text>
              </div>
              {!canManageTeam && (
                <Badge color="gray" size="lg">
                  View Only
                </Badge>
              )}
            </Group>
          </Stack>

          <Divider />

          {/* Main Content - Two Column Layout */}
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
            {/* Left Column */}
            <Stack gap="lg">
              {/* Invite Form */}
              {canManageTeam && (
                <Paper p="md" withBorder>
                  <Stack gap="md">
                    <div>
                      <Title order={3} size="h4" mb="xs">
                        Invite Team Member
                      </Title>
                      <Text size="sm" c="dimmed">
                        Send an invitation to join your organization
                      </Text>
                    </div>

                    <Divider />

                    <TextInput
                      label="Email Address"
                      placeholder="teammate@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      type="email"
                      required
                    />

                    <Select
                      label="Role"
                      value={inviteRole}
                      onChange={(value) => value && setInviteRole(value)}
                      data={LEGACY_ROLES}
                      description="New members will be assigned the corresponding RBAC role"
                    />

                    <Button
                      fullWidth
                      disabled={!inviteEmail || !inviteEmail.includes('@')}
                      loading={inviteMutation.isPending}
                      onClick={() => inviteMutation.mutate()}
                    >
                      Send Invitation
                    </Button>
                  </Stack>
                </Paper>
              )}

              {/* Pending Invitations */}
              {canManageTeam && invitations && invitations.length > 0 && (
                <Paper p="md" withBorder>
                  <Stack gap="md">
                    <div>
                      <Title order={3} size="h4" mb="xs">
                        Pending Invitations
                      </Title>
                      <Text size="sm" c="dimmed">
                        Invitations waiting to be accepted
                      </Text>
                    </div>

                    <Divider />

                    <Stack gap="xs">
                      {invitations.map((invitation: any) => {
                        const inviteLink = `${window.location.origin}/accept-invite?id=${invitation.id}&email=${encodeURIComponent(invitation.email)}`;

                        return (
                          <Paper key={invitation.id} p="sm" withBorder>
                            <Stack gap="xs">
                              <Group justify="space-between">
                                <Stack gap={0}>
                                  <Text fw={500}>{invitation.email}</Text>
                                  <Text size="xs" c="dimmed">
                                    {invitation.role === 'admin' ? 'Admin' : 'Contributor'} •
                                    Invited {new Date(invitation.invited_at).toLocaleDateString()}
                                  </Text>
                                </Stack>
                                <Group gap="xs">
                                  <ActionIcon
                                    variant="light"
                                    color="blue"
                                    onClick={() => {
                                      navigator.clipboard.writeText(inviteLink);
                                      notifications.show({
                                        title: 'Link copied',
                                        message: 'Invitation link copied to clipboard',
                                        color: 'green',
                                      });
                                    }}
                                    title="Copy invitation link"
                                  >
                                    <IconCopy size={16} />
                                  </ActionIcon>
                                  <ActionIcon
                                    variant="light"
                                    color="red"
                                    onClick={() => revokeMutation.mutate(invitation.id)}
                                    title="Revoke invitation"
                                  >
                                    <IconX size={16} />
                                  </ActionIcon>
                                </Group>
                              </Group>
                            </Stack>
                          </Paper>
                        );
                      })}
                    </Stack>
                  </Stack>
                </Paper>
              )}

              {/* Team Members List */}
              <Paper p="md" withBorder>
                <Stack gap="md">
                  <div>
                    <Title order={3} size="h4" mb="xs">
                      Team Members
                    </Title>
                    <Text size="sm" c="dimmed">
                      {members?.length || 0} member{members?.length !== 1 ? 's' : ''}
                    </Text>
                  </div>

                  <Divider />

                  {membersLoading ? (
                    <Text c="dimmed">Loading...</Text>
                  ) : !members || members.length === 0 ? (
                    <Text c="dimmed" ta="center" py="xl">
                      No members yet
                    </Text>
                  ) : (
                    <Stack gap="xs">
                      {members.map((member: any) => {
                        const isCurrentUser = member.user_id === user?.id;

                        return (
                          <Paper key={member.id} p="sm" withBorder>
                            <Group justify="space-between" align="flex-start">
                              <Group align="flex-start">
                                <Avatar size={40} radius="xl" color="grape">
                                  {getInitials(member.full_name)}
                                </Avatar>
                                <Stack gap={4}>
                                  <Group gap="xs">
                                    <Text fw={500}>{member.full_name || member.email || 'Unknown'}</Text>
                                    {isCurrentUser && (
                                      <Badge size="xs" color="grape">
                                        You
                                      </Badge>
                                    )}
                                  </Group>
                                  <Text size="xs" c="dimmed">
                                    Joined {new Date(member.joined_at).toLocaleDateString()}
                                  </Text>
                                  {/* Show RBAC roles if available */}
                                  {member.roles && Array.isArray(member.roles) && member.roles.length > 0 && (
                                    <Group gap={4} mt={4}>
                                      {member.roles.map((role: any) => (
                                        <Tooltip key={role.id} label={role.description || role.display_name}>
                                          <Badge
                                            size="xs"
                                            variant="dot"
                                            color={role.name === 'org_admin' ? 'grape' : 'blue'}
                                          >
                                            {role.display_name}
                                          </Badge>
                                        </Tooltip>
                                      ))}
                                    </Group>
                                  )}
                                </Stack>
                              </Group>
                              <Group gap="xs">
                                <Badge
                                  color={member.role === 'admin' ? 'grape' : 'gray'}
                                  variant="light"
                                >
                                  {member.role === 'admin' ? 'Admin' : 'Contributor'}
                                </Badge>
                                {canManageTeam && !isCurrentUser && (
                                  <>
                                    <Tooltip label="Manage roles">
                                      <ActionIcon
                                        variant="light"
                                        color="blue"
                                        onClick={() => {
                                          setChangeRoleModal({
                                            open: true,
                                            memberId: member.id,
                                            userId: member.user_id,
                                            name: member.full_name || member.email,
                                            currentRoles: member.roles || [],
                                          });
                                          setNewRole(member.role === 'admin' ? 'contributor' : 'admin');
                                          // Set selected roles for RBAC
                                          if (member.roles && Array.isArray(member.roles)) {
                                            setSelectedRoles(member.roles.map((r: any) => r.id));
                                          } else {
                                            setSelectedRoles([]);
                                          }
                                        }}
                                      >
                                        <IconUserEdit size={16} />
                                      </ActionIcon>
                                    </Tooltip>
                                    <ActionIcon
                                      variant="light"
                                      color="red"
                                      onClick={() =>
                                        setRemoveModal({
                                          open: true,
                                          memberId: member.id,
                                          name: member.full_name || member.email,
                                        })
                                      }
                                    >
                                      <IconTrash size={16} />
                                    </ActionIcon>
                                  </>
                                )}
                              </Group>
                            </Group>
                          </Paper>
                        );
                      })}
                    </Stack>
                  )}
                </Stack>
              </Paper>
            </Stack>

            {/* Right Column - Help */}
            <Stack gap="lg">
              {/* Team Performance Link */}
              <Paper p="md" withBorder bg="var(--mantine-color-blue-0)">
                <Stack gap="sm">
                  <Group>
                    <IconChartBar size={24} color="var(--mantine-color-blue-6)" />
                    <Title order={4}>Team Performance</Title>
                  </Group>
                  <Text size="sm">
                    Track individual contributor metrics, submission rates, success rates, and team leaderboard.
                  </Text>
                  <Button
                    variant="light"
                    color="blue"
                    fullWidth
                    leftSection={<IconChartBar size={16} />}
                    onClick={() => navigate('/settings/team/performance')}
                  >
                    View Performance Dashboard
                  </Button>
                </Stack>
              </Paper>

              <Paper p="md" withBorder bg="var(--mantine-color-grape-0)">
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Title order={4}>About Roles</Title>
                    <Button
                      variant="subtle"
                      size="xs"
                      leftSection={<IconShieldCheck size={14} />}
                      onClick={() => navigate('/settings/roles')}
                    >
                      Manage Roles
                    </Button>
                  </Group>
                  <Text size="sm" fw={600}>
                    Legacy Roles (Admin / Contributor)
                  </Text>
                  <Text size="sm">
                    The system now uses granular RBAC roles for fine-grained permissions. Legacy roles
                    are mapped to RBAC roles automatically.
                  </Text>
                  <Text size="sm" fw={600} mt="xs">
                    RBAC System
                  </Text>
                  <Text size="sm">
                    Users can have multiple roles (e.g., Grant Creator, Task Manager) for precise
                    permission control. Visit Role Management to create custom roles.
                  </Text>
                </Stack>
              </Paper>

              {!isAdmin && (
                <Paper p="md" withBorder bg="var(--mantine-color-orange-0)">
                  <Stack gap="sm">
                    <Title order={4}>View Only Access</Title>
                    <Text size="sm">
                      You're viewing the team as a <strong>Contributor</strong>. Only admins can
                      invite or remove members.
                    </Text>
                  </Stack>
                </Paper>
              )}
            </Stack>
          </SimpleGrid>
        </Stack>

        {/* Remove Member Modal */}
        <Modal
          opened={removeModal.open}
          onClose={() => setRemoveModal({ open: false })}
          title="Remove Team Member"
        >
          <Stack gap="md">
            <Text>
              Are you sure you want to remove <strong>{removeModal.name}</strong> from your
              organization? They will lose access immediately.
            </Text>
            <Group justify="flex-end">
              <Button variant="light" onClick={() => setRemoveModal({ open: false })}>
                Cancel
              </Button>
              <Button
                color="red"
                loading={removeMutation.isPending}
                onClick={() => removeModal.memberId && removeMutation.mutate(removeModal.memberId)}
              >
                Remove Member
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* Change Role Modal */}
        <Modal
          opened={changeRoleModal.open}
          onClose={() => setChangeRoleModal({ open: false })}
          title="Change Member Roles"
          size="md"
        >
          <Stack gap="md">
            <Text>
              Manage roles for <strong>{changeRoleModal.name}</strong>
            </Text>

            {/* Legacy role selector */}
            <Select
              label="Legacy Role"
              value={newRole}
              onChange={(value) => value && setNewRole(value)}
              data={LEGACY_ROLES}
              description="For backward compatibility. This will sync with RBAC roles."
            />

            <Divider label="RBAC Roles" labelPosition="center" />

            {/* RBAC multi-role selector */}
            <MultiSelect
              label="Assign Roles"
              placeholder="Select roles"
              data={
                availableRoles?.map((role) => ({
                  value: role.id,
                  label: role.display_name,
                  group: role.is_system_role ? 'System Roles' : 'Custom Roles',
                })) || []
              }
              value={selectedRoles}
              onChange={setSelectedRoles}
              searchable
              description="Users can have multiple roles for fine-grained permissions"
            />

            {/* Show current roles */}
            {changeRoleModal.currentRoles && changeRoleModal.currentRoles.length > 0 && (
              <Paper p="sm" bg="var(--mantine-color-gray-0)">
                <Text size="sm" fw={500} mb="xs">
                  Current Roles:
                </Text>
                <Group gap="xs">
                  {changeRoleModal.currentRoles.map((role: any) => (
                    <Badge key={role.id} variant="light" leftSection={<IconShieldCheck size={12} />}>
                      {role.display_name}
                    </Badge>
                  ))}
                </Group>
              </Paper>
            )}

            <Group justify="flex-end">
              <Button variant="light" onClick={() => setChangeRoleModal({ open: false })}>
                Cancel
              </Button>
              <Button
                loading={changeRoleMutation.isPending}
                onClick={async () => {
                  if (!changeRoleModal.memberId || !changeRoleModal.userId || !currentOrg || !user) return;

                  try {
                    // Update legacy role
                    await changeRoleMutation.mutateAsync({
                      memberId: changeRoleModal.memberId,
                      role: newRole
                    });

                    // Update RBAC roles if changed
                    if (changeRoleModal.currentRoles) {
                      const currentRoleIds = changeRoleModal.currentRoles.map((r: any) => r.id);
                      const rolesToAdd = selectedRoles.filter(id => !currentRoleIds.includes(id));
                      const rolesToRemove = currentRoleIds.filter(id => !selectedRoles.includes(id));

                      // Add new roles
                      for (const roleId of rolesToAdd) {
                        await assignRoleToUser(changeRoleModal.userId, roleId, currentOrg.id, user.id);
                      }

                      // Remove old roles
                      for (const roleId of rolesToRemove) {
                        await removeRoleFromUser(changeRoleModal.userId, roleId, currentOrg.id);
                      }

                      // Refresh team members
                      queryClient.invalidateQueries({ queryKey: ['teamMembers'] });
                    }

                    notifications.show({
                      title: 'Roles updated',
                      message: 'Member roles have been updated successfully',
                      color: 'green',
                    });

                    setChangeRoleModal({ open: false });
                  } catch (error: any) {
                    notifications.show({
                      title: 'Error',
                      message: error.message || 'Failed to update roles',
                      color: 'red',
                    });
                  }
                }}
              >
                Update Roles
              </Button>
            </Group>
          </Stack>
        </Modal>
      </SettingsLayout>
    </ProtectedRoute>
  );
}
