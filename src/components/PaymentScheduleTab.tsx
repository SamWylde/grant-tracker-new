import { Stack, Text, Group, Badge, Paper, Alert, Timeline, Divider, Button, Modal, TextInput, NumberInput, Select, Switch } from "@mantine/core";
import {
  IconAlertCircle,
  IconCalendar,
  IconCheck,
  IconClock,
  IconFileReport,
  IconCurrencyDollar,
  IconAlertTriangle,
  IconPlus,
} from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { notifications } from "@mantine/notifications";
import { DateInput } from "@mantine/dates";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

interface PaymentScheduleTabProps {
  grantId: string;
  orgId?: string; // Optional, not currently used but may be needed for future access control
}

interface PaymentSchedule {
  id: string;
  payment_name: string;
  payment_type: string;
  expected_amount: number;
  expected_date: string;
  actual_amount: number | null;
  actual_date: string | null;
  received: boolean;
  status: string;
  deliverable_required: string | null;
  report_required: boolean;
  report_due_date: string | null;
  report_submitted: boolean;
  notes: string | null;
}

export function PaymentScheduleTab({ grantId, orgId }: PaymentScheduleTabProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createModalOpened, setCreateModalOpened] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Form state
  const [paymentName, setPaymentName] = useState("");
  const [paymentType, setPaymentType] = useState<string>("reimbursement");
  const [expectedAmount, setExpectedAmount] = useState<number>(0);
  const [expectedDate, setExpectedDate] = useState<Date | null>(null);
  const [deliverableRequired, setDeliverableRequired] = useState("");
  const [reportRequired, setReportRequired] = useState(false);
  const [reportDueDate, setReportDueDate] = useState<Date | null>(null);
  const [notes, setNotes] = useState("");

  // Fetch budget first to get budget_id
  const { data: budgetData } = useQuery({
    queryKey: ['grantBudget', grantId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`/api/budgets?grant_id=${grantId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch budget');
      return response.json();
    },
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['paymentSchedules', budgetData?.budget?.id],
    queryFn: async () => {
      if (!budgetData?.budget?.id) return null;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`/api/payment-schedules?budget_id=${budgetData.budget.id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch payment schedules');
      return response.json();
    },
    enabled: !!budgetData?.budget?.id,
  });

  const handleCreatePaymentSchedule = async () => {
    if (!user || !orgId || !budgetData?.budget?.id) {
      notifications.show({
        title: "Error",
        message: "Budget must be created first",
        color: "red",
      });
      return;
    }

    if (!paymentName || !expectedAmount || !expectedDate) {
      notifications.show({
        title: "Error",
        message: "Please fill in all required fields",
        color: "red",
      });
      return;
    }

    setIsCreating(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/payment-schedules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          budget_id: budgetData.budget.id,
          org_id: orgId,
          payment_name: paymentName,
          payment_type: paymentType,
          expected_amount: expectedAmount,
          expected_date: expectedDate.toISOString().split('T')[0],
          deliverable_required: deliverableRequired || null,
          report_required: reportRequired,
          report_due_date: reportDueDate ? reportDueDate.toISOString().split('T')[0] : null,
          notes: notes || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create payment schedule');
      }

      notifications.show({
        title: "Success",
        message: "Payment schedule created successfully",
        color: "green",
      });

      // Refresh payment schedules
      queryClient.invalidateQueries({ queryKey: ['paymentSchedules', budgetData.budget.id] });
      setCreateModalOpened(false);

      // Reset form
      setPaymentName("");
      setPaymentType("reimbursement");
      setExpectedAmount(0);
      setExpectedDate(null);
      setDeliverableRequired("");
      setReportRequired(false);
      setReportDueDate(null);
      setNotes("");
    } catch (err) {
      notifications.show({
        title: "Error",
        message: err instanceof Error ? err.message : "Failed to create payment schedule",
        color: "red",
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) {
    return (
      <Stack gap="md">
        <Text size="sm" c="dimmed">Loading payment schedule...</Text>
      </Stack>
    );
  }

  if (error || !data) {
    return (
      <>
        <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
          <Stack gap="sm">
            <Text size="sm">No payment schedule has been created for this grant yet.</Text>
            {budgetData?.budget?.id ? (
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={() => setCreateModalOpened(true)}
                size="sm"
              >
                Create Payment Schedule
              </Button>
            ) : (
              <Text size="xs" c="dimmed">Create a budget first to add payment schedules.</Text>
            )}
          </Stack>
        </Alert>

        {budgetData?.budget?.id && (
          <Modal
            opened={createModalOpened}
            onClose={() => setCreateModalOpened(false)}
            title="Create Payment Schedule"
            size="lg"
          >
            <Stack gap="md">
              <TextInput
                label="Payment Name"
                description="e.g., 'First Quarter Reimbursement'"
                placeholder="Enter payment name"
                value={paymentName}
                onChange={(e) => setPaymentName(e.currentTarget.value)}
                required
              />

              <Select
                label="Payment Type"
                data={[
                  { value: 'advance', label: 'Advance' },
                  { value: 'reimbursement', label: 'Reimbursement' },
                  { value: 'cost_reimbursement', label: 'Cost Reimbursement' },
                  { value: 'milestone', label: 'Milestone' },
                  { value: 'quarterly', label: 'Quarterly' },
                  { value: 'annual', label: 'Annual' },
                ]}
                value={paymentType}
                onChange={(val) => setPaymentType(val || 'reimbursement')}
              />

              <NumberInput
                label="Expected Amount"
                placeholder="0"
                value={expectedAmount}
                onChange={(val) => setExpectedAmount(Number(val) || 0)}
                prefix="$"
                thousandSeparator=","
                decimalScale={2}
                required
              />

              <DateInput
                label="Expected Date"
                placeholder="Select date"
                value={expectedDate}
                onChange={(value) => setExpectedDate(value ? new Date(value) : null)}
                required
              />

              <TextInput
                label="Deliverable Required (optional)"
                placeholder="e.g., 'Quarterly Report'"
                value={deliverableRequired}
                onChange={(e) => setDeliverableRequired(e.currentTarget.value)}
              />

              <Switch
                label="Report Required"
                description="Does this payment require a report submission?"
                checked={reportRequired}
                onChange={(e) => setReportRequired(e.currentTarget.checked)}
              />

              {reportRequired && (
                <DateInput
                  label="Report Due Date"
                  placeholder="Select date"
                  value={reportDueDate}
                  onChange={(value) => setReportDueDate(value ? new Date(value) : null)}
                />
              )}

              <TextInput
                label="Notes (optional)"
                placeholder="Additional notes"
                value={notes}
                onChange={(e) => setNotes(e.currentTarget.value)}
              />

              <Group justify="flex-end" mt="md">
                <Button
                  variant="outline"
                  onClick={() => setCreateModalOpened(false)}
                  disabled={isCreating}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreatePaymentSchedule}
                  loading={isCreating}
                >
                  Create Schedule
                </Button>
              </Group>
            </Stack>
          </Modal>
        )}
      </>
    );
  }

  const schedules: PaymentSchedule[] = data.payment_schedules || [];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusColor = (schedule: PaymentSchedule) => {
    if (schedule.received) return 'green';

    const daysUntil = dayjs(schedule.expected_date).diff(dayjs(), 'days');
    if (daysUntil < 0) return 'red'; // Overdue
    if (daysUntil <= 14) return 'yellow'; // Coming soon
    return 'blue'; // Future
  };

  const getStatusLabel = (schedule: PaymentSchedule) => {
    if (schedule.received) return 'Received';

    const daysUntil = dayjs(schedule.expected_date).diff(dayjs(), 'days');
    if (daysUntil < 0) return 'Overdue';
    if (daysUntil === 0) return 'Due Today';
    if (daysUntil <= 14) return 'Due Soon';
    return 'Scheduled';
  };

  const needsReportWarning = (schedule: PaymentSchedule) => {
    if (schedule.received || !schedule.report_required || schedule.report_submitted) {
      return false;
    }

    const daysUntil = dayjs(schedule.expected_date).diff(dayjs(), 'days');
    return daysUntil <= 30; // Warn if payment is within 30 days and report not submitted
  };

  const sortedSchedules = [...schedules].sort((a, b) =>
    dayjs(a.expected_date).diff(dayjs(b.expected_date))
  );

  const upcomingSchedules = sortedSchedules.filter(s => !s.received);
  const receivedSchedules = sortedSchedules.filter(s => s.received);

  const totalExpected = schedules.reduce((sum, s) => sum + s.expected_amount, 0);
  const totalReceived = schedules.filter(s => s.received).reduce((sum, s) => sum + (s.actual_amount || s.expected_amount), 0);

  return (
    <Stack gap="lg">
      {/* Summary */}
      <Paper p="md" withBorder>
        <Group justify="space-between">
          <div>
            <Text size="xs" c="dimmed">Total Expected</Text>
            <Text size="lg" fw={700}>{formatCurrency(totalExpected)}</Text>
          </div>
          <div>
            <Text size="xs" c="dimmed">Total Received</Text>
            <Text size="lg" fw={700} c="green">{formatCurrency(totalReceived)}</Text>
          </div>
          <div>
            <Text size="xs" c="dimmed">Remaining</Text>
            <Text size="lg" fw={700} c="blue">{formatCurrency(totalExpected - totalReceived)}</Text>
          </div>
        </Group>
      </Paper>

      {/* Warnings */}
      {upcomingSchedules.some(s => needsReportWarning(s)) && (
        <Alert icon={<IconAlertTriangle size={16} />} color="yellow" variant="light">
          <Text size="sm" fw={600} mb={4}>Report Submission Required</Text>
          <Text size="xs">
            One or more upcoming payments require report submission. Submit required reports to avoid payment delays.
          </Text>
        </Alert>
      )}

      {/* Upcoming Payments */}
      {upcomingSchedules.length > 0 && (
        <>
          <div>
            <Group mb="md">
              <IconClock size={20} />
              <Text size="sm" fw={600}>Upcoming Payments</Text>
            </Group>

            <Stack gap="md">
              {upcomingSchedules.map((schedule) => {
                const daysUntil = dayjs(schedule.expected_date).diff(dayjs(), 'days');
                const showWarning = needsReportWarning(schedule);

                return (
                  <Paper key={schedule.id} p="md" withBorder style={{
                    backgroundColor: showWarning ? 'var(--mantine-color-yellow-0)' : 'var(--mantine-color-gray-0)',
                    borderLeft: `4px solid var(--mantine-color-${getStatusColor(schedule)}-6)`
                  }}>
                    <Group justify="space-between" mb="xs">
                      <div style={{ flex: 1 }}>
                        <Group gap="xs" mb={4}>
                          <Text size="sm" fw={600}>{schedule.payment_name}</Text>
                          <Badge size="sm" color={getStatusColor(schedule)} variant="light">
                            {getStatusLabel(schedule)}
                          </Badge>
                          <Badge size="sm" variant="outline">
                            {schedule.payment_type.replace('_', ' ')}
                          </Badge>
                        </Group>

                        <Group gap="md" mt="xs">
                          <Group gap={6}>
                            <IconCalendar size={14} />
                            <Text size="xs" c="dimmed">
                              {dayjs(schedule.expected_date).format('MMM D, YYYY')}
                            </Text>
                          </Group>
                          {daysUntil >= 0 && (
                            <Text size="xs" c="dimmed">
                              ({dayjs(schedule.expected_date).fromNow()})
                            </Text>
                          )}
                          {daysUntil < 0 && (
                            <Text size="xs" c="red" fw={600}>
                              Overdue by {Math.abs(daysUntil)} days
                            </Text>
                          )}
                        </Group>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <Group gap={4} justify="flex-end">
                          <IconCurrencyDollar size={16} />
                          <Text size="lg" fw={700}>{formatCurrency(schedule.expected_amount)}</Text>
                        </Group>
                      </div>
                    </Group>

                    {schedule.deliverable_required && (
                      <Alert icon={<IconFileReport size={14} />} color="blue" variant="light" mt="xs">
                        <Text size="xs">Deliverable: {schedule.deliverable_required}</Text>
                      </Alert>
                    )}

                    {schedule.report_required && (
                      <Alert
                        icon={<IconFileReport size={14} />}
                        color={showWarning ? 'yellow' : 'blue'}
                        variant="light"
                        mt="xs"
                      >
                        <Group justify="space-between">
                          <div>
                            <Text size="xs" fw={600}>Report Required</Text>
                            {schedule.report_due_date && (
                              <Text size="xs">Due: {dayjs(schedule.report_due_date).format('MMM D, YYYY')}</Text>
                            )}
                          </div>
                          <Badge color={schedule.report_submitted ? 'green' : 'gray'} size="sm">
                            {schedule.report_submitted ? 'Submitted' : 'Pending'}
                          </Badge>
                        </Group>
                      </Alert>
                    )}

                    {schedule.notes && (
                      <Text size="xs" c="dimmed" mt="xs" style={{ fontStyle: 'italic' }}>
                        Note: {schedule.notes}
                      </Text>
                    )}
                  </Paper>
                );
              })}
            </Stack>
          </div>
        </>
      )}

      {/* Received Payments */}
      {receivedSchedules.length > 0 && (
        <>
          <Divider />
          <div>
            <Group mb="md">
              <IconCheck size={20} color="var(--mantine-color-green-6)" />
              <Text size="sm" fw={600}>Received Payments</Text>
            </Group>

            <Timeline active={receivedSchedules.length} bulletSize={24} lineWidth={2}>
              {receivedSchedules.map((schedule) => (
                <Timeline.Item
                  key={schedule.id}
                  bullet={<IconCheck size={14} />}
                  color="green"
                  title={
                    <Group gap="xs">
                      <Text size="sm" fw={600}>{schedule.payment_name}</Text>
                      <Badge size="sm" color="green" variant="light">Received</Badge>
                    </Group>
                  }
                >
                  <Group justify="space-between" mt="xs">
                    <div>
                      <Text size="xs" c="dimmed">
                        Expected: {dayjs(schedule.expected_date).format('MMM D, YYYY')}
                      </Text>
                      {schedule.actual_date && (
                        <Text size="xs" c="dimmed">
                          Received: {dayjs(schedule.actual_date).format('MMM D, YYYY')}
                        </Text>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <Text size="sm" fw={600} c="green">
                        {formatCurrency(schedule.actual_amount || schedule.expected_amount)}
                      </Text>
                      {schedule.actual_amount && schedule.actual_amount !== schedule.expected_amount && (
                        <Text size="xs" c="dimmed">
                          Expected: {formatCurrency(schedule.expected_amount)}
                        </Text>
                      )}
                    </div>
                  </Group>
                </Timeline.Item>
              ))}
            </Timeline>
          </div>
        </>
      )}

      {schedules.length === 0 && (
        <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
          <Stack gap="sm">
            <Text size="sm">No payment schedules defined yet. Create a payment schedule to track drawdowns and disbursements.</Text>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => setCreateModalOpened(true)}
              size="sm"
            >
              Create Payment Schedule
            </Button>
          </Stack>
        </Alert>
      )}

      {/* Create Payment Schedule Modal */}
      <Modal
        opened={createModalOpened}
        onClose={() => setCreateModalOpened(false)}
        title="Create Payment Schedule"
        size="lg"
      >
        <Stack gap="md">
          <TextInput
            label="Payment Name"
            description="e.g., 'First Quarter Reimbursement'"
            placeholder="Enter payment name"
            value={paymentName}
            onChange={(e) => setPaymentName(e.currentTarget.value)}
            required
          />

          <Select
            label="Payment Type"
            data={[
              { value: 'advance', label: 'Advance' },
              { value: 'reimbursement', label: 'Reimbursement' },
              { value: 'cost_reimbursement', label: 'Cost Reimbursement' },
              { value: 'milestone', label: 'Milestone' },
              { value: 'quarterly', label: 'Quarterly' },
              { value: 'annual', label: 'Annual' },
            ]}
            value={paymentType}
            onChange={(val) => setPaymentType(val || 'reimbursement')}
          />

          <NumberInput
            label="Expected Amount"
            placeholder="0"
            value={expectedAmount}
            onChange={(val) => setExpectedAmount(Number(val) || 0)}
            prefix="$"
            thousandSeparator=","
            decimalScale={2}
            required
          />

          <DateInput
            label="Expected Date"
            placeholder="Select date"
            value={expectedDate}
            onChange={(value) => setExpectedDate(value ? new Date(value) : null)}
            required
          />

          <TextInput
            label="Deliverable Required (optional)"
            placeholder="e.g., 'Quarterly Report'"
            value={deliverableRequired}
            onChange={(e) => setDeliverableRequired(e.currentTarget.value)}
          />

          <Switch
            label="Report Required"
            description="Does this payment require a report submission?"
            checked={reportRequired}
            onChange={(e) => setReportRequired(e.currentTarget.checked)}
          />

          {reportRequired && (
            <DateInput
              label="Report Due Date"
              placeholder="Select date"
              value={reportDueDate}
              onChange={(value) => setReportDueDate(value ? new Date(value) : null)}
            />
          )}

          <TextInput
            label="Notes (optional)"
            placeholder="Additional notes"
            value={notes}
            onChange={(e) => setNotes(e.currentTarget.value)}
          />

          <Group justify="flex-end" mt="md">
            <Button
              variant="outline"
              onClick={() => setCreateModalOpened(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreatePaymentSchedule}
              loading={isCreating}
            >
              Create Schedule
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
