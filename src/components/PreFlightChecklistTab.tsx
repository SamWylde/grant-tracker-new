import { useState } from "react";
import {
  Stack,
  Group,
  Text,
  Button,
  Checkbox,
  Badge,
  Progress,
  Paper,
  Title,
  Divider,
  Loader,
  Center,
  Alert,
  ActionIcon,
  Menu,
  Modal,
  TextInput,
  Textarea,
  Select,
  Accordion,
  ThemeIcon,
} from "@mantine/core";
import {
  IconSparkles,
  IconCheck,
  IconAlertCircle,
  IconDots,
  IconEdit,
  IconTrash,
  IconPlus,
  IconCalendar,
  IconFileText,
  IconShieldCheck,
  IconCurrencyDollar,
  IconBulb,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import dayjs from "dayjs";
import { supabase } from "../lib/supabase";

interface ChecklistItem {
  id: string;
  checklist_id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  position: number;
  is_required: boolean;
  completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
  source_text: string | null;
  ai_generated: boolean;
  confidence_score: number | null;
  created_at: string;
  updated_at: string;
}

interface ChecklistStats {
  total_items: number;
  completed_items: number;
  required_items: number;
  required_completed: number;
  completion_percentage: number;
}

interface PreFlightChecklistTabProps {
  grantId: string;
  orgId: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  eligibility: "Eligibility Verification",
  match_requirements: "Match Requirements",
  required_attachments: "Required Attachments",
  deadlines: "Deadlines",
  compliance: "Compliance",
  budget: "Budget Preparation",
  custom: "Additional Items",
};

const CATEGORY_ICONS: Record<string, any> = {
  eligibility: IconShieldCheck,
  match_requirements: IconCurrencyDollar,
  required_attachments: IconFileText,
  deadlines: IconCalendar,
  compliance: IconAlertCircle,
  budget: IconCurrencyDollar,
  custom: IconBulb,
};

const CATEGORY_COLORS: Record<string, string> = {
  eligibility: "blue",
  match_requirements: "orange",
  required_attachments: "cyan",
  deadlines: "red",
  compliance: "grape",
  budget: "green",
  custom: "gray",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "gray",
  medium: "blue",
  high: "orange",
  critical: "red",
};

export function PreFlightChecklistTab({ grantId, orgId }: PreFlightChecklistTabProps) {
  const queryClient = useQueryClient();
  const [addItemModalOpened, setAddItemModalOpened] = useState(false);
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null);
  const [newItem, setNewItem] = useState({
    title: "",
    description: "",
    category: "custom",
    priority: "medium",
    is_required: true,
  });

  // Fetch checklist data
  const { data: checklistData, isLoading: isLoadingChecklist } = useQuery({
    queryKey: ["preflight-checklist", grantId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(`/api/preflight-checklist?grant_id=${grantId}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.status === 404) {
        return { has_checklist: false, checklist: null, items: [], stats: null };
      }

      if (!response.ok) throw new Error("Failed to fetch checklist");

      return response.json();
    },
    enabled: !!grantId,
  });

  // Generate AI checklist mutation
  const generateChecklistMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch("/api/preflight-checklist/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ grant_id: grantId, org_id: orgId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate checklist");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preflight-checklist", grantId] });
      notifications.show({
        title: "Success",
        message: "Pre-flight checklist generated successfully",
        color: "green",
      });
    },
    onError: (error) => {
      notifications.show({
        title: "Error",
        message: error instanceof Error ? error.message : "Failed to generate checklist",
        color: "red",
      });
    },
  });

  // Toggle item completion mutation
  const toggleItemMutation = useMutation({
    mutationFn: async ({ itemId, completed }: { itemId: string; completed: boolean }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(`/api/preflight-checklist?id=${itemId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ completed }),
      });

      if (!response.ok) throw new Error("Failed to update item");

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preflight-checklist", grantId] });
    },
    onError: () => {
      notifications.show({
        title: "Error",
        message: "Failed to update checklist item",
        color: "red",
      });
    },
  });

  // Add custom item mutation
  const addItemMutation = useMutation({
    mutationFn: async (itemData: any) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch("/api/preflight-checklist/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          checklist_id: checklistData.checklist.id,
          ...itemData,
        }),
      });

      if (!response.ok) throw new Error("Failed to add item");

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preflight-checklist", grantId] });
      notifications.show({
        title: "Success",
        message: "Checklist item added successfully",
        color: "green",
      });
      setAddItemModalOpened(false);
      setNewItem({ title: "", description: "", category: "custom", priority: "medium", is_required: true });
    },
    onError: () => {
      notifications.show({
        title: "Error",
        message: "Failed to add checklist item",
        color: "red",
      });
    },
  });

  // Update item mutation
  const updateItemMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(`/api/preflight-checklist?id=${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) throw new Error("Failed to update item");

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preflight-checklist", grantId] });
      notifications.show({
        title: "Success",
        message: "Checklist item updated successfully",
        color: "green",
      });
      setEditingItem(null);
    },
    onError: () => {
      notifications.show({
        title: "Error",
        message: "Failed to update checklist item",
        color: "red",
      });
    },
  });

  // Delete item mutation
  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(`/api/preflight-checklist/items?id=${itemId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) throw new Error("Failed to delete item");

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preflight-checklist", grantId] });
      notifications.show({
        title: "Success",
        message: "Checklist item deleted successfully",
        color: "green",
      });
    },
    onError: () => {
      notifications.show({
        title: "Error",
        message: "Failed to delete checklist item",
        color: "red",
      });
    },
  });

  const handleToggleItem = (item: ChecklistItem) => {
    toggleItemMutation.mutate({ itemId: item.id, completed: !item.completed });
  };

  const handleAddItem = () => {
    if (!newItem.title.trim()) {
      notifications.show({
        title: "Error",
        message: "Item title is required",
        color: "red",
      });
      return;
    }
    addItemMutation.mutate(newItem);
  };

  const handleDeleteItem = (itemId: string) => {
    if (confirm("Are you sure you want to delete this checklist item?")) {
      deleteItemMutation.mutate(itemId);
    }
  };

  // Loading state
  if (isLoadingChecklist) {
    return (
      <Center py="xl">
        <Loader size="lg" />
      </Center>
    );
  }

  // No checklist exists - show generate option
  if (!checklistData?.has_checklist) {
    return (
      <Stack gap="md">
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="No Pre-Flight Checklist"
          color="blue"
        >
          Generate an AI-powered pre-flight checklist to ensure you have all required documents and meet all eligibility criteria before submitting your application.
        </Alert>

        <Paper p="md" withBorder>
          <Stack gap="md">
            <Group>
              <ThemeIcon size="xl" variant="light" color="blue">
                <IconSparkles size={24} />
              </ThemeIcon>
              <div>
                <Title order={4}>AI-Powered Pre-Flight Checklist</Title>
                <Text size="sm" c="dimmed">
                  Automatically generate a comprehensive checklist from the NOFO analysis
                </Text>
              </div>
            </Group>

            <Text size="sm">
              The checklist will include:
            </Text>
            <Stack gap="xs" ml="md">
              <Text size="sm">✓ Eligibility verification items</Text>
              <Text size="sm">✓ Match requirements documentation</Text>
              <Text size="sm">✓ Required attachments list</Text>
              <Text size="sm">✓ Deadline tracking</Text>
              <Text size="sm">✓ Compliance requirements</Text>
              <Text size="sm">✓ Budget preparation items</Text>
            </Stack>

            <Button
              leftSection={<IconSparkles size={16} />}
              onClick={() => generateChecklistMutation.mutate()}
              loading={generateChecklistMutation.isPending}
              size="md"
            >
              Generate Pre-Flight Checklist
            </Button>
          </Stack>
        </Paper>
      </Stack>
    );
  }

  const items: ChecklistItem[] = checklistData.items || [];
  const stats: ChecklistStats | null = checklistData.stats;

  // Group items by category
  const itemsByCategory = items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, ChecklistItem[]>);

  return (
    <Stack gap="md">
      {/* Progress Overview */}
      {stats && (
        <Paper p="md" withBorder>
          <Stack gap="sm">
            <Group justify="space-between">
              <Text size="sm" fw={500}>
                Overall Progress
              </Text>
              <Text size="sm" c="dimmed">
                {stats.completed_items} / {stats.total_items} completed
              </Text>
            </Group>
            <Progress
              value={stats.completion_percentage}
              size="lg"
              radius="md"
              color={stats.completion_percentage === 100 ? "green" : "blue"}
            />
            {stats.required_items > 0 && (
              <Group gap="xs">
                <IconAlertTriangle size={16} style={{ color: "var(--mantine-color-orange-6)" }} />
                <Text size="xs" c="dimmed">
                  {stats.required_completed} / {stats.required_items} required items completed
                </Text>
              </Group>
            )}
          </Stack>
        </Paper>
      )}

      {/* AI Generation Badge */}
      {checklistData.checklist?.ai_generated && (
        <Alert icon={<IconSparkles size={16} />} color="blue" variant="light">
          This checklist was automatically generated from the NOFO summary using AI.
          {checklistData.checklist.generated_at && (
            <Text size="xs" c="dimmed" mt={4}>
              Generated on {dayjs(checklistData.checklist.generated_at).format("MMM D, YYYY")}
            </Text>
          )}
        </Alert>
      )}

      {/* Checklist Items by Category */}
      <Accordion variant="separated" defaultValue={Object.keys(itemsByCategory)[0]}>
        {Object.entries(itemsByCategory).map(([category, categoryItems]) => {
          const Icon = CATEGORY_ICONS[category] || IconBulb;
          const completedCount = categoryItems.filter((i) => i.completed).length;

          return (
            <Accordion.Item key={category} value={category}>
              <Accordion.Control>
                <Group justify="space-between" wrap="nowrap">
                  <Group gap="sm">
                    <ThemeIcon
                      size="md"
                      variant="light"
                      color={CATEGORY_COLORS[category] || "gray"}
                    >
                      <Icon size={16} />
                    </ThemeIcon>
                    <div>
                      <Text size="sm" fw={500}>
                        {CATEGORY_LABELS[category] || category}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {completedCount} / {categoryItems.length} completed
                      </Text>
                    </div>
                  </Group>
                  <Badge
                    size="sm"
                    color={completedCount === categoryItems.length ? "green" : "gray"}
                  >
                    {Math.round((completedCount / categoryItems.length) * 100)}%
                  </Badge>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap="xs">
                  {categoryItems.map((item) => (
                    <Paper
                      key={item.id}
                      p="sm"
                      withBorder
                      style={{
                        backgroundColor: item.completed
                          ? "var(--mantine-color-gray-0)"
                          : "white",
                      }}
                    >
                      <Group align="flex-start" wrap="nowrap">
                        <Checkbox
                          checked={item.completed}
                          onChange={() => handleToggleItem(item)}
                          size="md"
                          mt={2}
                        />
                        <Stack gap={4} style={{ flex: 1 }}>
                          <Group gap="xs">
                            <Text
                              size="sm"
                              fw={500}
                              td={item.completed ? "line-through" : undefined}
                              c={item.completed ? "dimmed" : undefined}
                            >
                              {item.title}
                              {item.is_required && (
                                <Text component="span" c="red" ml={4}>
                                  *
                                </Text>
                              )}
                            </Text>
                            <Badge
                              size="xs"
                              color={PRIORITY_COLORS[item.priority]}
                              variant="light"
                            >
                              {item.priority}
                            </Badge>
                            {item.ai_generated && (
                              <Badge size="xs" color="blue" variant="light">
                                AI
                              </Badge>
                            )}
                            {item.completed && (
                              <Badge
                                size="xs"
                                color="green"
                                variant="light"
                                leftSection={<IconCheck size={12} />}
                              >
                                Done
                              </Badge>
                            )}
                          </Group>
                          {item.description && (
                            <Text size="xs" c="dimmed">
                              {item.description}
                            </Text>
                          )}
                          {item.completed_at && (
                            <Text size="xs" c="dimmed">
                              Completed on {dayjs(item.completed_at).format("MMM D, YYYY")}
                            </Text>
                          )}
                        </Stack>
                        <Menu position="bottom-end" withinPortal>
                          <Menu.Target>
                            <ActionIcon variant="subtle" color="gray">
                              <IconDots size={16} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item
                              leftSection={<IconEdit size={14} />}
                              onClick={() => setEditingItem(item)}
                            >
                              Edit
                            </Menu.Item>
                            <Menu.Item
                              leftSection={<IconTrash size={14} />}
                              color="red"
                              onClick={() => handleDeleteItem(item.id)}
                            >
                              Delete
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          );
        })}
      </Accordion>

      <Divider />

      {/* Add Custom Item Button */}
      <Button
        leftSection={<IconPlus size={16} />}
        variant="light"
        onClick={() => setAddItemModalOpened(true)}
        fullWidth
      >
        Add Custom Item
      </Button>

      {/* Add Item Modal */}
      <Modal
        opened={addItemModalOpened}
        onClose={() => setAddItemModalOpened(false)}
        title="Add Checklist Item"
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label="Item Title"
            placeholder="Enter item title"
            required
            value={newItem.title}
            onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
          />
          <Textarea
            label="Description"
            placeholder="Optional description"
            value={newItem.description}
            onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
            rows={3}
          />
          <Select
            label="Category"
            value={newItem.category}
            onChange={(value) => setNewItem({ ...newItem, category: value || "custom" })}
            data={[
              { value: "eligibility", label: "Eligibility Verification" },
              { value: "match_requirements", label: "Match Requirements" },
              { value: "required_attachments", label: "Required Attachments" },
              { value: "deadlines", label: "Deadlines" },
              { value: "compliance", label: "Compliance" },
              { value: "budget", label: "Budget Preparation" },
              { value: "custom", label: "Custom" },
            ]}
          />
          <Select
            label="Priority"
            value={newItem.priority}
            onChange={(value) => setNewItem({ ...newItem, priority: value || "medium" })}
            data={[
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
              { value: "critical", label: "Critical" },
            ]}
          />
          <Checkbox
            label="Required item"
            checked={newItem.is_required}
            onChange={(e) => setNewItem({ ...newItem, is_required: e.currentTarget.checked })}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setAddItemModalOpened(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddItem} loading={addItemMutation.isPending}>
              Add Item
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Edit Item Modal */}
      {editingItem && (
        <Modal
          opened={!!editingItem}
          onClose={() => setEditingItem(null)}
          title="Edit Checklist Item"
          size="md"
        >
          <Stack gap="md">
            <TextInput
              label="Item Title"
              placeholder="Enter item title"
              required
              value={editingItem.title}
              onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
            />
            <Textarea
              label="Description"
              placeholder="Optional description"
              value={editingItem.description || ""}
              onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
              rows={3}
            />
            <Select
              label="Priority"
              value={editingItem.priority}
              onChange={(value) =>
                setEditingItem({ ...editingItem, priority: value || "medium" })
              }
              data={[
                { value: "low", label: "Low" },
                { value: "medium", label: "Medium" },
                { value: "high", label: "High" },
                { value: "critical", label: "Critical" },
              ]}
            />
            <Textarea
              label="Notes"
              placeholder="Add notes about this item"
              value={editingItem.notes || ""}
              onChange={(e) => setEditingItem({ ...editingItem, notes: e.target.value })}
              rows={3}
            />
            <Group justify="flex-end" mt="md">
              <Button variant="subtle" onClick={() => setEditingItem(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  updateItemMutation.mutate({
                    id: editingItem.id,
                    updates: {
                      title: editingItem.title,
                      description: editingItem.description,
                      priority: editingItem.priority,
                      notes: editingItem.notes,
                    },
                  });
                }}
                loading={updateItemMutation.isPending}
              >
                Save Changes
              </Button>
            </Group>
          </Stack>
        </Modal>
      )}
    </Stack>
  );
}
