import { useState } from 'react';
import { Anchor, Box, Burger, Container, Drawer, Group, Stack, Text, ThemeIcon, Divider, Button, Avatar } from '@mantine/core';
import { IconRocket, IconUser, IconSettings, IconLogout } from '@tabler/icons-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { UserMenu } from './UserMenu';
import { MentionBell } from './MentionBell';
import { DarkModeToggle } from './DarkModeToggle';
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
    <>
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        style={{
          position: 'absolute',
          left: '-9999px',
          zIndex: 999,
          padding: '1rem',
          backgroundColor: 'var(--mantine-color-grape-6)',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '4px',
        }}
        onFocus={(e) => {
          e.currentTarget.style.left = '1rem';
          e.currentTarget.style.top = '1rem';
        }}
        onBlur={(e) => {
          e.currentTarget.style.left = '-9999px';
        }}
      >
        Skip to main content
      </a>
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
            <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }} aria-label="GrantCue home">
              <Group gap={6}>
                <ThemeIcon variant="light" color="grape" size={38} radius="xl" aria-hidden="true">
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
              <Box component="nav" aria-label="Main navigation" visibleFrom="md" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
                <Group gap="lg">
                  <Anchor
                    component={Link}
                    to="/discover"
                    c={isActive('/discover') ? 'grape' : 'dark'}
                    fw={isActive('/discover') ? 600 : 400}
                    underline="never"
                    aria-current={isActive('/discover') ? 'page' : undefined}
                  >
                    Discover
                  </Anchor>
                  <Anchor
                    component={Link}
                    to="/pipeline"
                    c={isActive('/pipeline') ? 'grape' : 'dark'}
                    fw={isActive('/pipeline') ? 600 : 400}
                    underline="never"
                    aria-current={isActive('/pipeline') ? 'page' : undefined}
                  >
                    Pipeline
                  </Anchor>
                  <Anchor
                    component={Link}
                    to="/funders"
                    c={isActive('/funders') ? 'grape' : 'dark'}
                    fw={isActive('/funders') ? 600 : 400}
                    underline="never"
                    aria-current={isActive('/funders') ? 'page' : undefined}
                  >
                    Funders
                  </Anchor>
                  <Anchor
                    component={Link}
                    to="/metrics"
                    c={isActive('/metrics') ? 'grape' : 'dark'}
                    fw={isActive('/metrics') ? 600 : 400}
                    underline="never"
                    aria-current={isActive('/metrics') ? 'page' : undefined}
                  >
                    Metrics
                  </Anchor>
                  <Anchor
                    component={Link}
                    to="/analytics"
                    c={isActive('/analytics') ? 'grape' : 'dark'}
                    fw={isActive('/analytics') ? 600 : 400}
                    underline="never"
                    aria-current={isActive('/analytics') ? 'page' : undefined}
                  >
                    Analytics
                  </Anchor>
                  <Anchor
                    component={Link}
                    to="/activity"
                    c={isActive('/activity') ? 'grape' : 'dark'}
                    fw={isActive('/activity') ? 600 : 400}
                    underline="never"
                    aria-current={isActive('/activity') ? 'page' : undefined}
                  >
                    Activity
                  </Anchor>
                </Group>
              </Box>
            )}

            {/* Right side - Desktop: Dark Mode + Bell + User, Mobile: Burger */}
            {user ? (
              <>
                {/* Desktop: DarkModeToggle + MentionBell + UserMenu */}
                <Group gap="md" visibleFrom="md">
                  <DarkModeToggle />
                  <MentionBell orgId={currentOrg?.id} />
                  <UserMenu />
                </Group>

                {/* Mobile: Burger Button */}
                <Burger
                  opened={mobileMenuOpened}
                  onClick={() => setMobileMenuOpened(!mobileMenuOpened)}
                  hiddenFrom="md"
                  size="sm"
                  aria-label={mobileMenuOpened ? 'Close navigation menu' : 'Open navigation menu'}
                />
              </>
            ) : (
              <DarkModeToggle />
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
            aria-label="Mobile navigation menu"
          >
            <Stack gap="md" component="nav" aria-label="Mobile navigation">
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
                  aria-current={isActive('/discover') ? 'page' : undefined}
                >
                  Discover
                </Anchor>
                <Anchor
                  component={Link}
                  to="/pipeline"
                  c={isActive('/pipeline') ? 'grape' : 'dark'}
                  fw={isActive('/pipeline') ? 600 : 400}
                  underline="never"
                  onClick={() => setMobileMenuOpened(false)}
                  aria-current={isActive('/pipeline') ? 'page' : undefined}
                >
                  Pipeline
                </Anchor>
                <Anchor
                  component={Link}
                  to="/funders"
                  c={isActive('/funders') ? 'grape' : 'dark'}
                  fw={isActive('/funders') ? 600 : 400}
                  underline="never"
                  onClick={() => setMobileMenuOpened(false)}
                  aria-current={isActive('/funders') ? 'page' : undefined}
                >
                  Funders
                </Anchor>
                <Anchor
                  component={Link}
                  to="/metrics"
                  c={isActive('/metrics') ? 'grape' : 'dark'}
                  fw={isActive('/metrics') ? 600 : 400}
                  underline="never"
                  onClick={() => setMobileMenuOpened(false)}
                  aria-current={isActive('/metrics') ? 'page' : undefined}
                >
                  Metrics
                </Anchor>
                <Anchor
                  component={Link}
                  to="/analytics"
                  c={isActive('/analytics') ? 'grape' : 'dark'}
                  fw={isActive('/analytics') ? 600 : 400}
                  underline="never"
                  onClick={() => setMobileMenuOpened(false)}
                  aria-current={isActive('/analytics') ? 'page' : undefined}
                >
                  Analytics
                </Anchor>
                <Anchor
                  component={Link}
                  to="/activity"
                  c={isActive('/activity') ? 'grape' : 'dark'}
                  fw={isActive('/activity') ? 600 : 400}
                  underline="never"
                  onClick={() => setMobileMenuOpened(false)}
                  aria-current={isActive('/activity') ? 'page' : undefined}
                >
                  Activity
                </Anchor>
              </Stack>

              <Divider />

              {/* Dark Mode Toggle */}
              <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                Appearance
              </Text>
              <Group gap="xs" align="center">
                <DarkModeToggle size="lg" />
                <Text size="sm">Toggle dark mode</Text>
              </Group>

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
                    <IconUser size={16} aria-hidden="true" />
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
                    <IconSettings size={16} aria-hidden="true" />
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
                aria-label="Sign out of your account"
              >
                Sign Out
              </Button>
            </Stack>
          </Drawer>
        )}
      </Container>
    </Box>
    </>
  );
}
