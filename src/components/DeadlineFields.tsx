import { Stack, Group, Text, Badge } from '@mantine/core';
import { IconCalendar, IconClock, IconAlertTriangle } from '@tabler/icons-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

interface DeadlineFieldsProps {
  closeDate: string | null;
  loiDeadline: string | null;
  internalDeadline: string | null;
  compact?: boolean;
}

/**
 * DeadlineFields Component
 *
 * Displays all three deadline types for a grant:
 * - External/Application Deadline (close_date)
 * - LOI Deadline (loi_deadline)
 * - Internal Deadline (internal_deadline)
 *
 * Shows visual indicators for upcoming deadlines and past due items.
 */
export function DeadlineFields({
  closeDate,
  loiDeadline,
  internalDeadline,
  compact = false,
}: DeadlineFieldsProps) {
  const formatDeadline = (date: string | null) => {
    if (!date) return null;

    const deadline = dayjs(date);
    const now = dayjs();
    const daysUntil = deadline.diff(now, 'days');
    const isPastDue = daysUntil < 0;
    const isUrgent = daysUntil <= 7 && daysUntil >= 0;
    const isSoon = daysUntil <= 30 && daysUntil > 7;

    return {
      formatted: deadline.format('MMM D, YYYY'),
      relative: deadline.fromNow(),
      daysUntil,
      isPastDue,
      isUrgent,
      isSoon,
      color: isPastDue ? 'red' : isUrgent ? 'orange' : isSoon ? 'yellow' : 'gray',
    };
  };

  const externalDeadline = formatDeadline(closeDate);
  const loi = formatDeadline(loiDeadline);
  const internal = formatDeadline(internalDeadline);

  if (!externalDeadline && !loi && !internal) {
    return (
      <Text size="sm" c="dimmed">
        No deadlines set
      </Text>
    );
  }

  if (compact) {
    return (
      <Group gap="xs">
        {internal && (
          <Badge
            size="sm"
            color={internal.color}
            leftSection={<IconClock size={14} />}
            variant={internal.isUrgent || internal.isPastDue ? 'filled' : 'light'}
          >
            Internal: {internal.formatted}
          </Badge>
        )}
        {loi && (
          <Badge
            size="sm"
            color={loi.color}
            leftSection={<IconAlertTriangle size={14} />}
            variant={loi.isUrgent || loi.isPastDue ? 'filled' : 'light'}
          >
            LOI: {loi.formatted}
          </Badge>
        )}
        {externalDeadline && (
          <Badge
            size="sm"
            color={externalDeadline.color}
            leftSection={<IconCalendar size={14} />}
            variant={externalDeadline.isUrgent || externalDeadline.isPastDue ? 'filled' : 'light'}
          >
            Due: {externalDeadline.formatted}
          </Badge>
        )}
      </Group>
    );
  }

  return (
    <Stack gap="xs">
      {internal && (
        <Group gap="xs">
          <IconClock size={16} style={{ color: 'var(--mantine-color-blue-6)' }} />
          <div>
            <Text size="sm" fw={500}>
              Internal Deadline
            </Text>
            <Group gap="xs">
              <Text size="sm" c={internal.isPastDue ? 'red' : internal.isUrgent ? 'orange' : 'dimmed'}>
                {internal.formatted}
              </Text>
              <Badge size="xs" color={internal.color} variant="light">
                {internal.relative}
              </Badge>
            </Group>
          </div>
        </Group>
      )}

      {loi && (
        <Group gap="xs">
          <IconAlertTriangle size={16} style={{ color: 'var(--mantine-color-violet-6)' }} />
          <div>
            <Text size="sm" fw={500}>
              LOI Deadline
            </Text>
            <Group gap="xs">
              <Text size="sm" c={loi.isPastDue ? 'red' : loi.isUrgent ? 'orange' : 'dimmed'}>
                {loi.formatted}
              </Text>
              <Badge size="xs" color={loi.color} variant="light">
                {loi.relative}
              </Badge>
            </Group>
          </div>
        </Group>
      )}

      {externalDeadline && (
        <Group gap="xs">
          <IconCalendar size={16} style={{ color: 'var(--mantine-color-gray-6)' }} />
          <div>
            <Text size="sm" fw={500}>
              Application Deadline
            </Text>
            <Group gap="xs">
              <Text size="sm" c={externalDeadline.isPastDue ? 'red' : externalDeadline.isUrgent ? 'orange' : 'dimmed'}>
                {externalDeadline.formatted}
              </Text>
              <Badge size="xs" color={externalDeadline.color} variant="light">
                {externalDeadline.relative}
              </Badge>
            </Group>
          </div>
        </Group>
      )}
    </Stack>
  );
}
