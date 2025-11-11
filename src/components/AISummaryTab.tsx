import { Stack, Text, Button, Paper, Group, Badge, Loader, Alert, SimpleGrid, Divider } from "@mantine/core";
import { IconSparkles, IconAlertCircle, IconCalendar, IconCurrencyDollar, IconUsers, IconTarget } from "@tabler/icons-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { supabase } from "../lib/supabase";
import dayjs from "dayjs";

interface NofoSummary {
  key_dates?: {
    application_deadline?: string;
    award_date?: string;
    project_period_start?: string;
    project_period_end?: string;
  };
  eligibility?: {
    organizations?: string[];
    geographic?: string[];
    restrictions?: string[];
  };
  focus_areas?: string[];
  funding?: {
    total?: number;
    max_award?: number;
    min_award?: number;
    expected_awards?: number;
  };
  priorities?: string[];
  cost_sharing?: {
    required: boolean;
    percentage?: number;
    description?: string;
  };
  restrictions?: string[];
  key_requirements?: string[];
  application_process?: {
    submission_method?: string;
    required_documents?: string[];
    evaluation_criteria?: string[];
  };
  contact_info?: {
    program_officer?: string;
    email?: string;
    phone?: string;
  };
}

interface AISummaryResponse {
  has_summary: boolean;
  summary?: NofoSummary;
  primary_deadline?: string;
  cost_sharing_required?: boolean;
  total_program_funding?: number;
  max_award_amount?: number;
  min_award_amount?: number;
  expected_awards?: number;
  generated_at?: string;
  provider?: string;
  model?: string;
}

interface AISummaryTabProps {
  grantId: string;
  externalId: string;
  grantTitle: string;
  orgId: string;
}

