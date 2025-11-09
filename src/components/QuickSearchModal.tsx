import { Badge, Group, Kbd, Modal, Stack, Text, TextInput, UnstyledButton } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { IconClock, IconSearch } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";

interface RecentSearch {
  id: string;
  keyword: string | null;
  category: string | null;
  agency: string | null;
  status_posted: boolean;
  status_forecasted: boolean;
  due_in_days: number | null;
  sort_by: string;
  search_count: number;
  last_used_at: string;
}

interface QuickSearchModalProps {
  opened: boolean;
  onClose: () => void;
  orgId: string;
  userId: string;
  onSearchSelect?: (search: RecentSearch) => void;
}

export function QuickSearchModal({
  opened,
  onClose,
  orgId,
  userId,
  onSearchSelect,
}: QuickSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Load recent searches
  useEffect(() => {
    if (opened) {
      loadRecentSearches();
    }
  }, [opened, orgId, userId]);

  const loadRecentSearches = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/recent-searches?org_id=${orgId}&user_id=${userId}&limit=10`
      );
      if (response.ok) {
        const data = await response.json();
        setRecentSearches(data.searches || []);
      }
    } catch (error) {
      console.error("Error loading recent searches:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSelect = (search: RecentSearch) => {
    if (onSearchSelect) {
      onSearchSelect(search);
    }
    onClose();
  };

  const handleQuickSearch = (keyword: string) => {
    // Navigate to discover page with keyword
    navigate(`/discover?keyword=${encodeURIComponent(keyword)}`);
    onClose();
  };

  const formatSearchLabel = (search: RecentSearch): string => {
    const parts: string[] = [];

    if (search.keyword) parts.push(`"${search.keyword}"`);
    if (search.category) parts.push(search.category);
    if (search.agency) parts.push(search.agency);
    if (search.due_in_days) parts.push(`Due in ≤${search.due_in_days} days`);

    return parts.length > 0 ? parts.join(" • ") : "All grants";
  };

  const filteredSearches = recentSearches.filter((search) => {
    const label = formatSearchLabel(search).toLowerCase();
    return label.includes(searchQuery.toLowerCase());
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconSearch size={20} />
          <Text fw={600}>Quick Search</Text>
        </Group>
      }
      size="lg"
      centered
    >
      <Stack gap="md">
        <TextInput
          placeholder="Search grants or select recent search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          leftSection={<IconSearch size={16} />}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && searchQuery.trim()) {
              handleQuickSearch(searchQuery);
            }
          }}
          rightSection={
            <Group gap={4}>
              <Kbd size="xs">⏎</Kbd>
            </Group>
          }
        />

        {/* Recent Searches */}
        {!searchQuery && recentSearches.length > 0 && (
          <Stack gap="xs">
            <Text size="sm" fw={600} c="dimmed">
              Recent Searches
            </Text>
            {recentSearches.map((search) => (
              <UnstyledButton
                key={search.id}
                onClick={() => handleSearchSelect(search)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "4px",
                  border: "1px solid var(--mantine-color-gray-3)",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--mantine-color-gray-0)";
                  e.currentTarget.style.borderColor = "var(--mantine-color-grape-4)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.borderColor = "var(--mantine-color-gray-3)";
                }}
              >
                <Group justify="space-between" wrap="nowrap">
                  <Group gap="xs" style={{ flex: 1 }}>
                    <IconClock size={16} color="var(--mantine-color-dimmed)" />
                    <Text size="sm" lineClamp={1}>
                      {formatSearchLabel(search)}
                    </Text>
                  </Group>
                  <Group gap="xs">
                    <Badge size="xs" variant="light" color="gray">
                      {search.search_count}x
                    </Badge>
                    <Text size="xs" c="dimmed">
                      {dayjs(search.last_used_at).fromNow()}
                    </Text>
                  </Group>
                </Group>
              </UnstyledButton>
            ))}
          </Stack>
        )}

        {/* Filtered searches */}
        {searchQuery && filteredSearches.length > 0 && (
          <Stack gap="xs">
            <Text size="sm" fw={600} c="dimmed">
              Matching Recent Searches
            </Text>
            {filteredSearches.map((search) => (
              <UnstyledButton
                key={search.id}
                onClick={() => handleSearchSelect(search)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "4px",
                  border: "1px solid var(--mantine-color-gray-3)",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--mantine-color-gray-0)";
                  e.currentTarget.style.borderColor = "var(--mantine-color-grape-4)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.borderColor = "var(--mantine-color-gray-3)";
                }}
              >
                <Group justify="space-between" wrap="nowrap">
                  <Group gap="xs" style={{ flex: 1 }}>
                    <IconClock size={16} color="var(--mantine-color-dimmed)" />
                    <Text size="sm" lineClamp={1}>
                      {formatSearchLabel(search)}
                    </Text>
                  </Group>
                  <Badge size="xs" variant="light" color="gray">
                    {search.search_count}x
                  </Badge>
                </Group>
              </UnstyledButton>
            ))}
          </Stack>
        )}

        {/* Empty state */}
        {recentSearches.length === 0 && !loading && (
          <Text size="sm" c="dimmed" ta="center" py="xl">
            No recent searches yet
          </Text>
        )}

        {/* Hint */}
        <Text size="xs" c="dimmed" ta="center">
          Press{" "}
          <Kbd size="xs">
            {navigator.platform.toLowerCase().includes("mac") ? "⌘" : "Ctrl"}
          </Kbd>
          {" + "}
          <Kbd size="xs">K</Kbd> to open quick search
        </Text>
      </Stack>
    </Modal>
  );
}

export function useQuickSearchModal() {
  const [opened, setOpened] = useState(false);

  useHotkeys([
    [
      "mod+K",
      (e) => {
        e.preventDefault();
        setOpened(true);
      },
    ],
  ]);

  return {
    opened,
    open: () => setOpened(true),
    close: () => setOpened(false),
  };
}
