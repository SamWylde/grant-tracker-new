import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  Container,
  Stack,
  Group,
  Title,
  Text,
  Divider,
  Button,
  Tabs,
  Box,
  Select,
  Loader,
  Center,
  Paper,
} from "@mantine/core";
import {
  IconExternalLink,
  IconCalendar,
  IconBuilding,
  IconClock,
  IconArrowLeft,
  IconPrinter,
  IconCurrencyDollar,
  IconReceipt,
  IconShieldCheck,
  IconEdit,
  IconCheck,
  IconSparkles,
  IconFile,
  IconClipboardCheck,
} from "@tabler/icons-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { notifications } from "@mantine/notifications";
import dayjs from "dayjs";
import { AppHeader } from "../components/AppHeader";
import { TaskList } from "../components/TaskList";
import { BudgetTab } from "../components/BudgetTab";
import { PaymentScheduleTab } from "../components/PaymentScheduleTab";
import { ComplianceTab } from "../components/ComplianceTab";
import { AISummaryTab } from "../components/AISummaryTab";
import { DocumentsTab } from "../components/DocumentsTab";
import { PreFlightChecklistTab } from "../components/PreFlightChecklistTab";
import { MentionTextarea } from "../components/MentionTextarea";
import { CommentThread } from "../components/CommentThread";
import { CommentInput } from "../components/CommentInput";
import { printGrantBrief } from "../utils/printGrant";
import { stripHtml } from "../utils/htmlUtils";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { useOrganization } from "../contexts/OrganizationContext";

interface Grant {
  id: string;
  external_id: string;
  external_source: string;
  title: string;
  agency: string | null;
  aln: string | null;
  open_date: string | null;
  close_date: string | null;
  loi_deadline: string | null;
  description: string | null;
  status: string;
  priority: string | null;
  notes: string | null;
  org_id: string;
  user_id: string;
  assigned_to: string | null;
  saved_at: string;
  stage_updated_at: string | null;
  created_at: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  low: "gray",
  medium: "blue",
  high: "orange",
  urgent: "red",
};

