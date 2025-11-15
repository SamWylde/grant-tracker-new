import { Card, Skeleton, Stack, Group, Divider } from "@mantine/core";

interface GrantCardSkeletonProps {
  /**
   * Number of skeleton cards to render
   * @default 3
   */
  count?: number;
  /**
   * Whether to render compact skeleton (for pipeline board view)
   * @default false
   */
  compact?: boolean;
}

/**
 * Skeleton loader for grant cards
 * Provides visual feedback while grant data is loading
 */
export function GrantCardSkeleton({ count = 3, compact = false }: GrantCardSkeletonProps) {
  if (compact) {
    // Compact skeleton for pipeline board cards
    return (
      <>
        {Array.from({ length: count }).map((_, index) => (
          <Card key={index} padding="md" withBorder>
            <Stack gap="sm">
              {/* Priority badge and drag handle */}
              <Group justify="space-between">
                <Skeleton height={16} width={16} />
                <Skeleton height={20} width={60} radius="xl" />
              </Group>

              {/* Badges */}
              <Group gap="xs">
                <Skeleton height={18} width={50} radius="xl" />
                <Skeleton height={18} width={70} radius="xl" />
              </Group>

              {/* Title */}
              <Skeleton height={16} width="90%" />
              <Skeleton height={16} width="70%" />

              {/* Agency */}
              <Skeleton height={14} width="60%" />

              {/* Description */}
              <Skeleton height={12} width="100%" />
              <Skeleton height={12} width="85%" />

              {/* Dates */}
              <Group gap="xs">
                <Skeleton height={12} width={16} circle />
                <Skeleton height={12} width={100} />
              </Group>

              {/* Actions */}
              <Group gap="xs" mt="xs" justify="space-between">
                <Skeleton height={24} width={24} />
                <Skeleton height={24} width={24} />
              </Group>
            </Stack>
          </Card>
        ))}
      </>
    );
  }

  // Full skeleton for discover/list view cards
  return (
    <Stack gap="md">
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index} padding="lg" withBorder>
          <Stack gap="md">
            {/* Header */}
            <Group justify="space-between" align="flex-start">
              <Stack gap={8} style={{ flex: 1 }}>
                {/* Badges */}
                <Group gap="xs">
                  <Skeleton height={22} width={70} radius="xl" />
                  <Skeleton height={22} width={80} radius="xl" />
                  <Skeleton height={22} width={60} radius="xl" />
                  <Skeleton height={22} width={90} radius="xl" />
                </Group>

                {/* Title */}
                <Skeleton height={20} width="95%" />
                <Skeleton height={20} width="75%" />

                {/* Agency */}
                <Skeleton height={16} width="40%" mt={4} />

                {/* Description */}
                <Skeleton height={14} width="100%" mt={8} />
                <Skeleton height={14} width="90%" />
              </Stack>

              {/* Action buttons */}
              <Group gap="xs" style={{ flexShrink: 0 }}>
                <Skeleton height={36} width={90} radius="sm" />
                <Skeleton height={36} width={80} radius="sm" />
              </Group>
            </Group>

            <Divider />

            {/* Dates */}
            <Group gap="xl">
              <Stack gap={4}>
                <Skeleton height={12} width={60} />
                <Skeleton height={16} width={100} />
              </Stack>
              <Stack gap={4}>
                <Skeleton height={12} width={50} />
                <Group gap="xs">
                  <Skeleton height={16} width={120} />
                  <Skeleton height={20} width={60} radius="xl" />
                </Group>
              </Stack>
            </Group>
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}
