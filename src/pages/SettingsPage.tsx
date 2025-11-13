/**
 * SettingsPage
 * User account settings including 2FA management
 */

import { useState } from 'react';
import {
  Box,
  Container,
  Tabs,
  Title,
  Text,
  Stack,
} from '@mantine/core';
import {
  IconShieldCheck,
  IconUser,
  IconBell,
} from '@tabler/icons-react';
import { AppHeader } from '../components/AppHeader';
import { TwoFactorManagement } from '../components/2fa';

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<string | null>('security');

  return (
    <Box bg="var(--mantine-color-gray-0)" mih="100vh">
      <AppHeader subtitle="Account Settings" />

      <Container size="lg" py="xl">
        <Stack gap="lg">
          <Box>
            <Title order={2}>Settings</Title>
            <Text c="dimmed" size="sm" mt={4}>
              Manage your account settings and preferences
            </Text>
          </Box>

          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="security" leftSection={<IconShieldCheck size={16} />}>
                Security
              </Tabs.Tab>
              <Tabs.Tab value="profile" leftSection={<IconUser size={16} />}>
                Profile
              </Tabs.Tab>
              <Tabs.Tab value="notifications" leftSection={<IconBell size={16} />}>
                Notifications
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="security" pt="xl">
              <Stack gap="lg">
                <TwoFactorManagement />
                {/* Add other security settings here */}
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="profile" pt="xl">
              <Text c="dimmed">Profile settings coming soon...</Text>
            </Tabs.Panel>

            <Tabs.Panel value="notifications" pt="xl">
              <Text c="dimmed">Notification settings coming soon...</Text>
            </Tabs.Panel>
          </Tabs>
        </Stack>
      </Container>
    </Box>
  );
}
