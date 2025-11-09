import { useState } from 'react';
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
  Table,
  Badge,
  ActionIcon,
  SimpleGrid,
  Modal,
  Avatar,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconTrash, IconRefresh, IconX, IconUserEdit } from '@tabler/icons-react';
import { SettingsLayout } from '../../components/SettingsLayout';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useAuth } from '../../contexts/AuthContext';
import { usePermission } from '../../hooks/usePermission';
import { supabase } from '../../lib/supabase';

const ROLES = [
  { value: 'contributor', label: 'Contributor' },
  { value: 'admin', label: 'Admin' },
];

export function TeamPage() {
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  const { hasPermission, isAdmin } = usePermission();
  const queryClient = useQueryClient();

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('contributor');

  // Modal states
  const [removeModal, setRemoveModal] = useState<{ open: boolean; memberId?: string; name?: string }>({ open: false });
  const [changeRoleModal, setChangeRoleModal] = useState<{ open: boolean; memberId?: string; name?: string; currentRole?: string }>({ open: false });
  const [newRole, setNewRole] = useState<string>('contributor');

  const canManageTeam = hasPermission('manage_team');

  // Load team members
  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['teamMembers', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];

      const { data, error } = await supabase
        .from('org_members')
        .select(`
          id,
          role,
          joined_at,
          user_id,
          user_profiles (
            id,
            full_name,
            avatar_url
          )
        `)
        .eq('org_id', currentOrg.id);

      if (error) throw error;

      // Also get user emails from auth.users (need to use a function for this)
      // For now, we'll use the user_id to fetch from auth
      return data || [];
    },
    enabled: !!currentOrg,
  });

  // Load pending invitations
  const { data: invitations, isLoading: invitationsLoading } = useQuery({
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

      const { error } = await supabase.from('team_invitations').insert({
        org_id: currentOrg.id,
        email: inviteEmail,
        role: inviteRole,
        invited_by: user.id,
      });

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
      const { error } = await supabase
        .from('team_invitations')
        .update({ revoked_at: new Date().toISOString() })
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
      const { error } = await supabase.from('org_members').update({ role }).eq('id', memberId);

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
                      data={ROLES}
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
                      {invitations.map((invitation: any) => (
                        <Paper key={invitation.id} p="sm" withBorder>
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
                                color="red"
                                onClick={() => revokeMutation.mutate(invitation.id)}
                              >
                                <IconX size={16} />
                              </ActionIcon>
                            </Group>
                          </Group>
                        </Paper>
                      ))}
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
                        const profile = member.user_profiles;
                        const isCurrentUser = member.user_id === user?.id;

                        return (
                          <Paper key={member.id} p="sm" withBorder>
                            <Group justify="space-between">
                              <Group>
                                <Avatar size={40} radius="xl" color="grape">
                                  {getInitials(profile?.full_name)}
                                </Avatar>
                                <Stack gap={0}>
                                  <Group gap="xs">
                                    <Text fw={500}>{profile?.full_name || 'Unknown'}</Text>
                                    {isCurrentUser && (
                                      <Badge size="xs" color="grape">
                                        You
                                      </Badge>
                                    )}
                                  </Group>
                                  <Text size="xs" c="dimmed">
                                    Joined {new Date(member.joined_at).toLocaleDateString()}
                                  </Text>
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
                                    <ActionIcon
                                      variant="light"
                                      color="blue"
                                      onClick={() => {
                                        setChangeRoleModal({
                                          open: true,
                                          memberId: member.id,
                                          name: profile?.full_name,
                                          currentRole: member.role,
                                        });
                                        setNewRole(member.role === 'admin' ? 'contributor' : 'admin');
                                      }}
                                    >
                                      <IconUserEdit size={16} />
                                    </ActionIcon>
                                    <ActionIcon
                                      variant="light"
                                      color="red"
                                      onClick={() =>
                                        setRemoveModal({
                                          open: true,
                                          memberId: member.id,
                                          name: profile?.full_name,
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
              <Paper p="md" withBorder bg="var(--mantine-color-grape-0)">
                <Stack gap="sm">
                  <Title order={4}>About Roles</Title>
                  <Text size="sm" fw={600}>
                    Admin
                  </Text>
                  <Text size="sm">
                    Can manage billing, integrations, team members, and all organization settings.
                  </Text>
                  <Text size="sm" fw={600} mt="xs">
                    Contributor
                  </Text>
                  <Text size="sm">
                    Can create and edit grants, tasks, and view organization data. Cannot manage
                    team or billing.
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
          title="Change Member Role"
        >
          <Stack gap="md">
            <Text>
              Change the role for <strong>{changeRoleModal.name}</strong>?
            </Text>
            <Select label="New Role" value={newRole} onChange={(value) => value && setNewRole(value)} data={ROLES} />
            <Group justify="flex-end">
              <Button variant="light" onClick={() => setChangeRoleModal({ open: false })}>
                Cancel
              </Button>
              <Button
                loading={changeRoleMutation.isPending}
                onClick={() =>
                  changeRoleModal.memberId &&
                  changeRoleMutation.mutate({ memberId: changeRoleModal.memberId, role: newRole })
                }
              >
                Change Role
              </Button>
            </Group>
          </Stack>
        </Modal>
      </SettingsLayout>
    </ProtectedRoute>
  );
}
