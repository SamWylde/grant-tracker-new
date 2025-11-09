import { useState } from 'react';
import { Modal, Stack, TextInput, Button, Text, Alert, Group, Loader } from '@mantine/core';
import { IconLink, IconCheck, IconAlertCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useOrganization } from '../contexts/OrganizationContext';
import { useAuth } from '../contexts/AuthContext';

interface QuickAddGrantModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function QuickAddGrantModal({ opened, onClose, onSuccess }: QuickAddGrantModalProps) {
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extractGrantId = (urlString: string): string | null => {
    try {
      // Try to extract ID from various Grants.gov URL formats
      // Format 1: https://www.grants.gov/search-results-detail/12345
      // Format 2: https://www.grants.gov/web/grants/view-opportunity.html?oppId=12345

      const detailMatch = urlString.match(/search-results-detail\/(\d+)/);
      if (detailMatch) {
        return detailMatch[1];
      }

      const oppIdMatch = urlString.match(/oppId=(\d+)/);
      if (oppIdMatch) {
        return oppIdMatch[1];
      }

      // Check if it's just a number (direct ID)
      if (/^\d+$/.test(urlString.trim())) {
        return urlString.trim();
      }

      return null;
    } catch (e) {
      return null;
    }
  };

  const handleSubmit = async () => {
    setError(null);

    if (!url.trim()) {
      setError('Please enter a Grants.gov URL or grant ID');
      return;
    }

    const grantId = extractGrantId(url);

    if (!grantId) {
      setError('Invalid Grants.gov URL. Please use a URL like: https://www.grants.gov/search-results-detail/12345');
      return;
    }

    setLoading(true);

    try {
      // Fetch grant details from Grants.gov
      const detailsResponse = await fetch(`/api/grants/details?id=${grantId}`);

      if (!detailsResponse.ok) {
        throw new Error('Failed to fetch grant details. Please check the URL and try again.');
      }

      const grantDetails = await detailsResponse.json();

      // Save the grant
      const saveResponse = await fetch('/api/saved', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          org_id: currentOrg?.id,
          user_id: user?.id,
          external_source: 'grants.gov',
          external_id: grantId,
          title: grantDetails.title || 'Unknown Grant',
          agency: grantDetails.agency || null,
          aln: grantDetails.aln || null,
          open_date: grantDetails.postDate || null,
          close_date: grantDetails.closeDate || null,
        }),
      });

      if (!saveResponse.ok) {
        const errorData = await saveResponse.json();
        throw new Error(errorData.error || 'Failed to save grant');
      }

      notifications.show({
        title: 'Grant saved successfully!',
        message: `${grantDetails.title} has been added to your saved grants.`,
        color: 'green',
        icon: <IconCheck size={16} />,
      });

      setUrl('');
      onClose();
      onSuccess?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add grant';
      setError(errorMessage);
      notifications.show({
        title: 'Error',
        message: errorMessage,
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setUrl('');
    setError(null);
    onClose();
  };

  return (
    <Modal opened={opened} onClose={handleClose} title="Quick Add Grant from URL" size="md">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Paste a Grants.gov URL or grant ID to quickly save it to your collection.
        </Text>

        <TextInput
          label="Grants.gov URL or Grant ID"
          placeholder="https://www.grants.gov/search-results-detail/12345 or just 12345"
          leftSection={<IconLink size={16} />}
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
          error={error}
          disabled={loading}
        />

        <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
          <Text size="xs">
            Supported formats:
            <br />
            • https://www.grants.gov/search-results-detail/12345
            <br />
            • https://www.grants.gov/web/grants/view-opportunity.html?oppId=12345
            <br />• Grant ID only: 12345
          </Text>
        </Alert>

        <Group justify="flex-end" mt="md">
          <Button variant="light" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={loading} leftSection={loading ? <Loader size={16} /> : <IconCheck size={16} />}>
            Add Grant
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
