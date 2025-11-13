import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Stack,
  Title,
  Text,
  Paper,
  Group,
  SimpleGrid,
  Badge,
  Select,
  RingProgress,
  Center,
  ThemeIcon,
  Divider,
  Alert,
  Skeleton,
  Button,
} from '@mantine/core';
import {
  IconTrophy,
  IconTarget,
  IconClock,
  IconRocket,
  IconTrendingUp,
  IconCalendarCheck,
  IconAlertCircle,
  IconRefresh,
  IconChartBar,
} from '@tabler/icons-react';
import { AppHeader } from '../components/AppHeader';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useOrganization } from '../contexts/OrganizationContext';
import { supabase } from '../lib/supabase';

interface MetricsSummary {
  totalGrantsSaved: number;
  totalGrantsSubmitted: number;
  totalGrantsAwarded: number;
  deadlinesMet: number;
  deadlinesMissed: number;
  deadlineSuccessRate: number;
  avgDaysToSubmit: number;
  totalAwardedAmount: number;
  avgAwardAmount: number;
  baselineMissedDeadlines: number;
}

interface MetricsData {
  summary: MetricsSummary;
  timeframe: {
    start: string | null;
    end: string;
    label: string;
  };
  recentActivity: {
    last30Days: {
      grantsSaved: number;
      grantsSubmitted: number;
    };
  };
}

