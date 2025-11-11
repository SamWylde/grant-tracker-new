import { Container, Title, Text, Stack, Divider, Anchor, Box, Group, ThemeIcon } from '@mantine/core';
import { Link } from 'react-router-dom';
import { IconRocket } from '@tabler/icons-react';
import { AppHeader } from '../components/AppHeader';

export function PrivacyPage() {
  return (
    <Box bg="var(--mantine-color-gray-0)" mih="100vh">
      <AppHeader subtitle="Privacy Policy" />

      <Container size="md" py="xl">
        <Stack gap="xl">
          {/* Header */}
          <Stack gap="sm">
            <Title order={1}>Privacy Policy</Title>
            <Text c="dimmed">
              <strong>Effective date:</strong> November 9, 2025<br />
              <strong>Website:</strong> grantcue.com (the "Site")<br />
              <strong>Product:</strong> GrantCue (the "Service")<br />
              <strong>Who we are:</strong> GrantCue ("GrantCue," "we," "us," or "our").
            </Text>
            <Text>
              This Privacy Policy explains how we collect, use, disclose, and protect personal information
              when you use our Site and Service, and describes the choices and rights you may have.
            </Text>
            <Text size="sm" c="dimmed" fs="italic">
              This policy is drafted to align with common global standards (GDPR/UK GDPR transparency
              requirements and U.S. state privacy laws, including California's CPRA/CCPA) and Google
              OAuth/Calendar disclosures. It does not constitute legal advice.
            </Text>
          </Stack>

          <Divider />

          {/* Section 1: Scope */}
          <Stack gap="sm">
            <Title order={2}>1. Scope</Title>
            <Text>
              This Policy applies to: (a) visitors to our Site; (b) individuals who create a GrantCue
              account or are added by a customer organization as team members; (c) people who contact us
              (support/sales); and (d) users who connect third‑party accounts (e.g., Google) to the Service.
            </Text>
            <Text>
              For organizational customers, GrantCue generally acts as a <strong>processor/service provider</strong>
              and processes personal information on the customer's instructions. The customer is the <strong>controller</strong>
              responsible for its own privacy notices and choices. Where we collect information for our own purposes
              (e.g., account, billing, security, Site analytics, marketing), we act as a <strong>controller</strong>.
            </Text>
          </Stack>

          <Divider />

          {/* Section 2: Information We Collect */}
          <Stack gap="sm">
            <Title order={2}>2. Information We Collect</Title>

            <Title order={3} size="h4">Information you provide</Title>
            <Text component="div">
              <ul>
                <li>Account details (name, email, password), profile, organization/team affiliation.</li>
                <li>Business contact and billing information.</li>
                <li>Content you upload or create in the Service (e.g., grant records, tasks, notes, files).</li>
                <li>Messages and support communications.</li>
              </ul>
            </Text>

            <Title order={3} size="h4">Information collected automatically</Title>
            <Text component="div">
              <ul>
                <li>Usage, device, and log data (browser type, pages viewed, timestamps, IP address, identifiers).</li>
                <li>Cookies and similar technologies for essential operations, analytics, and (if enabled) marketing.</li>
                <li>Approximate location derived from IP address (for security and regional settings).</li>
              </ul>
            </Text>

            <Title order={3} size="h4">Information from third parties</Title>
            <Text component="div">
              <ul>
                <li>If you connect Google or another provider, we receive the minimum data needed to provide the requested feature (see Section 10).</li>
                <li>From service providers, partners, and your organization (e.g., your admin adding you to a workspace).</li>
              </ul>
            </Text>

            <Text>
              You may decline to provide information; however, some features may not work without it (e.g., authentication).
            </Text>
          </Stack>

          <Divider />

          {/* Section 3: How We Use Personal Information */}
          <Stack gap="sm">
            <Title order={2}>3. How We Use Personal Information</Title>
            <Text>We use information to:</Text>
            <Text component="div">
              <ul>
                <li>Provide, secure, and maintain the Service (authentication, troubleshooting, quality).</li>
                <li>Set up organizations, projects, and collaboration features; manage permissions.</li>
                <li>Fulfill integrations you choose (e.g., Google Calendar).</li>
                <li>Analyze aggregate usage to improve features and performance.</li>
                <li>Communicate service updates, security alerts, and administrative messages.</li>
                <li>Comply with law and enforce terms; prevent fraud, abuse, or security incidents.</li>
              </ul>
            </Text>
            <Text>
              <strong>Legal bases (EEA/UK):</strong> contract, legitimate interests, consent (where required),
              and legal obligations.
            </Text>
          </Stack>

          <Divider />

          {/* Section 4: Our Role */}
          <Stack gap="sm">
            <Title order={2}>4. Our Role: Controller vs. Processor</Title>
            <Text component="div">
              <ul>
                <li><strong>Processor/service provider:</strong> For content you or your organization submit to
                workspaces, we process it under your organization's instructions and our data processing terms.
                Individuals should direct requests (access, deletion, etc.) to the organization where applicable.</li>
                <li><strong>Controller:</strong> For our own operations (account, billing, support, product analytics,
                marketing), we are the controller and respond directly to requests.</li>
              </ul>
            </Text>
          </Stack>

          <Divider />

          {/* Section 5: Cookies */}
          <Stack gap="sm">
            <Title order={2}>5. Cookies & Online Signals</Title>
            <Text>We use cookies and similar technologies for:</Text>
            <Text component="div">
              <ul>
                <li><strong>Essential</strong> operations (login, security, load balancing);</li>
                <li><strong>Preferences</strong> (remembering settings);</li>
                <li><strong>Analytics</strong> (to understand feature usage);</li>
                <li><strong>Advertising/retargeting</strong> (only if we enable these features—opt‑out options provided).</li>
              </ul>
            </Text>
            <Text>
              <strong>Opt‑out preference signals (Global Privacy Control).</strong> Where applicable, we honor
              recognized browser/device‑level opt‑out preference signals (e.g., <strong>GPC</strong>) as valid
              requests to opt out of <strong>sale</strong>/<strong>sharing</strong> for cross‑context behavioral
              advertising under California law. See Section 9 for your rights.
            </Text>
            <Text>
              You can manage cookie preferences in your browser or via our in‑product controls (where available).
              Blocking certain cookies may limit functionality.
            </Text>
          </Stack>

          <Divider />

          {/* Section 6: Sharing */}
          <Stack gap="sm">
            <Title order={2}>6. How We Share Information</Title>
            <Text>We do <strong>not</strong> sell personal information. We may disclose information to:</Text>
            <Text component="div">
              <ul>
                <li><strong>Service providers/contractors</strong> (hosting, analytics, email, payments) bound by
                confidentiality and data protection terms;</li>
                <li><strong>Your organization</strong> and its admins (for workspace oversight and user management);</li>
                <li><strong>Legal/compliance</strong> recipients when required by law or to protect rights;</li>
                <li><strong>Business transfers</strong> (e.g., merger, acquisition, or asset sale).</li>
              </ul>
            </Text>
            <Text>
              We may share de‑identified or aggregated information that cannot reasonably be used to identify you.
            </Text>
          </Stack>

          <Divider />

          {/* Section 7: Retention */}
          <Stack gap="sm">
            <Title order={2}>7. Data Retention</Title>
            <Text>
              We keep personal information <strong>only as long as necessary</strong> for the purposes described
              here and as required by law. Illustrative defaults (subject to your organization's settings and our backups):
            </Text>
            <Text component="div">
              <ul>
                <li>Account data: retained while the account is active, then deleted or de‑identified within <strong>30–90 days</strong>.</li>
                <li>Workspace content (tasks/files/notes): retained until you or your organization delete it or terminate the workspace.</li>
                <li>Audit/security logs: <strong>12–24 months</strong>.</li>
                <li>Backups: rolling <strong>30–45 days</strong> (disaster recovery only).</li>
              </ul>
            </Text>
          </Stack>

          <Divider />

          {/* Section 8: International Transfers */}
          <Stack gap="sm">
            <Title order={2}>8. International Data Transfers</Title>
            <Text>
              If we transfer personal data internationally (e.g., from the EEA/UK to the U.S.), we use appropriate
              safeguards such as the <strong>EU Standard Contractual Clauses (SCCs)</strong> and, in the UK, the
              <strong>IDTA/Addendum</strong>, plus supplementary measures where appropriate.
            </Text>
          </Stack>

          <Divider />

          {/* Section 9: Your Rights */}
          <Stack gap="sm">
            <Title order={2}>9. Your Privacy Rights</Title>

            <Title order={3} size="h4">(A) California & other U.S. state rights</Title>
            <Text>
              Depending on where you live, you may have rights to <strong>access/know</strong>, <strong>correct</strong>,
              <strong>delete</strong>, <strong>port</strong>, <strong>opt out of sale/sharing</strong> and
              <strong>targeted advertising</strong>, and to <strong>non‑discrimination</strong>. We provide required
              notices at or before collection and offer opt‑out mechanisms as applicable—including honoring <strong>GPC</strong>.
            </Text>

            <Title order={3} size="h4">(B) EEA/UK rights under GDPR</Title>
            <Text>
              You may have rights to <strong>access</strong>, <strong>rectify</strong>, <strong>erase</strong>,
              <strong>restrict</strong>, <strong>object</strong>, <strong>data portability</strong>, and to
              <strong>withdraw consent</strong> at any time. If we process your information on behalf of a customer,
              we will refer your request to that customer when required.
            </Text>

            <Title order={3} size="h4">How to exercise your rights</Title>
            <Text component="div">
              <ul>
                <li>Submit a request via: <Anchor href="mailto:privacy@grantcue.com">privacy@grantcue.com</Anchor></li>
                <li>We'll verify your identity and respond within the applicable timeframe.</li>
              </ul>
            </Text>
          </Stack>

          <Divider />

          {/* Section 10: Google OAuth */}
          <Stack gap="sm">
            <Title order={2}>10. Google OAuth & Calendar Integration</Title>
            <Text>
              If you choose to connect your Google account (e.g., Calendar), we access <strong>only the data necessary</strong>
              to provide the integration you ask for. Examples include:
            </Text>
            <Text component="div">
              <ul>
                <li>Listing calendars you select, reading free/busy or event metadata you choose to sync, and creating/updating
                events that you explicitly request.</li>
                <li>Storing OAuth tokens securely to maintain the connection.</li>
                <li><strong>We do not</strong> use Google data for advertising, and we <strong>do not</strong> sell it.
                Transfers are limited to service providers needed to deliver the integration or to comply with law.</li>
              </ul>
            </Text>
            <Text>
              Our use of Google data complies with the <strong>Google API Services User Data Policy</strong>, including
              the <strong>Limited Use</strong> requirements. You can disconnect Google at any time in your account or
              through your Google account permissions page. After disconnecting, we will remove or de‑identify tokens
              and any cached Google data not needed for audit, security, or legal obligations.
            </Text>
            <Text>
              <strong>Requested scopes (illustrative; shown on Google's consent screen):</strong>
            </Text>
            <Text component="div">
              <ul>
                <li><code>openid</code>, <code>email</code>, <code>profile</code> (auth)</li>
                <li><code>https://www.googleapis.com/auth/calendar.events</code> (create/edit events you choose)</li>
                <li><code>https://www.googleapis.com/auth/calendar.readonly</code> (read only, if you enable sync)</li>
              </ul>
            </Text>
            <Text>
              We request the <strong>minimum scopes</strong> necessary and only when you enable the related feature.
              If we add new Google features or scopes, we will update this Policy.
            </Text>
          </Stack>

          <Divider />

          {/* Section 11: Security */}
          <Stack gap="sm">
            <Title order={2}>11. Security</Title>
            <Text>
              We implement administrative, technical, and physical safeguards designed to protect personal information
              (including encryption in transit, role‑based access, logging, and routine backups). No method of transmission
              or storage is 100% secure. You are responsible for maintaining the confidentiality of your password and for
              any activity in your account.
            </Text>
          </Stack>

          <Divider />

          {/* Section 12: Children */}
          <Stack gap="sm">
            <Title order={2}>12. Children's Privacy</Title>
            <Text>
              The Service is not directed to children under <strong>13</strong>. We do not knowingly collect personal
              information from children under 13. If we learn that a child under 13 has provided personal information,
              we will take steps to delete it. Parents who believe their child has provided personal information may
              contact us at <Anchor href="mailto:privacy@grantcue.com">privacy@grantcue.com</Anchor>.
            </Text>
          </Stack>

          <Divider />

          {/* Section 13: Contact */}
          <Stack gap="sm">
            <Title order={2}>13. How to Contact Us</Title>
            <Text component="div">
              <ul>
                <li><strong>Email:</strong> <Anchor href="mailto:privacy@grantcue.com">privacy@grantcue.com</Anchor></li>
                <li><strong>Postal:</strong> GrantCue (address to be provided)</li>
                <li>You also have the right to lodge a complaint with your local supervisory authority (EEA/UK).</li>
              </ul>
            </Text>
          </Stack>

          <Divider />

          {/* Section 14: Changes */}
          <Stack gap="sm">
            <Title order={2}>14. Changes to This Policy</Title>
            <Text>
              We may update this Policy to reflect changes to our practices, technologies, or legal requirements.
              We will post the updated Policy with a new "Effective date" and, where required, provide additional notice.
            </Text>
          </Stack>

          <Divider />

          {/* Section 15: State-Specific */}
          <Stack gap="sm">
            <Title order={2}>15. State‑Specific Disclosures</Title>
            <Text>
              Residents of California (CPRA), Colorado, Connecticut, Utah, Virginia, and other states with comprehensive
              privacy laws may have state‑specific rights and definitions (e.g., "sale," "sharing," "targeted advertising").
              We provide required notices at or before collection and honor recognized <strong>opt‑out preference signals</strong>
              (e.g., GPC) where applicable.
            </Text>
          </Stack>

          <Divider />

          {/* Quick Summaries */}
          <Stack gap="md">
            <Title order={2}>Quick Reference</Title>

            <Stack gap="sm" p="md" style={{ background: 'var(--mantine-color-blue-0)', borderRadius: '8px' }}>
              <Title order={3} size="h4">At‑Collection Notice</Title>
              <Text size="sm">
                <strong>Privacy at a glance:</strong> We process your name and email to create your account and provide
                the Service. We use essential cookies for authentication and analytics to improve the Service. If you
                connect Google, we access only the data needed for the selected feature and never use it for ads. See
                our Privacy Policy for details and your rights. To make requests, email{' '}
                <Anchor href="mailto:privacy@grantcue.com">privacy@grantcue.com</Anchor>.
              </Text>
            </Stack>

            <Stack gap="sm" p="md" style={{ background: 'var(--mantine-color-grape-0)', borderRadius: '8px' }}>
              <Title order={3} size="h4">OAuth Consent Screen Summary</Title>
              <Text size="sm">
                GrantCue will use your Google information to authenticate your account and (if enabled) read or create
                calendar events you select. Data is used only to provide these user‑facing features and isn't sold or
                used for advertising. You can disconnect anytime in your GrantCue account or your Google permissions page.
              </Text>
            </Stack>
          </Stack>

          <Divider />

          {/* Appendix */}
          <Stack gap="sm">
            <Title order={2}>Appendix A: Data Sub‑processors</Title>
            <Text component="div">
              <ul>
                <li><strong>Hosting/Infrastructure:</strong> Vercel, Supabase</li>
                <li><strong>Email/Support:</strong> (to be configured)</li>
                <li><strong>Analytics:</strong> (to be configured)</li>
                <li><strong>Payments:</strong> Stripe (when billing is enabled)</li>
              </ul>
            </Text>
            <Text size="sm" c="dimmed">
              This list is maintained and updated regularly to reflect our current service providers.
            </Text>
          </Stack>
        </Stack>
      </Container>

      {/* Footer */}
      <Box bg="var(--mantine-color-dark-8)" py="xl" mt="xl">
        <Container size="lg">
          <Group justify="space-between" align="center">
            <Stack gap={6}>
              <Group gap={6}>
                <ThemeIcon variant="light" color="grape" size={32} radius="xl">
                  <IconRocket size={16} />
                </ThemeIcon>
                <Text fw={700} c="white">
                  GrantCue
                </Text>
              </Group>
              <Text size="sm" c="gray.4">
                Purpose-built funding operations for ambitious teams.
              </Text>
            </Stack>
            <Group gap="xl" visibleFrom="sm">
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
