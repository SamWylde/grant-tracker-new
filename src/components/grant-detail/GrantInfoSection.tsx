import { Box, Stack, Group, Text, Button } from "@mantine/core";
import { IconExternalLink, IconPrinter } from "@tabler/icons-react";
import dayjs from "dayjs";
import { stripHtml } from "../../utils/htmlUtils";

interface GrantInfoSectionProps {
  description: string | null;
  externalId: string;
  aln: string | null;
  externalSource: string;
  savedAt: string;
  stageUpdatedAt: string | null;
  onPrintBrief: () => void;
}

export function GrantInfoSection({
  description,
  externalId,
  aln,
  externalSource,
  savedAt,
  stageUpdatedAt,
  onPrintBrief,
}: GrantInfoSectionProps) {
  return (
    <>
      {/* Grant Description */}
      {description && (
        <Box
          p="md"
          style={{
            backgroundColor: "var(--mantine-color-gray-0)",
            borderRadius: "var(--mantine-radius-md)",
          }}
        >
          <Text size="sm" fw={500} mb="sm">
            Description
          </Text>
          <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
            {stripHtml(description)}
          </Text>
        </Box>
      )}

      {/* Additional Grant Information */}
      <Box
        p="md"
        style={{
          backgroundColor: "var(--mantine-color-gray-0)",
          borderRadius: "var(--mantine-radius-md)",
        }}
      >
        <Text size="sm" fw={500} mb="sm">
          Grant Information
        </Text>
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="sm" c="dimmed">Grant ID</Text>
            <Text size="sm" fw={500}>{externalId}</Text>
          </Group>
          {aln && (
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Assistance Listing Number (ALN)</Text>
              <Text size="sm" fw={500}>{aln}</Text>
            </Group>
          )}
          <Group justify="space-between">
            <Text size="sm" c="dimmed">Source</Text>
            <Text size="sm" fw={500}>{externalSource}</Text>
          </Group>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">Added to Pipeline</Text>
            <Text size="sm" fw={500}>{dayjs(savedAt).format("MMM D, YYYY h:mm A")}</Text>
          </Group>
          {stageUpdatedAt && (
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Last Stage Change</Text>
              <Text size="sm" fw={500}>{dayjs(stageUpdatedAt).format("MMM D, YYYY h:mm A")}</Text>
            </Group>
          )}
        </Stack>
      </Box>

      {/* Quick Actions */}
      <Group grow>
        <Button
          component="a"
          href={`https://www.grants.gov/search-results-detail/${externalId}`}
          target="_blank"
          rel="noopener noreferrer"
          leftSection={<IconExternalLink size={16} />}
          variant="light"
        >
          View on Grants.gov
        </Button>
        <Button
          onClick={onPrintBrief}
          leftSection={<IconPrinter size={16} />}
          variant="light"
          color="grape"
        >
          Print Brief
        </Button>
      </Group>
    </>
  );
}
