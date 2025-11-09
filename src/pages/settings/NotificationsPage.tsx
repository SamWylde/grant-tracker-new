import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Stack,
  Title,
  Text,
  Divider,
  Paper,
  Switch,
  Button,
  Group,
  SimpleGrid,
  Badge,
  Box,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconLock } from '@tabler/icons-react';
import { SettingsLayout } from '../../components/SettingsLayout';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { useOrganization } from '../../contexts/OrganizationContext';
import { usePermission } from '../../hooks/usePermission';
import { supabase } from '../../lib/supabase';

export function NotificationsPage() {
  const { currentOrg } = useOrganization();
  const { isAdmin } = usePermission();
  const queryClient = useQueryClient();

  // Form state
  const [deadline30d, setDeadline30d] = useState(true);
  const [deadline14d, setDeadline14d] = useState(true);
  const [deadline7d, setDeadline7d] = useState(true);
  const [deadline3d, setDeadline3d] = useState(true);
  const [deadline1d, setDeadline1d] = useState(true);
  const [deadline0d, setDeadline0d] = useState(true);
  const [dailyTaskEmails, setDailyTaskEmails] = useState(true);

  const [isDirty, setIsDirty] = useState(false);

  const canEdit = isAdmin;

  // Load organization settings
  const { data: orgSettings, isLoading } = useQuery({
    queryKey: ['organizationSettings', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return null;

      const { data, error } = await supabase
        .from('organization_settings')
        .select('*')
        .eq('org_id', currentOrg.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!currentOrg,
  });

  // Initialize form when settings load
  useEffect(() => {
    if (orgSettings) {
      setDeadline30d((orgSettings as any)?.deadline_reminders_30d ?? true);
      setDeadline14d((orgSettings as any)?.deadline_reminders_14d ?? true);
      setDeadline7d((orgSettings as any)?.deadline_reminders_7d ?? true);
      setDeadline3d((orgSettings as any)?.deadline_reminders_3d ?? true);
      setDeadline1d((orgSettings as any)?.deadline_reminders_1d ?? true);
      setDeadline0d((orgSettings as any)?.deadline_reminders_0d ?? true);
      setDailyTaskEmails((orgSettings as any)?.daily_task_emails ?? true);
    }
  }, [orgSettings]);

  // Save settings mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentOrg) throw new Error('No organization');

      const { error } = await supabase
        .from('organization_settings')
        .update({
          deadline_reminders_30d: deadline30d,
          deadline_reminders_14d: deadline14d,
          deadline_reminders_7d: deadline7d,
          deadline_reminders_3d: deadline3d,
          deadline_reminders_1d: deadline1d,
          deadline_reminders_0d: deadline0d,
          daily_task_emails: dailyTaskEmails,
        } as any)
        .eq('org_id', currentOrg.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizationSettings'] });
      setIsDirty(false);
      notifications.show({
        title: 'Notifications updated',
        message: 'Your notification settings have been saved.',
        color: 'green',
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to save notification settings',
        color: 'red',
      });
    },
  });

  // Track form changes
  useEffect(() => {
    const hasChanges =
      deadline30d !== (orgSettings?.deadline_reminders_30d ?? true) ||
      deadline14d !== (orgSettings?.deadline_reminders_14d ?? true) ||
      deadline7d !== (orgSettings?.deadline_reminders_7d ?? true) ||
      deadline3d !== (orgSettings?.deadline_reminders_3d ?? true) ||
      deadline1d !== (orgSettings?.deadline_reminders_1d ?? true) ||
      deadline0d !== (orgSettings?.deadline_reminders_0d ?? true) ||
      dailyTaskEmails !== (orgSettings?.daily_task_emails ?? true);

    setIsDirty(hasChanges);
  }, [deadline30d, deadline14d, deadline7d, deadline3d, deadline1d, deadline0d, dailyTaskEmails, orgSettings]);

  if (!currentOrg) {
    return (
      <ProtectedRoute>
        <SettingsLayout>
          <Text>Loading...</Text>
        </SettingsLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <SettingsLayout>
        <Stack gap="lg">
          {/* Header */}
          <Stack gap="sm">
            <Group justify="space-between">
              <div>
                <Title order={1}>Notifications</Title>
                <Text c="dimmed" size="lg">
                  Control reminder cadence and notification channels
                </Text>
              </div>
              {!canEdit && (
                <Badge color="gray" size="lg">
                  View Only
                </Badge>
              )}
            </Group>
          </Stack>

          <Divider />

          {/* Main Content - Two Column Layout */}
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
            {/* Left Column - Form */}
            <Stack gap="lg">
              {/* Email Deadline Reminders */}
              <Paper p="md" withBorder>
                <Stack gap="md">
                  <div>
                    <Title order={3} size="h4" mb="xs">
                      Deadline Reminders (Email)
                    </Title>
                    <Text size="sm" c="dimmed">
                      Get email reminders before grant deadlines
                    </Text>
                  </div>

                  <Divider />

                  <Switch
                    label="30 days before deadline"
                    checked={deadline30d}
                    onChange={(e) => setDeadline30d(e.target.checked)}
                    disabled={!canEdit || isLoading}
                  />

                  <Switch
                    label="14 days before deadline"
                    checked={deadline14d}
                    onChange={(e) => setDeadline14d(e.target.checked)}
                    disabled={!canEdit || isLoading}
                  />

                  <Switch
                    label="7 days before deadline"
                    checked={deadline7d}
                    onChange={(e) => setDeadline7d(e.target.checked)}
                    disabled={!canEdit || isLoading}
                  />

                  <Switch
                    label="3 days before deadline"
                    checked={deadline3d}
                    onChange={(e) => setDeadline3d(e.target.checked)}
                    disabled={!canEdit || isLoading}
                  />

                  <Switch
                    label="1 day before deadline"
                    checked={deadline1d}
                    onChange={(e) => setDeadline1d(e.target.checked)}
                    disabled={!canEdit || isLoading}
                  />

                  <Switch
                    label="Day of deadline"
                    checked={deadline0d}
                    onChange={(e) => setDeadline0d(e.target.checked)}
                    disabled={!canEdit || isLoading}
                  />
                </Stack>
              </Paper>

              {/* Task Reminders */}
              <Paper p="md" withBorder>
                <Stack gap="md">
                  <div>
                    <Title order={3} size="h4" mb="xs">
                      Task Reminders (Email)
                    </Title>
                    <Text size="sm" c="dimmed">
                      Stay on top of your daily tasks
                    </Text>
                  </div>

                  <Divider />

                  <Switch
                    label="Daily task summary"
                    description="Email me daily with tasks due today"
                    checked={dailyTaskEmails}
                    onChange={(e) => setDailyTaskEmails(e.target.checked)}
                    disabled={!canEdit || isLoading}
                  />
                </Stack>
              </Paper>

              {/* SMS (Disabled/Pro only) */}
              <Paper p="md" withBorder bg="var(--mantine-color-gray-0)">
                <Stack gap="md">
                  <Group justify="space-between">
                    <div>
                      <Title order={3} size="h4" mb="xs">
                        SMS Notifications
                      </Title>
                      <Text size="sm" c="dimmed">
                        Get text message reminders (Pro feature)
                      </Text>
                    </div>
                    <Badge color="grape" variant="filled">
                      PRO
                    </Badge>
                  </Group>

                  <Divider />

                  <Box
                    p="md"
                    style={{
                      border: '1px dashed var(--mantine-color-gray-4)',
                      borderRadius: 'var(--mantine-radius-md)',
                      opacity: 0.6,
                    }}
                  >
                    <Group>
                      <IconLock size={20} />
                      <Text size="sm" c="dimmed">
                        SMS notifications are available on the Pro plan. Upgrade to enable text
                        message reminders for critical deadlines.
                      </Text>
                    </Group>
                  </Box>
                </Stack>
              </Paper>

              {/* Save Button */}
              {canEdit && (
                <Group justify="flex-end">
                  <Button
                    size="md"
                    disabled={!isDirty}
                    loading={saveMutation.isPending}
                    onClick={() => saveMutation.mutate()}
                  >
                    Save Changes
                  </Button>
                </Group>
              )}
            </Stack>

            {/* Right Column - Help */}
            <Stack gap="lg">
              <Paper p="md" withBorder bg="var(--mantine-color-grape-0)">
                <Stack gap="sm">
                  <Title order={4}>About Notification Settings</Title>
                  <Text size="sm">
                    These settings apply to all members of your organization. Admins can customize
                    when and how the team receives deadline and task reminders.
                  </Text>
                  <Text size="sm">
                    Email reminders are sent automatically based on the cadence you set. You can
                    enable or disable specific reminder intervals to match your team's workflow.
                  </Text>
                </Stack>
              </Paper>

              <Paper p="md" withBorder bg="var(--mantine-color-blue-0)">
                <Stack gap="sm">
                  <Title order={4}>Best Practices</Title>
                  <Text size="sm">
                    We recommend keeping the 7-day, 3-day, and 1-day reminders enabled to ensure
                    your team never misses a deadline.
                  </Text>
                  <Text size="sm">
                    The daily task summary is great for teams managing multiple grants
                    simultaneously.
                  </Text>
                </Stack>
              </Paper>

              {!isAdmin && (
                <Paper p="md" withBorder bg="var(--mantine-color-orange-0)">
                  <Stack gap="sm">
                    <Title order={4}>View Only Access</Title>
                    <Text size="sm">
                      You're viewing these settings as a <strong>Contributor</strong>. Only admins
                      can modify notification settings.
                    </Text>
                  </Stack>
                </Paper>
              )}
            </Stack>
          </SimpleGrid>
        </Stack>
      </SettingsLayout>
    </ProtectedRoute>
  );
}
