import { Stack, Text, Group, Progress, Badge, Paper, SimpleGrid, Alert, RingProgress, Center, Button, Modal, NumberInput, Switch, TextInput } from "@mantine/core";
import { IconAlertCircle, IconCurrencyDollar, IconTrendingUp, IconTrendingDown, IconPlus } from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { notifications } from "@mantine/notifications";
import { DateInput } from "@mantine/dates";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

interface BudgetTabProps {
  grantId: string;
  orgId?: string; // Optional, not currently used but may be needed for future access control
}

interface BudgetSummary {
  total_proposed: number;
  total_awarded: number;
  total_spent: number;
  total_committed: number;
  variance_amount: number;
  variance_percent: number;
  match_completion_percent: number;
  spending_rate_daily: number;
  days_until_depleted: number | null;
}

interface BudgetLineItem {
  id: string;
  category: string;
  description: string;
  proposed_amount: number;
  awarded_amount: number;
  spent_amount: number;
}

export function BudgetTab({ grantId, orgId }: BudgetTabProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createModalOpened, setCreateModalOpened] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Form state
  const [proposedAmount, setProposedAmount] = useState<number>(0);
  const [awardedAmount, setAwardedAmount] = useState<number>(0);
  const [matchRequired, setMatchRequired] = useState(false);
  const [matchAmount, setMatchAmount] = useState<number>(0);
  const [budgetPeriodStart, setBudgetPeriodStart] = useState<Date | null>(null);
  const [budgetPeriodEnd, setBudgetPeriodEnd] = useState<Date | null>(null);
  const [notes, setNotes] = useState("");

  const { data, isLoading, error } = useQuery({
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

  const handleCreateBudget = async () => {
    if (!user || !orgId) {
      notifications.show({
        title: "Error",
        message: "Organization ID is required to create a budget",
        color: "red",
      });
      return;
    }

    setIsCreating(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/budgets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          grant_id: grantId,
          org_id: orgId,
          proposed_amount: proposedAmount,
          awarded_amount: awardedAmount,
          match_required: matchRequired,
          match_amount: matchRequired ? matchAmount : 0,
          budget_period_start: budgetPeriodStart?.toISOString().split('T')[0],
          budget_period_end: budgetPeriodEnd?.toISOString().split('T')[0],
          notes,
          status: 'draft',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create budget');
      }

      notifications.show({
        title: "Success",
        message: "Budget created successfully",
        color: "green",
      });

      // Refresh budget data
      queryClient.invalidateQueries({ queryKey: ['grantBudget', grantId] });
      setCreateModalOpened(false);

      // Reset form
      setProposedAmount(0);
      setAwardedAmount(0);
      setMatchRequired(false);
      setMatchAmount(0);
      setBudgetPeriodStart(null);
      setBudgetPeriodEnd(null);
      setNotes("");
    } catch (err) {
      notifications.show({
        title: "Error",
        message: err instanceof Error ? err.message : "Failed to create budget",
        color: "red",
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) {
    return (
      <Stack gap="md">
        <Text size="sm" c="dimmed">Loading budget information...</Text>
      </Stack>
    );
  }

  if (error || !data?.budget) {
    return (
      <>
        <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
          <Stack gap="sm">
            <Text size="sm">No budget has been created for this grant yet.</Text>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => setCreateModalOpened(true)}
              size="sm"
            >
              Create Budget
            </Button>
          </Stack>
        </Alert>

        <Modal
          opened={createModalOpened}
          onClose={() => setCreateModalOpened(false)}
          title="Create Grant Budget"
          size="lg"
        >
          <Stack gap="md">
            <NumberInput
              label="Proposed Amount"
              description="The amount you plan to request"
              placeholder="0"
              value={proposedAmount}
              onChange={(val) => setProposedAmount(Number(val) || 0)}
              prefix="$"
              thousandSeparator=","
              decimalScale={2}
            />

            <NumberInput
              label="Awarded Amount"
              description="The amount actually awarded (if known)"
              placeholder="0"
              value={awardedAmount}
              onChange={(val) => setAwardedAmount(Number(val) || 0)}
              prefix="$"
              thousandSeparator=","
              decimalScale={2}
            />

            <Switch
              label="Match Required"
              description="Does this grant require matching funds?"
              checked={matchRequired}
              onChange={(event) => setMatchRequired(event.currentTarget.checked)}
            />

            {matchRequired && (
              <NumberInput
                label="Match Amount"
                placeholder="0"
                value={matchAmount}
                onChange={(val) => setMatchAmount(Number(val) || 0)}
                prefix="$"
                thousandSeparator=","
                decimalScale={2}
              />
            )}

            <Group grow>
              <DateInput
                label="Budget Period Start"
                placeholder="Select date"
                value={budgetPeriodStart}
                onChange={setBudgetPeriodStart}
                clearable
              />
              <DateInput
                label="Budget Period End"
                placeholder="Select date"
                value={budgetPeriodEnd}
                onChange={setBudgetPeriodEnd}
                clearable
              />
            </Group>

            <TextInput
              label="Notes"
              placeholder="Additional notes about this budget"
              value={notes}
              onChange={(event) => setNotes(event.currentTarget.value)}
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
                onClick={handleCreateBudget}
                loading={isCreating}
              >
                Create Budget
              </Button>
            </Group>
          </Stack>
        </Modal>
      </>
    );
  }

  const budget = data.budget;
  const summary: BudgetSummary = budget.grant_budget_summary?.[0] || {
    total_proposed: budget.proposed_amount || 0,
    total_awarded: budget.awarded_amount || 0,
    total_spent: budget.total_spent || 0,
    total_committed: budget.total_committed || 0,
    variance_amount: 0,
    variance_percent: 0,
    match_completion_percent: 0,
    spending_rate_daily: 0,
    days_until_depleted: null,
  };

  const remaining = summary.total_awarded - summary.total_spent;
  const spentPercent = summary.total_awarded > 0
    ? (summary.total_spent / summary.total_awarded) * 100
    : 0;
  const remainingPercent = 100 - spentPercent;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getVarianceColor = (variance: number) => {
    if (variance >= 0) return 'green';
    if (variance >= -0.1) return 'yellow';
    return 'red';
  };

  const categoryLabels: Record<string, string> = {
    personnel: 'Personnel',
    fringe_benefits: 'Fringe Benefits',
    travel: 'Travel',
    equipment: 'Equipment',
    supplies: 'Supplies',
    contractual: 'Contractual',
    construction: 'Construction',
    other_direct: 'Other Direct Costs',
    indirect_costs: 'Indirect Costs',
    match_in_kind: 'In-Kind Match',
    match_cash: 'Cash Match',
  };

  return (
    <Stack gap="lg">
      {/* Top Summary Cards */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
        <Paper p="md" withBorder>
          <Text size="xs" c="dimmed" mb={4}>Awarded</Text>
          <Text size="xl" fw={700}>{formatCurrency(summary.total_awarded)}</Text>
        </Paper>

        <Paper p="md" withBorder>
          <Text size="xs" c="dimmed" mb={4}>Spent</Text>
          <Text size="xl" fw={700} c="red">{formatCurrency(summary.total_spent)}</Text>
          <Text size="xs" c="dimmed">{spentPercent.toFixed(1)}% of award</Text>
        </Paper>

        <Paper p="md" withBorder>
          <Text size="xs" c="dimmed" mb={4}>Remaining</Text>
          <Text size="xl" fw={700} c="green">{formatCurrency(remaining)}</Text>
          <Text size="xs" c="dimmed">{remainingPercent.toFixed(1)}% available</Text>
        </Paper>

        <Paper p="md" withBorder>
          <Text size="xs" c="dimmed" mb={4}>Variance</Text>
          <Group gap={4}>
            <Text size="xl" fw={700} c={getVarianceColor(summary.variance_percent)}>
              {summary.variance_percent >= 0 ? '+' : ''}{summary.variance_percent.toFixed(1)}%
            </Text>
            {summary.variance_percent >= 0 ? (
              <IconTrendingUp size={20} color="var(--mantine-color-green-6)" />
            ) : (
              <IconTrendingDown size={20} color="var(--mantine-color-red-6)" />
            )}
          </Group>
          <Text size="xs" c="dimmed">{formatCurrency(Math.abs(summary.variance_amount))}</Text>
        </Paper>
      </SimpleGrid>

      {/* Burn-down Chart */}
      <Paper p="md" withBorder>
        <Group justify="space-between" mb="md">
          <Text size="sm" fw={600}>Budget Burn-down</Text>
          {summary.days_until_depleted && (
            <Badge color={summary.days_until_depleted < 90 ? 'red' : 'blue'} variant="light">
              {summary.days_until_depleted} days until depleted
            </Badge>
          )}
        </Group>

        <Progress.Root size={40}>
          <Progress.Section value={spentPercent} color="red">
            <Progress.Label>{spentPercent.toFixed(0)}%</Progress.Label>
          </Progress.Section>
          <Progress.Section value={remainingPercent} color="green">
            <Progress.Label>{remainingPercent.toFixed(0)}%</Progress.Label>
          </Progress.Section>
        </Progress.Root>

        <Group justify="space-between" mt="xs">
          <Group gap={6}>
            <div style={{ width: 12, height: 12, backgroundColor: 'var(--mantine-color-red-6)', borderRadius: 2 }} />
            <Text size="xs" c="dimmed">Spent: {formatCurrency(summary.total_spent)}</Text>
          </Group>
          <Group gap={6}>
            <div style={{ width: 12, height: 12, backgroundColor: 'var(--mantine-color-green-6)', borderRadius: 2 }} />
            <Text size="xs" c="dimmed">Remaining: {formatCurrency(remaining)}</Text>
          </Group>
        </Group>

        {summary.spending_rate_daily > 0 && (
          <Alert icon={<IconCurrencyDollar size={16} />} color="blue" variant="light" mt="md">
            <Text size="xs">
              Average daily spending rate: {formatCurrency(summary.spending_rate_daily)}/day
            </Text>
          </Alert>
        )}
      </Paper>

      {/* Match/Cost Share Tracking */}
      {budget.match_required && (
        <Paper p="md" withBorder>
          <Text size="sm" fw={600} mb="md">Match & Cost Share</Text>

          <Group justify="center" mb="lg">
            <RingProgress
              size={180}
              thickness={16}
              sections={[
                { value: summary.match_completion_percent, color: summary.match_completion_percent >= 100 ? 'green' : 'blue' }
              ]}
              label={
                <Center>
                  <Stack gap={0} align="center">
                    <Text size="xl" fw={700}>{summary.match_completion_percent.toFixed(0)}%</Text>
                    <Text size="xs" c="dimmed">Complete</Text>
                  </Stack>
                </Center>
              }
            />
          </Group>

          <SimpleGrid cols={2} spacing="md">
            <div>
              <Text size="xs" c="dimmed">Required Match</Text>
              <Text size="lg" fw={600}>{formatCurrency(budget.match_amount || 0)}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">Match Received</Text>
              <Text size="lg" fw={600} c="green">{formatCurrency(budget.match_received || 0)}</Text>
            </div>
          </SimpleGrid>
        </Paper>
      )}

      {/* Line Items - Mini P&L */}
      <Paper p="md" withBorder>
        <Text size="sm" fw={600} mb="md">Budget by Category</Text>

        <Stack gap="sm">
          {budget.budget_line_items && budget.budget_line_items.length > 0 ? (
            budget.budget_line_items.map((item: BudgetLineItem) => {
              const itemSpentPercent = item.awarded_amount > 0
                ? (item.spent_amount / item.awarded_amount) * 100
                : 0;
              const itemVariance = item.awarded_amount - item.spent_amount;
              const itemVariancePercent = item.awarded_amount > 0
                ? ((itemVariance / item.awarded_amount) * 100)
                : 0;

              return (
                <Paper key={item.id} p="sm" withBorder style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
                  <Group justify="space-between" mb="xs">
                    <div>
                      <Text size="sm" fw={500}>
                        {categoryLabels[item.category] || item.category}
                      </Text>
                      {item.description && (
                        <Text size="xs" c="dimmed">{item.description}</Text>
                      )}
                    </div>
                    <Badge
                      color={getVarianceColor(itemVariancePercent / 100)}
                      variant="light"
                      size="sm"
                    >
                      {itemVariance >= 0 ? '+' : ''}{formatCurrency(itemVariance)}
                    </Badge>
                  </Group>

                  <Progress
                    value={Math.min(itemSpentPercent, 100)}
                    color={itemSpentPercent > 100 ? 'red' : itemSpentPercent > 90 ? 'yellow' : 'blue'}
                    size="sm"
                    mb="xs"
                  />

                  <Group justify="space-between">
                    <Text size="xs" c="dimmed">
                      Spent: {formatCurrency(item.spent_amount)} of {formatCurrency(item.awarded_amount)}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {itemSpentPercent.toFixed(1)}%
                    </Text>
                  </Group>
                </Paper>
              );
            })
          ) : (
            <Text size="sm" c="dimmed">No budget line items defined yet</Text>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
