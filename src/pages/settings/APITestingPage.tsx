import { useState } from 'react';
import {
  Stack,
  Title,
  Text,
  Divider,
  Paper,
  Button,
  Group,
  Select,
  TextInput,
  Code,
  Badge,
  Tabs,
  JsonInput,
  Alert,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconApi,
  IconCheck,
  IconX,
  IconAlertCircle,
  IconRefresh,
} from '@tabler/icons-react';
import { SettingsLayout } from '../../components/SettingsLayout';
import { AccessDenied } from '../../components/ProtectedRoute';
import { usePermission } from '../../hooks/usePermission';
import { supabase } from '../../lib/supabase';

interface TestResult {
  success: boolean;
  status?: number;
  data?: any;
  error?: string;
  duration?: number;
}

// Internal Backend API Tests
const INTERNAL_API_TESTS = [
  {
    id: 'saved-grants',
    name: 'Saved Grants - List',
    endpoint: '/api/saved',
    method: 'GET',
    requiresAuth: true,
  },
  {
    id: 'ai-success-score',
    name: 'AI Success Score - Generate',
    endpoint: '/api/grants/success-score',
    method: 'POST',
    requiresAuth: true,
    defaultBody: JSON.stringify({
      grant_id: 'test-grant-id',
      grant_title: 'Test Grant for Education',
      grant_description: 'This is a test grant for educational purposes in the field of STEM education.',
    }, null, 2),
    description: 'Generate AI success score (stored in database)',
  },
  {
    id: 'ai-nofo-summary',
    name: 'AI NOFO Summary - Retrieve',
    endpoint: '/api/grants/nofo-summary',
    method: 'GET',
    requiresAuth: true,
    requiresParams: true,
    paramLabel: 'saved_grant_id or grant_id',
    paramPlaceholder: 'saved_grant_id=xxx or grant_id=xxx',
    description: 'Retrieve AI-generated NOFO summary (from database)',
  },
  {
    id: 'webhooks',
    name: 'Webhooks - List',
    endpoint: '/api/webhooks',
    method: 'GET',
    requiresAuth: true,
  },
  {
    id: 'integrations',
    name: 'Integrations - List',
    endpoint: '/api/integrations',
    method: 'GET',
    requiresAuth: true,
  },
  {
    id: 'grant-comments',
    name: 'Comments - Grant Comments',
    endpoint: '/api/comments/grant-comments',
    method: 'GET',
    requiresAuth: true,
    requiresParams: true,
    paramLabel: 'grant_id',
    paramPlaceholder: 'grant_id=xxx',
  },
  {
    id: 'activity',
    name: 'Activity - Recent Activity',
    endpoint: '/api/activity',
    method: 'GET',
    requiresAuth: true,
  },
];

// Third-party API Tests (via our internal proxies)
const THIRD_PARTY_API_TESTS = [
  {
    id: 'grants-search',
    name: 'Grants.gov - Search Grants',
    endpoint: '/api/grants/search',
    fullUrl: 'https://api.grants.gov/v1/api/search',
    method: 'POST',
    requiresAuth: true,
    defaultBody: JSON.stringify({
      keyword: 'education',
      limit: 5,
    }, null, 2),
    description: 'Search grants (proxied through our backend to avoid CORS)',
  },
  {
    id: 'grants-details',
    name: 'Grants.gov - Grant Details',
    endpoint: '/api/grants/details',
    fullUrl: 'https://api.grants.gov/v1/api/fetchOpportunity',
    method: 'GET',
    requiresAuth: true,
    requiresParams: true,
    paramLabel: 'opportunityId',
    paramPlaceholder: 'opportunityId=352598',
    description: 'Fetch grant details (proxied through our backend)',
  },
];

// Direct OpenAI API Tests
const OPENAI_API_TESTS = [
  {
    id: 'openai-chat',
    name: 'OpenAI - Chat Completion',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    method: 'POST',
    requiresApiKey: true,
    defaultBody: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say hello!' }
      ],
      max_tokens: 100,
    }, null, 2),
    description: 'Direct OpenAI API call - requires API key',
  },
  {
    id: 'openai-embeddings',
    name: 'OpenAI - Create Embeddings',
    endpoint: 'https://api.openai.com/v1/embeddings',
    method: 'POST',
    requiresApiKey: true,
    defaultBody: JSON.stringify({
      model: 'text-embedding-3-small',
      input: 'This is a test grant description for embedding.',
    }, null, 2),
    description: 'Generate embeddings - requires API key',
  },
];

