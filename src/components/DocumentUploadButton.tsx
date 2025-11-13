import { useRef, useState } from 'react';
import { Button, Group, Text, Progress, Stack, Alert } from '@mantine/core';
import { Dropzone, FileWithPath } from '@mantine/dropzone';
import { notifications } from '@mantine/notifications';
import { IconUpload, IconX, IconFile, IconAlertCircle } from '@tabler/icons-react';
import { useOrganization } from '../contexts/OrganizationContext';
import { supabase } from '../lib/supabase';

interface DocumentUploadButtonProps {
  grantId?: string;
  taskId?: string;
  documentCategory?: 'budget' | 'narrative' | 'letters' | 'financial' | 'supporting' | 'other';
  onUploadComplete?: (document: any) => void;
  compact?: boolean;
}

export function DocumentUploadButton({
  grantId,
  taskId,
  documentCategory,
  onUploadComplete,
  compact = false,
}: DocumentUploadButtonProps) {
  const { currentOrg } = useOrganization();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const openRef = useRef<() => void>(null);

  const handleDrop = async (files: FileWithPath[]) => {
    if (!currentOrg) {
      notifications.show({
        title: 'Error',
        message: 'No organization selected',
        color: 'red',
      });
      return;
    }

    setQuotaError(null);

    for (const file of files) {
      await uploadFile(file);
    }
  };

  const uploadFile = async (file: FileWithPath) => {
    if (!currentOrg) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      // Generate unique file path
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${currentOrg.id}/${fileName}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('grant-documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(uploadError.message);
      }

      setUploadProgress(50);

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Save document metadata via API
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          orgId: currentOrg.id,
          grantId,
          taskId,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          storageUrl: uploadData.path,
          documentCategory,
        }),
      });

      setUploadProgress(75);

      const result = await response.json();

      if (!response.ok) {
        // If quota exceeded, try to delete the uploaded file
        if (response.status === 413) {
          await supabase.storage
            .from('grant-documents')
            .remove([uploadData.path]);

          setQuotaError(result.details || 'Storage quota exceeded');
          throw new Error(result.error);
        }
        throw new Error(result.error);
      }

      setUploadProgress(100);

      notifications.show({
        title: 'Upload successful',
        message: `${file.name} has been uploaded`,
        color: 'green',
      });

      if (onUploadComplete) {
        onUploadComplete(result.document);
      }

    } catch (error) {
      console.error('Upload error:', error);
      notifications.show({
        title: 'Upload failed',
        message: error instanceof Error ? error.message : 'Failed to upload file',
        color: 'red',
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  if (compact) {
    return (
      <Button
        variant="light"
        size="sm"
        leftSection={<IconUpload size={16} />}
        onClick={() => openRef.current?.()}
        loading={uploading}
      >
        Upload
        <Dropzone
          openRef={openRef}
          onDrop={handleDrop}
          maxSize={100 * 1024 * 1024} // 100MB max
          accept={[
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'image/jpeg',
            'image/png',
            'text/plain',
          ]}
          styles={{ root: { display: 'none' } }}
        >
          <div />
        </Dropzone>
      </Button>
    );
  }

  return (
    <Stack gap="md">
      {quotaError && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" title="Storage Quota Exceeded">
          {quotaError}
          <Text size="sm" mt="xs">
            Please upgrade your plan or delete some files to free up space.
          </Text>
        </Alert>
      )}

      <Dropzone
        openRef={openRef}
        onDrop={handleDrop}
        loading={uploading}
        maxSize={100 * 1024 * 1024} // 100MB max
        accept={[
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'text/plain',
          'text/csv',
          'application/zip',
        ]}
      >
        <Group justify="center" gap="xl" style={{ minHeight: 120, pointerEvents: 'none' }}>
          <Dropzone.Accept>
            <IconUpload size={50} stroke={1.5} />
          </Dropzone.Accept>
          <Dropzone.Reject>
            <IconX size={50} stroke={1.5} />
          </Dropzone.Reject>
          <Dropzone.Idle>
            <IconFile size={50} stroke={1.5} />
          </Dropzone.Idle>

          <div>
            <Text size="xl" inline>
              Drag files here or click to select
            </Text>
            <Text size="sm" c="dimmed" inline mt={7}>
              Attach documents, images, or spreadsheets
            </Text>
          </div>
        </Group>
      </Dropzone>

      {uploading && (
        <Stack gap="xs">
          <Text size="sm" c="dimmed">
            Uploading... {uploadProgress}%
          </Text>
          <Progress value={uploadProgress} size="sm" />
        </Stack>
      )}
    </Stack>
  );
}
