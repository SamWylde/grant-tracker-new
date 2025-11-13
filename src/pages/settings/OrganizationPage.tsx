import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Stack,
  Title,
  Text,
  Divider,
  Paper,
  TextInput,
  Textarea,
  Select,
  MultiSelect,
  Button,
  Group,
  Avatar,
  SimpleGrid,
  Badge,
  NumberInput,
  Checkbox,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { SettingsLayout } from '../../components/SettingsLayout';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { useOrganization } from '../../contexts/OrganizationContext';
import { usePermission } from '../../hooks/usePermission';
import { supabase } from '../../lib/supabase';
import { FUNDING_CATEGORIES } from '../../types/grants';
import { Link } from 'react-router-dom';
import { IconSparkles } from '@tabler/icons-react';

// US States with codes
const US_STATE_OPTIONS = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
];

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

  // Eligibility profile state
  const [orgSize, setOrgSize] = useState<string | null>(null);
  const [budgetRange, setBudgetRange] = useState<string | null>(null);
  const [primaryLocations, setPrimaryLocations] = useState<string[]>([]);
  const [serviceAreas, setServiceAreas] = useState<string[]>([]);
  const [focusCategories, setFocusCategories] = useState<string[]>([]);
  const [minGrantAmount, setMinGrantAmount] = useState<number | string>('');
  const [maxGrantAmount, setMaxGrantAmount] = useState<number | string>('');
  const [eligibilityNotes, setEligibilityNotes] = useState('');
  const [autoFilterEnabled, setAutoFilterEnabled] = useState(false);

  const [isDirty, setIsDirty] = useState(false);

  const canEdit = hasPermission('edit_org');

  // Initialize form when org loads
  useEffect(() => {
    if (currentOrg) {
      setOrgName(currentOrg.name || '');
      setPrimaryState(currentOrg.primary_state || null);
      setFocusAreas(currentOrg.focus_areas || []);
      setOrgSize((currentOrg as any).org_size || null);
      setBudgetRange((currentOrg as any).annual_budget_range || null);
      setPrimaryLocations((currentOrg as any).primary_locations || []);
      setServiceAreas((currentOrg as any).service_areas || []);
      setFocusCategories((currentOrg as any).focus_categories || []);
      setMinGrantAmount((currentOrg as any).min_grant_amount || '');
      setMaxGrantAmount((currentOrg as any).max_grant_amount || '');
      setEligibilityNotes((currentOrg as any).eligibility_notes || '');
      setAutoFilterEnabled((currentOrg as any).auto_filter_enabled || false);
    }
  }, [currentOrg]);

  // Save organization mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentOrg) throw new Error('No organization');

      const { error } = await supabase
        .from('organizations')
        // @ts-ignore - Supabase type inference issue
        .update({
          name: orgName,
          primary_state: primaryState,
          focus_areas: focusAreas,
          org_size: orgSize,
          annual_budget_range: budgetRange,
          primary_locations: primaryLocations,
          service_areas: serviceAreas,
          focus_categories: focusCategories,
          min_grant_amount: minGrantAmount ? Number(minGrantAmount) : null,
          max_grant_amount: maxGrantAmount ? Number(maxGrantAmount) : null,
          eligibility_notes: eligibilityNotes,
          auto_filter_enabled: autoFilterEnabled,
        })
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
      JSON.stringify(focusAreas) !== JSON.stringify(currentOrg?.focus_areas || []) ||
      orgSize !== ((currentOrg as any)?.org_size || null) ||
      budgetRange !== ((currentOrg as any)?.annual_budget_range || null) ||
      JSON.stringify(primaryLocations) !== JSON.stringify((currentOrg as any)?.primary_locations || []) ||
      JSON.stringify(serviceAreas) !== JSON.stringify((currentOrg as any)?.service_areas || []) ||
      JSON.stringify(focusCategories) !== JSON.stringify((currentOrg as any)?.focus_categories || []) ||
      minGrantAmount !== ((currentOrg as any)?.min_grant_amount || '') ||
      maxGrantAmount !== ((currentOrg as any)?.max_grant_amount || '') ||
      eligibilityNotes !== ((currentOrg as any)?.eligibility_notes || '') ||
      autoFilterEnabled !== ((currentOrg as any)?.auto_filter_enabled || false);

    setIsDirty(hasChanges);
  }, [orgName, primaryState, focusAreas, orgSize, budgetRange, primaryLocations, serviceAreas, focusCategories, minGrantAmount, maxGrantAmount, eligibilityNotes, autoFilterEnabled, currentOrg]);

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

              {/* Eligibility Profile */}
              <Paper p="md" withBorder>
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Title order={3} size="h4" mb="xs">
                        Grant Eligibility Profile
                      </Title>
                      <Text size="sm" c="dimmed">
                        Help us recommend the most relevant grants for your organization
                      </Text>
                    </div>
                    <Button
                      component={Link}
                      to="/onboarding/eligibility"
                      variant="light"
                      size="sm"
                      leftSection={<IconSparkles size={16} />}
                      title="Use guided wizard to set up or update your eligibility profile"
                    >
                      Setup Wizard
                    </Button>
                  </Group>

                  <Divider />

                  <Select
                    label="Organization Size/Type"
                    placeholder="Select your organization type"
                    value={orgSize}
                    onChange={setOrgSize}
                    data={[
                      { value: 'small', label: 'Small Organization (1-10 staff)' },
                      { value: 'medium', label: 'Medium Organization (11-50 staff)' },
                      { value: 'large', label: 'Large Organization (50+ staff)' },
                      { value: 'nonprofit', label: 'Nonprofit Organization' },
                      { value: 'government', label: 'Government Entity' },
                      { value: 'educational', label: 'Educational Institution' },
                    ]}
                    clearable
                    disabled={!canEdit}
                  />

                  <Select
                    label="Annual Budget Range"
                    placeholder="Select your annual budget range"
                    value={budgetRange}
                    onChange={setBudgetRange}
                    data={[
                      { value: '0-100k', label: '$0 - $100,000' },
                      { value: '100k-500k', label: '$100,000 - $500,000' },
                      { value: '500k-1m', label: '$500,000 - $1M' },
                      { value: '1m-5m', label: '$1M - $5M' },
                      { value: '5m-10m', label: '$5M - $10M' },
                      { value: '10m+', label: '$10M+' },
                    ]}
                    clearable
                    disabled={!canEdit}
                  />

                  <MultiSelect
                    label="Primary Locations"
                    placeholder="Select states where your organization is located"
                    value={primaryLocations}
                    onChange={setPrimaryLocations}
                    data={US_STATE_OPTIONS}
                    searchable
                    clearable
                    disabled={!canEdit}
                    description="States where your organization operates (for geographic eligibility)"
                  />

                  <MultiSelect
                    label="Service Areas"
                    placeholder="Select states where you provide services"
                    value={serviceAreas}
                    onChange={setServiceAreas}
                    data={US_STATE_OPTIONS}
                    searchable
                    clearable
                    disabled={!canEdit}
                    description="Geographic areas where you deliver services (can be different from your location)"
                  />

                  <MultiSelect
                    label="Grant Focus Categories"
                    placeholder="Select grant categories of interest"
                    value={focusCategories}
                    onChange={setFocusCategories}
                    data={FUNDING_CATEGORIES.map(cat => ({ value: cat.value, label: cat.label }))}
                    searchable
                    clearable
                    disabled={!canEdit}
                    description="Types of grants you're interested in (used for fit scoring)"
                  />

                  <Group grow>
                    <NumberInput
                      label="Minimum Grant Amount"
                      placeholder="e.g., 10000"
                      value={minGrantAmount}
                      onChange={setMinGrantAmount}
                      min={0}
                      prefix="$"
                      thousandSeparator=","
                      disabled={!canEdit}
                      description="Minimum grant size you're interested in"
                    />
                    <NumberInput
                      label="Maximum Grant Amount"
                      placeholder="e.g., 500000"
                      value={maxGrantAmount}
                      onChange={setMaxGrantAmount}
                      min={0}
                      prefix="$"
                      thousandSeparator=","
                      disabled={!canEdit}
                      description="Maximum grant size you can manage"
                    />
                  </Group>

                  <Textarea
                    label="Eligibility Notes"
                    placeholder="Any additional eligibility requirements or context..."
                    value={eligibilityNotes}
                    onChange={(e) => setEligibilityNotes(e.target.value)}
                    minRows={3}
                    disabled={!canEdit}
                    description="Additional context about your eligibility (e.g., certifications, special requirements)"
                  />

                  <Checkbox
                    label="Enable automatic filtering"
                    description="Automatically filter grants based on your eligibility profile"
                    checked={autoFilterEnabled}
                    onChange={(e) => setAutoFilterEnabled(e.currentTarget.checked)}
                    disabled={!canEdit}
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
