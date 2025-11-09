import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Box, Container, Stack, Title, Text, Button, Paper, ThemeIcon } from '@mantine/core';
import { IconLock } from '@tabler/icons-react';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAuth?: boolean;
}

export function ProtectedRoute({ children, requireAuth = true }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Box bg="var(--mantine-color-gray-0)" mih="100vh" p="xl">
        <Container size="sm">
          <Text c="dimmed">Loading...</Text>
        </Container>
      </Box>
    );
  }

  if (requireAuth && !user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

interface AccessDeniedProps {
  title?: string;
  message?: string;
  action?: ReactNode;
}

export function AccessDenied({
  title = 'Access Denied',
  message = 'You don\'t have permission to access this page. Please contact your organization admin.',
  action,
}: AccessDeniedProps) {
  return (
    <Box bg="var(--mantine-color-gray-0)" mih="100vh" style={{ display: 'flex', alignItems: 'center' }}>
      <Container size="sm">
        <Paper p="xl" withBorder>
          <Stack gap="md" align="center">
            <ThemeIcon size={60} radius="xl" color="red" variant="light">
              <IconLock size={32} />
            </ThemeIcon>
            <Stack gap="xs" align="center">
              <Title order={2}>{title}</Title>
              <Text c="dimmed" ta="center">
                {message}
              </Text>
            </Stack>
            {action || (
              <Button component="a" href="/discover" variant="light">
                Go to Discover
              </Button>
            )}
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
