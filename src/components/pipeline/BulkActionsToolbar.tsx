import { Paper, Group, ActionIcon, Text, Button, Menu } from "@mantine/core";
import { IconX, IconFlag, IconTrash } from "@tabler/icons-react";

interface BulkActionsToolbarProps {
  selectedCount: number;
  onDeselectAll: () => void;
  onBulkUpdateStatus: (status: string) => void;
  onBulkUpdatePriority: (priority: string) => void;
  onBulkDelete: () => void;
  isOperating: boolean;
}

export function BulkActionsToolbar({
  selectedCount,
  onDeselectAll,
  onBulkUpdateStatus,
  onBulkUpdatePriority,
  onBulkDelete,
  isOperating,
}: BulkActionsToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <Paper p="md" withBorder bg="var(--mantine-color-grape-0)">
      <Group justify="space-between">
        <Group gap="sm">
          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={onDeselectAll}
            title="Deselect all"
          >
            <IconX size={18} />
          </ActionIcon>
          <Text fw={600} size="sm">
            {selectedCount} grant{selectedCount !== 1 ? 's' : ''} selected
          </Text>
        </Group>
        <Group gap="xs">
          <Menu shadow="md" width={180}>
            <Menu.Target>
              <Button
                size="sm"
                variant="light"
                leftSection={<IconFlag size={16} />}
                loading={isOperating}
              >
                Set Status
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={() => onBulkUpdateStatus('researching')}>
                Researching
              </Menu.Item>
              <Menu.Item onClick={() => onBulkUpdateStatus('go-no-go')}>
                Go/No-Go
              </Menu.Item>
              <Menu.Item onClick={() => onBulkUpdateStatus('drafting')}>
                Drafting
              </Menu.Item>
              <Menu.Item onClick={() => onBulkUpdateStatus('submitted')}>
                Submitted
              </Menu.Item>
              <Menu.Item onClick={() => onBulkUpdateStatus('awarded')}>
                Awarded
              </Menu.Item>
              <Menu.Item onClick={() => onBulkUpdateStatus('not-funded')}>
                Not Funded
              </Menu.Item>
              <Menu.Item onClick={() => onBulkUpdateStatus('closed-out')}>
                Closed Out
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
          <Menu shadow="md" width={180}>
            <Menu.Target>
              <Button
                size="sm"
                variant="light"
                color="blue"
                leftSection={<IconFlag size={16} />}
                loading={isOperating}
              >
                Set Priority
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={() => onBulkUpdatePriority('low')}>
                Low
              </Menu.Item>
              <Menu.Item onClick={() => onBulkUpdatePriority('medium')}>
                Medium
              </Menu.Item>
              <Menu.Item onClick={() => onBulkUpdatePriority('high')}>
                High
              </Menu.Item>
              <Menu.Item onClick={() => onBulkUpdatePriority('urgent')}>
                Urgent
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
          <Button
            size="sm"
            variant="light"
            color="red"
            leftSection={<IconTrash size={16} />}
            onClick={onBulkDelete}
            loading={isOperating}
          >
            Delete
          </Button>
        </Group>
      </Group>
    </Paper>
  );
}
