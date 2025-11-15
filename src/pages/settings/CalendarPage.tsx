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
  MultiSelect,
  Code,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCopy,
  IconCheck,
  IconRefresh,
  IconExternalLink,
  IconBrandSlack,
  IconWebhook,
  IconPlus,
  IconTrash,
  IconEdit,
} from '@tabler/icons-react';
import { SettingsLayout } from '../../components/SettingsLayout';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { useOrganization } from '../../contexts/OrganizationContext';
import { usePermission } from '../../hooks/usePermission';
import { supabase } from '../../lib/supabase';

const EVENT_TYPES = [
  { value: 'grant.saved', label: 'Grant Saved' },
  { value: 'grant.deadline_approaching', label: 'Deadline Approaching' },
  { value: 'grant.deadline_passed', label: 'Deadline Passed' },
  { value: 'grant.updated', label: 'Grant Updated' },
  { value: 'grant.task_assigned', label: 'Task Assigned' },
];

export function CalendarPage() {
  const { currentOrg } = useOrganization();
  const { isAdmin } = usePermission();
  const queryClient = useQueryClient();

  const [regenerateModal, setRegenerateModal] = useState(false);
  const [instructionsModal, setInstructionsModal] = useState(false);
  const [webhookModal, setWebhookModal] = useState(false);
  const [teamsModal, setTeamsModal] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<any>(null);

  // Form states
  const [webhookForm, setWebhookForm] = useState({
    name: '',
    url: '',
    secret: '',
    events: ['grant.saved', 'grant.deadline_approaching'],
  });
  const [teamsWebhookUrl, setTeamsWebhookUrl] = useState('');

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

  // Load integrations
  const { data: integrationsData } = useQuery({
    queryKey: ['integrations', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return null;
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const response = await fetch(`/api/integrations?org_id=${currentOrg.id}`, {
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch integrations');
      return response.json();
    },
    enabled: !!currentOrg,
  });

  // Load webhooks
  const { data: webhooksData } = useQuery({
    queryKey: ['webhooks', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return null;
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const response = await fetch(`/api/webhooks?org_id=${currentOrg.id}`, {
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch webhooks');
      return response.json();
    },
    enabled: !!currentOrg,
  });

  const integrations = integrationsData?.integrations || [];
  const webhooks = webhooksData?.webhooks || [];

  const slackIntegration = integrations.find((i: any) => i.integration_type === 'slack');
  const teamsIntegration = integrations.find((i: any) => i.integration_type === 'microsoft_teams');

  // Regenerate ICS token mutation
  const regenerateMutation = useMutation({
    mutationFn: async () => {
      if (!currentOrg) throw new Error('No organization');
      const newToken = crypto.randomUUID();
      const { error } = await supabase
        .from('organization_settings')
        // @ts-ignore
        .update({ ics_token: newToken })
        .eq('org_id', currentOrg.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizationSettings'] });
      setRegenerateModal(false);
      notifications.show({
        title: 'ICS URL regenerated',
        message: 'Your calendar feed URL has been updated.',
        color: 'orange',
      });
    },
  });

  // Connect Teams mutation
  const connectTeamsMutation = useMutation({
    mutationFn: async (webhookUrl: string) => {
      if (!currentOrg) throw new Error('No organization');
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const response = await fetch('/api/integrations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify({
          org_id: currentOrg.id,
          integration_type: 'microsoft_teams',
          webhook_url: webhookUrl,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to connect Teams');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      setTeamsModal(false);
      setTeamsWebhookUrl('');
      notifications.show({
        title: 'Teams Connected',
        message: 'Microsoft Teams has been connected successfully.',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red',
      });
    },
  });

  // Disconnect integration mutation
  const disconnectMutation = useMutation({
    mutationFn: async (integrationType: string) => {
      if (!currentOrg) throw new Error('No organization');
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const response = await fetch(
        `/api/integrations?org_id=${currentOrg.id}&integration_type=${integrationType}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to disconnect');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      notifications.show({
        title: 'Disconnected',
        message: 'Integration has been disconnected.',
        color: 'blue',
      });
    },
  });

  // Create/update webhook mutation
  const saveWebhookMutation = useMutation({
    mutationFn: async (webhook: any) => {
      if (!currentOrg) throw new Error('No organization');
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const url = editingWebhook
        ? `/api/webhooks?id=${editingWebhook.id}`
        : '/api/webhooks';
      const method = editingWebhook ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify(editingWebhook ? webhook : { ...webhook, org_id: currentOrg.id }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save webhook');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      setWebhookModal(false);
      setEditingWebhook(null);
      setWebhookForm({ name: '', url: '', secret: '', events: ['grant.saved', 'grant.deadline_approaching'] });
      notifications.show({
        title: editingWebhook ? 'Webhook Updated' : 'Webhook Created',
        message: 'Your webhook has been saved successfully.',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red',
      });
    },
  });

  // Delete webhook mutation
  const deleteWebhookMutation = useMutation({
    mutationFn: async (webhookId: string) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const response = await fetch(`/api/webhooks?id=${webhookId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to delete webhook');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      notifications.show({
        title: 'Webhook Deleted',
        message: 'The webhook has been removed.',
        color: 'blue',
      });
    },
  });

  const handleEditWebhook = (webhook: any) => {
    setEditingWebhook(webhook);
    setWebhookForm({
      name: webhook.name,
      url: webhook.url,
      secret: webhook.secret || '',
      events: webhook.events,
    });
    setWebhookModal(true);
  };

  const handleSaveWebhook = () => {
    if (!webhookForm.name || !webhookForm.url) {
      notifications.show({
        title: 'Validation Error',
        message: 'Name and URL are required',
        color: 'red',
      });
      return;
    }
    saveWebhookMutation.mutate(webhookForm);
  };

  if (!currentOrg) {
    return (
      <ProtectedRoute>
        <SettingsLayout>
          <Text>Loading...</Text>
        </SettingsLayout>
      </ProtectedRoute>
    );
  }

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
                        Google Calendar is connected. Grant deadlines will automatically sync to your calendar.
                      </Text>
                      {isAdmin && (
                        <Button
                          variant="light"
                          color="red"
                          onClick={() => disconnectMutation.mutate('google_calendar')}
                          loading={disconnectMutation.isPending}
                        >
                          Disconnect
                        </Button>
                      )}
                    </>
                  ) : (
                    <>
                      {isAdmin ? (
                        <Button
                          variant="light"
                          color="blue"
                          onClick={async () => {
                            const { data: { user } } = await supabase.auth.getUser();
                            if (user) {
                              window.location.href = `/api/oauth/google/authorize?org_id=${currentOrg.id}&user_id=${user.id}`;
                            }
                          }}
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
                <Paper p="md" withBorder bg={slackIntegration ? 'white' : 'var(--mantine-color-gray-0)'}>
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Group gap="sm">
                        <ActionIcon
                          size="lg"
                          variant="light"
                          color="violet"
                          disabled={!slackIntegration}
                        >
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
                      <Badge color={slackIntegration ? 'green' : 'gray'} variant="outline">
                        {slackIntegration ? 'Connected' : 'Not Connected'}
                      </Badge>
                    </Group>

                    {slackIntegration ? (
                      <>
                        <Text size="sm" c="dimmed">
                          Connected to <strong>#{slackIntegration.channel_name}</strong>. Grant notifications will be sent to this channel.
                        </Text>
                        {isAdmin && (
                          <Button
                            variant="light"
                            color="red"
                            onClick={() => disconnectMutation.mutate('slack')}
                            loading={disconnectMutation.isPending}
                          >
                            Disconnect
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        {isAdmin ? (
                          <Button
                            variant="light"
                            color="violet"
                            leftSection={<IconBrandSlack size={16} />}
                            onClick={async () => {
                              const { data: { user } } = await supabase.auth.getUser();
                              if (user) {
                                window.location.href = `/api/oauth/slack/authorize?org_id=${currentOrg.id}&user_id=${user.id}`;
                              }
                            }}
                          >
                            Connect Slack
                          </Button>
                        ) : (
                          <Text size="sm" c="orange" fw={500}>
                            Only admins can connect Slack
                          </Text>
                        )}
                      </>
                    )}
                  </Stack>
                </Paper>

                {/* Microsoft Teams */}
                <Paper p="md" withBorder bg={teamsIntegration ? 'white' : 'var(--mantine-color-gray-0)'}>
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Group gap="sm">
                        <ActionIcon size="lg" variant="light" color="blue" disabled={!teamsIntegration}>
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
                      <Badge color={teamsIntegration ? 'green' : 'gray'} variant="outline">
                        {teamsIntegration ? 'Connected' : 'Not Connected'}
                      </Badge>
                    </Group>

                    {teamsIntegration ? (
                      <>
                        <Text size="sm" c="dimmed">
                          Webhook connected. Grant notifications will be sent to your Teams channel.
                        </Text>
                        {isAdmin && (
                          <Button
                            variant="light"
                            color="red"
                            onClick={() => disconnectMutation.mutate('microsoft_teams')}
                            loading={disconnectMutation.isPending}
                          >
                            Disconnect
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        {isAdmin ? (
                          <Button
                            variant="light"
                            color="blue"
                            leftSection={<IconWebhook size={16} />}
                            onClick={() => setTeamsModal(true)}
                          >
                            Connect Teams
                          </Button>
                        ) : (
                          <Text size="sm" c="orange" fw={500}>
                            Only admins can connect Microsoft Teams
                          </Text>
                        )}
                      </>
                    )}
                  </Stack>
                </Paper>

                {/* Custom Webhooks */}
                <Paper p="md" withBorder>
                  <Stack gap="md">
                    <Group justify="space-between">
                      <div>
                        <Text fw={600} size="sm" mb="xs">
                          Custom Webhooks
                        </Text>
                        <Text size="xs" c="dimmed">
                          Send events to your own endpoints
                        </Text>
                      </div>
                      {isAdmin && (
                        <Button
                          size="xs"
                          variant="light"
                          leftSection={<IconPlus size={14} />}
                          onClick={() => {
                            setEditingWebhook(null);
                            setWebhookForm({
                              name: '',
                              url: '',
                              secret: '',
                              events: ['grant.saved', 'grant.deadline_approaching'],
                            });
                            setWebhookModal(true);
                          }}
                        >
                          Add Webhook
                        </Button>
                      )}
                    </Group>

                    {webhooks.length > 0 ? (
                      <Stack gap="xs">
                        {webhooks.map((webhook: any) => (
                          <Paper key={webhook.id} p="sm" withBorder bg="var(--mantine-color-gray-0)">
                            <Group justify="space-between">
                              <div>
                                <Text size="sm" fw={500}>
                                  {webhook.name}
                                </Text>
                                <Text size="xs" c="dimmed" style={{ fontFamily: 'monospace' }}>
                                  {webhook.url.substring(0, 50)}...
                                </Text>
                                <Group gap="xs" mt="xs">
                                  <Badge size="xs" variant="dot" color={webhook.is_active ? 'green' : 'gray'}>
                                    {webhook.is_active ? 'Active' : 'Inactive'}
                                  </Badge>
                                  <Text size="xs" c="dimmed">
                                    {webhook.events.length} events
                                  </Text>
                                </Group>
                              </div>
                              {isAdmin && (
                                <Group gap="xs">
                                  <ActionIcon
                                    variant="light"
                                    onClick={() => handleEditWebhook(webhook)}
                                  >
                                    <IconEdit size={16} />
                                  </ActionIcon>
                                  <ActionIcon
                                    variant="light"
                                    color="red"
                                    onClick={() => deleteWebhookMutation.mutate(webhook.id)}
                                    loading={deleteWebhookMutation.isPending}
                                  >
                                    <IconTrash size={16} />
                                  </ActionIcon>
                                </Group>
                              )}
                            </Group>
                          </Paper>
                        ))}
                      </Stack>
                    ) : (
                      <Text size="sm" c="dimmed" ta="center" py="md">
                        No webhooks configured yet
                      </Text>
                    )}
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
                </Stack>
              </Paper>

              <Paper p="md" withBorder bg="var(--mantine-color-blue-0)">
                <Stack gap="sm">
                  <Title order={4}>About Webhooks</Title>
                  <Text size="sm">
                    Webhooks allow you to receive real-time notifications when events occur in
                    GrantCue. Configure custom endpoints to integrate with your own systems.
                  </Text>
                  <Text size="sm">
                    <strong>Events:</strong> grant.saved, grant.deadline_approaching,
                    grant.deadline_passed, grant.updated, grant.task_assigned
                  </Text>
                </Stack>
              </Paper>

              {!isAdmin && (
                <Paper p="md" withBorder bg="var(--mantine-color-orange-0)">
                  <Stack gap="sm">
                    <Title order={4}>Admin Only</Title>
                    <Text size="sm">
                      Only admins can regenerate the ICS URL or connect organization-level
                      integrations.
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

        {/* Teams Connection Modal */}
        <Modal
          opened={teamsModal}
          onClose={() => {
            setTeamsModal(false);
            setTeamsWebhookUrl('');
          }}
          title="Connect Microsoft Teams"
          size="lg"
        >
          <Stack gap="md">
            <Text size="sm">
              To connect Microsoft Teams, you need to create an Incoming Webhook in your Teams channel.
            </Text>

            <Paper p="md" withBorder bg="var(--mantine-color-blue-0)">
              <Stack gap="xs">
                <Text size="sm" fw={500}>
                  How to get your Teams Webhook URL:
                </Text>
                <ol style={{ margin: 0, paddingLeft: '1.2rem' }}>
                  <li>
                    <Text size="sm">Open Microsoft Teams</Text>
                  </li>
                  <li>
                    <Text size="sm">Go to the channel where you want notifications</Text>
                  </li>
                  <li>
                    <Text size="sm">Click the ⋯ menu → Connectors → Incoming Webhook</Text>
                  </li>
                  <li>
                    <Text size="sm">Configure and copy the webhook URL</Text>
                  </li>
                </ol>
              </Stack>
            </Paper>

            <TextInput
              label="Teams Webhook URL"
              placeholder="https://yourorg.webhook.office.com/webhookb2/..."
              value={teamsWebhookUrl}
              onChange={(e) => setTeamsWebhookUrl(e.target.value)}
              required
            />

            <Group justify="flex-end">
              <Button
                variant="light"
                onClick={() => {
                  setTeamsModal(false);
                  setTeamsWebhookUrl('');
                }}
              >
                Cancel
              </Button>
              <Button
                color="blue"
                onClick={() => connectTeamsMutation.mutate(teamsWebhookUrl)}
                loading={connectTeamsMutation.isPending}
                disabled={!teamsWebhookUrl}
              >
                Connect
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* Webhook Configuration Modal */}
        <Modal
          opened={webhookModal}
          onClose={() => {
            setWebhookModal(false);
            setEditingWebhook(null);
            setWebhookForm({ name: '', url: '', secret: '', events: [] });
          }}
          title={editingWebhook ? 'Edit Webhook' : 'Add Webhook'}
          size="lg"
        >
          <Stack gap="md">
            <TextInput
              label="Name"
              placeholder="My Webhook"
              value={webhookForm.name}
              onChange={(e) => setWebhookForm({ ...webhookForm, name: e.target.value })}
              required
            />

            <TextInput
              label="Webhook URL"
              placeholder="https://example.com/webhook"
              value={webhookForm.url}
              onChange={(e) => setWebhookForm({ ...webhookForm, url: e.target.value })}
              required
            />

            <TextInput
              label="Secret (Optional)"
              placeholder="Optional signing secret"
              value={webhookForm.secret}
              onChange={(e) => setWebhookForm({ ...webhookForm, secret: e.target.value })}
              description="Used to sign webhook payloads for verification"
            />

            <MultiSelect
              label="Events"
              placeholder="Select events to subscribe to"
              data={EVENT_TYPES}
              value={webhookForm.events}
              onChange={(value) => setWebhookForm({ ...webhookForm, events: value })}
              required
            />

            <Paper p="md" withBorder bg="var(--mantine-color-gray-0)">
              <Stack gap="xs">
                <Text size="sm" fw={500}>
                  Payload Example:
                </Text>
                <Code block>
                  {JSON.stringify(
                    {
                      event: 'grant.saved',
                      timestamp: new Date().toISOString(),
                      data: {
                        grant_id: 'uuid',
                        title: 'Grant Title',
                        deadline: '2024-12-31',
                      },
                    },
                    null,
                    2
                  )}
                </Code>
              </Stack>
            </Paper>

            <Group justify="flex-end">
              <Button
                variant="light"
                onClick={() => {
                  setWebhookModal(false);
                  setEditingWebhook(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveWebhook}
                loading={saveWebhookMutation.isPending}
              >
                {editingWebhook ? 'Save Changes' : 'Create Webhook'}
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
