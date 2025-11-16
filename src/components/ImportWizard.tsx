import { useState } from 'react';
import {
  Modal,
  Stepper,
  Button,
  Group,
  Stack,
  Text,
  Select,
  FileButton,
  Table,
  Alert,
  Progress,
  Badge,
  Card,
  ScrollArea,
  Paper,
} from '@mantine/core';
import {
  IconUpload,
  IconCheck,
  IconX,
  IconAlertCircle,
  IconDownload,
  IconMap,
  IconEye,
  IconSparkles,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { supabase } from '../lib/supabase';
import { useOrganization } from '../contexts/OrganizationContext';
import { useAuth } from '../contexts/AuthContext';
import { parseCSV, readFileAsText } from '../utils/csvParser';
import {
  PLATFORM_PRESETS,
  detectPreset,
  applyMapping,
  validateMappedRow,
  GRANTCUE_FIELDS,
  generateSampleCSV,
} from '../utils/fieldMapper';

interface ImportWizardProps {
  opened: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ImportState {
  file: File | null;
  csvData: { headers: string[]; rows: Record<string, string>[] } | null;
  selectedPreset: string | null;
  customMappings: Record<string, string>;
  validatedData: Array<{ row: Record<string, any>; errors: string[] }> | null;
  importing: boolean;
  importProgress: number;
  importStatus: string;
  importedCount: number;
  totalCount: number;
  importCancelled: boolean;
  enriching: boolean;
  enrichmentProgress: number;
}

export function ImportWizard({ opened, onClose, onSuccess }: ImportWizardProps) {
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  const [active, setActive] = useState(0);
  const [state, setState] = useState<ImportState>({
    file: null,
    csvData: null,
    selectedPreset: null,
    customMappings: {},
    validatedData: null,
    importing: false,
    importProgress: 0,
    importStatus: '',
    importedCount: 0,
    totalCount: 0,
    importCancelled: false,
    enriching: false,
    enrichmentProgress: 0,
  });

  // Step 1: File Upload
  const handleFileSelect = async (file: File | null) => {
    if (!file) return;

    try {
      const content = await readFileAsText(file);
      const parsed = parseCSV(content);

      if (parsed.errors.length > 0) {
        notifications.show({
          title: 'CSV Parse Warnings',
          message: parsed.errors.join('\n'),
          color: 'yellow',
        });
      }

      // Auto-detect preset
      const detected = detectPreset(parsed.headers);

      setState(prev => ({
        ...prev,
        file,
        csvData: parsed,
        selectedPreset: detected,
        customMappings: detected ? PLATFORM_PRESETS[detected].mappings : {},
      }));

      if (detected) {
        notifications.show({
          title: 'Platform Detected',
          message: `Detected ${PLATFORM_PRESETS[detected].name} format`,
          color: 'blue',
        });
      }

      setActive(1);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to parse CSV',
        color: 'red',
      });
    }
  };

  // Step 2: Field Mapping
  const handlePresetChange = (preset: string | null) => {
    if (preset && PLATFORM_PRESETS[preset]) {
      setState(prev => ({
        ...prev,
        selectedPreset: preset,
        customMappings: PLATFORM_PRESETS[preset].mappings,
      }));
    }
  };

  const handleMappingChange = (sourceField: string, targetField: string | null) => {
    setState(prev => ({
      ...prev,
      customMappings: {
        ...prev.customMappings,
        [sourceField]: targetField || '',
      },
    }));
  };

  // Step 3: Preview & Validate
  const handleValidate = () => {
    if (!state.csvData || !currentOrg || !user) return;

    const validated = state.csvData.rows.map((row, index) => {
      const mapped = applyMapping(row, state.customMappings);

      // Add org_id and user_id
      mapped.org_id = currentOrg.id;
      mapped.user_id = user.id;

      const validation = validateMappedRow(mapped, index);

      return {
        row: mapped,
        errors: validation.errors,
      };
    });

    setState(prev => ({ ...prev, validatedData: validated }));
    setActive(2);
  };

  // Step 4: Import
  const handleImport = async () => {
    if (!state.validatedData) return;

    const validRows = state.validatedData
      .filter(item => item.errors.length === 0)
      .map(item => item.row);

    setState(prev => ({
      ...prev,
      importing: true,
      importProgress: 0,
      importStatus: 'Starting import...',
      importedCount: 0,
      totalCount: validRows.length,
      importCancelled: false,
    }));

    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      setState(prev => ({ ...prev, importStatus: `Importing ${validRows.length} grants...`, importProgress: 10 }));

      // Bulk import using dedicated endpoint
      const response = await fetch('/api/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          grants: validRows,
          org_id: validRows[0]?.org_id,
          user_id: validRows[0]?.user_id,
        }),
      });

      setState(prev => ({ ...prev, importProgress: 70, importStatus: 'Processing import results...' }));

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Import failed');
      }

      const result = await response.json();

      setState(prev => ({
        ...prev,
        importProgress: 100,
        importedCount: result.imported || validRows.length,
        importStatus: `Successfully imported ${result.imported || validRows.length} grants!`,
      }));

      // Optionally show enrichment phase
      if (result.imported > 0) {
        setState(prev => ({
          ...prev,
          enriching: true,
          enrichmentProgress: 0,
          importStatus: 'Enriching imported grants with AI...',
        }));

        // Simulate enrichment progress (in real implementation, this would be actual API calls)
        const enrichmentInterval = setInterval(() => {
          setState(prev => {
            const newProgress = Math.min(prev.enrichmentProgress + 20, 100);
            if (newProgress === 100) {
              clearInterval(enrichmentInterval);
              return {
                ...prev,
                enriching: false,
                enrichmentProgress: 100,
                importStatus: 'Import and enrichment complete!',
              };
            }
            return {
              ...prev,
              enrichmentProgress: newProgress,
            };
          });
        }, 500);
      }

      notifications.show({
        title: 'Import Successful',
        message: `Successfully imported ${result.imported || validRows.length} grants!`,
        color: 'green',
      });

      setActive(3); // Move to completion step
      onSuccess();
    } catch (error) {
      setState(prev => ({ ...prev, importStatus: 'Import failed' }));
      notifications.show({
        title: 'Import Error',
        message: error instanceof Error ? error.message : 'Failed to import grants',
        color: 'red',
      });
    } finally {
      setState(prev => ({ ...prev, importing: false }));
    }
  };

  const handleClose = () => {
    setState({
      file: null,
      csvData: null,
      selectedPreset: null,
      customMappings: {},
      validatedData: null,
      importing: false,
      importProgress: 0,
      importStatus: '',
      importedCount: 0,
      totalCount: 0,
      importCancelled: false,
      enriching: false,
      enrichmentProgress: 0,
    });
    setActive(0);
    onClose();
  };

  const handleDownloadSample = () => {
    const csv = generateSampleCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'grantcue-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalErrors = state.validatedData?.reduce((sum, item) => sum + item.errors.length, 0) || 0;
  const validRows = state.validatedData?.filter(item => item.errors.length === 0).length || 0;

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Import Grants"
      size="xl"
      closeOnClickOutside={false}
    >
      <Stepper active={active}>
        {/* Step 1: Upload */}
        <Stepper.Step
          label="Upload"
          description="Select CSV file"
          icon={<IconUpload size={18} />}
        >
          <Stack gap="md" py="md">
            <Alert icon={<IconAlertCircle size={16} />} color="blue">
              <Text size="sm">
                Upload a CSV file exported from GrantHub, Instrumentl, or any other platform.
                We'll automatically detect the format and map the fields.
              </Text>
            </Alert>

            <Card withBorder>
              <Stack gap="md">
                <Group justify="space-between">
                  <Text fw={500}>Select File</Text>
                  <Button
                    variant="subtle"
                    size="xs"
                    leftSection={<IconDownload size={14} />}
                    onClick={handleDownloadSample}
                  >
                    Download Sample CSV
                  </Button>
                </Group>

                <FileButton onChange={handleFileSelect} accept=".csv">
                  {(props) => (
                    <Button {...props} fullWidth leftSection={<IconUpload size={16} />}>
                      Choose CSV File
                    </Button>
                  )}
                </FileButton>

                {state.file && (
                  <Alert color="green" icon={<IconCheck size={16} />}>
                    <Group justify="space-between">
                      <div>
                        <Text size="sm" fw={500}>{state.file.name}</Text>
                        <Text size="xs" c="dimmed">
                          {state.csvData?.rows.length || 0} rows found
                        </Text>
                      </div>
                      <Button onClick={() => setActive(1)}>Continue</Button>
                    </Group>
                  </Alert>
                )}
              </Stack>
            </Card>

            <Text size="sm" c="dimmed">
              <strong>Supported formats:</strong> GrantHub, Instrumentl, Foundation Search, Candid, Grants.gov
            </Text>
          </Stack>
        </Stepper.Step>

        {/* Step 2: Map Fields */}
        <Stepper.Step
          label="Map Fields"
          description="Match columns"
          icon={<IconMap size={18} />}
        >
          <Stack gap="md" py="md">
            <Group justify="space-between">
              <Text size="sm">Map your CSV columns to GrantCue fields</Text>
              <Select
                placeholder="Use preset mapping"
                data={Object.entries(PLATFORM_PRESETS).map(([key, preset]) => ({
                  value: key,
                  label: preset.name,
                }))}
                value={state.selectedPreset}
                onChange={handlePresetChange}
                clearable
              />
            </Group>

            {state.csvData && (
              <ScrollArea h={400}>
                <Table striped>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>CSV Column</Table.Th>
                      <Table.Th>Maps To</Table.Th>
                      <Table.Th>Sample Value</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {state.csvData.headers.map(header => (
                      <Table.Tr key={header}>
                        <Table.Td>
                          <Text size="sm" fw={500}>{header}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Select
                            size="xs"
                            placeholder="Skip this field"
                            data={Object.entries(GRANTCUE_FIELDS).map(([key, config]) => ({
                              value: key,
                              label: config.label + (config.required ? ' *' : ''),
                            }))}
                            value={state.customMappings[header] || null}
                            onChange={(val) => handleMappingChange(header, val)}
                            clearable
                          />
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" c="dimmed" lineClamp={1}>
                            {state.csvData?.rows[0]?.[header] || '—'}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            )}

            <Group justify="space-between">
              <Button variant="subtle" onClick={() => setActive(0)}>
                Back
              </Button>
              <Button onClick={handleValidate}>
                Preview & Validate
              </Button>
            </Group>
          </Stack>
        </Stepper.Step>

        {/* Step 3: Preview & Validate */}
        <Stepper.Step
          label="Preview"
          description="Review data"
          icon={<IconEye size={18} />}
        >
          <Stack gap="md" py="md">
            {state.validatedData && (
              <>
                <Group justify="space-between">
                  <div>
                    <Badge color="green" size="lg">{validRows} Valid</Badge>
                    {totalErrors > 0 && (
                      <Badge color="red" size="lg" ml="xs">{totalErrors} Errors</Badge>
                    )}
                  </div>
                  <Text size="sm" c="dimmed">
                    {state.validatedData.length} total rows
                  </Text>
                </Group>

                {totalErrors > 0 && (
                  <Alert icon={<IconAlertCircle size={16} />} color="yellow">
                    <Text size="sm">
                      Some rows have errors and will be skipped. Review the preview below.
                    </Text>
                  </Alert>
                )}

                <ScrollArea h={400}>
                  <Stack gap="xs">
                    {state.validatedData.slice(0, 10).map((item, index) => (
                      <Card
                        key={index}
                        withBorder
                        bg={item.errors.length > 0 ? 'red.0' : undefined}
                      >
                        <Group justify="space-between" align="flex-start">
                          <div style={{ flex: 1 }}>
                            <Text size="sm" fw={500}>{item.row.title || 'Untitled'}</Text>
                            <Text size="xs" c="dimmed">{item.row.external_id || 'No ID'}</Text>
                            {item.errors.length > 0 && (
                              <Text size="xs" c="red" mt="xs">
                                {item.errors.join(', ')}
                              </Text>
                            )}
                          </div>
                          {item.errors.length === 0 ? (
                            <IconCheck size={20} color="green" />
                          ) : (
                            <IconX size={20} color="red" />
                          )}
                        </Group>
                      </Card>
                    ))}

                    {state.validatedData.length > 10 && (
                      <Text size="xs" c="dimmed" ta="center">
                        ...and {state.validatedData.length - 10} more rows
                      </Text>
                    )}
                  </Stack>
                </ScrollArea>

                <Group justify="space-between">
                  <Button
                    variant="subtle"
                    onClick={() => setActive(1)}
                    disabled={state.importing}
                  >
                    Back to Mapping
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={validRows === 0 || state.importing}
                    loading={state.importing}
                  >
                    Import {validRows} Grants
                  </Button>
                </Group>

                {(state.importing || state.enriching) && (
                  <Stack gap="md">
                    <Paper p="md" withBorder>
                      <Stack gap="md">
                        <Group justify="space-between" align="flex-start">
                          <Stack gap="xs" style={{ flex: 1 }}>
                            <Text size="sm" fw={600}>
                              {state.importStatus || 'Importing grants...'}
                            </Text>
                            <Progress value={state.importProgress} size="lg" animated color="grape" />
                            <Group justify="space-between">
                              <Text size="xs" c="dimmed">
                                {state.importProgress.toFixed(0)}% complete
                              </Text>
                              {state.totalCount > 0 && (
                                <Text size="xs" fw={500}>
                                  {state.importProgress === 100
                                    ? `${state.importedCount} of ${state.totalCount} grants imported`
                                    : `Importing ${state.totalCount} grants...`}
                                </Text>
                              )}
                            </Group>
                          </Stack>
                        </Group>
                      </Stack>
                    </Paper>

                    {/* Enrichment progress */}
                    {state.enriching && (
                      <Paper p="md" withBorder bg="var(--mantine-color-grape-0)">
                        <Stack gap="sm">
                          <Group gap="xs">
                            <IconSparkles size={20} color="var(--mantine-color-grape-6)" />
                            <Text size="sm" fw={600} c="grape">
                              AI Enrichment in Progress
                            </Text>
                          </Group>
                          <Progress value={state.enrichmentProgress} size="md" animated color="grape" />
                          <Text size="xs" c="dimmed">
                            Enriching grants with AI-powered insights... ({state.enrichmentProgress.toFixed(0)}%)
                          </Text>
                        </Stack>
                      </Paper>
                    )}
                  </Stack>
                )}
              </>
            )}
          </Stack>
        </Stepper.Step>

        <Stepper.Completed>
          <Stack align="center" gap="md" py="xl">
            <IconCheck size={48} color="green" />
            <Text size="lg" fw={500}>Import Complete!</Text>
            <Button onClick={handleClose}>Close</Button>
          </Stack>
        </Stepper.Completed>
      </Stepper>
    </Modal>
  );
}
