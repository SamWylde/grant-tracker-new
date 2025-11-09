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
} from '@mantine/core';
import {
  IconCreditCard,
  IconRocket,
  IconCalendar,
  IconUsers,
  IconCheck,
} from '@tabler/icons-react';
import { SettingsLayout } from '../../components/SettingsLayout';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { useOrganization } from '../../contexts/OrganizationContext';
import { usePermission } from '../../hooks/usePermission';
import { supabase } from '../../lib/supabase';

export function BillingPage() {
  const { currentOrg } = useOrganization();
  const { isAdmin } = usePermission();

  // Load organization settings for billing info
  const { data: orgSettings, isLoading } = useQuery({
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

  const planName = orgSettings?.plan_name || 'free';
  const isFree = planName === 'free';
  const isPro = planName === 'pro';

  // Plan limits
  const grantsLimit = isFree ? 50 : isPro ? 500 : 999999;
  const usersLimit = isFree ? 3 : isPro ? 25 : 999999;

  const grantsUsed = grantsCount || 0;
  const usersUsed = membersCount || 0;

  const grantsPercentage = (grantsUsed / grantsLimit) * 100;
  const usersPercentage = (usersUsed / usersLimit) * 100;

  return (
    <ProtectedRoute>
      <SettingsLayout>
        <Stack gap="lg">
          {/* Header */}
          <Stack gap="sm">
            <Group justify="space-between">
              <div>
                <Title order={1}>Billing</Title>
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

          {/* Main Content - Two Column Layout */}
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
            {/* Left Column */}
            <Stack gap="lg">
              {/* Current Plan */}
              <Paper p="md" withBorder>
                <Stack gap="md">
                  <Group justify="space-between">
                    <div>
                      <Title order={3} size="h4" mb="xs">
                        Current Plan
                      </Title>
                      <Text size="sm" c="dimmed">
                        {isFree && 'Free plan for small teams'}
                        {isPro && 'Pro plan with advanced features'}
                      </Text>
                    </div>
                    <Badge size="xl" color={isFree ? 'gray' : 'grape'} variant="filled">
                      {planName.toUpperCase()}
                    </Badge>
                  </Group>

                  <Divider />

                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Plan Status
                    </Text>
                    <Badge color="green">Active</Badge>
                  </Group>

                  {!isFree && (
                    <>
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
                          {orgSettings?.next_renewal_at
                            ? new Date(orgSettings.next_renewal_at).toLocaleDateString()
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

                  {isFree && orgSettings?.trial_ends_at && (
                    <Box
                      p="sm"
                      bg="var(--mantine-color-orange-0)"
                      style={{ borderRadius: 'var(--mantine-radius-md)' }}
                    >
                      <Text size="sm" fw={500} c="orange">
                        Trial ends in{' '}
                        {Math.ceil(
                          (new Date(orgSettings.trial_ends_at).getTime() - Date.now()) /
                            (1000 * 60 * 60 * 24)
                        )}{' '}
                        days
                      </Text>
                    </Box>
                  )}

                  {isAdmin && (
                    <>
                      <Divider />
                      <Group>
                        {isFree && (
                          <Button fullWidth color="grape" leftSection={<IconRocket size={16} />}>
                            Upgrade to Pro
                          </Button>
                        )}
                        {!isFree && (
                          <Button fullWidth variant="light">
                            Manage Payment
                          </Button>
                        )}
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
                        {grantsUsed} / {grantsLimit === 999999 ? 'Unlimited' : grantsLimit}
                      </Text>
                    </Group>
                    <Progress
                      value={grantsPercentage}
                      color={grantsPercentage > 80 ? 'orange' : 'grape'}
                      size="lg"
                    />
                  </div>

                  {/* Team Members */}
                  <div>
                    <Group justify="space-between" mb="xs">
                      <Text size="sm" fw={500}>
                        Team Members
                      </Text>
                      <Text size="sm" c="dimmed">
                        {usersUsed} / {usersLimit === 999999 ? 'Unlimited' : usersLimit}
                      </Text>
                    </Group>
                    <Progress
                      value={usersPercentage}
                      color={usersPercentage > 80 ? 'orange' : 'grape'}
                      size="lg"
                    />
                  </div>

                  {(grantsPercentage > 80 || usersPercentage > 80) && isFree && (
                    <Box
                      p="sm"
                      bg="var(--mantine-color-orange-0)"
                      style={{ borderRadius: 'var(--mantine-radius-md)' }}
                    >
                      <Text size="sm" fw={500} c="orange">
                        You're approaching your plan limits. Upgrade to Pro for higher quotas.
                      </Text>
                    </Box>
                  )}
                </Stack>
              </Paper>
            </Stack>

            {/* Right Column - Upgrade Info */}
            <Stack gap="lg">
              {isFree && (
                <Paper p="md" withBorder bg="var(--mantine-color-grape-0)">
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Title order={3} size="h4">
                        Upgrade to Pro
                      </Title>
                      <Badge size="lg" color="grape" variant="filled">
                        $49/mo
                      </Badge>
                    </Group>

                    <Divider />

                    <Text size="sm">
                      Unlock advanced features and higher limits for your team.
                    </Text>

                    <List
                      spacing="xs"
                      size="sm"
                      icon={
                        <IconCheck size={16} style={{ color: 'var(--mantine-color-grape-6)' }} />
                      }
                    >
                      <List.Item>500 saved grants (vs 50 on Free)</List.Item>
                      <List.Item>25 team members (vs 3 on Free)</List.Item>
                      <List.Item>
                        <Group gap={4}>
                          <IconCalendar size={14} />
                          <Text size="sm">Google Calendar sync</Text>
                        </Group>
                      </List.Item>
                      <List.Item>SMS deadline reminders</List.Item>
                      <List.Item>Priority support</List.Item>
                      <List.Item>Advanced reporting & analytics</List.Item>
                    </List>

                    {isAdmin && (
                      <Button fullWidth color="grape" size="md" leftSection={<IconRocket size={18} />}>
                        Upgrade Now
                      </Button>
                    )}
                  </Stack>
                </Paper>
              )}

              <Paper p="md" withBorder bg="var(--mantine-color-blue-0)">
                <Stack gap="sm">
                  <Title order={4}>About Billing</Title>
                  <Text size="sm">
                    Your subscription is managed securely through Stripe. Payments are processed
                    automatically on your renewal date.
                  </Text>
                  <Text size="sm">
                    You can upgrade, downgrade, or cancel at any time. Changes take effect
                    immediately.
                  </Text>
                </Stack>
              </Paper>

              {!isAdmin && (
                <Paper p="md" withBorder bg="var(--mantine-color-orange-0)">
                  <Stack gap="sm">
                    <Title order={4}>Admin Only</Title>
                    <Text size="sm">
                      Only admins can manage billing, upgrade plans, or update payment methods.
                    </Text>
                    <Text size="sm">Contact your organization admin to make billing changes.</Text>
                  </Stack>
                </Paper>
              )}
            </Stack>
          </SimpleGrid>
        </Stack>
      </SettingsLayout>
    </ProtectedRoute>
  );
}
