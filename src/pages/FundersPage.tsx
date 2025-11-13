import "@mantine/core/styles.css";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Container,
  Group,
  Loader,
  Menu,
  Modal,
  Stack,
  Text,
  TextInput,
  Title,
  Textarea,
} from "@mantine/core";
import {
  IconPlus,
  IconBuilding,
  IconDots,
  IconEdit,
  IconTrash,
  IconExternalLink,
  IconUsers,
  IconFileText,
  IconMessage,
} from "@tabler/icons-react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { AppHeader } from "../components/AppHeader";
import { FunderDetailDrawer } from "../components/FunderDetailDrawer";
import { useOrganization } from "../contexts/OrganizationContext";
import { supabase } from "../lib/supabase";
import { notifications } from "@mantine/notifications";

interface Funder {
  id: string;
  org_id: string;
  name: string;
  website: string | null;
  description: string | null;
  agency_code: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  contacts: Array<{ count: number }>;
  grants: Array<{ count: number }>;
  interactions: Array<{ count: number }>;
}

export function FundersPage() {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrganization();
  const [selectedFunderId, setSelectedFunderId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingFunder, setEditingFunder] = useState<Funder | null>(null);

  // Form state for create/edit
  const [formData, setFormData] = useState({
    name: "",
    website: "",
    description: "",
    agency_code: "",
    notes: "",
  });

  // Fetch funders
  const { data: funders, isLoading } = useQuery<Funder[]>({
    queryKey: ["funders", currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) throw new Error("No organization selected");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(`/api/funders?org_id=${currentOrg.id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch funders");
      }

      const result = await response.json();
      return result.funders;
    },
    enabled: !!currentOrg?.id,
  });

  // Create funder mutation
  const createFunderMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!currentOrg?.id) throw new Error("No organization selected");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch('/api/funders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          org_id: currentOrg.id,
          ...data,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create funder");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funders", currentOrg?.id] });
      setCreateModalOpen(false);
      resetForm();
      notifications.show({
        title: "Success",
        message: "Funder created successfully",
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

  // Update funder mutation
  const updateFunderMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(`/api/funders?id=${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update funder");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funders", currentOrg?.id] });
      setEditingFunder(null);
      resetForm();
      notifications.show({
        title: "Success",
        message: "Funder updated successfully",
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

  // Delete funder mutation
  const deleteFunderMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(`/api/funders?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete funder");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funders", currentOrg?.id] });
      notifications.show({
        title: "Success",
        message: "Funder deleted successfully",
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
      website: "",
      description: "",
      agency_code: "",
      notes: "",
    });
  };

  const handleOpenCreate = () => {
    resetForm();
    setEditingFunder(null);
    setCreateModalOpen(true);
  };

  const handleOpenEdit = (funder: Funder) => {
    setFormData({
      name: funder.name,
      website: funder.website || "",
      description: funder.description || "",
      agency_code: funder.agency_code || "",
      notes: funder.notes || "",
    });
    setEditingFunder(funder);
    setCreateModalOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      notifications.show({
        title: "Validation Error",
        message: "Funder name is required",
        color: "red",
      });
      return;
    }

    if (editingFunder) {
      updateFunderMutation.mutate({ id: editingFunder.id, data: formData });
    } else {
      createFunderMutation.mutate(formData);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this funder? This action cannot be undone.")) {
      deleteFunderMutation.mutate(id);
    }
  };

  const handleViewDetails = (funderId: string) => {
    setSelectedFunderId(funderId);
    setDrawerOpen(true);
  };

  if (isLoading) {
    return (
      <>
        <AppHeader />
        <Container size="xl" py="xl">
          <Group justify="center" py="xl">
            <Loader size="lg" />
          </Group>
        </Container>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <Container size="xl" py="xl">
        <Stack gap="lg">
          <Group justify="space-between">
            <div>
              <Title order={1}>Funders</Title>
              <Text c="dimmed" size="sm">
                Manage funding organizations and their contacts
              </Text>
            </div>
            <Button leftSection={<IconPlus size={16} />} onClick={handleOpenCreate}>
              Add Funder
            </Button>
          </Group>

          {funders && funders.length === 0 ? (
            <Card withBorder p="xl">
              <Stack align="center" gap="md">
                <IconBuilding size={48} stroke={1.5} style={{ opacity: 0.5 }} />
                <div style={{ textAlign: "center" }}>
                  <Text fw={500} size="lg">
                    No funders yet
                  </Text>
                  <Text c="dimmed" size="sm">
                    Add your first funder to start tracking contacts and interactions
                  </Text>
                </div>
                <Button leftSection={<IconPlus size={16} />} onClick={handleOpenCreate}>
                  Add Funder
                </Button>
              </Stack>
            </Card>
          ) : (
            <Stack gap="md">
              {funders?.map((funder) => (
                <Card key={funder.id} withBorder p="md">
                  <Group justify="space-between" wrap="nowrap">
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <Group gap="sm" mb="xs">
                        <Text fw={600} size="lg" style={{ cursor: "pointer" }} onClick={() => handleViewDetails(funder.id)}>
                          {funder.name}
                        </Text>
                        {funder.agency_code && (
                          <Badge variant="light" color="blue" size="sm">
                            {funder.agency_code}
                          </Badge>
                        )}
                      </Group>
                      {funder.description && (
                        <Text size="sm" c="dimmed" lineClamp={2} mb="xs">
                          {funder.description}
                        </Text>
                      )}
                      <Group gap="lg">
                        <Group gap="xs">
                          <IconUsers size={16} style={{ opacity: 0.6 }} />
                          <Text size="sm" c="dimmed">
                            {funder.contacts[0]?.count || 0} contacts
                          </Text>
                        </Group>
                        <Group gap="xs">
                          <IconFileText size={16} style={{ opacity: 0.6 }} />
                          <Text size="sm" c="dimmed">
                            {funder.grants[0]?.count || 0} grants
                          </Text>
                        </Group>
                        <Group gap="xs">
                          <IconMessage size={16} style={{ opacity: 0.6 }} />
                          <Text size="sm" c="dimmed">
                            {funder.interactions[0]?.count || 0} interactions
                          </Text>
                        </Group>
                      </Group>
                    </Box>
                    <Group gap="xs">
                      {funder.website && (
                        <ActionIcon
                          variant="subtle"
                          component="a"
                          href={funder.website}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <IconExternalLink size={18} />
                        </ActionIcon>
                      )}
                      <Menu position="bottom-end" withinPortal>
                        <Menu.Target>
                          <ActionIcon variant="subtle">
                            <IconDots size={18} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item leftSection={<IconEdit size={16} />} onClick={() => handleOpenEdit(funder)}>
                            Edit
                          </Menu.Item>
                          <Menu.Item
                            leftSection={<IconTrash size={16} />}
                            color="red"
                            onClick={() => handleDelete(funder.id)}
                          >
                            Delete
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Group>
                  </Group>
                </Card>
              ))}
            </Stack>
          )}
        </Stack>
      </Container>

      {/* Create/Edit Funder Modal */}
      <Modal
        opened={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          setEditingFunder(null);
          resetForm();
        }}
        title={editingFunder ? "Edit Funder" : "Add Funder"}
        size="lg"
      >
        <Stack gap="md">
          <TextInput
            label="Name"
            placeholder="e.g., National Science Foundation"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          <TextInput
            label="Website"
            placeholder="https://www.nsf.gov"
            value={formData.website}
            onChange={(e) => setFormData({ ...formData, website: e.target.value })}
          />
          <TextInput
            label="Agency Code"
            placeholder="e.g., NSF"
            value={formData.agency_code}
            onChange={(e) => setFormData({ ...formData, agency_code: e.target.value })}
          />
          <Textarea
            label="Description"
            placeholder="Brief description of the funding organization"
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <Textarea
            label="Internal Notes"
            placeholder="Private notes about this funder"
            rows={3}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />
          <Group justify="flex-end" mt="md">
            <Button
              variant="default"
              onClick={() => {
                setCreateModalOpen(false);
                setEditingFunder(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              loading={createFunderMutation.isPending || updateFunderMutation.isPending}
            >
              {editingFunder ? "Update" : "Create"}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Funder Detail Drawer */}
      <FunderDetailDrawer
        funderId={selectedFunderId}
        opened={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedFunderId(null);
        }}
      />
    </>
  );
}
