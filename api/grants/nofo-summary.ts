/**
 * NOFO PDF Summarizer API
 *
 * GET /api/grants/nofo-summary?grant_id=xxx or ?saved_grant_id=xxx
 *   - Retrieve existing AI summary for a grant
 *
 * POST /api/grants/nofo-summary
 *   - Generate new AI summary from PDF URL or text
 *   - Body: { grant_id?, saved_grant_id?, pdf_url?, pdf_text?, grant_title, org_id? }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { setCorsHeaders } from '../utils/cors.js';
import { withTimeout, TimeoutPresets, isTimeoutError } from '../utils/timeout.js';
import { createRequestLogger } from '../utils/logger';

// =====================================================
// TYPE DEFINITIONS
// =====================================================

interface NofoSummary {
  key_dates: {
    loi_deadline?: string;
    application_deadline?: string;
    award_date?: string;
    project_period_start?: string;
    project_period_end?: string;
  };
  eligibility: {
    organizations?: string[];
    geographic?: string[];
    restrictions?: string[];
  };
  focus_areas: string[];
  funding: {
    total?: number;
    max_award?: number;
    min_award?: number;
    expected_awards?: number;
  };
  priorities: string[];
  cost_sharing?: {
    required: boolean;
    percentage?: number;
    description?: string;
  };
  restrictions?: string[];
  key_requirements?: string[];
  application_process?: {
    submission_method?: string;
    required_documents?: string[];
    evaluation_criteria?: string[];
  };
  contact_info?: {
    program_officer?: string;
    email?: string;
    phone?: string;
  };
}

// =====================================================
// HELPER: Generate AI Summary
// =====================================================

async function generateAISummary(
  openai: OpenAI,
  pdfText: string,
  grantTitle: string
): Promise<{
  summary: NofoSummary;
  tokenCount: number;
  processingTimeMs: number;
  costUsd: number;
}> {
  const startTime = Date.now();

  // Wrap OpenAI call with timeout protection
  const response = await withTimeout(
    async () => openai.chat.completions.create({
      model: 'gpt-4o-mini', // Cost-effective model
      messages: [
        {
          role: 'system',
          content: `You are an expert grant analyst. Extract key information from NOFO (Notice of Funding Opportunity) documents.

Focus on:
- Letter of Intent (LOI) deadline (format as YYYY-MM-DD) - this often comes before the full application
- Application deadlines and key dates (format as YYYY-MM-DD)
- Eligibility requirements (organization types, geographic restrictions)
- Funding amounts (total program funding, min/max awards, expected # of awards)
- Program focus areas and priorities
- Cost sharing requirements (required: true/false, percentage if mentioned)
- Key restrictions and requirements
- Application process details
- Contact information

Return a structured JSON object with all available information. Use null for missing fields.`,
        },
        {
          role: 'user',
          content: `Extract key information from this NOFO for: ${grantTitle}

NOFO Text:
${pdfText.slice(0, 30000)}

Please extract all key dates, eligibility criteria, funding details, priorities, and requirements. Return valid JSON only.`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    }),
    {
      timeoutMs: TimeoutPresets.AI_OPERATION, // 45 seconds
      operation: 'OpenAI NOFO Summary',
      retry: true,
      maxRetries: 2,
      retryDelayMs: 2000,
    }
  );

  const processingTimeMs = Date.now() - startTime;
  const content = response.choices[0]?.message?.content;

  if (!content) {
    throw new Error('No response from OpenAI');
  }

  const summary: NofoSummary = JSON.parse(content);

  // Calculate cost (GPT-4o-mini: $0.15/1M input, $0.6/1M output)
  const inputTokens = response.usage?.prompt_tokens || 0;
  const outputTokens = response.usage?.completion_tokens || 0;
  const costUsd = (inputTokens * 0.00000015) + (outputTokens * 0.0000006);

  return {
    summary,
    tokenCount: response.usage?.total_tokens || 0,
    processingTimeMs,
    costUsd,
  };
}

// =====================================================
// HELPER: Extract Primary Deadline
// =====================================================

function extractPrimaryDeadline(summary: NofoSummary): Date | null {
  const deadline = summary.key_dates?.application_deadline;
  if (!deadline) return null;

  try {
    return new Date(deadline);
  } catch {
    return null;
  }
}

// =====================================================
// MAIN HANDLER
// =====================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const logger = createRequestLogger(req, { module: 'grants/nofo-summary' });

  // Set secure CORS headers based on whitelisted origins
  setCorsHeaders(res, req.headers.origin, { methods: 'GET, POST, OPTIONS' });

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Initialize Supabase client
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // =====================================================
  // GET: Retrieve existing summary
  // =====================================================
  if (req.method === 'GET') {
    try {
      const { grant_id, saved_grant_id } = req.query;

      if (!grant_id && !saved_grant_id) {
        return res.status(400).json({
          error: 'Either grant_id or saved_grant_id is required',
        });
      }

      // Query for existing summary
      let query = supabase
        .from('grant_ai_summaries')
        .select('*')
        .eq('status', 'completed')
        .order('generated_at', { ascending: false })
        .limit(1);

      if (grant_id) {
        query = query.eq('catalog_grant_id', grant_id);
      } else {
        query = query.eq('saved_grant_id', saved_grant_id);
      }

      const { data, error } = await query.single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No summary found
          return res.status(404).json({
            error: 'No AI summary found for this grant',
            has_summary: false,
          });
        }
        throw error;
      }

      return res.status(200).json({
        has_summary: true,
        summary: data.summary,
        primary_deadline: data.primary_deadline,
        cost_sharing_required: data.cost_sharing_required,
        total_program_funding: data.total_program_funding,
        max_award_amount: data.max_award_amount,
        min_award_amount: data.min_award_amount,
        expected_awards: data.expected_awards,
        generated_at: data.generated_at,
        provider: data.provider,
        model: data.model,
      });
    } catch (error) {
      logger.error('Failed to retrieve summary', error);
      return res.status(500).json({
        error: 'Failed to retrieve summary',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // =====================================================
  // POST: Generate new summary
  // =====================================================
  if (req.method === 'POST') {
    try {
      const {
        grant_id,
        saved_grant_id,
        pdf_url,
        pdf_text,
        grant_title,
        org_id,
      } = req.body || {};

      // Validation
      if (!grant_id && !saved_grant_id) {
        return res.status(400).json({
          error: 'Either grant_id or saved_grant_id is required',
        });
      }

      if (!pdf_text && !pdf_url) {
        return res.status(400).json({
          error: 'Either pdf_text or pdf_url is required',
        });
      }

      if (!grant_title) {
        return res.status(400).json({
          error: 'grant_title is required',
        });
      }

      // Get API key
      const openaiApiKey = process.env.OPEN_AI_API_KEY;
      if (!openaiApiKey) {
        return res.status(500).json({
          error: 'AI service not configured',
          details: 'OPEN_AI_API_KEY environment variable not set',
        });
      }

      // Initialize OpenAI client
      const openai = new OpenAI({ apiKey: openaiApiKey });

      // Get PDF text (if URL provided, would need to fetch and extract)
      let textToAnalyze = pdf_text;

      if (!textToAnalyze && pdf_url) {
        // For now, return error - PDF extraction would require additional library
        return res.status(400).json({
          error: 'PDF URL extraction not yet implemented',
          details: 'Please provide pdf_text directly for now',
        });
      }

      // Generate AI summary
      logger.info('Generating NOFO summary', { grantTitle: grant_title });

      const {
        summary,
        tokenCount,
        processingTimeMs,
        costUsd,
      } = await generateAISummary(openai, textToAnalyze, grant_title);

      // Extract key fields for database
      const primaryDeadline = extractPrimaryDeadline(summary);
      const loiDeadline = summary.key_dates?.loi_deadline ? new Date(summary.key_dates.loi_deadline) : null;
      const costSharingRequired = summary.cost_sharing?.required || false;
      const totalProgramFunding = summary.funding?.total || null;
      const maxAwardAmount = summary.funding?.max_award || null;
      const minAwardAmount = summary.funding?.min_award || null;
      const expectedAwards = summary.funding?.expected_awards || null;

      // Save to database
      const { data: savedSummary, error: dbError } = await supabase
        .from('grant_ai_summaries')
        .insert({
          catalog_grant_id: grant_id || null,
          saved_grant_id: saved_grant_id || null,
          org_id: org_id || null,
          provider: 'openai',
          model: 'gpt-4o-mini',
          summary: summary as any,
          primary_deadline: primaryDeadline?.toISOString().split('T')[0] || null,
          application_deadline: primaryDeadline?.toISOString().split('T')[0] || null,
          loi_deadline: loiDeadline?.toISOString().split('T')[0] || null,
          cost_sharing_required: costSharingRequired,
          total_program_funding: totalProgramFunding,
          max_award_amount: maxAwardAmount,
          min_award_amount: minAwardAmount,
          expected_awards: expectedAwards,
          source_url: pdf_url || null,
          processing_time_ms: processingTimeMs,
          token_count: tokenCount,
          cost_usd: costUsd,
          status: 'completed',
        })
        .select()
        .single();

      if (dbError) {
        logger.error('Database error saving summary', dbError);
        throw dbError;
      }

      logger.info('Summary generated successfully', {
        tokenCount,
        costUsd: costUsd.toFixed(4),
        processingTimeMs
      });

      return res.status(200).json({
        success: true,
        summary: summary,
        metadata: {
          id: savedSummary.id,
          provider: 'openai',
          model: 'gpt-4o-mini',
          token_count: tokenCount,
          processing_time_ms: processingTimeMs,
          cost_usd: costUsd,
          generated_at: savedSummary.generated_at,
        },
      });
    } catch (error) {
      logger.error('NOFO summary generation failed', error);

      // Save failed attempt to database if we have the required info
      const {
        grant_id,
        saved_grant_id,
        org_id,
      } = req.body || {};

      if (grant_id || saved_grant_id) {
        try {
          await supabase
            .from('grant_ai_summaries')
            .insert({
              catalog_grant_id: grant_id || null,
              saved_grant_id: saved_grant_id || null,
              org_id: org_id || null,
              provider: 'openai',
              model: 'gpt-4o-mini',
              summary: {} as any,
              status: 'failed',
              error_message: sanitizeError(error),
            })
            .select()
            .single();
        } catch (err) {
          logger.error('Failed to save error state', err);
        }
      }

      // Handle timeout errors specifically
      if (isTimeoutError(error)) {
        logger.error('NOFO summary request timed out');
        return res.status(408).json({
          error: 'Request timeout',
          message: 'AI summary generation timed out. Please try again.',
        });
      }

      return res.status(500).json({
        error: 'Failed to generate summary',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Method not allowed
  return res.status(405).json({ error: 'Method not allowed. Use GET or POST.' });
}
