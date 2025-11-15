import { Badge, Group, Kbd, Modal, Stack, Text, TextInput, UnstyledButton, Loader, Alert } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { IconClock, IconSearch, IconAlertCircle } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { ErrorBoundary } from "./ErrorBoundary";
import { supabase } from "../lib/supabase";

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
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Load recent searches
  useEffect(() => {
    if (opened) {
      loadRecentSearches();
    }
  }, [opened, orgId, userId]);

  const loadRecentSearches = async () => {
    setLoading(true);
    setError(null);
    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `/api/recent-searches?org_id=${orgId}&user_id=${userId}&limit=10`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );
      if (!response.ok) {
        throw new Error('Failed to load recent searches');
      }
      const data = await response.json();
      setRecentSearches(data.searches || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      console.error("Error loading recent searches:", err);
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
      <ErrorBoundary boundaryName="QuickSearchModal">
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

        {/* Loading state */}
        {loading && (
          <Group justify="center" py="xl">
            <Loader size="sm" />
            <Text size="sm" c="dimmed">Loading recent searches...</Text>
          </Group>
        )}

        {/* Error state */}
        {error && !loading && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
            <Text size="sm">{error}</Text>
          </Alert>
        )}

        {/* Recent Searches */}
        {!searchQuery && !loading && !error && recentSearches.length > 0 && (
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
        {searchQuery && !loading && !error && filteredSearches.length > 0 && (
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
        {recentSearches.length === 0 && !loading && !error && (
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
      </ErrorBoundary>
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
