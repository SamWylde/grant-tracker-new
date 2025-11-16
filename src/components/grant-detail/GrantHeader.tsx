import { Box, Group, Title, Text, Select } from "@mantine/core";
import { IconBuilding } from "@tabler/icons-react";

const PRIORITY_COLORS: Record<string, string> = {
  low: "gray",
  medium: "blue",
  high: "orange",
  urgent: "red",
};

interface GrantHeaderProps {
  title: string;
  agency: string | null;
  aln: string | null;
  priority: string | null;
  status: string;
  onUpdatePriority: (priority: string) => void;
  onUpdateStatus: (status: string) => void;
}

export function GrantHeader({
  title,
  agency,
  aln,
  priority,
  status,
  onUpdatePriority,
  onUpdateStatus,
}: GrantHeaderProps) {
  return (
    <Box>
      <Group mb="xs" gap="xs">
        {/* Inline Priority Editor */}
        <Select
          value={priority || 'medium'}
          onChange={(value) => {
            if (value) {
              onUpdatePriority(value);
            }
          }}
          data={[
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
            { value: 'urgent', label: 'Urgent' },
          ]}
          size="xs"
          w={110}
          styles={{
            input: {
              backgroundColor: priority ? `var(--mantine-color-${PRIORITY_COLORS[priority]}-0)` : 'var(--mantine-color-gray-0)',
              border: `1px solid var(--mantine-color-${PRIORITY_COLORS[priority || 'gray']}-3)`,
              color: `var(--mantine-color-${PRIORITY_COLORS[priority || 'gray']}-7)`,
              fontWeight: 500,
              cursor: 'pointer',
            },
          }}
        />

        {/* Inline Status Editor */}
        <Select
          value={status}
          onChange={(value) => {
            if (value) {
              onUpdateStatus(value);
            }
          }}
          data={[
            { value: 'researching', label: 'Researching' },
            { value: 'drafting', label: 'Drafting' },
            { value: 'submitted', label: 'Submitted' },
            { value: 'awarded', label: 'Awarded' },
          ]}
          size="xs"
          w={130}
          styles={{
            input: {
              backgroundColor: 'var(--mantine-color-blue-0)',
              border: '1px solid var(--mantine-color-blue-3)',
              color: 'var(--mantine-color-blue-7)',
              fontWeight: 500,
              cursor: 'pointer',
            },
          }}
        />
      </Group>
      <Title order={3} mb="sm">
        {title}
      </Title>
      {agency && (
        <Group gap={6} mb="xs">
          <IconBuilding size={16} style={{ color: "var(--mantine-color-gray-6)" }} />
          <Text size="sm" c="dimmed">
            {agency}
          </Text>
        </Group>
      )}
      {aln && (
        <Text size="sm" c="dimmed" mb="xs">
          ALN: {aln}
        </Text>
      )}
    </Box>
  );
}
