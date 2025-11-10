import { useState } from "react";
import {
  Stack,
  Group,
  Text,
  Checkbox,
  Badge,
  ActionIcon,
  Button,
  TextInput,
  Textarea,
  Select,
  Modal,
  Menu,
  Progress,
  Box,
} from "@mantine/core";
import {
  IconPlus,
  IconDots,
  IconEdit,
  IconTrash,
  IconCalendar,
  IconUser,
  IconCheck,
} from "@tabler/icons-react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import dayjs from "dayjs";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

interface Task {
  id: string;
  grant_id: string;
  org_id: string;
  title: string;
  description?: string;
  task_type: string;
  status: "pending" | "in_progress" | "completed" | "blocked";
  assigned_to?: string;
  due_date?: string;
  completed_at?: string;
  position: number;
  is_required: boolean;
  notes?: string;
  created_at: string;
}

interface TaskListProps {
  grantId: string;
  orgId: string;
}

const TASK_TYPE_COLORS: Record<string, string> = {
  research: "blue",
  budget: "green",
  narrative: "grape",
  letters: "orange",
  documents: "cyan",
  submission: "red",
  custom: "gray",
};

const TASK_TYPE_LABELS: Record<string, string> = {
  research: "Research",
  budget: "Budget",
  narrative: "Narrative",
  letters: "Letters",
  documents: "Documents",
  submission: "Submission",
  custom: "Custom",
};

