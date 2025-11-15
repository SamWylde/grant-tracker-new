import { Group, Title, Text, Button, Menu, Divider } from "@mantine/core";
import { IconUpload, IconDownload, IconChevronDown, IconPrinter } from "@tabler/icons-react";
import type { SavedGrant } from "../../hooks/useSavedGrants";
import { printBoardPacket, exportGrantsToCSV } from "../../utils/printBoardPacket";

interface PipelineHeaderProps {
  view: 'board' | 'list';
  filteredGrants: SavedGrant[];
  orgName: string;
  onImportClick: () => void;
}

export function PipelineHeader({ view, filteredGrants, orgName, onImportClick }: PipelineHeaderProps) {
  return (
    <>
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={1}>Pipeline</Title>
          <Text c="dimmed" size="lg">
            {view === 'board'
              ? 'Track grants through your workflow stages'
              : 'Manage your saved grants and track important deadlines'}
          </Text>
        </div>
        <Group>
          <Button
            leftSection={<IconUpload size={16} />}
            variant="light"
            onClick={onImportClick}
          >
            Import Grants
          </Button>
          <Menu shadow="md" width={200}>
            <Menu.Target>
              <Button
                leftSection={<IconDownload size={16} />}
                rightSection={<IconChevronDown size={16} />}
                variant="light"
                color="grape"
                disabled={filteredGrants.length === 0}
              >
                Export
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<IconPrinter size={16} />}
                onClick={() => printBoardPacket(filteredGrants, {
                  title: view === 'board' ? 'Pipeline Board Packet' : 'Saved Grants Report'
                })}
              >
                Print Report
              </Menu.Item>
              <Menu.Item
                leftSection={<IconDownload size={16} />}
                onClick={() => exportGrantsToCSV(filteredGrants, orgName)}
              >
                Download CSV
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>

      <Divider />
    </>
  );
}
