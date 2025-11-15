import { Paper, Stack, Group, Title, Text, Divider, TextInput, Button, ActionIcon, Tooltip, CopyButton } from "@mantine/core";
import { IconExternalLink, IconRefresh, IconCopy, IconCheck } from "@tabler/icons-react";

interface ICSFeedSectionProps {
  icsUrl: string;
  isAdmin: boolean;
  onShowInstructions: () => void;
  onRegenerate: () => void;
}

export function ICSFeedSection({ icsUrl, isAdmin, onShowInstructions, onRegenerate }: ICSFeedSectionProps) {
  return (
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
            onClick={onShowInstructions}
          >
            Setup Instructions
          </Button>
          {isAdmin && (
            <Button
              variant="light"
              color="orange"
              leftSection={<IconRefresh size={16} />}
              onClick={onRegenerate}
            >
              Regenerate URL
            </Button>
          )}
        </Group>
      </Stack>
    </Paper>
  );
}
