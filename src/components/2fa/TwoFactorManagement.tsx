/**
 * TwoFactorManagement Component
 * Manage 2FA settings, view status, regenerate backup codes
 */

import { useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Code,
  CopyButton,
  Group,
  List,
  Modal,
  Paper,
  PinInput,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconShieldCheck,
  IconShieldOff,
  IconAlertCircle,
  IconCheck,
  IconCopy,
  IconDownload,
  IconRefresh,
} from '@tabler/icons-react';
import { supabase } from '../../lib/supabase';
import { TwoFactorSetup } from './TwoFactorSetup';

interface TwoFactorStatus {
  enabled: boolean;
  verifiedAt: string | null;
  backupCodesRemaining: number;
  requiredByOrg: boolean;
  organizations: Array<{
    name: string;
    role: string;
    requires2FA: boolean;
  }>;
}

export function TwoFactorManagement() {
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [showDisable, { open: openDisable, close: closeDisable }] = useDisclosure(false);
  const [showRegenerate, { open: openRegenerate, close: closeRegenerate }] = useDisclosure(false);
  const [disableCode, setDisableCode] = useState('');
  const [regenerateCode, setRegenerateCode] = useState('');
  const [processing, setProcessing] = useState(false);
  const [newBackupCodes, setNewBackupCodes] = useState<string[]>([]);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/2fa/status', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch status');
      }

      setStatus(data);
    } catch (error) {
      console.error('Error fetching 2FA status:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load 2FA status',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    if (disableCode.length !== 6) {
      notifications.show({
        message: 'Please enter a 6-digit code',
        color: 'red',
      });
      return;
    }

    setProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/2fa/disable', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: disableCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to disable 2FA');
      }

      notifications.show({
        title: 'Success',
        message: 'Two-factor authentication has been disabled',
        color: 'green',
        icon: <IconCheck />,
      });

      closeDisable();
      setDisableCode('');
      await fetchStatus();
    } catch (error) {
      console.error('Error disabling 2FA:', error);
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to disable 2FA',
        color: 'red',
        icon: <IconAlertCircle />,
      });
      setDisableCode('');
    } finally {
      setProcessing(false);
    }
  };

  const handleRegenerate = async () => {
    if (regenerateCode.length !== 6) {
      notifications.show({
        message: 'Please enter a 6-digit code',
        color: 'red',
      });
      return;
    }

    setProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/2fa/regenerate-backup-codes', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: regenerateCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to regenerate codes');
      }

      setNewBackupCodes(data.backupCodes);
      notifications.show({
        title: 'Success',
        message: 'New backup codes generated',
        color: 'green',
        icon: <IconCheck />,
      });

      setRegenerateCode('');
      await fetchStatus();
    } catch (error) {
      console.error('Error regenerating codes:', error);
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to regenerate codes',
        color: 'red',
        icon: <IconAlertCircle />,
      });
      setRegenerateCode('');
    } finally {
      setProcessing(false);
    }
  };

  const downloadBackupCodes = () => {
    const content = [
      'GrantCue Two-Factor Authentication Backup Codes',
      '===============================================',
      '',
      'Save these codes in a secure location. Each code can only be used once.',
      '',
      ...newBackupCodes,
      '',
      `Generated: ${new Date().toLocaleString()}`,
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `grantcue-backup-codes-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <Card withBorder p="xl"><Text>Loading...</Text></Card>;
  }

  if (showSetup) {
    return (
      <TwoFactorSetup
        onSetupComplete={() => {
          setShowSetup(false);
          fetchStatus();
        }}
        onCancel={() => setShowSetup(false)}
      />
    );
  }

  return (
    <>
      <Card withBorder p="xl">
        <Stack gap="lg">
          <Group justify="space-between">
            <Box>
              <Title order={3}>Two-Factor Authentication</Title>
              <Text size="sm" c="dimmed" mt={4}>
                Add an extra layer of security to your account
              </Text>
            </Box>
            <Badge
              size="lg"
              color={status?.enabled ? 'green' : 'gray'}
              leftSection={
                <ThemeIcon size={16} color={status?.enabled ? 'green' : 'gray'} variant="transparent">
                  {status?.enabled ? <IconShieldCheck size={14} /> : <IconShieldOff size={14} />}
                </ThemeIcon>
              }
            >
              {status?.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </Group>

          {status?.requiredByOrg && (
            <Alert color="blue" icon={<IconAlertCircle />}>
              Your organization requires two-factor authentication for your role.
            </Alert>
          )}

          {status?.enabled ? (
            <Stack gap="md">
              <Box>
                <Text size="sm" fw={500} mb="xs">
                  Status
                </Text>
                <List size="sm" spacing="xs">
                  <List.Item>
                    Enabled on {status.verifiedAt ? new Date(status.verifiedAt).toLocaleDateString() : 'Unknown'}
                  </List.Item>
                  <List.Item>
                    Backup codes remaining: <strong>{status.backupCodesRemaining}</strong>
                  </List.Item>
                </List>
              </Box>

              {status.backupCodesRemaining < 3 && (
                <Alert color="yellow" icon={<IconAlertCircle />}>
                  You're running low on backup codes. Consider regenerating them.
                </Alert>
              )}

              <Group>
                <Button
                  variant="light"
                  leftSection={<IconRefresh size={16} />}
                  onClick={openRegenerate}
                >
                  Regenerate Backup Codes
                </Button>
                {!status.requiredByOrg && (
                  <Button
                    variant="light"
                    color="red"
                    leftSection={<IconShieldOff size={16} />}
                    onClick={openDisable}
                  >
                    Disable 2FA
                  </Button>
                )}
              </Group>
            </Stack>
          ) : (
            <Box>
              <Text size="sm" mb="md">
                Protect your account with an additional layer of security. You'll need both your password and a
                verification code from your phone to sign in.
              </Text>
              <Button onClick={() => setShowSetup(true)}>
                Enable Two-Factor Authentication
              </Button>
            </Box>
          )}

          {status?.organizations && status.organizations.length > 0 && (
            <Box>
              <Text size="sm" fw={500} mb="xs">
                Organization Requirements
              </Text>
              <Stack gap="xs">
                {status.organizations.map((org, index) => (
                  <Group key={index} gap="xs">
                    <Text size="sm">{org.name}</Text>
                    <Badge size="sm" variant="light">
                      {org.role}
                    </Badge>
                    {org.requires2FA && (
                      <Badge size="sm" color="blue">
                        2FA Required
                      </Badge>
                    )}
                  </Group>
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      </Card>

      {/* Disable 2FA Modal */}
      <Modal
        opened={showDisable}
        onClose={closeDisable}
        title="Disable Two-Factor Authentication"
        size="md"
      >
        <Stack gap="lg">
          <Alert color="yellow" icon={<IconAlertCircle />}>
            Disabling 2FA will make your account less secure. You'll only need your password to sign in.
          </Alert>

          <Box>
            <Text size="sm" fw={500} mb="xs">
              Enter a verification code from your authenticator app to confirm:
            </Text>
            <PinInput
              length={6}
              value={disableCode}
              onChange={setDisableCode}
              type="number"
              size="lg"
              disabled={processing}
            />
          </Box>

          <Group justify="flex-end">
            <Button variant="subtle" onClick={closeDisable} disabled={processing}>
              Cancel
            </Button>
            <Button
              color="red"
              onClick={handleDisable}
              loading={processing}
              disabled={disableCode.length !== 6}
            >
              Disable 2FA
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Regenerate Backup Codes Modal */}
      <Modal
        opened={showRegenerate}
        onClose={() => {
          closeRegenerate();
          setNewBackupCodes([]);
        }}
        title="Regenerate Backup Codes"
        size="md"
        closeOnClickOutside={newBackupCodes.length === 0}
      >
        <Stack gap="lg">
          {newBackupCodes.length === 0 ? (
            <>
              <Alert color="yellow" icon={<IconAlertCircle />}>
                This will invalidate all existing backup codes and generate new ones.
              </Alert>

              <Box>
                <Text size="sm" fw={500} mb="xs">
                  Enter a verification code from your authenticator app to confirm:
                </Text>
                <PinInput
                  length={6}
                  value={regenerateCode}
                  onChange={setRegenerateCode}
                  type="number"
                  size="lg"
                  disabled={processing}
                />
              </Box>

              <Group justify="flex-end">
                <Button variant="subtle" onClick={closeRegenerate} disabled={processing}>
                  Cancel
                </Button>
                <Button
                  onClick={handleRegenerate}
                  loading={processing}
                  disabled={regenerateCode.length !== 6}
                >
                  Regenerate Codes
                </Button>
              </Group>
            </>
          ) : (
            <>
              <Alert color="green" icon={<IconCheck />}>
                Your new backup codes have been generated. Save them now!
              </Alert>

              <Paper p="md" withBorder>
                <Stack gap="xs">
                  {newBackupCodes.map((code, index) => (
                    <Group key={index} justify="space-between">
                      <Code>{code}</Code>
                      <CopyButton value={code}>
                        {({ copied, copy }) => (
                          <Tooltip label={copied ? 'Copied!' : 'Copy'}>
                            <Button variant="subtle" size="xs" onClick={copy}>
                              {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                            </Button>
                          </Tooltip>
                        )}
                      </CopyButton>
                    </Group>
                  ))}
                </Stack>
              </Paper>

              <Button
                variant="light"
                leftSection={<IconDownload size={16} />}
                onClick={downloadBackupCodes}
              >
                Download Codes
              </Button>

              <Button
                onClick={() => {
                  closeRegenerate();
                  setNewBackupCodes([]);
                }}
                fullWidth
              >
                I've Saved My Codes
              </Button>
            </>
          )}
        </Stack>
      </Modal>
    </>
  );
}
