import { Stack, Text, Group, Progress, Badge, Paper, SimpleGrid, Alert, RingProgress, Center } from "@mantine/core";
import { IconAlertCircle, IconCurrencyDollar, IconTrendingUp, IconTrendingDown } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";

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

export function BudgetTab({ grantId }: BudgetTabProps) {
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

  if (isLoading) {
    return (
      <Stack gap="md">
        <Text size="sm" c="dimmed">Loading budget information...</Text>
      </Stack>
    );
  }

  if (error || !data?.budget) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
        <Text size="sm">No budget has been created for this grant yet.</Text>
      </Alert>
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
