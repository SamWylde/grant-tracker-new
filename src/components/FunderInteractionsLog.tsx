import {
  Stack,
  Group,
  Text,
  Button,
  Modal,
  Select,
  Textarea,
  ActionIcon,
  Box,
  Menu,
  Badge,
} from "@mantine/core";
import {
  IconPlus,
  IconMail,
  IconPhone,
  IconCalendar,
  IconUsers,
  IconMapPin,
  IconDots,
  IconEdit,
  IconTrash,
} from "@tabler/icons-react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { DateTimePicker } from "@mantine/dates";
import { supabase } from "../lib/supabase";
import { useOrganization } from "../contexts/OrganizationContext";
import { notifications } from "@mantine/notifications";

interface FunderInteractionsLogProps {
  funderId: string | null;
}

interface Contact {
  id: string;
  name: string;
}

interface Interaction {
  id: string;
  org_id: string;
  funder_id: string;
  contact_id: string | null;
  user_id: string;
  interaction_type: string;
  interaction_date: string;
  notes: string;
  created_at: string;
  contact: Contact | null;
  user: {
    user_id: string;
    full_name: string;
  } | null;
}

const INTERACTION_TYPES = [
  { value: "email", label: "Email", icon: IconMail },
  { value: "phone_call", label: "Phone Call", icon: IconPhone },
  { value: "meeting", label: "Meeting", icon: IconCalendar },
  { value: "conference", label: "Conference", icon: IconUsers },
  { value: "site_visit", label: "Site Visit", icon: IconMapPin },
  { value: "other", label: "Other", icon: IconDots },
];

