import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Stack,
  Title,
  Text,
  Divider,
  Paper,
  Button,
  Group,
  SimpleGrid,
  Badge,
  CopyButton,
  ActionIcon,
  Tooltip,
  Modal,
  TextInput,
  Box,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCopy, IconCheck, IconRefresh, IconExternalLink, IconBrandGoogle, IconBrandSlack, IconWebhook } from '@tabler/icons-react';
import { SettingsLayout } from '../../components/SettingsLayout';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { useOrganization } from '../../contexts/OrganizationContext';
import { usePermission } from '../../hooks/usePermission';
import { supabase } from '../../lib/supabase';

export function CalendarPage() {
  const { currentOrg } = useOrganization();
  const { isAdmin } = usePermission();
  const queryClient = useQueryClient();

  const [regenerateModal, setRegenerateModal] = useState(false);
  const [instructionsModal, setInstructionsModal] = useState(false);

  // Load organization settings
  const { data: orgSettings } = useQuery({
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

  // Regenerate ICS token mutation
  const regenerateMutation = useMutation({
    mutationFn: async () => {
      if (!currentOrg) throw new Error('No organization');

      // Generate a new UUID for the ICS token
      const newToken = crypto.randomUUID();

      const { error } = await supabase
        .from('organization_settings')
        // @ts-ignore - Supabase type inference issue
        .update({
          ics_token: newToken,
        })
        .eq('org_id', currentOrg.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizationSettings'] });
      setRegenerateModal(false);
      notifications.show({
        title: 'ICS URL regenerated',
        message: 'Your calendar feed URL has been updated. Update it in your calendar app.',
        color: 'orange',
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to regenerate ICS URL',
        color: 'red',
      });
    },
  });

  // Connect Google Calendar mutation (stub for now)
  const connectGoogleMutation = useMutation({
    mutationFn: async () => {
      // This would trigger OAuth flow in production
      // For V1, we'll just show a message
      throw new Error('Google Calendar integration is coming soon!');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizationSettings'] });
      notifications.show({
        title: 'Connected',
        message: 'Google Calendar has been connected.',
        color: 'green',
      });
    },
    onError: () => {
      notifications.show({
        title: 'Coming Soon',
        message: 'Google Calendar integration will be available soon!',
        color: 'blue',
      });
    },
  });

  if (!currentOrg) {
    return (
      <ProtectedRoute>
        <SettingsLayout>
          <Text>Loading...</Text>
        </SettingsLayout>
      </ProtectedRoute>
    );
  }

  // Generate ICS feed URL
  const icsToken = (orgSettings as any)?.ics_token || 'loading';
  const icsUrl = `${window.location.origin}/api/calendar/${currentOrg.id}/${icsToken}.ics`;

  const isGoogleConnected = (orgSettings as any)?.google_calendar_connected || false;

  return (
    <ProtectedRoute>
      <SettingsLayout>
        <Stack gap="lg">
          {/* Header */}
          <Stack gap="sm">
            <Title order={1}>Calendar & Integrations</Title>
            <Text c="dimmed" size="lg">
              Connect your calendar and external tools
            </Text>
          </Stack>

          <Divider />

          {/* Main Content - Two Column Layout */}
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
            {/* Left Column */}
            <Stack gap="lg">
              {/* ICS Feed */}
              <Paper p="md" withBorder>
                <Stack gap="md">
                  <div>
                    <Title order={3} size="h4" mb="xs">
                      ICS Calendar Feed
                    </Title>
                    <Text size="sm" c="dimmed">
                      Subscribe to grant deadlines in your calendar app
                    </Text>
                  </div>

                  <Divider />

                  {/* ICS URL */}
                  <div>
                    <Text size="sm" fw={500} mb="xs">
                      Calendar Feed URL
                    </Text>
                    <Group gap="xs">
                      <TextInput
                        value={icsUrl}
                        readOnly
                        style={{ flex: 1 }}
                        styles={{
                          input: {
                            fontFamily: 'monospace',
                            fontSize: '12px',
                          },
                        }}
                      />
                      <CopyButton value={icsUrl}>
                        {({ copied, copy }) => (
                          <Tooltip label={copied ? 'Copied!' : 'Copy URL'}>
                            <ActionIcon
                              color={copied ? 'teal' : 'grape'}
                              variant="light"
                              onClick={copy}
                              size="lg"
                            >
                              {copied ? <IconCheck size={18} /> : <IconCopy size={18} />}
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </CopyButton>
                    </Group>
                    <Text size="xs" c="dimmed" mt="xs">
                      Keep this URL private. Anyone with this link can view your grant deadlines.
                    </Text>
                  </div>

                  {/* Actions */}
                  <Group>
                    <Button
                      variant="light"
                      leftSection={<IconExternalLink size={16} />}
                      onClick={() => setInstructionsModal(true)}
                    >
                      Setup Instructions
                    </Button>
                    {isAdmin && (
                      <Button
                        variant="light"
                        color="orange"
                        leftSection={<IconRefresh size={16} />}
                        onClick={() => setRegenerateModal(true)}
                      >
                        Regenerate URL
                      </Button>
                    )}
                  </Group>
                </Stack>
              </Paper>

              {/* Google Calendar Integration */}
              <Paper p="md" withBorder>
                <Stack gap="md">
                  <div>
                    <Title order={3} size="h4" mb="xs">
                      Google Calendar
                    </Title>
                    <Text size="sm" c="dimmed">
                      Automatically create calendar events for grant deadlines
                    </Text>
                  </div>

                  <Divider />

                  {/* Connection Status */}
                  <Group justify="space-between">
                    <Text size="sm" fw={500}>
                      Status
                    </Text>
                    <Badge color={isGoogleConnected ? 'green' : 'gray'}>
                      {isGoogleConnected ? 'Connected' : 'Not Connected'}
                    </Badge>
                  </Group>

                  {isGoogleConnected ? (
                    <>
                      <Text size="sm" c="dimmed">
                        Grant deadlines will automatically appear in your Google Calendar.
                      </Text>
                      {isAdmin && (
                        <Button variant="light" color="red">
                          Disconnect
                        </Button>
                      )}
                    </>
                  ) : (
                    <>
                      <Text size="sm" c="dimmed">
                        Connect your Google Calendar to automatically sync grant deadlines.
                      </Text>
                      {isAdmin ? (
                        <Button
                          variant="light"
                          color="blue"
                          leftSection={<IconBrandGoogle size={16} />}
                          onClick={() => connectGoogleMutation.mutate()}
                          loading={connectGoogleMutation.isPending}
                        >
                          Connect Google Calendar
                        </Button>
                      ) : (
                        <Text size="sm" c="orange" fw={500}>
                          Only admins can connect Google Calendar
                        </Text>
                      )}
                    </>
                  )}
                </Stack>
              </Paper>

              {/* Other Integrations */}
              <Stack gap="md">
                <div>
                  <Title order={3} size="h4" mb="xs">
                    Other Integrations
                  </Title>
                  <Text size="sm" c="dimmed">
                    Connect additional tools to streamline your workflow
                  </Text>
                </div>

                {/* Slack */}
                <Paper p="md" withBorder bg="var(--mantine-color-gray-0)">
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Group gap="sm">
                        <ActionIcon size="lg" variant="light" color="violet" disabled>
                          <IconBrandSlack size={20} />
                        </ActionIcon>
                        <div>
                          <Text fw={600} size="sm">
                            Slack
                          </Text>
                          <Text size="xs" c="dimmed">
                            Get notifications for grant deadlines and updates
                          </Text>
                        </div>
                      </Group>
                      <Badge color="gray" variant="outline">
                        Coming Soon
                      </Badge>
                    </Group>
                    <Button
                      variant="light"
                      color="violet"
                      leftSection={<IconBrandSlack size={16} />}
                      disabled
                    >
                      Connect Slack
                    </Button>
                  </Stack>
                </Paper>

                {/* Microsoft Teams */}
                <Paper p="md" withBorder bg="var(--mantine-color-gray-0)">
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Group gap="sm">
                        <ActionIcon size="lg" variant="light" color="blue" disabled>
                          <IconWebhook size={20} />
                        </ActionIcon>
                        <div>
                          <Text fw={600} size="sm">
                            Microsoft Teams
                          </Text>
                          <Text size="xs" c="dimmed">
                            Receive deadline reminders in your Teams channels
                          </Text>
                        </div>
                      </Group>
                      <Badge color="gray" variant="outline">
                        Coming Soon
                      </Badge>
                    </Group>
                    <Button
                      variant="light"
                      color="blue"
                      leftSection={<IconWebhook size={16} />}
                      disabled
                    >
                      Connect Teams
                    </Button>
                  </Stack>
                </Paper>

                {/* Zapier */}
                <Paper p="md" withBorder bg="var(--mantine-color-gray-0)">
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Group gap="sm">
                        <ActionIcon size="lg" variant="light" color="orange" disabled>
                          <IconWebhook size={20} />
                        </ActionIcon>
                        <div>
                          <Text fw={600} size="sm">
                            Zapier
                          </Text>
                          <Text size="xs" c="dimmed">
                            Automate workflows with 5,000+ apps
                          </Text>
                        </div>
                      </Group>
                      <Badge color="gray" variant="outline">
                        Coming Soon
                      </Badge>
                    </Group>
                    <Button
                      variant="light"
                      color="orange"
                      leftSection={<IconWebhook size={16} />}
                      disabled
                    >
                      Connect Zapier
                    </Button>
                  </Stack>
                </Paper>

                {/* Webhooks */}
                <Paper p="md" withBorder bg="var(--mantine-color-gray-0)">
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Group gap="sm">
                        <ActionIcon size="lg" variant="light" color="gray" disabled>
                          <IconWebhook size={20} />
                        </ActionIcon>
                        <div>
                          <Text fw={600} size="sm">
                            Custom Webhooks
                          </Text>
                          <Text size="xs" c="dimmed">
                            Send events to your own endpoints
                          </Text>
                        </div>
                      </Group>
                      <Badge color="gray" variant="outline">
                        Coming Soon
                      </Badge>
                    </Group>
                    <Button
                      variant="light"
                      color="gray"
                      leftSection={<IconWebhook size={16} />}
                      disabled
                    >
                      Configure Webhooks
                    </Button>
                  </Stack>
                </Paper>
              </Stack>
            </Stack>

            {/* Right Column - Help */}
            <Stack gap="lg">
              <Paper p="md" withBorder bg="var(--mantine-color-grape-0)">
                <Stack gap="sm">
                  <Title order={4}>About Calendar Feeds</Title>
                  <Text size="sm">
                    The ICS calendar feed automatically updates with your grant deadlines. Add it
                    to Google Calendar, Outlook, Apple Calendar, or any calendar app that supports
                    ICS subscriptions.
                  </Text>
                  <Text size="sm">
                    The feed updates automatically when you save new grants or update deadlines.
                  </Text>
                </Stack>
              </Paper>

              <Paper p="md" withBorder bg="var(--mantine-color-blue-0)">
                <Stack gap="sm">
                  <Title order={4}>Google Calendar vs ICS</Title>
                  <Text size="sm">
                    <strong>ICS Feed:</strong> Works with any calendar app, updates periodically
                    (usually every few hours).
                  </Text>
                  <Text size="sm">
                    <strong>Google Calendar:</strong> Real-time sync, creates actual calendar
                    events you can edit and get notifications for.
                  </Text>
                </Stack>
              </Paper>

              {!isAdmin && (
                <Paper p="md" withBorder bg="var(--mantine-color-orange-0)">
                  <Stack gap="sm">
                    <Title order={4}>Admin Only</Title>
                    <Text size="sm">
                      Only admins can regenerate the ICS URL or connect organization-level
                      integrations like Google Calendar.
                    </Text>
                    <Text size="sm">
                      You can still use the ICS feed URL to subscribe in your personal calendar.
                    </Text>
                  </Stack>
                </Paper>
              )}
            </Stack>
          </SimpleGrid>
        </Stack>

        {/* Regenerate Confirmation Modal */}
        <Modal
          opened={regenerateModal}
          onClose={() => setRegenerateModal(false)}
          title="Regenerate ICS URL?"
        >
          <Stack gap="md">
            <Text>
              This will create a new calendar feed URL. Your old URL will stop working immediately.
            </Text>
            <Text fw={500} c="orange">
              You'll need to update the URL in all calendar apps where you've added it.
            </Text>
            <Group justify="flex-end">
              <Button variant="light" onClick={() => setRegenerateModal(false)}>
                Cancel
              </Button>
              <Button
                color="orange"
                loading={regenerateMutation.isPending}
                onClick={() => regenerateMutation.mutate()}
              >
                Regenerate URL
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* Setup Instructions Modal */}
        <Modal
          opened={instructionsModal}
          onClose={() => setInstructionsModal(false)}
          title="How to Add ICS Feed to Your Calendar"
          size="lg"
        >
          <Stack gap="lg">
            {/* Google Calendar */}
            <Paper p="md" withBorder>
              <Stack gap="sm">
                <Title order={4}>Google Calendar</Title>
                <ol style={{ margin: 0, paddingLeft: '1.2rem' }}>
                  <li>
                    <Text size="sm">Open Google Calendar on your computer</Text>
                  </li>
                  <li>
                    <Text size="sm">Click the "+" next to "Other calendars"</Text>
                  </li>
                  <li>
                    <Text size="sm">Select "From URL"</Text>
                  </li>
                  <li>
                    <Text size="sm">Paste your ICS feed URL and click "Add calendar"</Text>
                  </li>
                </ol>
              </Stack>
            </Paper>

            {/* Apple Calendar */}
            <Paper p="md" withBorder>
              <Stack gap="sm">
                <Title order={4}>Apple Calendar</Title>
                <ol style={{ margin: 0, paddingLeft: '1.2rem' }}>
                  <li>
                    <Text size="sm">Open Calendar app</Text>
                  </li>
                  <li>
                    <Text size="sm">Go to File → New Calendar Subscription</Text>
                  </li>
                  <li>
                    <Text size="sm">Paste your ICS feed URL and click Subscribe</Text>
                  </li>
                  <li>
                    <Text size="sm">Choose update frequency and click OK</Text>
                  </li>
                </ol>
              </Stack>
            </Paper>

            {/* Outlook */}
            <Paper p="md" withBorder>
              <Stack gap="sm">
                <Title order={4}>Outlook</Title>
                <ol style={{ margin: 0, paddingLeft: '1.2rem' }}>
                  <li>
                    <Text size="sm">Open Outlook Calendar</Text>
                  </li>
                  <li>
                    <Text size="sm">Right-click "My Calendars" and select "Add Calendar"</Text>
                  </li>
                  <li>
                    <Text size="sm">Choose "From Internet"</Text>
                  </li>
                  <li>
                    <Text size="sm">Paste your ICS feed URL and click OK</Text>
                  </li>
                </ol>
              </Stack>
            </Paper>
          </Stack>
        </Modal>
      </SettingsLayout>
    </ProtectedRoute>
  );
}
