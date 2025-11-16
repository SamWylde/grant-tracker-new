import {
  Card,
  Stack,
  Group,
  Text,
  Badge,
  Anchor,
  Button,
  Divider,
} from "@mantine/core";
import {
  IconExternalLink,
  IconBookmark,
  IconBookmarkFilled,
  IconFileText,
} from "@tabler/icons-react";
import dayjs from "dayjs";
import type { NormalizedGrant } from "../../types/grants";
import { stripHtml } from "../../utils/htmlUtils";
import { FitScoreBadge } from "../FitScoreBadge";
import { SuccessScoreBadge } from "../SuccessScoreBadge";
import { GrantTagBadges } from "../GrantTagBadges";

interface GrantCardProps {
  grant: NormalizedGrant;
  isSaved: boolean;
  category?: string;
  orgId?: string;
  onViewDetails: (grantId: string) => void;
  onSaveToggle: (grant: NormalizedGrant, isSaved: boolean) => void;
}

export function GrantCard({
  grant,
  isSaved,
  category,
  orgId,
  onViewDetails,
  onSaveToggle,
}: GrantCardProps) {
  const daysUntilClose = grant.closeDate
    ? dayjs(grant.closeDate).diff(dayjs(), "day")
    : null;
  const isClosingSoon = daysUntilClose !== null && daysUntilClose <= 30;
  const isOverdue = daysUntilClose !== null && daysUntilClose < 0;

  return (
    <Card
      padding="lg"
      withBorder
      style={{
        cursor: "pointer",
        transition: "all 0.2s ease",
        border: isSaved ? "2px solid var(--mantine-color-grape-4)" : undefined,
      }}
      onClick={() => onViewDetails(grant.id)}
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
          <Stack gap={8} style={{ flex: 1 }}>
            <Group gap="xs" wrap="wrap">
              <Badge
                variant="light"
                color={grant.status === "posted" ? "green" : "blue"}
                size="sm"
              >
                {grant.status}
              </Badge>
              {grant.aln && (
                <Badge variant="outline" size="sm" color="gray">
                  {grant.aln}
                </Badge>
              )}
              {isSaved && (
                <Badge variant="filled" size="sm" color="grape">
                  Saved
                </Badge>
              )}
              <FitScoreBadge grantCategory={category} />
              <SuccessScoreBadge
                grantId={grant.id}
                orgId={orgId}
                compact
              />
            </Group>
            <GrantTagBadges grantId={grant.id} maxTags={3} />

            <Anchor
              href={`https://www.grants.gov/search-results-detail/${grant.id}`}
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

            <Text size="sm" c="dimmed" lineClamp={2} mt={4}>
              {grant.description ? stripHtml(grant.description) : "No description available"}
            </Text>
          </Stack>

          <Group gap="xs" style={{ flexShrink: 0 }}>
            <Button
              variant="light"
              color="blue"
              size="sm"
              leftSection={<IconFileText size={16} />}
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails(grant.id);
              }}
            >
              Details
            </Button>
            <Button
              variant={isSaved ? "filled" : "outline"}
              color="grape"
              size="sm"
              leftSection={
                isSaved ? (
                  <IconBookmarkFilled size={16} />
                ) : (
                  <IconBookmark size={16} />
                )
              }
              onClick={(e) => {
                e.stopPropagation();
                onSaveToggle(grant, isSaved);
              }}
            >
              {isSaved ? "Saved" : "Save"}
            </Button>
          </Group>
        </Group>

        <Divider />

        {/* Dates */}
        <Group gap="xl">
          {grant.openDate && (
            <Stack gap={4}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                Posted
              </Text>
              <Text size="sm" fw={500}>
                {dayjs(grant.openDate).format("MMM D, YYYY")}
              </Text>
            </Stack>
          )}
          <Stack gap={4}>
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
              {isOverdue ? "Closed" : "Closes"}
            </Text>
            {grant.closeDate ? (
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
                  {dayjs(grant.closeDate).format("MMM D, YYYY")}
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
}
