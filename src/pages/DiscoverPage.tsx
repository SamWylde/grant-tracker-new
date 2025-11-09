import "@mantine/core/styles.css";
import {
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Container,
  Divider,
  Group,
  Loader,
  Modal,
  NumberInput,
  Pagination,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconBookmark,
  IconBookmarkFilled,
  IconCalendar,
  IconExternalLink,
  IconFileText,
  IconFilter,
  IconSearch,
  IconArrowsSort,
  IconPlus,
} from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FEDERAL_AGENCIES,
  FUNDING_CATEGORIES,
  type GrantDetail,
  type NormalizedGrant,
  type SearchResponse,
} from "../types/grants";
import { AppHeader } from "../components/AppHeader";
import { QuickSearchModal, useQuickSearchModal } from "../components/QuickSearchModal";
import { SavedViewsPanel } from "../components/SavedViewsPanel";
import { FitScoreBadge } from "../components/FitScoreBadge";
import { QuickAddGrantModal } from "../components/QuickAddGrantModal";
import { useOrganization } from "../contexts/OrganizationContext";
import { useAuth } from "../contexts/AuthContext";

// Enable relative time plugin for dayjs
dayjs.extend(relativeTime);

const ITEMS_PER_PAGE = 25;

export function DiscoverPage() {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrganization();
  const { user } = useAuth();

  // Utility function to strip HTML tags and decode entities
  const stripHtml = (html: string): string => {
    if (!html) return '';

    // Create a temporary div to use browser's HTML parsing
    const tmp = document.createElement('div');
    tmp.innerHTML = html;

    // Get text content (this automatically decodes entities and strips tags)
    let text = tmp.textContent || tmp.innerText || '';

    // Clean up extra whitespace
    text = text.replace(/\s+/g, ' ').trim();

    return text;
  };

  // Filter state
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [agency, setAgency] = useState<string | null>(null);
  const [statusPosted, setStatusPosted] = useState(true);
  const [statusForecasted, setStatusForecasted] = useState(true);
  const [dueInDays, setDueInDays] = useState<number | string>("");
  const [sortBy, setSortBy] = useState<string>("due_soon"); // relevance, due_soon, newest
  const [currentPage, setCurrentPage] = useState(1);

  // Details modal state
  const [selectedGrantId, setSelectedGrantId] = useState<string | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  // Quick search modal
  const quickSearch = useQuickSearchModal();

  // Quick add modal state
  const [quickAddModalOpen, setQuickAddModalOpen] = useState(false);

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
    queryKey: ["savedGrants", currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return { grants: [] };
      const response = await fetch(`/api/saved?org_id=${currentOrg.id}`);
      if (!response.ok) throw new Error("Failed to fetch saved grants");
      return response.json();
    },
  });

  const savedGrantIds = new Set(
    savedGrants?.grants.map((g) => g.external_id) || []
  );

  // Fetch grant details
  const {
    data: grantDetails,
    isLoading: detailsLoading,
    error: detailsError,
  } = useQuery<GrantDetail>({
    queryKey: ["grantDetails", selectedGrantId],
    queryFn: async () => {
      if (!selectedGrantId) throw new Error("No grant ID selected");

      const response = await fetch('/api/grants/details', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: selectedGrantId }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch grant details");
      }
      return response.json();
    },
    enabled: !!selectedGrantId && detailsModalOpen,
  });

  // Handler to open details modal
  const handleViewDetails = (grantId: string) => {
    setSelectedGrantId(grantId);
    setDetailsModalOpen(true);
  };

  // Track search in recent searches
  const trackSearch = async () => {
    // Only track if there are any filters applied
    if (!debouncedKeyword && !category && !agency && !dueInDays) {
      return;
    }

    try {
      if (!currentOrg?.id || !user?.id) return; // Skip if not authenticated

      await fetch("/api/recent-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: currentOrg.id,
          user_id: user.id,
          keyword: debouncedKeyword || null,
          category: category || null,
          agency: agency || null,
          status_posted: statusPosted,
          status_forecasted: statusForecasted,
          due_in_days: dueInDays ? Number(dueInDays) : null,
          sort_by: sortBy,
        }),
      });
    } catch (error) {
      console.error("Error tracking search:", error);
    }
  };

  // Track searches when filters change
  useEffect(() => {
    if (data && data.grants.length > 0) {
      trackSearch();
    }
  }, [debouncedKeyword, category, agency, dueInDays, sortBy]);

  // Load a search from quick search modal
  const handleLoadSearch = (search: any) => {
    setKeyword(search.keyword || "");
    setCategory(search.category || null);
    setAgency(search.agency || null);
    setStatusPosted(search.status_posted);
    setStatusForecasted(search.status_forecasted);
    setDueInDays(search.due_in_days || "");
    setSortBy(search.sort_by || "due_soon");
  };

  // Filter by due date client-side
  const filteredGrants =
    data?.grants.filter((grant) => {
      if (!dueInDays || dueInDays === "") return true;
      if (!grant.closeDate) return false;

      const daysDiff = dayjs(grant.closeDate).diff(dayjs(), "day");
      return daysDiff >= 0 && daysDiff <= Number(dueInDays);
    }) || [];

  // Calculate relevance score for each grant
  const calculateRelevanceScore = (grant: NormalizedGrant): number => {
    if (!debouncedKeyword) return 0;

    const searchTerms = debouncedKeyword.toLowerCase().split(" ");
    let score = 0;

    const title = grant.title.toLowerCase();
    const agency = grant.agency.toLowerCase();

    searchTerms.forEach((term) => {
      // Title matches are worth more
      if (title.includes(term)) score += 3;
      if (agency.includes(term)) score += 1;
    });

    return score;
  };

  // Sort grants based on selected option
  const sortedGrants = [...filteredGrants].sort((a, b) => {
    switch (sortBy) {
      case "relevance": {
        const scoreA = calculateRelevanceScore(a);
        const scoreB = calculateRelevanceScore(b);
        if (scoreA !== scoreB) return scoreB - scoreA; // Higher score first
        // Fallback to due date if scores are equal
        if (!a.closeDate && !b.closeDate) return 0;
        if (!a.closeDate) return 1;
        if (!b.closeDate) return -1;
        return dayjs(a.closeDate).valueOf() - dayjs(b.closeDate).valueOf();
      }
      case "newest": {
        // Sort by open date (newest first)
        if (!a.openDate && !b.openDate) return 0;
        if (!a.openDate) return 1;
        if (!b.openDate) return -1;
        return dayjs(b.openDate).valueOf() - dayjs(a.openDate).valueOf();
      }
      case "due_soon":
      default: {
        // Sort by close date (soonest first)
        if (!a.closeDate && !b.closeDate) return 0;
        if (!a.closeDate) return 1;
        if (!b.closeDate) return -1;
        return dayjs(a.closeDate).valueOf() - dayjs(b.closeDate).valueOf();
      }
    }
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
        if (!currentOrg?.id || !user?.id) {
          notifications.show({
            title: "Authentication required",
            message: "Please sign in to save grants",
            color: "red",
          });
          return;
        }

        const response = await fetch("/api/saved", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            org_id: currentOrg.id,
            user_id: user.id,
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
      <AppHeader subtitle="Discover Federal Grants" />

      <Container size="xl" py="xl">
        <Stack gap="lg">
          {/* Page header */}
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
                onClick={() => setQuickAddModalOpen(true)}
              >
                Quick Add from URL
              </Button>
              <Button
                variant="light"
                color="grape"
                component={Link}
                to="/saved"
              >
                View Saved ({savedGrants?.grants.length || 0})
              </Button>
            </Group>
          </Group>

          <Divider />

          {/* Saved Views */}
          <SavedViewsPanel
            orgId={currentOrg?.id || ""}
            userId={user?.id || ""}
            currentFilters={{
              keyword,
              category,
              agency,
              status_posted: statusPosted,
              status_forecasted: statusForecasted,
              due_in_days: dueInDays,
              sort_by: sortBy,
            }}
            onLoadView={handleLoadSearch}
          />

          {/* Filters */}
          <Paper p="md" withBorder>
            <Stack gap="md">
              <Group gap="xs">
                <IconFilter size={20} />
                <Text fw={600}>Filters & Sort</Text>
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

                <Select
                  placeholder="Sort by"
                  leftSection={<IconArrowsSort size={16} />}
                  data={[
                    { value: "due_soon", label: "Due Soon" },
                    { value: "newest", label: "Newest" },
                    { value: "relevance", label: "Relevance" },
                  ]}
                  value={sortBy}
                  onChange={(value) => setSortBy(value || "due_soon")}
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
            <Stack gap="md">
              {sortedGrants.map((grant) => {
                const isSaved = savedGrantIds.has(grant.id);
                const daysUntilClose = grant.closeDate
                  ? dayjs(grant.closeDate).diff(dayjs(), "day")
                  : null;
                const isClosingSoon = daysUntilClose !== null && daysUntilClose <= 30;
                const isOverdue = daysUntilClose !== null && daysUntilClose < 0;

                return (
                  <Card
                    key={grant.id}
                    padding="lg"
                    withBorder
                    style={{
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      border: isSaved ? "2px solid var(--mantine-color-grape-4)" : undefined,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
                      e.currentTarget.style.transform = "translateY(-2px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = "";
                      e.currentTarget.style.transform = "";
                    }}
                  >
                    <Stack gap="md">
                      {/* Header */}
                      <Group justify="space-between" align="flex-start" wrap="nowrap">
                        <Stack gap={8} style={{ flex: 1 }}>
                          <Group gap="xs" wrap="wrap">
                            <Badge
                              variant="light"
                              color={grant.status === "posted" ? "green" : "blue"}
                              size="sm"
                            >
                              {grant.status}
                            </Badge>
                            {grant.aln && (
                              <Badge variant="outline" size="sm" color="gray">
                                {grant.aln}
                              </Badge>
                            )}
                            {isSaved && (
                              <Badge variant="filled" size="sm" color="grape">
                                Saved
                              </Badge>
                            )}
                            <FitScoreBadge
                              grantCategory={category || undefined}
                            />
                          </Group>

                          <Anchor
                            href={`https://www.grants.gov/search-results-detail/${grant.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            fw={600}
                            size="lg"
                            c="dark"
                            style={{ textDecoration: "none" }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Group gap="xs" wrap="nowrap">
                              <Text lineClamp={2}>{grant.title}</Text>
                              <IconExternalLink size={16} style={{ flexShrink: 0 }} />
                            </Group>
                          </Anchor>

                          <Text size="sm" c="dimmed" fw={500}>
                            {grant.agency}
                          </Text>
                        </Stack>

                        <Group gap="xs" style={{ flexShrink: 0 }}>
                          <Button
                            variant="light"
                            color="blue"
                            size="sm"
                            leftSection={<IconFileText size={16} />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewDetails(grant.id);
                            }}
                          >
                            Details
                          </Button>
                          <Button
                            variant={isSaved ? "filled" : "outline"}
                            color="grape"
                            size="sm"
                            leftSection={
                              isSaved ? (
                                <IconBookmarkFilled size={16} />
                              ) : (
                                <IconBookmark size={16} />
                              )
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSaveToggle(grant, isSaved);
                            }}
                          >
                            {isSaved ? "Saved" : "Save"}
                          </Button>
                        </Group>
                      </Group>

                      <Divider />

                      {/* Dates */}
                      <Group gap="xl">
                        {grant.openDate && (
                          <Stack gap={4}>
                            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                              Posted
                            </Text>
                            <Text size="sm" fw={500}>
                              {dayjs(grant.openDate).format("MMM D, YYYY")}
                            </Text>
                          </Stack>
                        )}
                        <Stack gap={4}>
                          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                            {isOverdue ? "Closed" : "Closes"}
                          </Text>
                          {grant.closeDate ? (
                            <Group gap="xs">
                              <Text
                                size="sm"
                                fw={600}
                                c={
                                  isOverdue
                                    ? "red"
                                    : isClosingSoon
                                      ? "orange"
                                      : "dark"
                                }
                              >
                                {dayjs(grant.closeDate).format("MMM D, YYYY")}
                              </Text>
                              {daysUntilClose !== null && !isOverdue && (
                                <Badge
                                  size="sm"
                                  color={isClosingSoon ? "orange" : "gray"}
                                  variant="light"
                                >
                                  {daysUntilClose === 0
                                    ? "Today"
                                    : daysUntilClose === 1
                                      ? "Tomorrow"
                                      : `${daysUntilClose} days`}
                                </Badge>
                              )}
                              {isOverdue && (
                                <Badge size="sm" color="red" variant="light">
                                  Overdue
                                </Badge>
                              )}
                            </Group>
                          ) : (
                            <Text size="sm" c="dimmed">
                              TBD
                            </Text>
                          )}
                        </Stack>
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

      {/* Grant Details Modal */}
      <Modal
        opened={detailsModalOpen}
        onClose={() => {
          setDetailsModalOpen(false);
          setSelectedGrantId(null);
        }}
        title={grantDetails?.title || "Grant Details"}
        size="xl"
      >
        {detailsLoading ? (
          <Group justify="center" py="xl">
            <Loader size="lg" />
            <Text>Loading grant details...</Text>
          </Group>
        ) : detailsError ? (
          <Stack align="center" gap="md" py="xl">
            <Text c="red" fw={600}>
              Error loading grant details
            </Text>
            <Text c="dimmed" ta="center" size="sm">
              {detailsError instanceof Error ? detailsError.message : "An error occurred"}
            </Text>
            <Button
              variant="light"
              component="a"
              href={`https://www.grants.gov/search-results-detail/${selectedGrantId}`}
              target="_blank"
              rel="noopener noreferrer"
              rightSection={<IconExternalLink size={16} />}
            >
              View on Grants.gov
            </Button>
          </Stack>
        ) : grantDetails ? (
          <ScrollArea h={600}>
            <Stack gap="lg">
              {/* Header */}
              <Stack gap="xs">
                <Title order={3}>{grantDetails.title}</Title>
                <Group gap="xs">
                  <Badge color="grape" variant="light">
                    {grantDetails.number}
                  </Badge>
                  <Text size="sm" c="dimmed">
                    {grantDetails.agency}
                  </Text>
                </Group>
              </Stack>

              <Divider />

              {/* Description */}
              {grantDetails.description && (
                <Stack gap="xs">
                  <Text fw={600} size="sm">
                    Description
                  </Text>
                  <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                    {stripHtml(grantDetails.description)}
                  </Text>
                </Stack>
              )}

              {/* Key Dates */}
              <Stack gap="xs">
                <Text fw={600} size="sm">
                  Key Dates
                </Text>
                <Group gap="lg">
                  {grantDetails.postDate && (
                    <div>
                      <Text size="xs" c="dimmed">
                        Posted
                      </Text>
                      <Text size="sm">
                        {dayjs(grantDetails.postDate).format("MMM D, YYYY")}
                      </Text>
                    </div>
                  )}
                  {grantDetails.closeDate && (
                    <div>
                      <Text size="xs" c="dimmed">
                        Closes
                      </Text>
                      <Text size="sm" fw={600} c="orange">
                        {dayjs(grantDetails.closeDate).format("MMM D, YYYY")}
                      </Text>
                    </div>
                  )}
                </Group>
              </Stack>

              {/* Funding Information */}
              {(grantDetails.estimatedFunding ||
                grantDetails.awardCeiling ||
                grantDetails.awardFloor ||
                grantDetails.expectedAwards) && (
                <Stack gap="xs">
                  <Text fw={600} size="sm">
                    Funding Information
                  </Text>
                  <Group gap="lg">
                    {grantDetails.estimatedFunding && (
                      <div>
                        <Text size="xs" c="dimmed">
                          Total Program Funding
                        </Text>
                        <Text size="sm">{grantDetails.estimatedFunding}</Text>
                      </div>
                    )}
                    {grantDetails.expectedAwards && (
                      <div>
                        <Text size="xs" c="dimmed">
                          Expected Awards
                        </Text>
                        <Text size="sm">{grantDetails.expectedAwards}</Text>
                      </div>
                    )}
                    {grantDetails.awardFloor && (
                      <div>
                        <Text size="xs" c="dimmed">
                          Award Floor
                        </Text>
                        <Text size="sm">{grantDetails.awardFloor}</Text>
                      </div>
                    )}
                    {grantDetails.awardCeiling && (
                      <div>
                        <Text size="xs" c="dimmed">
                          Award Ceiling
                        </Text>
                        <Text size="sm">{grantDetails.awardCeiling}</Text>
                      </div>
                    )}
                  </Group>
                </Stack>
              )}

              {/* Eligibility */}
              {grantDetails.eligibility && (
                <Stack gap="xs">
                  <Text fw={600} size="sm">
                    Eligible Applicants
                  </Text>
                  <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                    {stripHtml(grantDetails.eligibility)}
                  </Text>
                </Stack>
              )}

              {/* Additional Details */}
              <Stack gap="xs">
                {grantDetails.category && (
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Category
                    </Text>
                    <Text size="sm">{grantDetails.category}</Text>
                  </Group>
                )}
                {grantDetails.fundingInstrument && (
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Funding Instrument
                    </Text>
                    <Text size="sm">{grantDetails.fundingInstrument}</Text>
                  </Group>
                )}
                {grantDetails.costSharing && (
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Cost Sharing Required
                    </Text>
                    <Text size="sm">{grantDetails.costSharing}</Text>
                  </Group>
                )}
              </Stack>

              {/* External Link */}
              <Divider />
              <Group justify="flex-end">
                <Button
                  component="a"
                  href={grantDetails.grantsGovUrl || `https://www.grants.gov/search-results-detail/${grantDetails.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  rightSection={<IconExternalLink size={16} />}
                  variant="light"
                >
                  View on Grants.gov
                </Button>
              </Group>
            </Stack>
          </ScrollArea>
        ) : (
          <Text c="dimmed" ta="center" py="xl">
            No details available
          </Text>
        )}
      </Modal>

      {/* Quick Search Modal */}
      <QuickSearchModal
        opened={quickSearch.opened}
        onClose={quickSearch.close}
        orgId={currentOrg?.id || ""}
        userId={user?.id || ""}
        onSearchSelect={handleLoadSearch}
      />

      {/* Quick Add Grant Modal */}
      <QuickAddGrantModal
        opened={quickAddModalOpen}
        onClose={() => setQuickAddModalOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['savedGrants'] });
        }}
      />
    </Box>
  );
}
