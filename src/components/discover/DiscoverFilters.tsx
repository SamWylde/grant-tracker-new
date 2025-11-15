import {
  Paper,
  Stack,
  Group,
  Text,
  TextInput,
  Select,
  NumberInput,
  Checkbox,
} from "@mantine/core";
import { IconFilter, IconSearch, IconCalendar, IconArrowsSort } from "@tabler/icons-react";
import { FUNDING_CATEGORIES, FEDERAL_AGENCIES } from "../../types/grants";

interface DiscoverFiltersProps {
  keyword: string;
  onKeywordChange: (keyword: string) => void;
  category: string | null;
  onCategoryChange: (category: string | null) => void;
  agency: string | null;
  onAgencyChange: (agency: string | null) => void;
  dueInDays: number | string;
  onDueInDaysChange: (days: number | string) => void;
  sortBy: string;
  onSortByChange: (sortBy: string) => void;
  statusPosted: boolean;
  onStatusPostedChange: (checked: boolean) => void;
  statusForecasted: boolean;
  onStatusForecastedChange: (checked: boolean) => void;
}

export function DiscoverFilters({
  keyword,
  onKeywordChange,
  category,
  onCategoryChange,
  agency,
  onAgencyChange,
  dueInDays,
  onDueInDaysChange,
  sortBy,
  onSortByChange,
  statusPosted,
  onStatusPostedChange,
  statusForecasted,
  onStatusForecastedChange,
}: DiscoverFiltersProps) {
  return (
    <Paper p="md" withBorder>
      <Stack gap="md">
        <Group gap="xs">
          <IconFilter size={20} />
          <Text fw={600}>Filters & Sort</Text>
        </Group>

        <Group align="flex-end" wrap="wrap">
          <TextInput
            placeholder="Search keywords..."
            leftSection={<IconSearch size={16} />}
            value={keyword}
            onChange={(e) => onKeywordChange(e.target.value)}
            style={{ flex: 1, minWidth: 250 }}
          />

          <Select
            placeholder="Category"
            data={FUNDING_CATEGORIES.map((c) => ({
              value: c.value,
              label: c.label,
            }))}
            value={category}
            onChange={onCategoryChange}
            clearable
            searchable
            style={{ minWidth: 200 }}
          />

          <Select
            placeholder="Agency"
            data={FEDERAL_AGENCIES.map((a) => ({
              value: a.value,
              label: a.label,
            }))}
            value={agency}
            onChange={onAgencyChange}
            clearable
            searchable
            style={{ minWidth: 200 }}
          />

          <NumberInput
            placeholder="Due in ≤ X days"
            leftSection={<IconCalendar size={16} />}
            value={dueInDays}
            onChange={onDueInDaysChange}
            min={0}
            style={{ minWidth: 180 }}
          />

          <Select
            placeholder="Sort by"
            leftSection={<IconArrowsSort size={16} />}
            data={[
              { value: "due_soon", label: "Due Soon" },
              { value: "newest", label: "Newest" },
              { value: "relevance", label: "Relevance" },
            ]}
            value={sortBy}
            onChange={(value) => onSortByChange(value || "due_soon")}
            style={{ minWidth: 180 }}
          />
        </Group>

        <Group gap="md">
          <Text size="sm" fw={500}>
            Status:
          </Text>
          <Checkbox
            label="Posted"
            checked={statusPosted}
            onChange={(e) => onStatusPostedChange(e.currentTarget.checked)}
          />
          <Checkbox
            label="Forecasted"
            checked={statusForecasted}
            onChange={(e) => onStatusForecastedChange(e.currentTarget.checked)}
          />
        </Group>
      </Stack>
    </Paper>
  );
}
