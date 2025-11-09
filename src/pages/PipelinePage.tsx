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
  ScrollArea,
  Loader,
  ActionIcon,
} from "@mantine/core";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import {
  IconGripVertical,
  IconCalendar,
  IconExternalLink,
} from "@tabler/icons-react";
import dayjs from "dayjs";
import { AppHeader } from "../components/AppHeader";
import { useOrganization } from "../contexts/OrganizationContext";
import { GrantDetailDrawer } from "../components/GrantDetailDrawer";
import { useSavedGrants, type SavedGrant } from "../hooks/useSavedGrants";

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
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [selectedGrant, setSelectedGrant] = useState<SavedGrant | null>(null);

  // Fetch saved grants using shared hook
  const { data, isLoading, error } = useSavedGrants();

  // Update grant status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ grantId, newStatus }: { grantId: string; newStatus: PipelineStage }) => {
      const response = await fetch(`/api/saved/${grantId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!response.ok) throw new Error("Failed to update grant status");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savedGrants"] });
      notifications.show({
        title: "Status updated",
        message: "Grant moved successfully",
        color: "green",
      });
    },
    onError: () => {
      notifications.show({
        title: "Error",
        message: "Failed to update grant status",
        color: "red",
      });
    },
  });

  // Group grants by status
  const grantsByStage = PIPELINE_STAGES.reduce((acc, stage) => {
    acc[stage.id] = data?.grants.filter((g) => g.status === stage.id) || [];
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
                Total: {data?.grants.length || 0} grants
              </Text>
            </Group>
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
                    style={{ minWidth: 320, maxWidth: 320 }}
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
                                  <ActionIcon variant="subtle" color="gray" size="sm" style={{ cursor: "grab" }}>
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
                                <Group gap="xs" mt="xs">
                                  <ActionIcon
                                    variant="subtle"
                                    size="sm"
                                    component="a"
                                    href={`https://www.grants.gov/search-results-detail/${grant.external_id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <IconExternalLink size={14} />
                                  </ActionIcon>
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
