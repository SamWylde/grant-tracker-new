/**
 * Pre-Flight Checklist API
 *
 * GET /api/preflight-checklist?grant_id=xxx
 *   - Retrieve checklist for a grant
 *
 * POST /api/preflight-checklist
 *   - Create a new checklist (with optional AI generation)
 *   - Body: { grant_id, org_id, generate_ai?: boolean }
 *
 * PATCH /api/preflight-checklist?id=xxx
 *   - Update checklist item completion status
 *   - Body: { item_id, completed, notes? }
 *
 * POST /api/preflight-checklist/generate
 *   - Generate AI checklist from NOFO summary
 *   - Body: { grant_id, org_id }
 *
 * POST /api/preflight-checklist/items
 *   - Add custom checklist item
 *   - Body: { checklist_id, title, description?, category, priority?, is_required? }
 *
 * DELETE /api/preflight-checklist/items?id=xxx
 *   - Delete a checklist item
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiApiKey = process.env.OPEN_AI_API_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
}

// =====================================================
// TYPE DEFINITIONS
// =====================================================

interface ChecklistItem {
  title: string;
  description: string;
  category: 'eligibility' | 'match_requirements' | 'required_attachments' | 'deadlines' | 'compliance' | 'budget' | 'custom';
  priority: 'low' | 'medium' | 'high' | 'critical';
  is_required: boolean;
  source_text?: string;
}

interface AIChecklistResponse {
  eligibility_items: ChecklistItem[];
  match_requirement_items: ChecklistItem[];
  attachment_items: ChecklistItem[];
  deadline_items: ChecklistItem[];
  compliance_items: ChecklistItem[];
  budget_items: ChecklistItem[];
  custom_items: ChecklistItem[];
}

// =====================================================
// HELPER: Generate AI Checklist from NOFO Summary
// =====================================================

async function generateAIChecklist(
  openai: OpenAI,
  nofoSummary: any,
  grantTitle: string
): Promise<{
  items: ChecklistItem[];
  processingTimeMs: number;
  tokenCount: number;
  costUsd: number;
}> {
  const startTime = Date.now();

  // Build a comprehensive prompt with NOFO summary data
  const summaryText = JSON.stringify(nofoSummary, null, 2);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are an expert grant consultant creating pre-flight checklists for grant applications.
Your task is to analyze NOFO summaries and generate comprehensive, actionable checklist items that help organizations prepare their applications.

Create checklist items in these categories:
1. ELIGIBILITY - Verify organization meets all eligibility requirements
2. MATCH_REQUIREMENTS - Document cost sharing/matching requirements
3. REQUIRED_ATTACHMENTS - List all required documents and attachments
4. DEADLINES - Track LOI deadline and application deadline
5. COMPLIANCE - Regulatory and compliance requirements
6. BUDGET - Budget preparation and financial requirements
7. CUSTOM - Any other important preparation items from the NOFO

For each item:
- Create clear, actionable titles (e.g., "Verify 501(c)(3) tax-exempt status")
- Include helpful descriptions with context from the NOFO
- Set appropriate priority (critical, high, medium, low)
- Mark as required if it's mandatory for the application
- Include source_text when referencing specific NOFO content

Return a JSON object with arrays for each category.`,
      },
      {
        role: 'user',
        content: `Generate a comprehensive pre-flight checklist for this grant application: "${grantTitle}"

NOFO Summary:
${summaryText}

Return valid JSON with this structure:
{
  "eligibility_items": [{"title": "...", "description": "...", "category": "eligibility", "priority": "high", "is_required": true, "source_text": "..."}],
  "match_requirement_items": [...],
  "attachment_items": [...],
  "deadline_items": [...],
  "compliance_items": [...],
  "budget_items": [...],
  "custom_items": [...]
}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.4,
  });

  const processingTimeMs = Date.now() - startTime;
  const content = response.choices[0]?.message?.content;

  if (!content) {
    throw new Error('No response from OpenAI');
  }

  const aiResponse: AIChecklistResponse = JSON.parse(content);

  // Flatten all items into a single array
  const allItems: ChecklistItem[] = [
    ...(aiResponse.eligibility_items || []),
    ...(aiResponse.match_requirement_items || []),
    ...(aiResponse.attachment_items || []),
    ...(aiResponse.deadline_items || []),
    ...(aiResponse.compliance_items || []),
    ...(aiResponse.budget_items || []),
    ...(aiResponse.custom_items || []),
  ];

  // Calculate cost (GPT-4o-mini: $0.15/1M input, $0.6/1M output)
  const inputTokens = response.usage?.prompt_tokens || 0;
  const outputTokens = response.usage?.completion_tokens || 0;
  const costUsd = (inputTokens * 0.00000015) + (outputTokens * 0.0000006);

  return {
    items: allItems,
    tokenCount: response.usage?.total_tokens || 0,
    processingTimeMs,
    costUsd,
  };
}

// =====================================================
// MAIN HANDLER
// =====================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Initialize Supabase client
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Verify authentication
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.substring(7);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // =====================================================
    // GET: Retrieve checklist for a grant
    // =====================================================
    if (req.method === 'GET') {
      const { grant_id } = req.query;

      if (!grant_id || typeof grant_id !== 'string') {
        return res.status(400).json({ error: 'grant_id is required' });
      }

      // Get the checklist
      const { data: checklist, error: checklistError } = await supabase
        .from('grant_preflight_checklists')
        .select('*')
        .eq('grant_id', grant_id)
        .single();

      if (checklistError) {
        if (checklistError.code === 'PGRST116') {
          return res.status(404).json({
            error: 'No checklist found for this grant',
            has_checklist: false,
          });
        }
        throw checklistError;
      }

      // Get checklist items
      const { data: items, error: itemsError } = await supabase
        .from('preflight_checklist_items')
        .select('*')
        .eq('checklist_id', checklist.id)
        .order('position', { ascending: true });

      if (itemsError) throw itemsError;

      // Get completion statistics
      const { data: stats } = await supabase.rpc('get_checklist_stats', {
        p_checklist_id: checklist.id,
      });

      return res.status(200).json({
        has_checklist: true,
        checklist,
        items: items || [],
        stats: stats?.[0] || null,
      });
    }

    // =====================================================
    // POST: Create new checklist or generate AI checklist
    // =====================================================
    if (req.method === 'POST' && req.url?.includes('/generate')) {
      const { grant_id, org_id } = req.body || {};

      if (!grant_id || !org_id) {
        return res.status(400).json({ error: 'grant_id and org_id are required' });
      }

      // Check if checklist already exists
      const { data: existingChecklist } = await supabase
        .from('grant_preflight_checklists')
        .select('id')
        .eq('grant_id', grant_id)
        .single();

      if (existingChecklist) {
        return res.status(409).json({
          error: 'Checklist already exists for this grant',
          checklist_id: existingChecklist.id,
        });
      }

      // Get AI summary for this grant
      const { data: aiSummary, error: summaryError } = await supabase
        .from('grant_ai_summaries')
        .select('*')
        .eq('saved_grant_id', grant_id)
        .eq('status', 'completed')
        .order('generated_at', { ascending: false })
        .limit(1)
        .single();

      if (summaryError || !aiSummary) {
        return res.status(404).json({
          error: 'No AI summary found for this grant. Generate NOFO summary first.',
        });
      }

      // Get grant details for title
      const { data: grant } = await supabase
        .from('org_grants_saved')
        .select('title')
        .eq('id', grant_id)
        .single();

      if (!openaiApiKey) {
        return res.status(500).json({
          error: 'AI service not configured',
          details: 'OPEN_AI_API_KEY environment variable not set',
        });
      }

      // Create checklist record (set to generating)
      const { data: newChecklist, error: createError } = await supabase
        .from('grant_preflight_checklists')
        .insert({
          grant_id,
          org_id,
          ai_generated: true,
          ai_summary_id: aiSummary.id,
          generation_status: 'generating',
        })
        .select()
        .single();

      if (createError) throw createError;

      try {
        // Generate AI checklist
        const openai = new OpenAI({ apiKey: openaiApiKey });
        const { items, tokenCount, processingTimeMs, costUsd } = await generateAIChecklist(
          openai,
          aiSummary.summary,
          grant?.title || 'Grant Application'
        );

        // Insert checklist items
        const itemsToInsert = items.map((item, index) => ({
          checklist_id: newChecklist.id,
          title: item.title,
          description: item.description,
          category: item.category,
          priority: item.priority,
          is_required: item.is_required,
          source_text: item.source_text || null,
          ai_generated: true,
          confidence_score: 0.85, // Default confidence for GPT-4o-mini
          position: index + 1,
        }));

        const { error: itemsError } = await supabase
          .from('preflight_checklist_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;

        // Update checklist to completed
        await supabase
          .from('grant_preflight_checklists')
          .update({
            generation_status: 'completed',
            generated_at: new Date().toISOString(),
          })
          .eq('id', newChecklist.id);

        console.log(`[Pre-Flight Checklist] Generated ${items.length} items (${tokenCount} tokens, $${costUsd.toFixed(4)})`);

        return res.status(200).json({
          success: true,
          checklist_id: newChecklist.id,
          items_generated: items.length,
          metadata: {
            token_count: tokenCount,
            processing_time_ms: processingTimeMs,
            cost_usd: costUsd,
          },
        });
      } catch (error) {
        // Update checklist to failed
        await supabase
          .from('grant_preflight_checklists')
          .update({
            generation_status: 'failed',
            generation_error: error instanceof Error ? error.message : 'Unknown error',
          })
          .eq('id', newChecklist.id);

        throw error;
      }
    }

    // =====================================================
    // POST: Add custom checklist item
    // =====================================================
    if (req.method === 'POST' && req.url?.includes('/items')) {
      const { checklist_id, title, description, category, priority, is_required } = req.body || {};

      if (!checklist_id || !title || !category) {
        return res.status(400).json({ error: 'checklist_id, title, and category are required' });
      }

      // Get current max position
      const { data: maxPositionData } = await supabase
        .from('preflight_checklist_items')
        .select('position')
        .eq('checklist_id', checklist_id)
        .order('position', { ascending: false })
        .limit(1)
        .single();

      const nextPosition = (maxPositionData?.position || 0) + 1;

      const { data: newItem, error: insertError } = await supabase
        .from('preflight_checklist_items')
        .insert({
          checklist_id,
          title,
          description: description || null,
          category,
          priority: priority || 'medium',
          is_required: is_required !== undefined ? is_required : true,
          position: nextPosition,
          ai_generated: false,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      return res.status(201).json({ item: newItem });
    }

    // =====================================================
    // PATCH: Update checklist item (typically completion status)
    // =====================================================
    if (req.method === 'PATCH') {
      const { id } = req.query;
      const { completed, notes, title, description, priority } = req.body || {};

      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'id is required' });
      }

      const updates: any = {};
      if (completed !== undefined) updates.completed = completed;
      if (notes !== undefined) updates.notes = notes;
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (priority !== undefined) updates.priority = priority;

      const { data: updatedItem, error: updateError } = await supabase
        .from('preflight_checklist_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;

      return res.status(200).json({ item: updatedItem });
    }

    // =====================================================
    // DELETE: Delete checklist item
    // =====================================================
    if (req.method === 'DELETE' && req.url?.includes('/items')) {
      const { id } = req.query;

      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'id is required' });
      }

      const { error: deleteError } = await supabase
        .from('preflight_checklist_items')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      return res.status(200).json({ message: 'Item deleted successfully' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[Pre-Flight Checklist] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
