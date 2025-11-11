import { Badge, Tooltip, Group, Text } from "@mantine/core";
import { IconChartDots } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";

interface SuccessScoreBadgeProps {
  grantId: string;
  orgId: string;
  compact?: boolean;
}

export function SuccessScoreBadge({ grantId, orgId, compact = false }: SuccessScoreBadgeProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["successScore", grantId, orgId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const response = await fetch(
        `/api/grants/success-score?grant_id=${grantId}&org_id=${orgId}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!grantId && !!orgId,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
  });

  if (isLoading || !data) return null;

  const score = data.success_probability;
  const matchLevel = data.match_level;
  const percentage = (score * 100).toFixed(0);

  // Color based on match level
  const colorMap = {
    excellent: "green",
    good: "blue",
    fair: "yellow",
    poor: "red",
  };

  const color = colorMap[matchLevel as keyof typeof colorMap] || "gray";

  if (compact) {
    return (
      <Tooltip
        label={
          <div>
            <Text size="xs" fw={600}>{percentage}% Success Probability</Text>
            <Text size="xs" c="dimmed">Match Level: {matchLevel}</Text>
            <Text size="xs" mt={4}>{data.recommendation_text}</Text>
          </div>
        }
        multiline
        w={250}
      >
        <Badge
          size="sm"
          variant="light"
          color={color}
          leftSection={<IconChartDots size={12} />}
        >
          {percentage}%
        </Badge>
      </Tooltip>
    );
  }

  return (
    <Tooltip
      label={
        <div>
          <Text size="xs" fw={600}>Success Factors:</Text>
          <Text size="xs" mt={4}>Agency History: {(data.score_factors.agency_history * 100).toFixed(0)}%</Text>
          <Text size="xs">Competition: {(data.score_factors.competition_level * 100).toFixed(0)}%</Text>
          <Text size="xs">Org Fit: {(data.score_factors.org_fit * 100).toFixed(0)}%</Text>
          <Text size="xs">Funding Fit: {(data.score_factors.funding_amount_fit * 100).toFixed(0)}%</Text>
          <Text size="xs">Timeline: {(data.score_factors.timeline_feasibility * 100).toFixed(0)}%</Text>
          {data.historical_win_rate !== null && (
            <Text size="xs" mt={4}>Historical Win Rate: {(data.historical_win_rate * 100).toFixed(0)}%</Text>
          )}
          {data.estimated_applicants && (
            <Text size="xs">Est. Applicants: {data.estimated_applicants}</Text>
          )}
        </div>
      }
      multiline
      w={220}
    >
      <Group gap={4}>
        <Badge
          size="md"
          variant="filled"
          color={color}
          leftSection={<IconChartDots size={14} />}
        >
          {percentage}% {matchLevel}
        </Badge>
      </Group>
    </Tooltip>
  );
}
