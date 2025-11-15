import {
  Modal,
  Stack,
  Group,
  Title,
  Text,
  Button,
  TextInput,
  MultiSelect,
  Paper,
  Code,
} from "@mantine/core";

const EVENT_TYPES = [
  { value: 'grant.saved', label: 'Grant Saved' },
  { value: 'grant.deadline_approaching', label: 'Deadline Approaching' },
  { value: 'grant.deadline_passed', label: 'Deadline Passed' },
  { value: 'grant.updated', label: 'Grant Updated' },
  { value: 'grant.task_assigned', label: 'Task Assigned' },
];

interface WebhookFormData {
  name: string;
  url: string;
  secret: string;
  events: string[];
}

interface CalendarModalsProps {
  regenerateModal: boolean;
  instructionsModal: boolean;
  teamsModal: boolean;
  webhookModal: boolean;
  editingWebhook: any;
  webhookForm: WebhookFormData;
  teamsWebhookUrl: string;
  onRegenerateClose: () => void;
  onRegenerateConfirm: () => void;
  onInstructionsClose: () => void;
  onTeamsClose: () => void;
  onTeamsConnect: () => void;
  onWebhookClose: () => void;
  onWebhookSave: () => void;
  onWebhookFormChange: (form: WebhookFormData) => void;
  onTeamsUrlChange: (url: string) => void;
  isRegenerating: boolean;
  isConnectingTeams: boolean;
  isSavingWebhook: boolean;
}

export function CalendarModals({
  regenerateModal,
  instructionsModal,
  teamsModal,
  webhookModal,
  editingWebhook,
  webhookForm,
  teamsWebhookUrl,
  onRegenerateClose,
  onRegenerateConfirm,
  onInstructionsClose,
  onTeamsClose,
  onTeamsConnect,
  onWebhookClose,
  onWebhookSave,
  onWebhookFormChange,
  onTeamsUrlChange,
  isRegenerating,
  isConnectingTeams,
  isSavingWebhook,
}: CalendarModalsProps) {
  return (
    <>
      {/* Regenerate Confirmation Modal */}
      <Modal
        opened={regenerateModal}
        onClose={onRegenerateClose}
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
            <Button variant="light" onClick={onRegenerateClose}>
              Cancel
            </Button>
            <Button
              color="orange"
              loading={isRegenerating}
              onClick={onRegenerateConfirm}
            >
              Regenerate URL
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Teams Connection Modal */}
      <Modal
        opened={teamsModal}
        onClose={onTeamsClose}
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
                <li><Text size="sm">Open Microsoft Teams</Text></li>
                <li><Text size="sm">Go to the channel where you want notifications</Text></li>
                <li><Text size="sm">Click the ⋯ menu → Connectors → Incoming Webhook</Text></li>
                <li><Text size="sm">Configure and copy the webhook URL</Text></li>
              </ol>
            </Stack>
          </Paper>

          <TextInput
            label="Teams Webhook URL"
            placeholder="https://yourorg.webhook.office.com/webhookb2/..."
            value={teamsWebhookUrl}
            onChange={(e) => onTeamsUrlChange(e.target.value)}
            required
          />

          <Group justify="flex-end">
            <Button variant="light" onClick={onTeamsClose}>
              Cancel
            </Button>
            <Button
              color="blue"
              onClick={onTeamsConnect}
              loading={isConnectingTeams}
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
        onClose={onWebhookClose}
        title={editingWebhook ? 'Edit Webhook' : 'Add Webhook'}
        size="lg"
      >
        <Stack gap="md">
          <TextInput
            label="Name"
            placeholder="My Webhook"
            value={webhookForm.name}
            onChange={(e) => onWebhookFormChange({ ...webhookForm, name: e.target.value })}
            required
          />

          <TextInput
            label="Webhook URL"
            placeholder="https://example.com/webhook"
            value={webhookForm.url}
            onChange={(e) => onWebhookFormChange({ ...webhookForm, url: e.target.value })}
            required
          />

          <TextInput
            label="Secret (Optional)"
            placeholder="Optional signing secret"
            value={webhookForm.secret}
            onChange={(e) => onWebhookFormChange({ ...webhookForm, secret: e.target.value })}
            description="Used to sign webhook payloads for verification"
          />

          <MultiSelect
            label="Events"
            placeholder="Select events to subscribe to"
            data={EVENT_TYPES}
            value={webhookForm.events}
            onChange={(value) => onWebhookFormChange({ ...webhookForm, events: value })}
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
            <Button variant="light" onClick={onWebhookClose}>
              Cancel
            </Button>
            <Button
              onClick={onWebhookSave}
              loading={isSavingWebhook}
            >
              {editingWebhook ? 'Save Changes' : 'Create Webhook'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Setup Instructions Modal */}
      <Modal
        opened={instructionsModal}
        onClose={onInstructionsClose}
        title="How to Add ICS Feed to Your Calendar"
        size="lg"
      >
        <Stack gap="lg">
          <Paper p="md" withBorder>
            <Stack gap="sm">
              <Title order={4}>Google Calendar</Title>
              <ol style={{ margin: 0, paddingLeft: '1.2rem' }}>
                <li><Text size="sm">Open Google Calendar on your computer</Text></li>
                <li><Text size="sm">Click the "+" next to "Other calendars"</Text></li>
                <li><Text size="sm">Select "From URL"</Text></li>
                <li><Text size="sm">Paste your ICS feed URL and click "Add calendar"</Text></li>
              </ol>
            </Stack>
          </Paper>

          <Paper p="md" withBorder>
            <Stack gap="sm">
              <Title order={4}>Apple Calendar</Title>
              <ol style={{ margin: 0, paddingLeft: '1.2rem' }}>
                <li><Text size="sm">Open Calendar app</Text></li>
                <li><Text size="sm">Go to File → New Calendar Subscription</Text></li>
                <li><Text size="sm">Paste your ICS feed URL and click Subscribe</Text></li>
                <li><Text size="sm">Choose update frequency and click OK</Text></li>
              </ol>
            </Stack>
          </Paper>

          <Paper p="md" withBorder>
            <Stack gap="sm">
              <Title order={4}>Outlook</Title>
              <ol style={{ margin: 0, paddingLeft: '1.2rem' }}>
                <li><Text size="sm">Open Outlook Calendar</Text></li>
                <li><Text size="sm">Right-click "My Calendars" and select "Add Calendar"</Text></li>
                <li><Text size="sm">Choose "From Internet"</Text></li>
                <li><Text size="sm">Paste your ICS feed URL and click OK</Text></li>
              </ol>
            </Stack>
          </Paper>
        </Stack>
      </Modal>
    </>
  );
}
