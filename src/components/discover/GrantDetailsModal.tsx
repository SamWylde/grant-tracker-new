import {
  Modal,
  Stack,
  Group,
  Title,
  Text,
  Badge,
  Divider,
  Button,
  Loader,
  ScrollArea,
} from "@mantine/core";
import { IconExternalLink } from "@tabler/icons-react";
import dayjs from "dayjs";
import type { GrantDetail } from "../../types/grants";
import { stripHtml } from "../../utils/htmlUtils";

interface GrantDetailsModalProps {
  opened: boolean;
  onClose: () => void;
  grantDetails: GrantDetail | null;
  isLoading: boolean;
  error: Error | null;
  selectedGrantId: string | null;
}

export function GrantDetailsModal({
  opened,
  onClose,
  grantDetails,
  isLoading,
  error,
  selectedGrantId,
}: GrantDetailsModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={grantDetails?.title || "Grant Details"}
      size="xl"
    >
      {isLoading ? (
        <Group justify="center" py="xl">
          <Loader size="lg" />
          <Text>Loading grant details...</Text>
        </Group>
      ) : error ? (
        <Stack align="center" gap="md" py="xl">
          <Text c="red" fw={600}>
            Error loading grant details
          </Text>
          <Text c="dimmed" ta="center" size="sm">
            {error.message}
          </Text>
          <Button
            variant="light"
            component="a"
            href={`https://www.grants.gov/search-results-detail/${selectedGrantId}`}
            target="_blank"
            rel="noopener noreferrer"
            rightSection={<IconExternalLink size={16} />}
          >
            View on Grants.gov
          </Button>
        </Stack>
      ) : grantDetails ? (
        <ScrollArea h={600}>
          <Stack gap="lg">
            {/* Header */}
            <Stack gap="xs">
              <Title order={3}>{grantDetails.title}</Title>
              <Group gap="xs">
                <Badge color="grape" variant="light">
                  {grantDetails.number}
                </Badge>
                <Text size="sm" c="dimmed">
                  {grantDetails.agency}
                </Text>
              </Group>
            </Stack>

            <Divider />

            {/* Description */}
            {grantDetails.description && (
              <Stack gap="xs">
                <Text fw={600} size="sm">
                  Description
                </Text>
                <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                  {stripHtml(grantDetails.description)}
                </Text>
              </Stack>
            )}

            {/* Key Dates */}
            <Stack gap="xs">
              <Text fw={600} size="sm">
                Key Dates
              </Text>
              <Group gap="lg">
                {grantDetails.postDate && (
                  <div>
                    <Text size="xs" c="dimmed">
                      Posted
                    </Text>
                    <Text size="sm">
                      {dayjs(grantDetails.postDate).format("MMM D, YYYY")}
                    </Text>
                  </div>
                )}
                {grantDetails.closeDate && (
                  <div>
                    <Text size="xs" c="dimmed">
                      Closes
                    </Text>
                    <Text size="sm" fw={600} c="orange">
                      {dayjs(grantDetails.closeDate).format("MMM D, YYYY")}
                    </Text>
                  </div>
                )}
              </Group>
            </Stack>

            {/* Funding Information */}
            {(grantDetails.estimatedFunding ||
              grantDetails.awardCeiling ||
              grantDetails.awardFloor ||
              grantDetails.expectedAwards) && (
              <Stack gap="xs">
                <Text fw={600} size="sm">
                  Funding Information
                </Text>
                <Group gap="lg">
                  {grantDetails.estimatedFunding && (
                    <div>
                      <Text size="xs" c="dimmed">
                        Total Program Funding
                      </Text>
                      <Text size="sm">{grantDetails.estimatedFunding}</Text>
                    </div>
                  )}
                  {grantDetails.expectedAwards && (
                    <div>
                      <Text size="xs" c="dimmed">
                        Expected Awards
                      </Text>
                      <Text size="sm">{grantDetails.expectedAwards}</Text>
                    </div>
                  )}
                  {grantDetails.awardFloor && (
                    <div>
                      <Text size="xs" c="dimmed">
                        Award Floor
                      </Text>
                      <Text size="sm">{grantDetails.awardFloor}</Text>
                    </div>
                  )}
                  {grantDetails.awardCeiling && (
                    <div>
                      <Text size="xs" c="dimmed">
                        Award Ceiling
                      </Text>
                      <Text size="sm">{grantDetails.awardCeiling}</Text>
                    </div>
                  )}
                </Group>
              </Stack>
            )}

            {/* Eligibility */}
            {grantDetails.eligibility && (
              <Stack gap="xs">
                <Text fw={600} size="sm">
                  Eligible Applicants
                </Text>
                <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                  {stripHtml(grantDetails.eligibility)}
                </Text>
              </Stack>
            )}

            {/* Additional Details */}
            <Stack gap="xs">
              {grantDetails.category && (
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Category
                  </Text>
                  <Text size="sm">{grantDetails.category}</Text>
                </Group>
              )}
              {grantDetails.fundingInstrument && (
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Funding Instrument
                  </Text>
                  <Text size="sm">{grantDetails.fundingInstrument}</Text>
                </Group>
              )}
              {grantDetails.costSharing && (
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Cost Sharing Required
                  </Text>
                  <Text size="sm">{grantDetails.costSharing}</Text>
                </Group>
              )}
            </Stack>

            {/* External Link */}
            <Divider />
            <Group justify="flex-end">
              <Button
                component="a"
                href={grantDetails.grantsGovUrl || `https://www.grants.gov/search-results-detail/${grantDetails.id}`}
                target="_blank"
                rel="noopener noreferrer"
                rightSection={<IconExternalLink size={16} />}
                variant="light"
              >
                View on Grants.gov
              </Button>
            </Group>
          </Stack>
        </ScrollArea>
      ) : (
        <Text c="dimmed" ta="center" py="xl">
          No details available
        </Text>
      )}
    </Modal>
  );
}
