import { Group, Switch, Select } from "@mantine/core";
import { GrantFilters, type GrantFilterValues } from "../GrantFilters";

interface PipelineFiltersProps {
  view: 'board' | 'list';
  filters: GrantFilterValues;
  onFiltersChange: (filters: GrantFilterValues) => void;
  sortBy: string;
  onSortChange: (sortBy: string) => void;
  showMyGrantsOnly: boolean;
  onShowMyGrantsOnlyChange: (show: boolean) => void;
}

export function PipelineFilters({
  view,
  filters,
  onFiltersChange,
  sortBy,
  onSortChange,
  showMyGrantsOnly,
  onShowMyGrantsOnlyChange,
}: PipelineFiltersProps) {
  return (
    <Group justify="space-between" align="flex-start">
      <GrantFilters
        value={filters}
        onChange={onFiltersChange}
        showStatus={view === 'list'}
      />
      <Group>
        {view === 'list' && (
          <Select
            placeholder="Sort by"
            value={sortBy}
            onChange={(value) => onSortChange(value || "deadline-asc")}
            data={[
              { value: "loi-deadline-asc", label: "LOI Deadline (soonest first)" },
              { value: "loi-deadline-desc", label: "LOI Deadline (latest first)" },
              { value: "deadline-asc", label: "App Deadline (soonest first)" },
              { value: "deadline-desc", label: "App Deadline (latest first)" },
              { value: "saved-newest", label: "Recently saved" },
              { value: "saved-oldest", label: "Oldest saved" },
            ]}
            w={200}
          />
        )}
        <Switch
          label="My grants only"
          checked={showMyGrantsOnly}
          onChange={(event) => onShowMyGrantsOnlyChange(event.currentTarget.checked)}
        />
      </Group>
    </Group>
  );
}