export function AISummaryTab({ grantId, externalId, grantTitle, orgId }: AISummaryTabProps) {
  const queryClient = useQueryClient();

  // Fetch existing summary
  const { data: summaryData, isLoading, error } = useQuery<AISummaryResponse>({
    queryKey: ["aiSummary", grantId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(`/api/grants/nofo-summary?saved_grant_id=${grantId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.status === 404) {
        return { has_summary: false };
      }

      if (!response.ok) {
        throw new Error("Failed to fetch AI summary");
      }

      return response.json();
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  // Generate summary mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Fetch grant details first to get description (as PDF text proxy)
      const detailsResponse = await fetch('/api/grants/details', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id: externalId }),
      });

      if (!detailsResponse.ok) {
        throw new Error("Failed to fetch grant details");
      }

      const grantDetails = await detailsResponse.json();
      const pdfText = grantDetails.description || "No description available";

      // Generate AI summary
      const response = await fetch('/api/grants/nofo-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          saved_grant_id: grantId,
          pdf_text: pdfText,
          grant_title: grantTitle,
          org_id: orgId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || "Failed to generate AI summary");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aiSummary", grantId] });
      notifications.show({
        title: "Summary Generated",
        message: "AI analysis completed successfully",
        color: "green",
      });
    },
    onError: (error) => {
      notifications.show({
        title: "Generation Failed",
        message: error instanceof Error ? error.message : "Failed to generate AI summary",
        color: "red",
      });
    },
  });

  // Loading state
  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="md" />
        <Text size="sm" c="dimmed">Loading AI summary...</Text>
      </Stack>
    );
  }

  // Error state
  if (error && summaryData?.has_summary !== false) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
        Failed to load AI summary. Please try again later.
      </Alert>
    );
  }

  // No summary yet
  if (!summaryData?.has_summary) {
    return (
      <Stack gap="md">
        <Paper p="xl" style={{ textAlign: "center", backgroundColor: "var(--mantine-color-gray-0)" }}>
          <IconSparkles size={48} style={{ color: "var(--mantine-color-violet-6)", marginBottom: 16 }} />
          <Text size="lg" fw={600} mb="xs">
            AI-Powered NOFO Analysis
          </Text>
          <Text size="sm" c="dimmed" mb="lg" maw={400} mx="auto">
            Generate an AI summary to extract key information including deadlines, eligibility requirements, funding amounts, and priorities.
          </Text>
          <Button
            leftSection={<IconSparkles size={16} />}
            onClick={() => generateMutation.mutate()}
            loading={generateMutation.isPending}
            color="violet"
            size="md"
          >
            Generate AI Summary
          </Button>
        </Paper>

        <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
          <Text size="sm">
            <strong>Note:</strong> AI analysis uses grant description data. For complete NOFO analysis, ensure the grant has detailed information available on Grants.gov.
          </Text>
        </Alert>
      </Stack>
    );
  }

  // Display summary
  const summary = summaryData.summary!;

  return (
    <Stack gap="md">
      {/* Header with regenerate button */}
      <Group justify="space-between">
        <Group gap="xs">
          <IconSparkles size={20} style={{ color: "var(--mantine-color-violet-6)" }} />
          <div>
            <Text size="sm" fw={600}>AI Summary</Text>
            <Text size="xs" c="dimmed">
              Generated {summaryData.generated_at ? dayjs(summaryData.generated_at).fromNow() : "recently"}
              {summaryData.provider && ` · ${summaryData.provider}`}
            </Text>
          </div>
        </Group>
        <Button
          size="xs"
          variant="light"
          color="violet"
          leftSection={<IconSparkles size={14} />}
          onClick={() => generateMutation.mutate()}
          loading={generateMutation.isPending}
        >
          Regenerate
        </Button>
      </Group>

      <Divider />

      {/* Key Dates */}
      {summary.key_dates && Object.keys(summary.key_dates).length > 0 && (
        <Paper p="md" withBorder>
          <Group gap="xs" mb="sm">
            <IconCalendar size={18} style={{ color: "var(--mantine-color-blue-6)" }} />
            <Text fw={600} size="sm">Key Dates</Text>
          </Group>
          <SimpleGrid cols={2} spacing="xs">
            {summary.key_dates.application_deadline && (
              <div>
                <Text size="xs" c="dimmed">Application Deadline</Text>
                <Text size="sm" fw={500}>{dayjs(summary.key_dates.application_deadline).format("MMM D, YYYY")}</Text>
              </div>
            )}
            {summary.key_dates.award_date && (
              <div>
                <Text size="xs" c="dimmed">Award Date</Text>
                <Text size="sm" fw={500}>{dayjs(summary.key_dates.award_date).format("MMM D, YYYY")}</Text>
              </div>
            )}
            {summary.key_dates.project_period_start && (
              <div>
                <Text size="xs" c="dimmed">Project Period Start</Text>
                <Text size="sm" fw={500}>{dayjs(summary.key_dates.project_period_start).format("MMM D, YYYY")}</Text>
              </div>
            )}
            {summary.key_dates.project_period_end && (
              <div>
                <Text size="xs" c="dimmed">Project Period End</Text>
                <Text size="sm" fw={500}>{dayjs(summary.key_dates.project_period_end).format("MMM D, YYYY")}</Text>
              </div>
            )}
          </SimpleGrid>
        </Paper>
      )}

      {/* Funding Information */}
      {summary.funding && Object.keys(summary.funding).length > 0 && (
        <Paper p="md" withBorder>
          <Group gap="xs" mb="sm">
            <IconCurrencyDollar size={18} style={{ color: "var(--mantine-color-green-6)" }} />
            <Text fw={600} size="sm">Funding Information</Text>
          </Group>
          <SimpleGrid cols={2} spacing="xs">
            {summary.funding.total && (
              <div>
                <Text size="xs" c="dimmed">Total Program Funding</Text>
                <Text size="sm" fw={500}>${summary.funding.total.toLocaleString()}</Text>
              </div>
            )}
            {summary.funding.max_award && (
              <div>
                <Text size="xs" c="dimmed">Max Award</Text>
                <Text size="sm" fw={500}>${summary.funding.max_award.toLocaleString()}</Text>
              </div>
            )}
            {summary.funding.min_award && (
              <div>
                <Text size="xs" c="dimmed">Min Award</Text>
                <Text size="sm" fw={500}>${summary.funding.min_award.toLocaleString()}</Text>
              </div>
            )}
            {summary.funding.expected_awards && (
              <div>
                <Text size="xs" c="dimmed">Expected Awards</Text>
                <Text size="sm" fw={500}>{summary.funding.expected_awards}</Text>
              </div>
            )}
          </SimpleGrid>
        </Paper>
      )}

      {/* Eligibility */}
      {summary.eligibility && (
        <Paper p="md" withBorder>
          <Group gap="xs" mb="sm">
            <IconUsers size={18} style={{ color: "var(--mantine-color-orange-6)" }} />
            <Text fw={600} size="sm">Eligibility</Text>
          </Group>
          {summary.eligibility.organizations && summary.eligibility.organizations.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <Text size="xs" c="dimmed" mb={4}>Eligible Organizations</Text>
              <Group gap={6}>
                {summary.eligibility.organizations.map((org, idx) => (
                  <Badge key={idx} size="sm" variant="light" color="orange">{org}</Badge>
                ))}
              </Group>
            </div>
          )}
          {summary.eligibility.geographic && summary.eligibility.geographic.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <Text size="xs" c="dimmed" mb={4}>Geographic Eligibility</Text>
              <Group gap={6}>
                {summary.eligibility.geographic.map((geo, idx) => (
                  <Badge key={idx} size="sm" variant="light" color="cyan">{geo}</Badge>
                ))}
              </Group>
            </div>
          )}
          {summary.eligibility.restrictions && summary.eligibility.restrictions.length > 0 && (
            <div>
              <Text size="xs" c="dimmed" mb={4}>Restrictions</Text>
              <Stack gap={4}>
                {summary.eligibility.restrictions.map((restriction, idx) => (
                  <Text key={idx} size="sm">• {restriction}</Text>
                ))}
              </Stack>
            </div>
          )}
        </Paper>
      )}

      {/* Focus Areas & Priorities */}
      {(summary.focus_areas || summary.priorities) && (
        <Paper p="md" withBorder>
          <Group gap="xs" mb="sm">
            <IconTarget size={18} style={{ color: "var(--mantine-color-violet-6)" }} />
            <Text fw={600} size="sm">Focus Areas & Priorities</Text>
          </Group>
          {summary.focus_areas && summary.focus_areas.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <Text size="xs" c="dimmed" mb={4}>Focus Areas</Text>
              <Group gap={6}>
                {summary.focus_areas.map((area, idx) => (
                  <Badge key={idx} size="sm" variant="filled" color="violet">{area}</Badge>
                ))}
              </Group>
            </div>
          )}
          {summary.priorities && summary.priorities.length > 0 && (
            <div>
              <Text size="xs" c="dimmed" mb={4}>Funding Priorities</Text>
              <Stack gap={4}>
                {summary.priorities.map((priority, idx) => (
                  <Text key={idx} size="sm">• {priority}</Text>
                ))}
              </Stack>
            </div>
          )}
        </Paper>
      )}

      {/* Cost Sharing */}
      {summary.cost_sharing && (
        <Paper p="md" withBorder>
          <Text fw={600} size="sm" mb="xs">Cost Sharing</Text>
          <Text size="sm">
            <strong>Required:</strong> {summary.cost_sharing.required ? "Yes" : "No"}
          </Text>
          {summary.cost_sharing.percentage && (
            <Text size="sm">
              <strong>Percentage:</strong> {summary.cost_sharing.percentage}%
            </Text>
          )}
          {summary.cost_sharing.description && (
            <Text size="sm" mt="xs">{summary.cost_sharing.description}</Text>
          )}
        </Paper>
      )}

      {/* Key Requirements */}
      {summary.key_requirements && summary.key_requirements.length > 0 && (
        <Paper p="md" withBorder>
          <Text fw={600} size="sm" mb="xs">Key Requirements</Text>
          <Stack gap={4}>
            {summary.key_requirements.map((req, idx) => (
              <Text key={idx} size="sm">• {req}</Text>
            ))}
          </Stack>
        </Paper>
      )}

      {/* Application Process */}
      {summary.application_process && (
        <Paper p="md" withBorder>
          <Text fw={600} size="sm" mb="xs">Application Process</Text>
          {summary.application_process.submission_method && (
            <Text size="sm" mb="xs">
              <strong>Submission Method:</strong> {summary.application_process.submission_method}
            </Text>
          )}
          {summary.application_process.required_documents && summary.application_process.required_documents.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <Text size="sm" fw={500} mb={4}>Required Documents:</Text>
              <Stack gap={4}>
                {summary.application_process.required_documents.map((doc, idx) => (
                  <Text key={idx} size="sm">• {doc}</Text>
                ))}
              </Stack>
            </div>
          )}
          {summary.application_process.evaluation_criteria && summary.application_process.evaluation_criteria.length > 0 && (
            <div>
              <Text size="sm" fw={500} mb={4}>Evaluation Criteria:</Text>
              <Stack gap={4}>
                {summary.application_process.evaluation_criteria.map((criteria, idx) => (
                  <Text key={idx} size="sm">• {criteria}</Text>
                ))}
              </Stack>
            </div>
          )}
        </Paper>
      )}

      {/* Contact Information */}
      {summary.contact_info && (
        <Paper p="md" withBorder>
          <Text fw={600} size="sm" mb="xs">Contact Information</Text>
          {summary.contact_info.program_officer && (
            <Text size="sm"><strong>Program Officer:</strong> {summary.contact_info.program_officer}</Text>
          )}
          {summary.contact_info.email && (
            <Text size="sm"><strong>Email:</strong> {summary.contact_info.email}</Text>
          )}
          {summary.contact_info.phone && (
            <Text size="sm"><strong>Phone:</strong> {summary.contact_info.phone}</Text>
          )}
        </Paper>
      )}
    </Stack>
  );
}
