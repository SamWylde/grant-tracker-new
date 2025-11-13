import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Box,
  Container,
  Group,
  Stack,
  Title,
  Text,
  Badge,
  Card,
  Code,
  ScrollArea,
  Loader,
  ActionIcon,
  Menu,
  Switch,
  Button,
  SegmentedControl,
  Checkbox,
  Paper,
  Anchor,
  Divider,
  Select,
} from "@mantine/core";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import {
  IconGripVertical,
  IconCalendar,
  IconExternalLink,
  IconArrowRight,
  IconDots,
  IconPrinter,
  IconArchive,
  IconTrash,
  IconLayoutBoard,
  IconList,
  IconDownload,
  IconChevronDown,
  IconUpload,
  IconFlag,
  IconX,
  IconChecks,
  IconSquare,
} from "@tabler/icons-react";
import dayjs from "dayjs";
import { AppHeader } from "../components/AppHeader";
import { GrantFilters, type GrantFilterValues } from "../components/GrantFilters";
import { useOrganization } from "../contexts/OrganizationContext";
import { ImportWizard } from "../components/ImportWizard";
import { useSavedGrants, type SavedGrant } from "../hooks/useSavedGrants";
import { useAuth } from "../contexts/AuthContext";
import { printBoardPacket, exportGrantsToCSV } from "../utils/printBoardPacket";
import { supabase } from "../lib/supabase";
import { stripHtml } from "../utils/htmlUtils";
import { SuccessScoreBadge } from "../components/SuccessScoreBadge";
import { GrantTagBadges } from "../components/GrantTagBadges";

// Pipeline stages
const PIPELINE_STAGES = [
  { id: "researching", label: "Researching", color: "blue" },
  { id: "go-no-go", label: "Go/No-Go", color: "yellow" },
  { id: "drafting", label: "Drafting", color: "grape" },
  { id: "submitted", label: "Submitted", color: "orange" },
  { id: "awarded", label: "Awarded", color: "green" },
  { id: "not-funded", label: "Not Funded", color: "red" },
  { id: "closed-out", label: "Closed Out", color: "teal" },
] as const;

type PipelineStage = typeof PIPELINE_STAGES[number]["id"];

