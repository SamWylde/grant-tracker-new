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
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicLinkError, setMagicLinkError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/discover');
    }
  }, [user, navigate]);

  // Debug: Log when magic link sent state changes
  useEffect(() => {
    console.log('magicLinkSent state changed:', magicLinkSent);
  }, [magicLinkSent]);

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
    setOtpError(null);
    setMagicLinkSent(false);

    try {
      // First check if user exists using our API endpoint
      console.log('Checking if user exists:', magicLinkEmail);
      const checkResponse = await fetch('/api/auth/check-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: magicLinkEmail }),
      });

      const checkData = await checkResponse.json();
      console.log('User check result:', checkData);

      if (!checkData.exists) {
        setMagicLinkError('No account found with this email. Please sign up first.');
        setMagicLinkLoading(false);
        return;
      }

      // User exists, proceed with sending magic link
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

      // Success - show OTP input
      console.log('Magic link sent successfully, showing OTP input');
      setMagicLinkSent(true);
      setMagicLinkLoading(false);
    } catch (err) {
      console.error('Magic link error:', err);
      setMagicLinkError('An unexpected error occurred. Please try again.');
      setMagicLinkLoading(false);
    }
  };

  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpLoading(true);
    setOtpError(null);

    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: magicLinkEmail,
        token: otpCode,
        type: 'email',
      });

      if (verifyError) {
        setOtpError(verifyError.message);
        setOtpLoading(false);
        return;
      }

      if (data.user) {
        // Redirect to discover page after successful verification
        navigate('/discover');
      }
    } catch (err) {
      setOtpError('An unexpected error occurred. Please try again.');
      setOtpLoading(false);
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
                <>
                  {console.log('Rendering OTP input section')}
                  <Stack gap="md">
                    <Alert icon={<IconCheck size={16} />} title="Check your email" color="green">
                      We've sent you a magic link to <strong>{magicLinkEmail}</strong>. Click the link in the email to sign in.
                    </Alert>

                    <Divider label="OR" labelPosition="center" />

                  <Text size="sm" c="dimmed" ta="center">
                    Enter the one-time code from your email:
                  </Text>

                  {otpError && (
                    <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
                      {otpError}
                    </Alert>
                  )}

                  <form onSubmit={handleOtpVerify}>
                    <Stack gap="md">
                      <TextInput
                        label="One-time code"
                        placeholder="12345678"
                        required
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        disabled={otpLoading}
                        size="lg"
                        styles={{
                          input: {
                            textAlign: 'center',
                            letterSpacing: '0.5em',
                            fontSize: '1.2rem',
                          },
                        }}
                      />

                      <Button type="submit" fullWidth loading={otpLoading}>
                        Verify code
                      </Button>

                      <Button
                        variant="subtle"
                        onClick={() => {
                          setMagicLinkSent(false);
                          setOtpCode('');
                          setOtpError(null);
                        }}
                        fullWidth
                      >
                        Send a new code
                      </Button>
                    </Stack>
                  </form>
                </Stack>
                </>
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
