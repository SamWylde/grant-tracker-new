import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Title,
  Text,
  PasswordInput,
  Button,
  Stack,
  Alert,
} from '@mantine/core';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { supabase } from '../lib/supabase';

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  // Check if user arrived here from a valid password reset link
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Invalid or expired reset link. Please request a new password reset.');
      }
    };
    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validation
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      setLoading(false);
      return;
    }

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }

      setSuccess(true);
      // Redirect to sign-in after 2 seconds
      setTimeout(() => {
        navigate('/signin');
      }, 2000);
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
            <Alert icon={<IconCheck size={16} />} title="Password updated" color="green">
              Your password has been successfully updated. Redirecting you to sign in...
            </Alert>
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
              Update your password
            </Title>
            <Text c="dimmed" size="sm" ta="center">
              Enter your new password below
            </Text>
          </div>

          {error && (
            <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              <PasswordInput
                label="New Password"
                placeholder="Enter your new password (min. 8 characters)"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                description="Minimum 8 characters. Include uppercase, lowercase, digits and symbols for a strong password."
              />

              <PasswordInput
                label="Confirm New Password"
                placeholder="Confirm your new password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
              />

              <Button type="submit" fullWidth loading={loading}>
                Update password
              </Button>
            </Stack>
          </form>
        </Stack>
      </Paper>
    </Container>
  );
}
