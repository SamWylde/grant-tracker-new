import {
  Container,
  Stack,
  Title,
  Text,
  Paper,
  Button,
  Group,
  SimpleGrid,
  Card,
  List,
  ThemeIcon,
  Badge,
  Divider,
  Timeline,
  Alert,
} from '@mantine/core';
import {
  IconCheck,
  IconArrowRight,
  IconFileImport,
  IconRocket,
  IconShieldCheck,
  IconClock,
  IconTrendingUp,
  IconAlertCircle,
  IconDownload,
  IconUpload,
  IconChecklist,
} from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';

export function GrantHubMigrationPage() {
  return (
    <>
      <AppHeader subtitle="" />
      <Container size="xl" py="xl">
        <Stack gap="xl">
          {/* Hero Section */}
          <Stack gap="md" align="center" mt="xl">
            <Badge size="lg" variant="light" color="red">
              GrantHub End-of-Life Notice
            </Badge>
            <Title order={1} ta="center" size={48}>
              Migrate from GrantHub to GrantQue
            </Title>
            <Text size="xl" ta="center" c="dimmed" maw={700}>
              Foundant is discontinuing GrantHub. Switch to GrantQue today for a modern,
              affordable alternative with all the features you need.
            </Text>
            <Group mt="md">
              <Button size="lg" component={Link} to="/signin" rightSection={<IconRocket size={20} />}>
                Start Free Trial
              </Button>
              <Button size="lg" variant="light" component={Link} to="/import/granthub">
                Import Your Data
              </Button>
            </Group>
          </Stack>

          <Divider my="xl" />

          {/* Timeline Alert */}
          <Alert icon={<IconAlertCircle size={20} />} color="red" variant="light" title="Important Dates">
            <Text size="sm">
              GrantHub and GrantHub Pro will be discontinued by Foundant. Don't wait until the last
              minute – migrate your data today and ensure continuity in your grant management.
            </Text>
          </Alert>

          {/* Why Switch Section */}
          <Stack gap="md">
            <Title order={2} ta="center">
              Why GrantQue?
            </Title>
            <Text ta="center" c="dimmed" size="lg" maw={700} mx="auto">
              Built specifically for nonprofits switching from GrantHub
            </Text>

            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg" mt="md">
              <Card padding="lg" withBorder>
                <Stack gap="md">
                  <ThemeIcon size={48} radius="md" color="green">
                    <IconFileImport size={24} />
                  </ThemeIcon>
                  <Title order={3} size="h4">
                    Easy Migration
                  </Title>
                  <Text size="sm" c="dimmed">
                    Import your entire GrantHub database with our one-click CSV importer. No data
                    loss, no manual entry.
                  </Text>
                </Stack>
              </Card>

              <Card padding="lg" withBorder>
                <Stack gap="md">
                  <ThemeIcon size={48} radius="md" color="blue">
                    <IconTrendingUp size={24} />
                  </ThemeIcon>
                  <Title order={3} size="h4">
                    More Features
                  </Title>
                  <Text size="sm" c="dimmed">
                    Fit scoring, automated alerts, smart recommendations, and integrations with
                    your favorite tools.
                  </Text>
                </Stack>
              </Card>

              <Card padding="lg" withBorder>
                <Stack gap="md">
                  <ThemeIcon size={48} radius="md" color="grape">
                    <IconShieldCheck size={24} />
                  </ThemeIcon>
                  <Title order={3} size="h4">
                    Lower Cost
                  </Title>
                  <Text size="sm" c="dimmed">
                    Transparent pricing starting at just $49/month. No hidden fees, no surprises.
                    Cancel anytime.
                  </Text>
                </Stack>
              </Card>
            </SimpleGrid>
          </Stack>

          <Divider my="xl" />

          {/* Migration Process */}
          <Stack gap="md">
            <Title order={2} ta="center">
              How to Migrate in 3 Easy Steps
            </Title>
            <Text ta="center" c="dimmed" size="lg" maw={700} mx="auto">
              Get up and running in under 10 minutes
            </Text>

            <Timeline mt="xl" active={3} bulletSize={32}>
              <Timeline.Item
                bullet={<IconDownload size={16} />}
                title="Export from GrantHub"
                color="blue"
              >
                <Text size="sm" c="dimmed" mt={4}>
                  Log in to GrantHub, navigate to your grants list, and click "Export CSV". Save
                  the file to your computer.
                </Text>
              </Timeline.Item>

              <Timeline.Item
                bullet={<IconUpload size={16} />}
                title="Import to GrantQue"
                color="grape"
              >
                <Text size="sm" c="dimmed" mt={4}>
                  Sign up for GrantQue, go to the import page, and upload your CSV file. We'll
                  automatically map and import your data.
                </Text>
              </Timeline.Item>

              <Timeline.Item
                bullet={<IconChecklist size={16} />}
                title="Review & Start Working"
                color="green"
              >
                <Text size="sm" c="dimmed" mt={4}>
                  Review your imported grants, invite your team, and start managing your pipeline
                  with powerful new tools.
                </Text>
              </Timeline.Item>
            </Timeline>

            <Group justify="center" mt="xl">
              <Button
                size="lg"
                component={Link}
                to="/import/granthub"
                rightSection={<IconArrowRight size={20} />}
              >
                Start Migration Now
              </Button>
            </Group>
          </Stack>

          <Divider my="xl" />

          {/* Feature Comparison */}
          <Stack gap="md">
            <Title order={2} ta="center">
              What You Get with GrantQue
            </Title>
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg" mt="md">
              <Paper p="md" withBorder>
                <Stack gap="sm">
                  <Title order={4}>All GrantHub Features</Title>
                  <List
                    spacing="xs"
                    size="sm"
                    icon={
                      <ThemeIcon color="green" size={20} radius="xl">
                        <IconCheck size={12} />
                      </ThemeIcon>
                    }
                  >
                    <List.Item>Kanban pipeline management</List.Item>
                    <List.Item>Task tracking and reminders</List.Item>
                    <List.Item>Team collaboration</List.Item>
                    <List.Item>Grant search and discovery</List.Item>
                    <List.Item>Deadline tracking</List.Item>
                    <List.Item>Notes and documentation</List.Item>
                  </List>
                </Stack>
              </Paper>

              <Paper p="md" withBorder bg="var(--mantine-color-grape-0)">
                <Stack gap="sm">
                  <Group gap="xs">
                    <Title order={4}>Plus New Features</Title>
                    <Badge color="grape">New!</Badge>
                  </Group>
                  <List
                    spacing="xs"
                    size="sm"
                    icon={
                      <ThemeIcon color="grape" size={20} radius="xl">
                        <IconCheck size={12} />
                      </ThemeIcon>
                    }
                  >
                    <List.Item>AI-powered fit scoring</List.Item>
                    <List.Item>Automated grant alerts</List.Item>
                    <List.Item>Quick-add from URL</List.Item>
                    <List.Item>Saved search views</List.Item>
                    <List.Item>Success metrics tracking</List.Item>
                    <List.Item>Webhook integrations</List.Item>
                  </List>
                </Stack>
              </Paper>
            </SimpleGrid>
          </Stack>

          <Divider my="xl" />

          {/* CTA Section */}
          <Paper p="xl" withBorder bg="var(--mantine-color-grape-0)">
            <Stack gap="md" align="center">
              <Title order={2} ta="center">
                Ready to Make the Switch?
              </Title>
              <Text ta="center" size="lg" c="dimmed" maw={600}>
                Join nonprofits already using GrantQue to manage their grant pipelines more
                effectively.
              </Text>
              <Group mt="md">
                <Button size="lg" component={Link} to="/signin" rightSection={<IconRocket size={20} />}>
                  Start Free Trial
                </Button>
                <Button size="lg" variant="light" component={Link} to="/pricing">
                  View Pricing
                </Button>
              </Group>
              <Text size="sm" c="dimmed">
                No credit card required • 14-day free trial • Cancel anytime
              </Text>
            </Stack>
          </Paper>

          {/* Support Section */}
          <Card padding="lg" withBorder>
            <Stack gap="sm">
              <Group>
                <ThemeIcon size={40} radius="md" color="blue">
                  <IconClock size={20} />
                </ThemeIcon>
                <div>
                  <Title order={4}>Need Help Migrating?</Title>
                  <Text size="sm" c="dimmed">
                    Our team is here to help you transition smoothly
                  </Text>
                </div>
              </Group>
              <Text size="sm">
                We offer free migration assistance for GrantHub users. Schedule a call with our team
                to get personalized help importing your data and setting up your account.
              </Text>
              <Group>
                <Button variant="light" component="a" href="mailto:support@grantcue.com">
                  Contact Support
                </Button>
                <Button variant="subtle" component={Link} to="/features">
                  Learn More
                </Button>
              </Group>
            </Stack>
          </Card>
        </Stack>
      </Container>
    </>
  );
}
