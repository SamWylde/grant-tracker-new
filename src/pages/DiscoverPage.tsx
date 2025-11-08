import "@mantine/core/styles.css";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Container,
  Divider,
  Group,
  Loader,
  NumberInput,
  Pagination,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconBookmark,
  IconBookmarkFilled,
  IconCalendar,
  IconFilter,
  IconRocket,
  IconSearch,
} from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FEDERAL_AGENCIES,
  FUNDING_CATEGORIES,
  type NormalizedGrant,
  type SearchResponse,
} from "../types/grants";

const ITEMS_PER_PAGE = 25;
// Mock org/user for v1 (replace with real auth later)
const MOCK_ORG_ID = "00000000-0000-0000-0000-000000000001";
const MOCK_USER_ID = "00000000-0000-0000-0000-000000000002";

export function DiscoverPage() {
  const queryClient = useQueryClient();

  // Filter state
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [agency, setAgency] = useState<string | null>(null);
  const [statusPosted, setStatusPosted] = useState(true);
  const [statusForecasted, setStatusForecasted] = useState(true);
  const [dueInDays, setDueInDays] = useState<number | string>("");
  const [currentPage, setCurrentPage] = useState(1);

  const [debouncedKeyword] = useDebouncedValue(keyword, 500);

  // Calculate status string
  const oppStatuses =
    statusPosted && statusForecasted
      ? "posted|forecasted"
      : statusPosted
        ? "posted"
        : statusForecasted
          ? "forecasted"
          : "";

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedKeyword, category, agency, oppStatuses, dueInDays]);

  // Fetch grants
  const { data, isLoading, error, refetch } = useQuery<SearchResponse>({
    queryKey: [
      "grants",
      debouncedKeyword,
      category,
      agency,
      oppStatuses,
      currentPage,
    ],
    queryFn: async () => {
      const response = await fetch("/api/grants/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: debouncedKeyword || undefined,
          fundingCategories: category || undefined,
          agencies: agency || undefined,
          oppStatuses: oppStatuses || "posted|forecasted",
          rows: ITEMS_PER_PAGE,
          startRecordNum: (currentPage - 1) * ITEMS_PER_PAGE,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch grants");
      }

      return response.json();
    },
    enabled: oppStatuses !== "", // Only run if at least one status is selected
  });

  // Fetch saved grants
  const { data: savedGrants } = useQuery<{ grants: Array<{ external_id: string }> }>({
    queryKey: ["savedGrants", MOCK_ORG_ID],
    queryFn: async () => {
      const response = await fetch(`/api/saved?org_id=${MOCK_ORG_ID}`);
      if (!response.ok) throw new Error("Failed to fetch saved grants");
      return response.json();
    },
  });

  const savedGrantIds = new Set(
    savedGrants?.grants.map((g) => g.external_id) || []
  );

  // Filter by due date client-side
  const filteredGrants =
    data?.grants.filter((grant) => {
      if (!dueInDays || dueInDays === "") return true;
      if (!grant.closeDate) return false;

      const daysDiff = dayjs(grant.closeDate).diff(dayjs(), "day");
      return daysDiff >= 0 && daysDiff <= Number(dueInDays);
    }) || [];

  // Sort by soonest close date
  const sortedGrants = [...filteredGrants].sort((a, b) => {
    if (!a.closeDate && !b.closeDate) return 0;
    if (!a.closeDate) return 1;
    if (!b.closeDate) return -1;
    return dayjs(a.closeDate).valueOf() - dayjs(b.closeDate).valueOf();
  });

  const totalPages = data ? Math.ceil(data.totalCount / ITEMS_PER_PAGE) : 0;

  // Save/unsave grant
  const handleSaveToggle = async (grant: NormalizedGrant, isSaved: boolean) => {
    try {
      if (isSaved) {
        // Unsave
        const savedGrant = savedGrants?.grants.find(
          (g) => g.external_id === grant.id
        );
        if (!savedGrant) return;

        const response = await fetch(`/api/saved?id=${(savedGrant as any).id}`, {
          method: "DELETE",
        });

        if (!response.ok) throw new Error("Failed to remove grant");

        notifications.show({
          title: "Removed from pipeline",
          message: `${grant.title} has been removed from your pipeline`,
          color: "blue",
        });
      } else {
        // Save
        const response = await fetch("/api/saved", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            org_id: MOCK_ORG_ID,
            user_id: MOCK_USER_ID,
            external_id: grant.id,
            title: grant.title,
            agency: grant.agency,
            aln: grant.aln,
            open_date: grant.openDate,
            close_date: grant.closeDate,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          if (response.status === 409) {
            notifications.show({
              title: "Already saved",
              message: "This grant is already in your pipeline",
              color: "yellow",
            });
            return;
          }
          throw new Error(errorData.error || "Failed to save grant");
        }

        notifications.show({
          title: "Saved to pipeline",
          message: `${grant.title} has been added to your pipeline`,
          color: "green",
        });
      }

      // Refetch saved grants
      queryClient.invalidateQueries({ queryKey: ["savedGrants"] });
    } catch (err) {
      notifications.show({
        title: "Error",
        message: err instanceof Error ? err.message : "An error occurred",
        color: "red",
      });
    }
  };

  return (
    <Box bg="var(--mantine-color-gray-0)" mih="100vh">
      {/* Header */}
      <Box
        component="header"
        px="md"
        py="lg"
        bg="white"
        style={{
          borderBottom: "1px solid var(--mantine-color-gray-2)",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <Container size="xl">
          <Group justify="space-between">
            <Group gap={6}>
              <ThemeIcon variant="light" color="grape" size={38} radius="xl">
                <IconRocket size={20} />
              </ThemeIcon>
              <Stack gap={0}>
                <Text fw={700} component={Link} to="/" style={{ textDecoration: "none", color: "inherit" }}>
                  GrantTracker
                </Text>
                <Text size="xs" c="dimmed">
                  Discover Federal Grants
                </Text>
              </Stack>
            </Group>
            <Button variant="light" color="grape">
              View Saved ({savedGrants?.grants.length || 0})
            </Button>
          </Group>
        </Container>
      </Box>

      <Container size="xl" py="xl">
        <Stack gap="lg">
          {/* Page header */}
          <Stack gap="sm">
            <Title order={1}>Discover Federal Grant Opportunities</Title>
            <Text c="dimmed" size="lg">
              Search and save grant opportunities from Grants.gov to your pipeline
            </Text>
          </Stack>

          <Divider />

          {/* Filters */}
          <Paper p="md" withBorder>
            <Stack gap="md">
              <Group gap="xs">
                <IconFilter size={20} />
                <Text fw={600}>Filters</Text>
              </Group>

              <Group align="flex-end" wrap="wrap">
                <TextInput
                  placeholder="Search keywords..."
                  leftSection={<IconSearch size={16} />}
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  style={{ flex: 1, minWidth: 250 }}
                />

                <Select
                  placeholder="Category"
                  data={FUNDING_CATEGORIES.map((c) => ({
                    value: c.value,
                    label: c.label,
                  }))}
                  value={category}
                  onChange={setCategory}
                  clearable
                  searchable
                  style={{ minWidth: 200 }}
                />

                <Select
                  placeholder="Agency"
                  data={FEDERAL_AGENCIES.map((a) => ({
                    value: a.value,
                    label: a.label,
                  }))}
                  value={agency}
                  onChange={setAgency}
                  clearable
                  searchable
                  style={{ minWidth: 200 }}
                />

                <NumberInput
                  placeholder="Due in ≤ X days"
                  leftSection={<IconCalendar size={16} />}
                  value={dueInDays}
                  onChange={setDueInDays}
                  min={0}
                  style={{ minWidth: 180 }}
                />
              </Group>

              <Group gap="md">
                <Text size="sm" fw={500}>
                  Status:
                </Text>
                <Checkbox
                  label="Posted"
                  checked={statusPosted}
                  onChange={(e) => setStatusPosted(e.currentTarget.checked)}
                />
                <Checkbox
                  label="Forecasted"
                  checked={statusForecasted}
                  onChange={(e) => setStatusForecasted(e.currentTarget.checked)}
                />
              </Group>
            </Stack>
          </Paper>

          {/* Results header */}
          {data && (
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Showing {sortedGrants.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0}–
                {Math.min(currentPage * ITEMS_PER_PAGE, data.totalCount)} of{" "}
                {data.totalCount.toLocaleString()} results
              </Text>
              <Button
                variant="subtle"
                size="xs"
                onClick={() => refetch()}
                disabled={isLoading}
              >
                Refresh
              </Button>
            </Group>
          )}

          {/* Loading state */}
          {isLoading && (
            <Card padding="xl" withBorder>
              <Group justify="center">
                <Loader size="lg" />
                <Text>Loading opportunities...</Text>
              </Group>
            </Card>
          )}

          {/* Error state */}
          {error && (
            <Card padding="xl" withBorder>
              <Stack align="center" gap="md">
                <Text c="red" fw={600}>
                  Error loading grants
                </Text>
                <Text c="dimmed" ta="center">
                  {error instanceof Error ? error.message : "An error occurred"}
                </Text>
                <Button onClick={() => refetch()}>Try again</Button>
              </Stack>
            </Card>
          )}

          {/* Empty state */}
          {!isLoading && !error && sortedGrants.length === 0 && (
            <Card padding="xl" withBorder>
              <Stack align="center" gap="md">
                <Text fw={600}>No grants found</Text>
                <Text c="dimmed" ta="center">
                  Try adjusting your filters or search terms
                </Text>
              </Stack>
            </Card>
          )}

          {/* Results list */}
          {!isLoading && !error && sortedGrants.length > 0 && (
            <Stack gap="sm">
              {sortedGrants.map((grant) => {
                const isSaved = savedGrantIds.has(grant.id);
                const isClosingSoon =
                  grant.closeDate &&
                  dayjs(grant.closeDate).diff(dayjs(), "day") <= 30;

                return (
                  <Card key={grant.id} padding="md" withBorder>
                    <Stack gap="sm">
                      <Group justify="space-between" align="flex-start">
                        <Stack gap={4} style={{ flex: 1 }}>
                          <Text fw={600} size="lg">
                            {grant.title}
                          </Text>
                          <Group gap="xs">
                            <Text size="sm" c="dimmed">
                              {grant.agency}
                            </Text>
                            {grant.aln && (
                              <>
                                <Text size="sm" c="dimmed">
                                  •
                                </Text>
                                <Badge variant="light" size="sm">
                                  ALN: {grant.aln}
                                </Badge>
                              </>
                            )}
                          </Group>
                        </Stack>
                        <ActionIcon
                          variant={isSaved ? "filled" : "light"}
                          color="grape"
                          size="lg"
                          onClick={() => handleSaveToggle(grant, isSaved)}
                        >
                          {isSaved ? (
                            <IconBookmarkFilled size={20} />
                          ) : (
                            <IconBookmark size={20} />
                          )}
                        </ActionIcon>
                      </Group>

                      <Group gap="md">
                        <Badge
                          variant="light"
                          color={grant.status === "posted" ? "green" : "blue"}
                        >
                          {grant.status}
                        </Badge>
                        {grant.openDate && (
                          <Text size="sm" c="dimmed">
                            Opened: {dayjs(grant.openDate).format("MMM D, YYYY")}
                          </Text>
                        )}
                        {grant.closeDate ? (
                          <Text
                            size="sm"
                            fw={isClosingSoon ? 600 : 400}
                            c={isClosingSoon ? "orange" : "dimmed"}
                          >
                            Due: {dayjs(grant.closeDate).format("MMM D, YYYY")}
                          </Text>
                        ) : (
                          <Text size="sm" c="dimmed">
                            Due: TBD
                          </Text>
                        )}
                      </Group>
                    </Stack>
                  </Card>
                );
              })}
            </Stack>
          )}

          {/* Pagination */}
          {!isLoading && !error && totalPages > 1 && (
            <Group justify="center" py="md">
              <Pagination
                total={totalPages}
                value={currentPage}
                onChange={setCurrentPage}
                color="grape"
              />
            </Group>
          )}
        </Stack>
      </Container>
    </Box>
  );
}
