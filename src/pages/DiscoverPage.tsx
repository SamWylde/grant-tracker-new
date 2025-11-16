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
import { Link, useSearchParams } from "react-router-dom";
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
import { SaveToPipelineModal, type SaveToPipelineData } from "../components/SaveToPipelineModal";
import { RecommendationsSection } from "../components/RecommendationsSection";
import { SuccessScoreBadge } from "../components/SuccessScoreBadge";
import { GrantTagBadges } from "../components/GrantTagBadges";
import { EligibilityProfileBanner } from "../components/EligibilityProfileBanner";
import { GrantCardSkeleton } from "../components/GrantCardSkeleton";
import { useOrganization } from "../contexts/OrganizationContext";
import { useAuth } from "../contexts/AuthContext";
import { useSavedGrantIds } from "../hooks/useSavedGrants";
import { supabase } from "../lib/supabase";
import { stripHtml } from "../utils/htmlUtils";

// Enable relative time plugin for dayjs
dayjs.extend(relativeTime);

const ITEMS_PER_PAGE = 15;

export function DiscoverPage() {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get initial page from URL or default to 1
  const pageFromUrl = parseInt(searchParams.get('page') || '1', 10);

  // Filter state
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [agency, setAgency] = useState<string | null>(null);
  const [statusPosted, setStatusPosted] = useState(true);
  const [statusForecasted, setStatusForecasted] = useState(true);
  const [dueInDays, setDueInDays] = useState<number | string>("");
  const [sortBy, setSortBy] = useState<string>("due_soon"); // relevance, due_soon, newest
  const [currentPage, setCurrentPage] = useState(pageFromUrl);

  // Details modal state
  const [selectedGrantId, setSelectedGrantId] = useState<string | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  // Save to pipeline modal state
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [grantToSave, setGrantToSave] = useState<NormalizedGrant | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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
    // Update URL to page 1
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', '1');
    setSearchParams(newParams, { replace: true });
  }, [debouncedKeyword, category, agency, oppStatuses, dueInDays]);

  // Update URL when page changes and scroll to top
  useEffect(() => {
    const newParams = new URLSearchParams(searchParams);
    if (currentPage === 1) {
      newParams.delete('page');
    } else {
      newParams.set('page', currentPage.toString());
    }
    setSearchParams(newParams, { replace: true });

    // Scroll to top when page changes
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  // Fetch grants
  const { data, isLoading, error, refetch } = useQuery<SearchResponse>({
    queryKey: [
      "grants",
      debouncedKeyword,
      category,
      agency,
      oppStatuses,
      dueInDays,
      sortBy,
      currentPage,
    ],
    queryFn: async ({ signal }) => {
      const response = await fetch("/api/grants/search-catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: debouncedKeyword || undefined,
          fundingCategories: category || undefined,
          agencies: agency || undefined,
          oppStatuses: oppStatuses || "posted|forecasted",
          dueInDays: dueInDays ? Number(dueInDays) : undefined,
          sortBy: sortBy || undefined,
          rows: ITEMS_PER_PAGE,
          startRecordNum: (currentPage - 1) * ITEMS_PER_PAGE,
        }),
        signal, // Add AbortSignal for request cancellation
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch grants");
      }

      return response.json();
    },
    enabled: oppStatuses !== "", // Only run if at least one status is selected
  });

  // Fetch saved grants using shared hook
  const {
    savedGrantIds,
    savedGrants,
    error: savedGrantsError,
  } = useSavedGrantIds();

  // Show error notification for saved grants failures (non-blocking)
  useEffect(() => {
    if (savedGrantsError) {
      notifications.show({
        title: 'Warning',
        message: 'Failed to load saved grants status. You can still browse and save grants.',
        color: 'orange',
        autoClose: 5000,
      });
    }
  }, [savedGrantsError]);

  // Fetch grant details
  const {
    data: grantDetails,
    isLoading: detailsLoading,
    error: detailsError,
  } = useQuery<GrantDetail>({
    queryKey: ["grantDetails", selectedGrantId],
    queryFn: async ({ signal }) => {
      if (!selectedGrantId) throw new Error("No grant ID selected");

      const response = await fetch('/api/grants/details', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: selectedGrantId }),
        signal, // Add AbortSignal for request cancellation
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

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('Not authenticated - cannot track search');
        return;
      }

      await fetch("/api/recent-searches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${session.access_token}`,
        },
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

  // Server-side filtering and sorting is now handled by the API
  // No need for client-side filtering or sorting anymore
  const sortedGrants = data?.grants || [];

  const totalPages = data ? Math.ceil(data.totalCount / ITEMS_PER_PAGE) : 0;

  // Pre-fetch next and previous pages for better UX
  useEffect(() => {
    if (!data || totalPages === 0) return;

    const prefetchPage = (page: number) => {
      if (page < 1 || page > totalPages || page === currentPage) return;

      queryClient.prefetchQuery({
        queryKey: [
          "grants",
          debouncedKeyword,
          category,
          agency,
          oppStatuses,
          dueInDays,
          sortBy,
          page,
        ],
        queryFn: async () => {
          const response = await fetch("/api/grants/search-catalog", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              keyword: debouncedKeyword || undefined,
              fundingCategories: category || undefined,
              agencies: agency || undefined,
              oppStatuses: oppStatuses || "posted|forecasted",
              dueInDays: dueInDays ? Number(dueInDays) : undefined,
              sortBy: sortBy || undefined,
              rows: ITEMS_PER_PAGE,
              startRecordNum: (page - 1) * ITEMS_PER_PAGE,
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to fetch grants");
          }

          return response.json();
        },
      });
    };

    // Prefetch next page
    if (currentPage < totalPages) {
      prefetchPage(currentPage + 1);
    }

    // Prefetch previous page
    if (currentPage > 1) {
      prefetchPage(currentPage - 1);
    }
  }, [currentPage, totalPages, debouncedKeyword, category, agency, oppStatuses, dueInDays, sortBy, queryClient]);

  // Save/unsave grant
  const handleSaveToggle = async (grant: NormalizedGrant, isSaved: boolean) => {
    try {
      if (isSaved) {
        // Unsave
        const savedGrant = savedGrants?.grants.find(
          (g) => g.external_id === grant.id
        );
        if (!savedGrant) return;

        // Get auth token
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('Not authenticated');
        }

        const response = await fetch(`/api/saved?id=${(savedGrant as any).id}`, {
          method: "DELETE",
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) throw new Error("Failed to remove grant");

        notifications.show({
          title: "Removed from pipeline",
          message: `${grant.title} has been removed from your pipeline`,
          color: "blue",
        });

        // Refetch saved grants
        queryClient.invalidateQueries({ queryKey: ["savedGrants"] });
      } else {
        // Open save modal instead of directly saving
        if (!currentOrg?.id || !user?.id) {
          notifications.show({
            title: "Authentication required",
            message: "Please sign in to save grants",
            color: "red",
          });
          return;
        }

        setGrantToSave(grant);
        setSaveModalOpen(true);
      }
    } catch (err) {
      notifications.show({
        title: "Error",
        message: err instanceof Error ? err.message : "An error occurred",
        color: "red",
      });
    }
  };

  // Handle save with pipeline data
  const handleSaveWithPipelineData = async (pipelineData: SaveToPipelineData) => {
    if (!grantToSave || !currentOrg?.id || !user?.id) return;

    setIsSaving(true);
    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Fetch full grant details to get description
      let description: string | null = null;
      try {
        const detailsResponse = await fetch('/api/grants/details', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id: grantToSave.id }),
        });
        if (detailsResponse.ok) {
          const grantDetails = await detailsResponse.json();
          description = grantDetails.description || null;
        }
      } catch (error) {
        // If fetching description fails, continue without it
        console.warn('Failed to fetch grant description:', error);
      }

      const response = await fetch("/api/saved", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          org_id: currentOrg.id,
          user_id: user.id,
          external_id: grantToSave.id,
          title: grantToSave.title,
          agency: grantToSave.agency,
          aln: grantToSave.aln,
          open_date: grantToSave.openDate,
          close_date: grantToSave.closeDate,
          description: description,
          status: pipelineData.status,
          priority: pipelineData.priority,
          assigned_to: pipelineData.assigned_to,
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
        message: `${grantToSave.title} has been added to your pipeline`,
        color: "green",
      });

      // Refetch saved grants
      queryClient.invalidateQueries({ queryKey: ["savedGrants"] });
    } catch (err) {
      notifications.show({
        title: "Error",
        message: err instanceof Error ? err.message : "An error occurred",
        color: "red",
      });
      throw err; // Re-throw to prevent modal from closing
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box bg="var(--mantine-color-gray-0)" mih="100vh">
      {/* Header */}
      <AppHeader subtitle="Discover Federal Grants" />

      <Container size="xl" py="xl" component="main" id="main-content">
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
                leftSection={<IconPlus size={16} aria-hidden="true" />}
                onClick={() => setQuickAddModalOpen(true)}
                aria-label="Quick add grant from URL"
              >
                Quick Add from URL
              </Button>
              <Button
                variant="light"
                color="grape"
                component={Link}
                to="/pipeline"
                aria-label={`View ${savedGrants?.grants.length || 0} saved grants in pipeline`}
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

          {/* Eligibility Profile Banner */}
          <EligibilityProfileBanner />

          {/* AI Recommendations */}
          <RecommendationsSection
            onSaveGrant={(externalId) => {
              // Find the grant in search results
              const grant = sortedGrants.find(g => g.id === externalId);
              if (grant) {
                handleSaveToggle(grant, false);
              }
            }}
          />

          {/* Filters */}
          <Paper p="md" withBorder role="search" aria-label="Grant search filters">
            <Stack gap="md">
              <Group gap="xs">
                <IconFilter size={20} aria-hidden="true" />
                <Text fw={600}>Filters & Sort</Text>
              </Group>

              <Group align="flex-end" wrap="wrap">
                <TextInput
                  placeholder="Search keywords..."
                  leftSection={<IconSearch size={16} aria-hidden="true" />}
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  style={{ flex: 1, minWidth: 250 }}
                  aria-label="Search grants by keywords"
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
                  aria-label="Filter by funding category"
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
                  aria-label="Filter by federal agency"
                />

                <NumberInput
                  placeholder="Due in ≤ X days"
                  leftSection={<IconCalendar size={16} aria-hidden="true" />}
                  value={dueInDays}
                  onChange={setDueInDays}
                  min={0}
                  style={{ minWidth: 180 }}
                  aria-label="Filter by days until deadline"
                />

                <Select
                  placeholder="Sort by"
                  leftSection={<IconArrowsSort size={16} aria-hidden="true" />}
                  data={[
                    { value: "due_soon", label: "Due Soon" },
                    { value: "newest", label: "Newest" },
                    { value: "relevance", label: "Relevance" },
                  ]}
                  value={sortBy}
                  onChange={(value) => setSortBy(value || "due_soon")}
                  style={{ minWidth: 180 }}
                  aria-label="Sort grants by"
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
              <Stack gap={4}>
                <Text size="sm" c="dimmed">
                  Showing {sortedGrants.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0}–
                  {Math.min(currentPage * ITEMS_PER_PAGE, data.totalCount ?? 0)} of{" "}
                  {(data.totalCount ?? 0).toLocaleString()} results
                </Text>
                {totalPages > 1 && (
                  <Text size="xs" c="dimmed" fw={500}>
                    Page {currentPage} of {totalPages}
                  </Text>
                )}
              </Stack>
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
          {isLoading && <GrantCardSkeleton count={5} />}

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
                    onClick={() => handleViewDetails(grant.id)}
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
                            <SuccessScoreBadge
                              grantId={grant.id}
                              orgId={currentOrg?.id}
                              compact
                            />
                          </Group>
                          <GrantTagBadges grantId={grant.id} maxTags={3} />

                          <Anchor
                            href={`https://www.grants.gov/search-results-detail/${grant.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            fw={600}
                            size="lg"
                            c="dark"
                            style={{ textDecoration: "none" }}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`View ${grant.title} on Grants.gov (opens in new tab)`}
                          >
                            <Group gap="xs" wrap="nowrap">
                              <Text lineClamp={2}>{grant.title}</Text>
                              <IconExternalLink size={16} style={{ flexShrink: 0 }} aria-hidden="true" />
                            </Group>
                          </Anchor>

                          <Text size="sm" c="dimmed" fw={500}>
                            {grant.agency}
                          </Text>

                          <Text size="sm" c="dimmed" lineClamp={2} mt={4}>
                            {grant.description ? stripHtml(grant.description) : "No description available"}
                          </Text>
                        </Stack>

                        <Group gap="xs" style={{ flexShrink: 0 }}>
                          <Button
                            variant="light"
                            color="blue"
                            size="sm"
                            leftSection={<IconFileText size={16} aria-hidden="true" />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewDetails(grant.id);
                            }}
                            aria-label={`View details for ${grant.title}`}
                          >
                            Details
                          </Button>
                          <Button
                            variant={isSaved ? "filled" : "outline"}
                            color="grape"
                            size="sm"
                            leftSection={
                              isSaved ? (
                                <IconBookmarkFilled size={16} aria-hidden="true" />
                              ) : (
                                <IconBookmark size={16} aria-hidden="true" />
                              )
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSaveToggle(grant, isSaved);
                            }}
                            aria-label={isSaved ? `Remove ${grant.title} from pipeline` : `Save ${grant.title} to pipeline`}
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
            <Stack gap="sm">
              <Group justify="center" py="md">
                <Pagination
                  total={totalPages}
                  value={currentPage}
                  onChange={setCurrentPage}
                  color="grape"
                  siblings={1}
                  boundaries={1}
                />
              </Group>
              <Text size="xs" c="dimmed" ta="center">
                Page {currentPage} of {totalPages} ({(data?.totalCount ?? 0).toLocaleString()} total results)
              </Text>
            </Stack>
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

      {/* Save to Pipeline Modal */}
      <SaveToPipelineModal
        opened={saveModalOpen}
        onClose={() => {
          setSaveModalOpen(false);
          setGrantToSave(null);
        }}
        onSave={handleSaveWithPipelineData}
        grantTitle={grantToSave?.title || ""}
        saving={isSaving}
      />
    </Box>
  );
}
