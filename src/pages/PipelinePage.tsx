import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Box,
  Container,
  Stack,
  Card,
  Loader,
  Group,
  Text,
} from "@mantine/core";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { AppHeader } from "../components/AppHeader";
import { type GrantFilterValues } from "../components/GrantFilters";
import { useOrganization } from "../contexts/OrganizationContext";
import { ImportWizard } from "../components/ImportWizard";
import { useSavedGrants, type SavedGrant } from "../hooks/useSavedGrants";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { PipelineHeader } from "../components/pipeline/PipelineHeader";
import { PipelineViewToggle } from "../components/pipeline/PipelineViewToggle";
import { PipelineFilters } from "../components/pipeline/PipelineFilters";
import { BulkActionsToolbar } from "../components/pipeline/BulkActionsToolbar";
import { PipelineBoardView } from "../components/pipeline/PipelineBoardView";
import { PipelineListView } from "../components/pipeline/PipelineListView";

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
        let errorMessage = "Failed to update grant status";
        try {
          const errorData = await response.json();
          console.error('[PipelinePage] Error response:', errorData);
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
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
      await queryClient.cancelQueries({ queryKey: ["savedGrants"] });
      const previousData = queryClient.getQueryData(["savedGrants"]);

      queryClient.setQueryData(["savedGrants"], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          grants: old.grants.map((grant: SavedGrant) =>
            grant.id === grantId ? { ...grant, status: newStatus } : grant
          ),
        };
      });

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

  // Archive grant mutation
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

  // Remove from pipeline mutation
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
    if (grant.status === "archived") return false;

    if (filters.priority && filters.priority.length > 0) {
      if (!grant.priority || !filters.priority.includes(grant.priority)) return false;
    }

    if (filters.assignedTo && filters.assignedTo.length > 0) {
      if (!grant.assigned_to || !filters.assignedTo.includes(grant.assigned_to)) return false;
    }

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
          <PipelineHeader
            view={view}
            filteredGrants={filteredGrants}
            orgName={currentOrg?.name || 'Organization'}
            onImportClick={() => setImportWizardOpen(true)}
          />

          {/* View Toggle */}
          <PipelineViewToggle
            view={view}
            onViewChange={setView}
            filteredCount={filteredGrants.length}
            totalCount={data?.grants.length || 0}
          />

          {/* Filters */}
          <PipelineFilters
            view={view}
            filters={filters}
            onFiltersChange={setFilters}
            sortBy={sortBy}
            onSortChange={setSortBy}
            showMyGrantsOnly={showMyGrantsOnly}
            onShowMyGrantsOnlyChange={setShowMyGrantsOnly}
          />

          {/* Bulk Actions Toolbar (List View Only) */}
          {view === 'list' && (
            <BulkActionsToolbar
              selectedCount={selectedGrantIds.size}
              onDeselectAll={deselectAllGrants}
              onBulkUpdateStatus={handleBulkUpdateStatus}
              onBulkUpdatePriority={handleBulkUpdatePriority}
              onBulkDelete={handleBulkDelete}
              isOperating={isBulkOperating}
            />
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
            <PipelineBoardView
              grantsByStage={grantsByStage}
              draggedItem={draggedItem}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onUpdateStatus={(grantId, newStatus) =>
                updateStatusMutation.mutate({ grantId, newStatus })
              }
              onArchive={(grantId) => archiveGrantMutation.mutate(grantId)}
              onRemove={(grantId) => removeFromPipelineMutation.mutate(grantId)}
            />
          ) : (
            // List View
            <PipelineListView
              grants={sortedAndFilteredGrants}
              selectedGrantIds={selectedGrantIds}
              onToggleSelection={toggleGrantSelection}
              onSelectAll={selectAllGrants}
              onDeselectAll={deselectAllGrants}
              onRemove={(grantId) => removeFromPipelineMutation.mutate(grantId)}
              isLoading={isLoading}
            />
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
