import { Container, Title, Text, Stack, Divider, Anchor, Box, Group, ThemeIcon, Burger, Drawer, Button } from '@mantine/core';
import { Link } from 'react-router-dom';
import { IconRocket } from '@tabler/icons-react';
import { AppHeader } from '../components/AppHeader';
import { useAuth } from '../contexts/AuthContext';
import { useState } from 'react';

export function TermsPage() {
  const { user } = useAuth();
  const [mobileMenuOpened, setMobileMenuOpened] = useState(false);

  return (
    <Box bg="var(--mantine-color-gray-0)" mih="100vh">
      {user ? (
        <AppHeader subtitle="Terms of Service" />
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

      <Container size="md" py="xl">
        <Stack gap="xl">
          {/* Header */}
          <Stack gap="sm">
            <Title order={1}>Terms of Service</Title>
            <Text c="dimmed">
              <strong>Effective date:</strong> January 11, 2025<br />
              <strong>Website:</strong> grantcue.com (the "Site")<br />
              <strong>Product:</strong> GrantCue (the "Service")<br />
              <strong>Who we are:</strong> GrantCue ("GrantCue," "we," "us," or "our").
            </Text>
            <Text>
              These Terms of Service ("Terms") govern your access to and use of our Site and Service.
              By accessing or using GrantCue, you agree to be bound by these Terms.
            </Text>
            <Text size="sm" c="dimmed" fs="italic">
              Please read these Terms carefully. If you do not agree to these Terms, do not use our Service.
            </Text>
          </Stack>

          <Divider />

          {/* Section 1: Acceptance */}
          <Stack gap="sm">
            <Title order={2}>1. Acceptance of Terms</Title>
            <Text>
              By creating an account, accessing, or using GrantCue in any way, you agree to comply with
              and be legally bound by these Terms, our <Anchor component={Link} to="/privacy">Privacy Policy</Anchor>,
              and all applicable laws and regulations.
            </Text>
            <Text>
              If you are using GrantCue on behalf of an organization, you represent and warrant that you
              have the authority to bind that organization to these Terms, and "you" refers to both you
              individually and the organization.
            </Text>
          </Stack>

          <Divider />

          {/* Section 2: Description of Service */}
          <Stack gap="sm">
            <Title order={2}>2. Description of Service</Title>
            <Text>
              GrantCue is a grant management and collaboration platform designed to help nonprofits and
              organizations discover, track, and manage grant opportunities. The Service includes:
            </Text>
            <Text component="div">
              <ul>
                <li>Access to federal grant databases and search functionality</li>
                <li>Grant tracking, pipeline management, and collaboration tools</li>
                <li>AI-powered features including success scoring, recommendations, and summaries</li>
                <li>Calendar integrations and deadline tracking</li>
                <li>Team collaboration features including comments, tasks, and mentions</li>
                <li>Organization and workspace management</li>
              </ul>
            </Text>
            <Text>
              We reserve the right to modify, suspend, or discontinue any part of the Service at any
              time with or without notice.
            </Text>
          </Stack>

          <Divider />

          {/* Section 3: Account Registration */}
          <Stack gap="sm">
            <Title order={2}>3. Account Registration and Security</Title>
            <Text>
              To use certain features of GrantCue, you must register for an account. You agree to:
            </Text>
            <Text component="div">
              <ul>
                <li>Provide accurate, current, and complete information during registration</li>
                <li>Maintain and promptly update your account information</li>
                <li>Maintain the security and confidentiality of your password</li>
                <li>Accept all responsibility for activity that occurs under your account</li>
                <li>Notify us immediately of any unauthorized use of your account</li>
              </ul>
            </Text>
            <Text>
              You must be at least 13 years old to use GrantCue. If you are under 18, you represent
              that you have your parent or guardian's permission to use the Service.
            </Text>
          </Stack>

          <Divider />

          {/* Section 4: Acceptable Use */}
          <Stack gap="sm">
            <Title order={2}>4. Acceptable Use Policy</Title>
            <Text>You agree not to:</Text>
            <Text component="div">
              <ul>
                <li>Violate any applicable laws, regulations, or third-party rights</li>
                <li>Use the Service for any illegal, harmful, or fraudulent purpose</li>
                <li>Interfere with or disrupt the Service or servers/networks connected to the Service</li>
                <li>Attempt to gain unauthorized access to any portion of the Service</li>
                <li>Use automated means (bots, scrapers, etc.) to access the Service without permission</li>
                <li>Transmit viruses, malware, or any malicious code</li>
                <li>Impersonate any person or entity or misrepresent your affiliation</li>
                <li>Collect or harvest information about other users without consent</li>
                <li>Use the Service to send spam, unsolicited communications, or harassment</li>
                <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
              </ul>
            </Text>
            <Text>
              We reserve the right to suspend or terminate accounts that violate this policy.
            </Text>
          </Stack>

          <Divider />

          {/* Section 5: User Content */}
          <Stack gap="sm">
            <Title order={2}>5. User Content and Ownership</Title>
            <Text>
              You retain ownership of any content you submit, upload, or create in the Service
              ("User Content"), including grant records, tasks, notes, comments, and files.
            </Text>
            <Text>
              By submitting User Content, you grant GrantCue a worldwide, non-exclusive, royalty-free
              license to use, copy, store, transmit, and display your User Content solely to provide
              and improve the Service.
            </Text>
            <Text>
              You represent and warrant that:
            </Text>
            <Text component="div">
              <ul>
                <li>You own or have the necessary rights to all User Content you submit</li>
                <li>Your User Content does not violate any third-party rights or applicable laws</li>
                <li>Your User Content does not contain malicious code or inappropriate material</li>
              </ul>
            </Text>
            <Text>
              We reserve the right (but have no obligation) to remove or disable access to any User
              Content that violates these Terms or is otherwise objectionable.
            </Text>
          </Stack>

          <Divider />

          {/* Section 6: Intellectual Property */}
          <Stack gap="sm">
            <Title order={2}>6. Intellectual Property Rights</Title>
            <Text>
              The Service, including its design, features, software, text, graphics, logos, and other
              content (excluding User Content) is owned by GrantCue and protected by copyright,
              trademark, and other intellectual property laws.
            </Text>
            <Text>
              We grant you a limited, non-exclusive, non-transferable, revocable license to access and
              use the Service for its intended purpose, subject to these Terms.
            </Text>
            <Text>
              "GrantCue" and related marks, logos, and designs are trademarks of GrantCue. You may not
              use our trademarks without prior written permission.
            </Text>
          </Stack>

          <Divider />

          {/* Section 7: Third-Party Services */}
          <Stack gap="sm">
            <Title order={2}>7. Third-Party Services and Integrations</Title>
            <Text>
              The Service may integrate with or provide links to third-party services (e.g., Google Calendar,
              Grants.gov). We are not responsible for:
            </Text>
            <Text component="div">
              <ul>
                <li>The availability, accuracy, or content of third-party services</li>
                <li>Third-party terms, policies, or practices</li>
                <li>Any loss or damage caused by your use of third-party services</li>
              </ul>
            </Text>
            <Text>
              Your use of third-party services is subject to their own terms and policies. We encourage
              you to review them.
            </Text>
          </Stack>

          <Divider />

          {/* Section 8: Fees and Payment */}
          <Stack gap="sm">
            <Title order={2}>8. Fees and Payment</Title>
            <Text>
              Certain features of GrantCue may require payment. If you subscribe to a paid plan:
            </Text>
            <Text component="div">
              <ul>
                <li>You agree to pay all fees according to the pricing and payment terms presented</li>
                <li>Fees are non-refundable except as required by law or expressly stated</li>
                <li>We may change pricing with advance notice for future billing periods</li>
                <li>You authorize us to charge your payment method automatically for recurring fees</li>
                <li>Failure to pay may result in suspension or termination of your account</li>
              </ul>
            </Text>
            <Text>
              All payments are processed securely through our payment provider (Stripe). We do not store
              full credit card information.
            </Text>
          </Stack>

          <Divider />

          {/* Section 9: Termination */}
          <Stack gap="sm">
            <Title order={2}>9. Termination</Title>
            <Text>
              You may terminate your account at any time through your account settings or by contacting us.
            </Text>
            <Text>
              We may suspend or terminate your account at any time for any reason, including:
            </Text>
            <Text component="div">
              <ul>
                <li>Violation of these Terms or our policies</li>
                <li>Suspected fraudulent, abusive, or illegal activity</li>
                <li>Extended period of inactivity</li>
                <li>At your request</li>
              </ul>
            </Text>
            <Text>
              Upon termination:
            </Text>
            <Text component="div">
              <ul>
                <li>Your right to access and use the Service ends immediately</li>
                <li>We may delete your account and User Content after 30-90 days</li>
                <li>Provisions that should survive termination will remain in effect</li>
              </ul>
            </Text>
          </Stack>

          <Divider />

          {/* Section 10: Disclaimers */}
          <Stack gap="sm">
            <Title order={2}>10. Disclaimers and Limitations</Title>
            <Text>
              <strong>THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND,
              EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO:</strong>
            </Text>
            <Text component="div">
              <ul>
                <li>Accuracy, completeness, or reliability of grant data</li>
                <li>Uninterrupted or error-free operation</li>
                <li>AI features producing accurate or useful results</li>
                <li>Security of data transmission or storage</li>
                <li>Fitness for a particular purpose or merchantability</li>
              </ul>
            </Text>
            <Text>
              GrantCue aggregates data from public sources (e.g., Grants.gov) but does not guarantee the
              accuracy, timeliness, or completeness of such data. You are responsible for verifying all
              grant information before submitting applications.
            </Text>
            <Text>
              AI-powered features (success scores, recommendations, summaries) are provided for informational
              purposes only and should not be relied upon as professional advice.
            </Text>
          </Stack>

          <Divider />

          {/* Section 11: Limitation of Liability */}
          <Stack gap="sm">
            <Title order={2}>11. Limitation of Liability</Title>
            <Text>
              <strong>TO THE MAXIMUM EXTENT PERMITTED BY LAW, GRANTCUE AND ITS AFFILIATES, DIRECTORS,
              EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR:</strong>
            </Text>
            <Text component="div">
              <ul>
                <li>Indirect, incidental, special, consequential, or punitive damages</li>
                <li>Loss of profits, revenue, data, or business opportunities</li>
                <li>Missed grant deadlines or unsuccessful applications</li>
                <li>Costs of procurement of substitute services</li>
                <li>Unauthorized access to or alteration of your data</li>
              </ul>
            </Text>
            <Text>
              <strong>OUR TOTAL LIABILITY TO YOU FOR ALL CLAIMS SHALL NOT EXCEED THE AMOUNT YOU PAID TO
              US IN THE 12 MONTHS PRECEDING THE CLAIM, OR $100, WHICHEVER IS GREATER.</strong>
            </Text>
            <Text>
              Some jurisdictions do not allow limitations on implied warranties or liability for incidental
              or consequential damages, so the above limitations may not apply to you.
            </Text>
          </Stack>

          <Divider />

          {/* Section 12: Indemnification */}
          <Stack gap="sm">
            <Title order={2}>12. Indemnification</Title>
            <Text>
              You agree to indemnify, defend, and hold harmless GrantCue and its affiliates, directors,
              employees, and agents from any claims, losses, damages, liabilities, and expenses (including
              reasonable attorneys' fees) arising from:
            </Text>
            <Text component="div">
              <ul>
                <li>Your use of the Service</li>
                <li>Your User Content</li>
                <li>Your violation of these Terms</li>
                <li>Your violation of any third-party rights</li>
              </ul>
            </Text>
          </Stack>

          <Divider />

          {/* Section 13: Dispute Resolution */}
          <Stack gap="sm">
            <Title order={2}>13. Dispute Resolution and Governing Law</Title>
            <Text>
              These Terms are governed by the laws of [State/Country] without regard to conflict of law
              principles.
            </Text>
            <Text>
              Any disputes arising from these Terms or the Service shall be resolved through binding
              arbitration in accordance with [Arbitration Rules], except that either party may seek
              injunctive relief in court for intellectual property infringement.
            </Text>
            <Text>
              You and GrantCue agree to waive the right to a jury trial and to participate in class
              actions or class arbitrations.
            </Text>
          </Stack>

          <Divider />

          {/* Section 14: Changes to Terms */}
          <Stack gap="sm">
            <Title order={2}>14. Changes to These Terms</Title>
            <Text>
              We may update these Terms from time to time. If we make material changes, we will notify you:
            </Text>
            <Text component="div">
              <ul>
                <li>By posting the updated Terms with a new "Effective date"</li>
                <li>By email or in-product notification (for significant changes)</li>
              </ul>
            </Text>
            <Text>
              Your continued use of the Service after changes take effect constitutes acceptance of the
              updated Terms. If you do not agree to the changes, you must stop using the Service and may
              terminate your account.
            </Text>
          </Stack>

          <Divider />

          {/* Section 15: General */}
          <Stack gap="sm">
            <Title order={2}>15. General Provisions</Title>
            <Text component="div">
              <ul>
                <li><strong>Entire Agreement:</strong> These Terms, together with our Privacy Policy,
                constitute the entire agreement between you and GrantCue.</li>
                <li><strong>Severability:</strong> If any provision is found unenforceable, the remaining
                provisions will remain in effect.</li>
                <li><strong>Waiver:</strong> Our failure to enforce any right or provision does not constitute
                a waiver of such right or provision.</li>
                <li><strong>Assignment:</strong> You may not assign or transfer these Terms without our
                consent. We may assign these Terms without restriction.</li>
                <li><strong>Force Majeure:</strong> We are not liable for delays or failures due to causes
                beyond our reasonable control.</li>
                <li><strong>No Agency:</strong> Nothing in these Terms creates a partnership, joint venture,
                or agency relationship.</li>
              </ul>
            </Text>
          </Stack>

          <Divider />

          {/* Section 16: Contact */}
          <Stack gap="sm">
            <Title order={2}>16. Contact Us</Title>
            <Text>
              If you have questions about these Terms, please contact us:
            </Text>
            <Text component="div">
              <ul>
                <li><strong>Email:</strong> <Anchor href="mailto:support@grantcue.com">support@grantcue.com</Anchor></li>
                <li><strong>Legal inquiries:</strong> <Anchor href="mailto:legal@grantcue.com">legal@grantcue.com</Anchor></li>
                <li><strong>Website:</strong> <Anchor href="https://www.grantcue.com">www.grantcue.com</Anchor></li>
              </ul>
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
