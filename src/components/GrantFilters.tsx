import { Group, MultiSelect, Button } from "@mantine/core";
import { IconFilter, IconX } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useOrganization } from "../contexts/OrganizationContext";
import { supabase } from "../lib/supabase";

export interface GrantFilterValues {
  status?: string[];
  priority?: string[];
  assignedTo?: string[];
}

interface GrantFiltersProps {
  value: GrantFilterValues;
  onChange: (filters: GrantFilterValues) => void;
  showStatus?: boolean;
  statusOptions?: { value: string; label: string }[];
}

const DEFAULT_STATUS_OPTIONS = [
  { value: "researching", label: "Researching" },
  { value: "go-no-go", label: "Go/No-Go" },
  { value: "drafting", label: "Drafting" },
  { value: "submitted", label: "Submitted" },
  { value: "awarded", label: "Awarded" },
  { value: "not-funded", label: "Not Funded" },
  { value: "closed-out", label: "Closed Out" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "archived", label: "Archived" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export function GrantFilters({
  value,
  onChange,
  showStatus = true,
  statusOptions = DEFAULT_STATUS_OPTIONS,
}: GrantFiltersProps) {
  const { currentOrg } = useOrganization();

  // Fetch team members for assignee filter using RPC function
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

      return data
        .filter((member: any) => member.user_id) // Filter out members without user_id
        .map((member: any) => ({
          value: member.user_id,
          label: member.full_name || member.email || 'Unknown User',
        }));
    },
    enabled: !!currentOrg?.id,
  });

  const hasActiveFilters =
    (value.status && value.status.length > 0) ||
    (value.priority && value.priority.length > 0) ||
    (value.assignedTo && value.assignedTo.length > 0);

  const clearFilters = () => {
    onChange({ status: [], priority: [], assignedTo: [] });
  };

  return (
    <Group gap="sm">
      {showStatus && (
        <MultiSelect
          placeholder="Filter by status"
          data={statusOptions}
          value={value.status || []}
          onChange={(val) => onChange({ ...value, status: val })}
          leftSection={<IconFilter size={16} />}
          clearable
          w={200}
        />
      )}

      <MultiSelect
        placeholder="Filter by priority"
        data={PRIORITY_OPTIONS}
        value={value.priority || []}
        onChange={(val) => onChange({ ...value, priority: val })}
        leftSection={<IconFilter size={16} />}
        clearable
        w={200}
      />

      <MultiSelect
        placeholder="Filter by assignee"
        data={teamMembers || []}
        value={value.assignedTo || []}
        onChange={(val) => onChange({ ...value, assignedTo: val })}
        leftSection={<IconFilter size={16} />}
        clearable
        searchable
        w={220}
      />

      {hasActiveFilters && (
        <Button
          variant="subtle"
          color="gray"
          size="sm"
          leftSection={<IconX size={16} />}
          onClick={clearFilters}
        >
          Clear filters
        </Button>
      )}
    </Group>
  );
}
