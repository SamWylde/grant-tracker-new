/**
 * TwoFactorVerify Component
 * Verify 2FA code during login
 */

import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Group,
  PinInput,
  Stack,
  Text,
  TextInput,
  Title,
  Anchor,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconShieldCheck, IconAlertCircle } from '@tabler/icons-react';
import { supabase } from '../../lib/supabase';

interface TwoFactorVerifyProps {
  userId: string;
  onSuccess: () => void;
  onCancel?: () => void;
}

export function TwoFactorVerify({ userId, onSuccess, onCancel }: TwoFactorVerifyProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [backupCode, setBackupCode] = useState('');
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);

  const handleVerify = async () => {
    const codeToVerify = useBackupCode ? backupCode : code;

    if (!codeToVerify || (!useBackupCode && codeToVerify.length !== 6)) {
      notifications.show({
        message: 'Please enter a valid verification code',
        color: 'red',
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch('/api/2fa/verify', {
        method: 'POST',
        headers: {
          'Authorization': session ? `Bearer ${session.access_token}` : '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: codeToVerify,
          userId: userId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error(
            `Too many failed attempts. Please wait ${Math.ceil(data.waitTime / 60)} minutes and try again.`
          );
        }

        setRemainingAttempts(data.remainingAttempts);
        throw new Error(data.error || 'Invalid code');
      }

      if (data.isBackupCode && data.remainingBackupCodes === 0) {
        notifications.show({
          title: 'Warning',
          message: 'This was your last backup code. Please generate new ones in your security settings.',
          color: 'yellow',
          autoClose: 10000,
        });
      } else if (data.isBackupCode) {
        notifications.show({
          title: 'Backup code used',
          message: `You have ${data.remainingBackupCodes} backup codes remaining.`,
          color: 'blue',
        });
      }

      notifications.show({
        title: 'Success',
        message: 'Verification successful',
        color: 'green',
      });

      onSuccess();
    } catch (error) {
      console.error('Error verifying 2FA:', error);
      notifications.show({
        title: 'Verification Failed',
        message: error instanceof Error ? error.message : 'Invalid code',
        color: 'red',
        icon: <IconAlertCircle />,
      });

      setCode('');
      setBackupCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleVerify();
    }
  };

  return (
    <Card withBorder p="xl" maw={500} mx="auto">
      <Stack gap="lg">
        <Box ta="center">
          <IconShieldCheck size={64} color="var(--mantine-color-blue-6)" />
          <Title order={2} mt="md">
            Two-Factor Authentication
          </Title>
          <Text c="dimmed" size="sm" mt="xs">
            Enter the verification code from your authenticator app
          </Text>
        </Box>

        {remainingAttempts !== null && remainingAttempts < 3 && (
          <Alert color="yellow" icon={<IconAlertCircle />}>
            {remainingAttempts === 0
              ? 'Account temporarily locked due to too many failed attempts'
              : `Warning: ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining`}
          </Alert>
        )}

        {!useBackupCode ? (
          <Box>
            <Text size="sm" fw={500} mb="xs">
              Verification Code
            </Text>
            <PinInput
              length={6}
              value={code}
              onChange={setCode}
              type="number"
              size="lg"
              disabled={loading}
              onKeyDown={handleKeyDown}
            />
            <Text size="xs" c="dimmed" mt="xs">
              Open your authenticator app to get your verification code
            </Text>
          </Box>
        ) : (
          <Box>
            <Text size="sm" fw={500} mb="xs">
              Backup Code
            </Text>
            <TextInput
              value={backupCode}
              onChange={(e) => setBackupCode(e.currentTarget.value)}
              placeholder="XXXX-XXXX"
              size="lg"
              disabled={loading}
              onKeyDown={handleKeyDown}
            />
            <Text size="xs" c="dimmed" mt="xs">
              Enter one of your backup codes (with or without dashes)
            </Text>
          </Box>
        )}

        <Button onClick={handleVerify} loading={loading} fullWidth size="lg">
          Verify
        </Button>

        <Box ta="center">
          <Anchor
            size="sm"
            onClick={() => {
              setUseBackupCode(!useBackupCode);
              setCode('');
              setBackupCode('');
            }}
          >
            {useBackupCode ? 'Use authenticator app code' : 'Use a backup code instead'}
          </Anchor>
        </Box>

        {onCancel && (
          <Button variant="subtle" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </Stack>
    </Card>
  );
}
