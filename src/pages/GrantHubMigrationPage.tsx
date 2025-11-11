import { Link } from 'react-router-dom';
import {
  Container,
  Stack,
  Title,
  Text,
  Button,
  Card,
  SimpleGrid,
  List,
  ThemeIcon,
  Stepper,
  Accordion,
  Box,
  Group,
  Badge,
  Paper,
  Divider,
  Alert,
  Anchor,
} from '@mantine/core';
import {
  IconRocket,
  IconCheck,
  IconUpload,
  IconSearch,
  IconUserCheck,
  IconClock,
  IconAlertCircle,
  IconArrowRight,
  IconFileImport,
  IconShieldCheck,
} from '@tabler/icons-react';
import { MarketingHeader } from '../components/MarketingHeader';
import { useAuth } from '../contexts/AuthContext';

export function GrantHubMigrationPage() {
  const { user } = useAuth();

  return (
    <Box>
      <MarketingHeader user={user} />

      {/* Hero Section */}
      <Box
        style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
        }}
        py={80}
      >
        <Container size="lg">
          <Stack gap="xl" align="center">
            <Badge size="xl" variant="light" color="yellow" radius="sm">
              GrantHub Shutting Down January 31, 2026
            </Badge>

            <Title order={1} size={48} ta="center" fw={800}>
              Seamlessly Migrate from GrantHub to GrantCue
            </Title>

            <Text size="xl" ta="center" maw={700} opacity={0.95}>
              Don't lose your grant pipeline. Import all your GrantHub data in minutes
              and continue tracking opportunities without missing a beat.
            </Text>

            <Group gap="md" mt="md">
              {user ? (
                <Button
                  component={Link}
                  to="/import/granthub"
                  size="xl"
                  color="white"
                  variant="filled"
                  rightSection={<IconArrowRight size={20} />}
                  styles={{
                    root: {
                      color: '#667eea',
                      '&:hover': { backgroundColor: 'rgba(255,255,255,0.9)' },
                    },
                  }}
                >
                  Start Migration Now
                </Button>
              ) : (
                <>
                  <Button
                    component={Link}
                    to="/signup"
                    size="xl"
                    color="white"
                    variant="filled"
                    rightSection={<IconArrowRight size={20} />}
                    styles={{
                      root: {
                        color: '#667eea',
                        '&:hover': { backgroundColor: 'rgba(255,255,255,0.9)' },
                      },
                    }}
                  >
                    Get Started Free
                  </Button>
                  <Button
                    component={Link}
                    to="/signin"
                    size="xl"
                    variant="outline"
                    color="white"
                  >
                    Sign In to Import
                  </Button>
                </>
              )}
            </Group>

            <Alert
              icon={<IconAlertCircle size={16} />}
              color="yellow"
              variant="filled"
              mt="xl"
              maw={600}
            >
              <Text fw={600} size="sm">
                Time-Sensitive: GrantHub users have until January 31, 2026 to export their data.
                Migrate now to avoid last-minute data loss.
              </Text>
            </Alert>
          </Stack>
        </Container>
      </Box>

      {/* Why Choose GrantCue */}
      <Container size="lg" py={80}>
        <Stack gap="xl">
          <Stack gap="sm" align="center">
            <Title order={2} ta="center">
              Why Choose GrantCue?
            </Title>
            <Text size="lg" c="dimmed" ta="center" maw={600}>
              Built by grant professionals who understand your workflow
            </Text>
          </Stack>

          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
            <Card padding="xl" withBorder>
              <Stack gap="md">
                <ThemeIcon size={48} radius="md" color="grape" variant="light">
                  <IconFileImport size={24} />
                </ThemeIcon>
                <Title order={3} size="h4">
                  Seamless Migration
                </Title>
                <Text c="dimmed">
                  Import your entire GrantHub pipeline in minutes. Our CSV importer handles
                  your grant titles, deadlines, agencies, notes, and statuses automatically.
                </Text>
              </Stack>
            </Card>

            <Card padding="xl" withBorder>
              <Stack gap="md">
                <ThemeIcon size={48} radius="md" color="blue" variant="light">
                  <IconSearch size={24} />
                </ThemeIcon>
                <Title order={3} size="h4">
                  Enhanced Features
                </Title>
                <Text c="dimmed">
                  Go beyond basic tracking with real-time Grants.gov integration, advanced
                  filtering, board packets, team collaboration, and priority management.
                </Text>
              </Stack>
            </Card>

            <Card padding="xl" withBorder>
              <Stack gap="md">
                <ThemeIcon size={48} radius="md" color="green" variant="light">
                  <IconClock size={24} />
                </ThemeIcon>
                <Title order={3} size="h4">
                  Save Time
                </Title>
                <Text c="dimmed">
                  Stop manually checking Grants.gov. GrantCue syncs opportunities daily and
                  alerts you to relevant deadlines, status changes, and new postings.
                </Text>
              </Stack>
            </Card>

            <Card padding="xl" withBorder>
              <Stack gap="md">
                <ThemeIcon size={48} radius="md" color="orange" variant="light">
                  <IconUserCheck size={24} />
                </ThemeIcon>
                <Title order={3} size="h4">
                  Team Collaboration
                </Title>
                <Text c="dimmed">
                  Assign grants, track progress, and coordinate with your team in one place.
                  Perfect for organizations managing multiple applications.
                </Text>
              </Stack>
            </Card>

            <Card padding="xl" withBorder>
              <Stack gap="md">
                <ThemeIcon size={48} radius="md" color="violet" variant="light">
                  <IconShieldCheck size={24} />
                </ThemeIcon>
                <Title order={3} size="h4">
                  Secure & Reliable
                </Title>
                <Text c="dimmed">
                  Your data is encrypted, backed up daily, and hosted on enterprise-grade
                  infrastructure. Export anytime in CSV or print format.
                </Text>
              </Stack>
            </Card>

            <Card padding="xl" withBorder>
              <Stack gap="md">
                <ThemeIcon size={48} radius="md" color="pink" variant="light">
                  <IconRocket size={24} />
                </ThemeIcon>
                <Title order={3} size="h4">
                  Built for Nonprofits
                </Title>
                <Text c="dimmed">
                  Affordable pricing designed for mission-driven organizations. Free tier
                  available with essential features included.
                </Text>
              </Stack>
            </Card>
          </SimpleGrid>
        </Stack>
      </Container>

      <Divider />

      {/* Migration Steps */}
      <Container size="lg" py={80}>
        <Stack gap="xl">
          <Stack gap="sm" align="center">
            <Title order={2} ta="center">
              How to Migrate in 3 Easy Steps
            </Title>
            <Text size="lg" c="dimmed" ta="center" maw={700}>
              Your complete grant pipeline transferred in under 10 minutes
            </Text>
          </Stack>

          <Paper withBorder p="xl" radius="md">
            <Stepper active={-1} orientation="vertical" iconSize={48}>
              <Stepper.Step
                label="Export from GrantHub"
                description="Download your data before it's gone"
                icon={<IconUpload size={20} />}
              >
                <Stack gap="md" mt="md" ml="md">
                  <Text>
                    Log in to your GrantHub account and export your grants to CSV:
                  </Text>
                  <List withPadding>
                    <List.Item>Navigate to your grants list</List.Item>
                    <List.Item>Click "Export" or "Download CSV"</List.Item>
                    <List.Item>Save the file to your computer</List.Item>
                  </List>
                  <Alert icon={<IconAlertCircle size={16} />} color="orange" variant="light">
                    <Text size="sm">
                      <strong>Important:</strong> Export your data before January 31, 2026.
                      After this date, GrantHub data will no longer be accessible.
                    </Text>
                  </Alert>
                </Stack>
              </Stepper.Step>

              <Stepper.Step
                label="Create Your GrantCue Account"
                description="Free signup, no credit card required"
                icon={<IconUserCheck size={20} />}
              >
                <Stack gap="md" mt="md" ml="md">
                  <Text>
                    Get started with GrantCue in seconds:
                  </Text>
                  <List withPadding>
                    <List.Item>Sign up with your email</List.Item>
                    <List.Item>Create your organization</List.Item>
                    <List.Item>Invite team members (optional)</List.Item>
                  </List>
                  {!user && (
                    <Button
                      component={Link}
                      to="/signup"
                      color="grape"
                      leftSection={<IconRocket size={16} />}
                      w="fit-content"
                    >
                      Create Free Account
                    </Button>
                  )}
                </Stack>
              </Stepper.Step>

              <Stepper.Step
                label="Import Your Grants"
                description="Upload CSV and you're done"
                icon={<IconFileImport size={20} />}
              >
                <Stack gap="md" mt="md" ml="md">
                  <Text>
                    Our importer handles the heavy lifting:
                  </Text>
                  <List withPadding>
                    <List.Item>Upload your GrantHub CSV file</List.Item>
                    <List.Item>Review and select grants to import</List.Item>
                    <List.Item>Click "Import" and watch the magic happen</List.Item>
                  </List>
                  <Text size="sm" c="dimmed">
                    Duplicate detection ensures you won't accidentally import the same grant twice.
                    All your titles, agencies, deadlines, notes, and statuses transfer seamlessly.
                  </Text>
                  {user && (
                    <Button
                      component={Link}
                      to="/import/granthub"
                      color="grape"
                      leftSection={<IconArrowRight size={16} />}
                      w="fit-content"
                    >
                      Go to Import Tool
                    </Button>
                  )}
                </Stack>
              </Stepper.Step>
            </Stepper>
          </Paper>
        </Stack>
      </Container>

      <Divider />

      {/* FAQ Section */}
      <Container size="lg" py={80}>
        <Stack gap="xl">
          <Stack gap="sm" align="center">
            <Title order={2} ta="center">
              Frequently Asked Questions
            </Title>
            <Text size="lg" c="dimmed" ta="center">
              Everything you need to know about migrating
            </Text>
          </Stack>

          <Accordion variant="separated" radius="md">
            <Accordion.Item value="cost">
              <Accordion.Control icon={<IconCheck size={20} />}>
                How much does GrantCue cost?
              </Accordion.Control>
              <Accordion.Panel>
                <Text>
                  GrantCue offers a free tier with essential features including grant tracking,
                  pipeline management, and CSV imports. Paid plans start at $29/month for
                  advanced features like team collaboration, automated Grants.gov syncing,
                  and priority support.{' '}
                  <Anchor component={Link} to="/pricing">
                    View full pricing details
                  </Anchor>
                  .
                </Text>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="data-safety">
              <Accordion.Control icon={<IconShieldCheck size={20} />}>
                Is my data safe during migration?
              </Accordion.Control>
              <Accordion.Panel>
                <Text>
                  Absolutely. GrantCue uses bank-level encryption (AES-256) for data at rest
                  and TLS 1.3 for data in transit. Your GrantHub CSV never leaves your browser
                  during upload, and all data is backed up daily to multiple geographic locations.
                  You can export your data anytime in CSV or PDF format.
                </Text>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="fields">
              <Accordion.Control icon={<IconFileImport size={20} />}>
                What fields are imported from GrantHub?
              </Accordion.Control>
              <Accordion.Panel>
                <Text mb="sm">
                  Our importer automatically maps common GrantHub fields:
                </Text>
                <List withPadding size="sm">
                  <List.Item>Grant Title / Opportunity Title</List.Item>
                  <List.Item>Agency / Funder / Organization</List.Item>
                  <List.Item>Deadline / Due Date / Close Date</List.Item>
                  <List.Item>Award Amount / Funding Amount</List.Item>
                  <List.Item>Status / Stage</List.Item>
                  <List.Item>Notes / Description</List.Item>
                  <List.Item>ALN / CFDA Number</List.Item>
                </List>
                <Text size="sm" c="dimmed" mt="sm">
                  The importer intelligently matches column names, so your data transfers
                  correctly even if GrantHub uses different field names.
                </Text>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="duplicates">
              <Accordion.Control icon={<IconAlertCircle size={20} />}>
                What if I accidentally import duplicates?
              </Accordion.Control>
              <Accordion.Panel>
                <Text>
                  GrantCue's importer includes automatic duplicate detection. Before importing,
                  we check if grants with the same title and agency already exist in your account
                  and skip them automatically. You'll see a summary showing how many grants were
                  imported, skipped, or failed.
                </Text>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="time">
              <Accordion.Control icon={<IconClock size={20} />}>
                How long does migration take?
              </Accordion.Control>
              <Accordion.Panel>
                <Text>
                  Most users complete their migration in under 10 minutes. Export from GrantHub
                  takes 1-2 minutes, account creation takes 2-3 minutes, and the CSV import
                  typically processes 50-100 grants per minute. A typical pipeline of 100 grants
                  imports in about 2 minutes.
                </Text>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="help">
              <Accordion.Control icon={<IconUserCheck size={20} />}>
                What if I need help with migration?
              </Accordion.Control>
              <Accordion.Panel>
                <Text>
                  We're here to help! Our migration guide walks you through each step with
                  screenshots. If you encounter any issues, reach out to support via the
                  in-app chat or email us at support@grantcue.com. We typically respond
                  within 2-4 hours during business days.
                </Text>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="team">
              <Accordion.Control icon={<IconUserCheck size={20} />}>
                Can I migrate if I have a team?
              </Accordion.Control>
              <Accordion.Panel>
                <Text>
                  Yes! After importing your grants, you can invite team members to your
                  organization. Assign grants to specific team members, track who's working
                  on what, and collaborate in real-time. Team features are available on all
                  paid plans.
                </Text>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        </Stack>
      </Container>

      <Divider />

      {/* Final CTA */}
      <Box bg="var(--mantine-color-gray-0)" py={80}>
        <Container size="lg">
          <Card padding="xl" withBorder shadow="sm">
            <Stack gap="xl" align="center">
              <Badge size="lg" color="red" variant="filled">
                Don't Wait Until It's Too Late
              </Badge>

              <Title order={2} ta="center">
                Migrate Your Grants Today
              </Title>

              <Text size="lg" ta="center" c="dimmed" maw={700}>
                Join hundreds of organizations who have already made the switch from GrantHub
                to GrantCue. Your grant pipeline is too important to lose.
              </Text>

              <Group gap="md">
                {user ? (
                  <Button
                    component={Link}
                    to="/import/granthub"
                    size="lg"
                    color="grape"
                    rightSection={<IconArrowRight size={20} />}
                  >
                    Start Import Now
                  </Button>
                ) : (
                  <>
                    <Button
                      component={Link}
                      to="/signup"
                      size="lg"
                      color="grape"
                      rightSection={<IconArrowRight size={20} />}
                    >
                      Get Started Free
                    </Button>
                    <Button
                      component={Link}
                      to="/pricing"
                      size="lg"
                      variant="light"
                      color="grape"
                    >
                      View Pricing
                    </Button>
                  </>
                )}
              </Group>

              <Text size="sm" c="dimmed" ta="center">
                No credit card required • Free tier available • Import in minutes
              </Text>
            </Stack>
          </Card>
        </Container>
      </Box>

      {/* Footer */}
      <Box bg="var(--mantine-color-dark-8)" py="xl">
        <Container size="lg">
          <Stack gap="sm" align="center">
            <Group gap="xl">
              <Anchor component={Link} to="/features" c="gray.5" size="sm">
                Features
              </Anchor>
              <Anchor component={Link} to="/pricing" c="gray.5" size="sm">
                Pricing
              </Anchor>
              <Anchor component={Link} to="/discover" c="gray.5" size="sm">
                Discover Grants
              </Anchor>
              <Anchor component={Link} to="/import/granthub" c="gray.5" size="sm">
                Import from GrantHub
              </Anchor>
              <Anchor component={Link} to="/terms" c="gray.5" size="sm">
                Terms
              </Anchor>
              <Anchor component={Link} to="/privacy" c="gray.5" size="sm">
                Privacy
              </Anchor>
              <Anchor component={Link} to="/security" c="gray.5" size="sm">
                Security
              </Anchor>
              <Anchor component={Link} to="/support" c="gray.5" size="sm">
                Support
              </Anchor>
            </Group>
            <Text size="xs" c="gray.6">
              © 2025 GrantCue. Built for nonprofits by grant professionals.
            </Text>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
