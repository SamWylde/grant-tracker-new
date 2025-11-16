import {
  Box,
  Card,
  Stack,
  Group,
  Text,
  Badge,
  ActionIcon,
  Menu,
  Code,
  ScrollArea,
} from "@mantine/core";
import {
  IconGripVertical,
  IconCalendar,
  IconExternalLink,
  IconArrowRight,
  IconDots,
  IconArchive,
  IconTrash,
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { notifications } from "@mantine/notifications";
import dayjs from "dayjs";
import type { SavedGrant } from "../../hooks/useSavedGrants";
import { stripHtml } from "../../utils/htmlUtils";
import { SuccessScoreBadge } from "../SuccessScoreBadge";
import { GrantTagBadges } from "../GrantTagBadges";

// Pipeline stages
const PIPELINE_STAGES = [
  { id: "researching", label: "Researching", color: "blue" },
  { id: "go-no-go", label: "Go/No-Go", color: "yellow" },
  { id: "drafting", label: "Drafting", color: "grape" },
  { id: "submitted", label: "Submitted", color: "orange" },
  { id: "awarded", label: "Awarded", color: "green" },
  { id: "not-funded", label: "Not Funded", color: "red" },
  { id: "closed-out", label: "Closed Out", color: "teal" },
] as const;

type PipelineStage = typeof PIPELINE_STAGES[number]["id"];

interface PipelineBoardViewProps {
  grantsByStage: Record<PipelineStage, SavedGrant[]>;
  draggedItem: string | null;
  onDragStart: (e: React.DragEvent, grantId: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, newStatus: PipelineStage) => void;
  onUpdateStatus: (grantId: string, newStatus: PipelineStage) => void;
  onArchive: (grantId: string) => void;
  onRemove: (grantId: string) => void;
}

export function PipelineBoardView({
  grantsByStage,
  draggedItem,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onUpdateStatus,
  onArchive,
  onRemove,
}: PipelineBoardViewProps) {
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

  return (
    <ScrollArea>
      <Group align="flex-start" gap="md" wrap="nowrap" style={{ minWidth: "fit-content" }}>
        {PIPELINE_STAGES.map((stage) => (
          <Box
            key={stage.id}
            style={{ minWidth: 280, maxWidth: 280 }}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, stage.id)}
          >
            {/* Column Header */}
            <Card padding="md" mb="md" withBorder bg={`var(--mantine-color-${stage.color}-0)`}>
              <Group justify="space-between">
                <Text fw={600} size="lg">
                  {stage.label}
                </Text>
                <Badge color={stage.color} variant="filled">
                  {grantsByStage[stage.id].length}
                </Badge>
              </Group>
            </Card>

            {/* Grant Cards */}
            <Stack gap="sm">
              {grantsByStage[stage.id].length === 0 ? (
                <Card padding="md" withBorder style={{ opacity: 0.5 }}>
                  <Text size="sm" c="dimmed" ta="center">
                    No grants in this stage
                  </Text>
                </Card>
              ) : (
                grantsByStage[stage.id].map((grant) => {
                  const daysUntilClose = grant.close_date
                    ? dayjs(grant.close_date).diff(dayjs(), "day")
                    : null;
                  const isClosingSoon = daysUntilClose !== null && daysUntilClose <= 30;
                  const isOverdue = daysUntilClose !== null && daysUntilClose < 0;

                  return (
                    <Card
                      key={grant.id}
                      padding="md"
                      withBorder
                      draggable
                      onDragStart={(e) => onDragStart(e, grant.id)}
                      onDragEnd={onDragEnd}
                      onClick={() => navigate(`/pipeline/grant/${grant.id}`)}
                      role="button"
                      tabIndex={0}
                      aria-label={`${grant.title} - Click to view details or use menu to move`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          navigate(`/pipeline/grant/${grant.id}`);
                        }
                      }}
                      style={{
                        cursor: "pointer",
                        opacity: draggedItem === grant.id ? 0.5 : 1,
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        if (draggedItem !== grant.id) {
                          e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = "";
                      }}
                    >
                      <Stack gap="sm">
                        {/* Drag Handle & Priority */}
                        <Group justify="space-between">
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            size="sm"
                            style={{ cursor: "grab" }}
                            aria-label="Drag to move grant"
                          >
                            <IconGripVertical size={16} />
                          </ActionIcon>
                          <Badge size="sm" color={getPriorityColor(grant.priority)} variant="light">
                            {grant.priority || "normal"}
                          </Badge>
                        </Group>

                        {/* Badges */}
                        <Group gap="xs" wrap="wrap">
                          {grant.aln && (
                            <Badge variant="outline" size="xs" color="gray">
                              {grant.aln}
                            </Badge>
                          )}
                          <SuccessScoreBadge
                            grantId={grant.external_id}
                            orgId={grant.org_id}
                            compact
                          />
                        </Group>
                        <GrantTagBadges grantId={grant.external_id} maxTags={3} />

                        {/* Title */}
                        <Text fw={600} size="sm" lineClamp={2}>
                          {grant.title}
                        </Text>

                        {/* Agency */}
                        <Text size="xs" c="dimmed">
                          {grant.agency}
                        </Text>

                        {/* Grant ID for easy testing */}
                        {grant.external_id && (
                          <Group gap={4}>
                            <Code c="dimmed" style={{ cursor: 'pointer', fontSize: '11px' }} onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(grant.external_id);
                              notifications.show({
                                title: 'Copied!',
                                message: `Grant ID ${grant.external_id} copied to clipboard`,
                                color: 'green',
                                autoClose: 2000,
                              });
                            }}>
                              ID: {grant.external_id}
                            </Code>
                          </Group>
                        )}

                        {/* Description preview */}
                        <Text size="xs" c="dimmed" lineClamp={2}>
                          {grant.description ? (() => {
                            const cleanDesc = stripHtml(grant.description);
                            return cleanDesc.length > 150
                              ? cleanDesc.substring(0, 150) + '...'
                              : cleanDesc;
                          })() : "No description available"}
                        </Text>

                        {/* LOI Deadline */}
                        {grant.loi_deadline && (() => {
                          const loiDaysUntil = dayjs(grant.loi_deadline).diff(dayjs(), "day");
                          const loiClosingSoon = loiDaysUntil <= 14;
                          const loiOverdue = loiDaysUntil < 0;
                          return (
                            <Group gap="xs">
                              <IconCalendar size={14} />
                              <Text
                                size="xs"
                                fw={loiClosingSoon || loiOverdue ? 600 : 400}
                                c={loiOverdue ? "red" : loiClosingSoon ? "orange" : "blue"}
                              >
                                LOI: {dayjs(grant.loi_deadline).format("MMM D")}
                              </Text>
                              {loiDaysUntil !== null && !loiOverdue && (
                                <Badge size="xs" color={loiClosingSoon ? "orange" : "blue"} variant="dot">
                                  {loiDaysUntil}d
                                </Badge>
                              )}
                            </Group>
                          );
                        })()}

                        {/* Application Deadline */}
                        {grant.close_date && (
                          <Group gap="xs">
                            <IconCalendar size={14} />
                            <Text
                              size="xs"
                              fw={isClosingSoon || isOverdue ? 600 : 400}
                              c={isOverdue ? "red" : isClosingSoon ? "orange" : "dimmed"}
                            >
                              App: {dayjs(grant.close_date).format("MMM D, YYYY")}
                            </Text>
                            {daysUntilClose !== null && !isOverdue && (
                              <Badge size="xs" color={isClosingSoon ? "orange" : "gray"} variant="dot">
                                {daysUntilClose}d
                              </Badge>
                            )}
                          </Group>
                        )}

                        {/* Actions */}
                        <Group gap="xs" mt="xs" justify="space-between">
                          <ActionIcon
                            variant="subtle"
                            size="sm"
                            component="a"
                            href={`https://www.grants.gov/search-results-detail/${grant.external_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <IconExternalLink size={14} />
                          </ActionIcon>

                          {/* Keyboard-accessible move menu */}
                          <Menu position="bottom-end" shadow="md" withinPortal>
                            <Menu.Target>
                              <ActionIcon
                                variant="subtle"
                                size="sm"
                                aria-label={`Move ${grant.title} to different stage`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <IconDots size={14} />
                              </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                              <Menu.Label>Move to stage</Menu.Label>
                              {PIPELINE_STAGES.filter(s => s.id !== stage.id).map((targetStage) => (
                                <Menu.Item
                                  key={targetStage.id}
                                  leftSection={<IconArrowRight size={14} />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onUpdateStatus(grant.id, targetStage.id as PipelineStage);
                                  }}
                                >
                                  {targetStage.label}
                                </Menu.Item>
                              ))}
                              <Menu.Divider />
                              <Menu.Item
                                color="orange"
                                leftSection={<IconArchive size={14} />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onArchive(grant.id);
                                }}
                              >
                                Archive
                              </Menu.Item>
                              <Menu.Item
                                color="red"
                                leftSection={<IconTrash size={14} />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRemove(grant.id);
                                }}
                              >
                                Remove from Pipeline
                              </Menu.Item>
                            </Menu.Dropdown>
                          </Menu>
                        </Group>
                      </Stack>
                    </Card>
                  );
                })
              )}
            </Stack>
          </Box>
        ))}
      </Group>
    </ScrollArea>
  );
}
