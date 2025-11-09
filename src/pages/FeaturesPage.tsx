import { useState } from 'react';
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
  List,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Accordion,
  Paper,
} from '@mantine/core';
import {
  IconRocket,
  IconClock,
  IconUsers,
  IconChartBar,
  IconBell,
  IconCalendar,
  IconCheck,
  IconFileText,
  IconSearch,
  IconShieldCheck,
  IconBrandSlack,
  IconMail,
  IconCode,
  IconChecklist,
  IconCreditCard,
} from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function FeaturesPage() {
  const { user } = useAuth();
  const [mobileMenuOpened, setMobileMenuOpened] = useState(false);

  return (
    <Box bg="var(--mantine-color-gray-0)" mih="100vh">
      {/* Header */}
      <Box
        component="header"
        px="md"
        py="lg"
        bg="white"
        style={{
          borderBottom: '1px solid var(--mantine-color-gray-3)',
          position: 'sticky',
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
                <Text fw={700} component={Link} to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
                  GrantCue
                </Text>
                <Text size="xs" c="dimmed">
                  Funding visibility for every team
                </Text>
              </Stack>
            </Group>

            {/* Desktop Navigation */}
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
              {user ? (
                <Button color="grape" component={Link} to="/saved">
                  Dashboard
                </Button>
              ) : (
                <>
                  <Button variant="light" color="grape" component={Link} to="/signin">
                    Sign in
                  </Button>
                  <Button color="grape" component={Link} to="/signin">
                    Start free trial
                  </Button>
                </>
              )}
            </Group>

            {/* Mobile Menu Button */}
            <Burger
              opened={mobileMenuOpened}
              onClick={() => setMobileMenuOpened(!mobileMenuOpened)}
              hiddenFrom="sm"
              size="sm"
            />
          </Group>

          {/* Mobile Navigation Drawer */}
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
              <Anchor component={Link} to="/discover" c="dark" onClick={() => setMobileMenuOpened(false)}>
                Discover Grants
              </Anchor>
              <Anchor component={Link} to="/features" c="dark" onClick={() => setMobileMenuOpened(false)}>
                Features
              </Anchor>
              <Anchor component={Link} to="/pricing" c="dark" onClick={() => setMobileMenuOpened(false)}>
                Pricing
              </Anchor>
              <Divider />
              {user ? (
                <Button
                  color="grape"
                  component={Link}
                  to="/saved"
                  fullWidth
                  onClick={() => setMobileMenuOpened(false)}
                >
                  Dashboard
                </Button>
              ) : (
                <>
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
                    to="/signin"
                    fullWidth
                    onClick={() => setMobileMenuOpened(false)}
                  >
                    Start free trial
                  </Button>
                </>
              )}
            </Stack>
          </Drawer>
        </Container>
      </Box>

      {/* Hero Section */}
      <Box
        component="section"
        py={{ base: 60, md: 80 }}
        bg="linear-gradient(135deg, var(--mantine-color-grape-0) 0%, var(--mantine-color-indigo-0) 100%)"
      >
        <Container size="lg">
          <Stack align="center" gap="lg" ta="center">
            <Badge size="lg" variant="light" color="grape">
              Everything you need to succeed
            </Badge>
            <Title order={1} fz={{ base: 36, md: 48 }}>
              Powerful features for grant management
            </Title>
            <Text size="lg" c="dimmed" maw={640}>
              From discovery to submission, GrantCue gives your team the tools to streamline the entire grant
              lifecycle.
            </Text>
          </Stack>
        </Container>
      </Box>

      {/* Core Features */}
      <Container size="lg" py={{ base: 60, md: 80 }}>
        <Stack gap="xl">
          <Stack gap="sm" align="center">
            <Badge size="lg" variant="light" color="grape">
              Core Features
            </Badge>
            <Title order={2} ta="center">
              Everything you need in one place
            </Title>
          </Stack>

          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
            {/* Grant Discovery */}
            <Card padding="xl" radius="lg" withBorder>
              <ThemeIcon color="grape" variant="light" size={48} radius="md" mb="md">
                <IconSearch size={26} />
              </ThemeIcon>
              <Title order={4} mb="sm">
                Grant Discovery
              </Title>
              <Text c="dimmed" mb="md">
                Search and filter thousands of federal grants from Grants.gov with advanced search capabilities.
              </Text>
              <List
                spacing="xs"
                size="sm"
                icon={
                  <ThemeIcon size={20} radius="xl" color="grape" variant="light">
                    <IconCheck size={12} />
                  </ThemeIcon>
                }
              >
                <List.Item>Quick search with cmd/ctrl+K</List.Item>
                <List.Item>Smart filters and sorting</List.Item>
                <List.Item>Saved views and recent searches</List.Item>
                <List.Item>Enhanced grant detail modal</List.Item>
              </List>
            </Card>

            {/* Deadline Tracking */}
            <Card padding="xl" radius="lg" withBorder>
              <ThemeIcon color="blue" variant="light" size={48} radius="md" mb="md">
                <IconClock size={26} />
              </ThemeIcon>
              <Title order={4} mb="sm">
                Smart Deadline Tracking
              </Title>
              <Text c="dimmed" mb="md">
                Never miss a deadline with automated reminders and visual deadline indicators.
              </Text>
              <List
                spacing="xs"
                size="sm"
                icon={
                  <ThemeIcon size={20} radius="xl" color="blue" variant="light">
                    <IconCheck size={12} />
                  </ThemeIcon>
                }
              >
                <List.Item>Automated email reminders</List.Item>
                <List.Item>Customizable notification schedule</List.Item>
                <List.Item>Visual deadline countdown</List.Item>
                <List.Item>Overdue grant alerts</List.Item>
              </List>
            </Card>

            {/* Calendar Integration */}
            <Card padding="xl" radius="lg" withBorder>
              <ThemeIcon color="green" variant="light" size={48} radius="md" mb="md">
                <IconCalendar size={26} />
              </ThemeIcon>
              <Title order={4} mb="sm">
                Calendar Integration
              </Title>
              <Text c="dimmed" mb="md">
                Sync deadlines with your existing calendar tools for seamless workflow integration.
              </Text>
              <List
                spacing="xs"
                size="sm"
                icon={
                  <ThemeIcon size={20} radius="xl" color="green" variant="light">
                    <IconCheck size={12} />
                  </ThemeIcon>
                }
              >
                <List.Item>ICS calendar feed</List.Item>
                <List.Item>Google Calendar sync</List.Item>
                <List.Item>Outlook integration</List.Item>
                <List.Item>Two-way sync support</List.Item>
              </List>
            </Card>

            {/* Team Collaboration */}
            <Card padding="xl" radius="lg" withBorder>
              <ThemeIcon color="orange" variant="light" size={48} radius="md" mb="md">
                <IconUsers size={26} />
              </ThemeIcon>
              <Title order={4} mb="sm">
                Team Collaboration
              </Title>
              <Text c="dimmed" mb="md">
                Work together seamlessly with role-based access and team management tools.
              </Text>
              <List
                spacing="xs"
                size="sm"
                icon={
                  <ThemeIcon size={20} radius="xl" color="orange" variant="light">
                    <IconCheck size={12} />
                  </ThemeIcon>
                }
              >
                <List.Item>Unlimited team members</List.Item>
                <List.Item>Role-based permissions</List.Item>
                <List.Item>Team invitations</List.Item>
                <List.Item>Organization switching</List.Item>
              </List>
            </Card>

            {/* Analytics & Metrics */}
            <Card padding="xl" radius="lg" withBorder>
              <ThemeIcon color="grape" variant="light" size={48} radius="md" mb="md">
                <IconChartBar size={26} />
              </ThemeIcon>
              <Title order={4} mb="sm">
                Analytics & Metrics
              </Title>
              <Text c="dimmed" mb="md">
                Track your performance with comprehensive metrics and ROI reporting.
              </Text>
              <List
                spacing="xs"
                size="sm"
                icon={
                  <ThemeIcon size={20} radius="xl" color="grape" variant="light">
                    <IconCheck size={12} />
                  </ThemeIcon>
                }
              >
                <List.Item>Deadline success rate</List.Item>
                <List.Item>Time-to-submit tracking</List.Item>
                <List.Item>Award win rates</List.Item>
                <List.Item>Funding amount tracking</List.Item>
              </List>
            </Card>

            {/* Notifications */}
            <Card padding="xl" radius="lg" withBorder>
              <ThemeIcon color="red" variant="light" size={48} radius="md" mb="md">
                <IconBell size={26} />
              </ThemeIcon>
              <Title order={4} mb="sm">
                Smart Notifications
              </Title>
              <Text c="dimmed" mb="md">
                Stay informed with customizable notifications across multiple channels.
              </Text>
              <List
                spacing="xs"
                size="sm"
                icon={
                  <ThemeIcon size={20} radius="xl" color="red" variant="light">
                    <IconCheck size={12} />
                  </ThemeIcon>
                }
              >
                <List.Item>Email notifications</List.Item>
                <List.Item>SMS reminders (Pro)</List.Item>
                <List.Item>Slack integration</List.Item>
                <List.Item>Microsoft Teams integration</List.Item>
              </List>
            </Card>
          </SimpleGrid>
        </Stack>
      </Container>

      {/* Integrations */}
      <Box bg="var(--mantine-color-gray-1)" py={{ base: 60, md: 80 }}>
        <Container size="lg">
          <Stack gap="xl">
            <Stack gap="sm" align="center">
              <Badge size="lg" variant="light" color="grape">
                Integrations
              </Badge>
              <Title order={2} ta="center">
                Works with your favorite tools
              </Title>
              <Text size="lg" c="dimmed" ta="center" maw={640}>
                GrantCue integrates seamlessly with the tools you already use every day.
              </Text>
            </Stack>

            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="lg">
              <Card padding="lg" radius="lg" withBorder ta="center">
                <ThemeIcon size={64} radius="md" variant="light" color="blue" mx="auto" mb="md">
                  <IconCalendar size={32} />
                </ThemeIcon>
                <Text fw={600} mb={4}>
                  Google Calendar
                </Text>
                <Text size="sm" c="dimmed">
                  Sync deadlines
                </Text>
              </Card>

              <Card padding="lg" radius="lg" withBorder ta="center">
                <ThemeIcon size={64} radius="md" variant="light" color="indigo" mx="auto" mb="md">
                  <IconMail size={32} />
                </ThemeIcon>
                <Text fw={600} mb={4}>
                  Outlook
                </Text>
                <Text size="sm" c="dimmed">
                  Calendar integration
                </Text>
              </Card>

              <Card padding="lg" radius="lg" withBorder ta="center">
                <ThemeIcon size={64} radius="md" variant="light" color="pink" mx="auto" mb="md">
                  <IconBrandSlack size={32} />
                </ThemeIcon>
                <Text fw={600} mb={4}>
                  Slack
                </Text>
                <Text size="sm" c="dimmed">
                  Team notifications
                </Text>
              </Card>

              <Card padding="lg" radius="lg" withBorder ta="center">
                <ThemeIcon size={64} radius="md" variant="light" color="violet" mx="auto" mb="md">
                  <IconCode size={32} />
                </ThemeIcon>
                <Text fw={600} mb={4}>
                  Webhooks
                </Text>
                <Text size="sm" c="dimmed">
                  Custom integrations
                </Text>
              </Card>
            </SimpleGrid>
          </Stack>
        </Container>
      </Box>

      {/* Security & Compliance */}
      <Container size="lg" py={{ base: 60, md: 80 }}>
        <Stack gap="xl">
          <Stack gap="sm" align="center">
            <Badge size="lg" variant="light" color="grape">
              Security & Compliance
            </Badge>
            <Title order={2} ta="center">
              Enterprise-grade security
            </Title>
            <Text size="lg" c="dimmed" ta="center" maw={640}>
              Your data is protected with industry-leading security practices.
            </Text>
          </Stack>

          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
            <Card padding="xl" radius="lg" withBorder>
              <ThemeIcon color="green" variant="light" size={48} radius="md" mb="md">
                <IconShieldCheck size={26} />
              </ThemeIcon>
              <Title order={4} mb="sm">
                Data Encryption
              </Title>
              <Text c="dimmed">
                All data is encrypted in transit and at rest using industry-standard AES-256 encryption.
              </Text>
            </Card>

            <Card padding="xl" radius="lg" withBorder>
              <ThemeIcon color="blue" variant="light" size={48} radius="md" mb="md">
                <IconFileText size={26} />
              </ThemeIcon>
              <Title order={4} mb="sm">
                Row-Level Security
              </Title>
              <Text c="dimmed">
                Advanced database security ensures users only see data they're authorized to access.
              </Text>
            </Card>

            <Card padding="xl" radius="lg" withBorder>
              <ThemeIcon color="grape" variant="light" size={48} radius="md" mb="md">
                <IconUsers size={26} />
              </ThemeIcon>
              <Title order={4} mb="sm">
                Role-Based Access
              </Title>
              <Text c="dimmed">
                Control who can view, edit, and manage grants with granular permission settings.
              </Text>
            </Card>
          </SimpleGrid>
        </Stack>
      </Container>

      {/* Product Roadmap */}
      <Container size="lg" py={{ base: 60, md: 80 }}>
        <Stack gap="xl">
          <Stack gap="sm" align="center">
            <Badge size="lg" variant="light" color="grape">
              Product Roadmap
            </Badge>
            <Title order={2} ta="center">
              Our development plan
            </Title>
            <Text size="lg" c="dimmed" ta="center" maw={640}>
              Transparent roadmap showing current features and what's coming next. Items marked with priority (P0 = Critical, P1 = High, P2 = Nice-to-have).
            </Text>
          </Stack>

          <Accordion variant="separated" radius="md">
            {/* Core Features - In Progress */}
            <Accordion.Item value="core">
              <Accordion.Control icon={<IconChecklist size={20} />}>
                <Group justify="space-between">
                  <Text fw={600}>Authentication & Organizations</Text>
                  <Badge color="green" variant="light">Live</Badge>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <List spacing="xs" size="sm">
                  <List.Item><Badge size="sm" color="green">P0</Badge> Email/password auth via Supabase ✓</List.Item>
                  <List.Item><Badge size="sm" color="green">P0</Badge> Magic link sign-in ✓</List.Item>
                  <List.Item><Badge size="sm" color="green">P0</Badge> Organization creation & switcher ✓</List.Item>
                  <List.Item><Badge size="sm" color="green">P0</Badge> Roles: Admin, Contributor (RBAC) ✓</List.Item>
                  <List.Item><Badge size="sm" color="blue">P1</Badge> Invite members by email (In Progress)</List.Item>
                  <List.Item><Badge size="sm" color="blue">P1</Badge> 2FA (TOTP) (Planned)</List.Item>
                  <List.Item><Badge size="sm" color="gray">P2</Badge> SSO/SAML (Google/Microsoft) (Future)</List.Item>
                </List>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="discovery">
              <Accordion.Control icon={<IconSearch size={20} />}>
                <Group justify="space-between">
                  <Text fw={600}>Discovery & Search</Text>
                  <Badge color="green" variant="light">Live</Badge>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <List spacing="xs" size="sm">
                  <List.Item><Badge size="sm" color="green">P0</Badge> Grants.gov API integration ✓</List.Item>
                  <List.Item><Badge size="sm" color="green">P0</Badge> Advanced filters (category, agency, status, due ≤ X days) ✓</List.Item>
                  <List.Item><Badge size="sm" color="green">P0</Badge> Multi-sort (Relevance, Due Soon, Newest) ✓</List.Item>
                  <List.Item><Badge size="sm" color="green">P0</Badge> Enhanced grant cards with hover effects ✓</List.Item>
                  <List.Item><Badge size="sm" color="green">P0</Badge> Grant detail modal with HTML parsing ✓</List.Item>
                  <List.Item><Badge size="sm" color="green">P0</Badge> Save/track grants from results ✓</List.Item>
                  <List.Item><Badge size="sm" color="blue">P1</Badge> Quick search modal (cmd/ctrl+K) ✓</List.Item>
                  <List.Item><Badge size="sm" color="blue">P1</Badge> Recent searches tracking ✓</List.Item>
                  <List.Item><Badge size="sm" color="blue">P1</Badge> Saved views (shareable within org) ✓</List.Item>
                  <List.Item><Badge size="sm" color="blue">P1</Badge> Email alerts for saved searches (Planned)</List.Item>
                  <List.Item><Badge size="sm" color="gray">P2</Badge> Eligibility profile auto-filtering ✓</List.Item>
                  <List.Item><Badge size="sm" color="gray">P2</Badge> Grant interactions tracking (for recommendations) ✓</List.Item>
                  <List.Item><Badge size="sm" color="gray">P2</Badge> ML-based recommendation engine (Q2 2025)</List.Item>
                  <List.Item><Badge size="sm" color="gray">P2</Badge> State portals integration (Q2 2025)</List.Item>
                </List>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="workflow">
              <Accordion.Control icon={<IconChecklist size={20} />}>
                <Group justify="space-between">
                  <Text fw={600}>Tracking & Workflow</Text>
                  <Badge color="orange" variant="light">In Progress</Badge>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <List spacing="xs" size="sm">
                  <List.Item><Badge size="sm" color="green">P0</Badge> Pipeline board: Researching → Drafting → Submitted → Awarded ✓</List.Item>
                  <List.Item><Badge size="sm" color="green">P0</Badge> Per-grant timeline with multiple deadlines ✓</List.Item>
                  <List.Item><Badge size="sm" color="green">P0</Badge> Assign owner & priority (In Progress)</List.Item>
                  <List.Item><Badge size="sm" color="green">P0</Badge> Tasks with checklist templates (In Progress)</List.Item>
                  <List.Item><Badge size="sm" color="green">P0</Badge> Notes/comments with @mentions (Planned)</List.Item>
                  <List.Item><Badge size="sm" color="blue">P1</Badge> File links (Google Drive/OneDrive/Dropbox) (Q1 2025)</List.Item>
                  <List.Item><Badge size="sm" color="gray">P2</Badge> Approvals & stage gates (Future)</List.Item>
                </List>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="reminders">
              <Accordion.Control icon={<IconBell size={20} />}>
                <Group justify="space-between">
                  <Text fw={600}>Reminders & Calendar</Text>
                  <Badge color="green" variant="light">Live</Badge>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <List spacing="xs" size="sm">
                  <List.Item><Badge size="sm" color="green">P0</Badge> Email reminders (30/14/7/3/1 days) ✓</List.Item>
                  <List.Item><Badge size="sm" color="green">P0</Badge> Daily digest email ✓</List.Item>
                  <List.Item><Badge size="sm" color="green">P0</Badge> ICS calendar feed ✓</List.Item>
                  <List.Item><Badge size="sm" color="blue">P1</Badge> Google Calendar sync (In Progress)</List.Item>
                  <List.Item><Badge size="sm" color="blue">P1</Badge> Outlook Calendar sync (Planned)</List.Item>
                  <List.Item><Badge size="sm" color="blue">P1</Badge> SMS reminders (Twilio) (Q2 2025)</List.Item>
                  <List.Item><Badge size="sm" color="gray">P2</Badge> Slack/Teams reminders (Future)</List.Item>
                </List>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="analytics">
              <Accordion.Control icon={<IconChartBar size={20} />}>
                <Group justify="space-between">
                  <Text fw={600}>Reporting & Analytics</Text>
                  <Badge color="green" variant="light">Live</Badge>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <List spacing="xs" size="sm">
                  <List.Item><Badge size="sm" color="blue">P1</Badge> Dashboard: submissions, win rate, $ requested/awarded ✓</List.Item>
                  <List.Item><Badge size="sm" color="blue">P1</Badge> Deadline success rate tracking ✓</List.Item>
                  <List.Item><Badge size="sm" color="blue">P1</Badge> Time-to-submit metrics ✓</List.Item>
                  <List.Item><Badge size="sm" color="blue">P1</Badge> CSV export (Planned)</List.Item>
                  <List.Item><Badge size="sm" color="gray">P2</Badge> Scheduled email reports (Future)</List.Item>
                  <List.Item><Badge size="sm" color="gray">P2</Badge> Funder history analytics (Future)</List.Item>
                </List>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="integrations">
              <Accordion.Control icon={<IconCode size={20} />}>
                <Group justify="space-between">
                  <Text fw={600}>Integrations</Text>
                  <Badge color="orange" variant="light">In Progress</Badge>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <List spacing="xs" size="sm">
                  <List.Item><Badge size="sm" color="blue">P1</Badge> Google Drive file picker (Q1 2025)</List.Item>
                  <List.Item><Badge size="sm" color="blue">P1</Badge> Slack app & alerts (Q1 2025)</List.Item>
                  <List.Item><Badge size="sm" color="blue">P1</Badge> Zapier/Make triggers (Q2 2025)</List.Item>
                  <List.Item><Badge size="sm" color="gray">P2</Badge> Microsoft Teams & OneDrive (Q2 2025)</List.Item>
                  <List.Item><Badge size="sm" color="gray">P2</Badge> Webhooks for key events (Future)</List.Item>
                  <List.Item><Badge size="sm" color="gray">P2</Badge> Notion/Trello/Asana sync (Future)</List.Item>
                </List>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="billing">
              <Accordion.Control icon={<IconCreditCard size={20} />}>
                <Group justify="space-between">
                  <Text fw={600}>Billing & Plans</Text>
                  <Badge color="green" variant="light">Live</Badge>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <List spacing="xs" size="sm">
                  <List.Item><Badge size="sm" color="green">P0</Badge> Stripe integration ✓</List.Item>
                  <List.Item><Badge size="sm" color="green">P0</Badge> Free/Starter/Pro plans ✓</List.Item>
                  <List.Item><Badge size="sm" color="green">P0</Badge> Trial handling ✓</List.Item>
                  <List.Item><Badge size="sm" color="blue">P1</Badge> Coupons & association discounts (Q1 2025)</List.Item>
                  <List.Item><Badge size="sm" color="blue">P1</Badge> Annual billing with discount (Planned)</List.Item>
                  <List.Item><Badge size="sm" color="gray">P2</Badge> Tax/VAT support (Future)</List.Item>
                </List>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="ai">
              <Accordion.Control icon={<IconRocket size={20} />}>
                <Group justify="space-between">
                  <Text fw={600}>AI-Assisted Features</Text>
                  <Badge color="grape" variant="light">Coming Soon</Badge>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <List spacing="xs" size="sm">
                  <List.Item><Badge size="sm" color="blue">P1</Badge> NOFO summarizer (key dates, eligibility, amounts) (Q2 2025)</List.Item>
                  <List.Item><Badge size="sm" color="blue">P1</Badge> Deadline extractor from PDF/HTML (Q2 2025)</List.Item>
                  <List.Item><Badge size="sm" color="gray">P2</Badge> Draft task/checklist generator (Future)</List.Item>
                  <List.Item><Badge size="sm" color="gray">P2</Badge> Proposal outline assistant (Future)</List.Item>
                  <List.Item><Badge size="sm" color="gray">P2</Badge> Semantic search over saved grants (Future)</List.Item>
                </List>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="security">
              <Accordion.Control icon={<IconShieldCheck size={20} />}>
                <Group justify="space-between">
                  <Text fw={600}>Security & Compliance</Text>
                  <Badge color="green" variant="light">Live</Badge>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <List spacing="xs" size="sm">
                  <List.Item><Badge size="sm" color="green">P0</Badge> Row-level security (RLS) for all tables ✓</List.Item>
                  <List.Item><Badge size="sm" color="green">P0</Badge> Encrypted secrets & key rotation ✓</List.Item>
                  <List.Item><Badge size="sm" color="green">P0</Badge> Automated backups & point-in-time recovery ✓</List.Item>
                  <List.Item><Badge size="sm" color="green">P0</Badge> Audit log (who did what/when) ✓</List.Item>
                  <List.Item><Badge size="sm" color="blue">P1</Badge> Data retention & org export (GDPR/CCPA) (Q1 2025)</List.Item>
                  <List.Item><Badge size="sm" color="blue">P1</Badge> Access logs & anomaly alerts (Q2 2025)</List.Item>
                  <List.Item><Badge size="sm" color="gray">P2</Badge> SOC-2 compliance (2025 H2)</List.Item>
                </List>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>

          <Paper p="md" withBorder bg="var(--mantine-color-blue-0)">
            <Stack gap="sm">
              <Text fw={600} size="lg">Priority Guide</Text>
              <Group gap="md">
                <Badge color="green">P0</Badge>
                <Text size="sm">Critical - Must have for core functionality</Text>
              </Group>
              <Group gap="md">
                <Badge color="blue">P1</Badge>
                <Text size="sm">High - Important for user experience</Text>
              </Group>
              <Group gap="md">
                <Badge color="gray">P2</Badge>
                <Text size="sm">Nice-to-have - Future enhancements</Text>
              </Group>
            </Stack>
          </Paper>
        </Stack>
      </Container>

      {/* CTA */}
      <Box bg="var(--mantine-color-gray-1)" py={{ base: 60, md: 80 }}>
        <Container size="lg">
          <Card
            radius="lg"
            p="xl"
            shadow="xl"
            withBorder
            style={{ paddingInline: 'clamp(1.5rem, 6vw, 4rem)', paddingBlock: 'clamp(2rem, 6vw, 4rem)' }}
          >
            <Stack align="center" gap="lg">
              <Badge size="lg" color="grape" variant="light">
                Ready to get started?
              </Badge>
              <Title order={2} ta="center" maw={520}>
                Start tracking grants today
              </Title>
              <Text ta="center" c="dimmed" maw={520}>
                Join organizations that are already streamlining their grant management with GrantCue.
              </Text>
              <Group gap="md" wrap="wrap" justify="center">
                <Button size="lg" color="grape" component={Link} to="/signin">
                  Start free trial
                </Button>
                <Button size="lg" variant="default" component={Link} to="/pricing">
                  View pricing
                </Button>
              </Group>
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
              <Anchor size="sm" c="gray.4">
                Privacy
              </Anchor>
              <Anchor size="sm" c="gray.4">
                Security
              </Anchor>
              <Anchor size="sm" c="gray.4">
                Support
              </Anchor>
            </Group>
          </Group>
        </Container>
      </Box>
    </Box>
  );
}
