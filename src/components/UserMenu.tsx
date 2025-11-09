import { Menu, Avatar, Text, Divider, Group } from '@mantine/core';
import {
  IconUser,
  IconSettings,
  IconLogout,
  IconChevronDown,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export function UserMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

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

  const displayName = profile?.full_name || user.email?.split('@')[0] || 'User';
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

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

        <Menu.Item
          color="red"
          leftSection={<IconLogout size={16} />}
          onClick={handleSignOut}
        >
          Sign Out
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
