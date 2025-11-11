import { useState, useEffect } from "react";
import {
  Paper,
  Stack,
  Text,
  Group,
  Badge,
  Select,
  Button,
  Divider,
  Timeline,
  Box,
  Loader,
  Center,
} from "@mantine/core";
import {
  IconMessage,
  IconAlertCircle,
  IconRefresh,
  IconChevronDown,
} from "@tabler/icons-react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

interface Activity {
  activity_type: "grant_comment" | "task_comment" | "mention";
  activity_id: string;
  org_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user_name: string | null;
  grant_title: string | null;
  task_title: string | null;
}

interface GroupedActivities {
  [date: string]: Activity[];
}

interface ActivityFeedProps {
  orgId: string;
  limit?: number;
}

export function ActivityFeed({ orgId, limit = 50 }: ActivityFeedProps) {
  const { user } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [groupedActivities, setGroupedActivities] = useState<GroupedActivities>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [currentLimit, setCurrentLimit] = useState(limit);

  // Fetch activities
  const fetchActivities = async () => {
    if (!user || !orgId) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      const params = new URLSearchParams({
        org_id: orgId,
        stream: "true",
        limit: currentLimit.toString(),
      });

      if (filter) {
        params.append("action", filter);
      }

      const response = await fetch(`/api/activity?${params}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch activity stream");
      }

      const data = await response.json();
      setActivities(data.activities || []);
      setGroupedActivities(data.grouped_by_date || {});
    } catch (err) {
      console.error("Failed to fetch activity stream:", err);
      setError(err instanceof Error ? err.message : "Failed to load activity");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchActivities();
  }, [user, orgId, filter, currentLimit]);

  // Load more activities
  const loadMore = () => {
    setCurrentLimit((prev) => prev + 50);
  };

  // Get activity icon
  const getActivityIcon = (activityType: string) => {
    switch (activityType) {
      case "grant_comment":
        return <IconMessage size={16} />;
      case "task_comment":
        return <IconMessage size={16} />;
      case "mention":
        return <IconAlertCircle size={16} />;
      default:
        return <IconMessage size={16} />;
    }
  };

  // Get activity color
  const getActivityColor = (activityType: string) => {
    switch (activityType) {
      case "grant_comment":
        return "blue";
      case "task_comment":
        return "green";
      case "mention":
        return "orange";
      default:
        return "gray";
    }
  };

  // Format activity text
  const formatActivityText = (activity: Activity) => {
    const userName = activity.user_name || "Someone";
    const context =
      activity.grant_title || activity.task_title || "a grant or task";

    switch (activity.activity_type) {
      case "grant_comment":
        return `${userName} commented on ${activity.grant_title || "a grant"}`;
      case "task_comment":
        return `${userName} commented on ${activity.task_title || "a task"}`;
      case "mention":
        return `${userName} mentioned someone in ${context}`;
      default:
        return `${userName} performed an action`;
    }
  };

  // Render activities grouped by date
  const renderGroupedActivities = () => {
    const dates = Object.keys(groupedActivities).sort().reverse();

    if (dates.length === 0) {
      return (
        <Center p="xl">
          <Text size="sm" c="dimmed">
            No activity yet
          </Text>
        </Center>
      );
    }

    return dates.map((date) => {
      const dateActivities = groupedActivities[date];
      const formattedDate = dayjs(date).format("MMMM D, YYYY");
      const isToday = dayjs(date).isSame(dayjs(), "day");
      const isYesterday = dayjs(date).isSame(dayjs().subtract(1, "day"), "day");

      let dateLabel = formattedDate;
      if (isToday) dateLabel = "Today";
      else if (isYesterday) dateLabel = "Yesterday";

      return (
        <Box key={date} mb="lg">
          <Text size="sm" fw={600} c="dimmed" mb="md">
            {dateLabel}
          </Text>

          <Timeline active={-1} bulletSize={24} lineWidth={2}>
            {dateActivities.map((activity) => (
              <Timeline.Item
                key={activity.activity_id}
                bullet={getActivityIcon(activity.activity_type)}
                title={
                  <Group gap="xs" mb={4}>
                    <Text size="sm" fw={500}>
                      {formatActivityText(activity)}
                    </Text>
                    <Badge
                      size="xs"
                      variant="light"
                      color={getActivityColor(activity.activity_type)}
                    >
                      {activity.activity_type === "grant_comment"
                        ? "Grant"
                        : activity.activity_type === "task_comment"
                        ? "Task"
                        : "Mention"}
                    </Badge>
                  </Group>
                }
              >
                <Text size="sm" c="dimmed" lineClamp={2} mb={4}>
                  {activity.content}
                </Text>
                <Text size="xs" c="dimmed">
                  {dayjs(activity.created_at).fromNow()}
                </Text>
              </Timeline.Item>
            ))}
          </Timeline>
        </Box>
      );
    });
  };

  if (!user) return null;

  return (
    <Paper p="md" withBorder radius="md">
      <Stack gap="md">
        {/* Header */}
        <Group justify="space-between">
          <Text size="lg" fw={600}>
            Activity Stream
          </Text>
          <Group gap="xs">
            <Select
              placeholder="Filter by type"
              clearable
              value={filter}
              onChange={setFilter}
              data={[
                { value: "grant_comment", label: "Grant Comments" },
                { value: "task_comment", label: "Task Comments" },
                { value: "mention", label: "Mentions" },
              ]}
              size="xs"
              style={{ width: 150 }}
            />
            <Button
              variant="subtle"
              size="xs"
              onClick={fetchActivities}
              loading={isLoading}
              leftSection={<IconRefresh size={14} />}
            >
              Refresh
            </Button>
          </Group>
        </Group>

        <Divider />

        {/* Loading State */}
        {isLoading && activities.length === 0 && (
          <Center p="xl">
            <Loader size="sm" />
          </Center>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <Center p="xl">
            <Stack gap="xs" align="center">
              <IconAlertCircle size={32} color="var(--mantine-color-red-6)" />
              <Text size="sm" c="red">
                {error}
              </Text>
              <Button size="xs" onClick={fetchActivities}>
                Try again
              </Button>
            </Stack>
          </Center>
        )}

        {/* Activities */}
        {!isLoading && !error && renderGroupedActivities()}

        {/* Load More */}
        {activities.length >= currentLimit && !isLoading && (
          <Button
            variant="light"
            fullWidth
            onClick={loadMore}
            leftSection={<IconChevronDown size={16} />}
          >
            Load More
          </Button>
        )}
      </Stack>
    </Paper>
  );
}
