import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Stack,
  Title,
  Text,
  Divider,
  Paper,
  Switch,
  Button,
  Group,
  SimpleGrid,
  Badge,
  Select,
  Tabs,
  Table,
  Modal,
  LoadingOverlay,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCalendar, IconClock, IconMail, IconEye } from '@tabler/icons-react';
import { SettingsLayout } from '../../components/SettingsLayout';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { useOrganization } from '../../contexts/OrganizationContext';
import { usePermission } from '../../hooks/usePermission';
import { supabase } from '../../lib/supabase';

interface ScheduledReport {
  id: string;
  org_id: string;
  user_id: string | null;
  report_type: string;
  enabled: boolean;
  include_new_matches: boolean;
  include_upcoming_deadlines: boolean;
  include_team_activity: boolean;
  include_submissions: boolean;
  include_awards: boolean;
  include_pipeline_health: boolean;
  delivery_day: number | null;
  delivery_time: string;
  delivery_timezone: string;
  last_sent_at: string | null;
  next_scheduled_at: string | null;
  send_count: number;
}

const DAYS_OF_WEEK = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
];

const TIME_OPTIONS = [
  { value: '06:00:00', label: '6:00 AM' },
  { value: '07:00:00', label: '7:00 AM' },
  { value: '08:00:00', label: '8:00 AM' },
  { value: '09:00:00', label: '9:00 AM' },
  { value: '10:00:00', label: '10:00 AM' },
  { value: '12:00:00', label: '12:00 PM' },
  { value: '14:00:00', label: '2:00 PM' },
  { value: '16:00:00', label: '4:00 PM' },
  { value: '18:00:00', label: '6:00 PM' },
];

