import { useState } from "react";
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
} from "@tabler/icons-react";
import dayjs from "dayjs";
import { AppHeader } from "../components/AppHeader";
import { GrantFilters, type GrantFilterValues } from "../components/GrantFilters";
import { useOrganization } from "../contexts/OrganizationContext";
import { GrantDetailDrawer } from "../components/GrantDetailDrawer";
import { useSavedGrants, type SavedGrant } from "../hooks/useSavedGrants";
import { useAuth } from "../contexts/AuthContext";
import { printBoardPacket } from "../utils/printBoardPacket";
import { supabase } from "../lib/supabase";
import { stripHtml } from "../utils/htmlUtils";
import { SuccessScoreBadge } from "../components/SuccessScoreBadge";
import { GrantTagBadges } from "../components/GrantTagBadges";

// Pipeline stages
const PIPELINE_STAGES = [
  { id: "researching", label: "Researching", color: "blue" },
  { id: "drafting", label: "Drafting", color: "grape" },
  { id: "submitted", label: "Submitted", color: "orange" },
  { id: "awarded", label: "Awarded", color: "green" },
] as const;

type PipelineStage = typeof PIPELINE_STAGES[number]["id"];

export function PipelinePage() {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [selectedGrant, setSelectedGrant] = useState<SavedGrant | null>(null);
  const [filters, setFilters] = useState<GrantFilterValues>({
    priority: [],
    assignedTo: [],
  });
  const [showMyGrantsOnly, setShowMyGrantsOnly] = useState(false);

  // Fetch saved grants using shared hook
  const { data, isLoading, error } = useSavedGrants();

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
          <Group justify="space-between">
            <div>
              <Title order={1}>Pipeline</Title>
              <Text c="dimmed" size="lg">
                Track grants through your workflow stages
              </Text>
            </div>
            <Group>
              <Text size="sm" c="dimmed">
                Showing {filteredGrants.length} of {data?.grants.length || 0} grants
              </Text>
              <Button
                leftSection={<IconPrinter size={16} />}
                variant="light"
                color="grape"
                onClick={() => printBoardPacket(filteredGrants, { title: 'Pipeline Board Packet' })}
                disabled={filteredGrants.length === 0}
              >
                Export Board Packet
              </Button>
            </Group>
          </Group>

          {/* Filters */}
          <Group justify="space-between" align="flex-start">
            <GrantFilters
              value={filters}
              onChange={setFilters}
              showStatus={false}
            />
            <Switch
              label="My grants only"
              checked={showMyGrantsOnly}
              onChange={(event) => setShowMyGrantsOnly(event.currentTarget.checked)}
            />
          </Group>

          {/* Pipeline Board */}
          {isLoading ? (
            <Card padding="xl">
              <Group justify="center">
                <Loader size="lg" />
                <Text>Loading pipeline...</Text>
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
          ) : (
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
                              onClick={() => setSelectedGrant(grant)}
                              role="button"
                              tabIndex={0}
                              aria-label={`${grant.title} - Click to view details or use menu to move`}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setSelectedGrant(grant);
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

                                {/* Deadline */}
                                {grant.close_date && (
                                  <Group gap="xs">
                                    <IconCalendar size={14} />
                                    <Text
                                      size="xs"
                                      fw={isClosingSoon || isOverdue ? 600 : 400}
                                      c={isOverdue ? "red" : isClosingSoon ? "orange" : "dimmed"}
                                    >
                                      {dayjs(grant.close_date).format("MMM D, YYYY")}
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
          )}
        </Stack>
      </Container>

      {/* Grant Detail Drawer */}
      <GrantDetailDrawer
        grant={selectedGrant}
        opened={!!selectedGrant}
        onClose={() => setSelectedGrant(null)}
      />
    </Box>
  );
}
