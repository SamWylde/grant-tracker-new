import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Stack,
  Title,
  Text,
  Paper,
  Group,
  Select,
  Button,
  Tabs,
  Table,
  Badge,
  Skeleton,
  Alert,
  SimpleGrid,
  Accordion,
  ThemeIcon,
} from '@mantine/core';
import {
  IconChartBar,
  IconDownload,
  IconBuilding,
  IconFolders,
  IconAlertCircle,
  IconRefresh,
  IconTrendingUp,
  IconCurrencyDollar,
} from '@tabler/icons-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { AppHeader } from '../components/AppHeader';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useOrganization } from '../contexts/OrganizationContext';
import { supabase } from '../lib/supabase';

interface AgencyBreakdown {
  agency: string;
  totalFunding: number;
  grantCount: number;
  averageFunding: number;
  programs: ProgramBreakdown[];
  statusBreakdown: Record<string, number>;
}

interface ProgramBreakdown {
  program: string;
  totalFunding: number;
  grantCount: number;
  averageFunding: number;
  statusBreakdown: Record<string, number>;
}

interface TimelineDataPoint {
  period: string;
  agency: string;
  program: string | null;
  funding: number;
  grantCount: number;
}

interface ReportData {
  agencyBreakdown: AgencyBreakdown[];
  programBreakdown: ProgramBreakdown[];
  timeline: TimelineDataPoint[];
  filters: any;
  generatedAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  awarded: 'green',
  submitted: 'blue',
  in_progress: 'yellow',
  saved: 'gray',
  rejected: 'red',
  withdrawn: 'orange',
};

