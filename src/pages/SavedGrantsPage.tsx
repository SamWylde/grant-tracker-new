import {
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Container,
  Divider,
  Group,
  Loader,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconArrowLeft,
  IconBookmarkOff,
  IconExternalLink,
  IconInbox,
  IconRocket,
} from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Link } from "react-router-dom";

const MOCK_ORG_ID = "00000000-0000-0000-0000-000000000001";

export function SavedGrantsPage() {
  const queryClient = useQueryClient();

  // Fetch saved grants
  const { data, isLoading, error, refetch } = useQuery<{ grants: Array<any> }>({
    queryKey: ["savedGrants", MOCK_ORG_ID],
    queryFn: async () => {
      const response = await fetch(`/api/saved?org_id=${MOCK_ORG_ID}`);
      if (!response.ok) throw new Error("Failed to fetch saved grants");
      return response.json();
    },
  });

  const handleRemove = async (grantId: string, title: string) => {
    try {
      const response = await fetch(`/api/saved?id=${grantId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to remove grant");

      notifications.show({
        title: "Removed from pipeline",
        message: `${title} has been removed`,
        color: "blue",
      });

      queryClient.invalidateQueries({ queryKey: ["savedGrants"] });
    } catch (err) {
      notifications.show({
        title: "Error",
        message: err instanceof Error ? err.message : "An error occurred",
        color: "red",
      });
    }
  };

  return (
    <Box bg="var(--mantine-color-gray-0)" mih="100vh">
      {/* Header */}
      <Box
        component="header"
        px="md"
        py="lg"
        bg="white"
        style={{
          borderBottom: "1px solid var(--mantine-color-gray-2)",
        }}
      >
        <Container size="xl">
          <Group justify="space-between">
            <Group gap={6}>
              <ThemeIcon variant="light" color="grape" size={38} radius="xl">
                <IconRocket size={20} />
              </ThemeIcon>
              <Stack gap={0}>
                <Text fw={700}>GrantTracker</Text>
                <Text size="xs" c="dimmed">
                  Saved Opportunities
                </Text>
              </Stack>
            </Group>
            <Button
              variant="light"
              color="grape"
              component={Link}
              to="/discover"
              leftSection={<IconArrowLeft size={16} />}
            >
              Back to Discover
            </Button>
          </Group>
        </Container>
      </Box>

      <Container size="xl" py="xl">
        <Stack gap="lg">
          <Stack gap="sm">
            <Title order={1}>Saved Grants Pipeline</Title>
            <Text c="dimmed" size="lg">
              Grants you've saved for your organization
            </Text>
          </Stack>

          <Divider />

          {/* Loading state */}
          {isLoading && (
            <Card padding="xl" withBorder>
              <Group justify="center">
                <Loader size="lg" />
                <Text>Loading saved grants...</Text>
              </Group>
            </Card>
          )}

          {/* Error state */}
          {error && (
            <Card padding="xl" withBorder>
              <Stack align="center" gap="md">
                <Text c="red" fw={600}>
                  Error loading saved grants
                </Text>
                <Text c="dimmed" ta="center">
                  {error instanceof Error ? error.message : "An error occurred"}
                </Text>
                <Button onClick={() => refetch()}>Try again</Button>
              </Stack>
            </Card>
          )}

          {/* Empty state */}
          {!isLoading && !error && (!data?.grants || data.grants.length === 0) && (
            <Card padding="xl" withBorder>
              <Stack align="center" gap="md">
                <IconInbox size={48} stroke={1.5} color="var(--mantine-color-gray-5)" />
                <Text fw={600}>No saved grants yet</Text>
                <Text c="dimmed" ta="center">
                  Start discovering grants and save them to your pipeline
                </Text>
                <Button component={Link} to="/discover" color="grape">
                  Discover Grants
                </Button>
              </Stack>
            </Card>
          )}

          {/* Results list */}
          {!isLoading && !error && data?.grants && data.grants.length > 0 && (
            <>
              <Text size="sm" c="dimmed">
                {data.grants.length} {data.grants.length === 1 ? "grant" : "grants"} in your
                pipeline
              </Text>

              <Stack gap="md">
                {data.grants.map((grant) => {
                  const isClosingSoon =
                    grant.close_date && dayjs(grant.close_date).diff(dayjs(), "day") <= 30;
                  const grantsGovUrl = `https://www.grants.gov/search-results-detail/${grant.external_id}`;

                  return (
                    <Card key={grant.id} padding="lg" withBorder radius="md" shadow="sm">
                      <Stack gap="md">
                        <Group justify="space-between" align="flex-start" wrap="nowrap">
                          <Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
                            {/* Title */}
                            <Anchor
                              href={grantsGovUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              fw={600}
                              size="lg"
                              c="dark"
                              style={{
                                textDecoration: "none",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                              }}
                            >
                              {grant.title}
                              <IconExternalLink
                                size={16}
                                style={{ marginLeft: 4, verticalAlign: "middle" }}
                              />
                            </Anchor>

                            {/* Agency and ALN */}
                            <Group gap="xs" wrap="wrap">
                              {grant.agency && (
                                <Text size="sm" c="dimmed" fw={500}>
                                  {grant.agency}
                                </Text>
                              )}
                              {grant.aln && (
                                <>
                                  <Text size="sm" c="dimmed">
                                    •
                                  </Text>
                                  <Text size="sm" c="dimmed">
                                    CFDA {grant.aln}
                                  </Text>
                                </>
                              )}
                            </Group>
                          </Stack>

                          {/* Remove button */}
                          <Tooltip label="Remove from pipeline" position="left">
                            <Button
                              variant="light"
                              color="red"
                              size="sm"
                              leftSection={<IconBookmarkOff size={16} />}
                              onClick={() => handleRemove(grant.id, grant.title)}
                            >
                              Remove
                            </Button>
                          </Tooltip>
                        </Group>

                        <Divider />

                        {/* Dates and saved info */}
                        <Group gap="lg" wrap="wrap">
                          {grant.open_date && (
                            <Group gap={6}>
                              <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                                Opened
                              </Text>
                              <Text size="sm">
                                {dayjs(grant.open_date).format("MMM D, YYYY")}
                              </Text>
                            </Group>
                          )}
                          <Group gap={6}>
                            <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                              {grant.close_date ? "Closes" : "Deadline"}
                            </Text>
                            {grant.close_date ? (
                              <Text
                                size="sm"
                                fw={isClosingSoon ? 700 : 500}
                                c={isClosingSoon ? "orange" : undefined}
                              >
                                {dayjs(grant.close_date).format("MMM D, YYYY")}
                                {isClosingSoon && (
                                  <Badge color="orange" variant="light" size="xs" ml={6}>
                                    Soon
                                  </Badge>
                                )}
                              </Text>
                            ) : (
                              <Text size="sm" c="dimmed" fs="italic">
                                TBD
                              </Text>
                            )}
                          </Group>
                          <Group gap={6} ml="auto">
                            <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                              Saved
                            </Text>
                            <Text size="sm">
                              {dayjs(grant.saved_at).format("MMM D, YYYY")}
                            </Text>
                          </Group>
                        </Group>
                      </Stack>
                    </Card>
                  );
                })}
              </Stack>
            </>
          )}
        </Stack>
      </Container>
    </Box>
  );
}
