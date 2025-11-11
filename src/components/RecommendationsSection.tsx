import { Card, Stack, Title, Text, Group, Badge, Button, Loader, Alert, SimpleGrid } from "@mantine/core";
import { IconBrain, IconAlertCircle, IconExternalLink, IconCalendar, IconBookmark } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useOrganization } from "../contexts/OrganizationContext";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import dayjs from "dayjs";

interface Recommendation {
  grant_id: string;
  external_id: string;
  title: string;
  agency: string;
  close_date: string | null;
  funding_category: string | null;
  estimated_funding: number | null;
  recommendation_score: number;
  recommendation_reason: string;
  factors: {
    eligibility_match: number;
    past_behavior: number;
    collaborative_filtering: number;
    agency_familiarity: number;
    funding_fit: number;
  };
}

interface RecommendationsSectionProps {
  onSaveGrant?: (grantId: string) => void;
}

export function RecommendationsSection({ onSaveGrant }: RecommendationsSectionProps) {
  const { currentOrg } = useOrganization();
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ["recommendations", currentOrg?.id, user?.id],
    queryFn: async () => {
      if (!currentOrg?.id || !user?.id) return null;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `/api/recommendations?org_id=${currentOrg.id}&user_id=${user.id}&limit=6`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch recommendations");
      }

      return response.json();
    },
    enabled: !!currentOrg?.id && !!user?.id,
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  if (!currentOrg?.id || !user?.id) return null;

  if (isLoading) {
    return (
      <Card padding="lg" withBorder>
        <Group>
          <Loader size="sm" />
          <Text size="sm" c="dimmed">Loading personalized recommendations...</Text>
        </Group>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
        <Text size="sm">Failed to load recommendations. Please try again later.</Text>
      </Alert>
    );
  }

  const recommendations: Recommendation[] = data?.recommendations || [];

  if (recommendations.length === 0) {
    return (
      <Card padding="lg" withBorder>
        <Group gap="sm">
          <IconBrain size={20} style={{ color: "var(--mantine-color-grape-6)" }} />
          <div>
            <Text size="sm" fw={500}>No recommendations yet</Text>
            <Text size="xs" c="dimmed">
              Save and interact with grants to get personalized recommendations
            </Text>
          </div>
        </Group>
      </Card>
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group gap="xs">
          <IconBrain size={24} style={{ color: "var(--mantine-color-grape-6)" }} />
          <div>
            <Title order={4}>Recommended for You</Title>
            <Text size="sm" c="dimmed">
              Based on your organization's interests and similar organizations
            </Text>
          </div>
        </Group>
        <Badge size="lg" variant="light" color="grape">
          AI-Powered
        </Badge>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
        {recommendations.map((rec) => (
          <Card key={rec.grant_id} padding="md" withBorder radius="md" style={{ height: '100%' }}>
            <Stack gap="sm" style={{ height: '100%' }}>
              <div style={{ flex: 1 }}>
                <Group gap={6} mb={6}>
                  <Badge size="sm" variant="light" color="grape">
                    {(rec.recommendation_score * 100).toFixed(0)}% match
                  </Badge>
                  {rec.funding_category && (
                    <Badge size="sm" variant="outline" color="gray">
                      {rec.funding_category}
                    </Badge>
                  )}
                </Group>

                <Text size="sm" fw={600} lineClamp={2} mb={4}>
                  {rec.title}
                </Text>

                <Text size="xs" c="dimmed" mb={8}>
                  {rec.agency}
                </Text>

                <Text size="xs" c="dimmed" mb={8} lineClamp={2}>
                  {rec.recommendation_reason}
                </Text>

                {rec.close_date && (
                  <Group gap={4}>
                    <IconCalendar size={12} style={{ color: "var(--mantine-color-dimmed)" }} />
                    <Text size="xs" c="dimmed">
                      Due {dayjs(rec.close_date).format("MMM D, YYYY")}
                    </Text>
                  </Group>
                )}
              </div>

              <Group gap="xs" mt="auto">
                <Button
                  size="xs"
                  variant="light"
                  color="grape"
                  leftSection={<IconBookmark size={14} />}
                  onClick={() => onSaveGrant?.(rec.external_id)}
                  style={{ flex: 1 }}
                >
                  Save
                </Button>
                <Button
                  size="xs"
                  variant="subtle"
                  component="a"
                  href={`https://www.grants.gov/search-results-detail/${rec.external_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  rightSection={<IconExternalLink size={14} />}
                >
                  View
                </Button>
              </Group>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>

      {data?.total_count > 6 && (
        <Text size="xs" c="dimmed" ta="center">
          Showing top 6 of {data.total_count} recommendations
        </Text>
      )}
    </Stack>
  );
}
