import { Group, MultiSelect, Button } from "@mantine/core";
import { IconFilter, IconX } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useOrganization } from "../contexts/OrganizationContext";
import { supabase } from "../lib/supabase";
import { GRANT_STATUS_OPTIONS, GRANT_PRIORITY_OPTIONS } from "../constants";
import type { TeamMember, TeamMemberOption } from "../types/api";

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

const DEFAULT_STATUS_OPTIONS = GRANT_STATUS_OPTIONS.map(option => ({
  value: option.value,
  label: option.label,
}));

const PRIORITY_OPTIONS = GRANT_PRIORITY_OPTIONS.map(option => ({
  value: option.value,
  label: option.label,
}));

export function GrantFilters({
  value,
  onChange,
  showStatus = true,
  statusOptions = DEFAULT_STATUS_OPTIONS,
}: GrantFiltersProps) {
  const { currentOrg } = useOrganization();

  // Fetch team members for assignee filter using RPC function
  const { data: teamMembers } = useQuery<TeamMemberOption[]>({
    queryKey: ["teamMembers", currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return [];

      // @ts-expect-error - Supabase type inference issue with RPC functions
      const { data, error } = await supabase.rpc("get_org_team_members", { org_uuid: currentOrg.id });

      if (error) {
        console.error("Failed to fetch team members:", error);
        return [];
      }

      if (!data) return [];

      const members = data as unknown as TeamMember[];
      return members
        .filter((member) => member.user_id) // Filter out members without user_id
        .map((member) => ({
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
