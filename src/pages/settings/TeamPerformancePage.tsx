import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Stack,
  Title,
  Text,
  Divider,
  Paper,
  Group,
  Badge,
  SimpleGrid,
  Select,
  Table,
  Avatar,
  Progress,
  Center,
  Loader,
  Box,
  Card,
  ThemeIcon,
} from '@mantine/core';
import {
  IconTrophy,
  IconMedal,
  IconTarget,
  IconChartBar,
  IconAward,
  IconFileCheck,
  IconCurrencyDollar,
} from '@tabler/icons-react';
import { SettingsLayout } from '../../components/SettingsLayout';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { useOrganization } from '../../contexts/OrganizationContext';
import { supabase } from '../../lib/supabase';

interface TeamMemberMetrics {
  userId: string;
  fullName: string;
  email: string;
  role: string;
  metrics: {
    grantsOwned: number;
    grantsSubmitted: number;
    grantsAwarded: number;
    submissionRate: number;
    successRate: number;
    avgTimeToSubmit: number;
    totalAwardedAmount: number;
  };
  rank?: number;
}

interface PerformanceData {
  timeframe: {
    start: string | null;
    end: string;
    label: string;
  };
  teamMembers: TeamMemberMetrics[];
  leaderboard: TeamMemberMetrics[];
}

