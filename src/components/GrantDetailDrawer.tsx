import {
  Drawer,
  Stack,
  Group,
  Title,
  Text,
  Badge,
  Divider,
  Button,
  Tabs,
  ScrollArea,
  Box,
  ActionIcon,
} from "@mantine/core";
import {
  IconExternalLink,
  IconCalendar,
  IconBuilding,
  IconClock,
  IconX,
  IconPrinter,
  IconCurrencyDollar,
  IconReceipt,
  IconShieldCheck,
  IconEdit,
  IconCheck,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { notifications } from "@mantine/notifications";
import dayjs from "dayjs";
import { TaskList } from "./TaskList";
import { BudgetTab } from "./BudgetTab";
import { PaymentScheduleTab } from "./PaymentScheduleTab";
import { ComplianceTab } from "./ComplianceTab";
import { MentionTextarea } from "./MentionTextarea";
import { printGrantBrief } from "../utils/printGrant";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

interface Grant {
  id: string;
  external_id: string;
  title: string;
  agency: string | null;
  aln: string | null;
  open_date: string | null;
  close_date: string | null;
  status: string;
  priority: string | null;
  notes: string | null;
  org_id: string;
  assigned_to: string | null;
}

interface GrantDetailDrawerProps {
  grant: Grant | null;
  opened: boolean;
  onClose: () => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  low: "gray",
  medium: "blue",
  high: "orange",
  urgent: "red",
};

export function GrantDetailDrawer({
  grant,
  opened,
  onClose,
}: GrantDetailDrawerProps) {
  const { user } = useAuth();
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [mentionedUsers, setMentionedUsers] = useState<Array<{ userId: string; userName: string }>>([]);

  if (!grant) return null;

  const daysUntilDeadline = grant.close_date
    ? dayjs(grant.close_date).diff(dayjs(), "days")
    : null;

  const isOverdue = daysUntilDeadline !== null && daysUntilDeadline < 0;
  const isClosingSoon = daysUntilDeadline !== null && daysUntilDeadline <= 14 && daysUntilDeadline >= 0;

  // Handle notes editing
  const handleEditNotes = () => {
    setNotesValue(grant.notes || "");
    setMentionedUsers([]);
    setIsEditingNotes(true);
  };

  const handleMentionAdded = (userId: string, userName: string) => {
    setMentionedUsers(prev => [...prev, { userId, userName }]);
  };

  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(`/api/saved?id=${grant.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ notes: notesValue }),
      });

      if (!response.ok) throw new Error("Failed to save notes");

      // Send notifications for mentioned users
      for (const mention of mentionedUsers) {
        try {
          await supabase.from('in_app_notifications').insert({
            user_id: mention.userId,
            org_id: grant.org_id,
            type: 'team_update',
            title: `${user?.email || 'Someone'} mentioned you in notes`,
            message: `You were mentioned in notes for grant: ${grant.title}`,
            related_grant_id: grant.external_id,
            action_url: `/saved?grant=${grant.id}`,
            action_label: 'View Grant',
          } as any);
        } catch (notifError) {
          console.error('Failed to send mention notification:', notifError);
        }
      }

      notifications.show({
        title: "Success",
        message: mentionedUsers.length > 0
          ? `Notes saved and ${mentionedUsers.length} team member(s) notified`
          : "Notes saved successfully",
        color: "green",
      });

      // Update the grant object locally
      grant.notes = notesValue;
      setIsEditingNotes(false);
      setMentionedUsers([]);
    } catch (error) {
      notifications.show({
        title: "Error",
        message: error instanceof Error ? error.message : "Failed to save notes",
        color: "red",
      });
    } finally {
      setIsSavingNotes(false);
    }
  };

  // Fetch tasks for this grant
  const { data: tasksData } = useQuery({
    queryKey: ['grantTasks', grant.id],
    queryFn: async () => {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/tasks?grant_id=${grant.id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch tasks');
      return response.json();
    },
    enabled: opened,
  });

  const handlePrintBrief = () => {
    printGrantBrief(grant, tasksData?.tasks);
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="xl"
      title={
        <Group justify="space-between" style={{ flex: 1, paddingRight: 16 }}>
          <Text size="lg" fw={600} lineClamp={1}>
            Grant Details
          </Text>
          <ActionIcon variant="subtle" color="gray" onClick={onClose}>
            <IconX size={20} />
          </ActionIcon>
        </Group>
      }
      withCloseButton={false}
      scrollAreaComponent={ScrollArea.Autosize}
    >
      <Stack gap="lg">
        {/* Grant Header */}
        <Box>
          <Group mb="xs" gap="xs">
            {grant.priority && (
              <Badge
                color={PRIORITY_COLORS[grant.priority] || "gray"}
                variant="light"
              >
                {grant.priority.charAt(0).toUpperCase() + grant.priority.slice(1)}
              </Badge>
            )}
            <Badge variant="light" color="blue">
              {grant.status.charAt(0).toUpperCase() + grant.status.slice(1)}
            </Badge>
          </Group>
          <Title order={3} mb="sm">
            {grant.title}
          </Title>
          {grant.agency && (
            <Group gap={6} mb="xs">
              <IconBuilding size={16} style={{ color: "var(--mantine-color-gray-6)" }} />
              <Text size="sm" c="dimmed">
                {grant.agency}
              </Text>
            </Group>
          )}
          {grant.aln && (
            <Text size="sm" c="dimmed" mb="xs">
              ALN: {grant.aln}
            </Text>
          )}
        </Box>

        {/* Deadline Information */}
        <Box
          p="md"
          style={{
            backgroundColor: isOverdue
              ? "var(--mantine-color-red-0)"
              : isClosingSoon
              ? "var(--mantine-color-yellow-0)"
              : "var(--mantine-color-gray-0)",
            borderRadius: "var(--mantine-radius-md)",
          }}
        >
          <Group gap="md">
            <IconCalendar
              size={20}
              style={{
                color: isOverdue
                  ? "var(--mantine-color-red-6)"
                  : isClosingSoon
                  ? "var(--mantine-color-yellow-6)"
                  : "var(--mantine-color-gray-6)",
              }}
            />
            <div>
              <Text size="sm" fw={500}>
                Deadline
              </Text>
              <Text size="sm" c="dimmed">
                {grant.close_date
                  ? dayjs(grant.close_date).format("MMM D, YYYY")
                  : "No deadline set"}
              </Text>
              {daysUntilDeadline !== null && (
                <Text
                  size="xs"
                  c={isOverdue ? "red" : isClosingSoon ? "yellow.8" : "dimmed"}
                  mt={2}
                >
                  {isOverdue
                    ? `Overdue by ${Math.abs(daysUntilDeadline)} days`
                    : `${daysUntilDeadline} days remaining`}
                </Text>
              )}
            </div>
          </Group>
          {grant.open_date && (
            <Group gap="md" mt="sm">
              <IconClock
                size={20}
                style={{ color: "var(--mantine-color-gray-6)" }}
              />
              <div>
                <Text size="sm" fw={500}>
                  Open Date
                </Text>
                <Text size="sm" c="dimmed">
                  {dayjs(grant.open_date).format("MMM D, YYYY")}
                </Text>
              </div>
            </Group>
          )}
        </Box>

        {/* Quick Actions */}
        <Group grow>
          <Button
            component="a"
            href={`https://www.grants.gov/search-results-detail/${grant.external_id}`}
            target="_blank"
            rel="noopener noreferrer"
            leftSection={<IconExternalLink size={16} />}
            variant="light"
          >
            View on Grants.gov
          </Button>
          <Button
            onClick={handlePrintBrief}
            leftSection={<IconPrinter size={16} />}
            variant="light"
            color="grape"
          >
            Print Brief
          </Button>
        </Group>

        <Divider />

        {/* Tabs for Tasks, Budget, Payments, Compliance, and Notes */}
        <Tabs defaultValue="tasks">
          <Tabs.List>
            <Tabs.Tab value="tasks">Tasks</Tabs.Tab>
            <Tabs.Tab value="budget" leftSection={<IconCurrencyDollar size={14} />}>
              Budget
            </Tabs.Tab>
            <Tabs.Tab value="payments" leftSection={<IconReceipt size={14} />}>
              Payments
            </Tabs.Tab>
            <Tabs.Tab value="compliance" leftSection={<IconShieldCheck size={14} />}>
              Compliance
            </Tabs.Tab>
            <Tabs.Tab value="notes">Notes</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="tasks" pt="md">
            <TaskList grantId={grant.id} orgId={grant.org_id} />
          </Tabs.Panel>

          <Tabs.Panel value="budget" pt="md">
            <BudgetTab grantId={grant.id} orgId={grant.org_id} />
          </Tabs.Panel>

          <Tabs.Panel value="payments" pt="md">
            <PaymentScheduleTab grantId={grant.id} orgId={grant.org_id} />
          </Tabs.Panel>

          <Tabs.Panel value="compliance" pt="md">
            <ComplianceTab grantId={grant.id} orgId={grant.org_id} />
          </Tabs.Panel>

          <Tabs.Panel value="notes" pt="md">
            <Stack gap="md">
              {isEditingNotes ? (
                <>
                  <MentionTextarea
                    value={notesValue}
                    onChange={setNotesValue}
                    placeholder="Add notes about this grant... Type @ to mention team members"
                    minRows={6}
                    autosize
                    onMentionAdded={handleMentionAdded}
                  />
                  {mentionedUsers.length > 0 && (
                    <Text size="xs" c="dimmed">
                      Will notify: {mentionedUsers.map(m => m.userName).join(', ')}
                    </Text>
                  )}
                  <Group justify="flex-end">
                    <Button
                      variant="subtle"
                      onClick={() => {
                        setIsEditingNotes(false);
                        setMentionedUsers([]);
                      }}
                      disabled={isSavingNotes}
                    >
                      Cancel
                    </Button>
                    <Button
                      leftSection={<IconCheck size={16} />}
                      onClick={handleSaveNotes}
                      loading={isSavingNotes}
                    >
                      Save Notes
                    </Button>
                  </Group>
                </>
              ) : (
                <>
                  {grant.notes ? (
                    <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                      {grant.notes}
                    </Text>
                  ) : (
                    <Text size="sm" c="dimmed">
                      No notes added yet
                    </Text>
                  )}
                  <Group justify="flex-end">
                    <Button
                      leftSection={<IconEdit size={16} />}
                      variant="light"
                      onClick={handleEditNotes}
                    >
                      {grant.notes ? "Edit Notes" : "Add Notes"}
                    </Button>
                  </Group>
                </>
              )}
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Drawer>
  );
}