export function AnalyticsPage() {
  const { currentOrg } = useOrganization();
  const [timeframe, setTimeframe] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<string>('agency');
  const [downloadingCsv, setDownloadingCsv] = useState(false);

  const { data: reportData, isLoading, isError, error, refetch } = useQuery<ReportData>({
    queryKey: ['agencyProgramBreakdown', currentOrg?.id, timeframe, statusFilter],
    queryFn: async () => {
      if (!currentOrg) throw new Error('No organization selected');

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Calculate date range
      let startDate: string | undefined;
      const endDate = new Date().toISOString();

      if (timeframe === '30days') {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        startDate = date.toISOString();
      } else if (timeframe === '90days') {
        const date = new Date();
        date.setDate(date.getDate() - 90);
        startDate = date.toISOString();
      } else if (timeframe === '1year') {
        const date = new Date();
        date.setFullYear(date.getFullYear() - 1);
        startDate = date.toISOString();
      }

      const response = await fetch('/api/reports/agency-program-breakdown', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          org_id: currentOrg.id,
          group_by: 'both',
          start_date: startDate,
          end_date: endDate,
          status: statusFilter === 'all' ? undefined : [statusFilter],
          timeline_granularity: 'month',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch report data');
      }

      return response.json();
    },
    enabled: !!currentOrg,
    retry: 2,
  });

  const handleExportCsv = async () => {
    if (!currentOrg) return;

    setDownloadingCsv(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      let startDate: string | undefined;
      const endDate = new Date().toISOString();

      if (timeframe === '30days') {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        startDate = date.toISOString();
      } else if (timeframe === '90days') {
        const date = new Date();
        date.setDate(date.getDate() - 90);
        startDate = date.toISOString();
      } else if (timeframe === '1year') {
        const date = new Date();
        date.setFullYear(date.getFullYear() - 1);
        startDate = date.toISOString();
      }

      const response = await fetch('/api/reports/agency-program-breakdown', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          org_id: currentOrg.id,
          group_by: 'both',
          start_date: startDate,
          end_date: endDate,
          status: statusFilter === 'all' ? undefined : [statusFilter],
          format: 'csv',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to export CSV');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `agency-program-breakdown-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error exporting CSV:', err);
    } finally {
      setDownloadingCsv(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Prepare chart data
  const agencyChartData = reportData?.agencyBreakdown.slice(0, 10).map((agency) => ({
    name: agency.agency.length > 20 ? agency.agency.substring(0, 20) + '...' : agency.agency,
    funding: agency.totalFunding,
    grants: agency.grantCount,
  })) || [];

  const programChartData = reportData?.programBreakdown.slice(0, 10).map((program) => ({
    name: program.program.length > 20 ? program.program.substring(0, 20) + '...' : program.program,
    funding: program.totalFunding,
    grants: program.grantCount,
  })) || [];

  // Timeline chart data
  const timelineChartData = (() => {
    if (!reportData?.timeline) return [];

    const periodMap = new Map<string, { period: string; funding: number; grants: number }>();

    reportData.timeline.forEach((point) => {
      const existing = periodMap.get(point.period);
      if (existing) {
        existing.funding += point.funding;
        existing.grants += point.grantCount;
      } else {
        periodMap.set(point.period, {
          period: point.period,
          funding: point.funding,
          grants: point.grantCount,
        });
      }
    });

    return Array.from(periodMap.values()).sort((a, b) => a.period.localeCompare(b.period));
  })();

  // Calculate summary statistics
  const totalFunding = reportData?.agencyBreakdown.reduce((sum, agency) => sum + agency.totalFunding, 0) || 0;
  const totalGrants = reportData?.agencyBreakdown.reduce((sum, agency) => sum + agency.grantCount, 0) || 0;
  const avgFunding = totalGrants > 0 ? totalFunding / totalGrants : 0;
  const agencyCount = reportData?.agencyBreakdown.length || 0;

  return (
    <ProtectedRoute>
      <AppHeader subtitle="Analytics" />
      <Stack gap="lg" p="md" maw={1400} mx="auto">
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={1}>Agency & Program Analytics</Title>
            <Text c="dimmed" size="lg">
              Funding breakdown by agency and program
            </Text>
          </div>
          <Group>
            <Select
              label="Timeframe"
              value={timeframe}
              onChange={(value) => setTimeframe(value || 'all')}
              data={[
                { value: 'all', label: 'All Time' },
                { value: '30days', label: 'Last 30 Days' },
                { value: '90days', label: 'Last 90 Days' },
                { value: '1year', label: 'Last Year' },
              ]}
              w={150}
            />
            <Select
              label="Status"
              value={statusFilter}
              onChange={(value) => setStatusFilter(value || 'all')}
              data={[
                { value: 'all', label: 'All Statuses' },
                { value: 'awarded', label: 'Awarded' },
                { value: 'submitted', label: 'Submitted' },
                { value: 'in_progress', label: 'In Progress' },
                { value: 'saved', label: 'Saved' },
              ]}
              w={150}
            />
            <Button
              leftSection={<IconDownload size={16} />}
              onClick={handleExportCsv}
              loading={downloadingCsv}
              variant="light"
            >
              Export CSV
            </Button>
          </Group>
        </Group>

        {/* Loading State */}
        {isLoading && (
          <>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} height={120} />
              ))}
            </SimpleGrid>
            <Skeleton height={400} />
          </>
        )}

        {/* Error State */}
        {isError && (
          <Alert
            icon={<IconAlertCircle size={20} />}
            title="Failed to load analytics"
            color="red"
            variant="light"
          >
            <Stack gap="md">
              <Text size="sm">
                {error instanceof Error ? error.message : 'An error occurred while loading analytics'}
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

        {!isLoading && !isError && reportData && (
          <>
            {/* Summary Cards */}
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
              <Paper p="lg" withBorder>
                <Group justify="apart" mb="xs">
                  <Text size="sm" c="dimmed">
                    Total Funding
                  </Text>
                  <ThemeIcon size={40} radius="md" variant="light" color="grape">
                    <IconCurrencyDollar size={20} />
                  </ThemeIcon>
                </Group>
                <Text size="2rem" fw={700}>
                  {formatCurrency(totalFunding)}
                </Text>
                <Text size="xs" c="dimmed" mt={4}>
                  Across all grants
                </Text>
              </Paper>

              <Paper p="lg" withBorder>
                <Group justify="apart" mb="xs">
                  <Text size="sm" c="dimmed">
                    Total Grants
                  </Text>
                  <ThemeIcon size={40} radius="md" variant="light" color="blue">
                    <IconChartBar size={20} />
                  </ThemeIcon>
                </Group>
                <Text size="2rem" fw={700}>
                  {totalGrants}
                </Text>
                <Text size="xs" c="dimmed" mt={4}>
                  Grant opportunities
                </Text>
              </Paper>

              <Paper p="lg" withBorder>
                <Group justify="apart" mb="xs">
                  <Text size="sm" c="dimmed">
                    Agencies
                  </Text>
                  <ThemeIcon size={40} radius="md" variant="light" color="teal">
                    <IconBuilding size={20} />
                  </ThemeIcon>
                </Group>
                <Text size="2rem" fw={700}>
                  {agencyCount}
                </Text>
                <Text size="xs" c="dimmed" mt={4}>
                  Funding sources
                </Text>
              </Paper>

              <Paper p="lg" withBorder>
                <Group justify="apart" mb="xs">
                  <Text size="sm" c="dimmed">
                    Avg Funding
                  </Text>
                  <ThemeIcon size={40} radius="md" variant="light" color="orange">
                    <IconTrendingUp size={20} />
                  </ThemeIcon>
                </Group>
                <Text size="2rem" fw={700}>
                  {formatCurrency(avgFunding)}
                </Text>
                <Text size="xs" c="dimmed" mt={4}>
                  Per grant
                </Text>
              </Paper>
            </SimpleGrid>

            {/* Timeline Chart */}
            {timelineChartData.length > 0 && (
              <Paper p="lg" withBorder>
                <Title order={3} size="h4" mb="md">
                  Funding Over Time
                </Title>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={timelineChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip
                      formatter={(value: any, name: string) => {
                        if (name === 'funding') return [formatCurrency(value), 'Funding'];
                        return [value, 'Grants'];
                      }}
                    />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="funding" stroke="#9C27B0" name="Funding" />
                    <Line yAxisId="right" type="monotone" dataKey="grants" stroke="#2196F3" name="Grants" />
                  </LineChart>
                </ResponsiveContainer>
              </Paper>
            )}

            {/* Tabs for Agency and Program views */}
            <Tabs value={activeTab} onChange={(value) => setActiveTab(value || 'agency')}>
              <Tabs.List>
                <Tabs.Tab value="agency" leftSection={<IconBuilding size={16} />}>
                  By Agency
                </Tabs.Tab>
                <Tabs.Tab value="program" leftSection={<IconFolders size={16} />}>
                  By Program
                </Tabs.Tab>
              </Tabs.List>

              {/* Agency Tab */}
              <Tabs.Panel value="agency" pt="xl">
                <Stack gap="lg">
                  {/* Agency Bar Chart */}
                  <Paper p="lg" withBorder>
                    <Title order={3} size="h4" mb="md">
                      Top 10 Agencies by Funding
                    </Title>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={agencyChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip
                          formatter={(value: any, name: string) => {
                            if (name === 'funding') return [formatCurrency(value), 'Funding'];
                            return [value, 'Grants'];
                          }}
                        />
                        <Legend />
                        <Bar yAxisId="left" dataKey="funding" fill="#9C27B0" name="Funding" />
                        <Bar yAxisId="right" dataKey="grants" fill="#2196F3" name="Grants" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Paper>

                  {/* Agency Table with Programs */}
                  <Paper p="lg" withBorder>
                    <Title order={3} size="h4" mb="md">
                      Agency Breakdown
                    </Title>
                    <Accordion variant="separated">
                      {reportData.agencyBreakdown.map((agency) => (
                        <Accordion.Item key={agency.agency} value={agency.agency}>
                          <Accordion.Control>
                            <Group justify="space-between" wrap="nowrap">
                              <div style={{ flex: 1 }}>
                                <Text fw={600}>{agency.agency}</Text>
                                <Text size="xs" c="dimmed">
                                  {agency.grantCount} grants
                                </Text>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <Text fw={700} c="grape">
                                  {formatCurrency(agency.totalFunding)}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  Avg: {formatCurrency(agency.averageFunding)}
                                </Text>
                              </div>
                            </Group>
                          </Accordion.Control>
                          <Accordion.Panel>
                            <Stack gap="md">
                              {/* Status Breakdown */}
                              <div>
                                <Text size="sm" fw={500} mb="xs">
                                  Status Distribution
                                </Text>
                                <Group gap="xs">
                                  {Object.entries(agency.statusBreakdown).map(([status, count]) => (
                                    <Badge key={status} color={STATUS_COLORS[status] || 'gray'}>
                                      {status}: {count}
                                    </Badge>
                                  ))}
                                </Group>
                              </div>

                              {/* Programs */}
                              {agency.programs.length > 0 && (
                                <div>
                                  <Text size="sm" fw={500} mb="xs">
                                    Programs ({agency.programs.length})
                                  </Text>
                                  <Stack gap="xs">
                                    {agency.programs.map((program) => (
                                      <Paper key={program.program} p="sm" withBorder bg="gray.0">
                                        <Group justify="space-between">
                                          <div>
                                            <Text size="sm" fw={500}>
                                              {program.program}
                                            </Text>
                                            <Text size="xs" c="dimmed">
                                              {program.grantCount} grants
                                            </Text>
                                          </div>
                                          <div style={{ textAlign: 'right' }}>
                                            <Text size="sm" fw={600}>
                                              {formatCurrency(program.totalFunding)}
                                            </Text>
                                            <Text size="xs" c="dimmed">
                                              Avg: {formatCurrency(program.averageFunding)}
                                            </Text>
                                          </div>
                                        </Group>
                                      </Paper>
                                    ))}
                                  </Stack>
                                </div>
                              )}
                            </Stack>
                          </Accordion.Panel>
                        </Accordion.Item>
                      ))}
                    </Accordion>
                  </Paper>
                </Stack>
              </Tabs.Panel>

              {/* Program Tab */}
              <Tabs.Panel value="program" pt="xl">
                <Stack gap="lg">
                  {/* Program Bar Chart */}
                  <Paper p="lg" withBorder>
                    <Title order={3} size="h4" mb="md">
                      Top 10 Programs by Funding
                    </Title>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={programChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip
                          formatter={(value: any, name: string) => {
                            if (name === 'funding') return [formatCurrency(value), 'Funding'];
                            return [value, 'Grants'];
                          }}
                        />
                        <Legend />
                        <Bar yAxisId="left" dataKey="funding" fill="#673AB7" name="Funding" />
                        <Bar yAxisId="right" dataKey="grants" fill="#00BCD4" name="Grants" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Paper>

                  {/* Program Table */}
                  <Paper p="lg" withBorder>
                    <Title order={3} size="h4" mb="md">
                      Program Breakdown
                    </Title>
                    <Table>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Program</Table.Th>
                          <Table.Th>Grants</Table.Th>
                          <Table.Th>Total Funding</Table.Th>
                          <Table.Th>Avg Funding</Table.Th>
                          <Table.Th>Status</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {reportData.programBreakdown.map((program) => (
                          <Table.Tr key={program.program}>
                            <Table.Td>
                              <Text fw={500}>{program.program}</Text>
                            </Table.Td>
                            <Table.Td>{program.grantCount}</Table.Td>
                            <Table.Td>
                              <Text fw={600} c="grape">
                                {formatCurrency(program.totalFunding)}
                              </Text>
                            </Table.Td>
                            <Table.Td>{formatCurrency(program.averageFunding)}</Table.Td>
                            <Table.Td>
                              <Group gap="xs">
                                {Object.entries(program.statusBreakdown).map(([status, count]) => (
                                  <Badge key={status} size="sm" color={STATUS_COLORS[status] || 'gray'}>
                                    {status}: {count}
                                  </Badge>
                                ))}
                              </Group>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Paper>
                </Stack>
              </Tabs.Panel>
            </Tabs>

            {/* Empty State */}
            {reportData.agencyBreakdown.length === 0 && (
              <Alert icon={<IconAlertCircle size={20} />} color="blue" title="No data available">
                <Text size="sm">
                  No grant data found for the selected filters. Try adjusting your timeframe or status filters.
                </Text>
              </Alert>
            )}
          </>
        )}
      </Stack>
    </ProtectedRoute>
  );
}
