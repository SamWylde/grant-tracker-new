import "@mantine/core/styles.css";
import {
  ActionIcon,
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
  Menu,
  Modal,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import {
  IconBookmarkFilled,
  IconChevronDown,
  IconDownload,
  IconExternalLink,
  IconFileText,
  IconTrash,
  IconPrinter,
  IconUpload,
  IconChecks,
  IconSquare,
  IconFlag,
  IconX,
} from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useState } from "react";
import { Link } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { GrantFilters, type GrantFilterValues } from "../components/GrantFilters";
import { GrantDetailDrawer } from "../components/GrantDetailDrawer";
import { ImportWizard } from "../components/ImportWizard";
import { type GrantDetail, type SavedGrant } from "../types/grants";
import { useSavedGrants } from "../hooks/useSavedGrants";
import { notifications } from "@mantine/notifications";
import { supabase } from "../lib/supabase";
import { printBoardPacket, exportGrantsToCSV } from "../utils/printBoardPacket";
import { stripHtml } from "../utils/htmlUtils";
import { useOrganization } from "../contexts/OrganizationContext";

export function SavedGrantsPage() {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrganization();
  const [sortBy, setSortBy] = useState<string>("deadline-asc");
  const [selectedGrant, setSelectedGrant] = useState<SavedGrant | null>(null);
  const [selectedGrantId, setSelectedGrantId] = useState<string | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [filters, setFilters] = useState<GrantFilterValues>({
    status: [],
    priority: [],
    assignedTo: [],
  });
  const [importWizardOpen, setImportWizardOpen] = useState(false);
  const [selectedGrantIds, setSelectedGrantIds] = useState<Set<string>>(new Set());
  const [isBulkOperating, setIsBulkOperating] = useState(false);

  // Fetch saved grants using shared hook with auth headers
  const { data: savedGrants, isLoading } = useSavedGrants();

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

  // Handler to remove grant from saved list
  const handleRemoveGrant = async (grantId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(`/api/saved?id=${grantId}`, {
        method: "DELETE",
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to remove grant");
      }

      // Invalidate saved grants query to refetch
      queryClient.invalidateQueries({ queryKey: ["savedGrants"] });

      notifications.show({
        title: "Grant removed",
        message: "Grant has been removed from your pipeline",
        color: "green",
      });
    } catch (error) {
      console.error("Error removing grant:", error);
      notifications.show({
        title: "Error",
        message: "Failed to remove grant. Please try again.",
        color: "red",
      });
    }
  };

  // Bulk operations handlers
  const toggleGrantSelection = (grantId: string) => {
    const newSelection = new Set(selectedGrantIds);
    if (newSelection.has(grantId)) {
      newSelection.delete(grantId);
    } else {
      newSelection.add(grantId);
    }
    setSelectedGrantIds(newSelection);
  };

  const selectAllGrants = () => {
    setSelectedGrantIds(new Set(sortedGrants.map(g => g.id)));
  };

  const deselectAllGrants = () => {
    setSelectedGrantIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedGrantIds.size === 0) return;

    setIsBulkOperating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const deletePromises = Array.from(selectedGrantIds).map(grantId =>
        fetch(`/api/saved?id=${grantId}`, {
          method: "DELETE",
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        })
      );

      await Promise.all(deletePromises);

      queryClient.invalidateQueries({ queryKey: ["savedGrants"] });
      deselectAllGrants();

      notifications.show({
        title: "Grants deleted",
        message: `${selectedGrantIds.size} grant(s) removed from pipeline`,
        color: "green",
      });
    } catch (error) {
      notifications.show({
        title: "Error",
        message: "Failed to delete some grants",
        color: "red",
      });
    } finally {
      setIsBulkOperating(false);
    }
  };

  const handleBulkUpdateStatus = async (status: string) => {
    if (selectedGrantIds.size === 0) return;

    setIsBulkOperating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const updatePromises = Array.from(selectedGrantIds).map(grantId =>
        fetch(`/api/saved?id=${grantId}`, {
          method: "PATCH",
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ status }),
        })
      );

      await Promise.all(updatePromises);

      queryClient.invalidateQueries({ queryKey: ["savedGrants"] });
      deselectAllGrants();

      notifications.show({
        title: "Status updated",
        message: `${selectedGrantIds.size} grant(s) updated to ${status}`,
        color: "green",
      });
    } catch (error) {
      notifications.show({
        title: "Error",
        message: "Failed to update some grants",
        color: "red",
      });
    } finally {
      setIsBulkOperating(false);
    }
  };

  const handleBulkUpdatePriority = async (priority: string) => {
    if (selectedGrantIds.size === 0) return;

    setIsBulkOperating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const updatePromises = Array.from(selectedGrantIds).map(grantId =>
        fetch(`/api/saved?id=${grantId}`, {
          method: "PATCH",
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ priority }),
        })
      );

      await Promise.all(updatePromises);

      queryClient.invalidateQueries({ queryKey: ["savedGrants"] });
      deselectAllGrants();

      notifications.show({
        title: "Priority updated",
        message: `${selectedGrantIds.size} grant(s) set to ${priority} priority`,
        color: "green",
      });
    } catch (error) {
      notifications.show({
        title: "Error",
        message: "Failed to update some grants",
        color: "red",
      });
    } finally {
      setIsBulkOperating(false);
    }
  };

  // Filter grants
  const filteredGrants = savedGrants?.grants ? savedGrants.grants.filter((grant) => {
    // Filter by status
    if (filters.status && filters.status.length > 0) {
      if (!filters.status.includes(grant.status)) return false;
    }

    // Filter by priority
    if (filters.priority && filters.priority.length > 0) {
      if (!grant.priority || !filters.priority.includes(grant.priority)) return false;
    }

    // Filter by assignee
    if (filters.assignedTo && filters.assignedTo.length > 0) {
      if (!grant.assigned_to || !filters.assignedTo.includes(grant.assigned_to)) return false;
    }

    return true;
  }) : [];

  // Sort grants
  const sortedGrants = [...filteredGrants].sort((a, b) => {
    switch (sortBy) {
      case "deadline-asc":
        if (!a.close_date) return 1;
        if (!b.close_date) return -1;
        return new Date(a.close_date).getTime() - new Date(b.close_date).getTime();
      case "deadline-desc":
        if (!a.close_date) return 1;
        if (!b.close_date) return -1;
        return new Date(b.close_date).getTime() - new Date(a.close_date).getTime();
      case "saved-newest":
        return new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime();
      case "saved-oldest":
        return new Date(a.saved_at).getTime() - new Date(b.saved_at).getTime();
      default:
        return 0;
    }
  });

  return (
    <Box bg="var(--mantine-color-gray-0)" mih="100vh">
      {/* Header */}
      <AppHeader subtitle="Saved Grants Pipeline" />

      <Container size="xl" py="xl">
        <Stack gap="lg">
          {/* Page header */}
          <Group justify="space-between" align="flex-start">
            <Stack gap="sm">
              <Title order={1}>Saved Grant Opportunities</Title>
              <Text c="dimmed" size="lg">
                Manage your saved grants and track important deadlines
              </Text>
            </Stack>
            <Group>
              <Button
                leftSection={<IconUpload size={16} />}
                variant="light"
                onClick={() => setImportWizardOpen(true)}
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
                    disabled={sortedGrants.length === 0}
                  >
                    Export Report
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item
                    leftSection={<IconPrinter size={16} />}
                    onClick={() => printBoardPacket(sortedGrants, { title: 'Saved Grants Report' })}
                  >
                    Print Report
                  </Menu.Item>
                  <Menu.Item
                    leftSection={<IconDownload size={16} />}
                    onClick={() => exportGrantsToCSV(sortedGrants, currentOrg?.name || 'Organization')}
                  >
                    Download CSV
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
              <Button variant="light" color="grape" component={Link} to="/discover">
                Discover More Grants
              </Button>
            </Group>
          </Group>

          <Divider />

          {/* Filters / Sort */}
          <Group justify="space-between" align="flex-start">
            <GrantFilters value={filters} onChange={setFilters} />
          </Group>

          <Group justify="space-between">
            <Group gap="xs">
              <IconBookmarkFilled size={20} />
              <Text fw={600}>
                {sortedGrants.length} of {savedGrants?.grants.length || 0} grant{savedGrants?.grants.length !== 1 ? "s" : ""}
              </Text>
              {selectedGrantIds.size > 0 && (
                <Badge color="grape" size="lg">
                  {selectedGrantIds.size} selected
                </Badge>
              )}
            </Group>
            <Select
              placeholder="Sort by"
              value={sortBy}
              onChange={(value) => setSortBy(value || "deadline-asc")}
              data={[
                { value: "deadline-asc", label: "Deadline (soonest first)" },
                { value: "deadline-desc", label: "Deadline (latest first)" },
                { value: "saved-newest", label: "Recently saved" },
                { value: "saved-oldest", label: "Oldest saved" },
              ]}
              w={200}
            />
          </Group>

          {/* Bulk Actions Toolbar */}
          {selectedGrantIds.size > 0 && (
            <Paper p="md" withBorder bg="var(--mantine-color-grape-0)">
              <Group justify="space-between">
                <Group gap="sm">
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    onClick={deselectAllGrants}
                    title="Deselect all"
                  >
                    <IconX size={18} />
                  </ActionIcon>
                  <Text fw={600} size="sm">
                    {selectedGrantIds.size} grant{selectedGrantIds.size !== 1 ? 's' : ''} selected
                  </Text>
                </Group>
                <Group gap="xs">
                  <Menu shadow="md" width={180}>
                    <Menu.Target>
                      <Button
                        size="sm"
                        variant="light"
                        leftSection={<IconFlag size={16} />}
                        loading={isBulkOperating}
                      >
                        Set Status
                      </Button>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item onClick={() => handleBulkUpdateStatus('researching')}>
                        Researching
                      </Menu.Item>
                      <Menu.Item onClick={() => handleBulkUpdateStatus('preparing')}>
                        Preparing
                      </Menu.Item>
                      <Menu.Item onClick={() => handleBulkUpdateStatus('submitted')}>
                        Submitted
                      </Menu.Item>
                      <Menu.Item onClick={() => handleBulkUpdateStatus('awarded')}>
                        Awarded
                      </Menu.Item>
                      <Menu.Item onClick={() => handleBulkUpdateStatus('declined')}>
                        Declined
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                  <Menu shadow="md" width={180}>
                    <Menu.Target>
                      <Button
                        size="sm"
                        variant="light"
                        color="blue"
                        leftSection={<IconFlag size={16} />}
                        loading={isBulkOperating}
                      >
                        Set Priority
                      </Button>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item onClick={() => handleBulkUpdatePriority('low')}>
                        Low
                      </Menu.Item>
                      <Menu.Item onClick={() => handleBulkUpdatePriority('medium')}>
                        Medium
                      </Menu.Item>
                      <Menu.Item onClick={() => handleBulkUpdatePriority('high')}>
                        High
                      </Menu.Item>
                      <Menu.Item onClick={() => handleBulkUpdatePriority('urgent')}>
                        Urgent
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                  <Button
                    size="sm"
                    variant="light"
                    color="red"
                    leftSection={<IconTrash size={16} />}
                    onClick={handleBulkDelete}
                    loading={isBulkOperating}
                  >
                    Delete
                  </Button>
                </Group>
              </Group>
            </Paper>
          )}

          {/* Select All Button */}
          {!isLoading && sortedGrants.length > 0 && (
            <Group justify="flex-end">
              <Button
                variant="subtle"
                size="xs"
                leftSection={selectedGrantIds.size === sortedGrants.length ? <IconSquare size={14} /> : <IconChecks size={14} />}
                onClick={selectedGrantIds.size === sortedGrants.length ? deselectAllGrants : selectAllGrants}
              >
                {selectedGrantIds.size === sortedGrants.length ? 'Deselect All' : 'Select All'}
              </Button>
            </Group>
          )}

          {/* Loading State */}
          {isLoading && (
            <Group justify="center" py="xl">
              <Loader size="lg" />
              <Text>Loading saved grants...</Text>
            </Group>
          )}

          {/* Empty State */}
          {!isLoading && (!savedGrants?.grants || savedGrants.grants.length === 0) && (
            <Card padding="xl" withBorder>
              <Stack align="center" gap="md" py="xl">
                <IconBookmarkFilled size={48} color="var(--mantine-color-gray-5)" />
                <Title order={3} c="dimmed">
                  No saved grants yet
                </Title>
                <Text c="dimmed" ta="center" maw={400}>
                  Start building your grant pipeline by saving opportunities from the Discover page.
                </Text>
                <Button color="grape" component={Link} to="/discover">
                  Discover Grants
                </Button>
              </Stack>
            </Card>
          )}

          {/* Grants List */}
          {!isLoading && sortedGrants.length > 0 && (
            <Stack gap="md">
              {sortedGrants.map((grant) => {
                const daysUntilClose = grant.close_date
                  ? dayjs(grant.close_date).diff(dayjs(), "day")
                  : null;
                const isOverdue = daysUntilClose !== null && daysUntilClose < 0;
                const isClosingSoon = daysUntilClose !== null && daysUntilClose >= 0 && daysUntilClose <= 30;

                return (
                  <Card
                    key={grant.id}
                    padding="lg"
                    withBorder
                    style={{
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      backgroundColor: selectedGrantIds.has(grant.id) ? "var(--mantine-color-grape-0)" : undefined,
                    }}
                    onClick={() => setSelectedGrant(grant)}
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
                        <Checkbox
                          checked={selectedGrantIds.has(grant.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleGrantSelection(grant.id);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          size="md"
                          style={{ flexShrink: 0 }}
                        />
                        <Stack gap={8} style={{ flex: 1 }}>
                          <Group gap="xs" wrap="wrap">
                            <Badge variant="filled" size="sm" color="grape">
                              Saved
                            </Badge>
                            {grant.aln && (
                              <Badge variant="outline" size="sm" color="gray">
                                {grant.aln}
                              </Badge>
                            )}
                          </Group>

                          <Anchor
                            href={`https://www.grants.gov/search-results-detail/${grant.external_id}`}
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

                          {/* Description preview */}
                          {grant.description && (
                            <Text size="sm" c="dimmed" lineClamp={2}>
                              {(() => {
                                const cleanDesc = stripHtml(grant.description);
                                return cleanDesc.length > 200
                                  ? cleanDesc.substring(0, 200) + '...'
                                  : cleanDesc;
                              })()}
                            </Text>
                          )}
                        </Stack>

                        <Group gap="xs" style={{ flexShrink: 0 }}>
                          <Button
                            variant="light"
                            color="blue"
                            size="sm"
                            leftSection={<IconFileText size={16} />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewDetails(grant.external_id);
                            }}
                          >
                            Details
                          </Button>
                          <ActionIcon
                            variant="light"
                            color="red"
                            size="lg"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveGrant(grant.id);
                            }}
                            title="Remove from pipeline"
                          >
                            <IconTrash size={20} />
                          </ActionIcon>
                        </Group>
                      </Group>

                      <Divider />

                      {/* Dates */}
                      <Group gap="xl">
                        {grant.open_date && (
                          <Stack gap={4}>
                            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                              Posted
                            </Text>
                            <Text size="sm" fw={500}>
                              {dayjs(grant.open_date).format("MMM D, YYYY")}
                            </Text>
                          </Stack>
                        )}
                        <Stack gap={4}>
                          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                            {isOverdue ? "Closed" : "Closes"}
                          </Text>
                          {grant.close_date ? (
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
                                {dayjs(grant.close_date).format("MMM D, YYYY")}
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

      {/* Import Wizard Modal */}
      <ImportWizard
        opened={importWizardOpen}
        onClose={() => setImportWizardOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['savedGrants'] });
        }}
      />

      {/* Grant Detail Drawer */}
      <GrantDetailDrawer
        grant={selectedGrant}
        opened={!!selectedGrant}
        onClose={() => setSelectedGrant(null)}
      />
    </Box>
  );
}
