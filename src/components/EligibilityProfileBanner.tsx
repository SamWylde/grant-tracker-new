import { Alert, Button, Group, Text } from '@mantine/core';
import { IconSparkles, IconX } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useOrganization } from '../contexts/OrganizationContext';

export function EligibilityProfileBanner() {
  const { currentOrg } = useOrganization();
  const [dismissed, setDismissed] = useState(false);

  // Check if profile is incomplete
  const isProfileIncomplete = !currentOrg ||
    !(currentOrg as any).org_size ||
    !(currentOrg as any).annual_budget_range ||
    !(currentOrg as any).primary_locations?.length ||
    !(currentOrg as any).focus_categories?.length;

  // Don't show if dismissed or profile is complete
  if (dismissed || !isProfileIncomplete) {
    return null;
  }

  return (
    <Alert
      variant="light"
      color="violet"
      icon={<IconSparkles size={20} />}
      title="Get Personalized Grant Recommendations"
      withCloseButton
      onClose={() => setDismissed(true)}
      closeButtonLabel="Dismiss"
      styles={{
        closeButton: {
          '&:hover': {
            backgroundColor: 'var(--mantine-color-violet-1)',
          },
        },
      }}
    >
      <Group justify="space-between" align="flex-start">
        <div>
          <Text size="sm" mb="xs">
            Complete your eligibility profile to unlock AI-powered grant matching and see recommendations tailored to your organization's needs.
          </Text>
          <Text size="xs" c="dimmed">
            Takes just 2-3 minutes • Get instant grant matches • Improve recommendation accuracy
          </Text>
        </div>
        <Button
          component={Link}
          to="/onboarding/eligibility"
          size="sm"
          variant="light"
          color="violet"
          leftSection={<IconSparkles size={16} />}
        >
          Complete Profile
        </Button>
      </Group>
    </Alert>
  );
}
