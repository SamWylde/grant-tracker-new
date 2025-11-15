import { z } from 'zod';
import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Validation Schemas for Grant Tracker API
 *
 * This module contains Zod schemas for validating API inputs across all endpoints.
 * It provides centralized validation for:
 * - Grant-related operations
 * - Auth-related operations
 * - Team/user management
 * - Admin operations
 * - Comments and contacts
 */

// ============================================
// Common/Shared Schemas
// ============================================

export const uuidSchema = z.string().uuid({ message: 'Invalid UUID format' });

export const emailSchema = z.string().email({ message: 'Invalid email format' });

export const dateStringSchema = z.string().datetime({ message: 'Invalid date format' }).or(
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be in YYYY-MM-DD format' })
).or(
  z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, { message: 'Date must be in MM/DD/YYYY format' })
).optional().nullable();

export const paginationSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(20),
  offset: z.number().int().min(0).optional().default(0),
});

// ============================================
// Grant-related Schemas
// ============================================

export const grantSearchQuerySchema = z.object({
  keyword: z.string().max(500).optional(),
  fundingCategories: z.string().max(1000).optional(),
  agencies: z.string().max(1000).optional(),
  oppStatuses: z.string().max(100).optional(),
  aln: z.string().max(50).optional(),
  dueInDays: z.number().int().min(0).max(3650).optional(),
  sortBy: z.enum(['relevance', 'due_soon', 'newest']).optional(),
  rows: z.number().int().min(1).max(50).optional().default(15),
  startRecordNum: z.number().int().min(0).optional().default(0),
});

export const grantDetailsSchema = z.object({
  id: z.string().min(1, { message: 'Grant ID is required' }),
});

export const savedGrantCreateSchema = z.object({
  org_id: uuidSchema,
  user_id: uuidSchema,
  external_id: z.string().min(1, { message: 'External ID is required' }),
  title: z.string().min(1, { message: 'Title is required' }).max(500),
  agency: z.string().max(500).optional(),
  program: z.string().max(500).optional(),
  aln: z.string().max(50).optional(),
  open_date: dateStringSchema,
  close_date: dateStringSchema,
  loi_deadline: dateStringSchema,
  internal_deadline: dateStringSchema,
  description: z.string().max(50000).optional(),
  status: z.enum(['researching', 'planning', 'writing', 'submitted', 'awarded', 'rejected', 'withdrawn']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  assigned_to: uuidSchema.optional(),
});

export const savedGrantUpdateSchema = z.object({
  notes: z.string().max(10000).optional(),
  status: z.enum(['researching', 'planning', 'writing', 'submitted', 'awarded', 'rejected', 'withdrawn']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  assigned_to: uuidSchema.optional().nullable(),
  description: z.string().max(50000).optional(),
  title: z.string().min(1).max(500).optional(),
  agency: z.string().max(500).optional(),
  program: z.string().max(500).optional(),
  aln: z.string().max(50).optional(),
  open_date: dateStringSchema,
  close_date: dateStringSchema,
  loi_deadline: dateStringSchema,
  internal_deadline: dateStringSchema,
}).strict();

export const savedGrantQuerySchema = z.object({
  org_id: uuidSchema,
  format: z.enum(['json', 'csv']).optional(),
});

// ============================================
// Task-related Schemas
// ============================================

export const taskCreateSchema = z.object({
  grant_id: uuidSchema,
  org_id: uuidSchema,
  title: z.string().min(1, { message: 'Title is required' }).max(500),
  description: z.string().max(10000).optional(),
  task_type: z.string().max(100).optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'blocked']).optional(),
  assigned_to: uuidSchema.optional().nullable(),
  due_date: dateStringSchema,
  position: z.number().int().min(0).optional(),
  is_required: z.boolean().optional(),
  notes: z.string().max(10000).optional(),
  created_by: uuidSchema,
});

export const taskUpdateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).optional(),
  task_type: z.string().max(100).optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'blocked']).optional(),
  assigned_to: uuidSchema.optional().nullable(),
  due_date: dateStringSchema,
  position: z.number().int().min(0).optional(),
  is_required: z.boolean().optional(),
  notes: z.string().max(10000).optional(),
}).strict();

export const taskQuerySchema = z.object({
  grant_id: uuidSchema,
  org_id: uuidSchema.optional(),
});

// ============================================
// Comment-related Schemas
// ============================================

