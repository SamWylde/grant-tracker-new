import { Box, Group, Text } from "@mantine/core";
import { IconCalendar, IconClock } from "@tabler/icons-react";
import dayjs from "dayjs";

interface GrantDeadlineInfoProps {
  closeDate: string | null;
  openDate: string | null;
}

export function GrantDeadlineInfo({ closeDate, openDate }: GrantDeadlineInfoProps) {
  const daysUntilDeadline = closeDate
    ? dayjs(closeDate).diff(dayjs(), "days")
    : null;

  const isOverdue = daysUntilDeadline !== null && daysUntilDeadline < 0;
  const isClosingSoon = daysUntilDeadline !== null && daysUntilDeadline <= 14 && daysUntilDeadline >= 0;

  return (
    <Box
      p="md"
      style={{
        backgroundColor: isOverdue
          ? "var(--mantine-color-red-0)"
          : isClosingSoon
          ? "var(--mantine-color-yellow-0)"
          : "var(--mantine-color-gray-0)",
        borderRadius: "var(--mantine-radius-md)",
      }}
    >
      <Group gap="md">
        <IconCalendar
          size={20}
          style={{
            color: isOverdue
              ? "var(--mantine-color-red-6)"
              : isClosingSoon
              ? "var(--mantine-color-yellow-6)"
              : "var(--mantine-color-gray-6)",
          }}
        />
        <div>
          <Text size="sm" fw={500}>
            Deadline
          </Text>
          <Text size="sm" c="dimmed">
            {closeDate
              ? dayjs(closeDate).format("MMM D, YYYY")
              : "No deadline set"}
          </Text>
          {daysUntilDeadline !== null && (
            <Text
              size="xs"
              c={isOverdue ? "red" : isClosingSoon ? "yellow.8" : "dimmed"}
              mt={2}
            >
              {isOverdue
                ? `Overdue by ${Math.abs(daysUntilDeadline)} days`
                : `${daysUntilDeadline} days remaining`}
            </Text>
          )}
        </div>
      </Group>
      {openDate && (
        <Group gap="md" mt="sm">
          <IconClock
            size={20}
            style={{ color: "var(--mantine-color-gray-6)" }}
          />
          <div>
            <Text size="sm" fw={500}>
              Open Date
            </Text>
            <Text size="sm" c="dimmed">
              {dayjs(openDate).format("MMM D, YYYY")}
            </Text>
          </div>
        </Group>
      )}
    </Box>
  );
}
