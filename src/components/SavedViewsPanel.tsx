import {
  ActionIcon,
  Badge,
  Button,
  Checkbox,
  Group,
  Menu,
  Modal,
  Paper,
  Stack,
  Text,
  TextInput,
  Textarea,
  UnstyledButton,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconBookmark,
  IconCheck,
  IconDots,
  IconShare,
  IconTrash,
} from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

interface SavedView {
  id: string;
  org_id: string;
  created_by: string;
  name: string;
  description: string | null;
  keyword: string | null;
  category: string | null;
  agency: string | null;
  status_posted: boolean;
  status_forecasted: boolean;
  due_in_days: number | null;
  sort_by: string;
  is_shared: boolean;
  use_count: number;
  last_used_at: string | null;
  created_at: string;
}

interface SavedViewsPanelProps {
  orgId: string;
  userId: string;
  currentFilters: {
    keyword: string;
    category: string | null;
    agency: string | null;
    status_posted: boolean;
    status_forecasted: boolean;
    due_in_days: number | string;
    sort_by: string;
  };
  onLoadView: (view: SavedView) => void;
}

export function SavedViewsPanel({
  orgId,
  userId,
  currentFilters,
  onLoadView,
}: SavedViewsPanelProps) {
  const queryClient = useQueryClient();
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const [viewDescription, setViewDescription] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch saved views
  const { data, isLoading } = useQuery<{ views: SavedView[] }>({
    queryKey: ["savedViews", orgId, userId],
    queryFn: async () => {
      const response = await fetch(
        `/api/views?org_id=${orgId}&user_id=${userId}`
      );
      if (!response.ok) throw new Error("Failed to fetch saved views");
      return response.json();
    },
  });

  const views = data?.views || [];
  const myViews = views.filter((v) => v.created_by === userId);
  const sharedViews = views.filter((v) => v.created_by !== userId && v.is_shared);

  // Save current filters as a view
  const handleSaveView = async () => {
    if (!viewName.trim()) {
      notifications.show({
        title: "Name required",
        message: "Please enter a name for this view",
        color: "red",
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: orgId,
          created_by: userId,
          name: viewName,
          description: viewDescription || null,
          keyword: currentFilters.keyword || null,
          category: currentFilters.category || null,
          agency: currentFilters.agency || null,
          status_posted: currentFilters.status_posted,
          status_forecasted: currentFilters.status_forecasted,
          due_in_days: currentFilters.due_in_days
            ? Number(currentFilters.due_in_days)
            : null,
          sort_by: currentFilters.sort_by,
          is_shared: isShared,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save view");
      }

      notifications.show({
        title: "View saved",
        message: `"${viewName}" has been saved`,
        color: "green",
      });

      queryClient.invalidateQueries({ queryKey: ["savedViews"] });
      setSaveModalOpen(false);
      setViewName("");
      setViewDescription("");
      setIsShared(false);
    } catch (error) {
      notifications.show({
        title: "Error",
        message: error instanceof Error ? error.message : "Failed to save view",
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  };

  // Delete a view
  const handleDeleteView = async (viewId: string) => {
    try {
      const response = await fetch(`/api/views?id=${viewId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete view");

      notifications.show({
        title: "View deleted",
        message: "The saved view has been deleted",
        color: "blue",
      });

      queryClient.invalidateQueries({ queryKey: ["savedViews"] });
    } catch (error) {
      notifications.show({
        title: "Error",
        message: "Failed to delete view",
        color: "red",
      });
    }
  };

  // Toggle share status
  const handleToggleShare = async (view: SavedView) => {
    try {
      const response = await fetch(`/api/views?id=${view.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...view,
          is_shared: !view.is_shared,
        }),
      });

      if (!response.ok) throw new Error("Failed to update view");

      notifications.show({
        title: view.is_shared ? "View unshared" : "View shared",
        message: view.is_shared
          ? "This view is now private"
          : "This view is now visible to your team",
        color: "blue",
      });

      queryClient.invalidateQueries({ queryKey: ["savedViews"] });
    } catch (error) {
      notifications.show({
        title: "Error",
        message: "Failed to update view",
        color: "red",
      });
    }
  };

  const formatViewLabel = (view: SavedView): string => {
    const parts: string[] = [];
    if (view.keyword) parts.push(`"${view.keyword}"`);
    if (view.category) parts.push(view.category);
    if (view.agency) parts.push(view.agency);
    if (view.due_in_days) parts.push(`≤${view.due_in_days}d`);
    return parts.length > 0 ? parts.join(" • ") : "All grants";
  };

  return (
    <>
      <Paper p="md" withBorder>
        <Stack gap="md">
          <Group justify="space-between">
            <Group gap="xs">
              <IconBookmark size={20} />
              <Text fw={600}>Saved Views</Text>
              {views.length > 0 && (
                <Badge size="sm" variant="light">
                  {views.length}
                </Badge>
              )}
            </Group>
            <Button
              size="xs"
              variant="light"
              color="grape"
              onClick={() => setSaveModalOpen(true)}
            >
              Save Current View
            </Button>
          </Group>

          {/* My Views */}
          {myViews.length > 0 && (
            <Stack gap="xs">
              <Text size="sm" fw={600} c="dimmed">
                My Views
              </Text>
              {myViews.map((view) => (
                <UnstyledButton
                  key={view.id}
                  onClick={() => onLoadView(view)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "4px",
                    border: "1px solid var(--mantine-color-gray-3)",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      "var(--mantine-color-gray-0)";
                    e.currentTarget.style.borderColor =
                      "var(--mantine-color-grape-4)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.borderColor =
                      "var(--mantine-color-gray-3)";
                  }}
                >
                  <Group justify="space-between" wrap="nowrap">
                    <Stack gap={4} style={{ flex: 1 }}>
                      <Group gap="xs">
                        <Text size="sm" fw={600}>
                          {view.name}
                        </Text>
                        {view.is_shared && (
                          <Badge size="xs" variant="light" color="blue">
                            <Group gap={4}>
                              <IconShare size={10} />
                              Shared
                            </Group>
                          </Badge>
                        )}
                      </Group>
                      <Text size="xs" c="dimmed" lineClamp={1}>
                        {view.description || formatViewLabel(view)}
                      </Text>
                    </Stack>
                    <Menu position="bottom-end" withinPortal>
                      <Menu.Target>
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <IconDots size={16} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item
                          leftSection={
                            view.is_shared ? <IconCheck size={14} /> : <IconShare size={14} />
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleShare(view);
                          }}
                        >
                          {view.is_shared ? "Unshare" : "Share with team"}
                        </Menu.Item>
                        <Menu.Item
                          leftSection={<IconTrash size={14} />}
                          color="red"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteView(view.id);
                          }}
                        >
                          Delete
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Group>
                </UnstyledButton>
              ))}
            </Stack>
          )}

          {/* Shared Views */}
          {sharedViews.length > 0 && (
            <Stack gap="xs">
              <Text size="sm" fw={600} c="dimmed">
                Team Views
              </Text>
              {sharedViews.map((view) => (
                <UnstyledButton
                  key={view.id}
                  onClick={() => onLoadView(view)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "4px",
                    border: "1px solid var(--mantine-color-gray-3)",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      "var(--mantine-color-gray-0)";
                    e.currentTarget.style.borderColor =
                      "var(--mantine-color-blue-4)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.borderColor =
                      "var(--mantine-color-gray-3)";
                  }}
                >
                  <Stack gap={4}>
                    <Group gap="xs">
                      <Text size="sm" fw={600}>
                        {view.name}
                      </Text>
                      <Badge size="xs" variant="light" color="blue">
                        Team
                      </Badge>
                    </Group>
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {view.description || formatViewLabel(view)}
                    </Text>
                    {view.use_count > 0 && (
                      <Text size="xs" c="dimmed">
                        Used {view.use_count} times
                      </Text>
                    )}
                  </Stack>
                </UnstyledButton>
              ))}
            </Stack>
          )}

          {/* Empty state */}
          {views.length === 0 && !isLoading && (
            <Text size="sm" c="dimmed" ta="center" py="md">
              No saved views yet. Configure your filters and save them for quick
              access.
            </Text>
          )}
        </Stack>
      </Paper>

      {/* Save View Modal */}
      <Modal
        opened={saveModalOpen}
        onClose={() => {
          setSaveModalOpen(false);
          setViewName("");
          setViewDescription("");
          setIsShared(false);
        }}
        title="Save Current View"
        centered
      >
        <Stack gap="md">
          <TextInput
            label="View Name"
            placeholder="e.g., Education grants due soon"
            value={viewName}
            onChange={(e) => setViewName(e.target.value)}
            required
          />
          <Textarea
            label="Description (optional)"
            placeholder="Add a description to help remember what this view is for"
            value={viewDescription}
            onChange={(e) => setViewDescription(e.target.value)}
            rows={3}
          />
          <Checkbox
            label="Share with my organization"
            description="Team members will be able to use this saved view"
            checked={isShared}
            onChange={(e) => setIsShared(e.currentTarget.checked)}
          />

          <Group justify="flex-end" gap="sm">
            <Button
              variant="subtle"
              onClick={() => {
                setSaveModalOpen(false);
                setViewName("");
                setViewDescription("");
                setIsShared(false);
              }}
            >
              Cancel
            </Button>
            <Button
              color="grape"
              onClick={handleSaveView}
              loading={saving}
              disabled={!viewName.trim()}
            >
              Save View
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