export function TeamPerformancePage() {
  const { currentOrg } = useOrganization();
  const [timeframe, setTimeframe] = useState<string>('all');

  // Fetch team performance data
  const { data: performanceData, isLoading } = useQuery<PerformanceData>({
    queryKey: ['teamPerformance', currentOrg?.id, timeframe],
    queryFn: async () => {
      if (!currentOrg) throw new Error('No organization');

      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) throw new Error('No auth token');

      const response = await fetch(`/api/team-performance?orgId=${currentOrg.id}&timeframe=${timeframe}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch team performance data');
      }

      return response.json();
    },
    enabled: !!currentOrg,
  });

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRankColor = (rank?: number) => {
    if (!rank) return 'gray';
    if (rank === 1) return 'yellow';
    if (rank === 2) return 'gray';
    if (rank === 3) return 'orange';
    return 'blue';
  };

  const getRankIcon = (rank?: number) => {
    if (!rank) return IconMedal;
    if (rank === 1) return IconTrophy;
    if (rank === 2) return IconMedal;
    if (rank === 3) return IconMedal;
    return IconMedal;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (!currentOrg) {
    return (
      <ProtectedRoute>
        <SettingsLayout>
          <Text>Loading...</Text>
        </SettingsLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <SettingsLayout>
        <Stack gap="lg">
          {/* Header */}
          <Group justify="space-between" align="flex-start">
            <Stack gap="sm">
              <Title order={1}>Team Performance</Title>
              <Text c="dimmed" size="lg">
                Track individual contributor metrics and team leaderboard
              </Text>
            </Stack>
            <Select
              value={timeframe}
              onChange={(value) => value && setTimeframe(value)}
              data={[
                { value: 'all', label: 'All Time' },
                { value: '30days', label: 'Last 30 Days' },
                { value: '90days', label: 'Last 90 Days' },
              ]}
              w={200}
            />
          </Group>

          <Divider />

          {isLoading ? (
            <Center h={400}>
              <Stack align="center" gap="md">
                <Loader size="lg" />
                <Text c="dimmed">Loading performance data...</Text>
              </Stack>
            </Center>
          ) : !performanceData || performanceData.teamMembers.length === 0 ? (
            <Paper p="xl" withBorder>
              <Center>
                <Stack align="center" gap="md">
                  <IconChartBar size={48} stroke={1.5} color="var(--mantine-color-gray-5)" />
                  <Text c="dimmed" ta="center">
                    No performance data available yet
                  </Text>
                </Stack>
              </Center>
            </Paper>
          ) : (
            <>
              {/* Leaderboard Section */}
              <Paper p="md" withBorder>
                <Stack gap="md">
                  <Group>
                    <ThemeIcon size="lg" variant="light" color="grape">
                      <IconTrophy size={20} />
                    </ThemeIcon>
                    <div>
                      <Title order={3} size="h4">
                        Leaderboard
                      </Title>
                      <Text size="sm" c="dimmed">
                        Top performers ranked by success rate and submission rate
                      </Text>
                    </div>
                  </Group>

                  <Divider />

                  <Stack gap="xs">
                    {performanceData.leaderboard.slice(0, 10).map((member) => {
                      const RankIcon = getRankIcon(member.rank);
                      return (
                        <Card key={member.userId} p="md" withBorder>
                          <Group justify="space-between" wrap="nowrap">
                            <Group>
                              <ThemeIcon size="xl" variant="light" color={getRankColor(member.rank)} radius="xl">
                                <RankIcon size={24} />
                              </ThemeIcon>
                              <Box>
                                <Group gap="xs">
                                  <Text size="lg" fw={700}>
                                    #{member.rank}
                                  </Text>
                                  <Text fw={600}>{member.fullName}</Text>
                                  {member.rank && member.rank <= 3 && (
                                    <Badge size="sm" color={getRankColor(member.rank)} variant="light">
                                      {member.rank === 1 ? '1st' : member.rank === 2 ? '2nd' : '3rd'} Place
                                    </Badge>
                                  )}
                                </Group>
                                <Text size="xs" c="dimmed">
                                  {member.email}
                                </Text>
                              </Box>
                            </Group>
                            <Group gap="xl">
                              <Box ta="center" miw={80}>
                                <Text size="xl" fw={700} c="grape">
                                  {member.metrics.successRate.toFixed(1)}%
                                </Text>
                                <Text size="xs" c="dimmed">
                                  Success Rate
                                </Text>
                              </Box>
                              <Box ta="center" miw={80}>
                                <Text size="xl" fw={700} c="blue">
                                  {member.metrics.submissionRate.toFixed(1)}%
                                </Text>
                                <Text size="xs" c="dimmed">
                                  Submission
                                </Text>
                              </Box>
                              <Box ta="center" miw={80}>
                                <Text size="xl" fw={700} c="green">
                                  {member.metrics.grantsAwarded}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  Awarded
                                </Text>
                              </Box>
                            </Group>
                          </Group>
                        </Card>
                      );
                    })}
                  </Stack>
                </Stack>
              </Paper>

              {/* Individual Metrics Section */}
              <Paper p="md" withBorder>
                <Stack gap="md">
                  <Group>
                    <ThemeIcon size="lg" variant="light" color="blue">
                      <IconChartBar size={20} />
                    </ThemeIcon>
                    <div>
                      <Title order={3} size="h4">
                        Individual Contributor Metrics
                      </Title>
                      <Text size="sm" c="dimmed">
                        Detailed performance breakdown for each team member
                      </Text>
                    </div>
                  </Group>

                  <Divider />

                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Team Member</Table.Th>
                        <Table.Th ta="center">Grants Owned</Table.Th>
                        <Table.Th ta="center">Submitted</Table.Th>
                        <Table.Th ta="center">Submission Rate</Table.Th>
                        <Table.Th ta="center">Awarded</Table.Th>
                        <Table.Th ta="center">Success Rate</Table.Th>
                        <Table.Th ta="center">Avg Time to Submit</Table.Th>
                        <Table.Th ta="right">Total Awarded</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {performanceData.teamMembers.map((member) => (
                        <Table.Tr key={member.userId}>
                          <Table.Td>
                            <Group gap="sm">
                              <Avatar size={32} radius="xl" color="grape">
                                {getInitials(member.fullName)}
                              </Avatar>
                              <Box>
                                <Text size="sm" fw={500}>
                                  {member.fullName}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  {member.role === 'admin' ? 'Admin' : 'Contributor'}
                                </Text>
                              </Box>
                            </Group>
                          </Table.Td>
                          <Table.Td ta="center">
                            <Badge variant="light" color="gray">
                              {member.metrics.grantsOwned}
                            </Badge>
                          </Table.Td>
                          <Table.Td ta="center">
                            <Badge variant="light" color="blue">
                              {member.metrics.grantsSubmitted}
                            </Badge>
                          </Table.Td>
                          <Table.Td ta="center">
                            <Group justify="center" gap="xs">
                              <Progress.Root size="xl" w={60}>
                                <Progress.Section
                                  value={member.metrics.submissionRate}
                                  color={
                                    member.metrics.submissionRate >= 75
                                      ? 'green'
                                      : member.metrics.submissionRate >= 50
                                        ? 'yellow'
                                        : 'red'
                                  }
                                />
                              </Progress.Root>
                              <Text size="sm" fw={500}>
                                {member.metrics.submissionRate.toFixed(1)}%
                              </Text>
                            </Group>
                          </Table.Td>
                          <Table.Td ta="center">
                            <Badge variant="light" color="green">
                              {member.metrics.grantsAwarded}
                            </Badge>
                          </Table.Td>
                          <Table.Td ta="center">
                            <Group justify="center" gap="xs">
                              <Progress.Root size="xl" w={60}>
                                <Progress.Section
                                  value={member.metrics.successRate}
                                  color={
                                    member.metrics.successRate >= 50
                                      ? 'green'
                                      : member.metrics.successRate >= 25
                                        ? 'yellow'
                                        : 'orange'
                                  }
                                />
                              </Progress.Root>
                              <Text size="sm" fw={500}>
                                {member.metrics.successRate.toFixed(1)}%
                              </Text>
                            </Group>
                          </Table.Td>
                          <Table.Td ta="center">
                            <Text size="sm" fw={500}>
                              {member.metrics.avgTimeToSubmit > 0
                                ? `${member.metrics.avgTimeToSubmit.toFixed(1)} days`
                                : 'N/A'}
                            </Text>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Text size="sm" fw={500} c={member.metrics.totalAwardedAmount > 0 ? 'green' : 'dimmed'}>
                              {formatCurrency(member.metrics.totalAwardedAmount)}
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Stack>
              </Paper>

              {/* Summary Cards */}
              <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
                <Card p="md" withBorder>
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        Total Grants
                      </Text>
                      <ThemeIcon size="sm" variant="light" color="blue">
                        <IconFileCheck size={16} />
                      </ThemeIcon>
                    </Group>
                    <Text size="xl" fw={700}>
                      {performanceData.teamMembers.reduce((sum, m) => sum + m.metrics.grantsOwned, 0)}
                    </Text>
                  </Stack>
                </Card>

                <Card p="md" withBorder>
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        Total Submitted
                      </Text>
                      <ThemeIcon size="sm" variant="light" color="grape">
                        <IconTarget size={16} />
                      </ThemeIcon>
                    </Group>
                    <Text size="xl" fw={700}>
                      {performanceData.teamMembers.reduce((sum, m) => sum + m.metrics.grantsSubmitted, 0)}
                    </Text>
                  </Stack>
                </Card>

                <Card p="md" withBorder>
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        Total Awarded
                      </Text>
                      <ThemeIcon size="sm" variant="light" color="green">
                        <IconAward size={16} />
                      </ThemeIcon>
                    </Group>
                    <Text size="xl" fw={700}>
                      {performanceData.teamMembers.reduce((sum, m) => sum + m.metrics.grantsAwarded, 0)}
                    </Text>
                  </Stack>
                </Card>

                <Card p="md" withBorder>
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        Total Awarded Amount
                      </Text>
                      <ThemeIcon size="sm" variant="light" color="teal">
                        <IconCurrencyDollar size={16} />
                      </ThemeIcon>
                    </Group>
                    <Text size="xl" fw={700}>
                      {formatCurrency(
                        performanceData.teamMembers.reduce((sum, m) => sum + m.metrics.totalAwardedAmount, 0)
                      )}
                    </Text>
                  </Stack>
                </Card>
              </SimpleGrid>
            </>
          )}
        </Stack>
      </SettingsLayout>
    </ProtectedRoute>
  );
}
