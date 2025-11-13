import { useState } from 'react';
import {
  Modal,
  Stack,
  TextInput,
  Textarea,
  NumberInput,
  Select,
  Checkbox,
  Button,
  Group,
  Alert,
} from '@mantine/core';
import { IconAlertCircle, IconPlus } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useOrganization } from '../contexts/OrganizationContext';
import { supabase } from '../lib/supabase';
import { FUNDING_CATEGORIES } from '../types/grants';
import { useQuery } from '@tanstack/react-query';

interface CustomGrantFormProps {
  opened: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CustomGrantForm({ opened, onClose, onSuccess }: CustomGrantFormProps) {
  const { currentOrg } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [funderId, setFunderId] = useState<string | null>(null);
  const [opportunityNumber, setOpportunityNumber] = useState('');
  const [estimatedFunding, setEstimatedFunding] = useState<number | string>('');
  const [awardFloor, setAwardFloor] = useState<number | string>('');
  const [awardCeiling, setAwardCeiling] = useState<number | string>('');
  const [expectedAwards, setExpectedAwards] = useState<number | string>('');
  const [fundingCategory, setFundingCategory] = useState<string | null>(null);
  const [costSharingRequired, setCostSharingRequired] = useState(false);
  const [openDate, setOpenDate] = useState('');
  const [closeDate, setCloseDate] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [applicationUrl, setApplicationUrl] = useState('');

  // Fetch funders
  const { data: funders } = useQuery({
    queryKey: ['funders', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return [];

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];

      const response = await fetch(`/api/funders?org_id=${currentOrg.id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) return [];

      const result = await response.json();
      return result.funders || [];
    },
    enabled: !!currentOrg?.id && opened,
  });

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setFunderId(null);
    setOpportunityNumber('');
    setEstimatedFunding('');
    setAwardFloor('');
    setAwardCeiling('');
    setExpectedAwards('');
    setFundingCategory(null);
    setCostSharingRequired(false);
    setOpenDate('');
    setCloseDate('');
    setSourceUrl('');
    setApplicationUrl('');
    setErrors([]);
  };

  const handleSubmit = async () => {
    if (!currentOrg) {
      notifications.show({
        title: 'Error',
        message: 'No organization selected',
        color: 'red',
      });
      return;
    }

    setLoading(true);
    setErrors([]);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) throw new Error('Not authenticated');

      const grantData = {
        title,
        description: description || undefined,
        funder_id: funderId || undefined,
        opportunity_number: opportunityNumber || undefined,
        estimated_funding: estimatedFunding ? Number(estimatedFunding) : undefined,
        award_floor: awardFloor ? Number(awardFloor) : undefined,
        award_ceiling: awardCeiling ? Number(awardCeiling) : undefined,
        expected_awards: expectedAwards ? Number(expectedAwards) : undefined,
        funding_category: fundingCategory || undefined,
        cost_sharing_required: costSharingRequired,
        open_date: openDate || undefined,
        close_date: closeDate || undefined,
        opportunity_status: 'posted' as const,
        source_url: sourceUrl || undefined,
        application_url: applicationUrl || undefined,
      };

      const response = await fetch('/api/grants/custom', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          org_id: currentOrg.id,
          grant_data: grantData,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        if (error.details && Array.isArray(error.details)) {
          setErrors(error.details);
        } else {
          throw new Error(error.error || 'Failed to create grant');
        }
        return;
      }

      notifications.show({
        title: 'Success',
        message: 'Custom grant created successfully',
        color: 'green',
      });

      resetForm();
      onClose();
      onSuccess?.();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to create grant',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={() => {
        resetForm();
        onClose();
      }}
      title="Add Custom Grant"
      size="lg"
    >
      <Stack gap="md">
        {errors.length > 0 && (
          <Alert icon={<IconAlertCircle size={16} />} title="Validation Errors" color="red">
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </Alert>
        )}

        <TextInput
          label="Grant Title"
          placeholder="Enter grant title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <Textarea
          label="Description"
          placeholder="Describe the grant opportunity"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          minRows={3}
        />

        <Group grow>
          <Select
            label="Funder"
            placeholder="Select a funder"
            value={funderId}
            onChange={setFunderId}
            data={funders?.map((funder: any) => ({
              value: funder.id,
              label: funder.name,
            })) || []}
            searchable
            clearable
          />

          <TextInput
            label="Opportunity Number"
            placeholder="e.g., RFA-12345"
            value={opportunityNumber}
            onChange={(e) => setOpportunityNumber(e.target.value)}
          />
        </Group>

        <Select
          label="Funding Category"
          placeholder="Select category"
          value={fundingCategory}
          onChange={setFundingCategory}
          data={FUNDING_CATEGORIES.map((cat) => ({
            value: cat.value,
            label: cat.label,
          }))}
          searchable
          clearable
        />

        <Group grow>
          <NumberInput
            label="Estimated Total Funding"
            placeholder="0"
            value={estimatedFunding}
            onChange={setEstimatedFunding}
            prefix="$"
            thousandSeparator=","
            min={0}
          />

          <NumberInput
            label="Expected Awards"
            placeholder="0"
            value={expectedAwards}
            onChange={setExpectedAwards}
            min={0}
          />
        </Group>

        <Group grow>
          <NumberInput
            label="Award Floor"
            placeholder="Minimum award"
            value={awardFloor}
            onChange={setAwardFloor}
            prefix="$"
            thousandSeparator=","
            min={0}
          />

          <NumberInput
            label="Award Ceiling"
            placeholder="Maximum award"
            value={awardCeiling}
            onChange={setAwardCeiling}
            prefix="$"
            thousandSeparator=","
            min={0}
          />
        </Group>

        <Group grow>
          <TextInput
            label="Open Date"
            placeholder="YYYY-MM-DD"
            type="date"
            value={openDate}
            onChange={(e) => setOpenDate(e.target.value)}
          />

          <TextInput
            label="Close Date"
            placeholder="YYYY-MM-DD"
            type="date"
            value={closeDate}
            onChange={(e) => setCloseDate(e.target.value)}
            required
          />
        </Group>

        <Checkbox
          label="Cost sharing required"
          checked={costSharingRequired}
          onChange={(e) => setCostSharingRequired(e.target.checked)}
        />

        <TextInput
          label="Source URL"
          placeholder="https://..."
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
        />

        <TextInput
          label="Application URL"
          placeholder="https://..."
          value={applicationUrl}
          onChange={(e) => setApplicationUrl(e.target.value)}
        />

        <Group justify="flex-end" mt="md">
          <Button
            variant="subtle"
            onClick={() => {
              resetForm();
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button leftSection={<IconPlus size={16} />} onClick={handleSubmit} loading={loading}>
            Create Grant
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
