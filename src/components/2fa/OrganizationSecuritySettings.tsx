/**
 * OrganizationSecuritySettings Component
 * Manage organization-level 2FA enforcement
 */

import { useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Progress,
  Stack,
  Switch,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconShieldCheck,
  IconAlertCircle,
  IconInfoCircle,
  IconCheck,
} from '@tabler/icons-react';
import { supabase } from '../../lib/supabase';

interface OrganizationSecuritySettingsProps {
  orgId: string;
}

interface OrgSecuritySettings {
  orgId: string;
  require2FAForAdmins: boolean;
  require2FAForAll: boolean;
  memberStats: {
    total: number;
    admins: number;
    with2FA: number;
    adminsWith2FA: number;
  };
}

export function OrganizationSecuritySettings({ orgId }: OrganizationSecuritySettingsProps) {
  const [settings, setSettings] = useState<OrgSecuritySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [orgId]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/2fa/org-settings?orgId=${orgId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch settings');
      }

      setSettings(data);
    } catch (error) {
      console.error('Error fetching org security settings:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load organization security settings',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (field: 'require2FAForAdmins' | 'require2FAForAll', value: boolean) => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const body: any = { orgId };
      if (field === 'require2FAForAdmins') {
        body.require2FAForAdmins = value;
      } else {
        body.require2FAForAll = value;
      }

      const response = await fetch('/api/2fa/org-settings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update settings');
      }

      notifications.show({
        title: 'Success',
        message: 'Security settings updated',
        color: 'green',
        icon: <IconCheck />,
      });

      await fetchSettings();
    } catch (error) {
      console.error('Error updating org security settings:', error);
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to update settings',
        color: 'red',
        icon: <IconAlertCircle />,
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Card withBorder p="xl"><Text>Loading...</Text></Card>;
  }

  if (!settings) {
    return null;
  }

  const adminCompliancePercent = settings.memberStats.admins > 0
    ? Math.round((settings.memberStats.adminsWith2FA / settings.memberStats.admins) * 100)
    : 0;

  const overallCompliancePercent = settings.memberStats.total > 0
    ? Math.round((settings.memberStats.with2FA / settings.memberStats.total) * 100)
    : 0;

  return (
    <Card withBorder p="xl">
      <Stack gap="lg">
        <Box>
          <Title order={3}>Organization Security Settings</Title>
          <Text size="sm" c="dimmed" mt={4}>
            Manage two-factor authentication requirements for your organization
          </Text>
        </Box>

        {/* 2FA Adoption Stats */}
        <Box>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={500}>
              2FA Adoption
            </Text>
            <Text size="sm" c="dimmed">
              {settings.memberStats.with2FA} of {settings.memberStats.total} members
            </Text>
          </Group>
          <Progress
            value={overallCompliancePercent}
            color={overallCompliancePercent === 100 ? 'green' : 'blue'}
            size="lg"
            radius="xl"
          />
          <Text size="xs" c="dimmed" mt="xs">
            Overall adoption: {overallCompliancePercent}%
          </Text>

          {settings.memberStats.admins > 0 && (
            <>
              <Group justify="space-between" mb="xs" mt="md">
                <Text size="sm" fw={500}>
                  Admin 2FA Adoption
                </Text>
                <Text size="sm" c="dimmed">
                  {settings.memberStats.adminsWith2FA} of {settings.memberStats.admins} admins
                </Text>
              </Group>
              <Progress
                value={adminCompliancePercent}
                color={adminCompliancePercent === 100 ? 'green' : 'orange'}
                size="lg"
                radius="xl"
              />
              <Text size="xs" c="dimmed" mt="xs">
                Admin adoption: {adminCompliancePercent}%
              </Text>
            </>
          )}
        </Box>

        {/* Settings */}
        <Stack gap="md">
          <Box>
            <Group justify="space-between" align="flex-start">
              <Box style={{ flex: 1 }}>
                <Group gap="xs" mb={4}>
                  <Text size="sm" fw={500}>
                    Require 2FA for Admins
                  </Text>
                  <Tooltip label="When enabled, all organization admins must enable two-factor authentication">
                    <IconInfoCircle size={16} style={{ color: 'var(--mantine-color-dimmed)' }} />
                  </Tooltip>
                </Group>
                <Text size="xs" c="dimmed">
                  Organization administrators will be required to enable 2FA
                </Text>
              </Box>
              <Switch
                checked={settings.require2FAForAdmins}
                onChange={(e) => updateSetting('require2FAForAdmins', e.currentTarget.checked)}
                disabled={saving || settings.require2FAForAll}
              />
            </Group>

            {settings.require2FAForAdmins && adminCompliancePercent < 100 && (
              <Alert color="yellow" icon={<IconAlertCircle />} mt="md">
                {settings.memberStats.admins - settings.memberStats.adminsWith2FA} admin
                {settings.memberStats.admins - settings.memberStats.adminsWith2FA !== 1 ? 's' : ''} still need
                to enable 2FA
              </Alert>
            )}
          </Box>

          <Box>
            <Group justify="space-between" align="flex-start">
              <Box style={{ flex: 1 }}>
                <Group gap="xs" mb={4}>
                  <Text size="sm" fw={500}>
                    Require 2FA for All Members
                  </Text>
                  <Tooltip label="When enabled, all organization members must enable two-factor authentication">
                    <IconInfoCircle size={16} style={{ color: 'var(--mantine-color-dimmed)' }} />
                  </Tooltip>
                </Group>
                <Text size="xs" c="dimmed">
                  All organization members will be required to enable 2FA
                </Text>
              </Box>
              <Switch
                checked={settings.require2FAForAll}
                onChange={(e) => updateSetting('require2FAForAll', e.currentTarget.checked)}
                disabled={saving}
              />
            </Group>

            {settings.require2FAForAll && overallCompliancePercent < 100 && (
              <Alert color="yellow" icon={<IconAlertCircle />} mt="md">
                {settings.memberStats.total - settings.memberStats.with2FA} member
                {settings.memberStats.total - settings.memberStats.with2FA !== 1 ? 's' : ''} still need to
                enable 2FA
              </Alert>
            )}
          </Box>
        </Stack>

        {(settings.require2FAForAdmins || settings.require2FAForAll) && (
          <Alert color="blue" icon={<IconShieldCheck />}>
            <Text size="sm" fw={500} mb={4}>
              2FA Enforcement Active
            </Text>
            <Text size="xs">
              Users who haven't enabled 2FA will be prompted to set it up when they sign in.
            </Text>
          </Alert>
        )}
      </Stack>
    </Card>
  );
}
