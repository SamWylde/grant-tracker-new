import { Group, Stack, Title, Text, Button, Divider } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { Link } from "react-router-dom";

interface DiscoverHeaderProps {
  savedGrantsCount: number;
  onQuickAddClick: () => void;
}

export function DiscoverHeader({ savedGrantsCount, onQuickAddClick }: DiscoverHeaderProps) {
  return (
    <>
      <Group justify="space-between" align="flex-start">
        <Stack gap="sm">
          <Title order={1}>Discover Federal Grant Opportunities</Title>
          <Text c="dimmed" size="lg">
            Search and save grant opportunities from Grants.gov to your pipeline
          </Text>
        </Stack>
        <Group>
          <Button
            variant="outline"
            color="grape"
            leftSection={<IconPlus size={16} />}
            onClick={onQuickAddClick}
          >
            Quick Add from URL
          </Button>
          <Button
            variant="light"
            color="grape"
            component={Link}
            to="/pipeline"
          >
            View Saved ({savedGrantsCount})
          </Button>
        </Group>
      </Group>

      <Divider />
    </>
  );
}
