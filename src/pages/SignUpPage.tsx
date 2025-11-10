import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Container,
  Paper,
  Title,
  Text,
  TextInput,
  PasswordInput,
  Button,
  Stack,
  Anchor,
  Alert,
} from '@mantine/core';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function SignUpPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/discover');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    // Validation
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        // Check if email confirmation is required
        if (data.user.confirmed_at) {
          // User is already confirmed, redirect to discover page
          navigate('/discover');
        } else {
          // Show success message - email confirmation required
          setSuccess(true);
          setLoading(false);
        }
      }
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
              We've sent you an email with a confirmation link. Please check your inbox and click
              the link to activate your account.
            </Alert>
            <Text c="dimmed" size="sm" ta="center">
              Already confirmed?{' '}
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
              Create your account
            </Title>
            <Text c="dimmed" size="sm" ta="center">
              Start discovering grant opportunities today
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
                label="Full Name"
                placeholder="John Doe"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
              />

              <TextInput
                label="Email"
                placeholder="your@email.com"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />

              <PasswordInput
                label="Password"
                placeholder="Create a password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                description="Must be at least 6 characters"
              />

              <PasswordInput
                label="Confirm Password"
                placeholder="Confirm your password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
              />

              <Button type="submit" fullWidth loading={loading}>
                Create account
              </Button>
            </Stack>
          </form>

          <Text c="dimmed" size="sm" ta="center">
            Already have an account?{' '}
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