export function TaskList({ grantId, orgId }: TaskListProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [addModalOpened, setAddModalOpened] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    task_type: "custom",
    due_date: "",
    assigned_to: "",
  });

  // Fetch team members for assignment
  const { data: teamMembers } = useQuery({
    queryKey: ["teamMembers", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("org_members")
        .select(`
          user_id,
          role,
          user_profiles (
            id,
            full_name
          )
        `)
        .eq("org_id", orgId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });

  // Fetch tasks
  const { data: tasksData, isLoading } = useQuery({
    queryKey: ["grant-tasks", grantId],
    queryFn: async () => {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const res = await fetch(`/api/tasks?grant_id=${grantId}&org_id=${orgId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) throw new Error("Failed to fetch tasks");
      return res.json();
    },
  });

  const tasks: Task[] = tasksData?.tasks || [];

  // Calculate completion percentage
  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const totalCount = tasks.length;
  const completionPercentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (taskData: any) => {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          ...taskData,
          grant_id: grantId,
          org_id: orgId,
          created_by: user?.id,
          position: tasks.length + 1,
        }),
      });
      if (!res.ok) throw new Error("Failed to create task");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grant-tasks", grantId] });
      notifications.show({
        title: "Success",
        message: "Task created successfully",
        color: "green",
      });
      setAddModalOpened(false);
      setNewTask({ title: "", description: "", task_type: "custom", due_date: "", assigned_to: "" });
    },
    onError: () => {
      notifications.show({
        title: "Error",
        message: "Failed to create task",
        color: "red",
      });
    },
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const res = await fetch(`/api/tasks?id=${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update task");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grant-tasks", grantId] });
      notifications.show({
        title: "Success",
        message: "Task updated successfully",
        color: "green",
      });
      setEditingTask(null);
    },
    onError: () => {
      notifications.show({
        title: "Error",
        message: "Failed to update task",
        color: "red",
      });
    },
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const res = await fetch(`/api/tasks?id=${id}`, {
        method: "DELETE",
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) throw new Error("Failed to delete task");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grant-tasks", grantId] });
      notifications.show({
        title: "Success",
        message: "Task deleted successfully",
        color: "green",
      });
    },
    onError: () => {
      notifications.show({
        title: "Error",
        message: "Failed to delete task",
        color: "red",
      });
    },
  });

  const handleToggleComplete = (task: Task) => {
    const newStatus = task.status === "completed" ? "pending" : "completed";
    updateTaskMutation.mutate({
      id: task.id,
      updates: { status: newStatus },
    });
  };

  const handleAddTask = () => {
    if (!newTask.title.trim()) {
      notifications.show({
        title: "Error",
        message: "Task title is required",
        color: "red",
      });
      return;
    }
    createTaskMutation.mutate(newTask);
  };

  if (isLoading) {
    return <Text size="sm" c="dimmed">Loading tasks...</Text>;
  }

  return (
    <Stack gap="md">
      {/* Progress Bar */}
      {totalCount > 0 && (
        <Box>
          <Group justify="space-between" mb={5}>
            <Text size="sm" fw={500}>
              Task Progress
            </Text>
            <Text size="sm" c="dimmed">
              {completedCount} / {totalCount} completed
            </Text>
          </Group>
          <Progress value={completionPercentage} size="lg" radius="md" />
        </Box>
      )}

      {/* Task List */}
      <Stack gap="xs">
        {tasks.map((task) => (
          <Group
            key={task.id}
            wrap="nowrap"
            align="flex-start"
            p="sm"
            style={{
              border: "1px solid var(--mantine-color-gray-3)",
              borderRadius: "var(--mantine-radius-md)",
              backgroundColor:
                task.status === "completed"
                  ? "var(--mantine-color-gray-0)"
                  : "white",
            }}
          >
            <Checkbox
              checked={task.status === "completed"}
              onChange={() => handleToggleComplete(task)}
              size="md"
              mt={2}
            />
            <Stack gap={4} style={{ flex: 1 }}>
              <Group gap="xs">
                <Text
                  size="sm"
                  fw={500}
                  td={task.status === "completed" ? "line-through" : undefined}
                  c={task.status === "completed" ? "dimmed" : undefined}
                >
                  {task.title}
                  {task.is_required && (
                    <Text component="span" c="red" ml={4}>
                      *
                    </Text>
                  )}
                </Text>
                <Badge
                  size="xs"
                  color={TASK_TYPE_COLORS[task.task_type] || "gray"}
                  variant="light"
                >
                  {TASK_TYPE_LABELS[task.task_type] || task.task_type}
                </Badge>
                {task.status === "completed" && (
                  <Badge size="xs" color="green" variant="light" leftSection={<IconCheck size={12} />}>
                    Done
                  </Badge>
                )}
              </Group>
              {task.description && (
                <Text size="xs" c="dimmed">
                  {task.description}
                </Text>
              )}
              <Group gap="md">
                {task.due_date && (
                  <Group gap={4}>
                    <IconCalendar size={14} style={{ color: "var(--mantine-color-gray-6)" }} />
                    <Text size="xs" c="dimmed">
                      Due {dayjs(task.due_date).format("MMM D, YYYY")}
                    </Text>
                  </Group>
                )}
                {task.assigned_to && (
                  <Group gap={4}>
                    <IconUser size={14} style={{ color: "var(--mantine-color-gray-6)" }} />
                    <Text size="xs" c="dimmed">
                      {(() => {
                        const member = teamMembers?.find((m: any) => m.user_id === task.assigned_to);
                        return (member as any)?.user_profiles?.full_name || "Assigned";
                      })()}
                    </Text>
                  </Group>
                )}
              </Group>
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
                  onClick={() => setEditingTask(task)}
                >
                  Edit
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconTrash size={14} />}
                  color="red"
                  onClick={() => {
                    if (confirm("Are you sure you want to delete this task?")) {
                      deleteTaskMutation.mutate(task.id);
                    }
                  }}
                >
                  Delete
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        ))}
      </Stack>

      {/* Add Task Button */}
      <Button
        leftSection={<IconPlus size={16} />}
        variant="light"
        onClick={() => setAddModalOpened(true)}
        fullWidth
      >
        Add Task
      </Button>

      {/* Add Task Modal */}
      <Modal
        opened={addModalOpened}
        onClose={() => setAddModalOpened(false)}
        title="Add New Task"
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label="Task Title"
            placeholder="Enter task title"
            required
            value={newTask.title}
            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
          />
          <Textarea
            label="Description"
            placeholder="Optional task description"
            value={newTask.description}
            onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
            rows={3}
          />
          <Select
            label="Task Type"
            value={newTask.task_type}
            onChange={(value) => setNewTask({ ...newTask, task_type: value || "custom" })}
            data={[
              { value: "research", label: "Research" },
              { value: "budget", label: "Budget" },
              { value: "narrative", label: "Narrative" },
              { value: "letters", label: "Letters of Support" },
              { value: "documents", label: "Documents" },
              { value: "submission", label: "Submission" },
              { value: "custom", label: "Custom" },
            ]}
          />
          <TextInput
            label="Due Date"
            type="date"
            value={newTask.due_date}
            onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
          />
          <Select
            label="Assign To"
            placeholder="Select team member"
            clearable
            value={newTask.assigned_to}
            onChange={(value) => setNewTask({ ...newTask, assigned_to: value || "" })}
            data={
              teamMembers?.map((m: any) => ({
                value: m.user_id,
                label: m.user_profiles?.full_name || "Unknown",
              })) || []
            }
          />
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setAddModalOpened(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddTask} loading={createTaskMutation.isPending}>
              Add Task
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Edit Task Modal */}
      {editingTask && (
        <Modal
          opened={!!editingTask}
          onClose={() => setEditingTask(null)}
          title="Edit Task"
          size="md"
        >
          <Stack gap="md">
            <TextInput
              label="Task Title"
              placeholder="Enter task title"
              required
              value={editingTask.title}
              onChange={(e) =>
                setEditingTask({ ...editingTask, title: e.target.value })
              }
            />
            <Textarea
              label="Description"
              placeholder="Optional task description"
              value={editingTask.description || ""}
              onChange={(e) =>
                setEditingTask({ ...editingTask, description: e.target.value })
              }
              rows={3}
            />
            <Select
              label="Task Type"
              value={editingTask.task_type}
              onChange={(value) =>
                setEditingTask({ ...editingTask, task_type: value || "custom" })
              }
              data={[
                { value: "research", label: "Research" },
                { value: "budget", label: "Budget" },
                { value: "narrative", label: "Narrative" },
                { value: "letters", label: "Letters of Support" },
                { value: "documents", label: "Documents" },
                { value: "submission", label: "Submission" },
                { value: "custom", label: "Custom" },
              ]}
            />
            <TextInput
              label="Due Date"
              type="date"
              value={editingTask.due_date || ""}
              onChange={(e) =>
                setEditingTask({ ...editingTask, due_date: e.target.value })
              }
            />
            <Select
              label="Status"
              value={editingTask.status}
              onChange={(value) =>
                setEditingTask({
                  ...editingTask,
                  status: value as Task["status"],
                })
              }
              data={[
                { value: "pending", label: "Pending" },
                { value: "in_progress", label: "In Progress" },
                { value: "completed", label: "Completed" },
                { value: "blocked", label: "Blocked" },
              ]}
            />
            <Select
              label="Assign To"
              placeholder="Select team member"
              clearable
              value={editingTask.assigned_to || ""}
              onChange={(value) =>
                setEditingTask({
                  ...editingTask,
                  assigned_to: value || undefined,
                })
              }
              data={
                teamMembers?.map((m: any) => ({
                  value: m.user_id,
                  label: m.user_profiles?.full_name || "Unknown",
                })) || []
              }
            />
            <Group justify="flex-end" mt="md">
              <Button variant="subtle" onClick={() => setEditingTask(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  updateTaskMutation.mutate({
                    id: editingTask.id,
                    updates: {
                      title: editingTask.title,
                      description: editingTask.description,
                      task_type: editingTask.task_type,
                      due_date: editingTask.due_date,
                      status: editingTask.status,
                      assigned_to: editingTask.assigned_to,
                    },
                  });
                }}
                loading={updateTaskMutation.isPending}
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
