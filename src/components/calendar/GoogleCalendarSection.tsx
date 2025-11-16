import { Paper, Stack, Group, Title, Text, Divider, Badge, Button } from "@mantine/core";

interface GoogleCalendarSectionProps {
  isConnected: boolean;
  isAdmin: boolean;
  orgId: string;
  userId: string;
  onDisconnect: () => void;
  isDisconnecting: boolean;
}

export function GoogleCalendarSection({
  isConnected,
  isAdmin,
  orgId,
  userId,
  onDisconnect,
  isDisconnecting,
}: GoogleCalendarSectionProps) {
  return (
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
          <Badge color={isConnected ? 'green' : 'gray'}>
            {isConnected ? 'Connected' : 'Not Connected'}
          </Badge>
        </Group>

        {isConnected ? (
          <>
            <Text size="sm" c="dimmed">
              Google Calendar is connected. Grant deadlines will automatically sync to your calendar.
            </Text>
            {isAdmin && (
              <Button
                variant="light"
                color="red"
                onClick={onDisconnect}
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
                onClick={() => {
                  window.location.href = `/api/oauth/google/authorize?org_id=${orgId}&user_id=${userId}`;
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
  );
}
