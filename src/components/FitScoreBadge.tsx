import { Badge, Tooltip, Stack, Text, Group, Progress } from '@mantine/core';
import { IconTarget } from '@tabler/icons-react';
import { useOrganization } from '../contexts/OrganizationContext';

interface FitScoreBadgeProps {
  grantCategory?: string;
  grantLocation?: string;
  grantAmount?: number;
}

export function FitScoreBadge({ grantCategory, grantLocation, grantAmount }: FitScoreBadgeProps) {
  const { currentOrg } = useOrganization();

  // If auto-filter is not enabled or no org, don't show the badge
  if (!currentOrg || !(currentOrg as any).auto_filter_enabled) {
    return null;
  }

  // Calculate fit score based on org's eligibility profile
  const calculateFitScore = () => {
    let score = 30; // Base score
    const breakdown: { criteria: string; points: number; matched: boolean }[] = [];

    // Category match (30 points)
    const focusCategories = (currentOrg as any).focus_categories || [];
    const categoryMatch = grantCategory && focusCategories.includes(grantCategory);
    if (categoryMatch) {
      score += 30;
    }
    breakdown.push({
      criteria: 'Category Match',
      points: 30,
      matched: !!categoryMatch,
    });

    // Location match (20 points)
    const primaryLocations = (currentOrg as any).primary_locations || [];
    const locationMatch = grantLocation && primaryLocations.includes(grantLocation);
    if (locationMatch) {
      score += 20;
    }
    breakdown.push({
      criteria: 'Location Match',
      points: 20,
      matched: !!locationMatch,
    });

    // Amount match (20 points)
    const minAmount = (currentOrg as any).min_grant_amount;
    const maxAmount = (currentOrg as any).max_grant_amount;
    const amountMatch = grantAmount &&
      grantAmount >= (minAmount || 0) &&
      grantAmount <= (maxAmount || Number.MAX_SAFE_INTEGER);
    if (amountMatch) {
      score += 20;
    }
    breakdown.push({
      criteria: 'Grant Amount',
      points: 20,
      matched: !!amountMatch,
    });

    return { score, breakdown };
  };

  const { score, breakdown } = calculateFitScore();

  // Determine color and label based on score
  const getFitLevel = () => {
    if (score >= 80) return { color: 'green', label: 'Excellent Fit', icon: '🎯' };
    if (score >= 60) return { color: 'teal', label: 'Good Fit', icon: '✓' };
    if (score >= 40) return { color: 'yellow', label: 'Moderate Fit', icon: '~' };
    return { color: 'gray', label: 'Low Fit', icon: '-' };
  };

  const fitLevel = getFitLevel();

  return (
    <Tooltip
      label={
        <Stack gap="xs">
          <Group gap="xs">
            <Text size="sm" fw={600}>Fit Score: {score}/100</Text>
          </Group>
          <Text size="xs" c="dimmed">Based on your eligibility profile</Text>
          <Stack gap={4} mt="xs">
            {breakdown.map((item, idx) => (
              <Group key={idx} justify="space-between" gap="md">
                <Group gap={6}>
                  <Text size="xs" c={item.matched ? 'teal' : 'dimmed'}>
                    {item.matched ? '✓' : '✗'}
                  </Text>
                  <Text size="xs">{item.criteria}</Text>
                </Group>
                <Text size="xs" fw={500}>
                  {item.matched ? item.points : 0}/{item.points}
                </Text>
              </Group>
            ))}
            <Group justify="space-between" gap="md" mt={4} pt={4} style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <Text size="xs" fw={600}>Total</Text>
              <Text size="xs" fw={600}>{score}/100</Text>
            </Group>
          </Stack>
          <Progress value={score} size="sm" mt="xs" color={fitLevel.color} />
        </Stack>
      }
      withArrow
      multiline
      w={300}
    >
      <Badge
        variant="light"
        color={fitLevel.color}
        size="sm"
        leftSection={<IconTarget size={12} />}
        style={{ cursor: 'help' }}
      >
        {score}% {fitLevel.label}
      </Badge>
    </Tooltip>
  );
}
