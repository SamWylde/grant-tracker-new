import { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Text,
  Tabs,
  Loader,
  Center,
  Stack,
} from '@mantine/core';
import {
  IconUser,
  IconBuilding,
  IconUsers,
  IconBell,
  IconBellRinging,
  IconCalendar,
  IconCreditCard,
  IconShieldLock,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { AppHeader } from './AppHeader';
import { NoOrganization } from './NoOrganization';
import { useOrganization } from '../contexts/OrganizationContext';
import { usePermission } from '../hooks/usePermission';

interface SettingsLayoutProps {
  children: ReactNode;
}

export function SettingsLayout({ children }: SettingsLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const { currentOrg, loading } = useOrganization();
  const { isPlatformAdmin } = usePermission();

  const tabs = [
    {
      value: 'profile',
      path: '/settings/profile',
      label: 'Profile',
      icon: IconUser,
    },
    {
      value: 'org',
      path: '/settings/org',
      label: 'Organization',
      icon: IconBuilding,
    },
    {
      value: 'team',
      path: '/settings/team',
      label: 'Team',
      icon: IconUsers,
    },
    {
      value: 'notifications',
      path: '/settings/notifications',
      label: 'Notifications',
      icon: IconBell,
    },
    {
      value: 'alerts',
      path: '/settings/alerts',
      label: 'Alerts',
      icon: IconBellRinging,
    },
    {
      value: 'calendar',
      path: '/settings/calendar',
      label: 'Calendar & Integrations',
      icon: IconCalendar,
    },
    {
      value: 'billing',
      path: '/settings/billing',
      label: 'Billing',
      icon: IconCreditCard,
    },
    {
      value: 'admin',
      path: '/settings/admin',
      label: 'Admin',
      icon: IconShieldLock,
      adminOnly: true,
    },
    {
      value: 'danger',
      path: '/settings/danger',
      label: 'Danger Zone',
      icon: IconAlertTriangle,
    },
  ];

  // Filter tabs - only show admin tab if user is platform admin
  const visibleTabs = tabs.filter(tab => !tab.adminOnly || isPlatformAdmin);

  const activeTab = tabs.find((tab) => currentPath === tab.path)?.value || 'profile';

  return (
    <Box bg="var(--mantine-color-gray-0)" mih="100vh">
      {/* Header */}
      <AppHeader subtitle="Settings" />

      {/* Show loading state */}
      {loading && (
        <Container size="xl" py="xl">
          <Center h={400}>
            <Stack align="center" gap="md">
              <Loader size="lg" />
              <Text c="dimmed">Loading...</Text>
            </Stack>
          </Center>
        </Container>
      )}

      {/* Show no organization state */}
      {!loading && !currentOrg && (
        <Container size="xl" py="xl">
          <NoOrganization />
        </Container>
      )}

      {/* Show normal content when org exists */}
      {!loading && currentOrg && (
        <>
          {/* Tab Navigation */}
          <Box bg="white" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
            <Container size="xl">
              <Tabs value={activeTab} variant="outline">
                <Tabs.List>
                  {visibleTabs.map((tab) => (
                    <Tabs.Tab
                      key={tab.value}
                      value={tab.value}
                      onClick={() => navigate(tab.path)}
                      leftSection={<tab.icon size={16} />}
                    >
                      <Text size="sm" visibleFrom="sm">
                        {tab.label}
                      </Text>
                    </Tabs.Tab>
                  ))}
                </Tabs.List>
              </Tabs>
            </Container>
          </Box>

          {/* Main Content */}
          <Container size="xl" py="xl">
            {children}
          </Container>
        </>
      )}
    </Box>
  );
}