export function GrantDetailPage() {
  const { grantId } = useParams<{ grantId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string | null>("tasks");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [mentionedUsers, setMentionedUsers] = useState<Array<{ userId: string; userName: string }>>([]);
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const [replyingToAuthor, setReplyingToAuthor] = useState<string | null>(null);

  // Get highlight comment ID from URL params
  const highlightCommentId = searchParams.get('comment');

  // Fetch the grant details
  const { data: grant, isLoading: isLoadingGrant } = useQuery({
    queryKey: ['grant', grantId],
    queryFn: async () => {
      if (!grantId || !currentOrg) return null;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`/api/saved?org_id=${currentOrg.id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch grant');

      const data = await response.json();
      const foundGrant = data.grants.find((g: Grant) => g.id === grantId);

      if (!foundGrant) throw new Error('Grant not found');

      return foundGrant as Grant;
    },
    enabled: !!grantId && !!currentOrg,
  });

  // Switch to comments tab when highlightCommentId is provided
  useEffect(() => {
    if (highlightCommentId) {
      setActiveTab("comments");
    }
  }, [highlightCommentId]);

  // Mutation for updating grant status/priority
  const updateGrantMutation = useMutation({
    mutationFn: async ({ field, value }: { field: 'status' | 'priority'; value: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`/api/saved-status?id=${grantId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ [field]: value }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update grant');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grant', grantId] });
      queryClient.invalidateQueries({ queryKey: ['savedGrants'] });
      notifications.show({
        title: 'Success',
        message: 'Grant updated successfully',
        color: 'green',
      });
    },
    onError: (error) => {
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to update grant',
        color: 'red',
      });
    },
  });

  // Fetch tasks for this grant
  const { data: tasksData } = useQuery({
    queryKey: ['grantTasks', grantId],
    queryFn: async () => {
      if (!grantId) return { tasks: [] };

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`/api/tasks?grant_id=${grantId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch tasks');
      return response.json();
    },
    enabled: !!grantId,
  });

  // Fetch comments for this grant
  const { data: commentsData, refetch: refetchComments } = useQuery({
    queryKey: ['grantComments', grantId],
    queryFn: async () => {
      if (!grantId) return { comments: [], total_count: 0 };

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`/api/comments/grant-comments?grant_id=${grantId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch comments');

      return response.json();
    },
    enabled: !!grantId,
  });

  // Handle notes editing
  const handleEditNotes = () => {
    setNotesValue(grant?.notes || "");
    setMentionedUsers([]);
    setIsEditingNotes(true);
  };

  const handleMentionAdded = (userId: string, userName: string) => {
    setMentionedUsers(prev => [...prev, { userId, userName }]);
  };

  const handleSaveNotes = async () => {
    if (!grant) return;

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
            action_url: `/pipeline/grant/${grant.id}`,
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

      // Refetch grant data
      queryClient.invalidateQueries({ queryKey: ['grant', grantId] });
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

  const handlePrintBrief = () => {
    if (!grant) return;
    printGrantBrief(grant, tasksData?.tasks);
  };

  // Comment handlers
  const handleReply = (commentId: string, authorName?: string) => {
    setReplyingToCommentId(commentId);
    setReplyingToAuthor(authorName || null);
  };

  const handleCancelReply = () => {
    setReplyingToCommentId(null);
    setReplyingToAuthor(null);
  };

  const handleCommentSuccess = () => {
    refetchComments();
    handleCancelReply();
  };

  const handleEditComment = async (commentId: string, content: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(`/api/comments/grant-comments?id=${commentId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) throw new Error("Failed to update comment");

      refetchComments();
    } catch (error) {
      throw error;
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(`/api/comments/grant-comments?id=${commentId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) throw new Error("Failed to delete comment");

      refetchComments();
    } catch (error) {
      throw error;
    }
  };

  const handleBack = () => {
    navigate('/pipeline');
  };

  // Loading state
  if (isLoadingGrant) {
    return (
      <>
        <AppHeader />
        <Container size="lg" py="xl">
          <Center style={{ minHeight: '60vh' }}>
            <Loader size="lg" />
          </Center>
        </Container>
      </>
    );
  }

  // Grant not found
  if (!grant) {
    return (
      <>
        <AppHeader />
        <Container size="lg" py="xl">
          <Center style={{ minHeight: '60vh' }}>
            <Stack align="center">
              <Text size="xl" fw={600}>Grant not found</Text>
              <Button onClick={handleBack} leftSection={<IconArrowLeft size={16} />}>
                Back to Pipeline
              </Button>
            </Stack>
          </Center>
        </Container>
      </>
    );
  }

  const daysUntilDeadline = grant.close_date
    ? dayjs(grant.close_date).diff(dayjs(), "days")
    : null;

  const isOverdue = daysUntilDeadline !== null && daysUntilDeadline < 0;
  const isClosingSoon = daysUntilDeadline !== null && daysUntilDeadline <= 14 && daysUntilDeadline >= 0;

  return (
    <>
      <AppHeader />
      <Container size="lg" py="xl">
        <Stack gap="lg">
          {/* Back Button */}
          <Group>
            <Button
              variant="subtle"
              leftSection={<IconArrowLeft size={16} />}
              onClick={handleBack}
            >
              Back to Pipeline
            </Button>
          </Group>

          {/* Grant Header */}
          <Paper p="lg" withBorder>
            <Stack gap="md">
              <Group mb="xs" gap="xs">
                {/* Inline Priority Editor */}
                <Select
                  value={grant.priority || 'medium'}
                  onChange={(value) => {
                    if (value) {
                      updateGrantMutation.mutate({ field: 'priority', value });
                    }
                  }}
                  data={[
                    { value: 'low', label: 'Low' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'high', label: 'High' },
                    { value: 'urgent', label: 'Urgent' },
                  ]}
                  size="xs"
                  w={110}
                  styles={{
                    input: {
                      backgroundColor: grant.priority ? `var(--mantine-color-${PRIORITY_COLORS[grant.priority]}-0)` : 'var(--mantine-color-gray-0)',
                      border: `1px solid var(--mantine-color-${PRIORITY_COLORS[grant.priority || 'gray']}-3)`,
                      color: `var(--mantine-color-${PRIORITY_COLORS[grant.priority || 'gray']}-7)`,
                      fontWeight: 500,
                      cursor: 'pointer',
                    },
                  }}
                />

                {/* Inline Status Editor */}
                <Select
                  value={grant.status}
                  onChange={(value) => {
                    if (value) {
                      updateGrantMutation.mutate({ field: 'status', value });
                    }
                  }}
                  data={[
                    { value: 'researching', label: 'Researching' },
                    { value: 'drafting', label: 'Drafting' },
                    { value: 'submitted', label: 'Submitted' },
                    { value: 'awarded', label: 'Awarded' },
                  ]}
                  size="xs"
                  w={130}
                  styles={{
                    input: {
                      backgroundColor: 'var(--mantine-color-blue-0)',
                      border: '1px solid var(--mantine-color-blue-3)',
                      color: 'var(--mantine-color-blue-7)',
                      fontWeight: 500,
                      cursor: 'pointer',
                    },
                  }}
                />
              </Group>

              <Title order={2}>
                {grant.title}
              </Title>

              {grant.agency && (
                <Group gap={6}>
                  <IconBuilding size={16} style={{ color: "var(--mantine-color-gray-6)" }} />
                  <Text size="sm" c="dimmed">
                    {grant.agency}
                  </Text>
                </Group>
              )}

              {grant.aln && (
                <Text size="sm" c="dimmed">
                  ALN: {grant.aln}
                </Text>
              )}
            </Stack>
          </Paper>

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
              border: '1px solid var(--mantine-color-gray-3)',
            }}
          >
            {grant.loi_deadline && (
              <>
                <Group gap="md">
                  <IconCalendar
                    size={20}
                    style={{ color: "var(--mantine-color-blue-6)" }}
                  />
                  <div>
                    <Text size="sm" fw={500}>
                      LOI Deadline
                    </Text>
                    <Text size="sm" c="dimmed">
                      {dayjs(grant.loi_deadline).format("MMM D, YYYY")}
                    </Text>
                    {(() => {
                      const loiDaysUntil = dayjs(grant.loi_deadline).diff(dayjs(), "days");
                      const loiOverdue = loiDaysUntil < 0;
                      const loiClosingSoon = loiDaysUntil <= 14 && loiDaysUntil >= 0;
                      return (
                        <Text
                          size="xs"
                          c={loiOverdue ? "red" : loiClosingSoon ? "yellow.8" : "dimmed"}
                          mt={2}
                        >
                          {loiOverdue
                            ? `Overdue by ${Math.abs(loiDaysUntil)} days`
                            : `${loiDaysUntil} days remaining`}
                        </Text>
                      );
                    })()}
                  </div>
                </Group>
                <Divider my="sm" />
              </>
            )}
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
                  Application Deadline
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

          {/* Grant Description */}
          {grant.description && (
            <Box
              p="md"
              style={{
                backgroundColor: "var(--mantine-color-gray-0)",
                borderRadius: "var(--mantine-radius-md)",
                border: '1px solid var(--mantine-color-gray-3)',
              }}
            >
              <Text size="sm" fw={500} mb="sm">
                Description
              </Text>
              <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                {stripHtml(grant.description)}
              </Text>
            </Box>
          )}

          {/* Additional Grant Information */}
          <Box
            p="md"
            style={{
              backgroundColor: "var(--mantine-color-gray-0)",
              borderRadius: "var(--mantine-radius-md)",
              border: '1px solid var(--mantine-color-gray-3)',
            }}
          >
            <Text size="sm" fw={500} mb="sm">
              Grant Information
            </Text>
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Grant ID</Text>
                <Text size="sm" fw={500}>{grant.external_id}</Text>
              </Group>
              {grant.aln && (
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Assistance Listing Number (ALN)</Text>
                  <Text size="sm" fw={500}>{grant.aln}</Text>
                </Group>
              )}
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Source</Text>
                <Text size="sm" fw={500}>{grant.external_source}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Added to Pipeline</Text>
                <Text size="sm" fw={500}>{dayjs(grant.saved_at).format("MMM D, YYYY h:mm A")}</Text>
              </Group>
              {grant.stage_updated_at && (
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Last Stage Change</Text>
                  <Text size="sm" fw={500}>{dayjs(grant.stage_updated_at).format("MMM D, YYYY h:mm A")}</Text>
                </Group>
              )}
            </Stack>
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

          {/* Tabs for Tasks, Budget, Payments, Compliance, AI Summary, Pre-Flight Checklist, Notes, and Comments */}
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="tasks">Tasks</Tabs.Tab>
              <Tabs.Tab value="preflight" leftSection={<IconClipboardCheck size={14} />}>
                Pre-Flight Checklist
              </Tabs.Tab>
              <Tabs.Tab value="documents" leftSection={<IconFile size={14} />}>
                Documents
              </Tabs.Tab>
              <Tabs.Tab value="budget" leftSection={<IconCurrencyDollar size={14} />}>
                Budget
              </Tabs.Tab>
              <Tabs.Tab value="payments" leftSection={<IconReceipt size={14} />}>
                Payments
              </Tabs.Tab>
              <Tabs.Tab value="compliance" leftSection={<IconShieldCheck size={14} />}>
                Compliance
              </Tabs.Tab>
              <Tabs.Tab value="ai-summary" leftSection={<IconSparkles size={14} />}>
                AI Summary
              </Tabs.Tab>
              <Tabs.Tab value="notes">Notes</Tabs.Tab>
              <Tabs.Tab value="comments">
                Comments
                {commentsData?.total_count ? ` (${commentsData.total_count})` : ''}
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="tasks" pt="md">
              <TaskList grantId={grant.id} orgId={grant.org_id} />
            </Tabs.Panel>

            <Tabs.Panel value="preflight" pt="md">
              <PreFlightChecklistTab grantId={grant.id} orgId={grant.org_id} />
            </Tabs.Panel>

            <Tabs.Panel value="documents" pt="md">
              <DocumentsTab grantId={grant.id} orgId={grant.org_id} />
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

            <Tabs.Panel value="ai-summary" pt="md">
              <AISummaryTab
                grantId={grant.id}
                externalId={grant.external_id}
                grantTitle={grant.title}
                orgId={grant.org_id}
              />
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

            <Tabs.Panel value="comments" pt="md">
              <Stack gap="md">
                {/* Comment Input */}
                <CommentInput
                  grantId={grant.id}
                  orgId={grant.org_id}
                  parentCommentId={replyingToCommentId || undefined}
                  parentCommentAuthor={replyingToAuthor || undefined}
                  onSuccess={handleCommentSuccess}
                  onCancel={replyingToCommentId ? handleCancelReply : undefined}
                />

                {/* Comment Thread */}
                <CommentThread
                  comments={commentsData?.comments || []}
                  onReply={handleReply}
                  onEdit={handleEditComment}
                  onDelete={handleDeleteComment}
                  highlightCommentId={highlightCommentId}
                />
              </Stack>
            </Tabs.Panel>
          </Tabs>
        </Stack>
      </Container>
    </>
  );
}
