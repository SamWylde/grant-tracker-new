import { useState } from 'react';
import { Stack, Select, Group, Text } from '@mantine/core';
import { StorageQuotaIndicator } from './StorageQuotaIndicator';
import { DocumentUploadButton } from './DocumentUploadButton';
import { DocumentList } from './DocumentList';

interface DocumentsTabProps {
  grantId: string;
  orgId: string;
  taskId?: string;
}

const DOCUMENT_CATEGORIES = [
  { value: 'all', label: 'All Documents' },
  { value: 'budget', label: 'Budget' },
  { value: 'narrative', label: 'Narrative' },
  { value: 'letters', label: 'Letters' },
  { value: 'financial', label: 'Financial' },
  { value: 'supporting', label: 'Supporting' },
  { value: 'other', label: 'Other' },
];

export function DocumentsTab({ grantId, orgId, taskId }: DocumentsTabProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUploadComplete = () => {
    // Trigger refresh of document list
    setRefreshKey(prev => prev + 1);
  };

  const handleDocumentDelete = () => {
    // Trigger refresh of document list
    setRefreshKey(prev => prev + 1);
  };

  return (
    <Stack gap="md">
      {/* Storage Quota Indicator */}
      <StorageQuotaIndicator orgId={orgId} compact />

      {/* Upload and Filter Controls */}
      <Group justify="space-between" align="center">
        <Group gap="sm">
          <Text size="sm" fw={500}>
            Documents
          </Text>
          <Select
            value={selectedCategory}
            onChange={(value) => setSelectedCategory(value || 'all')}
            data={DOCUMENT_CATEGORIES}
            size="xs"
            w={150}
            placeholder="Filter by category"
          />
        </Group>
        <DocumentUploadButton
          orgId={orgId}
          grantId={grantId}
          taskId={taskId}
          compact
          onUploadComplete={handleUploadComplete}
        />
      </Group>

      {/* Document List */}
      <DocumentList
        key={refreshKey}
        orgId={orgId}
        grantId={grantId}
        taskId={taskId}
        documentCategory={selectedCategory === 'all' ? undefined : selectedCategory}
        onDocumentDelete={handleDocumentDelete}
      />
    </Stack>
  );
}
