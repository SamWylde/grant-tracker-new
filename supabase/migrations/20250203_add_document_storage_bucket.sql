-- Supabase Storage Bucket Configuration for Grant Documents
--
-- This migration sets up the 'grant-documents' storage bucket
-- with proper RLS policies for secure document uploads

-- Create storage bucket for grant documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'grant-documents',
  'grant-documents',
  false, -- Private bucket
  104857600, -- 100MB max file size (can be overridden by plan limits)
  ARRAY[
    -- Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    -- Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    -- Archives
    'application/zip',
    'application/x-zip-compressed',
    'application/x-rar-compressed'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies

-- Policy: Users can upload files to their organization's folder
CREATE POLICY "Users can upload documents to their org folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'grant-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT o.id::text
    FROM public.organizations o
    INNER JOIN public.user_organizations uo ON uo.organization_id = o.id
    WHERE uo.user_id = auth.uid()
  )
);

-- Policy: Users can view files in their organization's folders
CREATE POLICY "Users can view documents from their org"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'grant-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT o.id::text
    FROM public.organizations o
    INNER JOIN public.user_organizations uo ON uo.organization_id = o.id
    WHERE uo.user_id = auth.uid()
  )
);

-- Policy: Users can update their own uploaded files or admins can update any
CREATE POLICY "Users can update their own documents or admins can update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'grant-documents'
  AND (
    -- User owns the file
    owner = auth.uid()
    OR
    -- User is admin/owner of the organization
    (storage.foldername(name))[1] IN (
      SELECT o.id::text
      FROM public.organizations o
      INNER JOIN public.user_organizations uo ON uo.organization_id = o.id
      WHERE uo.user_id = auth.uid()
        AND uo.role IN ('admin', 'owner')
    )
  )
);

-- Policy: Users can delete their own files or admins can delete any
CREATE POLICY "Users can delete their own documents or admins can delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'grant-documents'
  AND (
    -- User owns the file
    owner = auth.uid()
    OR
    -- User is admin/owner of the organization
    (storage.foldername(name))[1] IN (
      SELECT o.id::text
      FROM public.organizations o
      INNER JOIN public.user_organizations uo ON uo.organization_id = o.id
      WHERE uo.user_id = auth.uid()
        AND uo.role IN ('admin', 'owner')
    )
  )
);

-- Comments
COMMENT ON TABLE storage.buckets IS 'Storage buckets configuration - grant-documents bucket stores all grant-related files';
