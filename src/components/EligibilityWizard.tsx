import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Stack,
  Title,
  Text,
  Paper,
  Select,
  MultiSelect,
  Button,
  Group,
  Stepper,
  NumberInput,
  Textarea,
  Checkbox,
  Badge,
  Card,
  Loader,
  Alert,
  Progress,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router-dom';
import { useOrganization } from '../contexts/OrganizationContext';
import { supabase } from '../lib/supabase';
import { FUNDING_CATEGORIES } from '../types/grants';
import { IconAlertCircle, IconCheck, IconSparkles } from '@tabler/icons-react';

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

interface EligibilityWizardProps {
  onComplete?: () => void;
}

export function EligibilityWizard({ onComplete }: EligibilityWizardProps) {
  const { currentOrg, refreshOrgs } = useOrganization();
  const navigate = useNavigate();

  // Wizard state
  const [active, setActive] = useState(0);

  // Form state
  const [orgSize, setOrgSize] = useState<string | null>(null);
  const [budgetRange, setBudgetRange] = useState<string | null>(null);
  const [primaryLocations, setPrimaryLocations] = useState<string[]>([]);
  const [serviceAreas, setServiceAreas] = useState<string[]>([]);
  const [focusCategories, setFocusCategories] = useState<string[]>([]);
  const [minGrantAmount, setMinGrantAmount] = useState<number | string>('');
  const [maxGrantAmount, setMaxGrantAmount] = useState<number | string>('');
  const [eligibilityNotes, setEligibilityNotes] = useState('');
  const [autoFilterEnabled, setAutoFilterEnabled] = useState(false);

  // Initialize from current org if profile exists
  useEffect(() => {
    if (currentOrg) {
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

  // Fetch matching grants preview
  const { data: matchingGrants, isLoading: loadingMatches } = useQuery({
    queryKey: ['grant-matches', currentOrg?.id, orgSize, budgetRange, primaryLocations, serviceAreas, focusCategories, minGrantAmount, maxGrantAmount],
    queryFn: async () => {
      if (!currentOrg) return [];

      // Build a temporary profile for preview
      const profileData = {
        org_size: orgSize,
        annual_budget_range: budgetRange,
        primary_locations: primaryLocations,
        service_areas: serviceAreas,
        focus_categories: focusCategories,
        min_grant_amount: minGrantAmount ? Number(minGrantAmount) : null,
        max_grant_amount: maxGrantAmount ? Number(maxGrantAmount) : null,
      };

      // Only fetch if we have some data
      const hasData = orgSize || budgetRange || primaryLocations.length > 0 || focusCategories.length > 0;
      if (!hasData) return [];

      const response = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: currentOrg.id,
          limit: 5,
          profileOverride: profileData,
        }),
      });

      if (!response.ok) {
        console.error('Failed to fetch recommendations');
        return [];
      }

      const data = await response.json();
      return data.recommendations || [];
    },
    enabled: !!currentOrg && active === 3, // Only fetch on preview step
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentOrg) throw new Error('No organization');

      const { error } = await supabase
        .from('organizations')
        // @ts-ignore - Supabase type inference issue
        .update({
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
      notifications.show({
        title: 'Eligibility profile saved!',
        message: 'Your profile has been created. You\'ll now see personalized grant recommendations.',
        color: 'green',
        icon: <IconCheck size={16} />,
      });

      if (onComplete) {
        onComplete();
      } else {
        navigate('/grants');
      }
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to save eligibility profile',
        color: 'red',
      });
    },
  });

  const nextStep = () => setActive((current) => (current < 3 ? current + 1 : current));
  const prevStep = () => setActive((current) => (current > 0 ? current - 1 : current));

  // Calculate completion percentage
  const calculateCompletion = () => {
    let filled = 0;
    let total = 8;

    if (orgSize) filled++;
    if (budgetRange) filled++;
    if (primaryLocations.length > 0) filled++;
    if (serviceAreas.length > 0) filled++;
    if (focusCategories.length > 0) filled++;
    if (minGrantAmount) filled++;
    if (maxGrantAmount) filled++;
    if (autoFilterEnabled) filled++;

    return Math.round((filled / total) * 100);
  };

  const completion = calculateCompletion();

  // Validation for each step
  const isStep0Valid = orgSize && budgetRange;
  const isStep1Valid = primaryLocations.length > 0;
  const isStep2Valid = focusCategories.length > 0;

  if (!currentOrg) {
    return <Loader />;
  }

  return (
    <Stack gap="lg">
      {/* Header */}
      <div>
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={1}>
              <Group gap="xs">
                <IconSparkles size={32} />
                Eligibility Profile Wizard
              </Group>
            </Title>
            <Text c="dimmed" size="lg" mt="xs">
              Let's set up your organization's profile to find the perfect grants
            </Text>
          </div>
          <Badge size="lg" variant="gradient" gradient={{ from: 'grape', to: 'violet' }}>
            {completion}% Complete
          </Badge>
        </Group>

        <Progress value={completion} mt="md" size="lg" radius="xl" />
      </div>

      {/* Stepper */}
      <Stepper active={active} onStepClick={setActive} allowNextStepsSelect={false}>
        {/* Step 0: Organization Basics */}
        <Stepper.Step
          label="Basics"
          description="Organization type & budget"
          loading={false}
        >
          <Paper p="xl" withBorder mt="xl">
            <Stack gap="lg">
              <div>
                <Title order={3}>Tell us about your organization</Title>
                <Text c="dimmed" mt="xs">
                  This helps us understand what size and type of grants will be a good fit
                </Text>
              </div>

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
                size="md"
                required
                description="This helps match you with grants that target your organization size"
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
                size="md"
                required
                description="Some grants have budget requirements - we'll filter to what's realistic for you"
              />

              {!isStep0Valid && (
                <Alert color="blue" icon={<IconAlertCircle size={16} />}>
                  Please select both organization type and budget range to continue
                </Alert>
              )}
            </Stack>
          </Paper>
        </Stepper.Step>

        {/* Step 1: Location */}
        <Stepper.Step label="Location" description="Where you operate">
          <Paper p="xl" withBorder mt="xl">
            <Stack gap="lg">
              <div>
                <Title order={3}>Where does your organization operate?</Title>
                <Text c="dimmed" mt="xs">
                  Many grants are restricted by geography - we'll show you relevant opportunities
                </Text>
              </div>

              <MultiSelect
                label="Primary Locations"
                placeholder="Select states where your organization is located"
                value={primaryLocations}
                onChange={setPrimaryLocations}
                data={US_STATE_OPTIONS}
                searchable
                size="md"
                required
                description="Where is your organization legally registered or headquartered?"
              />

              <MultiSelect
                label="Service Areas (Optional)"
                placeholder="Select states where you provide services"
                value={serviceAreas}
                onChange={setServiceAreas}
                data={US_STATE_OPTIONS}
                searchable
                size="md"
                description="If you serve communities in other states, add them here"
              />

              {!isStep1Valid && (
                <Alert color="blue" icon={<IconAlertCircle size={16} />}>
                  Please select at least one primary location to continue
                </Alert>
              )}
            </Stack>
          </Paper>
        </Stepper.Step>

        {/* Step 2: Focus & Funding */}
        <Stepper.Step label="Focus & Funding" description="What you're looking for">
          <Paper p="xl" withBorder mt="xl">
            <Stack gap="lg">
              <div>
                <Title order={3}>What types of grants are you interested in?</Title>
                <Text c="dimmed" mt="xs">
                  Select your focus areas and funding range to get the most relevant matches
                </Text>
              </div>

              <MultiSelect
                label="Grant Focus Categories"
                placeholder="Select grant categories of interest"
                value={focusCategories}
                onChange={setFocusCategories}
                data={FUNDING_CATEGORIES.map(cat => ({ value: cat.value, label: cat.label }))}
                searchable
                size="md"
                required
                description="What kinds of projects do you need funding for?"
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
                  size="md"
                  description="Smallest grant you'd apply for"
                />
                <NumberInput
                  label="Maximum Grant Amount"
                  placeholder="e.g., 500000"
                  value={maxGrantAmount}
                  onChange={setMaxGrantAmount}
                  min={0}
                  prefix="$"
                  thousandSeparator=","
                  size="md"
                  description="Largest grant you can manage"
                />
              </Group>

              <Textarea
                label="Additional Notes (Optional)"
                placeholder="Any additional eligibility requirements or context..."
                value={eligibilityNotes}
                onChange={(e) => setEligibilityNotes(e.target.value)}
                minRows={3}
                size="md"
                description="e.g., specific certifications, special requirements, etc."
              />

              {!isStep2Valid && (
                <Alert color="blue" icon={<IconAlertCircle size={16} />}>
                  Please select at least one focus category to continue
                </Alert>
              )}
            </Stack>
          </Paper>
        </Stepper.Step>

        {/* Step 3: Review & Preview */}
        <Stepper.Step label="Review" description="Preview matching grants">
          <Paper p="xl" withBorder mt="xl">
            <Stack gap="lg">
              <div>
                <Title order={3}>Review your profile & see matching grants</Title>
                <Text c="dimmed" mt="xs">
                  Based on your profile, here are some grants that might be a good fit
                </Text>
              </div>

              {/* Profile Summary */}
              <Card withBorder>
                <Stack gap="sm">
                  <Text fw={600} size="sm">Your Profile Summary:</Text>
                  <Group gap="xs">
                    {orgSize && <Badge>{orgSize}</Badge>}
                    {budgetRange && <Badge>{budgetRange}</Badge>}
                    {primaryLocations.length > 0 && (
                      <Badge>{primaryLocations.length} location{primaryLocations.length > 1 ? 's' : ''}</Badge>
                    )}
                    {focusCategories.length > 0 && (
                      <Badge>{focusCategories.length} focus categor{focusCategories.length > 1 ? 'ies' : 'y'}</Badge>
                    )}
                  </Group>
                </Stack>
              </Card>

              {/* Matching Grants Preview */}
              <div>
                <Text fw={600} mb="sm">Matching Grants Preview:</Text>
                {loadingMatches ? (
                  <Card withBorder>
                    <Group justify="center" p="xl">
                      <Loader size="sm" />
                      <Text c="dimmed">Finding matching grants...</Text>
                    </Group>
                  </Card>
                ) : matchingGrants && matchingGrants.length > 0 ? (
                  <Stack gap="sm">
                    {matchingGrants.slice(0, 5).map((grant: any) => (
                      <Card key={grant.id} withBorder padding="md">
                        <Stack gap="xs">
                          <Group justify="space-between">
                            <Text fw={600} size="sm" lineClamp={1}>
                              {grant.title}
                            </Text>
                            {grant.fit_score && (
                              <Badge color="green" variant="light">
                                {Math.round(grant.fit_score)}% match
                              </Badge>
                            )}
                          </Group>
                          <Text size="xs" c="dimmed" lineClamp={2}>
                            {grant.description}
                          </Text>
                          {grant.agency_name && (
                            <Text size="xs" c="dimmed">
                              {grant.agency_name}
                            </Text>
                          )}
                        </Stack>
                      </Card>
                    ))}
                    <Alert color="green" icon={<IconCheck size={16} />}>
                      Great! We found {matchingGrants.length} matching grants for your profile.
                    </Alert>
                  </Stack>
                ) : (
                  <Alert color="blue" icon={<IconAlertCircle size={16} />}>
                    Complete your profile to see matching grants. You can always refine your profile later.
                  </Alert>
                )}
              </div>

              {/* Auto-filter option */}
              <Checkbox
                label="Enable automatic filtering"
                description="Automatically filter grants based on your eligibility profile when browsing the catalog"
                checked={autoFilterEnabled}
                onChange={(e) => setAutoFilterEnabled(e.currentTarget.checked)}
                size="md"
              />
            </Stack>
          </Paper>
        </Stepper.Step>
      </Stepper>

      {/* Navigation Buttons */}
      <Group justify="space-between" mt="xl">
        <Button
          variant="default"
          onClick={prevStep}
          disabled={active === 0}
          size="md"
        >
          Back
        </Button>
        <Group>
          <Button
            variant="subtle"
            onClick={() => navigate('/grants')}
            size="md"
          >
            Skip for now
          </Button>
          {active < 3 ? (
            <Button
              onClick={nextStep}
              disabled={
                (active === 0 && !isStep0Valid) ||
                (active === 1 && !isStep1Valid) ||
                (active === 2 && !isStep2Valid)
              }
              size="md"
            >
              Next step
            </Button>
          ) : (
            <Button
              onClick={() => saveMutation.mutate()}
              loading={saveMutation.isPending}
              size="md"
            >
              Complete setup
            </Button>
          )}
        </Group>
      </Group>
    </Stack>
  );
}
