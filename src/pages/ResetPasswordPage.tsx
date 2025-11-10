import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Container,
  Paper,
  Title,
  Text,
  TextInput,
  Button,
  Stack,
  Anchor,
  Alert,
} from '@mantine/core';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { supabase } from '../lib/supabase';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });

      if (resetError) {
        setError(resetError.message);
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Container size="xs" style={{ marginTop: '80px' }}>
        <Paper shadow="md" p="xl" radius="md" withBorder>
          <Stack gap="lg">
            <Alert icon={<IconCheck size={16} />} title="Check your email" color="green">
              We've sent you an email with a password reset link. Please check your inbox and
              click the link to reset your password.
            </Alert>
            <Text c="dimmed" size="sm" ta="center">
              Remember your password?{' '}
              <Anchor component={Link} to="/signin" size="sm">
                Sign in here
              </Anchor>
            </Text>
            <Text c="dimmed" size="sm" ta="center">
              <Anchor component={Link} to="/" size="sm">
                Back to home
              </Anchor>
            </Text>
          </Stack>
        </Paper>
      </Container>
    );
  }

  return (
    <Container size="xs" style={{ marginTop: '80px' }}>
      <Paper shadow="md" p="xl" radius="md" withBorder>
        <Stack gap="lg">
          <div>
            <Title order={2} ta="center" mb="xs">
              Reset your password
            </Title>
            <Text c="dimmed" size="sm" ta="center">
              Enter your email address and we'll send you a link to reset your password
            </Text>
          </div>

          {error && (
            <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              <TextInput
                label="Email"
                placeholder="your@email.com"
                type="email"
                autoComplete="email"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />

              <Button type="submit" fullWidth loading={loading}>
                Send reset link
              </Button>
            </Stack>
          </form>

          <Text c="dimmed" size="sm" ta="center">
            Remember your password?{' '}
            <Anchor component={Link} to="/signin" size="sm">
              Sign in
            </Anchor>
          </Text>

          <Text c="dimmed" size="sm" ta="center">
            <Anchor component={Link} to="/" size="sm">
              Back to home
            </Anchor>
          </Text>
        </Stack>
      </Paper>
    </Container>
  );
}
