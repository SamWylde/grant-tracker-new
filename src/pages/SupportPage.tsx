import {
  Anchor,
  Badge,
  Box,
  Burger,
  Button,
  Card,
  Container,
  Divider,
  Drawer,
  Group,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Accordion,
} from "@mantine/core";
import {
  IconMail,
  IconBook,
  IconHelp,
  IconMessageCircle,
  IconRocket,
  IconBulb,
  IconSettings,
  IconUsers,
} from "@tabler/icons-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { AppHeader } from "../components/AppHeader";

export function SupportPage() {
  const { user } = useAuth();
  const [mobileMenuOpened, setMobileMenuOpened] = useState(false);

  return (
    <Box bg="var(--mantine-color-gray-0)" mih="100vh">
      {user ? (
        <AppHeader subtitle="Help & Support" />
      ) : (
        <Box
          component="header"
          px="md"
          py="lg"
          style={{
            backdropFilter: "blur(18px)",
            position: "sticky",
            top: 0,
            zIndex: 100,
          }}
        >
          <Container size="lg">
            <Group justify="space-between">
              <Group gap={6}>
                <ThemeIcon variant="light" color="grape" size={38} radius="xl">
                  <IconRocket size={20} />
                </ThemeIcon>
                <Stack gap={0}>
                  <Text fw={700}>GrantCue</Text>
                  <Text size="xs" c="dimmed">
                    Funding visibility for every team
                  </Text>
                </Stack>
              </Group>

              <Group gap="sm" visibleFrom="sm">
                <Anchor size="sm" c="dark" component={Link} to="/discover">
                  Discover Grants
                </Anchor>
                <Anchor size="sm" c="dark" component={Link} to="/features">
                  Features
                </Anchor>
                <Anchor size="sm" c="dark" component={Link} to="/pricing">
                  Pricing
                </Anchor>
                <Button variant="light" color="grape" component={Link} to="/signin">
                  Sign in
                </Button>
                <Button color="grape" component={Link} to="/signup">
                  Get started
                </Button>
              </Group>

              <Burger
                opened={mobileMenuOpened}
                onClick={() => setMobileMenuOpened(!mobileMenuOpened)}
                hiddenFrom="sm"
                size="sm"
              />
            </Group>

            <Drawer
              opened={mobileMenuOpened}
              onClose={() => setMobileMenuOpened(false)}
              size="xs"
              padding="md"
              title="Menu"
              hiddenFrom="sm"
              position="right"
            >
              <Stack gap="lg">
                <Anchor
                  component={Link}
                  to="/discover"
                  c="dark"
                  onClick={() => setMobileMenuOpened(false)}
                >
                  Discover Grants
                </Anchor>
                <Anchor
                  component={Link}
                  to="/features"
                  c="dark"
                  onClick={() => setMobileMenuOpened(false)}
                >
                  Features
                </Anchor>
                <Anchor
                  component={Link}
                  to="/pricing"
                  c="dark"
                  onClick={() => setMobileMenuOpened(false)}
                >
                  Pricing
                </Anchor>
                <Divider />
                <Button
                  variant="light"
                  color="grape"
                  component={Link}
                  to="/signin"
                  fullWidth
                  onClick={() => setMobileMenuOpened(false)}
                >
                  Sign in
                </Button>
                <Button
                  color="grape"
                  component={Link}
                  to="/signup"
                  fullWidth
                  onClick={() => setMobileMenuOpened(false)}
                >
                  Get started
                </Button>
              </Stack>
            </Drawer>
          </Container>
        </Box>
      )}

      {/* Hero Section */}
      <Box
        component="section"
        py={{ base: 60, md: 80 }}
        bg="linear-gradient(135deg, var(--mantine-color-grape-0) 0%, var(--mantine-color-indigo-0) 100%)"
      >
        <Container size="lg">
          <Stack align="center" gap="lg" ta="center">
            <Badge size="lg" variant="light" color="grape">
              Help & Support
            </Badge>
            <Title order={1} fz={{ base: 36, md: 48 }}>
              We're here to help
            </Title>
            <Text size="lg" c="dimmed" maw={640}>
              Get the support you need to make the most of GrantCue. From quick answers to personalized
              assistance, we've got you covered.
            </Text>
          </Stack>
        </Container>
      </Box>

      {/* Contact Options */}
      <Container size="lg" py={{ base: 60, md: 80 }}>
        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
          <Card padding="xl" radius="lg" withBorder>
            <Stack align="center" gap="md">
              <ThemeIcon color="grape" variant="light" size={64} radius="xl">
                <IconMail size={32} />
              </ThemeIcon>
              <Title order={4}>Email Support</Title>
              <Text c="dimmed" ta="center" size="sm">
                Send us an email and we'll get back to you within 24 hours.
              </Text>
              <Button
                variant="light"
                color="grape"
                fullWidth
                component="a"
                href="mailto:support@grantcue.com"
              >
                Email Us
              </Button>
            </Stack>
          </Card>

          <Card padding="xl" radius="lg" withBorder>
            <Stack align="center" gap="md">
              <ThemeIcon color="blue" variant="light" size={64} radius="xl">
                <IconBook size={32} />
              </ThemeIcon>
              <Title order={4}>Documentation</Title>
              <Text c="dimmed" ta="center" size="sm">
                Browse our comprehensive guides and tutorials.
              </Text>
              <Button
                variant="light"
                color="blue"
                fullWidth
                component="a"
                href="https://docs.grantcue.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                View Docs
              </Button>
            </Stack>
          </Card>

          <Card padding="xl" radius="lg" withBorder>
            <Stack align="center" gap="md">
              <ThemeIcon color="green" variant="light" size={64} radius="xl">
                <IconMessageCircle size={32} />
              </ThemeIcon>
              <Title order={4}>Live Chat</Title>
              <Text c="dimmed" ta="center" size="sm">
                Chat with our support team in real-time during business hours.
              </Text>
              <Button
                variant="light"
                color="green"
                fullWidth
                disabled
              >
                Coming Soon
              </Button>
            </Stack>
          </Card>
        </SimpleGrid>
      </Container>

      {/* FAQ Section */}
      <Box bg="var(--mantine-color-gray-1)" py={{ base: 60, md: 80 }}>
        <Container size="md">
          <Stack gap="xl">
            <Stack gap="sm" align="center">
              <Title order={2} ta="center">
                Frequently Asked Questions
              </Title>
              <Text c="dimmed" ta="center">
                Quick answers to common questions
              </Text>
            </Stack>

            <Accordion variant="separated">
              <Accordion.Item value="getting-started">
                <Accordion.Control icon={<IconBulb size={20} />}>
                  How do I get started with GrantCue?
                </Accordion.Control>
                <Accordion.Panel>
                  <Text size="sm">
                    Getting started is easy! Simply sign up for a free account, create your organization, and
                    start discovering grants. You can import existing grants from CSV files or add them
                    individually. Check out our onboarding guide for step-by-step instructions.
                  </Text>
                </Accordion.Panel>
              </Accordion.Item>

              <Accordion.Item value="team-members">
                <Accordion.Control icon={<IconUsers size={20} />}>
                  How do I invite team members?
                </Accordion.Control>
                <Accordion.Panel>
                  <Text size="sm">
                    Go to Settings → Team Members and click "Invite Member". Enter their email address and
                    select their role (Admin, Member, or Viewer). They'll receive an invitation email with
                    instructions to join your organization.
                  </Text>
                </Accordion.Panel>
              </Accordion.Item>

              <Accordion.Item value="reminders">
                <Accordion.Control icon={<IconSettings size={20} />}>
                  How do deadline reminders work?
                </Accordion.Control>
                <Accordion.Panel>
                  <Text size="sm">
                    GrantCue automatically sends email reminders for upcoming grant deadlines. You can
                    customize reminder timing in Settings → Notifications. Pro plan users also get access to
                    SMS reminders and calendar integrations.
                  </Text>
                </Accordion.Panel>
              </Accordion.Item>

              <Accordion.Item value="import">
                <Accordion.Control icon={<IconHelp size={20} />}>
                  Can I import grants from a spreadsheet?
                </Accordion.Control>
                <Accordion.Panel>
                  <Text size="sm">
                    Yes! Go to the Saved Grants page and click "Import Grants". You can upload a CSV file with
                    your grant data. Our import wizard will help you map your columns to GrantCue fields. We
                    support imports from Excel, Google Sheets, and other grant tracking tools.
                  </Text>
                </Accordion.Panel>
              </Accordion.Item>

              <Accordion.Item value="billing">
                <Accordion.Control icon={<IconHelp size={20} />}>
                  How does billing work?
                </Accordion.Control>
                <Accordion.Panel>
                  <Text size="sm">
                    You can choose between monthly or annual billing. Annual plans save you 20% compared to
                    monthly billing. All plans come with a 14-day free trial. You can upgrade, downgrade, or
                    cancel at any time with no penalties.
                  </Text>
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
          </Stack>
        </Container>
      </Box>

      {/* Support Resources */}
      <Container size="lg" py={{ base: 60, md: 80 }}>
        <Stack gap="xl">
          <Stack gap="sm" align="center">
            <Title order={2} ta="center">
              Support Resources
            </Title>
            <Text c="dimmed" ta="center" maw={640}>
              Additional resources to help you succeed
            </Text>
          </Stack>

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
            <Card padding="lg" withBorder>
              <Stack gap="md">
                <Group>
                  <ThemeIcon color="grape" variant="light" size={40} radius="md">
                    <IconBook size={22} />
                  </ThemeIcon>
                  <Title order={4}>Knowledge Base</Title>
                </Group>
                <Text size="sm" c="dimmed">
                  Browse detailed articles covering all aspects of GrantCue, from basic setup to advanced
                  features.
                </Text>
                <Button
                  variant="light"
                  color="grape"
                  component="a"
                  href="https://docs.grantcue.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Browse Articles
                </Button>
              </Stack>
            </Card>

            <Card padding="lg" withBorder>
              <Stack gap="md">
                <Group>
                  <ThemeIcon color="blue" variant="light" size={40} radius="md">
                    <IconHelp size={22} />
                  </ThemeIcon>
                  <Title order={4}>Video Tutorials</Title>
                </Group>
                <Text size="sm" c="dimmed">
                  Watch step-by-step video guides to learn how to use key features and best practices.
                </Text>
                <Button
                  variant="light"
                  color="blue"
                  component="a"
                  href="https://www.youtube.com/@grantcue"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Watch Videos
                </Button>
              </Stack>
            </Card>
          </SimpleGrid>
        </Stack>
      </Container>

      {/* Contact CTA */}
      <Box bg="var(--mantine-color-gray-1)" py={{ base: 60, md: 80 }}>
        <Container size="sm">
          <Card radius="lg" padding="xl" shadow="xl" withBorder bg="white">
            <Stack align="center" gap="lg">
              <Title order={2} ta="center">
                Still need help?
              </Title>
              <Text ta="center" c="dimmed">
                Our support team is standing by to assist you with any questions or issues.
              </Text>
              <Button
                size="lg"
                color="grape"
                component="a"
                href="mailto:support@grantcue.com"
              >
                Contact Support
              </Button>
            </Stack>
          </Card>
        </Container>
      </Box>

      {/* Footer */}
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
