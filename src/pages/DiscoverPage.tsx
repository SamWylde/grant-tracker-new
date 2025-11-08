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
  Drawer,
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
  Tooltip,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconBookmark,
  IconBookmarkFilled,
  IconCalendar,
  IconExternalLink,
  IconFilter,
  IconInfoCircle,
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
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  const [selectedGrantId, setSelectedGrantId] = useState<string | null>(null);

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

  // Fetch grant details
  const { data: grantDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ["grantDetails", selectedGrantId],
    queryFn: async () => {
      if (!selectedGrantId) return null;

      const response = await fetch("/api/grants/details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId: selectedGrantId }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch grant details");
      }

      return response.json();
    },
    enabled: !!selectedGrantId && detailsDrawerOpen,
  });

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
            <Button variant="light" color="grape" component={Link} to="/saved">
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
            <Paper p="md" withBorder>
              <Group justify="space-between" align="center">
                <Stack gap={4}>
                  <Text fw={600} size="lg">
                    {data.totalCount.toLocaleString()} Opportunities Found
                  </Text>
                  <Text size="sm" c="dimmed">
                    Showing {sortedGrants.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0}–
                    {Math.min(currentPage * ITEMS_PER_PAGE, data.totalCount)}
                    {data.totalCount > 1000 && (
                      <Text span c="orange" ml={4}>
                        • Consider refining filters for more specific results
                      </Text>
                    )}
                  </Text>
                </Stack>
                <Button
                  variant="light"
                  size="sm"
                  onClick={() => refetch()}
                  disabled={isLoading}
                  leftSection={<IconSearch size={16} />}
                >
                  Refresh
                </Button>
              </Group>
            </Paper>
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
                const isClosingSoon =
                  grant.closeDate &&
                  dayjs(grant.closeDate).diff(dayjs(), "day") <= 30;
                const grantsGovUrl = `https://www.grants.gov/search-results-detail/${grant.id}`;

                return (
                  <Card key={grant.id} padding="lg" withBorder radius="md" shadow="sm">
                    <Stack gap="md">
                      {/* Header with title and actions */}
                      <Group justify="space-between" align="flex-start" wrap="nowrap">
                        <Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
                          {/* Opportunity Number */}
                          <Group gap={8}>
                            <Badge variant="dot" color="gray" size="sm">
                              {grant.number}
                            </Badge>
                            <Badge
                              variant="light"
                              color={grant.status === "posted" ? "green" : "blue"}
                              size="sm"
                            >
                              {grant.status}
                            </Badge>
                          </Group>

                          {/* Title as external link */}
                          <Anchor
                            href={grantsGovUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            fw={600}
                            size="lg"
                            c="dark"
                            style={{
                              textDecoration: "none",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                            }}
                          >
                            {grant.title}
                            <IconExternalLink
                              size={16}
                              style={{ marginLeft: 4, verticalAlign: "middle" }}
                            />
                          </Anchor>

                          {/* Agency and ALN */}
                          <Group gap="xs" wrap="wrap">
                            <Text size="sm" c="dimmed" fw={500}>
                              {grant.agency}
                            </Text>
                            {grant.aln && (
                              <>
                                <Text size="sm" c="dimmed">
                                  •
                                </Text>
                                <Text size="sm" c="dimmed">
                                  CFDA {grant.aln}
                                </Text>
                              </>
                            )}
                          </Group>
                        </Stack>

                        {/* Action buttons */}
                        <Group gap="xs">
                          <Tooltip label="View full details" position="left">
                            <Button
                              variant="subtle"
                              color="gray"
                              size="sm"
                              leftSection={<IconInfoCircle size={16} />}
                              onClick={() => {
                                setSelectedGrantId(grant.id);
                                setDetailsDrawerOpen(true);
                              }}
                            >
                              Details
                            </Button>
                          </Tooltip>
                          <Tooltip
                            label={isSaved ? "Saved to pipeline" : "Save to pipeline"}
                            position="left"
                          >
                            <Button
                              variant={isSaved ? "filled" : "light"}
                              color="grape"
                              size="sm"
                              leftSection={
                                isSaved ? (
                                  <IconBookmarkFilled size={16} />
                                ) : (
                                  <IconBookmark size={16} />
                                )
                              }
                              onClick={() => handleSaveToggle(grant, isSaved)}
                            >
                              {isSaved ? "Saved" : "Save"}
                            </Button>
                          </Tooltip>
                        </Group>
                      </Group>

                      <Divider />

                      {/* Dates row */}
                      <Group gap="lg" wrap="wrap">
                        {grant.openDate && (
                          <Group gap={6}>
                            <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                              Opened
                            </Text>
                            <Text size="sm">
                              {dayjs(grant.openDate).format("MMM D, YYYY")}
                            </Text>
                          </Group>
                        )}
                        <Group gap={6}>
                          <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                            {grant.closeDate ? "Closes" : "Deadline"}
                          </Text>
                          {grant.closeDate ? (
                            <Text
                              size="sm"
                              fw={isClosingSoon ? 700 : 500}
                              c={isClosingSoon ? "orange" : undefined}
                            >
                              {dayjs(grant.closeDate).format("MMM D, YYYY")}
                              {isClosingSoon && (
                                <Badge
                                  color="orange"
                                  variant="light"
                                  size="xs"
                                  ml={6}
                                >
                                  Soon
                                </Badge>
                              )}
                            </Text>
                          ) : (
                            <Text size="sm" c="dimmed" fs="italic">
                              TBD
                            </Text>
                          )}
                        </Group>
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

      {/* Grant Details Drawer */}
      <Drawer
        opened={detailsDrawerOpen}
        onClose={() => {
          setDetailsDrawerOpen(false);
          setSelectedGrantId(null);
        }}
        title="Grant Details"
        position="right"
        size="xl"
        padding="lg"
      >
        {isLoadingDetails ? (
          <Group justify="center" py="xl">
            <Loader />
            <Text>Loading details...</Text>
          </Group>
        ) : grantDetails ? (
          <Stack gap="md">
            {/* Synopsis/Description */}
            {grantDetails.synopsis?.synopsisDesc && (
              <Box>
                <Text fw={600} size="sm" tt="uppercase" c="dimmed" mb="xs">
                  Description
                </Text>
                <Text style={{ whiteSpace: "pre-wrap" }}>
                  {grantDetails.synopsis.synopsisDesc}
                </Text>
              </Box>
            )}

            {/* Award Information */}
            {grantDetails.award && (
              <Box>
                <Text fw={600} size="sm" tt="uppercase" c="dimmed" mb="xs">
                  Award Information
                </Text>
                <Stack gap="xs">
                  {grantDetails.award.awardCeiling && (
                    <Group gap="xs">
                      <Text size="sm" fw={500}>
                        Award Ceiling:
                      </Text>
                      <Text size="sm">
                        ${Number(grantDetails.award.awardCeiling).toLocaleString()}
                      </Text>
                    </Group>
                  )}
                  {grantDetails.award.awardFloor && (
                    <Group gap="xs">
                      <Text size="sm" fw={500}>
                        Award Floor:
                      </Text>
                      <Text size="sm">
                        ${Number(grantDetails.award.awardFloor).toLocaleString()}
                      </Text>
                    </Group>
                  )}
                  {grantDetails.award.estimatedTotalProgram && (
                    <Group gap="xs">
                      <Text size="sm" fw={500}>
                        Estimated Total Program Funding:
                      </Text>
                      <Text size="sm">
                        ${Number(grantDetails.award.estimatedTotalProgram).toLocaleString()}
                      </Text>
                    </Group>
                  )}
                  {grantDetails.award.expectedNumberOfAwards && (
                    <Group gap="xs">
                      <Text size="sm" fw={500}>
                        Expected Number of Awards:
                      </Text>
                      <Text size="sm">
                        {grantDetails.award.expectedNumberOfAwards}
                      </Text>
                    </Group>
                  )}
                </Stack>
              </Box>
            )}

            {/* Eligibility */}
            {grantDetails.eligibility && (
              <Box>
                <Text fw={600} size="sm" tt="uppercase" c="dimmed" mb="xs">
                  Eligibility
                </Text>
                <Stack gap="xs">
                  {grantDetails.eligibility.applicantEligibilityDesc && (
                    <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                      {grantDetails.eligibility.applicantEligibilityDesc}
                    </Text>
                  )}
                  {grantDetails.eligibility.applicantTypes && (
                    <Group gap={4} mt="xs">
                      {grantDetails.eligibility.applicantTypes.map((type: string, idx: number) => (
                        <Badge key={idx} size="sm" variant="light">
                          {type}
                        </Badge>
                      ))}
                    </Group>
                  )}
                </Stack>
              </Box>
            )}

            {/* Additional Information */}
            {grantDetails.additionalInfo && (
              <Box>
                <Text fw={600} size="sm" tt="uppercase" c="dimmed" mb="xs">
                  Additional Information
                </Text>
                <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                  {grantDetails.additionalInfo}
                </Text>
              </Box>
            )}

            {/* Contact Information */}
            {grantDetails.contact && (
              <Box>
                <Text fw={600} size="sm" tt="uppercase" c="dimmed" mb="xs">
                  Contact Information
                </Text>
                <Stack gap="xs">
                  {grantDetails.contact.name && (
                    <Text size="sm">{grantDetails.contact.name}</Text>
                  )}
                  {grantDetails.contact.email && (
                    <Anchor href={`mailto:${grantDetails.contact.email}`} size="sm">
                      {grantDetails.contact.email}
                    </Anchor>
                  )}
                  {grantDetails.contact.phone && (
                    <Text size="sm">{grantDetails.contact.phone}</Text>
                  )}
                </Stack>
              </Box>
            )}
          </Stack>
        ) : (
          <Text c="dimmed">No details available</Text>
        )}
      </Drawer>
    </Box>
  );
}
