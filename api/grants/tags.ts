/**
 * Smart Grant Tagging API
 *
 * POST /api/grants/tags
 *   - Generate AI tags for a grant
 *   - Body: { grant_id: string, title: string, description: string, agency: string }
 *
 * GET /api/grants/tags?grant_id=xxx
 *   - Get existing tags for a grant
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

/**
 * Normalize tag name to slug format
 */
function normalizeTagSlug(tagName: string): string {
  return tagName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Generate tags using OpenAI
 */
async function generateTags(
  openai: OpenAI,
  grantText: string
): Promise<Array<{ tag: string; confidence: number; category: string }>> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a grant categorization expert. Generate 5-8 relevant tags for grants.

Tag categories:
- focus_area: education, healthcare, environment, technology, arts-culture, community-development, research
- eligibility: nonprofits, small-business, universities, state-local-gov, tribal-gov
- funding_type: capacity-building, program-support, capital-projects, research, equipment
- geographic: rural, urban, regional, national, international

Return JSON array with objects: { "tag": "tag-name", "confidence": 0.85, "category": "focus_area" }
Confidence should be 0.0 to 1.0.`,
      },
      {
        role: 'user',
        content: `Generate relevant tags for this grant:

${grantText.slice(0, 5000)}

Return JSON array only.`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.5,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  const result = JSON.parse(content);
  return result.tags || [];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // =====================================================
  // GET: Retrieve existing tags for a grant
  // =====================================================
  if (req.method === 'GET') {
    try {
      const { grant_id } = req.query;

      if (!grant_id) {
        return res.status(400).json({ error: 'grant_id is required' });
      }

      // Get tag assignments for this grant
      const { data: assignments, error: assignmentsError } = await supabase
        .from('grant_tag_assignments')
        .select(`
          *,
          grant_tags:tag_id (
            id,
            tag_name,
            tag_slug,
            tag_category,
            color
          )
        `)
        .eq('grant_id', grant_id);

      if (assignmentsError) throw assignmentsError;

      const tags = assignments?.map((a: any) => ({
        tag_id: a.tag_id,
        tag_name: a.grant_tags.tag_name,
        tag_slug: a.grant_tags.tag_slug,
        tag_category: a.grant_tags.tag_category,
        color: a.grant_tags.color,
        ai_assigned: a.ai_assigned,
        confidence_score: a.confidence_score,
        assigned_at: a.assigned_at,
      })) || [];

      return res.status(200).json({
        grant_id,
        tags,
        count: tags.length,
      });
    } catch (error) {
      console.error('[Tags GET] Error:', error);
      return res.status(500).json({
        error: 'Failed to retrieve tags',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // =====================================================
  // POST: Generate and assign tags to a grant
  // =====================================================
  if (req.method === 'POST') {
    try {
      const {
        grant_id,
        title,
        description,
        agency,
        auto_assign = true,
      } = req.body || {};

      if (!grant_id) {
        return res.status(400).json({ error: 'grant_id is required' });
      }

      if (!title && !description) {
        return res.status(400).json({
          error: 'At least title or description is required',
        });
      }

      // Get OpenAI API key
      const openaiApiKey = process.env.OPEN_AI_API_KEY;
      if (!openaiApiKey) {
        return res.status(500).json({
          error: 'AI service not configured',
          details: 'OPEN_AI_API_KEY environment variable not set',
        });
      }

      const openai = new OpenAI({ apiKey: openaiApiKey });

      // Combine grant text for analysis
      const grantText = `
Title: ${title || 'N/A'}
Agency: ${agency || 'N/A'}
Description: ${description || 'N/A'}
      `.trim();

      console.log(`[Tags] Generating tags for grant: ${grant_id}`);

      // Generate tags using AI
      const generatedTags = await generateTags(openai, grantText);

      console.log(`[Tags] Generated ${generatedTags.length} tags`);

      // Create or find tags in database
      const assignedTags: any[] = [];

      for (const tagData of generatedTags) {
        const tagSlug = normalizeTagSlug(tagData.tag);
        const tagName = tagData.tag
          .split('-')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');

        // Check if tag exists
        let { data: existingTag } = await supabase
          .from('grant_tags')
          .select('*')
          .eq('tag_slug', tagSlug)
          .single();

        // Create tag if doesn't exist
        if (!existingTag) {
          const { data: newTag, error: tagError } = await supabase
            .from('grant_tags')
            .insert({
              tag_name: tagName,
              tag_slug: tagSlug,
              tag_category: tagData.category,
              ai_generated: true,
              confidence_score: tagData.confidence,
              color: getCategoryColor(tagData.category),
            })
            .select()
            .single();

          if (tagError) {
            console.error(`[Tags] Failed to create tag "${tagName}":`, tagError);
            continue;
          }

          existingTag = newTag;
        }

        // Assign tag to grant (if auto_assign is true)
        if (auto_assign && existingTag) {
          const { error: assignError } = await supabase
            .from('grant_tag_assignments')
            .upsert({
              grant_id,
              tag_id: existingTag.id,
              ai_assigned: true,
              confidence_score: tagData.confidence,
            })
            .match({ grant_id, tag_id: existingTag.id });

          if (!assignError) {
            assignedTags.push({
              tag_id: existingTag.id,
              tag_name: existingTag.tag_name,
              tag_slug: existingTag.tag_slug,
              tag_category: existingTag.tag_category,
              confidence: tagData.confidence,
            });
          } else {
            console.error(`[Tags] Failed to assign tag "${tagName}":`, assignError);
          }
        }
      }

      return res.status(200).json({
        success: true,
        grant_id,
        tags: assignedTags,
        count: assignedTags.length,
      });
    } catch (error) {
      console.error('[Tags POST] Error:', error);
      return res.status(500).json({
        error: 'Failed to generate tags',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed. Use GET or POST.' });
}

/**
 * Get color for tag category
 */
function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    focus_area: '#7C3AED', // violet
    eligibility: '#14B8A6', // teal
    funding_type: '#F59E0B', // amber
    geographic: '#06B6D4', // cyan
    custom: '#6B7280', // gray
  };

  return colors[category] || colors.custom;
}
