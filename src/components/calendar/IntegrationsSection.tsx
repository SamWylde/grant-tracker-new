import { Stack, Title, Text, Paper, Group, ActionIcon, Badge, Button } from "@mantine/core";
import { IconBrandSlack, IconWebhook, IconPlus, IconEdit, IconTrash } from "@tabler/icons-react";

interface Integration {
  id: string;
  integration_type: string;
  channel_name?: string;
}

interface Webhook {
  id: string;
  name: string;
  url: string;
  is_active: boolean;
  events: string[];
}

interface IntegrationsSectionProps {
  slackIntegration?: Integration;
  teamsIntegration?: Integration;
  webhooks: Webhook[];
  isAdmin: boolean;
  onConnectSlack: () => void;
  onConnectTeams: () => void;
  onDisconnectIntegration: (type: string) => void;
  onAddWebhook: () => void;
  onEditWebhook: (webhook: Webhook) => void;
  onDeleteWebhook: (webhookId: string) => void;
  isDisconnecting: boolean;
  isDeleting: boolean;
}

export function IntegrationsSection({
  slackIntegration,
  teamsIntegration,
  webhooks,
  isAdmin,
  onConnectSlack,
  onConnectTeams,
  onDisconnectIntegration,
  onAddWebhook,
  onEditWebhook,
  onDeleteWebhook,
  isDisconnecting,
  isDeleting,
}: IntegrationsSectionProps) {
  return (
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
                  onClick={() => onDisconnectIntegration('slack')}
                  loading={isDisconnecting}
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
                  onClick={onConnectSlack}
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
                  onClick={() => onDisconnectIntegration('microsoft_teams')}
                  loading={isDisconnecting}
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
                  onClick={onConnectTeams}
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
                onClick={onAddWebhook}
              >
                Add Webhook
              </Button>
            )}
          </Group>

          {webhooks.length > 0 ? (
            <Stack gap="xs">
              {webhooks.map((webhook) => (
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
                          onClick={() => onEditWebhook(webhook)}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                        <ActionIcon
                          variant="light"
                          color="red"
                          onClick={() => onDeleteWebhook(webhook.id)}
                          loading={isDeleting}
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
  );
}
