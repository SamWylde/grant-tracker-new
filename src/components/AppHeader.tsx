import { useState } from 'react';
import { Anchor, Box, Burger, Container, Drawer, Group, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconRocket } from '@tabler/icons-react';
import { Link, useLocation } from 'react-router-dom';
import { OrgSwitcher } from './OrgSwitcher';
import { UserMenu } from './UserMenu';
import { MentionBell } from './MentionBell';
import { useAuth } from '../contexts/AuthContext';
import { useOrganization } from '../contexts/OrganizationContext';

interface AppHeaderProps {
  subtitle?: string;
}

export function AppHeader({ subtitle }: AppHeaderProps) {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const location = useLocation();
  const [mobileMenuOpened, setMobileMenuOpened] = useState(false);

  const isActive = (path: string) => location.pathname === path;

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
        <Group justify="space-between" wrap="nowrap">
          {/* Logo/Branding */}
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Group gap={6}>
              <ThemeIcon variant="light" color="grape" size={38} radius="xl">
                <IconRocket size={20} />
              </ThemeIcon>
              <Stack gap={0}>
                <Text fw={700}>GrantCue</Text>
                {subtitle && (
                  <Text size="xs" c="dimmed">
                    {subtitle}
                  </Text>
                )}
              </Stack>
            </Group>
          </Link>

          {/* Desktop Navigation Links - centered */}
          {user && (
            <Group gap="lg" visibleFrom="md" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
              <Anchor
                component={Link}
                to="/discover"
                c={isActive('/discover') ? 'grape' : 'dark'}
                fw={isActive('/discover') ? 600 : 400}
                underline="never"
              >
                Discover
              </Anchor>
              <Anchor
                component={Link}
                to="/saved"
                c={isActive('/saved') ? 'grape' : 'dark'}
                fw={isActive('/saved') ? 600 : 400}
                underline="never"
              >
                Saved
              </Anchor>
              <Anchor
                component={Link}
                to="/pipeline"
                c={isActive('/pipeline') ? 'grape' : 'dark'}
                fw={isActive('/pipeline') ? 600 : 400}
                underline="never"
              >
                Pipeline
              </Anchor>
              <Anchor
                component={Link}
                to="/metrics"
                c={isActive('/metrics') ? 'grape' : 'dark'}
                fw={isActive('/metrics') ? 600 : 400}
                underline="never"
              >
                Metrics
              </Anchor>
              <Anchor
                component={Link}
                to="/settings/profile"
                c={isActive('/settings/profile') || location.pathname.startsWith('/settings') ? 'grape' : 'dark'}
                fw={isActive('/settings/profile') || location.pathname.startsWith('/settings') ? 600 : 400}
                underline="never"
              >
                Settings
              </Anchor>
            </Group>
          )}

          {/* Right side - Desktop: Org + User, Mobile: Burger */}
          {user && (
            <>
              {/* Desktop: OrgSwitcher + MentionBell + UserMenu */}
              <Group gap="md" visibleFrom="md">
                <OrgSwitcher />
                <MentionBell orgId={currentOrg?.id} />
                <UserMenu />
              </Group>

              {/* Mobile: Burger Button */}
              <Burger
                opened={mobileMenuOpened}
                onClick={() => setMobileMenuOpened(!mobileMenuOpened)}
                hiddenFrom="md"
                size="sm"
              />
            </>
          )}
        </Group>

        {/* Mobile Navigation Drawer */}
        {user && (
          <Drawer
            opened={mobileMenuOpened}
            onClose={() => setMobileMenuOpened(false)}
            size="xs"
            padding="md"
            title="Menu"
            position="right"
          >
            <Stack gap="lg">
              <Anchor
                component={Link}
                to="/discover"
                c={isActive('/discover') ? 'grape' : 'dark'}
                fw={isActive('/discover') ? 600 : 400}
                underline="never"
                onClick={() => setMobileMenuOpened(false)}
              >
                Discover Grants
              </Anchor>
              <Anchor
                component={Link}
                to="/saved"
                c={isActive('/saved') ? 'grape' : 'dark'}
                fw={isActive('/saved') ? 600 : 400}
                underline="never"
                onClick={() => setMobileMenuOpened(false)}
              >
                Saved Grants
              </Anchor>
              <Anchor
                component={Link}
                to="/pipeline"
                c={isActive('/pipeline') ? 'grape' : 'dark'}
                fw={isActive('/pipeline') ? 600 : 400}
                underline="never"
                onClick={() => setMobileMenuOpened(false)}
              >
                Pipeline
              </Anchor>
              <Anchor
                component={Link}
                to="/metrics"
                c={isActive('/metrics') ? 'grape' : 'dark'}
                fw={isActive('/metrics') ? 600 : 400}
                underline="never"
                onClick={() => setMobileMenuOpened(false)}
              >
                Value Metrics
              </Anchor>
              <Anchor
                component={Link}
                to="/settings/profile"
                c={location.pathname.startsWith('/settings') ? 'grape' : 'dark'}
                fw={location.pathname.startsWith('/settings') ? 600 : 400}
                underline="never"
                onClick={() => setMobileMenuOpened(false)}
              >
                Settings
              </Anchor>
            </Stack>
          </Drawer>
        )}
      </Container>
    </Box>
  );
}