export function ReportsPage() {
  const { currentOrg } = useOrganization();
  const { isAdmin } = usePermission();
  const queryClient = useQueryClient();

  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewContent, setPreviewContent] = useState<any>(null);

  const canEdit = isAdmin;

  // Fetch scheduled reports
  const { data: reportsData, isLoading } = useQuery({
    queryKey: ['scheduledReports', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return null;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `/api/scheduled-reports?org_id=${currentOrg.id}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch reports');
      return response.json();
    },
    enabled: !!currentOrg,
  });

  const reports = reportsData?.reports || [];
  const deliveryHistory = reportsData?.deliveryHistory || [];

  // Find weekly and monthly reports
  const weeklyReport = reports.find((r: ScheduledReport) => r.report_type === 'weekly_digest');
  const monthlyReport = reports.find((r: ScheduledReport) => r.report_type === 'monthly_summary');

  // Update report mutation
  const updateReportMutation = useMutation({
    mutationFn: async ({ reportId, data }: { reportId: string; data: any }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`/api/scheduled-reports?report_id=${reportId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('Failed to update report');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledReports'] });
      notifications.show({
        title: 'Report updated',
        message: 'Your report settings have been saved.',
        color: 'green',
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to update report',
        color: 'red',
      });
    },
  });

  // Preview report mutation
  const previewReport = async (reportType: string) => {
    if (!currentOrg) return;

    setPreviewLoading(true);
    setPreviewModalOpen(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/reports/generate-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          org_id: currentOrg.id,
          report_type: reportType,
        }),
      });

      if (!response.ok) throw new Error('Failed to generate preview');
      const data = await response.json();
      setPreviewContent(data);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to generate preview',
        color: 'red',
      });
      setPreviewModalOpen(false);
    } finally {
      setPreviewLoading(false);
    }
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
          <Stack gap="sm">
            <Group justify="space-between">
              <div>
                <Title order={1}>Scheduled Reports</Title>
                <Text c="dimmed" size="lg">
                  Configure automated email reports for your team
                </Text>
              </div>
              {!canEdit && (
                <Badge color="gray" size="lg">
                  View Only
                </Badge>
              )}
            </Group>
          </Stack>

          <Divider />

          <Tabs defaultValue="weekly">
            <Tabs.List>
              <Tabs.Tab value="weekly" leftSection={<IconCalendar size={16} />}>
                Weekly Digest
              </Tabs.Tab>
              <Tabs.Tab value="monthly" leftSection={<IconMail size={16} />}>
                Monthly Summary
              </Tabs.Tab>
              <Tabs.Tab value="history" leftSection={<IconClock size={16} />}>
                Delivery History
              </Tabs.Tab>
            </Tabs.List>

            {/* Weekly Digest Tab */}
            <Tabs.Panel value="weekly" pt="xl">
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
                {/* Left Column - Settings */}
                <Stack gap="lg">
                  <Paper p="md" withBorder>
                    <Stack gap="md">
                      <Group justify="space-between">
                        <div>
                          <Title order={3} size="h4">
                            Weekly Digest
                          </Title>
                          <Text size="sm" c="dimmed">
                            Get a summary of new grants, deadlines, and team activity
                          </Text>
                        </div>
                        <Switch
                          checked={weeklyReport?.enabled || false}
                          onChange={(e) =>
                            weeklyReport &&
                            updateReportMutation.mutate({
                              reportId: weeklyReport.id,
                              data: { enabled: e.target.checked },
                            })
                          }
                          disabled={!canEdit || isLoading}
                          size="lg"
                        />
                      </Group>

                      <Divider />

                      <Title order={4} size="h5">
                        Include in Report
                      </Title>

                      <Switch
                        label="New grant matches"
                        description="Grants added to your workspace this week"
                        checked={weeklyReport?.include_new_matches || false}
                        onChange={(e) =>
                          weeklyReport &&
                          updateReportMutation.mutate({
                            reportId: weeklyReport.id,
                            data: { include_new_matches: e.target.checked },
                          })
                        }
                        disabled={!canEdit || isLoading}
                      />

                      <Switch
                        label="Upcoming deadlines"
                        description="Grants with deadlines in the next 30 days"
                        checked={weeklyReport?.include_upcoming_deadlines || false}
                        onChange={(e) =>
                          weeklyReport &&
                          updateReportMutation.mutate({
                            reportId: weeklyReport.id,
                            data: { include_upcoming_deadlines: e.target.checked },
                          })
                        }
                        disabled={!canEdit || isLoading}
                      />

                      <Switch
                        label="Team activity"
                        description="Recent comments, status changes, and updates"
                        checked={weeklyReport?.include_team_activity || false}
                        onChange={(e) =>
                          weeklyReport &&
                          updateReportMutation.mutate({
                            reportId: weeklyReport.id,
                            data: { include_team_activity: e.target.checked },
                          })
                        }
                        disabled={!canEdit || isLoading}
                      />

                      <Divider />

                      <Title order={4} size="h5">
                        Delivery Schedule
                      </Title>

                      <Select
                        label="Day of week"
                        data={DAYS_OF_WEEK}
                        value={weeklyReport?.delivery_day?.toString() || '1'}
                        onChange={(value) =>
                          weeklyReport &&
                          value &&
                          updateReportMutation.mutate({
                            reportId: weeklyReport.id,
                            data: { delivery_day: parseInt(value) },
                          })
                        }
                        disabled={!canEdit || isLoading}
                      />

                      <Select
                        label="Time of day"
                        data={TIME_OPTIONS}
                        value={weeklyReport?.delivery_time || '09:00:00'}
                        onChange={(value) =>
                          weeklyReport &&
                          value &&
                          updateReportMutation.mutate({
                            reportId: weeklyReport.id,
                            data: { delivery_time: value },
                          })
                        }
                        disabled={!canEdit || isLoading}
                      />

                      {weeklyReport?.next_scheduled_at && (
                        <Paper p="sm" bg="blue.0" withBorder>
                          <Text size="sm" c="blue.9">
                            <strong>Next report:</strong>{' '}
                            {new Date(weeklyReport.next_scheduled_at).toLocaleString()}
                          </Text>
                        </Paper>
                      )}

                      <Group justify="flex-end" mt="md">
                        <Button
                          variant="light"
                          leftSection={<IconEye size={16} />}
                          onClick={() => previewReport('weekly_digest')}
                        >
                          Preview Report
                        </Button>
                      </Group>
                    </Stack>
                  </Paper>
                </Stack>

                {/* Right Column - Info */}
                <Stack gap="lg">
                  <Paper p="md" withBorder bg="grape.0">
                    <Stack gap="sm">
                      <Title order={4}>About Weekly Digests</Title>
                      <Text size="sm">
                        Weekly digests help your team stay up-to-date with new grant opportunities
                        and upcoming deadlines without having to check the platform every day.
                      </Text>
                      <Text size="sm">
                        Reports are sent to all team members. You can customize which sections are
                        included to match your team's workflow.
                      </Text>
                    </Stack>
                  </Paper>

                  {weeklyReport?.last_sent_at && (
                    <Paper p="md" withBorder bg="green.0">
                      <Stack gap="sm">
                        <Title order={4}>Last Sent</Title>
                        <Text size="sm">
                          {new Date(weeklyReport.last_sent_at).toLocaleString()}
                        </Text>
                        <Text size="sm" c="dimmed">
                          Total reports sent: {weeklyReport.send_count}
                        </Text>
                      </Stack>
                    </Paper>
                  )}
                </Stack>
              </SimpleGrid>
            </Tabs.Panel>

            {/* Monthly Summary Tab */}
            <Tabs.Panel value="monthly" pt="xl">
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
                {/* Left Column - Settings */}
                <Stack gap="lg">
                  <Paper p="md" withBorder>
                    <Stack gap="md">
                      <Group justify="space-between">
                        <div>
                          <Title order={3} size="h4">
                            Monthly Summary
                          </Title>
                          <Text size="sm" c="dimmed">
                            Get a comprehensive overview of your grant pipeline performance
                          </Text>
                        </div>
                        <Switch
                          checked={monthlyReport?.enabled || false}
                          onChange={(e) =>
                            monthlyReport &&
                            updateReportMutation.mutate({
                              reportId: monthlyReport.id,
                              data: { enabled: e.target.checked },
                            })
                          }
                          disabled={!canEdit || isLoading}
                          size="lg"
                        />
                      </Group>

                      <Divider />

                      <Title order={4} size="h5">
                        Include in Report
                      </Title>

                      <Switch
                        label="Submission statistics"
                        description="Total submissions and breakdown by stage"
                        checked={monthlyReport?.include_submissions || false}
                        onChange={(e) =>
                          monthlyReport &&
                          updateReportMutation.mutate({
                            reportId: monthlyReport.id,
                            data: { include_submissions: e.target.checked },
                          })
                        }
                        disabled={!canEdit || isLoading}
                      />

                      <Switch
                        label="Award statistics"
                        description="Awards received and total funding amount"
                        checked={monthlyReport?.include_awards || false}
                        onChange={(e) =>
                          monthlyReport &&
                          updateReportMutation.mutate({
                            reportId: monthlyReport.id,
                            data: { include_awards: e.target.checked },
                          })
                        }
                        disabled={!canEdit || isLoading}
                      />

                      <Switch
                        label="Pipeline health"
                        description="Current state of your grant pipeline"
                        checked={monthlyReport?.include_pipeline_health || false}
                        onChange={(e) =>
                          monthlyReport &&
                          updateReportMutation.mutate({
                            reportId: monthlyReport.id,
                            data: { include_pipeline_health: e.target.checked },
                          })
                        }
                        disabled={!canEdit || isLoading}
                      />

                      <Divider />

                      <Title order={4} size="h5">
                        Delivery Schedule
                      </Title>

                      <Select
                        label="Time of day"
                        description="Sent on the 1st of each month"
                        data={TIME_OPTIONS}
                        value={monthlyReport?.delivery_time || '09:00:00'}
                        onChange={(value) =>
                          monthlyReport &&
                          value &&
                          updateReportMutation.mutate({
                            reportId: monthlyReport.id,
                            data: { delivery_time: value },
                          })
                        }
                        disabled={!canEdit || isLoading}
                      />

                      {monthlyReport?.next_scheduled_at && (
                        <Paper p="sm" bg="blue.0" withBorder>
                          <Text size="sm" c="blue.9">
                            <strong>Next report:</strong>{' '}
                            {new Date(monthlyReport.next_scheduled_at).toLocaleString()}
                          </Text>
                        </Paper>
                      )}

                      <Group justify="flex-end" mt="md">
                        <Button
                          variant="light"
                          leftSection={<IconEye size={16} />}
                          onClick={() => previewReport('monthly_summary')}
                        >
                          Preview Report
                        </Button>
                      </Group>
                    </Stack>
                  </Paper>
                </Stack>

                {/* Right Column - Info */}
                <Stack gap="lg">
                  <Paper p="md" withBorder bg="grape.0">
                    <Stack gap="sm">
                      <Title order={4}>About Monthly Summaries</Title>
                      <Text size="sm">
                        Monthly summaries provide a high-level overview of your organization's
                        grant performance, including submissions, awards, and pipeline health.
                      </Text>
                      <Text size="sm">
                        Perfect for monthly team meetings or status updates to leadership.
                      </Text>
                    </Stack>
                  </Paper>

                  {monthlyReport?.last_sent_at && (
                    <Paper p="md" withBorder bg="green.0">
                      <Stack gap="sm">
                        <Title order={4}>Last Sent</Title>
                        <Text size="sm">
                          {new Date(monthlyReport.last_sent_at).toLocaleString()}
                        </Text>
                        <Text size="sm" c="dimmed">
                          Total reports sent: {monthlyReport.send_count}
                        </Text>
                      </Stack>
                    </Paper>
                  )}
                </Stack>
              </SimpleGrid>
            </Tabs.Panel>

            {/* Delivery History Tab */}
            <Tabs.Panel value="history" pt="xl">
              <Paper p="md" withBorder>
                <Title order={3} size="h4" mb="md">
                  Recent Deliveries
                </Title>
                {deliveryHistory.length === 0 ? (
                  <Text c="dimmed" ta="center" py="xl">
                    No reports have been sent yet
                  </Text>
                ) : (
                  <Table>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Report Type</Table.Th>
                        <Table.Th>Sent At</Table.Th>
                        <Table.Th>Recipient</Table.Th>
                        <Table.Th>Status</Table.Th>
                        <Table.Th>Grants</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {deliveryHistory.slice(0, 20).map((log: any) => (
                        <Table.Tr key={log.id}>
                          <Table.Td>
                            {log.report_type === 'weekly_digest'
                              ? 'Weekly Digest'
                              : 'Monthly Summary'}
                          </Table.Td>
                          <Table.Td>
                            {new Date(log.sent_at).toLocaleString()}
                          </Table.Td>
                          <Table.Td>{log.recipient_email}</Table.Td>
                          <Table.Td>
                            <Badge
                              color={
                                log.status === 'sent'
                                  ? 'green'
                                  : log.status === 'failed'
                                    ? 'red'
                                    : 'gray'
                              }
                            >
                              {log.status}
                            </Badge>
                          </Table.Td>
                          <Table.Td>{log.grants_included || 0}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                )}
              </Paper>
            </Tabs.Panel>
          </Tabs>

          {/* Preview Modal */}
          <Modal
            opened={previewModalOpen}
            onClose={() => setPreviewModalOpen(false)}
            title="Report Preview"
            size="xl"
          >
            <LoadingOverlay visible={previewLoading} />
            {previewContent && (
              <Stack gap="md">
                <Text size="sm" c="dimmed">
                  This is a preview of what your report will look like. Actual content will vary
                  based on your data.
                </Text>
                <Paper p="md" withBorder>
                  <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px' }}>
                    {JSON.stringify(previewContent, null, 2)}
                  </pre>
                </Paper>
              </Stack>
            )}
          </Modal>
        </Stack>
      </SettingsLayout>
    </ProtectedRoute>
  );
}
