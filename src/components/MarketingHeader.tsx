import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Anchor,
  Box,
  Burger,
  Button,
  Container,
  Divider,
  Drawer,
  Group,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { IconRocket } from '@tabler/icons-react';

interface NavLink {
  label: string;
  to: string;
}

interface MarketingHeaderProps {
  /**
   * Whether to show the backdrop blur effect (default: false)
   * When true, uses backdrop-filter instead of solid white background
   */
  blurred?: boolean;

  /**
   * Custom navigation links (default: Discover Grants, Features, Pricing)
   */
  navLinks?: NavLink[];

  /**
   * Current user (for user-aware navigation)
   */
  user?: { id: string } | null;

  /**
   * Custom action buttons for logged-out users
   * If not provided, defaults to Sign in / Get started buttons
   */
  loggedOutActions?: React.ReactNode;

  /**
   * Custom action buttons for logged-in users
   * If not provided, defaults to Dashboard button
   */
  loggedInActions?: React.ReactNode;
}

const DEFAULT_NAV_LINKS: NavLink[] = [
  { label: 'Discover Grants', to: '/discover' },
  { label: 'Features', to: '/features' },
  { label: 'Pricing', to: '/pricing' },
];

export function MarketingHeader({
  blurred = false,
  navLinks = DEFAULT_NAV_LINKS,
  user,
  loggedOutActions,
  loggedInActions,
}: MarketingHeaderProps) {
  const [mobileMenuOpened, setMobileMenuOpened] = useState(false);

  // Default actions if not provided
  const defaultLoggedOutActions = (
    <>
      <Button variant="light" color="grape" component={Link} to="/signin">
        Sign in
      </Button>
      <Button color="grape" component={Link} to="/signup">
        Get started
      </Button>
    </>
  );

  const defaultLoggedInActions = (
    <Button color="grape" component={Link} to="/saved">
      Dashboard
    </Button>
  );

  const renderActions = () => {
    if (user) {
      return loggedInActions || defaultLoggedInActions;
    }
    return loggedOutActions || defaultLoggedOutActions;
  };

  return (
    <Box
      component="header"
      px="md"
      py="lg"
      bg={blurred ? undefined : 'white'}
      style={{
        backdropFilter: blurred ? 'blur(18px)' : undefined,
        borderBottom: blurred ? undefined : '1px solid var(--mantine-color-gray-3)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      <Container size="lg">
        <Group justify="space-between">
          {/* Logo */}
          <Group gap={6}>
            <ThemeIcon variant="light" color="grape" size={38} radius="xl">
              <IconRocket size={20} />
            </ThemeIcon>
            <Stack gap={0}>
              <Text
                fw={700}
                component={Link}
                to="/"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                GrantCue
              </Text>
              <Text size="xs" c="dimmed">
                Funding visibility for every team
              </Text>
            </Stack>
          </Group>

          {/* Desktop Navigation */}
          <Group gap="sm" visibleFrom="sm">
            {navLinks.map((link) => (
              <Anchor key={link.to} size="sm" c="dark" component={Link} to={link.to}>
                {link.label}
              </Anchor>
            ))}
            {renderActions()}
          </Group>

          {/* Mobile Menu Button */}
          <Burger
            opened={mobileMenuOpened}
            onClick={() => setMobileMenuOpened(!mobileMenuOpened)}
            hiddenFrom="sm"
            size="sm"
          />
        </Group>

        {/* Mobile Navigation Drawer */}
        <Drawer
          opened={mobileMenuOpened}
          onClose={() => setMobileMenuOpened(false)}
          size="xs"
          padding="md"
          title="Menu"
          hiddenFrom="sm"
          position="right"
        >
          <Stack gap="lg">
            {navLinks.map((link) => (
              <Anchor
                key={link.to}
                component={Link}
                to={link.to}
                c="dark"
                onClick={() => setMobileMenuOpened(false)}
              >
                {link.label}
              </Anchor>
            ))}
            <Divider />
            <Stack gap="md">
              {user ? (
                <Button
                  color="grape"
                  component={Link}
                  to="/saved"
                  fullWidth
                  onClick={() => setMobileMenuOpened(false)}
                >
                  Dashboard
                </Button>
              ) : (
                <>
                  <Button
                    variant="light"
                    color="grape"
                    component={Link}
                    to="/signin"
                    fullWidth
                    onClick={() => setMobileMenuOpened(false)}
                  >
                    Sign in
                  </Button>
                  <Button
                    color="grape"
                    component={Link}
                    to="/signup"
                    fullWidth
                    onClick={() => setMobileMenuOpened(false)}
                  >
                    Get started
                  </Button>
                </>
              )}
            </Stack>
          </Stack>
        </Drawer>
      </Container>
    </Box>
  );
}
