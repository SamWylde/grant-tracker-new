import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
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
} from '@mantine/core';
import {
  IconUpload,
  IconCheck,
  IconAlertCircle,
  IconFileImport,
  IconTable,
  IconArrowRight,
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
}

export function GrantHubImportPage() {
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [parsedGrants, setParsedGrants] = useState<ParsedGrant[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  const parseCSV = (text: string): ParsedGrant[] => {
    const lines = text.split('\n');
    if (lines.length < 2) {
      throw new Error('CSV file appears to be empty');
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const grants: ParsedGrant[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));

      const grant: ParsedGrant = {
        title: values[headers.indexOf('title')] || values[headers.indexOf('grant name')] || values[headers.indexOf('opportunity title')] || 'Unnamed Grant',
        agency: values[headers.indexOf('agency')] || values[headers.indexOf('funder')] || values[headers.indexOf('organization')] || '',
        aln: values[headers.indexOf('aln')] || values[headers.indexOf('cfda')] || '',
        closeDate: values[headers.indexOf('deadline')] || values[headers.indexOf('close date')] || values[headers.indexOf('due date')] || '',
        amount: values[headers.indexOf('amount')] || values[headers.indexOf('award amount')] || values[headers.indexOf('funding amount')] || '',
        status: values[headers.indexOf('status')] || values[headers.indexOf('stage')] || 'Researching',
        notes: values[headers.indexOf('notes')] || values[headers.indexOf('description')] || '',
        selected: true,
      };

      grants.push(grant);
    }

    return grants;
  };

  const handleFileUpload = async (uploadedFile: File | null) => {
    if (!uploadedFile) return;

    setFile(uploadedFile);

    try {
      const text = await uploadedFile.text();
      const grants = parseCSV(text);
      setParsedGrants(grants);
      setActiveStep(1);
      notifications.show({
        title: 'File parsed successfully',
        message: `Found ${grants.length} grants in your export`,
        color: 'green',
        icon: <IconCheck size={16} />,
      });
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

    let imported = 0;
    let failed = 0;

    for (let i = 0; i < selectedGrants.length; i++) {
      const grant = selectedGrants[i];

      try {
        const response = await fetch('/api/saved', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            org_id: currentOrg?.id,
            user_id: user?.id,
            external_source: 'granthub_import',
            external_id: `import_${Date.now()}_${i}`,
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
        }
      } catch (error) {
        failed++;
      }

      setImportProgress(((i + 1) / selectedGrants.length) * 100);
    }

    setImporting(false);
    setActiveStep(2);

    notifications.show({
      title: 'Import complete',
      message: `Successfully imported ${imported} grants${failed > 0 ? `, ${failed} failed` : ''}`,
      color: imported > 0 ? 'green' : 'red',
      icon: <IconCheck size={16} />,
    });
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
          <Stepper active={activeStep} breakpoint="sm">
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

            <Stepper.Step label="Review" description="Review and select grants">
              <Stack gap="md" mt="lg">
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
                          <Table.Td>{grant.agency}</Table.Td>
                          <Table.Td>{grant.closeDate}</Table.Td>
                          <Table.Td>
                            <Badge size="sm" variant="light">
                              {grant.status}
                            </Badge>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Paper>

                <Group justify="flex-end">
                  <Button variant="light" onClick={() => setActiveStep(0)}>
                    Back
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
                    <Text ta="center" c="dimmed">
                      Your grants have been successfully imported. You can now view and manage them
                      in your pipeline.
                    </Text>
                    <Group>
                      <Button component="a" href="/pipeline" variant="filled" rightSection={<IconArrowRight size={16} />}>
                        Go to Pipeline
                      </Button>
                      <Button component="a" href="/saved" variant="light">
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
