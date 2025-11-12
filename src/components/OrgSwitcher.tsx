import { useState } from 'react';
import { Menu, Button, Avatar, Text, Divider, Group, Stack, Modal, TextInput } from '@mantine/core';
import { IconChevronDown, IconPlus } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { useOrganization } from '../contexts/OrganizationContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export function OrgSwitcher() {
  const { currentOrg, userOrgs, switchOrg, refreshOrgs } = useOrganization();
  const { user } = useAuth();
  const [createModalOpened, setCreateModalOpened] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');

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

  if (!currentOrg) {
    return null;
  }

  // If user only has 1 org, show org name without menu
  if (userOrgs.length === 1) {
    return (
      <Group gap="xs" style={{ maxWidth: '200px' }} wrap="nowrap">
        <Avatar size={32} radius="xl" color="grape" style={{ flexShrink: 0 }}>
          {currentOrg.name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)}
        </Avatar>
        <Stack gap={0} visibleFrom="sm" style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
          <Text
            size="sm"
            fw={500}
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {currentOrg.name}
          </Text>
        </Stack>
      </Group>
    );
  }

  // Show dropdown for multiple orgs
  return (
    <>
    <Menu shadow="md" width={250}>
      <Menu.Target>
        <Button
          variant="subtle"
          color="dark"
          rightSection={<IconChevronDown size={16} />}
          styles={{ inner: { maxWidth: '200px' } }}
        >
          <Group gap="xs" wrap="nowrap" style={{ maxWidth: '100%', overflow: 'hidden' }}>
            <Avatar size={28} radius="xl" color="grape" style={{ flexShrink: 0 }}>
              {currentOrg.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)}
            </Avatar>
            <Text
              size="sm"
              fw={500}
              visibleFrom="sm"
              style={{
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1
              }}
            >
              {currentOrg.name}
            </Text>
          </Group>
        </Button>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>Switch Organization</Menu.Label>
        {userOrgs.map((org) => (
          <Menu.Item
            key={org.id}
            onClick={() => switchOrg(org.id)}
            leftSection={
              <Avatar size={24} radius="xl" color="grape">
                {org.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)}
              </Avatar>
            }
            bg={org.id === currentOrg.id ? 'var(--mantine-color-grape-0)' : undefined}
          >
            {org.name}
          </Menu.Item>
        ))}

        <Divider my="xs" />

        <Menu.Item
          leftSection={<IconPlus size={16} />}
          onClick={() => setCreateModalOpened(true)}
        >
          Create New Organization
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>

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
    </>
  );
}
