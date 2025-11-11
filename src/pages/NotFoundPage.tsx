import { Container, Title, Text, Button, Group, Stack, Box, ThemeIcon } from '@mantine/core';
import { Link } from 'react-router-dom';
import { IconHome, IconSearch, IconArrowLeft, IconAlertCircle } from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';

export function NotFoundPage() {
  const { user } = useAuth();

  return (
    <Box
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Container size="sm">
        <Stack gap="xl" align="center">
          <ThemeIcon
            size={120}
            radius="xl"
            variant="light"
            color="white"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
          >
            <IconAlertCircle size={60} color="white" />
          </ThemeIcon>

          <Stack gap="sm" align="center">
            <Title
              order={1}
              size={72}
              fw={900}
              style={{ color: 'white', lineHeight: 1 }}
            >
              404
            </Title>
            <Title order={2} size={32} fw={600} c="white" ta="center">
              Page Not Found
            </Title>
            <Text size="lg" c="white" ta="center" opacity={0.9} maw={500}>
              Sorry, we couldn't find the page you're looking for. It may have been moved,
              deleted, or the URL might be incorrect.
            </Text>
          </Stack>

          <Group gap="md" mt="md">
            <Button
              component={Link}
              to={user ? '/saved' : '/'}
              size="lg"
              color="white"
              variant="filled"
              leftSection={<IconHome size={20} />}
              styles={{
                root: {
                  color: '#667eea',
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.9)' },
                },
              }}
            >
              {user ? 'Go to Dashboard' : 'Go to Homepage'}
            </Button>

            {user && (
              <Button
                component={Link}
                to="/discover"
                size="lg"
                variant="outline"
                color="white"
                leftSection={<IconSearch size={20} />}
              >
                Discover Grants
              </Button>
            )}
          </Group>

          {!user && (
            <Group gap="sm" mt="lg">
              <Text size="sm" c="white" opacity={0.8}>
                Looking for grant opportunities?
              </Text>
              <Button
                component={Link}
                to="/signup"
                size="sm"
                variant="light"
                color="white"
                rightSection={<IconArrowLeft size={16} />}
              >
                Sign up free
              </Button>
            </Group>
          )}

          <Stack gap="xs" mt="xl" align="center">
            <Text size="sm" c="white" opacity={0.7}>
              Quick links:
            </Text>
            <Group gap="md">
              <Text
                component={Link}
                to="/features"
                size="sm"
                c="white"
                style={{ textDecoration: 'underline', cursor: 'pointer' }}
              >
                Features
              </Text>
              <Text
                component={Link}
                to="/pricing"
                size="sm"
                c="white"
                style={{ textDecoration: 'underline', cursor: 'pointer' }}
              >
                Pricing
              </Text>
              {user ? (
                <Text
                  component={Link}
                  to="/pipeline"
                  size="sm"
                  c="white"
                  style={{ textDecoration: 'underline', cursor: 'pointer' }}
                >
                  Pipeline
                </Text>
              ) : (
                <Text
                  component={Link}
                  to="/signin"
                  size="sm"
                  c="white"
                  style={{ textDecoration: 'underline', cursor: 'pointer' }}
                >
                  Sign In
                </Text>
              )}
            </Group>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
