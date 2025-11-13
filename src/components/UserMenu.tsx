import { useState } from 'react';
import { Menu, Avatar, Text, Divider, Group, Stack, Modal, TextInput, Button } from '@mantine/core';
import {
  IconUser,
  IconSettings,
  IconLogout,
  IconChevronDown,
  IconPlus,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useOrganization } from '../contexts/OrganizationContext';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { notifications } from '@mantine/notifications';

export function UserMenu() {
  const { user, signOut } = useAuth();
  const { currentOrg, userOrgs, switchOrg, refreshOrgs } = useOrganization();
  const navigate = useNavigate();
  const [createModalOpened, setCreateModalOpened] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');

  // Load user profile for full name
  const { data: profile } = useQuery({
    queryKey: ['userProfile', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user,
  });

  if (!user) {
    return null;
  }

  const displayName = (profile as any)?.full_name || user.email?.split('@')[0] || 'User';
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Create organization mutation
  const createOrgMutation = useMutation({
    mutationFn: async (orgName: string) => {
      if (!user) throw new Error('User not authenticated');

      // Create the organization
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .insert({ name: orgName } as any)
        .select()
        .single();

      if (orgError) throw orgError;
      if (!orgData) throw new Error('Failed to create organization');

      const org = orgData as any;

      // Add the user as admin
      const { error: memberError } = await supabase
        .from('org_members')
        .insert({
          org_id: org.id,
          user_id: user.id,
          role: 'admin',
        } as any);

      if (memberError) throw memberError;

      return org;
    },
    onSuccess: async (org) => {
      await refreshOrgs();
      switchOrg(org.id);
      setCreateModalOpened(false);
      setNewOrgName('');
      notifications.show({
        title: 'Organization created',
        message: `${org.name} has been created successfully.`,
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to create organization',
        color: 'red',
      });
    },
  });

  const handleCreateOrg = () => {
    if (!newOrgName.trim()) {
      notifications.show({
        title: 'Validation Error',
        message: 'Organization name is required',
        color: 'red',
      });
      return;
    }
    createOrgMutation.mutate(newOrgName.trim());
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <Menu shadow="md" width={220}>
      <Menu.Target>
        <Group
          gap="xs"
          p="xs"
          style={{
            cursor: 'pointer',
            borderRadius: 'var(--mantine-radius-md)',
          }}
        >
          <Avatar size={32} radius="xl" color="grape">
            {initials}
          </Avatar>
          <Group gap={4} visibleFrom="sm">
            <Text size="sm" fw={500}>
              {displayName}
            </Text>
            <IconChevronDown size={14} />
          </Group>
        </Group>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>
          <Text size="xs" c="dimmed" truncate>
            {user.email}
          </Text>
        </Menu.Label>

        <Divider my="xs" />

        <Menu.Item
          leftSection={<IconUser size={16} />}
          onClick={() => navigate('/settings/profile')}
        >
          My Profile
        </Menu.Item>

        <Menu.Item
          leftSection={<IconSettings size={16} />}
          onClick={() => navigate('/settings/org')}
        >
          Settings
        </Menu.Item>

        <Divider my="xs" />

        {currentOrg && userOrgs && userOrgs.length > 0 && (
          <>
            <Menu.Label>Organization</Menu.Label>
            <Menu.Item
              leftSection={
                <Avatar size={20} radius="xl" color="grape">
                  {currentOrg.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)}
                </Avatar>
              }
              onClick={() => navigate('/settings/org')}
              style={{
                pointerEvents: userOrgs.length === 1 ? 'none' : 'auto',
              }}
            >
              <Stack gap={0}>
                <Text size="sm" fw={500} lineClamp={1}>
                  {currentOrg.name}
                </Text>
                {userOrgs.length > 1 && (
                  <Text size="xs" c="dimmed">
                    Switch organization
                  </Text>
                )}
              </Stack>
            </Menu.Item>

            {userOrgs.length > 1 && userOrgs.filter(org => org.id !== currentOrg.id).map((org) => (
              <Menu.Item
                key={org.id}
                onClick={() => switchOrg(org.id)}
                leftSection={
                  <Avatar size={20} radius="xl" color="grape">
                    {org.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)}
                  </Avatar>
                }
                pl="xl"
              >
                {org.name}
              </Menu.Item>
            ))}

            <Menu.Item
              leftSection={<IconPlus size={16} />}
              onClick={() => setCreateModalOpened(true)}
            >
              Create New Organization
            </Menu.Item>

            <Divider my="xs" />
          </>
        )}

        <Menu.Item
          color="red"
          leftSection={<IconLogout size={16} />}
          onClick={handleSignOut}
        >
          Sign Out
        </Menu.Item>
      </Menu.Dropdown>

      {/* Create Organization Modal */}
      <Modal
        opened={createModalOpened}
        onClose={() => {
          setCreateModalOpened(false);
          setNewOrgName('');
        }}
        title="Create New Organization"
      >
        <Stack gap="md">
          <Text size="sm">
            Create a new organization to manage grants separately. You will be the admin of this organization.
          </Text>
          <TextInput
            label="Organization Name"
            placeholder="Enter organization name"
            value={newOrgName}
            onChange={(e) => setNewOrgName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newOrgName.trim()) {
                handleCreateOrg();
              }
            }}
            required
            autoFocus
          />
          <Group justify="flex-end" mt="md">
            <Button
              variant="subtle"
              onClick={() => {
                setCreateModalOpened(false);
                setNewOrgName('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateOrg}
              loading={createOrgMutation.isPending}
              disabled={!newOrgName.trim()}
            >
              Create Organization
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Menu>
  );
}
