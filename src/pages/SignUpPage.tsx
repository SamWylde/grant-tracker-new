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
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/discover');
    }
  }, [user, navigate]);

  const handleResendConfirmation = async () => {
    setResendingEmail(true);
    setResendMessage(null);

    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });

      if (resendError) {
        setResendMessage('Unable to resend email. Please try again later.');
      } else {
        setResendMessage('Confirmation email sent! Please check your inbox.');
      }
    } catch (err) {
      setResendMessage('Unable to resend email. Please try again later.');
    } finally {
      setResendingEmail(false);
    }
  };

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
          emailRedirectTo: `${window.location.origin}/discover`,
        },
      });

      if (signUpError) {
        // Check if user already exists
        if (signUpError.message.includes('already registered') ||
            signUpError.message.includes('already been registered') ||
            signUpError.message.includes('User already registered')) {
          setError('An account with this email already exists. Please sign in instead.');
        } else {
          setError(signUpError.message);
        }
        setLoading(false);
        return;
      }

      if (data.user) {
        console.log('Signup response:', {
          id: data.user.id,
          email: data.user.email,
          confirmed_at: data.user.confirmed_at,
          has_session: !!data.session,
          identities: data.user.identities,
          created_at: data.user.created_at,
        });

        // Critical check: if identities is empty, the user already exists but Supabase
        // didn't return an error (this happens when "Secure email change" is enabled)
        if (data.user.identities && data.user.identities.length === 0) {
          console.warn('⚠️ User already exists (identities array is empty)');
          setError('An account with this email already exists. Please sign in or check your email for a confirmation link if you haven\'t confirmed yet.');
          setLoading(false);
          return;
        }

        // Check if user was auto-confirmed (email confirmation disabled)
        if (data.user.confirmed_at) {
          // User is already confirmed - email confirmation is DISABLED in Supabase
          console.log('✅ User auto-confirmed (email confirmation disabled)');
          navigate('/discover');
        } else {
          // Email confirmation required - email should have been sent for NEW user
          console.log('✅ New user created. Confirmation email should have been sent to:', data.user.email);
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

            {resendMessage && (
              <Alert
                color={resendMessage.includes('sent') ? 'green' : 'red'}
                icon={resendMessage.includes('sent') ? <IconCheck size={16} /> : <IconAlertCircle size={16} />}
              >
                {resendMessage}
              </Alert>
            )}

            <Button
              onClick={handleResendConfirmation}
              loading={resendingEmail}
              variant="light"
              fullWidth
            >
              Resend confirmation email
            </Button>

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
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
              />

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

              <PasswordInput
                label="Password"
                placeholder="Create a password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                description="Must be at least 6 characters"
              />

              <PasswordInput
                label="Confirm Password"
                placeholder="Confirm your password"
                autoComplete="new-password"
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
