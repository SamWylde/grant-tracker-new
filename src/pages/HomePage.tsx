import {
  Anchor,
  Badge,
  Box,
  Card,
  Container,
  Divider,
  Group,
  Image,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Button,
} from "@mantine/core";
import { IconChartBar, IconClock, IconUsers } from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { AppHeader } from "../components/AppHeader";
import { MarketingHeader } from "../components/MarketingHeader";

export function HomePage() {
  const { user } = useAuth();

  return (
    <Box bg="var(--mantine-color-gray-0)">
      {user ? (
        <AppHeader subtitle="Grant Discovery & Management" />
      ) : (
        <MarketingHeader blurred />
      )}

      <Box
        component="section"
        py={{ base: 60, md: 110 }}
        bg="linear-gradient(135deg, var(--mantine-color-grape-0) 0%, var(--mantine-color-indigo-0) 100%)"
      >
        <Container size="lg">
          <SimpleGrid
            cols={{ base: 1, md: 2 }}
            spacing={{ base: 40, md: 80 }}
            style={{ alignItems: "center" }}
          >
            <Stack gap="xl">
              <Badge size="lg" variant="light" color="grape" radius="sm" w="fit-content">
                New: Pipeline analytics dashboard
              </Badge>
              <Title order={1} fz={{ base: 40, md: 58 }}>
                All your grant opportunities in one intuitive workspace
              </Title>
              <Text fz="lg" c="dimmed">
                GrantCue centralizes deadlines, tasks, and collaborator updates so your team can
                focus on crafting standout proposals instead of chasing spreadsheets.
              </Text>
              <Group gap="md">
                <Button size="lg" color="grape" component={Link} to="/signup">
                  Sign up for free
                </Button>
                <Button size="lg" variant="default" component={Link} to="/discover">
                  Discover grants
                </Button>
              </Group>
              <Group gap="lg">
                <Stack gap={4}>
                  <Text fw={700} fz={30}>
                    8x
                  </Text>
                  <Text size="sm" c="dimmed">
                    Faster intake review cycles
                  </Text>
                </Stack>
                <Stack gap={4}>
                  <Text fw={700} fz={30}>
                    95%
                  </Text>
                  <Text size="sm" c="dimmed">
                    On-time submission rate across teams
                  </Text>
                </Stack>
              </Group>
            </Stack>
            <Card radius="lg" shadow="xl" padding="xl" withBorder>
              <Stack gap="md">
                <Group justify="space-between">
                  <Text fw={600}>Upcoming deadlines</Text>
                  <Badge color="green" variant="light">
                    On track
                  </Badge>
                </Group>
                <Divider my="xs" />
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Stack gap={2}>
                      <Text fw={500}>Community Revitalization Program</Text>
                      <Text size="sm" c="dimmed">
                        Narrative draft review · Sarah Chen
                      </Text>
                    </Stack>
                    <Badge color="grape" variant="light">
                      Due in 3 days
                    </Badge>
                  </Group>
                  <Group justify="space-between">
                    <Stack gap={2}>
                      <Text fw={500}>STEM Equity Innovation Grant</Text>
                      <Text size="sm" c="dimmed">
                        Budget alignment · Finance team
                      </Text>
                    </Stack>
                    <Badge color="orange" variant="light">
                      Due in 7 days
                    </Badge>
                  </Group>
                  <Group justify="space-between">
                    <Stack gap={2}>
                      <Text fw={500}>Climate Resilience Pilot</Text>
                      <Text size="sm" c="dimmed">
                        Partner MOU review · Legal
                      </Text>
                    </Stack>
                    <Badge color="blue" variant="light">
                      Due in 11 days
                    </Badge>
                  </Group>
                </Stack>
                <Divider my="xs" />
                <Stack gap="sm">
                  <Text size="sm" c="dimmed">
                    Collaborators active today
                  </Text>
                  <Group gap="sm">
                    <Image src="https://images.unsplash.com/photo-1544723795-3fb6469f5b39" alt="Team member" h={48} w={48} radius="xl" />
                    <Image src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde" alt="Team member" h={48} w={48} radius="xl" />
                    <Image src="https://images.unsplash.com/photo-1544723795-3fb6469f5b39" alt="Team member" h={48} w={48} radius="xl" />
                    <Badge variant="default">+12</Badge>
                  </Group>
                </Stack>
              </Stack>
            </Card>
          </SimpleGrid>
        </Container>
      </Box>

      <Container size="lg" py={{ base: 80, md: 110 }}>
        <Stack gap={60}>
          <Stack gap="sm" align="center">
            <Badge size="lg" variant="light" color="grape">
              Why teams choose GrantCue
            </Badge>
            <Title order={2} ta="center">
              Built for collaborative, deadline-driven work
            </Title>
            <Text size="lg" c="dimmed" ta="center" maw={640}>
              Equip program managers, finance leads, and executive stakeholders with transparency on
              every proposal milestone from discovery to submission.
            </Text>
          </Stack>
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing={{ base: 28, md: 40 }}>
            <Card padding="xl" radius="lg" withBorder>
              <ThemeIcon color="grape" variant="light" size={48} radius="md" mb="md">
                <IconClock size={26} />
              </ThemeIcon>
              <Title order={4} mb="sm">
                Smart deadline orchestration
              </Title>
              <Text c="dimmed">
                Layer automated reminders and approval stages onto every grant so contributors never
                miss a review or compliance checkpoint.
              </Text>
            </Card>
            <Card padding="xl" radius="lg" withBorder>
              <ThemeIcon color="grape" variant="light" size={48} radius="md" mb="md">
                <IconUsers size={26} />
              </ThemeIcon>
              <Title order={4} mb="sm">
                Cross-team collaboration
              </Title>
              <Text c="dimmed">
                Centralize discussions, documents, and decision logs to replace email threads with a
                searchable source of truth.
              </Text>
            </Card>
            <Card padding="xl" radius="lg" withBorder>
              <ThemeIcon color="grape" variant="light" size={48} radius="md" mb="md">
                <IconChartBar size={26} />
              </ThemeIcon>
              <Title order={4} mb="sm">
                Pipeline analytics
              </Title>
              <Text c="dimmed">
                Visualize funding targets, portfolio coverage, and submission outcomes to forecast
                revenue with confidence.
              </Text>
            </Card>
          </SimpleGrid>
        </Stack>
      </Container>

      <Box bg="var(--mantine-color-gray-1)" py={{ base: 70, md: 100 }}>
        <Container size="lg">
          <SimpleGrid
            cols={{ base: 1, md: 2 }}
            spacing={{ base: 40, md: 80 }}
            style={{ alignItems: "center" }}
          >
            <Stack gap="md">
              <Badge variant="light" color="grape" size="lg" w="fit-content">
                Success spotlight
              </Badge>
              <Title order={2}>
                "GrantCue reduced our review cycles from weeks to days."
              </Title>
              <Text size="lg" c="dimmed">
                The City Forward Foundation consolidated eight spreadsheets and brought 120 partners
                into a single workspace, securing $18M in new awards within the first quarter of use.
              </Text>
              <Text fw={600}>Danielle Rivers · Director of Partnerships</Text>
              <Text size="sm" c="dimmed">
                City Forward Foundation
              </Text>
            </Stack>
            <Card withBorder radius="lg" padding="xl" shadow="sm">
              <Stack gap="lg">
                <Stack gap={4}>
                  <Text fw={700} fz={34}>
                    4.6x ROI
                  </Text>
                  <Text size="sm" c="dimmed">
                    Average within the first 6 months on platform
                  </Text>
                </Stack>
                <Divider my="sm" />
                <Stack gap="md">
                  <Group justify="space-between">
                    <Text fw={600}>Awarded proposals</Text>
                    <Badge color="grape" variant="filled">
                      +38%
                    </Badge>
                  </Group>
                  <Group justify="space-between">
                    <Text fw={600}>Review cycles saved</Text>
                    <Badge color="green" variant="filled">
                      112 hrs
                    </Badge>
                  </Group>
                  <Group justify="space-between">
                    <Text fw={600}>Stakeholder satisfaction</Text>
                    <Badge color="blue" variant="filled">
                      9.4 / 10
                    </Badge>
                  </Group>
                </Stack>
              </Stack>
            </Card>
          </SimpleGrid>
        </Container>
      </Box>

      <Container size="lg" py={{ base: 80, md: 120 }}>
        <Card
          radius="lg"
          padding="xl"
          shadow="xl"
          withBorder
          style={{ paddingInline: "clamp(1.5rem, 6vw, 4rem)", paddingBlock: "clamp(2rem, 6vw, 4rem)" }}
        >
          <Stack align="center" gap="lg">
            <Badge size="lg" color="grape" variant="light">
              Ready to accelerate funding?
            </Badge>
            <Title order={2} ta="center" maw={520}>
              Bring unparalleled clarity to your grant strategy
            </Title>
            <Text ta="center" c="dimmed" maw={520}>
              Launch GrantCue across your organization in under two weeks with guided onboarding
              and data migration support from our specialist team.
            </Text>
            <Group gap="md" wrap="wrap" justify="center">
              <Button size="lg" color="grape" component={Link} to="/signup">
                Get started
              </Button>
              <Button size="lg" variant="default" component={Link} to="/features">
                Explore features
              </Button>
            </Group>
          </Stack>
        </Card>
      </Container>

      {/* Get Started Section */}
      <Container size="lg" py={{ base: 60, md: 80 }}>
        <Stack gap={60}>
          <Stack gap="sm" align="center">
            <Title order={2} ta="center">
              Get Started with GrantCue
            </Title>
            <Text size="lg" c="dimmed" ta="center" maw={640}>
              Choose the right plan for your team or migrate your existing grants effortlessly
            </Text>
          </Stack>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
            <Card padding="xl" radius="lg" withBorder>
              <Stack gap="md">
                <ThemeIcon color="grape" variant="light" size={48} radius="md">
                  <IconChartBar size={26} />
                </ThemeIcon>
                <Title order={3}>View Pricing Plans</Title>
                <Text c="dimmed">
                  From free plans for individuals to enterprise solutions for large teams, find the
                  perfect fit for your organization's grant management needs.
                </Text>
                <Button variant="light" color="grape" component={Link} to="/pricing" fullWidth mt="auto">
                  View Pricing
                </Button>
              </Stack>
            </Card>
            <Card padding="xl" radius="lg" withBorder>
              <Stack gap="md">
                <ThemeIcon color="blue" variant="light" size={48} radius="md">
                  <IconUsers size={26} />
                </ThemeIcon>
                <Title order={3}>Import from GrantHub</Title>
                <Text c="dimmed">
                  Already using GrantHub? Seamlessly migrate all your grants, data, and team
                  information to GrantCue with our dedicated import tool.
                </Text>
                <Button variant="light" color="blue" component={Link} to="/granthub-migration" fullWidth mt="auto">
                  Start Import
                </Button>
              </Stack>
            </Card>
          </SimpleGrid>
        </Stack>
      </Container>

      <Box bg="var(--mantine-color-dark-8)" c="var(--mantine-color-gray-2)" py="xl">
        <Container size="lg">
          <Group justify="space-between" align="center">
            <Stack gap={0}>
              <Text fw={700} c="white">
                GrantCue
              </Text>
              <Text size="sm" c="dimmed">
                Purpose-built funding operations for ambitious teams.
              </Text>
            </Stack>
            <Group gap="xl" visibleFrom="sm">
              <Anchor size="sm" c="gray.4" component={Link} to="/terms">
                Terms
              </Anchor>
              <Anchor size="sm" c="gray.4" component={Link} to="/privacy">
                Privacy
              </Anchor>
              <Anchor size="sm" c="gray.4" component={Link} to="/security">
                Security
              </Anchor>
              <Anchor size="sm" c="gray.4" component={Link} to="/support">
                Support
              </Anchor>
            </Group>
          </Group>
        </Container>
      </Box>
    </Box>
  );
}
