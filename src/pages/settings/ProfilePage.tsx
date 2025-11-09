import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Stack,
  Title,
  Text,
  Divider,
  Paper,
  TextInput,
  Select,
  Switch,
  Button,
  Group,
  Avatar,
  SimpleGrid,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { SettingsLayout } from '../../components/SettingsLayout';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

// Common US timezones
const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Phoenix', label: 'Mountain Time - Arizona (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii-Aleutian Time (HAT)' },
];



export function ProfilePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Form state
  const [fullName, setFullName] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [weeklySummary, setWeeklySummary] = useState(true);
  const [productUpdates, setProductUpdates] = useState(true);

  const [isDirty, setIsDirty] = useState(false);

  // Load user profile
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['userProfile', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // Ignore not found error
      return data as any;
    },
    enabled: !!user,
  });

  // Load user preferences
  const { data: preferences, isLoading: preferencesLoading } = useQuery({
    queryKey: ['userPreferences', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as any;
    },
    enabled: !!user,
  });

  // Initialize form when data loads
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setTimezone(profile.timezone || 'America/New_York');
    }
    if (preferences) {
      setWeeklySummary(preferences.weekly_summary_emails ?? true);
      setProductUpdates(preferences.product_updates ?? true);
    }
  }, [profile, preferences]);

  // Save profile mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('No user');

      // Save profile
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          id: user.id,
          full_name: fullName,
          timezone,
        } as any);

      if (profileError) throw profileError;

      // Save preferences
      const { error: preferencesError } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          weekly_summary_emails: weeklySummary,
          product_updates: productUpdates,
        } as any);

      if (preferencesError) throw preferencesError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      queryClient.invalidateQueries({ queryKey: ['userPreferences'] });
      setIsDirty(false);
      notifications.show({
        title: 'Profile updated',
        message: 'Your profile has been saved successfully.',
        color: 'green',
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to save profile',
        color: 'red',
      });
    },
  });

  // Track form changes
  useEffect(() => {
    const hasChanges =
      fullName !== (profile?.full_name || '') ||
      timezone !== (profile?.timezone || 'America/New_York') ||
      weeklySummary !== (preferences?.weekly_summary_emails ?? true) ||
      productUpdates !== (preferences?.product_updates ?? true);

    setIsDirty(hasChanges);
  }, [fullName, timezone, weeklySummary, productUpdates, profile, preferences]);

  const loading = profileLoading || preferencesLoading;

  // Get user initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <ProtectedRoute>
      <SettingsLayout>
        <Stack gap="lg">
          {/* Header */}
          <Stack gap="sm">
            <Title order={1}>Your Profile</Title>
            <Text c="dimmed" size="lg">
              Manage your personal information and preferences
            </Text>
          </Stack>

          <Divider />

          {/* Main Content - Two Column Layout */}
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
            {/* Left Column - Form */}
            <Stack gap="lg">
              {/* Profile Information */}
              <Paper p="md" withBorder>
                <Stack gap="md">
                  <div>
                    <Title order={3} size="h4" mb="xs">
                      Profile Information
                    </Title>
                    <Text size="sm" c="dimmed">
                      Your personal details and account settings
                    </Text>
                  </div>

                  <Divider />

                  {/* Avatar */}
                  <Group>
                    <Avatar size={64} radius="xl" color="grape">
                      {getInitials(fullName || 'U')}
                    </Avatar>
                    <Stack gap={0}>
                      <Text fw={500}>{fullName || 'Your Name'}</Text>
                      <Text size="sm" c="dimmed">
                        {user?.email}
                      </Text>
                    </Stack>
                  </Group>

                  {/* Name */}
                  <TextInput
                    label="Full Name"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    disabled={loading}
                  />

                  {/* Email (read-only) */}
                  <TextInput
                    label="Email"
                    value={user?.email || ''}
                    disabled
                    description="Email cannot be changed"
                  />

                  {/* Timezone */}
                  <Select
                    label="Time Zone"
                    placeholder="Select your timezone"
                    value={timezone}
                    onChange={(value) => value && setTimezone(value)}
                    data={TIMEZONES}
                    searchable
                    disabled={loading}
                  />
                </Stack>
              </Paper>

              {/* Preferences */}
              <Paper p="md" withBorder>
                <Stack gap="md">
                  <div>
                    <Title order={3} size="h4" mb="xs">
                      Email Preferences
                    </Title>
                    <Text size="sm" c="dimmed">
                      Control which emails you receive from us
                    </Text>
                  </div>

                  <Divider />

                  <Switch
                    label="Weekly summary emails"
                    description="Receive a weekly digest of grants and deadlines"
                    checked={weeklySummary}
                    onChange={(e) => setWeeklySummary(e.target.checked)}
                    disabled={loading}
                  />

                  <Switch
                    label="Product updates"
                    description="Get notified about new features and improvements"
                    checked={productUpdates}
                    onChange={(e) => setProductUpdates(e.target.checked)}
                    disabled={loading}
                  />
                </Stack>
              </Paper>

              {/* Save Button */}
              <Group justify="flex-end">
                <Button
                  size="md"
                  disabled={!isDirty}
                  loading={saveMutation.isPending}
                  onClick={() => saveMutation.mutate()}
                >
                  Save Changes
                </Button>
              </Group>
            </Stack>

            {/* Right Column - Help/Summary */}
            <Stack gap="lg">
              <Paper p="md" withBorder bg="var(--mantine-color-grape-0)">
                <Stack gap="sm">
                  <Title order={4}>About Your Profile</Title>
                  <Text size="sm">
                    Your profile information is used throughout GrantCue to personalize your
                    experience. Your timezone ensures deadlines and notifications are displayed in
                    your local time.
                  </Text>
                  <Text size="sm">
                    Email preferences only affect summary and marketing emails. You'll still receive
                    important account and security notifications.
                  </Text>
                </Stack>
              </Paper>
            </Stack>
          </SimpleGrid>
        </Stack>
      </SettingsLayout>
    </ProtectedRoute>
  );
}
