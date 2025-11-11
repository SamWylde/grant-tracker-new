import { useState } from 'react';
import {
  Box,
  Container,
  Title,
  Text,
  Stack,
  Group,
  Card,
  Badge,
  Avatar,
  Select,
  Loader,
  Timeline,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import {
  IconUser,
  IconClock,
  IconFilter,
  IconRefresh,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { AppHeader } from '../components/AppHeader';
import { useOrganization } from '../contexts/OrganizationContext';
import { supabase } from '../lib/supabase';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

interface Activity {
  id: string;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  description: string | null;
  created_at: string;
  user_profiles: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  org_grants_saved: {
    title: string;
    external_id: string;
  } | null;
}

interface ActivityResponse {
  activities: Activity[];
  total: number;
  limit: number;
  offset: number;
}

export function ActivityPage() {
  const { currentOrg } = useOrganization();
  const [actionFilter, setActionFilter] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery<ActivityResponse>({
    queryKey: ['activity', currentOrg?.id, actionFilter],
    queryFn: async () => {
      if (!currentOrg?.id) {
        return { activities: [], total: 0, limit: 50, offset: 0 };
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      let url = `/api/activity?org_id=${currentOrg.id}`;
      if (actionFilter) {
        url += `&action=${actionFilter}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch activity');
      }

      return response.json();
    },
    enabled: !!currentOrg?.id,
    staleTime: 30 * 1000, // 30 seconds
  });

  const getActionColor = (action: string) => {
    switch (action) {
      case 'saved':
      case 'created':
        return 'green';
      case 'deleted':
      case 'unsaved':
        return 'red';
      case 'status_changed':
        return 'blue';
      case 'priority_changed':
        return 'orange';
      case 'assigned':
        return 'grape';
      case 'note_added':
      case 'note_updated':
        return 'cyan';
      default:
        return 'gray';
    }
  };

  const getActionLabel = (action: string) => {
    return action
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (!currentOrg) {
    return (
      <Box>
        <AppHeader subtitle="Activity Feed" />
        <Container size="xl" py="xl">
          <Text>Please select an organization</Text>
        </Container>
      </Box>
    );
  }

  return (
    <Box bg="var(--mantine-color-gray-0)" mih="100vh">
      <AppHeader subtitle="Activity Feed" />

      <Container size="lg" py="xl">
        <Stack gap="lg">
          {/* Header */}
          <Group justify="space-between">
            <div>
              <Title order={1}>Activity Feed</Title>
              <Text c="dimmed" size="lg">
                Track all changes to grants in your organization
              </Text>
            </div>

            <Group>
              <Tooltip label="Refresh">
                <ActionIcon
                  variant="light"
                  size="lg"
                  onClick={() => refetch()}
                  loading={isLoading}
                >
                  <IconRefresh size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>

          {/* Filters */}
          <Card padding="md" withBorder>
            <Group>
              <Group gap="xs">
                <IconFilter size={16} />
                <Text size="sm" fw={500}>Filters</Text>
              </Group>

              <Select
                placeholder="All actions"
                value={actionFilter}
                onChange={setActionFilter}
                clearable
                data={[
                  { value: 'saved', label: 'Saved' },
                  { value: 'status_changed', label: 'Status Changed' },
                  { value: 'priority_changed', label: 'Priority Changed' },
                  { value: 'assigned', label: 'Assigned' },
                  { value: 'note_added', label: 'Note Added' },
                  { value: 'note_updated', label: 'Note Updated' },
                  { value: 'deleted', label: 'Deleted' },
                ]}
                style={{ maxWidth: 200 }}
              />
            </Group>
          </Card>

          {/* Activity Timeline */}
          {isLoading ? (
            <Card padding="xl" withBorder>
              <Group justify="center">
                <Loader size="lg" />
                <Text>Loading activity...</Text>
              </Group>
            </Card>
          ) : error ? (
            <Card padding="xl" withBorder>
              <Stack align="center" gap="md">
                <Text c="red" fw={600}>
                  Error loading activity
                </Text>
                <Text c="dimmed" ta="center">
                  {error instanceof Error ? error.message : 'An error occurred'}
                </Text>
              </Stack>
            </Card>
          ) : !data?.activities || data.activities.length === 0 ? (
            <Card padding="xl" withBorder>
              <Stack align="center" gap="md">
                <Text c="dimmed" size="lg">
                  No activity to display
                </Text>
                <Text c="dimmed" size="sm" ta="center">
                  Activity will appear here as you and your team work with grants
                </Text>
              </Stack>
            </Card>
          ) : (
            <Card padding="lg" withBorder>
              <Timeline active={-1} bulletSize={24} lineWidth={2}>
                {data.activities.map((activity) => (
                  <Timeline.Item
                    key={activity.id}
                    bullet={
                      activity.user_profiles?.avatar_url ? (
                        <Avatar
                          src={activity.user_profiles.avatar_url}
                          size={24}
                          radius="xl"
                        />
                      ) : (
                        <IconUser size={16} />
                      )
                    }
                    title={
                      <Group gap="sm">
                        <Text fw={500} size="sm">
                          {activity.user_profiles?.full_name || 'Unknown User'}
                        </Text>
                        <Badge
                          color={getActionColor(activity.action)}
                          size="sm"
                          variant="light"
                        >
                          {getActionLabel(activity.action)}
                        </Badge>
                      </Group>
                    }
                  >
                    <Stack gap="xs" mt="xs">
                      {activity.org_grants_saved && (
                        <Text size="sm" fw={500}>
                          {activity.org_grants_saved.title}
                        </Text>
                      )}

                      {activity.description && (
                        <Text size="sm" c="dimmed">
                          {activity.description}
                        </Text>
                      )}

                      {activity.field_name && (activity.old_value || activity.new_value) && (
                        <Group gap="xs">
                          {activity.old_value && (
                            <Badge variant="outline" color="red" size="sm">
                              {activity.old_value}
                            </Badge>
                          )}
                          {activity.old_value && activity.new_value && (
                            <Text size="sm" c="dimmed">→</Text>
                          )}
                          {activity.new_value && (
                            <Badge variant="outline" color="green" size="sm">
                              {activity.new_value}
                            </Badge>
                          )}
                        </Group>
                      )}

                      <Group gap="xs">
                        <IconClock size={12} />
                        <Text size="xs" c="dimmed">
                          {dayjs(activity.created_at).fromNow()}
                        </Text>
                        <Text size="xs" c="dimmed">
                          ({dayjs(activity.created_at).format('MMM D, YYYY h:mm A')})
                        </Text>
                      </Group>
                    </Stack>
                  </Timeline.Item>
                ))}
              </Timeline>

              {data.total > data.activities.length && (
                <Group justify="center" mt="xl">
                  <Text size="sm" c="dimmed">
                    Showing {data.activities.length} of {data.total} activities
                  </Text>
                </Group>
              )}
            </Card>
          )}
        </Stack>
      </Container>
    </Box>
  );
}
