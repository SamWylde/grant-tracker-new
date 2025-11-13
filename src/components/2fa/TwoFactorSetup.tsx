/**
 * TwoFactorSetup Component
 * Displays QR code and backup codes for 2FA setup
 */

import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Code,
  CopyButton,
  Group,
  Image,
  Modal,
  Paper,
  PinInput,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconShieldCheck,
  IconCopy,
  IconCheck,
  IconAlertCircle,
  IconDownload,
} from '@tabler/icons-react';
import { supabase } from '../../lib/supabase';

interface TwoFactorSetupProps {
  onSetupComplete?: () => void;
  onCancel?: () => void;
}

interface SetupData {
  qrCode: string;
  secret: string;
  backupCodes: string[];
}

export function TwoFactorSetup({ onSetupComplete, onCancel }: TwoFactorSetupProps) {
  const [loading, setLoading] = useState(false);
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [showBackupCodes, { open: openBackupCodes, close: closeBackupCodes }] = useDisclosure(false);

  const initiateSetup = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/2fa/setup', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to setup 2FA');
      }

      setSetupData({
        qrCode: data.qrCode,
        secret: data.secret,
        backupCodes: data.backupCodes,
      });
    } catch (error) {
      console.error('Error setting up 2FA:', error);
      notifications.show({
        title: 'Setup Failed',
        message: error instanceof Error ? error.message : 'Failed to setup 2FA',
        color: 'red',
        icon: <IconAlertCircle />,
      });
    } finally {
      setLoading(false);
    }
  };

  const verifyAndEnable = async () => {
    if (verificationCode.length !== 6) {
      notifications.show({
        message: 'Please enter a 6-digit code',
        color: 'red',
      });
      return;
    }

    setVerifying(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/2fa/verify-setup', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: verificationCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Invalid code');
      }

      notifications.show({
        title: 'Success!',
        message: 'Two-factor authentication has been enabled',
        color: 'green',
        icon: <IconCheck />,
      });

      // Show backup codes before completing
      openBackupCodes();
    } catch (error) {
      console.error('Error verifying 2FA:', error);
      notifications.show({
        title: 'Verification Failed',
        message: error instanceof Error ? error.message : 'Invalid code',
        color: 'red',
        icon: <IconAlertCircle />,
      });
      setVerificationCode('');
    } finally {
      setVerifying(false);
    }
  };

  const downloadBackupCodes = () => {
    if (!setupData) return;

    const content = [
      'GrantCue Two-Factor Authentication Backup Codes',
      '===============================================',
      '',
      'Save these codes in a secure location. Each code can only be used once.',
      '',
      ...setupData.backupCodes,
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

  const handleComplete = () => {
    closeBackupCodes();
    onSetupComplete?.();
  };

  if (!setupData) {
    return (
      <Card withBorder p="xl">
        <Stack gap="lg" align="center">
          <IconShieldCheck size={64} color="var(--mantine-color-blue-6)" />
          <Title order={3}>Enable Two-Factor Authentication</Title>
          <Text c="dimmed" ta="center" maw={500}>
            Add an extra layer of security to your account by requiring a verification code from your
            authenticator app when signing in.
          </Text>
          <Group>
            <Button variant="light" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={initiateSetup} loading={loading}>
              Get Started
            </Button>
          </Group>
        </Stack>
      </Card>
    );
  }

  return (
    <>
      <Card withBorder p="xl">
        <Stack gap="xl">
          <Title order={3}>Setup Authenticator App</Title>

          <Alert color="blue" icon={<IconAlertCircle />}>
            Scan the QR code with your authenticator app (such as Google Authenticator, Authy, or 1Password)
          </Alert>

          {/* QR Code */}
          <Box ta="center">
            <Paper p="md" withBorder style={{ display: 'inline-block' }}>
              <Image src={setupData.qrCode} alt="QR Code" width={250} height={250} />
            </Paper>
          </Box>

          {/* Manual Entry */}
          <Box>
            <Text size="sm" fw={500} mb="xs">
              Can't scan? Enter this code manually:
            </Text>
            <Group gap="xs">
              <Code block>{setupData.secret}</Code>
              <CopyButton value={setupData.secret}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? 'Copied!' : 'Copy'}>
                    <Button
                      variant="light"
                      size="sm"
                      onClick={copy}
                      leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                    >
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                  </Tooltip>
                )}
              </CopyButton>
            </Group>
          </Box>

          {/* Verification */}
          <Box>
            <Text size="sm" fw={500} mb="xs">
              Enter the 6-digit code from your app to verify:
            </Text>
            <Group gap="md" align="flex-end">
              <PinInput
                length={6}
                value={verificationCode}
                onChange={setVerificationCode}
                type="number"
                size="lg"
                disabled={verifying}
              />
              <Button onClick={verifyAndEnable} loading={verifying} disabled={verificationCode.length !== 6}>
                Verify & Enable
              </Button>
            </Group>
          </Box>

          <Button variant="subtle" onClick={onCancel}>
            Cancel
          </Button>
        </Stack>
      </Card>

      {/* Backup Codes Modal */}
      <Modal
        opened={showBackupCodes}
        onClose={handleComplete}
        title="Save Your Backup Codes"
        size="md"
        closeOnClickOutside={false}
        closeOnEscape={false}
      >
        <Stack gap="lg">
          <Alert color="yellow" icon={<IconAlertCircle />}>
            <Text fw={500}>Important: Save these codes now!</Text>
            <Text size="sm" mt="xs">
              Each code can only be used once. Store them in a secure location. You won't see them again.
            </Text>
          </Alert>

          <Paper p="md" withBorder>
            <Stack gap="xs">
              {setupData.backupCodes.map((code, index) => (
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

          <Button onClick={handleComplete} fullWidth>
            I've Saved My Codes
          </Button>
        </Stack>
      </Modal>
    </>
  );
}
