import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Container,
  Stack,
  Title,
  Text,
  Paper,
  Button,
  Group,
  Stepper,
  FileInput,
  Table,
  Checkbox,
  Alert,
  Progress,
  Badge,
  Divider,
  Card,
  List,
  SimpleGrid,
  Select,
} from '@mantine/core';
import {
  IconUpload,
  IconCheck,
  IconAlertCircle,
  IconFileImport,
  IconArrowRight,
  IconInfoCircle,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { AppHeader } from '../components/AppHeader';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useOrganization } from '../contexts/OrganizationContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface ParsedGrant {
  title: string;
  agency: string;
  aln: string;
  closeDate: string;
  amount: string;
  status: string;
  notes: string;
  selected: boolean;
  warnings: string[];
}

interface ImportResults {
  imported: number;
  skipped: number;
  failed: number;
}

interface ColumnMapping {
  [csvColumn: string]: string | null; // null means skip column
}

interface ValidationIssue {
  row: number;
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

// Available GrantCue fields for mapping
const AVAILABLE_FIELDS = [
  { value: 'title', label: 'Grant Title (Required)' },
  { value: 'agency', label: 'Agency/Funder' },
  { value: 'aln', label: 'ALN/CFDA Number' },
  { value: 'closeDate', label: 'Close Date/Deadline' },
  { value: 'amount', label: 'Award Amount' },
  { value: 'status', label: 'Status/Stage' },
  { value: 'notes', label: 'Notes/Description' },
  { value: 'skip', label: '— Skip this column —' },
];

export function GrantHubImportPage() {
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState<string>('');
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [parsedGrants, setParsedGrants] = useState<ParsedGrant[]>([]);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<ImportResults | null>(null);

  // Auto-detect column mapping based on common field names
  const autoMapColumns = (columns: string[]): ColumnMapping => {
    const mapping: ColumnMapping = {};

    columns.forEach(col => {
      const lower = col.toLowerCase();

      if (lower.includes('title') || lower.includes('grant name') || lower.includes('opportunity')) {
        mapping[col] = 'title';
      } else if (lower.includes('agency') || lower.includes('funder') || lower.includes('organization')) {
        mapping[col] = 'agency';
      } else if (lower.includes('aln') || lower.includes('cfda')) {
        mapping[col] = 'aln';
      } else if (lower.includes('deadline') || lower.includes('close date') || lower.includes('due date')) {
        mapping[col] = 'closeDate';
      } else if (lower.includes('amount') || lower.includes('award') || lower.includes('funding')) {
        mapping[col] = 'amount';
      } else if (lower.includes('status') || lower.includes('stage')) {
        mapping[col] = 'status';
      } else if (lower.includes('notes') || lower.includes('description')) {
        mapping[col] = 'notes';
      } else {
        mapping[col] = 'skip'; // Skip unmapped columns by default
      }
    });

    return mapping;
  };

  // Parse CSV with applied column mapping
  const parseCSVWithMapping = (text: string, mapping: ColumnMapping): ParsedGrant[] => {
    const lines = text.split('\n');
    if (lines.length < 2) {
      throw new Error('CSV file appears to be empty');
    }

    const headers = lines[0].split(',').map(h => h.trim());
    const grants: ParsedGrant[] = [];
    const issues: ValidationIssue[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const warnings: string[] = [];

      // Build grant object based on mapping
      const grantData: any = {
        title: '',
        agency: '',
        aln: '',
        closeDate: '',
        amount: '',
        status: 'Researching',
        notes: '',
      };

      headers.forEach((header, index) => {
        const mappedField = mapping[header];
        if (mappedField && mappedField !== 'skip' && values[index]) {
          grantData[mappedField] = values[index];
        }
      });

      // Validation
      if (!grantData.title || grantData.title.trim() === '') {
        issues.push({
          row: i,
          field: 'title',
          message: 'Missing required field: Grant Title',
          severity: 'error',
        });
        grantData.title = 'Unnamed Grant';
        warnings.push('Missing title');
      }

      if (!grantData.agency || grantData.agency.trim() === '') {
        warnings.push('No agency specified');
      }

      if (grantData.closeDate) {
        // Validate date format
        const date = new Date(grantData.closeDate);
        if (isNaN(date.getTime())) {
          warnings.push('Invalid date format');
          issues.push({
            row: i,
            field: 'closeDate',
            message: 'Invalid date format, expected YYYY-MM-DD or MM/DD/YYYY',
            severity: 'warning',
          });
        }
      }

      const grant: ParsedGrant = {
        ...grantData,
        selected: true,
        warnings,
      };

      grants.push(grant);
    }

    setValidationIssues(issues);
    return grants;
  };

  const handleFileUpload = async (uploadedFile: File | null) => {
    if (!uploadedFile) return;

    setFile(uploadedFile);
    try {
      const text = await uploadedFile.text();
      setCsvText(text);

      // Extract column headers
      const lines = text.split('\n');
      if (lines.length < 2) {
        throw new Error('CSV file appears to be empty');
      }

      const headers = lines[0].split(',').map(h => h.trim());
      setDetectedColumns(headers);

      // Auto-map columns
      const mapping = autoMapColumns(headers);
      setColumnMapping(mapping);

      setActiveStep(1);
      notifications.show({
        title: 'File uploaded successfully',
        message: `Detected ${headers.length} columns. Please review the field mapping.`,
        color: 'green',
        icon: <IconCheck size={16} />,
      });
    } catch (error) {
      notifications.show({
        title: 'Error reading file',
        message: error instanceof Error ? error.message : 'Please check the file format',
        color: 'red',
      });
    }
  };

  const handleApplyMapping = () => {
    // Check if title is mapped
    const hasTitleMapping = Object.values(columnMapping).includes('title');
    if (!hasTitleMapping) {
      notifications.show({
        title: 'Missing required field',
        message: 'Please map at least one column to "Grant Title"',
        color: 'orange',
      });
      return;
    }

    try {
      const grants = parseCSVWithMapping(csvText, columnMapping);
      setParsedGrants(grants);
      setActiveStep(2);

      if (validationIssues.length > 0) {
        const errorCount = validationIssues.filter(i => i.severity === 'error').length;
        const warningCount = validationIssues.filter(i => i.severity === 'warning').length;
        notifications.show({
          title: 'Mapping applied with issues',
          message: `Found ${errorCount} errors and ${warningCount} warnings. Review grants before importing.`,
          color: 'orange',
          icon: <IconAlertCircle size={16} />,
        });
      } else {
        notifications.show({
          title: 'Mapping applied successfully',
          message: `Parsed ${grants.length} grants. Review and select grants to import.`,
          color: 'green',
          icon: <IconCheck size={16} />,
        });
      }
    } catch (error) {
      notifications.show({
        title: 'Error parsing file',
        message: error instanceof Error ? error.message : 'Please check the file format',
        color: 'red',
      });
    }
  };

  const handleImport = async () => {
    const selectedGrants = parsedGrants.filter(g => g.selected);
    if (selectedGrants.length === 0) {
      notifications.show({
        title: 'No grants selected',
        message: 'Please select at least one grant to import',
        color: 'orange',
      });
      return;
    }

    setImporting(true);
    setImportProgress(0);

    // Get auth token
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      notifications.show({
        title: 'Authentication error',
        message: 'Please sign in again to import grants',
        color: 'red',
      });
      setImporting(false);
      return;
    }

    // Fetch existing grants to check for duplicates
    const { data: existingGrants } = await supabase
      .from('org_grants_saved')
      .select('title, agency, external_id')
      .eq('org_id', currentOrg?.id || '');

    const existingSet = new Set(
      (existingGrants || []).map((g: { title: string; agency: string | null; external_id: string }) =>
        `${g.title.toLowerCase()}|${(g.agency || '').toLowerCase()}`
      )
    );

    let imported = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];
    const warnings: string[] = [];

