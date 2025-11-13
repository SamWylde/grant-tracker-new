import { useQuery } from '@tanstack/react-query';
import {
  Card,
  Group,
  Stack,
  Text,
  Progress,
  Badge,
  Alert,
  Loader,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconInfoCircle,
  IconCheck,
} from '@tabler/icons-react';
import { supabase } from '../lib/supabase';

interface StorageQuotaIndicatorProps {
  orgId: string;
  compact?: boolean;
}

export function StorageQuotaIndicator({
  orgId,
  compact = false,
}: StorageQuotaIndicatorProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['storage-quota', orgId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`/api/documents/quota?org_id=${orgId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }

      return response.json();
    },
    enabled: !!orgId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const getPlanColor = (planName: string) => {
    const colors: Record<string, string> = {
      free: 'gray',
      starter: 'blue',
      pro: 'violet',
      enterprise: 'grape',
    };
    return colors[planName] || 'gray';
  };

  const getStorageColor = (percentage: number) => {
    if (percentage >= 90) return 'red';
    if (percentage >= 75) return 'orange';
    if (percentage >= 50) return 'yellow';
    return 'green';
  };

  if (isLoading) {
    return (
      <Group justify="center" p="sm">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">Loading quota...</Text>
      </Group>
    );
  }

  if (error) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} color="red" title="Error loading quota">
        {error instanceof Error ? error.message : 'Failed to load storage quota'}
      </Alert>
    );
  }

  if (!data) return null;

  const storagePercentage = data.percentages.storage;
  const documentsPercentage = data.percentages.documents;
  const storageColor = getStorageColor(storagePercentage);
  const isNearLimit = storagePercentage >= 75 || documentsPercentage >= 75;
  const isOverLimit = storagePercentage >= 100 || documentsPercentage >= 100;

  // Compact mode for inline display
  if (compact) {
    return (
      <Group gap="xs">
        <Badge size="sm" color={getPlanColor(data.plan_name)}>
          {data.plan_name}
        </Badge>
        <Text size="sm" c="dimmed">
          Storage: {formatBytes(data.current_usage.total_storage_bytes)} / {formatBytes(data.limits.max_storage_bytes)}
        </Text>
        {isOverLimit && (
          <Badge size="sm" color="red" leftSection={<IconAlertCircle size={12} />}>
            Quota exceeded
          </Badge>
        )}
        {isNearLimit && !isOverLimit && (
          <Badge size="sm" color="orange" leftSection={<IconAlertCircle size={12} />}>
            {storagePercentage}% used
          </Badge>
        )}
      </Group>
    );
  }

  // Full mode for detailed display
  return (
    <Card padding="md" withBorder>
      <Stack gap="md">
        {/* Header */}
        <Group justify="space-between">
          <Group gap="xs">
            <Text fw={500} size="sm">Storage Usage</Text>
            <Badge size="sm" color={getPlanColor(data.plan_name)}>
              {data.plan_name} plan
            </Badge>
          </Group>
          {!isOverLimit && !isNearLimit && (
            <Badge size="sm" color="green" leftSection={<IconCheck size={12} />}>
              Good
            </Badge>
          )}
        </Group>

        {/* Storage Progress */}
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="sm" c="dimmed">Storage</Text>
            <Text size="sm" fw={500}>
              {formatBytes(data.current_usage.total_storage_bytes)} / {formatBytes(data.limits.max_storage_bytes)}
            </Text>
          </Group>
          <Progress
            value={storagePercentage}
            color={storageColor}
            size="lg"
            radius="sm"
            striped={isNearLimit}
            animated={isOverLimit}
          />
          <Text size="xs" c="dimmed" ta="right">
            {storagePercentage}% used
          </Text>
        </Stack>

        {/* Document Count Progress (if limited) */}
        {data.limits.max_documents !== null && (
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Documents</Text>
              <Text size="sm" fw={500}>
                {data.current_usage.total_documents} / {data.limits.max_documents}
              </Text>
            </Group>
            <Progress
              value={documentsPercentage}
              color={getStorageColor(documentsPercentage)}
              size="lg"
              radius="sm"
              striped={documentsPercentage >= 75}
              animated={documentsPercentage >= 100}
            />
            <Text size="xs" c="dimmed" ta="right">
              {documentsPercentage}% used
            </Text>
          </Stack>
        )}

        {/* Unlimited documents badge */}
        {data.limits.max_documents === null && (
          <Alert icon={<IconInfoCircle size={16} />} color="blue" p="xs">
            <Text size="xs">Unlimited documents on {data.plan_name} plan</Text>
          </Alert>
        )}

        {/* Warnings */}
        {isOverLimit && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" title="Quota exceeded">
            <Text size="sm">
              You've reached your storage limit. Delete old documents or upgrade your plan to continue uploading.
            </Text>
          </Alert>
        )}

        {isNearLimit && !isOverLimit && (
          <Alert icon={<IconAlertCircle size={16} />} color="orange" title="Approaching limit">
            <Text size="sm">
              You're using {Math.max(storagePercentage, documentsPercentage)}% of your quota.
              Consider upgrading to avoid interruptions.
            </Text>
          </Alert>
        )}

        {/* Plan limits info */}
        <Text size="xs" c="dimmed">
          Max file size: {formatBytes(data.limits.max_file_size_bytes)}
          {data.updated_at && (
            <> • Updated {new Date(data.updated_at).toLocaleString()}</>
          )}
        </Text>
      </Stack>
    </Card>
  );
}