export function APITestingPage() {
  const { isAdmin } = usePermission();

  const [activeTab, setActiveTab] = useState<string>('internal');
  const [selectedTest, setSelectedTest] = useState<string>('');
  const [customEndpoint, setCustomEndpoint] = useState('');
  const [customMethod, setCustomMethod] = useState<string>('GET');
  const [customBody, setCustomBody] = useState('');
  const [queryParams, setQueryParams] = useState('');
  const [testParams, setTestParams] = useState<Record<string, string>>({});
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Permission check
  if (!isAdmin) {
    return <AccessDenied />;
  }

  const handleTest = async (test: any) => {
    setLoading(true);
    setTestResult(null);
    const startTime = Date.now();

    try {
      // Build URL with test-specific parameters or global query params
      const params = testParams[test.id] || queryParams;
      const url = test.endpoint + (params ? `?${params}` : '');

      const options: RequestInit = {
        method: test.method || customMethod,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      // Add auth token for internal APIs
      if (test.requiresAuth) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          options.headers = {
            ...options.headers,
            'Authorization': `Bearer ${session.access_token}`,
          };
        }
      }

      // Add OpenAI API key for direct OpenAI calls
      if (test.requiresApiKey && openaiApiKey) {
        options.headers = {
          ...options.headers,
          'Authorization': `Bearer ${openaiApiKey}`,
        };
      }

      // Add body for POST/PATCH requests
      if ((test.method === 'POST' || test.method === 'PATCH') && customBody) {
        options.body = customBody;
      }

      const response = await fetch(url, options);
      const duration = Date.now() - startTime;

      let data;
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      setTestResult({
        success: response.ok,
        status: response.status,
        data,
        duration,
      });

      if (response.ok) {
        notifications.show({
          title: 'Success',
          message: `API test completed in ${duration}ms`,
          color: 'green',
          icon: <IconCheck size={16} />,
        });
      } else {
        notifications.show({
          title: 'API Error',
          message: `Status ${response.status}: ${response.statusText}`,
          color: 'red',
          icon: <IconX size={16} />,
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      notifications.show({
        title: 'Test Failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleQuickTest = (testConfig: any) => {
    setSelectedTest(testConfig.id);
    setCustomEndpoint(testConfig.endpoint);
    setCustomMethod(testConfig.method);
    setCustomBody(testConfig.defaultBody || '');
    setQueryParams('');
    handleTest(testConfig);
  };

  const handleCustomTest = () => {
    if (!customEndpoint) {
      notifications.show({
        title: 'Error',
        message: 'Please enter an endpoint URL',
        color: 'red',
      });
      return;
    }

    handleTest({
      endpoint: customEndpoint,
      method: customMethod,
      requiresAuth: customEndpoint.startsWith('/api/'),
    });
  };

  return (
    <SettingsLayout>
      <Stack gap="lg">
        <div>
          <Title order={2}>API Testing</Title>
          <Text size="sm" c="dimmed" mt="xs">
            Test internal backend APIs and third-party integrations (Grants.gov, OpenAI)
          </Text>
        </div>

        <Divider />

        <Tabs value={activeTab} onChange={(value) => setActiveTab(value || 'internal')}>
          <Tabs.List>
            <Tabs.Tab value="internal">Backend APIs</Tabs.Tab>
            <Tabs.Tab value="third-party">Grants.gov (Proxied)</Tabs.Tab>
            <Tabs.Tab value="openai">OpenAI Direct</Tabs.Tab>
            <Tabs.Tab value="custom">Custom Request</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="internal" pt="lg">
            <Stack gap="md">
              <Text size="sm" c="dimmed">
                Test your internal backend API endpoints (stored in database)
              </Text>

              <Paper p="md" withBorder>
                <Stack gap="md">
                  {INTERNAL_API_TESTS.map((test) => (
                    <Paper key={test.id} p="md" withBorder>
                      <Stack gap="sm">
                        <Group justify="space-between">
                          <div>
                            <Text fw={600} size="sm">{test.name}</Text>
                            <Code>{test.method} {window.location.origin}{test.endpoint}</Code>
                            {(test as any).description && (
                              <Text size="xs" c="dimmed" mt={4}>
                                {(test as any).description}
                              </Text>
                            )}
                          </div>
                          <Button
                            size="xs"
                            onClick={() => handleQuickTest(test)}
                            loading={loading && selectedTest === test.id}
                          >
                            Test
                          </Button>
                        </Group>

                        {(test as any).requiresParams && (
                          <TextInput
                            size="xs"
                            label={(test as any).paramLabel}
                            placeholder={(test as any).paramPlaceholder}
                            value={testParams[test.id] || ''}
                            onChange={(e) => setTestParams({ ...testParams, [test.id]: e.target.value })}
                          />
                        )}

                        {(test as any).defaultBody && (
                          <div>
                            <Text size="xs" fw={500} mb={4}>Request Body:</Text>
                            <Code block style={{ fontSize: 11, maxHeight: 100, overflow: 'auto' }}>
                              {(test as any).defaultBody}
                            </Code>
                          </div>
                        )}
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              </Paper>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="third-party" pt="lg">
            <Stack gap="md">
              <Text size="sm" c="dimmed">
                Test Grants.gov API via our internal proxy (avoids CORS issues)
              </Text>

              <Paper p="md" withBorder>
                <Stack gap="md">
                  {THIRD_PARTY_API_TESTS.map((test) => (
                    <Paper key={test.id} p="md" withBorder>
                      <Stack gap="sm">
                        <Group justify="space-between">
                          <div>
                            <Text fw={600} size="sm">{test.name}</Text>
                            <Code>{test.method} {window.location.origin}{test.endpoint}</Code>
                            {(test as any).fullUrl && (
                              <Text size="xs" c="blue" mt={2}>
                                → Proxies to: {(test as any).fullUrl}
                              </Text>
                            )}
                            {(test as any).description && (
                              <Text size="xs" c="dimmed" mt={2}>
                                {(test as any).description}
                              </Text>
                            )}
                          </div>
                          <Button
                            size="xs"
                            onClick={() => handleQuickTest(test)}
                            loading={loading && selectedTest === test.id}
                          >
                            Test
                          </Button>
                        </Group>

                        {(test as any).requiresParams && (
                          <TextInput
                            size="xs"
                            label={(test as any).paramLabel}
                            placeholder={(test as any).paramPlaceholder}
                            value={testParams[test.id] || ''}
                            onChange={(e) => setTestParams({ ...testParams, [test.id]: e.target.value })}
                          />
                        )}

                        {(test as any).defaultBody && (
                          <div>
                            <Text size="xs" fw={500} mb={4}>Request Body:</Text>
                            <Code block style={{ fontSize: 11, maxHeight: 100, overflow: 'auto' }}>
                              {(test as any).defaultBody}
                            </Code>
                          </div>
                        )}
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              </Paper>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="openai" pt="lg">
            <Stack gap="md">
              <Alert color="orange" icon={<IconAlertCircle size={16} />}>
                <Text size="sm" fw={500}>Direct OpenAI API calls - requires your API key</Text>
                <Text size="xs" mt={4}>
                  These tests call OpenAI directly and will use your credits. Get your API key from{' '}
                  <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">
                    platform.openai.com
                  </a>
                </Text>
              </Alert>

              <TextInput
                label="OpenAI API Key"
                placeholder="sk-..."
                type="password"
                value={openaiApiKey}
                onChange={(e) => setOpenaiApiKey(e.target.value)}
              />

              <Paper p="md" withBorder>
                <Stack gap="md">
                  {OPENAI_API_TESTS.map((test) => (
                    <Paper key={test.id} p="md" withBorder>
                      <Stack gap="sm">
                        <Group justify="space-between">
                          <div>
                            <Text fw={600} size="sm">{test.name}</Text>
                            <Code>{test.method} {test.endpoint}</Code>
                            {(test as any).description && (
                              <Text size="xs" c="dimmed" mt={2}>
                                {(test as any).description}
                              </Text>
                            )}
                          </div>
                          <Button
                            size="xs"
                            onClick={() => handleQuickTest(test)}
                            loading={loading && selectedTest === test.id}
                            disabled={!openaiApiKey}
                          >
                            Test
                          </Button>
                        </Group>

                        {(test as any).defaultBody && (
                          <div>
                            <Text size="xs" fw={500} mb={4}>Request Body:</Text>
                            <Code block style={{ fontSize: 11, maxHeight: 100, overflow: 'auto' }}>
                              {(test as any).defaultBody}
                            </Code>
                          </div>
                        )}
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              </Paper>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="custom" pt="lg">
            <Stack gap="md">
              <Text size="sm" c="dimmed">
                Create a custom API request
              </Text>

              <Paper p="md" withBorder>
                <Stack gap="md">
                  <Select
                    label="HTTP Method"
                    value={customMethod}
                    onChange={(value) => setCustomMethod(value || 'GET')}
                    data={['GET', 'POST', 'PATCH', 'PUT', 'DELETE']}
                  />

                  <TextInput
                    label="Endpoint URL"
                    placeholder="https://api.example.com/endpoint or /api/saved"
                    value={customEndpoint}
                    onChange={(e) => setCustomEndpoint(e.target.value)}
                  />

                  <TextInput
                    label="Query Parameters (optional)"
                    placeholder="key1=value1&key2=value2"
                    value={queryParams}
                    onChange={(e) => setQueryParams(e.target.value)}
                  />

                  {(customMethod === 'POST' || customMethod === 'PATCH' || customMethod === 'PUT') && (
                    <JsonInput
                      label="Request Body (JSON)"
                      placeholder='{"key": "value"}'
                      value={customBody}
                      onChange={setCustomBody}
                      minRows={6}
                      formatOnBlur
                      autosize
                    />
                  )}

                  <Group>
                    <Button
                      onClick={handleCustomTest}
                      loading={loading}
                      leftSection={<IconApi size={16} />}
                    >
                      Send Request
                    </Button>
                    <Button
                      variant="light"
                      onClick={() => {
                        setCustomEndpoint('');
                        setCustomMethod('GET');
                        setCustomBody('');
                        setQueryParams('');
                        setTestResult(null);
                      }}
                      leftSection={<IconRefresh size={16} />}
                    >
                      Clear
                    </Button>
                  </Group>
                </Stack>
              </Paper>
            </Stack>
          </Tabs.Panel>
        </Tabs>

        {testResult && (
          <>
            <Divider label="Test Results" />
            <Paper p="md" withBorder style={{ position: 'relative' }}>
              <Stack gap="md">
                <Group>
                  <Badge
                    size="lg"
                    color={testResult.success ? 'green' : 'red'}
                    leftSection={testResult.success ? <IconCheck size={14} /> : <IconX size={14} />}
                  >
                    {testResult.success ? 'Success' : 'Failed'}
                  </Badge>
                  {testResult.status && (
                    <Badge size="lg" variant="light">
                      Status: {testResult.status}
                    </Badge>
                  )}
                  {testResult.duration && (
                    <Badge size="lg" variant="light" color="blue">
                      {testResult.duration}ms
                    </Badge>
                  )}
                </Group>

                {testResult.error && (
                  <Alert color="red" icon={<IconAlertCircle size={16} />}>
                    <Text size="sm">{testResult.error}</Text>
                  </Alert>
                )}

                {testResult.data && (
                  <div>
                    <Text size="sm" fw={600} mb="xs">Response Data:</Text>
                    <Code block style={{ maxHeight: 400, overflow: 'auto' }}>
                      {typeof testResult.data === 'string'
                        ? testResult.data
                        : JSON.stringify(testResult.data, null, 2)}
                    </Code>
                  </div>
                )}
              </Stack>
            </Paper>
          </>
        )}
      </Stack>
    </SettingsLayout>
  );
}
