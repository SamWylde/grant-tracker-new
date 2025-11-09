import { Menu, Button, Avatar, Text, Divider, Group, Stack } from '@mantine/core';
import { IconChevronDown, IconPlus } from '@tabler/icons-react';
import { useOrganization } from '../contexts/OrganizationContext';

export function OrgSwitcher() {
  const { currentOrg, userOrgs, switchOrg } = useOrganization();

  if (!currentOrg) {
    return null;
  }

  // If user only has 1 org, show org name without menu
  if (userOrgs.length === 1) {
    return (
      <Group gap="xs">
        <Avatar size={32} radius="xl" color="grape">
          {currentOrg.name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)}
        </Avatar>
        <Stack gap={0} visibleFrom="sm">
          <Text size="sm" fw={500} lineClamp={1}>
            {currentOrg.name}
          </Text>
        </Stack>
      </Group>
    );
  }

  // Show dropdown for multiple orgs
  return (
    <Menu shadow="md" width={250}>
      <Menu.Target>
        <Button variant="subtle" color="dark" rightSection={<IconChevronDown size={16} />}>
          <Group gap="xs">
            <Avatar size={28} radius="xl" color="grape">
              {currentOrg.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)}
            </Avatar>
            <Text size="sm" fw={500} visibleFrom="sm">
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
          onClick={() => {
            // TODO: Implement create new org
            alert('Create new organization feature coming soon!');
          }}
        >
          Create New Organization
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
