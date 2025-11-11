import {
  Anchor,
  Badge,
  Box,
  Burger,
  Button,
  Card,
  Container,
  Divider,
  Drawer,
  Group,
  List,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  IconShieldCheck,
  IconLock,
  IconEye,
  IconServer,
  IconCertificate,
  IconUserCheck,
  IconRocket,
} from "@tabler/icons-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { AppHeader } from "../components/AppHeader";

export function SecurityPage() {
  const { user } = useAuth();
  const [mobileMenuOpened, setMobileMenuOpened] = useState(false);

  return (
    <Box bg="var(--mantine-color-gray-0)" mih="100vh">
      {user ? (
        <AppHeader subtitle="Security & Compliance" />
      ) : (
        <Box
          component="header"
          px="md"
          py="lg"
          style={{
            backdropFilter: "blur(18px)",
            position: "sticky",
            top: 0,
            zIndex: 100,
          }}
        >
          <Container size="lg">
            <Group justify="space-between">
              <Group gap={6}>
                <ThemeIcon variant="light" color="grape" size={38} radius="xl">
                  <IconRocket size={20} />
                </ThemeIcon>
                <Stack gap={0}>
                  <Text fw={700}>GrantCue</Text>
                  <Text size="xs" c="dimmed">
                    Funding visibility for every team
                  </Text>
                </Stack>
              </Group>

              <Group gap="sm" visibleFrom="sm">
                <Anchor size="sm" c="dark" component={Link} to="/discover">
                  Discover Grants
                </Anchor>
                <Anchor size="sm" c="dark" component={Link} to="/features">
                  Features
                </Anchor>
                <Anchor size="sm" c="dark" component={Link} to="/pricing">
                  Pricing
                </Anchor>
                <Button variant="light" color="grape" component={Link} to="/signin">
                  Sign in
                </Button>
                <Button color="grape" component={Link} to="/signup">
                  Get started
                </Button>
              </Group>

              <Burger
                opened={mobileMenuOpened}
                onClick={() => setMobileMenuOpened(!mobileMenuOpened)}
                hiddenFrom="sm"
                size="sm"
              />
            </Group>

            <Drawer
              opened={mobileMenuOpened}
              onClose={() => setMobileMenuOpened(false)}
              size="xs"
              padding="md"
              title="Menu"
              hiddenFrom="sm"
              position="right"
            >
              <Stack gap="lg">
                <Anchor
                  component={Link}
                  to="/discover"
                  c="dark"
                  onClick={() => setMobileMenuOpened(false)}
                >
                  Discover Grants
                </Anchor>
                <Anchor
                  component={Link}
                  to="/features"
                  c="dark"
                  onClick={() => setMobileMenuOpened(false)}
                >
                  Features
                </Anchor>
                <Anchor
                  component={Link}
                  to="/pricing"
                  c="dark"
                  onClick={() => setMobileMenuOpened(false)}
                >
                  Pricing
                </Anchor>
                <Divider />
                <Button
                  variant="light"
                  color="grape"
                  component={Link}
                  to="/signin"
                  fullWidth
                  onClick={() => setMobileMenuOpened(false)}
                >
                  Sign in
                </Button>
                <Button
                  color="grape"
                  component={Link}
                  to="/signup"
                  fullWidth
                  onClick={() => setMobileMenuOpened(false)}
                >
                  Get started
                </Button>
              </Stack>
            </Drawer>
          </Container>
        </Box>
      )}

      {/* Hero Section */}
      <Box
        component="section"
        py={{ base: 60, md: 80 }}
        bg="linear-gradient(135deg, var(--mantine-color-grape-0) 0%, var(--mantine-color-indigo-0) 100%)"
      >
        <Container size="lg">
          <Stack align="center" gap="lg" ta="center">
            <Badge size="lg" variant="light" color="grape">
              Security & Compliance
            </Badge>
            <Title order={1} fz={{ base: 36, md: 48 }}>
              Enterprise-grade security for your grant data
            </Title>
            <Text size="lg" c="dimmed" maw={640}>
              We take security seriously. GrantCue is built with industry-leading security practices to
              protect your organization's sensitive information.
            </Text>
          </Stack>
        </Container>
      </Box>

      {/* Security Features */}
      <Container size="lg" py={{ base: 60, md: 80 }}>
        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
          <Card padding="xl" radius="lg" withBorder>
            <ThemeIcon color="grape" variant="light" size={48} radius="md" mb="md">
              <IconLock size={26} />
            </ThemeIcon>
            <Title order={4} mb="sm">
              Data Encryption
            </Title>
            <Text c="dimmed">
              All data is encrypted at rest using AES-256 encryption and in transit using TLS 1.3. Your
              sensitive grant information is always protected.
            </Text>
          </Card>

          <Card padding="xl" radius="lg" withBorder>
            <ThemeIcon color="blue" variant="light" size={48} radius="md" mb="md">
              <IconUserCheck size={26} />
            </ThemeIcon>
            <Title order={4} mb="sm">
              Row-Level Security
            </Title>
            <Text c="dimmed">
              Advanced database security ensures users only see data they're authorized to access. Organization
              and user-level isolation is enforced at the database level.
            </Text>
          </Card>

          <Card padding="xl" radius="lg" withBorder>
            <ThemeIcon color="green" variant="light" size={48} radius="md" mb="md">
              <IconShieldCheck size={26} />
            </ThemeIcon>
            <Title order={4} mb="sm">
              Authentication & Authorization
            </Title>
            <Text c="dimmed">
              Multi-factor authentication, role-based access control, and JWT-based session management protect
              user accounts and organizational data.
            </Text>
          </Card>

          <Card padding="xl" radius="lg" withBorder>
            <ThemeIcon color="orange" variant="light" size={48} radius="md" mb="md">
              <IconEye size={26} />
            </ThemeIcon>
            <Title order={4} mb="sm">
              Audit Logging
            </Title>
            <Text c="dimmed">
              Comprehensive audit trails track all access and modifications to grant data, providing full
              visibility into who did what and when.
            </Text>
          </Card>

          <Card padding="xl" radius="lg" withBorder>
            <ThemeIcon color="red" variant="light" size={48} radius="md" mb="md">
              <IconServer size={26} />
            </ThemeIcon>
            <Title order={4} mb="sm">
              Infrastructure Security
            </Title>
            <Text c="dimmed">
              Hosted on secure cloud infrastructure with automatic backups, DDoS protection, and 99.9% uptime
              SLA. Regular security updates and patches.
            </Text>
          </Card>

          <Card padding="xl" radius="lg" withBorder>
            <ThemeIcon color="violet" variant="light" size={48} radius="md" mb="md">
              <IconCertificate size={26} />
            </ThemeIcon>
            <Title order={4} mb="sm">
              Compliance Ready
            </Title>
            <Text c="dimmed">
              Built to support GDPR, CCPA, and other privacy regulations. Data residency options and data
              processing agreements available for enterprise customers.
            </Text>
          </Card>
        </SimpleGrid>
      </Container>

      {/* Security Practices */}
      <Box bg="var(--mantine-color-gray-1)" py={{ base: 60, md: 80 }}>
        <Container size="lg">
          <Stack gap="xl">
            <Title order={2} ta="center">
              Our Security Commitments
            </Title>

            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
              <Card padding="lg" withBorder bg="white">
                <Stack gap="md">
                  <Title order={4}>Secure Development</Title>
                  <List spacing="xs">
                    <List.Item>Code reviews and security audits</List.Item>
                    <List.Item>Automated vulnerability scanning</List.Item>
                    <List.Item>Dependency security monitoring</List.Item>
                    <List.Item>OWASP Top 10 protection</List.Item>
                  </List>
                </Stack>
              </Card>

              <Card padding="lg" withBorder bg="white">
                <Stack gap="md">
                  <Title order={4}>Data Protection</Title>
                  <List spacing="xs">
                    <List.Item>Regular automated backups</List.Item>
                    <List.Item>Point-in-time recovery capability</List.Item>
                    <List.Item>Data retention policies</List.Item>
                    <List.Item>Secure data deletion</List.Item>
                  </List>
                </Stack>
              </Card>

              <Card padding="lg" withBorder bg="white">
                <Stack gap="md">
                  <Title order={4}>Access Control</Title>
                  <List spacing="xs">
                    <List.Item>Role-based permissions</List.Item>
                    <List.Item>Organization-level isolation</List.Item>
                    <List.Item>Session management and timeout</List.Item>
                    <List.Item>API authentication tokens</List.Item>
                  </List>
                </Stack>
              </Card>

              <Card padding="lg" withBorder bg="white">
                <Stack gap="md">
                  <Title order={4}>Monitoring & Response</Title>
                  <List spacing="xs">
                    <List.Item>24/7 system monitoring</List.Item>
                    <List.Item>Incident response procedures</List.Item>
                    <List.Item>Security event logging</List.Item>
                    <List.Item>Proactive threat detection</List.Item>
                  </List>
                </Stack>
              </Card>
            </SimpleGrid>
          </Stack>
        </Container>
      </Box>

      {/* Contact Section */}
      <Container size="lg" py={{ base: 60, md: 80 }}>
        <Card radius="lg" padding="xl" shadow="xl" withBorder>
          <Stack align="center" gap="lg">
            <Title order={2} ta="center">
              Have security questions?
            </Title>
            <Text ta="center" c="dimmed" maw={520}>
              Our security team is here to answer your questions and provide detailed information about our
              security practices.
            </Text>
            <Button
              size="lg"
              color="grape"
              component="a"
              href="mailto:security@grantcue.com"
            >
              Contact Security Team
            </Button>
          </Stack>
        </Card>
      </Container>

      {/* Footer */}
      <Box bg="var(--mantine-color-dark-8)" c="var(--mantine-color-gray-2)" py="xl">
        <Container size="lg">
          <Group justify="space-between" align="center">
            <Stack gap={0}>
              <Text fw={700} c="white">
                GrantCue
              </Text>
              <Text size="sm" c="dimmed">
                Purpose-built funding operations for ambitious teams.
              </Text>
            </Stack>
            <Group gap="xl" visibleFrom="sm">
              <Anchor size="sm" c="gray.4" component={Link} to="/terms">
                Terms
              </Anchor>
              <Anchor size="sm" c="gray.4" component={Link} to="/privacy">
                Privacy
              </Anchor>
              <Anchor size="sm" c="gray.4" component={Link} to="/security">
                Security
              </Anchor>
              <Anchor size="sm" c="gray.4" component={Link} to="/support">
                Support
              </Anchor>
            </Group>
          </Group>
        </Container>
      </Box>
    </Box>
  );
}