export function MetricsPage() {
  const { currentOrg } = useOrganization();
  const [timeframe, setTimeframe] = useState<string>('all');

  const { data: metricsData, isLoading, isError, error, refetch } = useQuery<MetricsData>({
    queryKey: ['metrics', currentOrg?.id, timeframe],
    queryFn: async () => {
      if (!currentOrg) throw new Error('No organization selected');

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          orgId: currentOrg.id,
          timeframe,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch metrics');
      }

      return response.json();
    },
    enabled: !!currentOrg,
    retry: 2,
  });

  const summary = metricsData?.summary;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getDeadlineColor = (rate: number) => {
    if (rate >= 90) return 'green';
    if (rate >= 70) return 'blue';
    if (rate >= 50) return 'yellow';
    return 'red';
  };

  const getImprovementText = (baseline: number, current: number) => {
    if (baseline === 0 || current === 0) return null;
    const improvement = baseline - current;
    if (improvement > 0) {
      return `${improvement} fewer missed deadlines vs baseline`;
    }
    return null;
  };

  return (
    <ProtectedRoute>
      <AppHeader subtitle="Metrics" />
      <Stack gap="lg" p="md" maw={1400} mx="auto">
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={1}>Metrics</Title>
            <Text c="dimmed" size="lg">
              Track your team's performance and demonstrate ROI
            </Text>
          </div>
          <Select
            label="Time Period"
            value={timeframe}
            onChange={(value) => setTimeframe(value || 'all')}
            data={[
              { value: 'all', label: 'All Time' },
              { value: '30days', label: 'Last 30 Days' },
              { value: '60days', label: 'Last 60 Days' },
              { value: '90days', label: 'Last 90 Days' },
            ]}
            w={180}
          />
        </Group>

        {/* Loading State */}
        {isLoading && (
          <>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
              {[1, 2, 3, 4].map((i) => (
                <Paper key={i} p="lg" withBorder>
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Skeleton height={48} width={48} radius="md" />
                      <Skeleton height={28} width={60} radius="sm" />
                    </Group>
                    <Skeleton height={20} width="60%" />
                    <Skeleton height={40} width="80%" />
                    <Center>
                      <Skeleton height={120} width={120} circle />
                    </Center>
                  </Stack>
                </Paper>
              ))}
            </SimpleGrid>
            <Skeleton height={200} />
          </>
        )}

        {/* Error State */}
        {isError && (
          <Alert
            icon={<IconAlertCircle size={20} />}
            title="Failed to load metrics"
            color="red"
            variant="light"
          >
            <Stack gap="md">
              <Text size="sm">
                {error instanceof Error ? error.message : 'An error occurred while loading metrics'}
              </Text>
              <Button
                leftSection={<IconRefresh size={16} />}
                onClick={() => refetch()}
                variant="light"
                size="sm"
              >
                Retry
              </Button>
            </Stack>
          </Alert>
        )}

        {!isLoading && !isError && summary && (
          <>
            {/* Key Metrics Cards */}
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
              {/* Deadline Success Rate */}
              <Paper p="lg" withBorder>
                <Stack gap="md">
                  <Group justify="space-between">
                    <ThemeIcon
                      size={48}
                      radius="md"
                      variant="light"
                      color={getDeadlineColor(summary.deadlineSuccessRate)}
                    >
                      <IconTarget size={24} />
                    </ThemeIcon>
                    <Badge size="lg" color={getDeadlineColor(summary.deadlineSuccessRate)}>
                      {summary.totalGrantsSubmitted > 0 ? 'Active' : 'No data'}
                    </Badge>
                  </Group>
                  <div>
                    <Text size="sm" c="dimmed" mb={4}>
                      Deadline Success Rate
                    </Text>
                    <Group align="baseline" gap={4}>
                      <Text size="2rem" fw={700}>
                        {summary.deadlineSuccessRate}%
                      </Text>
                    </Group>
                    <Text size="xs" c="dimmed" mt={4}>
                      {summary.deadlinesMet} met / {summary.deadlinesMissed} missed
                    </Text>
                  </div>
                  <Center>
                    <RingProgress
                      size={120}
                      thickness={12}
                      sections={[
                        {
                          value: summary.deadlineSuccessRate,
                          color: getDeadlineColor(summary.deadlineSuccessRate),
                        },
                      ]}
                      label={
                        <Center>
                          <IconCalendarCheck size={28} color="var(--mantine-color-gray-6)" />
                        </Center>
                      }
                    />
                  </Center>
                </Stack>
              </Paper>

              {/* Grants Submitted */}
              <Paper p="lg" withBorder>
                <Stack gap="md">
                  <Group justify="space-between">
                    <ThemeIcon size={48} radius="md" variant="light" color="blue">
                      <IconRocket size={24} />
                    </ThemeIcon>
                    <Badge size="lg" color="blue">
                      Submissions
                    </Badge>
                  </Group>
                  <div>
                    <Text size="sm" c="dimmed" mb={4}>
                      Grants Submitted
                    </Text>
                    <Group align="baseline" gap={4}>
                      <Text size="2rem" fw={700}>
                        {summary.totalGrantsSubmitted}
                      </Text>
                      <Text size="sm" c="dimmed">
                        / {summary.totalGrantsSaved}
                      </Text>
                    </Group>
                    <Text size="xs" c="dimmed" mt={4}>
                      {summary.totalGrantsSaved > 0
                        ? Math.round((summary.totalGrantsSubmitted / summary.totalGrantsSaved) * 100)
                        : 0}
                      % of saved grants
                    </Text>
                  </div>
                  {metricsData?.recentActivity && (
                    <Alert icon={<IconTrendingUp size={16} />} color="blue" p="xs">
                      <Text size="xs">
                        {metricsData.recentActivity.last30Days.grantsSubmitted} submitted in last 30 days
                      </Text>
                    </Alert>
                  )}
                </Stack>
              </Paper>

              {/* Awards Won */}
              <Paper p="lg" withBorder>
                <Stack gap="md">
                  <Group justify="space-between">
                    <ThemeIcon size={48} radius="md" variant="light" color="grape">
                      <IconTrophy size={24} />
                    </ThemeIcon>
                    <Badge size="lg" color="grape">
                      Awards
                    </Badge>
                  </Group>
                  <div>
                    <Text size="sm" c="dimmed" mb={4}>
                      Awards Won
                    </Text>
                    <Group align="baseline" gap={4}>
                      <Text size="2rem" fw={700}>
                        {summary.totalGrantsAwarded}
                      </Text>
                    </Group>
                    <Text size="xs" c="dimmed" mt={4}>
                      {summary.totalGrantsSubmitted > 0
                        ? Math.round((summary.totalGrantsAwarded / summary.totalGrantsSubmitted) * 100)
                        : 0}
                      % win rate
                    </Text>
                  </div>
                  {summary.totalAwardedAmount > 0 && (
                    <Alert icon={<IconChartBar size={16} />} color="grape" p="xs">
                      <Text size="xs" fw={600}>
                        {formatCurrency(summary.totalAwardedAmount)} total awarded
                      </Text>
                    </Alert>
                  )}
                </Stack>
              </Paper>

              {/* Time to Submit */}
              <Paper p="lg" withBorder>
                <Stack gap="md">
                  <Group justify="space-between">
                    <ThemeIcon size={48} radius="md" variant="light" color="orange">
                      <IconClock size={24} />
                    </ThemeIcon>
                    <Badge size="lg" color="orange">
                      Efficiency
                    </Badge>
                  </Group>
                  <div>
                    <Text size="sm" c="dimmed" mb={4}>
                      Avg Time to Submit
                    </Text>
                    <Group align="baseline" gap={4}>
                      <Text size="2rem" fw={700}>
                        {summary.avgDaysToSubmit || 0}
                      </Text>
                      <Text size="sm" c="dimmed">
                        days
                      </Text>
                    </Group>
                    <Text size="xs" c="dimmed" mt={4}>
                      From save to submission
                    </Text>
                  </div>
                  {summary.avgDaysToSubmit > 0 && (
                    <Alert icon={<IconAlertCircle size={16} />} color="orange" p="xs">
                      <Text size="xs">
                        {summary.avgDaysToSubmit < 14 ? 'Fast turnaround!' : 'Room for improvement'}
                      </Text>
                    </Alert>
                  )}
                </Stack>
              </Paper>
            </SimpleGrid>

            {/* Detailed Metrics */}
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
              {/* Deadline Performance */}
              <Paper p="lg" withBorder>
                <Stack gap="md">
                  <Group justify="space-between">
                    <div>
                      <Title order={3} size="h4">
                        Deadline Performance
                      </Title>
                      <Text size="sm" c="dimmed">
                        Track deadline adherence over time
                      </Text>
                    </div>
                    <ThemeIcon size={40} radius="md" variant="light" color="green">
                      <IconCalendarCheck size={20} />
                    </ThemeIcon>
                  </Group>

                  <Divider />

                  <Group justify="space-between">
                    <Text size="sm" fw={500}>
                      Deadlines Met
                    </Text>
                    <Badge color="green" size="lg">
                      {summary.deadlinesMet}
                    </Badge>
                  </Group>

                  <Group justify="space-between">
                    <Text size="sm" fw={500}>
                      Deadlines Missed
                    </Text>
                    <Badge color="red" size="lg">
                      {summary.deadlinesMissed}
                    </Badge>
                  </Group>

                  <Group justify="space-between">
                    <Text size="sm" fw={500}>
                      Success Rate
                    </Text>
                    <Badge color={getDeadlineColor(summary.deadlineSuccessRate)} size="lg">
                      {summary.deadlineSuccessRate}%
                    </Badge>
                  </Group>

                  {getImprovementText(summary.baselineMissedDeadlines, summary.deadlinesMissed) && (
                    <>
                      <Divider />
                      <Alert icon={<IconTrendingUp size={16} />} color="green">
                        <Text size="sm" fw={600}>
                          {getImprovementText(summary.baselineMissedDeadlines, summary.deadlinesMissed)}
                        </Text>
                        <Text size="xs" c="dimmed" mt={4}>
                          Improvement since starting to track metrics
                        </Text>
                      </Alert>
                    </>
                  )}
                </Stack>
              </Paper>

              {/* Funding Performance */}
              <Paper p="lg" withBorder>
                <Stack gap="md">
                  <Group justify="space-between">
                    <div>
                      <Title order={3} size="h4">
                        Funding Performance
                      </Title>
                      <Text size="sm" c="dimmed">
                        Awards and funding secured
                      </Text>
                    </div>
                    <ThemeIcon size={40} radius="md" variant="light" color="grape">
                      <IconTrophy size={20} />
                    </ThemeIcon>
                  </Group>

                  <Divider />

                  <Group justify="space-between">
                    <Text size="sm" fw={500}>
                      Total Awards Won
                    </Text>
                    <Badge color="grape" size="lg">
                      {summary.totalGrantsAwarded}
                    </Badge>
                  </Group>

                  <Group justify="space-between">
                    <Text size="sm" fw={500}>
                      Total Funding Secured
                    </Text>
                    <Text size="lg" fw={700} c="grape">
                      {formatCurrency(summary.totalAwardedAmount)}
                    </Text>
                  </Group>

                  {summary.totalGrantsAwarded > 0 && (
                    <>
                      <Group justify="space-between">
                        <Text size="sm" fw={500}>
                          Average Award
                        </Text>
                        <Text size="lg" fw={600}>
                          {formatCurrency(summary.avgAwardAmount)}
                        </Text>
                      </Group>

                      <Group justify="space-between">
                        <Text size="sm" fw={500}>
                          Win Rate
                        </Text>
                        <Badge color="grape" size="lg">
                          {summary.totalGrantsSubmitted > 0
                            ? Math.round((summary.totalGrantsAwarded / summary.totalGrantsSubmitted) * 100)
                            : 0}
                          %
                        </Badge>
                      </Group>
                    </>
                  )}

                  {summary.totalGrantsAwarded === 0 && (
                    <Alert icon={<IconAlertCircle size={16} />} color="blue">
                      <Text size="sm">No awards tracked yet. Update grant statuses to see funding metrics.</Text>
                    </Alert>
                  )}
                </Stack>
              </Paper>
            </SimpleGrid>

            {/* Getting Started Guide */}
            {summary.totalGrantsSubmitted === 0 && (
              <Alert icon={<IconAlertCircle size={16} />} color="blue" title="Start Tracking Your Success">
                <Text size="sm" mb="xs">
                  To see your value metrics, mark grants as submitted when you complete applications. Here's how:
                </Text>
                <Text size="sm" component="ol" style={{ paddingLeft: '1.5rem' }}>
                  <li>Go to your Saved Grants page</li>
                  <li>When you submit a grant application, mark it as "Submitted"</li>
                  <li>Add submission details like date and requested amount</li>
                  <li>When you hear back, update the status to "Awarded" or "Rejected"</li>
                  <li>Return here to see your performance metrics and ROI</li>
                </Text>
              </Alert>
            )}
          </>
        )}

        {!isLoading && !isError && !summary && (
          <Paper p="xl" withBorder>
            <Center>
              <Stack align="center" gap="md">
                <ThemeIcon size={64} radius="md" variant="light" color="gray">
                  <IconChartBar size={32} />
                </ThemeIcon>
                <Title order={3}>No Data Available</Title>
                <Text c="dimmed" ta="center" maw={400}>
                  Start tracking grants and submissions to see your performance metrics here.
                </Text>
              </Stack>
            </Center>
          </Paper>
        )}
      </Stack>
    </ProtectedRoute>
  );
}
