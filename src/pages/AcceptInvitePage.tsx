import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Stack, Title, Text, Paper, Button, Alert, Loader, ThemeIcon, Group } from '@mantine/core';
import { IconCheck, IconAlertCircle, IconX } from '@tabler/icons-react';
import { supabase } from '../lib/supabase';
import { notifications } from '@mantine/notifications';
import { useOrganization } from '../contexts/OrganizationContext';

type InvitationStatus = 'loading' | 'valid' | 'expired' | 'revoked' | 'not_found' | 'already_accepted' | 'error';

interface Invitation {
  id: string;
  org_id: string;
  email: string;
  role: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  organization_name?: string;
}

export function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshOrgs, switchOrg } = useOrganization();

  const [status, setStatus] = useState<InvitationStatus>('loading');
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [accepting, setAccepting] = useState(false);

  const invitationId = searchParams.get('id');
  const email = searchParams.get('email');

  useEffect(() => {
    if (!invitationId || !email) {
      setStatus('not_found');
      return;
    }

    loadInvitation();
  }, [invitationId, email]);

  const loadInvitation = async () => {
    if (!invitationId || !email) return;

    try {
      // Fetch invitation with organization name
      const { data, error } = await supabase
        .from('team_invitations')
        .select(`
          *,
          organizations (
            name
          )
        `)
        .eq('id', invitationId)
        .eq('email', email)
        .single();

      if (error || !data) {
        setStatus('not_found');
        return;
      }

      const inv = data as any;
      const invitationData: Invitation = {
        id: inv.id,
        org_id: inv.org_id,
        email: inv.email,
        role: inv.role,
        expires_at: inv.expires_at,
        accepted_at: inv.accepted_at,
        revoked_at: inv.revoked_at,
        organization_name: inv.organizations?.name,
      };

      setInvitation(invitationData);

      // Check invitation status
      if (invitationData.revoked_at) {
        setStatus('revoked');
      } else if (invitationData.accepted_at) {
        setStatus('already_accepted');
      } else if (new Date(invitationData.expires_at) < new Date()) {
        setStatus('expired');
      } else {
        setStatus('valid');
      }
    } catch (error) {
      console.error('Error loading invitation:', error);
      setStatus('error');
    }
  };

  const handleAcceptInvitation = async () => {
    if (!invitation) return;

    setAccepting(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        notifications.show({
          title: 'Error',
          message: 'You must be signed in to accept an invitation',
          color: 'red',
        });
        navigate(`/signin?redirect=/accept-invite?id=${invitationId}&email=${email}`);
        return;
      }

      // Verify email matches
      if (user.email !== invitation.email) {
        notifications.show({
          title: 'Error',
          message: `This invitation is for ${invitation.email}. Please sign in with that email.`,
          color: 'red',
        });
        setAccepting(false);
        return;
      }

      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from('org_members')
        .select('id')
        .eq('org_id', invitation.org_id)
        .eq('user_id', user.id)
        .single();

      if (existingMember) {
        // Mark invitation as accepted
        await supabase
          .from('team_invitations')
          .update({ accepted_at: new Date().toISOString() } as any)
          .eq('id', invitation.id);

        notifications.show({
          title: 'Already a member',
          message: 'You are already a member of this organization',
          color: 'blue',
        });

        await refreshOrgs();
        navigate('/discover');
        return;
      }

      // Add user to organization
      const { error: memberError } = await supabase
        .from('org_members')
        .insert({
          org_id: invitation.org_id,
          user_id: user.id,
          role: invitation.role,
        } as any);

      if (memberError) throw memberError;

      // Mark invitation as accepted
      const { error: updateError } = await supabase
        .from('team_invitations')
        .update({ accepted_at: new Date().toISOString() } as any)
        .eq('id', invitation.id);

      if (updateError) throw updateError;

      notifications.show({
        title: 'Invitation accepted!',
        message: `You've joined ${invitation.organization_name || 'the organization'}`,
        color: 'green',
      });

      // Refresh organizations and switch to the new org
      await refreshOrgs();
      switchOrg(invitation.org_id);

      navigate('/discover');
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to accept invitation',
        color: 'red',
      });
    } finally {
      setAccepting(false);
    }
  };

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <Stack align="center" gap="lg">
            <Loader size="lg" />
            <Text>Loading invitation...</Text>
          </Stack>
        );

      case 'valid':
        return (
          <Stack gap="lg">
            <Stack align="center" gap="sm">
              <ThemeIcon size={60} radius="xl" variant="light" color="grape">
                <IconCheck size={30} />
              </ThemeIcon>
              <Title order={2}>You're Invited!</Title>
              <Text ta="center" c="dimmed">
                You've been invited to join{' '}
                <Text component="span" fw={600}>
                  {invitation?.organization_name || 'an organization'}
                </Text>
              </Text>
            </Stack>

            <Paper p="md" withBorder>
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Email
                  </Text>
                  <Text size="sm" fw={500}>
                    {invitation?.email}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Role
                  </Text>
                  <Text size="sm" fw={500} tt="capitalize">
                    {invitation?.role}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Expires
                  </Text>
                  <Text size="sm" fw={500}>
                    {invitation?.expires_at &&
                      new Date(invitation.expires_at).toLocaleDateString()}
                  </Text>
                </Group>
              </Stack>
            </Paper>

            <Alert color="blue">
              <Text size="sm">
                By accepting this invitation, you'll join the organization as a{' '}
                <strong>{invitation?.role}</strong>.
              </Text>
            </Alert>

            <Button size="lg" onClick={handleAcceptInvitation} loading={accepting}>
              Accept Invitation
            </Button>

            <Button variant="subtle" onClick={() => navigate('/')}>
              Decline
            </Button>
          </Stack>
        );

      case 'expired':
        return (
          <Stack align="center" gap="lg">
            <ThemeIcon size={60} radius="xl" variant="light" color="red">
              <IconAlertCircle size={30} />
            </ThemeIcon>
            <Title order={2}>Invitation Expired</Title>
            <Text ta="center" c="dimmed">
              This invitation has expired. Please contact the organization admin for a new
              invitation.
            </Text>
            <Button onClick={() => navigate('/')}>Go to Home</Button>
          </Stack>
        );

      case 'revoked':
        return (
          <Stack align="center" gap="lg">
            <ThemeIcon size={60} radius="xl" variant="light" color="red">
              <IconX size={30} />
            </ThemeIcon>
            <Title order={2}>Invitation Revoked</Title>
            <Text ta="center" c="dimmed">
              This invitation has been revoked by the organization admin.
            </Text>
            <Button onClick={() => navigate('/')}>Go to Home</Button>
          </Stack>
        );

      case 'already_accepted':
        return (
          <Stack align="center" gap="lg">
            <ThemeIcon size={60} radius="xl" variant="light" color="blue">
              <IconCheck size={30} />
            </ThemeIcon>
            <Title order={2}>Already Accepted</Title>
            <Text ta="center" c="dimmed">
              You've already accepted this invitation.
            </Text>
            <Button onClick={() => navigate('/discover')}>Go to Dashboard</Button>
          </Stack>
        );

      case 'not_found':
      case 'error':
      default:
        return (
          <Stack align="center" gap="lg">
            <ThemeIcon size={60} radius="xl" variant="light" color="red">
              <IconAlertCircle size={30} />
            </ThemeIcon>
            <Title order={2}>Invalid Invitation</Title>
            <Text ta="center" c="dimmed">
              This invitation link is invalid or has been removed.
            </Text>
            <Button onClick={() => navigate('/')}>Go to Home</Button>
          </Stack>
        );
    }
  };

  return (
    <Stack
      mih="100vh"
      justify="center"
      align="center"
      p="xl"
      style={{
        background: 'linear-gradient(135deg, var(--mantine-color-grape-0) 0%, var(--mantine-color-blue-0) 100%)',
      }}
    >
      <Paper p="xl" withBorder maw={500} w="100%">
        {renderContent()}
      </Paper>
    </Stack>
  );
}