    for (let i = 0; i < selectedGrants.length; i++) {
      const grant = selectedGrants[i];

      // Check for duplicate
      const grantKey = `${grant.title.toLowerCase()}|${(grant.agency || '').toLowerCase()}`;
      if (existingSet.has(grantKey)) {
        skipped++;
        warnings.push(`${grant.title}: Already exists (skipped)`);
        setImportProgress(((i + 1) / selectedGrants.length) * 100);
        continue;
      }

      try {
        const response = await fetch('/api/saved', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            org_id: currentOrg?.id,
            user_id: user?.id,
            external_source: 'granthub_import',
            external_id: `granthub_${Date.now()}_${i}`,
            title: grant.title,
            agency: grant.agency || null,
            aln: grant.aln || null,
            close_date: grant.closeDate || null,
            notes: grant.notes || null,
            status: mapStatus(grant.status),
          }),
        });

        if (response.ok) {
          imported++;
        } else {
          failed++;
          // Try to extract error message
          try {
            const errorData = await response.json();
            errors.push(`${grant.title}: ${errorData.error || 'Unknown error'}`);
          } catch {
            errors.push(`${grant.title}: HTTP ${response.status}`);
          }
        }
      } catch (error) {
        failed++;
        errors.push(`${grant.title}: ${error instanceof Error ? error.message : 'Network error'}`);
      }

      setImportProgress(((i + 1) / selectedGrants.length) * 100);
    }

    setImporting(false);
    setImportResults({ imported, skipped, failed });
    setActiveStep(3);

    // Build result message
    const parts = [`${imported} imported`];
    if (skipped > 0) parts.push(`${skipped} skipped (duplicates)`);
    if (failed > 0) parts.push(`${failed} failed`);

    notifications.show({
      title: 'Import complete',
      message: parts.join(', '),
      color: imported > 0 ? 'green' : failed > 0 ? 'red' : 'orange',
      icon: <IconCheck size={16} />,
    });

    // Log details for debugging
    if (warnings.length > 0) {
      console.info('Import warnings (duplicates skipped):', warnings);
    }
    if (errors.length > 0) {
      console.error('Import errors:', errors);
    }
  };

  const mapStatus = (status: string): string => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('research') || statusLower.includes('prospect')) return 'researching';
    if (statusLower.includes('draft') || statusLower.includes('writing')) return 'drafting';
    if (statusLower.includes('submit') || statusLower.includes('pending')) return 'submitted';
    if (statusLower.includes('award') || statusLower.includes('won')) return 'awarded';
    return 'researching';
  };

  const toggleGrantSelection = (index: number) => {
    setParsedGrants(grants =>
      grants.map((g, i) => (i === index ? { ...g, selected: !g.selected } : g))
    );
  };

  const toggleAllGrants = () => {
    const allSelected = parsedGrants.every(g => g.selected);
    setParsedGrants(grants => grants.map(g => ({ ...g, selected: !allSelected })));
  };

  return (
    <ProtectedRoute>
      <AppHeader subtitle="Import from GrantHub" />
      <Container size="xl" py="xl">
        <Stack gap="lg">
          {/* Header */}
          <Stack gap="sm">
            <Title order={1}>Import from GrantHub</Title>
            <Text c="dimmed" size="lg">
              Migrate your grant data from GrantHub/GrantHub Pro to GrantCue
            </Text>
          </Stack>

          <Divider />

          {/* Steps */}
          <Stepper active={activeStep}>
            <Stepper.Step label="Upload" description="Upload your CSV export">
              <Stack gap="md" mt="lg">
                <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
                  <Stack gap="xs">
                    <Text fw={600} size="sm">
                      How to export from GrantHub:
                    </Text>
                    <List size="sm">
                      <List.Item>Log in to your GrantHub account</List.Item>
                      <List.Item>Navigate to your grants list</List.Item>
                      <List.Item>Click "Export" or "Download CSV"</List.Item>
                      <List.Item>Save the CSV file to your computer</List.Item>
                      <List.Item>Upload it here!</List.Item>
                    </List>
                  </Stack>
                </Alert>

                <Paper p="md" withBorder>
                  <Stack gap="md">
                    <FileInput
                      label="GrantHub CSV Export"
                      placeholder="Choose CSV file"
                      leftSection={<IconUpload size={16} />}
                      value={file}
                      onChange={handleFileUpload}
                      accept=".csv,text/csv"
                      clearable
                    />
                    {file && (
                      <Text size="sm" c="dimmed">
                        File loaded: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                      </Text>
                    )}
                  </Stack>
                </Paper>
              </Stack>
            </Stepper.Step>

            <Stepper.Step label="Map Fields" description="Map CSV columns to GrantCue fields">
              <Stack gap="md" mt="lg">
                <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
                  <Text size="sm">
                    We've automatically detected your CSV columns and mapped them to GrantCue fields.
                    Review and adjust the mapping below. At minimum, you must map one column to "Grant Title".
                  </Text>
                </Alert>

                <Paper p="md" withBorder>
                  <Stack gap="md">
                    <Title order={4}>Column Mapping</Title>

                    {detectedColumns.map((column, index) => (
                      <Group key={index} gap="md" align="center">
                        <Text w={200} fw={500} size="sm">
                          {column}
                        </Text>
                        <Text c="dimmed">→</Text>
                        <Select
                          w={250}
                          data={AVAILABLE_FIELDS}
                          value={columnMapping[column] || 'skip'}
                          onChange={(value) =>
                            setColumnMapping({ ...columnMapping, [column]: value })
                          }
                          placeholder="Select field"
                        />
                      </Group>
                    ))}
                  </Stack>
                </Paper>

                <Group justify="flex-end">
                  <Button variant="light" onClick={() => setActiveStep(0)}>
                    Back
                  </Button>
                  <Button
                    leftSection={<IconCheck size={16} />}
                    onClick={handleApplyMapping}
                  >
                    Apply Mapping & Continue
                  </Button>
                </Group>
              </Stack>
            </Stepper.Step>

            <Stepper.Step label="Review" description="Review and select grants">
              <Stack gap="md" mt="lg">
                {/* Validation Issues Summary */}
                {validationIssues.length > 0 && (
                  <Alert icon={<IconAlertCircle size={16} />} color="orange" variant="light">
                    <Stack gap="xs">
                      <Text fw={600} size="sm">
                        Found {validationIssues.length} validation issue(s):
                      </Text>
                      <List size="sm">
                        {validationIssues.slice(0, 5).map((issue, index) => (
                          <List.Item key={index}>
                            Row {issue.row}: {issue.message}
                          </List.Item>
                        ))}
                        {validationIssues.length > 5 && (
                          <List.Item>
                            ... and {validationIssues.length - 5} more issues
                          </List.Item>
                        )}
                      </List>
                    </Stack>
                  </Alert>
                )}

                <Group justify="space-between">
                  <Text fw={600}>
                    Found {parsedGrants.length} grants
                  </Text>
                  <Button variant="light" size="xs" onClick={toggleAllGrants}>
                    {parsedGrants.every(g => g.selected) ? 'Deselect All' : 'Select All'}
                  </Button>
                </Group>

                <Paper withBorder>
                  <Table highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>
                          <Checkbox
                            checked={parsedGrants.every(g => g.selected)}
                            onChange={toggleAllGrants}
                          />
                        </Table.Th>
                        <Table.Th>Title</Table.Th>
                        <Table.Th>Agency</Table.Th>
                        <Table.Th>Deadline</Table.Th>
                        <Table.Th>Status</Table.Th>
                        <Table.Th>Warnings</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {parsedGrants.map((grant, index) => (
                        <Table.Tr key={index}>
                          <Table.Td>
                            <Checkbox
                              checked={grant.selected}
                              onChange={() => toggleGrantSelection(index)}
                            />
                          </Table.Td>
                          <Table.Td>{grant.title}</Table.Td>
                          <Table.Td>{grant.agency || <Text c="dimmed" size="sm">—</Text>}</Table.Td>
                          <Table.Td>{grant.closeDate || <Text c="dimmed" size="sm">—</Text>}</Table.Td>
                          <Table.Td>
                            <Badge size="sm" variant="light">
                              {grant.status}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            {grant.warnings && grant.warnings.length > 0 ? (
                              <Badge size="sm" color="orange" variant="dot">
                                {grant.warnings.length} issue{grant.warnings.length > 1 ? 's' : ''}
                              </Badge>
                            ) : (
                              <Badge size="sm" color="green" variant="dot">
                                OK
                              </Badge>
                            )}
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Paper>

                <Group justify="flex-end">
                  <Button variant="light" onClick={() => setActiveStep(1)}>
                    Back to Mapping
                  </Button>
                  <Button
                    leftSection={<IconFileImport size={16} />}
                    onClick={handleImport}
                    loading={importing}
                  >
                    Import {parsedGrants.filter(g => g.selected).length} Grants
                  </Button>
                </Group>

                {importing && (
                  <Paper p="md" withBorder>
                    <Stack gap="xs">
                      <Text size="sm" fw={600}>
                        Importing grants...
                      </Text>
                      <Progress value={importProgress} animated />
                      <Text size="xs" c="dimmed">
                        {importProgress.toFixed(0)}% complete
                      </Text>
                    </Stack>
                  </Paper>
                )}
              </Stack>
            </Stepper.Step>

            <Stepper.Completed>
              <Stack gap="md" mt="lg" align="center">
                <Card padding="xl" withBorder>
                  <Stack align="center" gap="md">
                    <IconCheck size={64} style={{ color: 'var(--mantine-color-green-6)' }} />
                    <Title order={2}>Import Complete!</Title>

                    {importResults && (
                      <SimpleGrid cols={3} w="100%" mt="md">
                        <Paper p="md" withBorder bg="var(--mantine-color-green-0)">
                          <Stack gap={4} align="center">
                            <Text size="xl" fw={700} c="green">
                              {importResults.imported}
                            </Text>
                            <Text size="sm" c="dimmed">
                              Imported
                            </Text>
                          </Stack>
                        </Paper>
                        {importResults.skipped > 0 && (
                          <Paper p="md" withBorder bg="var(--mantine-color-yellow-0)">
                            <Stack gap={4} align="center">
                              <Text size="xl" fw={700} c="orange">
                                {importResults.skipped}
                              </Text>
                              <Text size="sm" c="dimmed">
                                Skipped (duplicates)
                              </Text>
                            </Stack>
                          </Paper>
                        )}
                        {importResults.failed > 0 && (
                          <Paper p="md" withBorder bg="var(--mantine-color-red-0)">
                            <Stack gap={4} align="center">
                              <Text size="xl" fw={700} c="red">
                                {importResults.failed}
                              </Text>
                              <Text size="sm" c="dimmed">
                                Failed
                              </Text>
                            </Stack>
                          </Paper>
                        )}
                      </SimpleGrid>
                    )}

                    <Text ta="center" c="dimmed" mt="md">
                      Your grants have been imported. You can now view and manage them in your pipeline.
                    </Text>

                    <Group mt="md">
                      <Button component={Link} to="/pipeline" variant="filled" rightSection={<IconArrowRight size={16} />}>
                        Go to Pipeline
                      </Button>
                      <Button component={Link} to="/pipeline?view=list" variant="light">
                        View Saved Grants
                      </Button>
                    </Group>
                  </Stack>
                </Card>
              </Stack>
            </Stepper.Completed>
          </Stepper>
        </Stack>
      </Container>
    </ProtectedRoute>
  );
}
