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
  FileInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconApi,
  IconCheck,
  IconX,
  IconAlertCircle,
  IconRefresh,
  IconUpload,
} from '@tabler/icons-react';
import { supabase } from '../../lib/supabase';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface TestResult {
  success: boolean;
  status?: number;
  data?: any;
  error?: string;
  duration?: number;
}

// Helper function to build comprehensive grant text from Grants.gov data
function buildComprehensiveGrantText(details: any): string {
  const sections = [];

  sections.push(`GRANT OPPORTUNITY: ${details.title || 'Untitled'}`);
  sections.push(`Opportunity Number: ${details.number || 'N/A'}`);
  sections.push(`Agency: ${details.agency || 'Unknown'}\n`);

  if (details.description && details.description !== 'No description available.') {
    sections.push(`DESCRIPTION:\n${details.description}\n`);
  }

  if (details.postDate || details.closeDate) {
    sections.push(`KEY DATES:`);
    if (details.postDate) sections.push(`Posted: ${details.postDate}`);
    if (details.closeDate) sections.push(`Application Deadline: ${details.closeDate}`);
    sections.push('');
  }

  const hasFundingInfo = details.estimatedFunding || details.awardCeiling ||
                         details.awardFloor || details.expectedAwards;
  if (hasFundingInfo) {
    sections.push(`FUNDING INFORMATION:`);
    if (details.estimatedFunding) sections.push(`Total Program Funding: ${details.estimatedFunding}`);
    if (details.expectedAwards) sections.push(`Expected Number of Awards: ${details.expectedAwards}`);
    if (details.awardCeiling) sections.push(`Maximum Award Amount: ${details.awardCeiling}`);
    if (details.awardFloor) sections.push(`Minimum Award Amount: ${details.awardFloor}`);
    if (details.costSharing) sections.push(`Cost Sharing Required: ${details.costSharing}`);
    sections.push('');
  }

  if (details.eligibility) {
    sections.push(`ELIGIBILITY:`);
    sections.push(details.eligibility);
    sections.push('');
  }

  if (details.fundingInstrument) {
    sections.push(`FUNDING INSTRUMENT: ${details.fundingInstrument}\n`);
  }
  if (details.category) {
    sections.push(`PROGRAM CATEGORY: ${details.category}\n`);
  }

  return sections.join('\n');
}

// Internal Backend API Tests
const INTERNAL_API_TESTS = [
  {
    id: 'ai-nofo-summary-generate',
    name: '📄 AI NOFO Summary - Generate from PDF or Grant ID',
    endpoint: '/api/grants/nofo-summary',
    method: 'POST',
    requiresAuth: true,
    requiresFileUpload: true,
    requiresGrantId: true,
    defaultBody: JSON.stringify({
      grant_title: 'Test Grant NOFO',
      grant_id: 'test-grant-' + Date.now(),
      pdf_text: '[PDF text will be extracted from uploaded file OR fetched from Grants.gov]',
    }, null, 2),
    description: '⭐ Upload PDF OR enter a Grant ID (357304) or Opportunity Number (P25AS00474) to analyze NOFO',
    highlighted: true,
  },
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

// Direct OpenAI API Tests (via proxy using server's OPEN_AI_API_KEY)
const OPENAI_API_TESTS = [
  {
    id: 'openai-chat',
    name: 'OpenAI - Chat Completion',
    endpoint: '/api/openai-proxy',
    method: 'POST',
    requiresAuth: true,
    requiresProxy: true,
    proxyEndpoint: 'https://api.openai.com/v1/chat/completions',
    defaultBody: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say hello!' }
      ],
      max_tokens: 100,
    }, null, 2),
    description: 'Uses server\'s OPEN_AI_API_KEY environment variable',
  },
  {
    id: 'openai-embeddings',
    name: 'OpenAI - Create Embeddings',
    endpoint: '/api/openai-proxy',
    method: 'POST',
    requiresAuth: true,
    requiresProxy: true,
    proxyEndpoint: 'https://api.openai.com/v1/embeddings',
    defaultBody: JSON.stringify({
      model: 'text-embedding-3-small',
      input: 'This is a test grant description for embedding.',
    }, null, 2),
    description: 'Uses server\'s OPEN_AI_API_KEY environment variable',
  },
];

