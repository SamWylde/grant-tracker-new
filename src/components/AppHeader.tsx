import { Box, Container, Group, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconRocket } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { OrgSwitcher } from './OrgSwitcher';
import { UserMenu } from './UserMenu';
import { useAuth } from '../contexts/AuthContext';

interface AppHeaderProps {
  subtitle?: string;
}

export function AppHeader({ subtitle }: AppHeaderProps) {
  const { user } = useAuth();

  return (
    <Box
      component="header"
      px="md"
      py="lg"
      bg="white"
      style={{
        borderBottom: '1px solid var(--mantine-color-gray-2)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      <Container size="xl">
        <Group justify="space-between">
          {/* Logo/Branding */}
          <Group gap={6} component={Link} to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <ThemeIcon variant="light" color="grape" size={38} radius="xl">
              <IconRocket size={20} />
            </ThemeIcon>
            <Stack gap={0}>
              <Text fw={700}>GrantTracker</Text>
              {subtitle && (
                <Text size="xs" c="dimmed">
                  {subtitle}
                </Text>
              )}
            </Stack>
          </Group>

          {/* Right side - Org Switcher + User Menu (only if logged in) */}
          {user && (
            <Group gap="md">
              <OrgSwitcher />
              <UserMenu />
            </Group>
          )}
        </Group>
      </Container>
    </Box>
  );
}
