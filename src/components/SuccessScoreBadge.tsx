import { Badge, Tooltip, Group, Text } from "@mantine/core";
import { IconChartDots } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";

interface SuccessScoreBadgeProps {
  grantId: string;
  orgId?: string;
  compact?: boolean;
}

export function SuccessScoreBadge({ grantId, orgId, compact = false }: SuccessScoreBadgeProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["successScore", grantId, orgId],
    queryFn: async () => {
      if (!orgId) return null; // Silently handle missing org

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null; // Silently handle missing session

      // Use external_id parameter since grantId is typically the Grants.gov ID, not catalog UUID
      const response = await fetch(
        `/api/grants/success-score?external_id=${grantId}&org_id=${orgId}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      // 404 is expected when grant not in catalog - return null silently without error
      if (response.status === 404) return null;

      // Other errors - return null to show N/A badge
      if (!response.ok) return null;

      return response.json();
    },
    enabled: !!grantId && !!orgId,
    retry: false, // Don't retry on 404 (grant not in catalog)
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
  });

  // Show placeholder if loading or error
  if (isLoading) {
    return (
      <Badge size={compact ? "sm" : "md"} variant="light" color="gray">
        ...
      </Badge>
    );
  }

  if (error || !data) {
    return (
      <Tooltip
        label={
          <div>
            <Text size="xs" fw={600}>AI Success Score unavailable</Text>
            <Text size="xs" c="dimmed">Grant may not be in catalog yet</Text>
          </div>
        }
        multiline
        w={200}
      >
        <Badge size={compact ? "sm" : "md"} variant="outline" color="gray">
          AI Success Score: N/A
        </Badge>
      </Tooltip>
    );
  }

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
            <Text size="xs" fw={600}>AI Success Score: {percentage}%</Text>
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
          AI: {percentage}%
        </Badge>
      </Tooltip>
    );
  }

  return (
    <Tooltip
      label={
        <div>
          <Text size="xs" fw={600}>AI Success Score Factors:</Text>
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
          AI: {percentage}% {matchLevel}
        </Badge>
      </Group>
    </Tooltip>
  );
}
