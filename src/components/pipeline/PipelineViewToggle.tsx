import { Group, SegmentedControl, Text } from "@mantine/core";
import { IconLayoutBoard, IconList } from "@tabler/icons-react";

interface PipelineViewToggleProps {
  view: 'board' | 'list';
  onViewChange: (view: 'board' | 'list') => void;
  filteredCount: number;
  totalCount: number;
}

export function PipelineViewToggle({ view, onViewChange, filteredCount, totalCount }: PipelineViewToggleProps) {
  return (
    <Group justify="space-between" align="center">
      <SegmentedControl
        value={view}
        onChange={(value) => onViewChange(value as 'board' | 'list')}
        data={[
          {
            value: 'board',
            label: (
              <Group gap="xs">
                <IconLayoutBoard size={16} />
                <span>Board</span>
              </Group>
            ),
          },
          {
            value: 'list',
            label: (
              <Group gap="xs">
                <IconList size={16} />
                <span>List</span>
              </Group>
            ),
          },
        ]}
      />
      <Text size="sm" c="dimmed">
        Showing {filteredCount} of {totalCount} grants
      </Text>
    </Group>
  );
}
