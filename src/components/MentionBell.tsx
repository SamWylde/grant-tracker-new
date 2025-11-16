import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ActionIcon,
  Indicator,
  Menu,
  Text,
  Stack,
  Group,
  Avatar,
  Badge,
  ScrollArea,
  Button,
  Divider,
} from "@mantine/core";
import { IconBell, IconBellFilled, IconCheck } from "@tabler/icons-react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { usePageVisibility } from "../hooks/usePageVisibility";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

interface MentionNotification {
  id: string;
  user_id: string;
  org_id: string;
  mentioned_by_user_id: string;
  grant_comment_id: string | null;
  task_comment_id: string | null;
  context_type: "grant_comment" | "task_comment";
  context_title: string | null;
  read: boolean;
  read_at: string | null;
  dismissed: boolean;
  dismissed_at: string | null;
  created_at: string;
  mentioned_by?: {
    id: string;
    email: string;
  };
  grant_comment?: {
    id: string;
    content: string;
    grant_id: string;
  };
  task_comment?: {
    id: string;
    content: string;
    task_id: string;
  };
}

interface MentionBellProps {
  orgId?: string;
}

export function MentionBell({ orgId }: MentionBellProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isPageVisible = usePageVisibility();
  const [mentions, setMentions] = useState<MentionNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [menuOpened, setMenuOpened] = useState(false);

  // Fetch mentions
  const fetchMentions = async () => {
    if (!user) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const params = new URLSearchParams({
        user_id: user.id,
        limit: "20",
      });

      if (orgId) {
        params.append("org_id", orgId);
      }

      const response = await fetch(`/api/mentions?${params}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch mentions");
      }

      const data = await response.json();
      setMentions(data.mentions || []);

      // Count unread mentions
      const unread = (data.mentions || []).filter(
        (m: MentionNotification) => !m.read && !m.dismissed
      ).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error("Failed to fetch mentions:", error);
    }
  };

  // Fetch mentions on mount and poll when page is visible
  useEffect(() => {
    // Only fetch if user exists
    if (!user) return;

    // Fetch immediately
    fetchMentions();

    // Only poll if page is visible (prevents memory leak and unnecessary API calls)
    if (!isPageVisible) return;

    // Poll for new mentions every 30 seconds when page is visible
    const interval = setInterval(fetchMentions, 30000);

    // Cleanup: Clear interval when component unmounts or page becomes hidden
    return () => {
      clearInterval(interval);
    };
  }, [user, orgId, isPageVisible]);

  // Refresh when menu is opened
  useEffect(() => {
    if (menuOpened) {
      fetchMentions();
    }
  }, [menuOpened]);

  // Mark mention as read
  const markAsRead = async (mentionId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/mentions?id=${mentionId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ read: true }),
      });

      if (response.ok) {
        fetchMentions();
      }
    } catch (error) {
      console.error("Failed to mark mention as read:", error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    if (unreadCount === 0) return;

    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch("/api/mentions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: "mark_all_read" }),
      });

      if (response.ok) {
        fetchMentions();
      }
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle mention click - navigate to context
  const handleMentionClick = async (mention: MentionNotification) => {
    // Mark as read
    if (!mention.read) {
      await markAsRead(mention.id);
    }

    // Navigate to context
    if (mention.context_type === "grant_comment" && mention.grant_comment) {
      const grantId = mention.grant_comment.grant_id;
      const commentId = mention.grant_comment.id;
      // Navigate to pipeline with grant and comment highlighted
      navigate(`/pipeline?grant=${grantId}&comment=${commentId}`);
    } else if (mention.context_type === "task_comment" && mention.task_comment) {
      const taskId = mention.task_comment.task_id;
      const commentId = mention.task_comment.id;
      // Navigate to pipeline with task comment (tasks are in grant detail drawer)
      // We need to fetch the grant_id for this task first
      try {
        const { data: task } = await supabase
          .from('tasks')
          .select('grant_id')
          .eq('id', taskId)
          .single<{ grant_id: string }>();

        if (task) {
          navigate(`/pipeline?grant=${task.grant_id}&task=${taskId}&comment=${commentId}`);
        }
      } catch (error) {
        console.error("Error fetching task:", error);
      }
    }

    setMenuOpened(false);
  };

  // Get mention author name
  const getMentionAuthor = (mention: MentionNotification) => {
    // Would need to fetch org member info to get full name
    // For now, use email
    return mention.mentioned_by?.email || "Someone";
  };

  // Get mention preview text
  const getMentionPreview = (mention: MentionNotification) => {
    const comment = mention.grant_comment || mention.task_comment;
    if (!comment) return "";

    // Truncate content
    const content = comment.content || "";
    return content.length > 100 ? content.substring(0, 100) + "..." : content;
  };

  if (!user) return null;

  return (
    <Menu
      opened={menuOpened}
      onChange={setMenuOpened}
      width={400}
      position="bottom-end"
      shadow="md"
    >
      <Menu.Target>
        <Indicator
          label={unreadCount}
          size={16}
          disabled={unreadCount === 0}
          color="red"
          offset={5}
        >
          <ActionIcon variant="subtle" size="lg">
            {unreadCount > 0 ? (
              <IconBellFilled size={20} />
            ) : (
              <IconBell size={20} />
            )}
          </ActionIcon>
        </Indicator>
      </Menu.Target>

      <Menu.Dropdown>
        <Group justify="space-between" p="xs" pb={0}>
          <Text size="sm" fw={600}>
            Mentions
          </Text>
          {unreadCount > 0 && (
            <Button
              variant="subtle"
              size="xs"
              onClick={markAllAsRead}
              loading={isLoading}
              leftSection={<IconCheck size={14} />}
            >
              Mark all read
            </Button>
          )}
        </Group>

        <Divider my="xs" />

        {mentions.length === 0 ? (
          <Text size="sm" c="dimmed" ta="center" p="lg">
            No mentions yet
          </Text>
        ) : (
          <ScrollArea h={400}>
            <Stack gap={0}>
              {mentions.map((mention) => (
                <div
                  key={mention.id}
                  style={{
                    padding: "12px",
                    cursor: "pointer",
                    backgroundColor: mention.read
                      ? "transparent"
                      : "var(--mantine-color-blue-0)",
                    borderRadius: "4px",
                  }}
                  onClick={() => handleMentionClick(mention)}
                  className="mention-item"
                >
                  <Group gap="sm" align="flex-start">
                    <Avatar size="sm" radius="xl">
                      {getMentionAuthor(mention).charAt(0).toUpperCase()}
                    </Avatar>
                    <Stack gap={4} style={{ flex: 1 }}>
                      <Group gap="xs">
                        <Text size="sm" fw={600}>
                          {getMentionAuthor(mention)}
                        </Text>
                        {mention.context_type === "grant_comment" && (
                          <Badge size="xs" variant="light" color="blue">
                            Grant
                          </Badge>
                        )}
                        {mention.context_type === "task_comment" && (
                          <Badge size="xs" variant="light" color="green">
                            Task
                          </Badge>
                        )}
                      </Group>
                      {mention.context_title && (
                        <Text size="xs" c="dimmed" lineClamp={1}>
                          {mention.context_title}
                        </Text>
                      )}
                      <Text size="xs" lineClamp={2}>
                        {getMentionPreview(mention)}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {dayjs(mention.created_at).fromNow()}
                      </Text>
                    </Stack>
                  </Group>
                </div>
              ))}
            </Stack>
          </ScrollArea>
        )}
      </Menu.Dropdown>

      <style>
        {`
          .mention-item:hover {
            background-color: var(--mantine-color-gray-1) !important;
          }
        `}
      </style>
    </Menu>
  );
}
