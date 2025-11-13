import { useState } from 'react';
import {
  Anchor,
  Stack,
  Title,
  Text,
  Divider,
  Paper,
  Button,
  Group,
  SimpleGrid,
  Badge,
  List,
  Switch,
  ThemeIcon,
  Alert,
  Container,
  Box,
} from '@mantine/core';
import {
  IconCreditCard,
  IconRocket,
  IconCalendar,
  IconCheck,
  IconX,
  IconSparkles,
  IconInfoCircle,
} from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { MarketingHeader } from '../components/MarketingHeader';

const PLAN_FEATURES = {
  free: {
    name: 'Free',
    price: 0,
    savedGrants: 3,
    users: 1,
    features: [
      'Up to 3 saved grants',
      '1 user',
      'Email reminders',
      'Grant discovery & search',
      'Basic deadline tracking',
    ],
    notIncluded: [
      'AI Summary',
      'AI Success Score',
      'ICS calendar feed',
      'Team collaboration',
      'Google/Outlook sync',
      'SMS reminders',
      'Checklists & templates',
    ],
  },
  starter: {
    name: 'Starter',
    price: 19,
    savedGrants: 20,
    users: 999999,
    features: [
      'Up to 20 saved grants',
      'Unlimited team members',
      'Limited AI Summary',
      'Limited AI Success Score',
      'Email reminders',
      'ICS calendar feed',
      'Team collaboration',
      'Grant discovery & search',
      'Deadline tracking',
    ],
    notIncluded: ['Full AI features', 'Google/Outlook sync', 'SMS reminders', 'Checklists & templates'],
  },
  pro: {
    name: 'Pro',
    price: 49,
    savedGrants: 999999,
    users: 999999,
    features: [
      'Unlimited saved grants',
      'Unlimited team members',
      'Full AI Summary',
      'Full AI Success Score',
      'Email reminders',
      'ICS calendar feed',
      'Google Calendar sync',
      'Outlook sync',
      'SMS reminders',
      'Application checklists',
      'Grant templates',
      'Advanced analytics',
      'Priority support',
      'Custom integrations',
    ],
    notIncluded: [],
  },
  enterprise: {
    name: 'Enterprise',
    price: null, // Custom pricing
    savedGrants: 999999,
    users: 999999,
    features: [
      'Everything in Pro, plus:',
      'Unlimited grants & users',
      'Dedicated account manager',
      'Custom integrations & API access',
      '99.9% uptime SLA guarantee',
      'Advanced security & compliance',
      'Custom training & onboarding',
      'Priority feature requests',
      'Custom contract terms',
      'White-label options',
      'SSO & SAML support',
      '24/7 phone & email support',
    ],
    notIncluded: [],
  },
};