export function APITestingPage() {

  const [activeTab, setActiveTab] = useState<string>('internal');
  const [selectedTest, setSelectedTest] = useState<string>('');
  const [customEndpoint, setCustomEndpoint] = useState('');
  const [customMethod, setCustomMethod] = useState<string>('GET');
  const [customBody, setCustomBody] = useState('');
  const [queryParams, setQueryParams] = useState('');
  const [testParams, setTestParams] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, File>>({});
  const [grantIds, setGrantIds] = useState<Record<string, string>>({});

  // Extract text from PDF file
  const extractTextFromPdf = async (file: File): Promise<string> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      let fullText = '';

      // Extract text from each page
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += pageText + '\n\n';
      }

      return fullText.trim();
    } catch (error) {
      console.error('Error extracting PDF text:', error);
      throw new Error('Failed to extract text from PDF: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

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

      // Handle grant ID (fetch from Grants.gov and build comprehensive text)
      if (test.requiresGrantId && grantIds[test.id]) {
        const inputId = grantIds[test.id].trim();
        let numericId = inputId;

        // Check if input is numeric or alphanumeric
        const isNumeric = /^\d+$/.test(inputId);

        // Step 1: If alphanumeric (opportunity number), search for it first to get the numeric ID
        if (!isNumeric) {
          notifications.show({
            id: 'searching-grant',
            title: 'Searching for opportunity...',
            message: `Looking up opportunity number: ${inputId}`,
            loading: true,
            autoClose: false,
          });

          const searchResponse = await fetch('/api/grants/search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...options.headers,
            },
            body: JSON.stringify({
              keyword: inputId,
              limit: 1,
            }),
          });

          if (!searchResponse.ok) {
            notifications.hide('searching-grant');
            throw new Error(`Failed to search for opportunity: ${searchResponse.statusText}`);
          }

          const searchResults = await searchResponse.json();

          if (!searchResults.grants || searchResults.grants.length === 0) {
            notifications.hide('searching-grant');
            throw new Error(`No grant found with opportunity number: ${inputId}`);
          }

          // Extract the numeric ID from the search result
          numericId = searchResults.grants[0].id || searchResults.grants[0].opportunityId;

          notifications.hide('searching-grant');
          notifications.show({
            title: 'Found opportunity',
            message: `${searchResults.grants[0].title} (ID: ${numericId})`,
            color: 'blue',
            icon: <IconCheck size={16} />,
            autoClose: 3000,
          });
        }

        // Step 2: Check if this grant exists in our database (using numeric ID)
        notifications.show({
          id: 'checking-database',
          title: 'Checking database...',
          message: `Looking for grant ID ${numericId} in database`,
          loading: true,
          autoClose: false,
        });

        const { data: savedGrant } = await supabase
          .from('saved_grants')
          .select('id, external_id, title')
          .eq('external_id', numericId)
          .maybeSingle() as { data: { id: string; external_id: string; title: string } | null };

        notifications.hide('checking-database');

        // Step 3: Fetch grant details from Grants.gov
        notifications.show({
          id: 'fetching-grant',
          title: 'Fetching grant details...',
          message: `Retrieving data for grant ID: ${numericId}`,
          loading: true,
          autoClose: false,
        });

        const detailsResponse = await fetch('/api/grants/details', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
          body: JSON.stringify({ id: numericId }),
        });

        if (!detailsResponse.ok) {
          notifications.hide('fetching-grant');
          throw new Error(`Failed to fetch grant details: ${detailsResponse.statusText}`);
        }

        const grantDetails = await detailsResponse.json();

        notifications.hide('fetching-grant');

        if (savedGrant) {
          notifications.show({
            title: 'Grant found in database',
            message: `Using saved grant: ${savedGrant.title || numericId}`,
            color: 'green',
            icon: <IconCheck size={16} />,
          });
        } else {
          notifications.show({
            title: 'Grant details fetched',
            message: `Building analysis for: ${grantDetails.title || numericId} (not saved)`,
            color: 'blue',
            icon: <IconCheck size={16} />,
          });
        }

        // Build comprehensive text from all available data
        const comprehensiveText = buildComprehensiveGrantText(grantDetails);

        // Parse the body and inject the comprehensive grant data
        const bodyObj = JSON.parse(customBody || test.defaultBody || '{}');
        bodyObj.pdf_text = comprehensiveText;
        bodyObj.grant_title = grantDetails.title || `Grant ${numericId}`;

        // If we found the grant in our database, use the saved_grant_id (UUID)
        if (savedGrant) {
          bodyObj.saved_grant_id = savedGrant.id;
          delete bodyObj.grant_id; // Remove the external ID field
        } else {
          // Grant not in database - don't send any ID (standalone test)
          delete bodyObj.grant_id;
          delete bodyObj.saved_grant_id;
        }

        options.body = JSON.stringify(bodyObj);
      }
      // Handle file uploads (PDF extraction)
      else if (test.requiresFileUpload && uploadedFiles[test.id]) {
        const file = uploadedFiles[test.id];

        // Check if it's a PDF
        if (!file.type.includes('pdf')) {
          throw new Error('Please upload a PDF file');
        }

        // Extract text from PDF
        notifications.show({
          id: 'extracting-pdf',
          title: 'Extracting text from PDF...',
          message: 'This may take a moment',
          loading: true,
          autoClose: false,
        });

        const pdfText = await extractTextFromPdf(file);

        notifications.hide('extracting-pdf');
        notifications.show({
          title: 'PDF text extracted',
          message: `Extracted ${pdfText.length} characters`,
          color: 'green',
          icon: <IconCheck size={16} />,
        });

        // Parse the body and inject pdf_text
        const bodyObj = JSON.parse(customBody || test.defaultBody || '{}');
        bodyObj.pdf_text = pdfText;
        options.body = JSON.stringify(bodyObj);
      } else if (test.requiresProxy) {
        // For proxy requests, wrap the body in a special format
        const proxyBody = {
          endpoint: test.proxyEndpoint,
          body: JSON.parse(customBody || (test as any).defaultBody || '{}'),
        };
        options.body = JSON.stringify(proxyBody);
      } else if ((test.method === 'POST' || test.method === 'PATCH') && customBody) {
        // Regular POST/PATCH body
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

      // Ensure loading is always reset
      setLoading(false);

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
      // Extra safety: ensure loading is definitely false
      setLoading(false);
    }
  };

  const handleQuickTest = async (testConfig: any) => {
    setSelectedTest(testConfig.id);
    setCustomEndpoint(testConfig.endpoint);
    setCustomMethod(testConfig.method);
    setCustomBody(testConfig.defaultBody || '');
    setQueryParams('');
    await handleTest(testConfig);
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
              <Alert color="blue" icon={<IconUpload size={16} />}>
                <Text size="sm" fw={500}>NOFO Analysis Available!</Text>
                <Text size="xs" mt={4}>
                  The first test below (📄 AI NOFO Summary) lets you upload a PDF file OR enter a Grant ID/Opportunity Number. Accepts both numeric IDs (357304) and alphanumeric opportunity numbers (P25AS00474). It will extract deadlines, eligibility requirements, funding amounts, and priorities from your NOFO document or Grants.gov data.
                </Text>
              </Alert>

              <Paper p="md" withBorder>
                <Stack gap="md">
                  {INTERNAL_API_TESTS.map((test) => (
                    <Paper
                      key={test.id}
                      p="md"
                      withBorder
                      style={(test as any).highlighted ? {
                        borderColor: 'var(--mantine-color-blue-6)',
                        borderWidth: 2,
                        backgroundColor: 'var(--mantine-color-blue-0)',
                      } : undefined}
                    >
                      <Stack gap="sm">
                        <Group justify="space-between">
                          <div>
                            <Text fw={600} size="sm">{test.name}</Text>
                            <Code>{test.method} {window.location.origin}{test.endpoint}</Code>
                            {(test as any).description && (
                              <Text size="xs" c={(test as any).highlighted ? 'blue' : 'dimmed'} mt={4} fw={(test as any).highlighted ? 500 : 400}>
                                {(test as any).description}
                              </Text>
                            )}
                          </div>
                          <Button
                            size="xs"
                            onClick={() => handleQuickTest(test)}
                            loading={loading && selectedTest === test.id}
                            disabled={
                              (loading && selectedTest === test.id) ||
                              // For tests requiring file upload OR grant ID, at least one must be provided
                              ((test as any).requiresFileUpload && (test as any).requiresGrantId
                                ? !uploadedFiles[test.id] && !grantIds[test.id]
                                : (test as any).requiresFileUpload && !uploadedFiles[test.id])
                            }
                            color={(test as any).highlighted ? 'blue' : undefined}
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

                        {(test as any).requiresGrantId && (
                          <TextInput
                            size="xs"
                            label="Grant ID or Opportunity Number"
                            placeholder="e.g., 357304 or P25AS00474"
                            value={grantIds[test.id] || ''}
                            onChange={(e) => setGrantIds({ ...grantIds, [test.id]: e.target.value })}
                            description="Enter either a numeric ID (357304) or alphanumeric opportunity number (P25AS00474)"
                          />
                        )}

                        {(test as any).requiresFileUpload && (
                          <FileInput
                            size="xs"
                            label="Upload PDF File"
                            placeholder="Choose a PDF file..."
                            accept="application/pdf"
                            leftSection={<IconUpload size={14} />}
                            value={uploadedFiles[test.id] || null}
                            onChange={(file) => {
                              if (file) {
                                setUploadedFiles({ ...uploadedFiles, [test.id]: file });
                              } else {
                                const newFiles = { ...uploadedFiles };
                                delete newFiles[test.id];
                                setUploadedFiles(newFiles);
                              }
                            }}
                            clearable
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
              <Alert color="blue" icon={<IconAlertCircle size={16} />}>
                <Text size="sm" fw={500}>OpenAI Direct API Tests</Text>
                <Text size="xs" mt={4}>
                  These tests use the server's <Code>OPEN_AI_API_KEY</Code> environment variable.
                  Requests are proxied through <Code>/api/openai-proxy</Code> to keep the API key secure.
                </Text>
              </Alert>

              <Paper p="md" withBorder>
                <Stack gap="md">
                  {OPENAI_API_TESTS.map((test) => (
                    <Paper key={test.id} p="md" withBorder>
                      <Stack gap="sm">
                        <Group justify="space-between">
                          <div>
                            <Text fw={600} size="sm">{test.name}</Text>
                            <Code>{test.method} {test.endpoint}</Code>
                            {(test as any).proxyEndpoint && (
                              <Text size="xs" c="dimmed" mt={1}>
                                → Proxies to: {(test as any).proxyEndpoint}
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

        <Divider label="Test Results" />
        <Paper p="md" withBorder style={{ position: 'relative' }}>
          {!testResult ? (
            <Alert color="gray" icon={<IconAlertCircle size={16} />}>
              <Text size="sm">No results yet. Run a test to see the response.</Text>
            </Alert>
          ) : (
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
          )}
        </Paper>
      </Stack>
  );
}
