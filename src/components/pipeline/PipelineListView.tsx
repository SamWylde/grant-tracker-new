import {
  Card,
  Stack,
  Group,
  Text,
  Badge,
  Checkbox,
  Anchor,
  Divider,
  ActionIcon,
  Button,
} from "@mantine/core";
import { IconExternalLink, IconTrash, IconChecks, IconSquare } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import type { SavedGrant } from "../../hooks/useSavedGrants";
import { stripHtml } from "../../utils/htmlUtils";
import { SuccessScoreBadge } from "../SuccessScoreBadge";
import { GrantTagBadges } from "../GrantTagBadges";

interface PipelineListViewProps {
  grants: SavedGrant[];
  selectedGrantIds: Set<string>;
  onToggleSelection: (grantId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onRemove: (grantId: string) => void;
  isLoading: boolean;
}

export function PipelineListView({
  grants,
  selectedGrantIds,
  onToggleSelection,
  onSelectAll,
  onDeselectAll,
  onRemove,
  isLoading,
}: PipelineListViewProps) {
  const navigate = useNavigate();

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case "urgent":
        return "red";
      case "high":
        return "orange";
      case "medium":
        return "blue";
      default:
        return "gray";
    }
  };

  if (grants.length === 0) {
    return (
      <Card padding="xl" withBorder>
        <Stack align="center" gap="md" py="xl">
          <Text size="lg" fw={600} c="dimmed">
            No grants found
          </Text>
          <Text c="dimmed" ta="center" maw={400}>
            Start building your grant pipeline by saving opportunities from the Discover page.
          </Text>
        </Stack>
      </Card>
    );
  }

  return (
    <>
      {/* Select All Button */}
      {!isLoading && grants.length > 0 && (
        <Group justify="flex-end">
          <Button
            variant="subtle"
            size="xs"
            leftSection={selectedGrantIds.size === grants.length ? <IconSquare size={14} /> : <IconChecks size={14} />}
            onClick={selectedGrantIds.size === grants.length ? onDeselectAll : onSelectAll}
          >
            {selectedGrantIds.size === grants.length ? 'Deselect All' : 'Select All'}
          </Button>
        </Group>
      )}

      {/* Grant Cards */}
      <Stack gap="md">
        {grants.map((grant) => {
          const daysUntilClose = grant.close_date
            ? dayjs(grant.close_date).diff(dayjs(), "day")
            : null;
          const isOverdue = daysUntilClose !== null && daysUntilClose < 0;
          const isClosingSoon = daysUntilClose !== null && daysUntilClose >= 0 && daysUntilClose <= 30;

          return (
            <Card
              key={grant.id}
              padding="lg"
              withBorder
              style={{
                cursor: "pointer",
                transition: "all 0.2s ease",
                backgroundColor: selectedGrantIds.has(grant.id) ? "var(--mantine-color-grape-0)" : undefined,
              }}
              onClick={() => navigate(`/pipeline/grant/${grant.id}`)}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "";
                e.currentTarget.style.transform = "";
              }}
            >
              <Stack gap="md">
                {/* Header */}
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Checkbox
                    checked={selectedGrantIds.has(grant.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      onToggleSelection(grant.id);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    size="md"
                    style={{ flexShrink: 0 }}
                  />
                  <Stack gap={8} style={{ flex: 1 }}>
                    <Group gap="xs" wrap="wrap">
                      <Badge variant="filled" size="sm" color="grape">
                        {grant.status || 'saved'}
                      </Badge>
                      {grant.priority && (
                        <Badge size="sm" color={getPriorityColor(grant.priority)} variant="light">
                          {grant.priority}
                        </Badge>
                      )}
                      {grant.aln && (
                        <Badge variant="outline" size="sm" color="gray">
                          {grant.aln}
                        </Badge>
                      )}
                      <SuccessScoreBadge
                        grantId={grant.external_id}
                        orgId={grant.org_id}
                        compact
                      />
                    </Group>
                    <GrantTagBadges grantId={grant.external_id} maxTags={4} />

                    <Anchor
                      href={`https://www.grants.gov/search-results-detail/${grant.external_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      fw={600}
                      size="lg"
                      c="dark"
                      style={{ textDecoration: "none" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Group gap="xs" wrap="nowrap">
                        <Text lineClamp={2}>{grant.title}</Text>
                        <IconExternalLink size={16} style={{ flexShrink: 0 }} />
                      </Group>
                    </Anchor>

                    <Text size="sm" c="dimmed" fw={500}>
                      {grant.agency}
                    </Text>

                    {/* Description preview */}
                    <Text size="sm" c="dimmed" lineClamp={2}>
                      {grant.description ? (() => {
                        const cleanDesc = stripHtml(grant.description);
                        return cleanDesc.length > 200
                          ? cleanDesc.substring(0, 200) + '...'
                          : cleanDesc;
                      })() : "No description available"}
                    </Text>
                  </Stack>

                  <Group gap="xs" style={{ flexShrink: 0 }}>
                    <ActionIcon
                      variant="light"
                      color="red"
                      size="lg"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(grant.id);
                      }}
                      title="Remove from pipeline"
                    >
                      <IconTrash size={20} />
                    </ActionIcon>
                  </Group>
                </Group>

                <Divider />

                {/* Dates */}
                <Group gap="xl">
                  {grant.open_date && (
                    <Stack gap={4}>
                      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                        Posted
                      </Text>
                      <Text size="sm" fw={500}>
                        {dayjs(grant.open_date).format("MMM D, YYYY")}
                      </Text>
                    </Stack>
                  )}
                  <Stack gap={4}>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                      {isOverdue ? "Closed" : "Closes"}
                    </Text>
                    {grant.close_date ? (
                      <Group gap="xs">
                        <Text
                          size="sm"
                          fw={600}
                          c={
                            isOverdue
                              ? "red"
                              : isClosingSoon
                                ? "orange"
                                : "dark"
                          }
                        >
                          {dayjs(grant.close_date).format("MMM D, YYYY")}
                        </Text>
                        {daysUntilClose !== null && !isOverdue && (
                          <Badge
                            size="sm"
                            color={isClosingSoon ? "orange" : "gray"}
                            variant="light"
                          >
                            {daysUntilClose === 0
                              ? "Today"
                              : daysUntilClose === 1
                                ? "Tomorrow"
                                : `${daysUntilClose} days`}
                          </Badge>
                        )}
                        {isOverdue && (
                          <Badge size="sm" color="red" variant="light">
                            Overdue
                          </Badge>
                        )}
                      </Group>
                    ) : (
                      <Text size="sm" c="dimmed">
                        TBD
                      </Text>
                    )}
                  </Stack>
                </Group>
              </Stack>
            </Card>
          );
        })}
      </Stack>
    </>
  );
}
