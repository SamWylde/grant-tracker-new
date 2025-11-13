import {
  Stack,
  Group,
  Text,
  Button,
  Modal,
  TextInput,
  Textarea,
  ActionIcon,
  Box,
  Menu,
} from "@mantine/core";
import {
  IconPlus,
  IconMail,
  IconPhone,
  IconUser,
  IconDots,
  IconEdit,
  IconTrash,
} from "@tabler/icons-react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useOrganization } from "../contexts/OrganizationContext";
import { notifications } from "@mantine/notifications";

interface ContactsSectionProps {
  funderId: string | null;
}

interface Contact {
  id: string;
  org_id: string;
  funder_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function ContactsSection({ funderId }: ContactsSectionProps) {
  const { currentOrg } = useOrganization();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    title: "",
    notes: "",
  });

  // Fetch contacts
  const { data: contacts, isLoading } = useQuery<Contact[]>({
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

  // Create contact mutation
  const createContactMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!currentOrg?.id || !funderId) throw new Error("Missing required data");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          org_id: currentOrg.id,
          funder_id: funderId,
          ...data,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create contact");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts", funderId] });
      queryClient.invalidateQueries({ queryKey: ["funder", funderId] });
      setModalOpen(false);
      resetForm();
      notifications.show({
        title: "Success",
        message: "Contact created successfully",
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

  // Update contact mutation
  const updateContactMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(`/api/contacts?id=${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update contact");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts", funderId] });
      queryClient.invalidateQueries({ queryKey: ["funder", funderId] });
      setModalOpen(false);
      setEditingContact(null);
      resetForm();
      notifications.show({
        title: "Success",
        message: "Contact updated successfully",
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

  // Delete contact mutation
  const deleteContactMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(`/api/contacts?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete contact");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts", funderId] });
      queryClient.invalidateQueries({ queryKey: ["funder", funderId] });
      notifications.show({
        title: "Success",
        message: "Contact deleted successfully",
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
      name: "",
      email: "",
      phone: "",
      title: "",
      notes: "",
    });
  };

  const handleOpenCreate = () => {
    resetForm();
    setEditingContact(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (contact: Contact) => {
    setFormData({
      name: contact.name,
      email: contact.email || "",
      phone: contact.phone || "",
      title: contact.title || "",
      notes: contact.notes || "",
    });
    setEditingContact(contact);
    setModalOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      notifications.show({
        title: "Validation Error",
        message: "Contact name is required",
        color: "red",
      });
      return;
    }

    if (editingContact) {
      updateContactMutation.mutate({ id: editingContact.id, data: formData });
    } else {
      createContactMutation.mutate(formData);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this contact?")) {
      deleteContactMutation.mutate(id);
    }
  };

  return (
    <>
      <Stack gap="md">
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={handleOpenCreate}
          fullWidth
        >
          Add Contact
        </Button>

        {isLoading ? (
          <Text c="dimmed" ta="center" py="md">
            Loading contacts...
          </Text>
        ) : contacts && contacts.length > 0 ? (
          <Stack gap="sm">
            {contacts.map((contact) => (
              <Box
                key={contact.id}
                p="md"
                style={(theme) => ({
                  border: `1px solid ${theme.colors.gray[3]}`,
                  borderRadius: theme.radius.md,
                })}
              >
                <Group justify="space-between" align="flex-start">
                  <Stack gap="xs" style={{ flex: 1 }}>
                    <Group gap="sm">
                      <IconUser size={16} style={{ opacity: 0.6 }} />
                      <Text fw={500}>{contact.name}</Text>
                    </Group>
                    {contact.title && (
                      <Text size="sm" c="dimmed">
                        {contact.title}
                      </Text>
                    )}
                    {contact.email && (
                      <Group gap="xs">
                        <IconMail size={14} style={{ opacity: 0.6 }} />
                        <Text size="sm" c="dimmed">
                          {contact.email}
                        </Text>
                      </Group>
                    )}
                    {contact.phone && (
                      <Group gap="xs">
                        <IconPhone size={14} style={{ opacity: 0.6 }} />
                        <Text size="sm" c="dimmed">
                          {contact.phone}
                        </Text>
                      </Group>
                    )}
                    {contact.notes && (
                      <Text size="sm" c="dimmed" style={{ whiteSpace: "pre-wrap" }}>
                        {contact.notes}
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
                        onClick={() => handleOpenEdit(contact)}
                      >
                        Edit
                      </Menu.Item>
                      <Menu.Item
                        leftSection={<IconTrash size={16} />}
                        color="red"
                        onClick={() => handleDelete(contact.id)}
                      >
                        Delete
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Group>
              </Box>
            ))}
          </Stack>
        ) : (
          <Text c="dimmed" ta="center" py="md">
            No contacts yet. Add your first contact to get started.
          </Text>
        )}
      </Stack>

      {/* Create/Edit Contact Modal */}
      <Modal
        opened={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingContact(null);
          resetForm();
        }}
        title={editingContact ? "Edit Contact" : "Add Contact"}
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label="Name"
            placeholder="e.g., John Smith"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          <TextInput
            label="Title"
            placeholder="e.g., Program Officer"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          />
          <TextInput
            label="Email"
            placeholder="john.smith@agency.gov"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
          <TextInput
            label="Phone"
            placeholder="(555) 123-4567"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
          <Textarea
            label="Notes"
            placeholder="Additional notes about this contact"
            rows={3}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />
          <Group justify="flex-end" mt="md">
            <Button
              variant="default"
              onClick={() => {
                setModalOpen(false);
                setEditingContact(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              loading={createContactMutation.isPending || updateContactMutation.isPending}
            >
              {editingContact ? "Update" : "Create"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
