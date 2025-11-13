import { useState } from 'react';
import { Anchor, Box, Burger, Container, Drawer, Group, Stack, Text, ThemeIcon, Divider, Button, Avatar } from '@mantine/core';
import { IconRocket, IconUser, IconSettings, IconLogout } from '@tabler/icons-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { UserMenu } from './UserMenu';
import { MentionBell } from './MentionBell';
import { useAuth } from '../contexts/AuthContext';
import { useOrganization } from '../contexts/OrganizationContext';

interface AppHeaderProps {
  subtitle?: string;
}

export function AppHeader({ subtitle }: AppHeaderProps) {
  const { user, signOut } = useAuth();
  const { currentOrg, userOrgs, switchOrg } = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpened, setMobileMenuOpened] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const handleMobileSignOut = async () => {
    setMobileMenuOpened(false);
    await signOut();
    navigate('/');
  };

  const getOrgInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

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
                to="/activity"
                c={isActive('/activity') ? 'grape' : 'dark'}
                fw={isActive('/activity') ? 600 : 400}
                underline="never"
              >
                Activity
              </Anchor>
            </Group>
          )}

          {/* Right side - Desktop: Bell + User, Mobile: Burger */}
          {user && (
            <>
              {/* Desktop: MentionBell + UserMenu */}
              <Group gap="md" visibleFrom="md">
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
            <Stack gap="md">
              {/* Navigation Links */}
              <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                Navigation
              </Text>
              <Stack gap="sm">
                <Anchor
                  component={Link}
                  to="/discover"
                  c={isActive('/discover') ? 'grape' : 'dark'}
                  fw={isActive('/discover') ? 600 : 400}
                  underline="never"
                  onClick={() => setMobileMenuOpened(false)}
                >
                  Discover
                </Anchor>
                <Anchor
                  component={Link}
                  to="/saved"
                  c={isActive('/saved') ? 'grape' : 'dark'}
                  fw={isActive('/saved') ? 600 : 400}
                  underline="never"
                  onClick={() => setMobileMenuOpened(false)}
                >
                  Saved
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
                  Metrics
                </Anchor>
                <Anchor
                  component={Link}
                  to="/activity"
                  c={isActive('/activity') ? 'grape' : 'dark'}
                  fw={isActive('/activity') ? 600 : 400}
                  underline="never"
                  onClick={() => setMobileMenuOpened(false)}
                >
                  Activity
                </Anchor>
              </Stack>

              <Divider />

              {/* User & Organization Section */}
              <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                Account
              </Text>
              <Stack gap="sm">
                <Anchor
                  component={Link}
                  to="/settings/profile"
                  c="dark"
                  underline="never"
                  onClick={() => setMobileMenuOpened(false)}
                >
                  <Group gap="xs">
                    <IconUser size={16} />
                    <Text size="sm">My Profile</Text>
                  </Group>
                </Anchor>
                <Anchor
                  component={Link}
                  to="/settings/org"
                  c="dark"
                  underline="never"
                  onClick={() => setMobileMenuOpened(false)}
                >
                  <Group gap="xs">
                    <IconSettings size={16} />
                    <Text size="sm">Settings</Text>
                  </Group>
                </Anchor>
              </Stack>

              {/* Organization Switcher */}
              {currentOrg && userOrgs && userOrgs.length > 0 && (
                <>
                  <Divider />
                  <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                    Organization
                  </Text>
                  <Stack gap="xs">
                    {userOrgs.map((org) => (
                      <Button
                        key={org.id}
                        variant={org.id === currentOrg.id ? "light" : "subtle"}
                        color={org.id === currentOrg.id ? "grape" : "gray"}
                        onClick={() => {
                          switchOrg(org.id);
                          setMobileMenuOpened(false);
                        }}
                        fullWidth
                        justify="flex-start"
                        leftSection={
                          <Avatar size={24} radius="xl" color="grape">
                            {getOrgInitials(org.name)}
                          </Avatar>
                        }
                      >
                        <Text size="sm" truncate>
                          {org.name}
                        </Text>
                      </Button>
                    ))}
                  </Stack>
                </>
              )}

              <Divider />

              {/* Sign Out */}
              <Button
                variant="subtle"
                color="red"
                onClick={handleMobileSignOut}
                fullWidth
                justify="flex-start"
                leftSection={<IconLogout size={16} />}
              >
                Sign Out
              </Button>
            </Stack>
          </Drawer>
        )}
      </Container>
    </Box>
  );
}