export function FunderInteractionsLog({ funderId }: FunderInteractionsLogProps) {
  const { currentOrg } = useOrganization();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingInteraction, setEditingInteraction] = useState<Interaction | null>(null);

  const [formData, setFormData] = useState<{
    interaction_type: string;
    interaction_date: Date | string;
    contact_id: string;
    notes: string;
  }>({
    interaction_type: "",
    interaction_date: new Date(),
    contact_id: "",
    notes: "",
  });

  // Fetch interactions
  const { data: interactions, isLoading } = useQuery<Interaction[]>({
    queryKey: ["funder-interactions", funderId],
    queryFn: async () => {
      if (!funderId || !currentOrg?.id) throw new Error("Missing required data");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `/api/funder-interactions?org_id=${currentOrg.id}&funder_id=${funderId}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch interactions");
      }

      const result = await response.json();
      return result.interactions;
    },
    enabled: !!funderId && !!currentOrg?.id,
  });

  // Fetch contacts for this funder
  const { data: contacts } = useQuery<Contact[]>({
    queryKey: ["contacts", funderId],
    queryFn: async () => {
      if (!funderId || !currentOrg?.id) throw new Error("Missing required data");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `/api/contacts?org_id=${currentOrg.id}&funder_id=${funderId}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch contacts");
      }

      const result = await response.json();
      return result.contacts;
    },
    enabled: !!funderId && !!currentOrg?.id,
  });

  // Create interaction mutation
  const createInteractionMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!currentOrg?.id || !funderId) throw new Error("Missing required data");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch('/api/funder-interactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          org_id: currentOrg.id,
          funder_id: funderId,
          interaction_type: data.interaction_type,
          interaction_date: typeof data.interaction_date === 'string'
            ? new Date(data.interaction_date).toISOString()
            : data.interaction_date.toISOString(),
          contact_id: data.contact_id || null,
          notes: data.notes,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create interaction");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funder-interactions", funderId] });
      queryClient.invalidateQueries({ queryKey: ["funder", funderId] });
      setModalOpen(false);
      resetForm();
      notifications.show({
        title: "Success",
        message: "Interaction logged successfully",
        color: "green",
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: "Error",
        message: error.message,
        color: "red",
      });
    },
  });

  // Update interaction mutation
  const updateInteractionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(`/api/funder-interactions?id=${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          interaction_type: data.interaction_type,
          interaction_date: data.interaction_date
            ? (typeof data.interaction_date === 'string'
              ? new Date(data.interaction_date).toISOString()
              : data.interaction_date.toISOString())
            : undefined,
          contact_id: data.contact_id || null,
          notes: data.notes,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update interaction");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funder-interactions", funderId] });
      queryClient.invalidateQueries({ queryKey: ["funder", funderId] });
      setModalOpen(false);
      setEditingInteraction(null);
      resetForm();
      notifications.show({
        title: "Success",
        message: "Interaction updated successfully",
        color: "green",
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: "Error",
        message: error.message,
        color: "red",
      });
    },
  });

  // Delete interaction mutation
  const deleteInteractionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(`/api/funder-interactions?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete interaction");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funder-interactions", funderId] });
      queryClient.invalidateQueries({ queryKey: ["funder", funderId] });
      notifications.show({
        title: "Success",
        message: "Interaction deleted successfully",
        color: "green",
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: "Error",
        message: error.message,
        color: "red",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      interaction_type: "",
      interaction_date: new Date(),
      contact_id: "",
      notes: "",
    });
  };

  const handleOpenCreate = () => {
    resetForm();
    setEditingInteraction(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (interaction: Interaction) => {
    setFormData({
      interaction_type: interaction.interaction_type,
      interaction_date: new Date(interaction.interaction_date),
      contact_id: interaction.contact_id || "",
      notes: interaction.notes,
    });
    setEditingInteraction(interaction);
    setModalOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.interaction_type || !formData.notes.trim()) {
      notifications.show({
        title: "Validation Error",
        message: "Interaction type and notes are required",
        color: "red",
      });
      return;
    }

    if (editingInteraction) {
      updateInteractionMutation.mutate({ id: editingInteraction.id, data: formData });
    } else {
      createInteractionMutation.mutate(formData);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this interaction?")) {
      deleteInteractionMutation.mutate(id);
    }
  };

  const getInteractionIcon = (type: string) => {
    const typeData = INTERACTION_TYPES.find((t) => t.value === type);
    if (!typeData) return IconDots;
    return typeData.icon;
  };

  const getInteractionLabel = (type: string) => {
    const typeData = INTERACTION_TYPES.find((t) => t.value === type);
    return typeData?.label || type;
  };

  return (
    <>
      <Stack gap="md">
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={handleOpenCreate}
          fullWidth
        >
          Log Interaction
        </Button>

        {isLoading ? (
          <Text c="dimmed" ta="center" py="md">
            Loading interactions...
          </Text>
        ) : interactions && interactions.length > 0 ? (
          <Stack gap="sm">
            {interactions.map((interaction) => {
              const InteractionIcon = getInteractionIcon(interaction.interaction_type);
              return (
                <Box
                  key={interaction.id}
                  p="md"
                  style={(theme) => ({
                    border: `1px solid ${theme.colors.gray[3]}`,
                    borderRadius: theme.radius.md,
                  })}
                >
                  <Group justify="space-between" align="flex-start">
                    <Stack gap="xs" style={{ flex: 1 }}>
                      <Group gap="sm">
                        <InteractionIcon size={16} style={{ opacity: 0.6 }} />
                        <Badge variant="light">
                          {getInteractionLabel(interaction.interaction_type)}
                        </Badge>
                        <Text size="sm" c="dimmed">
                          {new Date(interaction.interaction_date).toLocaleDateString()}
                        </Text>
                      </Group>
                      {interaction.contact && (
                        <Text size="sm" c="dimmed">
                          With: {interaction.contact.name}
                        </Text>
                      )}
                      <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                        {interaction.notes}
                      </Text>
                      {interaction.user && (
                        <Text size="xs" c="dimmed">
                          Logged by: {interaction.user.full_name}
                        </Text>
                      )}
                    </Stack>
                    <Menu position="bottom-end" withinPortal>
                      <Menu.Target>
                        <ActionIcon variant="subtle">
                          <IconDots size={18} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item
                          leftSection={<IconEdit size={16} />}
                          onClick={() => handleOpenEdit(interaction)}
                        >
                          Edit
                        </Menu.Item>
                        <Menu.Item
                          leftSection={<IconTrash size={16} />}
                          color="red"
                          onClick={() => handleDelete(interaction.id)}
                        >
                          Delete
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Group>
                </Box>
              );
            })}
          </Stack>
        ) : (
          <Text c="dimmed" ta="center" py="md">
            No interactions logged yet. Add your first interaction to get started.
          </Text>
        )}
      </Stack>

      {/* Create/Edit Interaction Modal */}
      <Modal
        opened={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingInteraction(null);
          resetForm();
        }}
        title={editingInteraction ? "Edit Interaction" : "Log Interaction"}
        size="md"
      >
        <Stack gap="md">
          <Select
            label="Interaction Type"
            placeholder="Select type"
            required
            data={INTERACTION_TYPES.map((type) => ({
              value: type.value,
              label: type.label,
            }))}
            value={formData.interaction_type}
            onChange={(value) =>
              setFormData({ ...formData, interaction_type: value || "" })
            }
          />
          <DateTimePicker
            label="Date & Time"
            placeholder="Select date and time"
            required
            value={formData.interaction_date}
            onChange={(value) =>
              setFormData({ ...formData, interaction_date: value || new Date() })
            }
          />
          <Select
            label="Contact (Optional)"
            placeholder="Select contact"
            clearable
            data={
              contacts?.map((contact) => ({
                value: contact.id,
                label: contact.name,
              })) || []
            }
            value={formData.contact_id}
            onChange={(value) =>
              setFormData({ ...formData, contact_id: value || "" })
            }
          />
          <Textarea
            label="Notes"
            placeholder="Describe what was discussed, next steps, etc."
            required
            rows={5}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />
          <Group justify="flex-end" mt="md">
            <Button
              variant="default"
              onClick={() => {
                setModalOpen(false);
                setEditingInteraction(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              loading={createInteractionMutation.isPending || updateInteractionMutation.isPending}
            >
              {editingInteraction ? "Update" : "Log"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
