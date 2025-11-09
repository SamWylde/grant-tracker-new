import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Stack,
  Title,
  Text,
  Divider,
  Paper,
  TextInput,
  Select,
  MultiSelect,
  Button,
  Group,
  Avatar,
  SimpleGrid,
  Badge,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { SettingsLayout } from '../../components/SettingsLayout';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { useOrganization } from '../../contexts/OrganizationContext';
import { usePermission } from '../../hooks/usePermission';
import { supabase } from '../../lib/supabase';

// US States
const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
  'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
  'Wisconsin', 'Wyoming',
].map((state) => ({ value: state, label: state }));

// Common focus areas
const FOCUS_AREAS = [
  'Education',
  'Environment',
  'Healthcare',
  'Housing',
  'Arts & Culture',
  'Economic Development',
  'Public Safety',
  'Transportation',
  'Technology',
  'Agriculture',
  'Energy',
  'Social Services',
  'Research',
  'Infrastructure',
].map((area) => ({ value: area, label: area }));

export function OrganizationPage() {
  const { currentOrg, refreshOrgs } = useOrganization();
  const { hasPermission, isAdmin } = usePermission();
  

  // Form state
  const [orgName, setOrgName] = useState('');
  const [primaryState, setPrimaryState] = useState<string | null>(null);
  const [focusAreas, setFocusAreas] = useState<string[]>([]);

  const [isDirty, setIsDirty] = useState(false);

  const canEdit = hasPermission('edit_org');

  // Initialize form when org loads
  useEffect(() => {
    if (currentOrg) {
      setOrgName(currentOrg.name || '');
      setPrimaryState(currentOrg.primary_state || null);
      setFocusAreas(currentOrg.focus_areas || []);
    }
  }, [currentOrg]);

  // Save organization mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentOrg) throw new Error('No organization');

      const { error } = await supabase
        .from('organizations')
        .update({
          name: orgName,
          primary_state: primaryState,
          focus_areas: focusAreas,
        } as any)
        .eq('id', currentOrg.id);

      if (error) throw error;
    },
    onSuccess: () => {
      refreshOrgs();
      setIsDirty(false);
      notifications.show({
        title: 'Organization updated',
        message: 'Your organization settings have been saved.',
        color: 'green',
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to save organization',
        color: 'red',
      });
    },
  });

  // Track form changes
  useEffect(() => {
    const hasChanges =
      orgName !== (currentOrg?.name || '') ||
      primaryState !== (currentOrg?.primary_state || null) ||
      JSON.stringify(focusAreas) !== JSON.stringify(currentOrg?.focus_areas || []);

    setIsDirty(hasChanges);
  }, [orgName, primaryState, focusAreas, currentOrg]);

  // Get org initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (!currentOrg) {
    return (
      <ProtectedRoute>
        <SettingsLayout>
          <Text>Loading organization...</Text>
        </SettingsLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <SettingsLayout>
        <Stack gap="lg">
          {/* Header */}
          <Stack gap="sm">
            <Group justify="space-between">
              <div>
                <Title order={1}>Organization</Title>
                <Text c="dimmed" size="lg">
                  Manage your organization's basic information
                </Text>
              </div>
              {!canEdit && (
                <Badge color="gray" size="lg">
                  Read Only
                </Badge>
              )}
            </Group>
          </Stack>

          <Divider />

          {/* Main Content - Two Column Layout */}
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
            {/* Left Column - Form */}
            <Stack gap="lg">
              {/* Organization Information */}
              <Paper p="md" withBorder>
                <Stack gap="md">
                  <div>
                    <Title order={3} size="h4" mb="xs">
                      Organization Details
                    </Title>
                    <Text size="sm" c="dimmed">
                      Basic information about your organization
                    </Text>
                  </div>

                  <Divider />

                  {/* Logo/Avatar */}
                  <Group>
                    <Avatar size={64} radius="xl" color="grape">
                      {getInitials(orgName || 'O')}
                    </Avatar>
                    <Stack gap={0}>
                      <Text fw={500}>{orgName || 'Organization Name'}</Text>
                      <Text size="sm" c="dimmed">
                        ID: {currentOrg.id.slice(0, 8)}...
                      </Text>
                    </Stack>
                  </Group>

                  {/* Organization Name */}
                  <TextInput
                    label="Organization Name"
                    placeholder="Enter organization name"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    required
                    disabled={!canEdit}
                  />

                  {/* Primary State */}
                  <Select
                    label="Primary State/Region"
                    placeholder="Select your primary state"
                    value={primaryState}
                    onChange={setPrimaryState}
                    data={US_STATES}
                    searchable
                    clearable
                    disabled={!canEdit}
                  />

                  {/* Focus Areas */}
                  <MultiSelect
                    label="Focus Areas"
                    placeholder="Select your organization's focus areas"
                    value={focusAreas}
                    onChange={setFocusAreas}
                    data={FOCUS_AREAS}
                    searchable
                    clearable
                    disabled={!canEdit}
                    description="Select all that apply to help us personalize grant recommendations"
                  />
                </Stack>
              </Paper>

              {/* Metadata (Read-only) */}
              <Paper p="md" withBorder>
                <Stack gap="md">
                  <div>
                    <Title order={3} size="h4" mb="xs">
                      Organization Information
                    </Title>
                    <Text size="sm" c="dimmed">
                      Read-only details
                    </Text>
                  </div>

                  <Divider />

                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Organization ID
                    </Text>
                    <Text size="sm" fw={500} style={{ fontFamily: 'monospace' }}>
                      {currentOrg.id}
                    </Text>
                  </Group>

                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Created
                    </Text>
                    <Text size="sm" fw={500}>
                      {new Date(currentOrg.created_at).toLocaleDateString()}
                    </Text>
                  </Group>

                  {currentOrg.slug && (
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        Slug
                      </Text>
                      <Text size="sm" fw={500} style={{ fontFamily: 'monospace' }}>
                        {currentOrg.slug}
                      </Text>
                    </Group>
                  )}
                </Stack>
              </Paper>

              {/* Save Button */}
              {canEdit && (
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
              )}
            </Stack>

            {/* Right Column - Help/Summary */}
            <Stack gap="lg">
              <Paper p="md" withBorder bg="var(--mantine-color-grape-0)">
                <Stack gap="sm">
                  <Title order={4}>About Organization Settings</Title>
                  <Text size="sm">
                    Organization settings are shared across all team members. Only admins can modify
                    these settings.
                  </Text>
                  <Text size="sm">
                    Your primary state and focus areas help us recommend relevant grants and
                    customize your experience.
                  </Text>
                </Stack>
              </Paper>

              {!isAdmin && (
                <Paper p="md" withBorder bg="var(--mantine-color-orange-0)">
                  <Stack gap="sm">
                    <Title order={4}>Read-Only Access</Title>
                    <Text size="sm">
                      You're viewing these settings as a <strong>Contributor</strong>. Only admins
                      can modify organization details.
                    </Text>
                    <Text size="sm">
                      Contact your organization admin if you need to make changes.
                    </Text>
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
