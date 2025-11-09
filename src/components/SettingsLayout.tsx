import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Box,
  Container,
  Text,
  Tabs,
} from '@mantine/core';
import {
  IconUser,
  IconBuilding,
  IconUsers,
  IconBell,
  IconCalendar,
  IconCreditCard,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { AppHeader } from './AppHeader';

interface SettingsLayoutProps {
  children: ReactNode;
}

export function SettingsLayout({ children }: SettingsLayoutProps) {
  const location = useLocation();
  const currentPath = location.pathname;

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
      value: 'danger',
      path: '/settings/danger',
      label: 'Danger Zone',
      icon: IconAlertTriangle,
    },
  ];

  const activeTab = tabs.find((tab) => currentPath === tab.path)?.value || 'profile';

  return (
    <Box bg="var(--mantine-color-gray-0)" mih="100vh">
      {/* Header */}
      <AppHeader subtitle="Settings" />

      {/* Tab Navigation */}
      <Box bg="white" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
        <Container size="xl">
          <Tabs value={activeTab} variant="outline">
            <Tabs.List>
              {tabs.map((tab) => (
                <Tabs.Tab
                  key={tab.value}
                  value={tab.value}
                  component={Link}
                  to={tab.path}
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
    </Box>
  );
}
