import { Card, Stack, Skeleton, Group, Text, Badge, Paper } from '@mantine/core';
import { IconSparkles } from '@tabler/icons-react';

interface GrantEnrichmentSkeletonProps {
  showEnrichmentStatus?: boolean;
  enrichmentMessage?: string;
}

/**
 * Skeleton loader component for grant cards during enrichment
 * Shows a loading state with indication that enrichment is in progress
 */
export function GrantEnrichmentSkeleton({
  showEnrichmentStatus = true,
  enrichmentMessage = 'Enriching grant data...',
}: GrantEnrichmentSkeletonProps) {
  return (
    <Card padding="lg" withBorder>
      <Stack gap="md">
        {/* Enrichment status banner */}
        {showEnrichmentStatus && (
          <Paper p="sm" bg="var(--mantine-color-grape-0)" withBorder>
            <Group gap="xs">
              <IconSparkles size={16} color="var(--mantine-color-grape-6)" />
              <Text size="xs" c="grape" fw={500}>
                {enrichmentMessage}
              </Text>
            </Group>
          </Paper>
        )}

        {/* Header skeleton */}
        <Group justify="space-between" align="flex-start">
          <Stack gap={8} style={{ flex: 1 }}>
            <Group gap="xs">
              <Skeleton height={20} width={80} radius="sm" />
              <Skeleton height={20} width={60} radius="sm" />
            </Group>
            <Skeleton height={24} width="80%" />
            <Skeleton height={16} width="60%" />
          </Stack>
          <Group gap="xs">
            <Skeleton height={36} width={100} radius="md" />
          </Group>
        </Group>

        {/* Description skeleton */}
        <Stack gap={4}>
          <Skeleton height={14} width="100%" />
          <Skeleton height={14} width="95%" />
          <Skeleton height={14} width="70%" />
        </Stack>

        {/* Metadata skeleton */}
        <Group gap="xl">
          <Stack gap={4}>
            <Skeleton height={12} width={60} />
            <Skeleton height={16} width={100} />
          </Stack>
          <Stack gap={4}>
            <Skeleton height={12} width={40} />
            <Skeleton height={16} width={120} />
          </Stack>
        </Group>
      </Stack>
    </Card>
  );
}

/**
 * Inline enrichment indicator for showing which fields are being enriched
 */
export function EnrichmentFieldIndicator({
  fieldName,
  isEnriching,
}: {
  fieldName: string;
  isEnriching: boolean;
}) {
  if (!isEnriching) return null;

  return (
    <Badge
      size="xs"
      variant="dot"
      color="grape"
      leftSection={<IconSparkles size={10} />}
    >
      Enriching {fieldName}...
    </Badge>
  );
}

/**
 * Enrichment status display for import and batch operations
 */
export function EnrichmentStatusBanner({
  enrichedCount,
  totalCount,
  currentField,
}: {
  enrichedCount: number;
  totalCount: number;
  currentField?: string;
}) {
  const percentage = totalCount > 0 ? (enrichedCount / totalCount) * 100 : 0;

  return (
    <Paper p="md" withBorder bg="var(--mantine-color-grape-0)">
      <Stack gap="sm">
        <Group gap="xs">
          <IconSparkles size={20} color="var(--mantine-color-grape-6)" />
          <Text size="sm" fw={600} c="grape">
            AI Enrichment in Progress
          </Text>
        </Group>
        <Text size="xs" c="dimmed">
          {enrichedCount} of {totalCount} grants enriched ({percentage.toFixed(0)}%)
        </Text>
        {currentField && (
          <Text size="xs" c="grape">
            Currently enriching: {currentField}
          </Text>
        )}
      </Stack>
    </Paper>
  );
}