export function PipelinePage() {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [filters, setFilters] = useState<GrantFilterValues>({
    priority: [],
    assignedTo: [],
  });
  const [showMyGrantsOnly, setShowMyGrantsOnly] = useState(false);
  const [sortBy, setSortBy] = useState<string>("deadline-asc");
  const [importWizardOpen, setImportWizardOpen] = useState(false);
  const [selectedGrantIds, setSelectedGrantIds] = useState<Set<string>>(new Set());
  const [isBulkOperating, setIsBulkOperating] = useState(false);

  // View state management with URL persistence
  const viewParam = searchParams.get('view');
  const [view, setView] = useState<'board' | 'list'>(
    viewParam === 'list' ? 'list' : 'board'
  );

  // Update URL when view changes
  useEffect(() => {
    const currentView = searchParams.get('view');
    if (view === 'list' && currentView !== 'list') {
      searchParams.set('view', 'list');
      setSearchParams(searchParams, { replace: true });
    } else if (view === 'board' && currentView === 'list') {
      searchParams.delete('view');
      setSearchParams(searchParams, { replace: true });
    }
  }, [view, searchParams, setSearchParams]);

  // Fetch saved grants using shared hook
  const { data, isLoading, error } = useSavedGrants();

  // Handle URL parameters for deep linking from mentions
  useEffect(() => {
    const grantId = searchParams.get('grant');
    const commentId = searchParams.get('comment');

    if (grantId && data) {
      // Find the grant in the loaded data
      const grant = data.grants.find((g: SavedGrant) => g.id === grantId);
      if (grant) {
        // Navigate to grant detail page with optional comment ID
        const url = commentId
          ? `/pipeline/grant/${grantId}?comment=${commentId}`
          : `/pipeline/grant/${grantId}`;
        navigate(url, { replace: true });
      }
    }
  }, [searchParams, data, navigate]);

  // Update grant status mutation with optimistic updates
  const updateStatusMutation = useMutation({
    mutationFn: async ({ grantId, newStatus }: { grantId: string; newStatus: PipelineStage }) => {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const url = `/api/saved-status?id=${grantId}`;
      console.log('[PipelinePage] PATCH request to:', url, 'with status:', newStatus);

      const response = await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      console.log('[PipelinePage] Response status:', response.status, response.statusText);

      if (!response.ok) {
        // Try to get error message from response
        let errorMessage = "Failed to update grant status";
        try {
          const errorData = await response.json();
          console.error('[PipelinePage] Error response:', errorData);
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          // If response body is not JSON, use status text
          console.error('[PipelinePage] Failed to parse error response:', parseError);
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('[PipelinePage] Success response:', data);
      return data;
    },
    onMutate: async ({ grantId, newStatus }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["savedGrants"] });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData(["savedGrants"]);

      // Optimistically update the cache
      queryClient.setQueryData(["savedGrants"], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          grants: old.grants.map((grant: SavedGrant) =>
            grant.id === grantId ? { ...grant, status: newStatus } : grant
          ),
        };
      });

      // Return context with previous data for rollback
      return { previousData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savedGrants"] });
      notifications.show({
        title: "Status updated",
        message: "Grant moved successfully",
        color: "green",
      });
    },
    onError: (error, _variables, context) => {
      console.error('[PipelinePage] Mutation error:', error);

      // Rollback to previous state on error
      if (context?.previousData) {
        queryClient.setQueryData(["savedGrants"], context.previousData);
      }
      notifications.show({
        title: "Error",
        message: error instanceof Error ? error.message : "Failed to update grant status. Changes have been reverted.",
        color: "red",
      });
    },
  });

  // Archive grant mutation (sets status to "archived")
  const archiveGrantMutation = useMutation({
    mutationFn: async (grantId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/saved-status?id=${grantId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ status: "archived" }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to archive grant");
      }

      return response.json();
    },
    onMutate: async (grantId) => {
      await queryClient.cancelQueries({ queryKey: ["savedGrants"] });
      const previousData = queryClient.getQueryData(["savedGrants"]);

      // Optimistically update status to archived
      queryClient.setQueryData(["savedGrants"], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          grants: old.grants.map((grant: SavedGrant) =>
            grant.id === grantId ? { ...grant, status: "archived" } : grant
          ),
        };
      });

      return { previousData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savedGrants"] });
      notifications.show({
        title: "Grant archived",
        message: "Grant archived successfully",
        color: "green",
      });
    },
    onError: (error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["savedGrants"], context.previousData);
      }
      notifications.show({
        title: "Error",
        message: error instanceof Error ? error.message : "Failed to archive grant",
        color: "red",
      });
    },
  });

  // Remove from pipeline mutation (deletes the saved grant permanently)
  const removeFromPipelineMutation = useMutation({
    mutationFn: async (grantId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/saved?id=${grantId}`, {
        method: "DELETE",
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to remove grant");
      }

      return response.json();
    },
    onMutate: async (grantId) => {
      await queryClient.cancelQueries({ queryKey: ["savedGrants"] });
      const previousData = queryClient.getQueryData(["savedGrants"]);

      // Optimistically remove from cache
      queryClient.setQueryData(["savedGrants"], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          grants: old.grants.filter((grant: SavedGrant) => grant.id !== grantId),
        };
      });

      return { previousData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savedGrants"] });
      notifications.show({
        title: "Grant removed",
        message: "Grant removed from pipeline successfully",
        color: "green",
      });
    },
    onError: (error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["savedGrants"], context.previousData);
      }
      notifications.show({
        title: "Error",
        message: error instanceof Error ? error.message : "Failed to remove grant",
        color: "red",
      });
    },
  });

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
    setSelectedGrantIds(new Set(sortedAndFilteredGrants.map(g => g.id)));
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
        fetch(`/api/saved-status?id=${grantId}`, {
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

  // Filter grants before grouping by stage
  const filteredGrants = data?.grants ? data.grants.filter((grant) => {
    // Exclude archived grants from pipeline view
    if (grant.status === "archived") return false;

    // Filter by priority
    if (filters.priority && filters.priority.length > 0) {
      if (!grant.priority || !filters.priority.includes(grant.priority)) return false;
    }

    // Filter by assignee
    if (filters.assignedTo && filters.assignedTo.length > 0) {
      if (!grant.assigned_to || !filters.assignedTo.includes(grant.assigned_to)) return false;
    }

    // Show only user's grants if toggle is enabled
    if (showMyGrantsOnly && user) {
      if (grant.assigned_to !== user.id) return false;
    }

    return true;
  }) : [];

  // Sort grants for list view
  const sortedAndFilteredGrants = [...filteredGrants].sort((a, b) => {
    switch (sortBy) {
      case "deadline-asc":
        if (!a.close_date) return 1;
        if (!b.close_date) return -1;
        return new Date(a.close_date).getTime() - new Date(b.close_date).getTime();
      case "deadline-desc":
        if (!a.close_date) return 1;
        if (!b.close_date) return -1;
        return new Date(b.close_date).getTime() - new Date(a.close_date).getTime();
      case "loi-deadline-asc":
        if (!a.loi_deadline) return 1;
        if (!b.loi_deadline) return -1;
        return new Date(a.loi_deadline).getTime() - new Date(b.loi_deadline).getTime();
      case "loi-deadline-desc":
        if (!a.loi_deadline) return 1;
        if (!b.loi_deadline) return -1;
        return new Date(b.loi_deadline).getTime() - new Date(a.loi_deadline).getTime();
      case "saved-newest":
        return new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime();
      case "saved-oldest":
        return new Date(a.saved_at).getTime() - new Date(b.saved_at).getTime();
      default:
        return 0;
    }
  });

  // Group grants by status
  const grantsByStage = PIPELINE_STAGES.reduce((acc, stage) => {
    acc[stage.id] = filteredGrants.filter((g) => g.status === stage.id);
    return acc;
  }, {} as Record<PipelineStage, SavedGrant[]>);

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, grantId: string) => {
    setDraggedItem(grantId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, newStatus: PipelineStage) => {
    e.preventDefault();
    if (draggedItem) {
      updateStatusMutation.mutate({ grantId: draggedItem, newStatus });
      setDraggedItem(null);
    }
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case "urgent":
        return "red";
      case "high":
        return "orange";
      case "medium":
        return "blue";
      default:
        return "gray";
    }
  };

  if (!currentOrg) {
    return (
      <Box>
        <AppHeader subtitle="Pipeline" />
        <Container size="xl" py="xl">
          <Text>Please select an organization</Text>
        </Container>
      </Box>
    );
  }

  return (
    <Box bg="var(--mantine-color-gray-0)" mih="100vh">
      <AppHeader subtitle="Grant Pipeline" />

      <Container size="xl" py="xl">
        <Stack gap="lg">
          {/* Header */}
          <Group justify="space-between" align="flex-start">
            <div>
              <Title order={1}>Pipeline</Title>
              <Text c="dimmed" size="lg">
                {view === 'board'
                  ? 'Track grants through your workflow stages'
                  : 'Manage your saved grants and track important deadlines'}
              </Text>
            </div>
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
                    disabled={filteredGrants.length === 0}
                  >
                    Export
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item
                    leftSection={<IconPrinter size={16} />}
                    onClick={() => printBoardPacket(filteredGrants, {
                      title: view === 'board' ? 'Pipeline Board Packet' : 'Saved Grants Report'
                    })}
                  >
                    Print Report
                  </Menu.Item>
                  <Menu.Item
                    leftSection={<IconDownload size={16} />}
                    onClick={() => exportGrantsToCSV(filteredGrants, currentOrg?.name || 'Organization')}
                  >
                    Download CSV
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          </Group>

          <Divider />

          {/* View Toggle */}
          <Group justify="space-between" align="center">
            <SegmentedControl
              value={view}
              onChange={(value) => setView(value as 'board' | 'list')}
              data={[
                {
                  value: 'board',
                  label: (
                    <Group gap="xs">
                      <IconLayoutBoard size={16} />
                      <span>Board</span>
                    </Group>
                  ),
                },
                {
                  value: 'list',
                  label: (
                    <Group gap="xs">
                      <IconList size={16} />
                      <span>List</span>
                    </Group>
                  ),
                },
              ]}
            />
            <Text size="sm" c="dimmed">
              Showing {filteredGrants.length} of {data?.grants.length || 0} grants
            </Text>
          </Group>

          {/* Filters */}
          <Group justify="space-between" align="flex-start">
            <GrantFilters
              value={filters}
              onChange={setFilters}
              showStatus={view === 'list'}
            />
            <Group>
              {view === 'list' && (
                <Select
                  placeholder="Sort by"
                  value={sortBy}
                  onChange={(value) => setSortBy(value || "deadline-asc")}
                  data={[
                    { value: "loi-deadline-asc", label: "LOI Deadline (soonest first)" },
                    { value: "loi-deadline-desc", label: "LOI Deadline (latest first)" },
                    { value: "deadline-asc", label: "App Deadline (soonest first)" },
                    { value: "deadline-desc", label: "App Deadline (latest first)" },
                    { value: "saved-newest", label: "Recently saved" },
                    { value: "saved-oldest", label: "Oldest saved" },
                  ]}
                  w={200}
                />
              )}
              <Switch
                label="My grants only"
                checked={showMyGrantsOnly}
                onChange={(event) => setShowMyGrantsOnly(event.currentTarget.checked)}
              />
            </Group>
          </Group>

          {/* Bulk Actions Toolbar (List View Only) */}
          {view === 'list' && selectedGrantIds.size > 0 && (
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
                      <Menu.Item onClick={() => handleBulkUpdateStatus('go-no-go')}>
                        Go/No-Go
                      </Menu.Item>
                      <Menu.Item onClick={() => handleBulkUpdateStatus('drafting')}>
                        Drafting
                      </Menu.Item>
                      <Menu.Item onClick={() => handleBulkUpdateStatus('submitted')}>
                        Submitted
                      </Menu.Item>
                      <Menu.Item onClick={() => handleBulkUpdateStatus('awarded')}>
                        Awarded
                      </Menu.Item>
                      <Menu.Item onClick={() => handleBulkUpdateStatus('not-funded')}>
                        Not Funded
                      </Menu.Item>
                      <Menu.Item onClick={() => handleBulkUpdateStatus('closed-out')}>
                        Closed Out
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

          {/* Select All Button (List View Only) */}
          {view === 'list' && !isLoading && sortedAndFilteredGrants.length > 0 && (
            <Group justify="flex-end">
              <Button
                variant="subtle"
                size="xs"
                leftSection={selectedGrantIds.size === sortedAndFilteredGrants.length ? <IconSquare size={14} /> : <IconChecks size={14} />}
                onClick={selectedGrantIds.size === sortedAndFilteredGrants.length ? deselectAllGrants : selectAllGrants}
              >
                {selectedGrantIds.size === sortedAndFilteredGrants.length ? 'Deselect All' : 'Select All'}
              </Button>
            </Group>
          )}

          {/* Loading State */}
          {isLoading ? (
            <Card padding="xl">
              <Group justify="center">
                <Loader size="lg" />
                <Text>Loading {view === 'board' ? 'pipeline' : 'grants'}...</Text>
              </Group>
            </Card>
          ) : error ? (
            <Card padding="xl" withBorder>
              <Stack align="center" gap="md">
                <Text c="red" fw={600}>
                  Error loading grants
                </Text>
                <Text c="dimmed" ta="center">
                  {error instanceof Error ? error.message : "An error occurred"}
                </Text>
              </Stack>
            </Card>
          ) : view === 'board' ? (
            // Board View
            <ScrollArea>
              <Group align="flex-start" gap="md" wrap="nowrap" style={{ minWidth: "fit-content" }}>
                {PIPELINE_STAGES.map((stage) => (
                  <Box
                    key={stage.id}
                    style={{ minWidth: 280, maxWidth: 280 }}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, stage.id)}
                  >
                    {/* Column Header */}
                    <Card padding="md" mb="md" withBorder bg={`var(--mantine-color-${stage.color}-0)`}>
                      <Group justify="space-between">
                        <Text fw={600} size="lg">
                          {stage.label}
                        </Text>
                        <Badge color={stage.color} variant="filled">
                          {grantsByStage[stage.id].length}
                        </Badge>
                      </Group>
                    </Card>

                    {/* Grant Cards */}
                    <Stack gap="sm">
                      {grantsByStage[stage.id].length === 0 ? (
                        <Card padding="md" withBorder style={{ opacity: 0.5 }}>
                          <Text size="sm" c="dimmed" ta="center">
                            No grants in this stage
                          </Text>
                        </Card>
                      ) : (
                        grantsByStage[stage.id].map((grant) => {
                          const daysUntilClose = grant.close_date
                            ? dayjs(grant.close_date).diff(dayjs(), "day")
                            : null;
                          const isClosingSoon = daysUntilClose !== null && daysUntilClose <= 30;
                          const isOverdue = daysUntilClose !== null && daysUntilClose < 0;

                          return (
                            <Card
                              key={grant.id}
                              padding="md"
                              withBorder
                              draggable
                              onDragStart={(e) => handleDragStart(e, grant.id)}
                              onDragEnd={handleDragEnd}
                              onClick={() => navigate(`/pipeline/grant/${grant.id}`)}
                              role="button"
                              tabIndex={0}
                              aria-label={`${grant.title} - Click to view details or use menu to move`}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  navigate(`/pipeline/grant/${grant.id}`);
                                }
                              }}
                              style={{
                                cursor: "pointer",
                                opacity: draggedItem === grant.id ? 0.5 : 1,
                                transition: "all 0.2s",
                              }}
                              onMouseEnter={(e) => {
                                if (draggedItem !== grant.id) {
                                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
                                }
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.boxShadow = "";
                              }}
                            >
                              <Stack gap="sm">
                                {/* Drag Handle & Priority */}
                                <Group justify="space-between">
                                  <ActionIcon
                                    variant="subtle"
                                    color="gray"
                                    size="sm"
                                    style={{ cursor: "grab" }}
                                    aria-label="Drag to move grant"
                                  >
                                    <IconGripVertical size={16} />
                                  </ActionIcon>
                                  <Badge size="sm" color={getPriorityColor(grant.priority)} variant="light">
                                    {grant.priority || "normal"}
                                  </Badge>
                                </Group>

                                {/* Badges */}
                                <Group gap="xs" wrap="wrap">
                                  {grant.aln && (
                                    <Badge variant="outline" size="xs" color="gray">
                                      {grant.aln}
                                    </Badge>
                                  )}
                                  <SuccessScoreBadge
                                    grantId={grant.external_id}
                                    orgId={grant.org_id}
                                    compact
                                  />
                                </Group>
                                <GrantTagBadges grantId={grant.external_id} maxTags={3} />

                                {/* Title */}
                                <Text fw={600} size="sm" lineClamp={2}>
                                  {grant.title}
                                </Text>

                                {/* Agency */}
                                <Text size="xs" c="dimmed">
                                  {grant.agency}
                                </Text>

                                {/* Grant ID for easy testing */}
                                {grant.external_id && (
                                  <Group gap={4}>
                                    <Code c="dimmed" style={{ cursor: 'pointer', fontSize: '11px' }} onClick={(e) => {
                                      e.stopPropagation();
                                      navigator.clipboard.writeText(grant.external_id);
                                      notifications.show({
                                        title: 'Copied!',
                                        message: `Grant ID ${grant.external_id} copied to clipboard`,
                                        color: 'green',
                                        autoClose: 2000,
                                      });
                                    }}>
                                      ID: {grant.external_id}
                                    </Code>
                                  </Group>
                                )}

                                {/* Description preview */}
                                <Text size="xs" c="dimmed" lineClamp={2}>
                                  {grant.description ? (() => {
                                    const cleanDesc = stripHtml(grant.description);
                                    return cleanDesc.length > 150
                                      ? cleanDesc.substring(0, 150) + '...'
                                      : cleanDesc;
                                  })() : "No description available"}
                                </Text>

                                {/* LOI Deadline */}
                                {grant.loi_deadline && (() => {
                                  const loiDaysUntil = dayjs(grant.loi_deadline).diff(dayjs(), "day");
                                  const loiClosingSoon = loiDaysUntil <= 14;
                                  const loiOverdue = loiDaysUntil < 0;
                                  return (
                                    <Group gap="xs">
                                      <IconCalendar size={14} />
                                      <Text
                                        size="xs"
                                        fw={loiClosingSoon || loiOverdue ? 600 : 400}
                                        c={loiOverdue ? "red" : loiClosingSoon ? "orange" : "blue"}
                                      >
                                        LOI: {dayjs(grant.loi_deadline).format("MMM D")}
                                      </Text>
                                      {loiDaysUntil !== null && !loiOverdue && (
                                        <Badge size="xs" color={loiClosingSoon ? "orange" : "blue"} variant="dot">
                                          {loiDaysUntil}d
                                        </Badge>
                                      )}
                                    </Group>
                                  );
                                })()}

                                {/* Application Deadline */}
                                {grant.close_date && (
                                  <Group gap="xs">
                                    <IconCalendar size={14} />
                                    <Text
                                      size="xs"
                                      fw={isClosingSoon || isOverdue ? 600 : 400}
                                      c={isOverdue ? "red" : isClosingSoon ? "orange" : "dimmed"}
                                    >
                                      App: {dayjs(grant.close_date).format("MMM D, YYYY")}
                                    </Text>
                                    {daysUntilClose !== null && !isOverdue && (
                                      <Badge size="xs" color={isClosingSoon ? "orange" : "gray"} variant="dot">
                                        {daysUntilClose}d
                                      </Badge>
                                    )}
                                  </Group>
                                )}

                                {/* Actions */}
                                <Group gap="xs" mt="xs" justify="space-between">
                                  <ActionIcon
                                    variant="subtle"
                                    size="sm"
                                    component="a"
                                    href={`https://www.grants.gov/search-results-detail/${grant.external_id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <IconExternalLink size={14} />
                                  </ActionIcon>

                                  {/* Keyboard-accessible move menu */}
                                  <Menu position="bottom-end" shadow="md" withinPortal>
                                    <Menu.Target>
                                      <ActionIcon
                                        variant="subtle"
                                        size="sm"
                                        aria-label={`Move ${grant.title} to different stage`}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <IconDots size={14} />
                                      </ActionIcon>
                                    </Menu.Target>
                                    <Menu.Dropdown>
                                      <Menu.Label>Move to stage</Menu.Label>
                                      {PIPELINE_STAGES.filter(s => s.id !== stage.id).map((targetStage) => (
                                        <Menu.Item
                                          key={targetStage.id}
                                          leftSection={<IconArrowRight size={14} />}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            updateStatusMutation.mutate({
                                              grantId: grant.id,
                                              newStatus: targetStage.id as PipelineStage,
                                            });
                                          }}
                                        >
                                          {targetStage.label}
                                        </Menu.Item>
                                      ))}
                                      <Menu.Divider />
                                      <Menu.Item
                                        color="orange"
                                        leftSection={<IconArchive size={14} />}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          archiveGrantMutation.mutate(grant.id);
                                        }}
                                      >
                                        Archive
                                      </Menu.Item>
                                      <Menu.Item
                                        color="red"
                                        leftSection={<IconTrash size={14} />}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          removeFromPipelineMutation.mutate(grant.id);
                                        }}
                                      >
                                        Remove from Pipeline
                                      </Menu.Item>
                                    </Menu.Dropdown>
                                  </Menu>
                                </Group>
                              </Stack>
                            </Card>
                          );
                        })
                      )}
                    </Stack>
                  </Box>
                ))}
              </Group>
            </ScrollArea>
          ) : (
            // List View
            <Stack gap="md">
              {sortedAndFilteredGrants.length === 0 ? (
                <Card padding="xl" withBorder>
                  <Stack align="center" gap="md" py="xl">
                    <Text size="lg" fw={600} c="dimmed">
                      No grants found
                    </Text>
                    <Text c="dimmed" ta="center" maw={400}>
                      {filteredGrants.length === 0
                        ? "Start building your grant pipeline by saving opportunities from the Discover page."
                        : "No grants match your current filters."}
                    </Text>
                  </Stack>
                </Card>
              ) : (
                sortedAndFilteredGrants.map((grant) => {
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
                      onClick={() => navigate(`/pipeline/grant/${grant.id}`)}
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
                                {grant.status || 'saved'}
                              </Badge>
                              {grant.priority && (
                                <Badge size="sm" color={getPriorityColor(grant.priority)} variant="light">
                                  {grant.priority}
                                </Badge>
                              )}
                              {grant.aln && (
                                <Badge variant="outline" size="sm" color="gray">
                                  {grant.aln}
                                </Badge>
                              )}
                              <SuccessScoreBadge
                                grantId={grant.external_id}
                                orgId={grant.org_id}
                                compact
                              />
                            </Group>
                            <GrantTagBadges grantId={grant.external_id} maxTags={4} />

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
                            <Text size="sm" c="dimmed" lineClamp={2}>
                              {grant.description ? (() => {
                                const cleanDesc = stripHtml(grant.description);
                                return cleanDesc.length > 200
                                  ? cleanDesc.substring(0, 200) + '...'
                                  : cleanDesc;
                              })() : "No description available"}
                            </Text>
                          </Stack>

                          <Group gap="xs" style={{ flexShrink: 0 }}>
                            <ActionIcon
                              variant="light"
                              color="red"
                              size="lg"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeFromPipelineMutation.mutate(grant.id);
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
                })
              )}
            </Stack>
          )}
        </Stack>
      </Container>

      {/* Import Wizard Modal */}
      <ImportWizard
        opened={importWizardOpen}
        onClose={() => setImportWizardOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['savedGrants'] });
        }}
      />
    </Box>
  );
}
