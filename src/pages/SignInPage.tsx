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
  Tabs,
  Divider,
} from '@mantine/core';
import { IconAlertCircle, IconMail, IconLock, IconCheck } from '@tabler/icons-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [magicLinkEmail, setMagicLinkEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicLinkError, setMagicLinkError] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/discover');
    }
  }, [user, navigate]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        // Redirect to discover page after successful sign-in
        navigate('/discover');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  const handleMagicLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMagicLinkLoading(true);
    setMagicLinkError(null);
    setMagicLinkSent(false);

    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: magicLinkEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/discover`,
        },
      });

      if (otpError) {
        setMagicLinkError(otpError.message);
        setMagicLinkLoading(false);
        return;
      }

      setMagicLinkSent(true);
      setMagicLinkLoading(false);
    } catch (err) {
      setMagicLinkError('An unexpected error occurred. Please try again.');
      setMagicLinkLoading(false);
    }
  };

  return (
    <Container size="xs" style={{ marginTop: '80px' }}>
      <Paper shadow="md" p="xl" radius="md" withBorder>
        <Stack gap="lg">
          <div>
            <Title order={2} ta="center" mb="xs">
              Welcome back
            </Title>
            <Text c="dimmed" size="sm" ta="center">
              Sign in to your account to continue
            </Text>
          </div>

          <Tabs defaultValue="password" variant="pills">
            <Tabs.List grow>
              <Tabs.Tab value="password" leftSection={<IconLock size={16} />}>
                Password
              </Tabs.Tab>
              <Tabs.Tab value="magic-link" leftSection={<IconMail size={16} />}>
                Magic Link
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="password" pt="lg">
              {error && (
                <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red" mb="md">
                  {error}
                </Alert>
              )}

              <form onSubmit={handlePasswordSubmit}>
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

                  <PasswordInput
                    label="Password"
                    placeholder="Your password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                  />

                  <Button type="submit" fullWidth loading={loading}>
                    Sign in with password
                  </Button>

                  <Text c="dimmed" size="sm" ta="center">
                    <Anchor component={Link} to="/reset-password" size="sm">
                      Forgot password?
                    </Anchor>
                  </Text>
                </Stack>
              </form>
            </Tabs.Panel>

            <Tabs.Panel value="magic-link" pt="lg">
              {magicLinkError && (
                <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red" mb="md">
                  {magicLinkError}
                </Alert>
              )}

              {magicLinkSent ? (
                <Alert icon={<IconCheck size={16} />} title="Check your email" color="green">
                  We've sent you a magic link to <strong>{magicLinkEmail}</strong>. Click the link in the email to sign in.
                </Alert>
              ) : (
                <form onSubmit={handleMagicLinkSubmit}>
                  <Stack gap="md">
                    <Text size="sm" c="dimmed">
                      Enter your email and we'll send you a magic link to sign in - no password required!
                    </Text>

                    <TextInput
                      label="Email"
                      placeholder="your@email.com"
                      type="email"
                      autoComplete="email"
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                      required
                      value={magicLinkEmail}
                      onChange={(e) => setMagicLinkEmail(e.target.value)}
                      disabled={magicLinkLoading}
                    />

                    <Button type="submit" fullWidth loading={magicLinkLoading}>
                      Send magic link
                    </Button>
                  </Stack>
                </form>
              )}
            </Tabs.Panel>
          </Tabs>

          <Divider />

          <Text c="dimmed" size="sm" ta="center">
            Don't have an account?{' '}
            <Anchor component={Link} to="/signup" size="sm">
              Sign up
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
