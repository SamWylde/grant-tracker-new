import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Stack,
  Title,
  Text,
  Divider,
  Paper,
  Button,
  Group,
  SimpleGrid,
  Badge,
  Progress,
  Box,
  List,
  Switch,
  ThemeIcon,
  Alert,
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
import { SettingsLayout } from '../../components/SettingsLayout';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { useOrganization } from '../../contexts/OrganizationContext';
import { usePermission } from '../../hooks/usePermission';
import { supabase } from '../../lib/supabase';

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
    users: 999999, // Unlimited
    features: [
      'Up to 20 saved grants',
      'Unlimited team members',
      'Email reminders',
      'ICS calendar feed',
      'Team collaboration',
      'Grant discovery & search',
      'Deadline tracking',
    ],
    notIncluded: ['Google/Outlook sync', 'SMS reminders', 'Checklists & templates'],
  },
  pro: {
    name: 'Pro',
    price: 49,
    savedGrants: 999999, // Unlimited
    users: 999999, // Unlimited
    features: [
      'Unlimited saved grants',
      'Unlimited team members',
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
};

export function BillingPage() {
  const { currentOrg } = useOrganization();
  const { isAdmin } = usePermission();
  const [showAnnual, setShowAnnual] = useState(false);

  // Load organization settings for billing info
  const { data: orgSettings } = useQuery({
    queryKey: ['organizationSettings', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return null;

      const { data, error } = await supabase
        .from('organization_settings')
        .select('*')
        .eq('org_id', currentOrg.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!currentOrg,
  });

  // Get saved grants count for quota display
  const { data: grantsCount } = useQuery({
    queryKey: ['savedGrantsCount', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return 0;

      const { count, error } = await supabase
        .from('org_grants_saved')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', currentOrg.id);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!currentOrg,
  });

  // Get team members count for quota display
  const { data: membersCount } = useQuery({
    queryKey: ['teamMembersCount', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return 0;

      const { count, error } = await supabase
        .from('org_members')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', currentOrg.id);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!currentOrg,
  });

  if (!currentOrg) {
    return (
      <ProtectedRoute>
        <SettingsLayout>
          <Text>Loading...</Text>
        </SettingsLayout>
      </ProtectedRoute>
    );
  }

  const currentPlan = (orgSettings as any)?.plan_name || 'free';
  const planConfig = PLAN_FEATURES[currentPlan as keyof typeof PLAN_FEATURES] || PLAN_FEATURES.free;

  const grantsUsed = grantsCount || 0;
  const usersUsed = membersCount || 0;

  const grantsPercentage = planConfig.savedGrants === 999999 ? 0 : (grantsUsed / planConfig.savedGrants) * 100;
  const usersPercentage = planConfig.users === 999999 ? 0 : (usersUsed / planConfig.users) * 100;

  const getPrice = (plan: keyof typeof PLAN_FEATURES) => {
    const basePrice = PLAN_FEATURES[plan].price;
    if (basePrice === 0) return { monthly: 0, annual: 0, annualMonthly: 0 };

    const annual = Math.round(basePrice * 12 * 0.8); // 20% discount
    const annualMonthly = Math.round(annual / 12);

    return {
      monthly: basePrice,
      annual,
      annualMonthly,
    };
  };

  return (
    <ProtectedRoute>
      <SettingsLayout>
        <Stack gap="lg">
          {/* Header */}
          <Stack gap="sm">
            <Group justify="space-between">
              <div>
                <Title order={1}>Billing & Plans</Title>
                <Text c="dimmed" size="lg">
                  Manage your subscription and usage
                </Text>
              </div>
              {!isAdmin && (
                <Badge color="gray" size="lg">
                  View Only
                </Badge>
              )}
            </Group>
          </Stack>

          <Divider />

          {/* Current Plan Overview */}
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
            {/* Current Plan */}
            <Paper p="md" withBorder>
              <Stack gap="md">
                <Group justify="space-between">
                  <div>
                    <Title order={3} size="h4" mb="xs">
                      Current Plan
                    </Title>
                    <Text size="sm" c="dimmed">
                      {planConfig.name}
                    </Text>
                  </div>
                  <Badge
                    size="xl"
                    color={currentPlan === 'free' ? 'gray' : currentPlan === 'starter' ? 'blue' : 'grape'}
                    variant="filled"
                  >
                    {currentPlan.toUpperCase()}
                  </Badge>
                </Group>

                <Divider />

                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Plan Status
                  </Text>
                  <Badge color="green">Active</Badge>
                </Group>

                {currentPlan !== 'free' && (
                  <>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        Price
                      </Text>
                      <Text size="sm" fw={600}>
                        ${planConfig.price}/month
                      </Text>
                    </Group>

                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        Billing Cycle
                      </Text>
                      <Text size="sm" fw={500}>
                        Monthly
                      </Text>
                    </Group>

                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        Next Renewal
                      </Text>
                      <Text size="sm" fw={500}>
                        {(orgSettings as any)?.next_renewal_at
                          ? new Date((orgSettings as any).next_renewal_at).toLocaleDateString()
                          : 'N/A'}
                      </Text>
                    </Group>

                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        Payment Method
                      </Text>
                      <Group gap="xs">
                        <IconCreditCard size={16} />
                        <Text size="sm" fw={500}>
                          •••• 4242
                        </Text>
                      </Group>
                    </Group>
                  </>
                )}

                {currentPlan === 'free' && (orgSettings as any)?.trial_ends_at && (
                  <Alert icon={<IconInfoCircle size={16} />} color="orange">
                    <Text size="sm" fw={500}>
                      Trial ends in{' '}
                      {Math.ceil(
                        (new Date((orgSettings as any).trial_ends_at).getTime() - Date.now()) /
                          (1000 * 60 * 60 * 24)
                      )}{' '}
                      days
                    </Text>
                  </Alert>
                )}

                {isAdmin && currentPlan !== 'free' && (
                  <>
                    <Divider />
                    <Group>
                      <Button fullWidth variant="light">
                        Update Payment Method
                      </Button>
                    </Group>
                  </>
                )}
              </Stack>
            </Paper>

            {/* Usage Quotas */}
            <Paper p="md" withBorder>
              <Stack gap="md">
                <div>
                  <Title order={3} size="h4" mb="xs">
                    Usage & Quotas
                  </Title>
                  <Text size="sm" c="dimmed">
                    Track your current usage
                  </Text>
                </div>

                <Divider />

                {/* Saved Grants */}
                <div>
                  <Group justify="space-between" mb="xs">
                    <Text size="sm" fw={500}>
                      Saved Grants
                    </Text>
                    <Text size="sm" c="dimmed">
                      {grantsUsed} /{' '}
                      {planConfig.savedGrants === 999999 ? 'Unlimited' : planConfig.savedGrants}
                    </Text>
                  </Group>
                  {planConfig.savedGrants !== 999999 && (
                    <Progress
                      value={grantsPercentage}
                      color={grantsPercentage > 80 ? 'orange' : 'grape'}
                      size="lg"
                    />
                  )}
                </div>

                {/* Team Members */}
                <div>
                  <Group justify="space-between" mb="xs">
                    <Text size="sm" fw={500}>
                      Team Members
                    </Text>
                    <Text size="sm" c="dimmed">
                      {usersUsed} / {planConfig.users === 999999 ? 'Unlimited' : planConfig.users}
                    </Text>
                  </Group>
                  {planConfig.users !== 999999 && (
                    <Progress
                      value={usersPercentage}
                      color={usersPercentage > 80 ? 'orange' : 'grape'}
                      size="lg"
                    />
                  )}
                </div>

                {((grantsPercentage > 80 && planConfig.savedGrants !== 999999) ||
                  (usersPercentage > 80 && planConfig.users !== 999999)) && (
                  <Alert icon={<IconInfoCircle size={16} />} color="orange">
                    <Text size="sm">
                      You're approaching your plan limits. Consider upgrading for higher quotas.
                    </Text>
                  </Alert>
                )}
              </Stack>
            </Paper>
          </SimpleGrid>

          {/* Pricing Plans */}
          <Stack gap="md" mt="xl">
            <Group justify="space-between">
              <div>
                <Title order={2}>Available Plans</Title>
                <Text c="dimmed" size="sm">
                  Choose the plan that's right for your team
                </Text>
              </div>
              <Group gap="xs">
                <Text size="sm" c={showAnnual ? 'dimmed' : 'dark'} fw={showAnnual ? 400 : 600}>
                  Monthly
                </Text>
                <Switch checked={showAnnual} onChange={(e) => setShowAnnual(e.currentTarget.checked)} />
                <Group gap={4}>
                  <Text size="sm" c={showAnnual ? 'dark' : 'dimmed'} fw={showAnnual ? 600 : 400}>
                    Annual
                  </Text>
                  <Badge size="sm" color="green" variant="light">
                    Save 20%
                  </Badge>
                </Group>
              </Group>
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
              {/* Free Plan */}
              <Paper
                p="lg"
                withBorder
                style={{
                  borderColor:
                    currentPlan === 'free' ? 'var(--mantine-color-grape-6)' : 'var(--mantine-color-gray-3)',
                  borderWidth: currentPlan === 'free' ? 2 : 1,
                }}
              >
                <Stack gap="md">
                  <div>
                    <Group justify="space-between" mb="xs">
                      <Text fw={600} size="lg">
                        Free
                      </Text>
                      {currentPlan === 'free' && (
                        <Badge size="sm" color="grape">
                          Current
                        </Badge>
                      )}
                    </Group>
                    <Group align="baseline" gap={4}>
                      <Text size="2rem" fw={700}>
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

                  {isAdmin && currentPlan !== 'free' && (
                    <Button variant="light" color="gray" fullWidth disabled>
                      Current Plan
                    </Button>
                  )}
                  {isAdmin && currentPlan === 'free' && (
                    <Button variant="outline" color="gray" fullWidth disabled>
                      Current Plan
                    </Button>
                  )}
                </Stack>
              </Paper>

              {/* Starter Plan */}
              <Paper
                p="lg"
                withBorder
                style={{
                  borderColor:
                    currentPlan === 'starter' ? 'var(--mantine-color-blue-6)' : 'var(--mantine-color-gray-3)',
                  borderWidth: currentPlan === 'starter' ? 2 : 1,
                }}
              >
                <Stack gap="md">
                  <div>
                    <Group justify="space-between" mb="xs">
                      <Text fw={600} size="lg">
                        Starter
                      </Text>
                      {currentPlan === 'starter' && (
                        <Badge size="sm" color="blue">
                          Current
                        </Badge>
                      )}
                    </Group>
                    <Group align="baseline" gap={4}>
                      <Text size="2rem" fw={700}>
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

                  {isAdmin && currentPlan === 'starter' && (
                    <Button variant="outline" color="blue" fullWidth disabled>
                      Current Plan
                    </Button>
                  )}
                  {isAdmin && currentPlan !== 'starter' && (
                    <Button color="blue" fullWidth>
                      {currentPlan === 'free' ? 'Upgrade to Starter' : 'Downgrade to Starter'}
                    </Button>
                  )}
                </Stack>
              </Paper>

              {/* Pro Plan */}
              <Paper
                p="lg"
                withBorder
                style={{
                  borderColor:
                    currentPlan === 'pro' ? 'var(--mantine-color-grape-6)' : 'var(--mantine-color-gray-3)',
                  borderWidth: currentPlan === 'pro' ? 2 : 1,
                  background:
                    currentPlan === 'pro' ? 'var(--mantine-color-grape-0)' : 'white',
                }}
              >
                <Stack gap="md">
                  <div>
                    <Group justify="space-between" mb="xs">
                      <Group gap="xs">
                        <Text fw={600} size="lg">
                          Pro
                        </Text>
                        <Badge size="sm" color="grape" variant="filled" leftSection={<IconSparkles size={12} />}>
                          Popular
                        </Badge>
                      </Group>
                      {currentPlan === 'pro' && (
                        <Badge size="sm" color="grape">
                          Current
                        </Badge>
                      )}
                    </Group>
                    <Group align="baseline" gap={4}>
                      <Text size="2rem" fw={700}>
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

                  {isAdmin && currentPlan === 'pro' && (
                    <Button variant="outline" color="grape" fullWidth disabled>
                      Current Plan
                    </Button>
                  )}
                  {isAdmin && currentPlan !== 'pro' && (
                    <Button
                      color="grape"
                      fullWidth
                      leftSection={<IconRocket size={16} />}
                      variant="filled"
                    >
                      Upgrade to Pro
                    </Button>
                  )}
                </Stack>
              </Paper>
            </SimpleGrid>
          </Stack>

          {/* Nonprofit Discount */}
          <Alert icon={<IconInfoCircle size={16} />} color="blue" mt="lg">
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

          {/* Additional Info */}
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
                  All payments are processed securely through Stripe. We never store your payment
                  information.
                </Text>
                <Text size="sm">
                  Your subscription renews automatically, but you can cancel at any time with no
                  questions asked.
                </Text>
              </Stack>
            </Paper>
          </SimpleGrid>

          {!isAdmin && (
            <Alert icon={<IconInfoCircle size={16} />} color="orange">
              <Text size="sm">
                Only organization admins can manage billing and upgrade plans. Contact your admin to make
                changes.
              </Text>
            </Alert>
          )}
        </Stack>
      </SettingsLayout>
    </ProtectedRoute>
  );
}
