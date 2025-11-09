import { useState } from 'react';
import { Stack, Title, Text, Paper, Button, TextInput, Group, ThemeIcon, Alert } from '@mantine/core';
import { IconBuilding, IconPlus, IconAlertCircle } from '@tabler/icons-react';
import { supabase } from '../lib/supabase';
import { notifications } from '@mantine/notifications';
import { useOrganization } from '../contexts/OrganizationContext';

export function NoOrganization() {
  const { refreshOrgs } = useOrganization();
  const [creating, setCreating] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [showForm, setShowForm] = useState(false);

  const handleCreateOrg = async () => {
    if (!orgName.trim()) {
      notifications.show({
        title: 'Error',
        message: 'Please enter an organization name',
        color: 'red',
      });
      return;
    }

    setCreating(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: orgName.trim(),
          slug: orgName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') +
            '-' +
            Math.random().toString(36).substring(2, 8),
        } as any)
        .select()
        .single();

      if (orgError || !org) throw orgError || new Error('Failed to create organization');

      // Add user as admin
      const { error: memberError } = await supabase.from('org_members').insert({
        org_id: (org as any).id,
        user_id: user.id,
        role: 'admin',
      } as any);

      if (memberError) throw memberError;

      notifications.show({
        title: 'Success!',
        message: 'Your organization has been created',
        color: 'green',
      });

      // Refresh organizations
      await refreshOrgs();
    } catch (error: any) {
      console.error('Error creating organization:', error);
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to create organization',
        color: 'red',
      });
    } finally {
      setCreating(false);
    }
  };

  if (!showForm) {
    return (
      <Paper p="xl" withBorder maw={600} mx="auto">
        <Stack gap="lg" align="center">
          <ThemeIcon size={80} radius="xl" variant="light" color="grape">
            <IconBuilding size={40} />
          </ThemeIcon>

          <Stack gap="sm" align="center">
            <Title order={2}>Welcome to GrantCue!</Title>
            <Text ta="center" c="dimmed">
              To get started, you'll need to create an organization. Organizations help you manage grants and
              collaborate with your team.
            </Text>
          </Stack>

          <Alert icon={<IconAlertCircle size={16} />} color="blue" w="100%">
            <Text size="sm">
              An organization is your workspace for managing grants. You can invite team members, track deadlines, and
              collaborate on grant applications.
            </Text>
          </Alert>

          <Button
            size="lg"
            leftSection={<IconPlus size={20} />}
            onClick={() => setShowForm(true)}
            color="grape"
          >
            Create Organization
          </Button>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper p="xl" withBorder maw={600} mx="auto">
      <Stack gap="lg">
        <Stack gap="sm">
          <Title order={2}>Create Your Organization</Title>
          <Text c="dimmed">Choose a name for your organization. You can change this later in settings.</Text>
        </Stack>

        <TextInput
          label="Organization Name"
          placeholder="e.g., Acme Foundation, City Services Department"
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          required
          size="md"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleCreateOrg();
            }
          }}
        />

        <Group justify="flex-end">
          <Button variant="subtle" onClick={() => setShowForm(false)} disabled={creating}>
            Cancel
          </Button>
          <Button onClick={handleCreateOrg} loading={creating} color="grape">
            Create Organization
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
