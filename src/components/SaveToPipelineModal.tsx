import { Modal, Stack, Select, Button, Group, Text } from "@mantine/core";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useOrganization } from "../contexts/OrganizationContext";
import { supabase } from "../lib/supabase";

const PIPELINE_STAGES = [
  { value: "researching", label: "Researching" },
  { value: "drafting", label: "Drafting" },
  { value: "submitted", label: "Submitted" },
  { value: "awarded", label: "Awarded" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

interface SaveToPipelineModalProps {
  opened: boolean;
  onClose: () => void;
  onSave: (data: SaveToPipelineData) => Promise<void>;
  grantTitle: string;
  saving?: boolean;
}

export interface SaveToPipelineData {
  status: string;
  priority: string;
  assigned_to: string | null;
}

export function SaveToPipelineModal({
  opened,
  onClose,
  onSave,
  grantTitle,
  saving = false,
}: SaveToPipelineModalProps) {
  const { currentOrg } = useOrganization();
  const [status, setStatus] = useState<string>("researching");
  const [priority, setPriority] = useState<string>("medium");
  const [assignedTo, setAssignedTo] = useState<string | null>(null);

  // Fetch team members for assignee selection using RPC function
  const { data: teamMembers } = useQuery({
    queryKey: ["teamMembers", currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return [];

      const { data, error } = await (supabase.rpc as any)("get_org_team_members", { org_uuid: currentOrg.id });

      if (error) {
        console.error("Failed to fetch team members:", error);
        return [];
      }

      if (!data) return [];

      return data.map((member: any) => ({
        value: member.user_id,
        label: member.full_name || member.email,
      }));
    },
    enabled: !!currentOrg?.id && opened,
  });

  const handleSave = async () => {
    await onSave({
      status,
      priority,
      assigned_to: assignedTo,
    });
    // Reset form
    setStatus("researching");
    setPriority("medium");
    setAssignedTo(null);
    onClose();
  };

  const handleClose = () => {
    // Reset form on close
    setStatus("researching");
    setPriority("medium");
    setAssignedTo(null);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Save to Pipeline"
      size="md"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Configure how to save <strong>{grantTitle}</strong> to your pipeline
        </Text>

        <Select
          label="Pipeline Stage"
          description="Which stage is this grant in?"
          data={PIPELINE_STAGES}
          value={status}
          onChange={(val) => setStatus(val || "researching")}
          required
        />

        <Select
          label="Priority"
          description="How urgent is this grant?"
          data={PRIORITY_OPTIONS}
          value={priority}
          onChange={(val) => setPriority(val || "medium")}
          required
        />

        <Select
          label="Assign to"
          description="Who should work on this grant?"
          placeholder="Select team member (optional)"
          data={teamMembers || []}
          value={assignedTo}
          onChange={setAssignedTo}
          clearable
          searchable
        />

        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving}>
            Save to Pipeline
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
