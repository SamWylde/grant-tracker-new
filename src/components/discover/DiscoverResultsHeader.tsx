import { Group, Text, Button } from "@mantine/core";

interface DiscoverResultsHeaderProps {
  currentPage: number;
  itemsPerPage: number;
  resultsCount: number;
  totalCount: number;
  isLoading: boolean;
  onRefresh: () => void;
}

export function DiscoverResultsHeader({
  currentPage,
  itemsPerPage,
  resultsCount,
  totalCount,
  isLoading,
  onRefresh,
}: DiscoverResultsHeaderProps) {
  const startIndex = resultsCount > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endIndex = Math.min(currentPage * itemsPerPage, totalCount);

  return (
    <Group justify="space-between">
      <Text size="sm" c="dimmed">
        Showing {startIndex}–{endIndex} of {totalCount.toLocaleString()} results
      </Text>
      <Button
        variant="subtle"
        size="xs"
        onClick={onRefresh}
        disabled={isLoading}
      >
        Refresh
      </Button>
    </Group>
  );
}
