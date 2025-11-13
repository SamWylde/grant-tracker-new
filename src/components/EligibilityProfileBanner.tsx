import { Alert, Button, Group, Text } from '@mantine/core';
import { IconSparkles } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useOrganization } from '../contexts/OrganizationContext';

interface EligibilityProfileBannerProps {
  showForCompleteProfiles?: boolean;
}

export function EligibilityProfileBanner({ showForCompleteProfiles = false }: EligibilityProfileBannerProps) {
  const { currentOrg } = useOrganization();
  const [dismissed, setDismissed] = useState(false);

  // Check if profile is incomplete
  const isProfileIncomplete = !currentOrg ||
    !(currentOrg as any).org_size ||
    !(currentOrg as any).annual_budget_range ||
    !(currentOrg as any).primary_locations?.length ||
    !(currentOrg as any).focus_categories?.length;

  // Don't show if dismissed
  if (dismissed) {
    return null;
  }

  // Show either for incomplete profiles, or for all profiles if showForCompleteProfiles is true
  if (!isProfileIncomplete && !showForCompleteProfiles) {
    return null;
  }

  const title = isProfileIncomplete
    ? "Get Personalized Grant Recommendations"
    : "Refresh Your Eligibility Profile";

  const description = isProfileIncomplete
    ? "Complete your eligibility profile to unlock AI-powered grant matching and see recommendations tailored to your organization's needs."
    : "Update your eligibility profile to ensure you're seeing the most relevant grant opportunities for your organization.";

  const buttonText = isProfileIncomplete ? "Complete Profile" : "Update Profile";

  return (
    <Alert
      variant="light"
      color="violet"
      icon={<IconSparkles size={20} />}
      title={title}
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
            {description}
          </Text>
          {isProfileIncomplete && (
            <Text size="xs" c="dimmed">
              Takes just 2-3 minutes • Get instant grant matches • Improve recommendation accuracy
            </Text>
          )}
        </div>
        <Button
          component={Link}
          to="/onboarding/eligibility"
          size="sm"
          variant="light"
          color="violet"
          leftSection={<IconSparkles size={16} />}
        >
          {buttonText}
        </Button>
      </Group>
    </Alert>
  );
}