export const commentCreateSchema = z.object({
  grant_id: uuidSchema,
  content: z.string().min(1, { message: 'Content is required' }).max(10000, { message: 'Content must be 10000 characters or less' }),
  parent_comment_id: uuidSchema.optional().nullable(),
  mentioned_user_ids: z.array(uuidSchema).optional(),
});

export const commentUpdateSchema = z.object({
  content: z.string().min(1, { message: 'Content is required' }).max(10000, { message: 'Content must be 10000 characters or less' }),
});

export const commentQuerySchema = z.object({
  grant_id: uuidSchema,
});

// ============================================
// Contact-related Schemas
// ============================================

export const contactCreateSchema = z.object({
  org_id: uuidSchema,
  funder_id: uuidSchema,
  name: z.string().min(1, { message: 'Name is required' }).max(200),
  email: emailSchema.optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  title: z.string().max(200).optional().nullable(),
  notes: z.string().max(10000).optional().nullable(),
});

export const contactUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: emailSchema.optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  title: z.string().max(200).optional().nullable(),
  notes: z.string().max(10000).optional().nullable(),
  funder_id: uuidSchema.optional(),
}).strict();

export const contactQuerySchema = z.object({
  org_id: uuidSchema,
  funder_id: uuidSchema.optional(),
  id: uuidSchema.optional(),
});

// ============================================
// Auth-related Schemas
// ============================================

export const checkUserSchema = z.object({
  email: emailSchema,
});

// ============================================
// Validation Helper Functions
// ============================================

/**
 * Validation error response type
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Format Zod validation errors into user-friendly messages
 */
export function formatValidationErrors(error: z.ZodError): ValidationError[] {
  return error.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
  }));
}

/**
 * Validate request body with a Zod schema
 * Returns the validated data or sends a 400 error response
 *
 * @example
 * const result = await validateBody(req, res, grantSearchQuerySchema);
 * if (!result.success) return; // Error response already sent
 * const validData = result.data;
 */
export function validateBody<T>(
  req: VercelRequest,
  res: VercelResponse,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false } {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    const errors = formatValidationErrors(result.error);
    res.status(400).json({
      error: 'Validation failed',
      details: errors,
    });
    return { success: false };
  }

  return { success: true, data: result.data };
}

/**
 * Validate request query parameters with a Zod schema
 * Automatically converts string values to appropriate types
 *
 * @example
 * const result = await validateQuery(req, res, savedGrantQuerySchema);
 * if (!result.success) return; // Error response already sent
 * const validData = result.data;
 */
export function validateQuery<T>(
  req: VercelRequest,
  res: VercelResponse,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false } {
  // Convert query parameters to appropriate types
  const query = { ...req.query };

  // Convert numeric strings to numbers
  Object.keys(query).forEach((key) => {
    const value = query[key];
    if (typeof value === 'string') {
      // Try to convert to number if it looks like a number
      const num = Number(value);
      if (!isNaN(num) && value.trim() !== '') {
        query[key] = num;
      }
      // Convert 'true'/'false' strings to booleans
      if (value === 'true') query[key] = true;
      if (value === 'false') query[key] = false;
    }
  });

  const result = schema.safeParse(query);

  if (!result.success) {
    const errors = formatValidationErrors(result.error);
    res.status(400).json({
      error: 'Validation failed',
      details: errors,
    });
    return { success: false };
  }

  return { success: true, data: result.data };
}

/**
 * Validate request path/query ID parameter
 *
 * @example
 * const result = validateId(req, res);
 * if (!result.success) return; // Error response already sent
 * const id = result.data;
 */
export function validateId(
  req: VercelRequest,
  res: VercelResponse
): { success: true; data: string } | { success: false } {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    res.status(400).json({
      error: 'Validation failed',
      details: [{ field: 'id', message: 'ID is required' }],
    });
    return { success: false };
  }

  const result = uuidSchema.safeParse(id);

  if (!result.success) {
    const errors = formatValidationErrors(result.error);
    res.status(400).json({
      error: 'Validation failed',
      details: errors,
    });
    return { success: false };
  }

  return { success: true, data: result.data };
}

/**
 * Create a validation middleware for any schema
 *
 * @example
 * const validateGrantSearch = createValidationMiddleware(grantSearchQuerySchema, 'body');
 */
export function createValidationMiddleware<T>(
  schema: z.ZodSchema<T>,
  source: 'body' | 'query' = 'body'
) {
  return async (req: VercelRequest, res: VercelResponse): Promise<{ success: true; data: T } | { success: false }> => {
    if (source === 'body') {
      return validateBody(req, res, schema);
    } else {
      return validateQuery(req, res, schema);
    }
  };
}