export function PricingPage() {
  const { user } = useAuth();
  const [showAnnual, setShowAnnual] = useState(false);

  const getPrice = (plan: keyof typeof PLAN_FEATURES) => {
    const basePrice = PLAN_FEATURES[plan].price;
    if (basePrice === 0 || basePrice === null) return { monthly: 0, annual: 0, annualMonthly: 0 };

    const annual = Math.round(basePrice * 12 * 0.8); // 20% discount
    const annualMonthly = Math.round(annual / 12);

    return {
      monthly: basePrice,
      annual,
      annualMonthly,
    };
  };

  return (
    <Box bg="var(--mantine-color-gray-0)" mih="100vh">
      <MarketingHeader
        user={user}
        navLinks={[
          { label: 'Discover Grants', to: '/discover' },
          { label: 'Product', to: '/' },
          { label: 'Pricing', to: '/pricing' },
        ]}
        loggedOutActions={
          <>
            <Button variant="light" color="grape" component={Link} to="/signin">
              Sign in
            </Button>
            <Button color="grape">Book demo</Button>
          </>
        }
      />

      {/* Hero Section */}
      <Box
        component="section"
        py={{ base: 60, md: 80 }}
        bg="linear-gradient(135deg, var(--mantine-color-grape-0) 0%, var(--mantine-color-indigo-0) 100%)"
      >
        <Container size="lg">
          <Stack align="center" gap="lg" ta="center">
            <Badge size="lg" variant="light" color="grape">
              Simple, transparent pricing
            </Badge>
            <Title order={1} fz={{ base: 36, md: 48 }}>
              Choose the plan that fits your team
            </Title>
            <Text size="lg" c="dimmed" maw={640}>
              Start free and scale as you grow. All plans include our core grant discovery and deadline tracking
              features.
            </Text>
            <Group gap="xs" mt="md">
              <Text size="sm" c={showAnnual ? 'dimmed' : 'dark'} fw={showAnnual ? 400 : 600}>
                Monthly
              </Text>
              <Switch checked={showAnnual} onChange={(e) => setShowAnnual(e.currentTarget.checked)} size="md" />
              <Group gap={4}>
                <Text size="sm" c={showAnnual ? 'dark' : 'dimmed'} fw={showAnnual ? 600 : 400}>
                  Annual
                </Text>
                <Badge size="sm" color="green" variant="light">
                  Save 20%
                </Badge>
              </Group>
            </Group>
          </Stack>
        </Container>
      </Box>

      {/* Pricing Cards */}
      <Container size="lg" py={{ base: 60, md: 80 }}>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="lg">
          {/* Free Plan */}
          <Paper p="lg" withBorder shadow="sm">
            <Stack gap="md">
              <div>
                <Text fw={600} size="lg">
                  Free
                </Text>
                <Group align="baseline" gap={4} mt="xs">
                  <Text size="2.5rem" fw={700}>
                    $0
                  </Text>
                  <Text size="sm" c="dimmed">
                    /month
                  </Text>
                </Group>
                <Text size="sm" c="dimmed" mt="xs">
                  Perfect for individuals getting started
                </Text>
              </div>

              <Button variant="light" color="gray" fullWidth component={Link} to="/signin">
                Get Started Free
              </Button>

              <Divider />

              <List
                spacing="xs"
                size="sm"
                icon={
                  <ThemeIcon size={20} radius="xl" color="gray" variant="light">
                    <IconCheck size={12} />
                  </ThemeIcon>
                }
              >
                {PLAN_FEATURES.free.features.map((feature, i) => (
                  <List.Item key={i}>{feature}</List.Item>
                ))}
              </List>

              {PLAN_FEATURES.free.notIncluded.length > 0 && (
                <List
                  spacing="xs"
                  size="sm"
                  icon={
                    <ThemeIcon size={20} radius="xl" color="gray" variant="subtle">
                      <IconX size={12} />
                    </ThemeIcon>
                  }
                >
                  {PLAN_FEATURES.free.notIncluded.map((feature, i) => (
                    <List.Item key={i}>
                      <Text size="sm" c="dimmed">
                        {feature}
                      </Text>
                    </List.Item>
                  ))}
                </List>
              )}
            </Stack>
          </Paper>

          {/* Starter Plan */}
          <Paper p="lg" withBorder shadow="sm">
            <Stack gap="md">
              <div>
                <Text fw={600} size="lg">
                  Starter
                </Text>
                <Group align="baseline" gap={4} mt="xs">
                  <Text size="2.5rem" fw={700}>
                    ${showAnnual ? getPrice('starter').annualMonthly : getPrice('starter').monthly}
                  </Text>
                  <Text size="sm" c="dimmed">
                    /month
                  </Text>
                </Group>
                {showAnnual && (
                  <Text size="xs" c="dimmed" mt={4}>
                    ${getPrice('starter').annual}/year, billed annually
                  </Text>
                )}
                <Text size="sm" c="dimmed" mt="xs">
                  Great for small teams
                </Text>
              </div>

              <Button color="blue" fullWidth component={Link} to="/signin">
                Start Free Trial
              </Button>

              <Divider />

              <List
                spacing="xs"
                size="sm"
                icon={
                  <ThemeIcon size={20} radius="xl" color="blue" variant="light">
                    <IconCheck size={12} />
                  </ThemeIcon>
                }
              >
                {PLAN_FEATURES.starter.features.map((feature, i) => (
                  <List.Item key={i}>{feature}</List.Item>
                ))}
              </List>

              {PLAN_FEATURES.starter.notIncluded.length > 0 && (
                <List
                  spacing="xs"
                  size="sm"
                  icon={
                    <ThemeIcon size={20} radius="xl" color="gray" variant="subtle">
                      <IconX size={12} />
                    </ThemeIcon>
                  }
                >
                  {PLAN_FEATURES.starter.notIncluded.map((feature, i) => (
                    <List.Item key={i}>
                      <Text size="sm" c="dimmed">
                        {feature}
                      </Text>
                    </List.Item>
                  ))}
                </List>
              )}
            </Stack>
          </Paper>

          {/* Pro Plan */}
          <Paper
            p="lg"
            withBorder
            shadow="lg"
            style={{
              borderColor: 'var(--mantine-color-grape-6)',
              borderWidth: 2,
              background: 'var(--mantine-color-grape-0)',
            }}
          >
            <Stack gap="md">
              <div>
                <Group gap="xs" mb="xs">
                  <Text fw={600} size="lg">
                    Pro
                  </Text>
                  <Badge size="sm" color="grape" variant="filled" leftSection={<IconSparkles size={12} />}>
                    Popular
                  </Badge>
                </Group>
                <Group align="baseline" gap={4}>
                  <Text size="2.5rem" fw={700}>
                    ${showAnnual ? getPrice('pro').annualMonthly : getPrice('pro').monthly}
                  </Text>
                  <Text size="sm" c="dimmed">
                    /month
                  </Text>
                </Group>
                {showAnnual && (
                  <Text size="xs" c="dimmed" mt={4}>
                    ${getPrice('pro').annual}/year, billed annually
                  </Text>
                )}
                <Text size="sm" c="dimmed" mt="xs">
                  For teams that need everything
                </Text>
              </div>

              <Button color="grape" fullWidth leftSection={<IconRocket size={16} />} component={Link} to="/signin">
                Start Free Trial
              </Button>

              <Divider />

              <List
                spacing="xs"
                size="sm"
                icon={
                  <ThemeIcon size={20} radius="xl" color="grape" variant="light">
                    <IconCheck size={12} />
                  </ThemeIcon>
                }
              >
                {PLAN_FEATURES.pro.features.map((feature, i) => (
                  <List.Item key={i}>{feature}</List.Item>
                ))}
              </List>
            </Stack>
          </Paper>

          {/* Enterprise Plan */}
          <Paper
            p="lg"
            withBorder
            shadow="lg"
            style={{
              borderColor: 'var(--mantine-color-indigo-6)',
              borderWidth: 2,
              background: 'var(--mantine-color-indigo-0)',
            }}
          >
            <Stack gap="md">
              <div>
                <Text fw={600} size="lg" mb="xs">
                  Enterprise
                </Text>
                <Group align="baseline" gap={4}>
                  <Text size="1.5rem" fw={700}>
                    Custom
                  </Text>
                </Group>
                <Text size="sm" c="dimmed" mt="xs">
                  For large organizations with specific needs
                </Text>
              </div>

              <Button
                color="indigo"
                fullWidth
                component="a"
                href="mailto:sales@grantcue.com?subject=Enterprise Plan Inquiry"
              >
                Contact Sales
              </Button>

              <Divider />

              <List
                spacing="xs"
                size="sm"
                icon={
                  <ThemeIcon size={20} radius="xl" color="indigo" variant="light">
                    <IconCheck size={12} />
                  </ThemeIcon>
                }
              >
                {PLAN_FEATURES.enterprise.features.map((feature, i) => (
                  <List.Item key={i}>{feature}</List.Item>
                ))}
              </List>
            </Stack>
          </Paper>
        </SimpleGrid>

        {/* Additional Info */}
        <Stack gap="lg" mt={{ base: 60, md: 80 }}>
          {/* Nonprofit Discount */}
          <Alert icon={<IconInfoCircle size={16} />} color="blue">
            <Stack gap="xs">
              <Text size="sm" fw={600}>
                Nonprofit & Association Discounts Available
              </Text>
              <Text size="sm">
                We offer special pricing for nonprofit organizations and state associations. Contact us at{' '}
                <Text component="a" href="mailto:nonprofits@granttracker.com" c="blue" td="underline">
                  nonprofits@granttracker.com
                </Text>{' '}
                to learn more about our discount programs.
              </Text>
            </Stack>
          </Alert>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
            <Paper p="md" withBorder bg="var(--mantine-color-blue-0)">
              <Stack gap="sm">
                <Group gap="xs">
                  <IconCalendar size={20} />
                  <Title order={4}>Flexible Billing</Title>
                </Group>
                <Text size="sm">
                  Choose between monthly or annual billing. Annual plans save you 20% compared to monthly.
                </Text>
                <Text size="sm">
                  All subscriptions can be upgraded, downgraded, or cancelled at any time with no penalties.
                </Text>
              </Stack>
            </Paper>

            <Paper p="md" withBorder bg="var(--mantine-color-grape-0)">
              <Stack gap="sm">
                <Group gap="xs">
                  <IconCreditCard size={20} />
                  <Title order={4}>Secure Payments</Title>
                </Group>
                <Text size="sm">
                  All payments are processed securely through Stripe. We never store your payment information.
                </Text>
                <Text size="sm">
                  Your subscription renews automatically, but you can cancel at any time with no questions
                  asked.
                </Text>
              </Stack>
            </Paper>
          </SimpleGrid>
        </Stack>

        {/* CTA Section */}
        <Paper
          radius="lg"
          p="xl"
          shadow="xl"
          withBorder
          mt={{ base: 60, md: 80 }}
          style={{ paddingInline: 'clamp(1.5rem, 6vw, 4rem)', paddingBlock: 'clamp(2rem, 6vw, 4rem)' }}
        >
          <Stack align="center" gap="lg">
            <Badge size="lg" color="grape" variant="light">
              Ready to get started?
            </Badge>
            <Title order={2} ta="center" maw={520}>
              Start tracking grants and never miss a deadline
            </Title>
            <Text ta="center" c="dimmed" maw={520}>
              Join teams that have already streamlined their grant management workflow with GrantCue.
            </Text>
            <Group gap="md" wrap="wrap" justify="center">
              <Button size="lg" color="grape" component={Link} to="/signin">
                Start free trial
              </Button>
              <Button
                size="lg"
                variant="default"
                component="a"
                href="mailto:sales@grantcue.com?subject=Sales Inquiry"
              >
                Talk to sales
              </Button>
            </Group>
          </Stack>
        </Paper>
      </Container>

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
