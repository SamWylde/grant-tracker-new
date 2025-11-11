/**
 * AI Service - Provider abstraction for AI features
 *
 * Supports multiple AI providers (OpenAI, Claude, local models)
 * Used for NOFO summarization, recommendations, tagging, and scoring
 */

import OpenAI from 'openai';

// =====================================================
// TYPE DEFINITIONS
// =====================================================

/**
 * NOFO Summary structure returned by AI
 */
export interface NofoSummary {
  key_dates: {
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

/**
 * AI provider configuration
 */
export interface AIProviderConfig {
  provider: 'openai' | 'claude' | 'local';
  apiKey?: string;
  model?: string;
  baseURL?: string;
}

/**
 * AI operation result with metadata
 */
export interface AIOperationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    provider: string;
    model: string;
    tokenCount?: number;
    processingTimeMs?: number;
    costUsd?: number;
  };
}

// =====================================================
// AI PROVIDER ABSTRACT CLASS
// =====================================================

abstract class AIProvider {
  protected config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  abstract summarizeNofo(pdfText: string, grantTitle: string): Promise<AIOperationResult<NofoSummary>>;

  abstract generateTags(grantText: string): Promise<AIOperationResult<string[]>>;

  abstract categorizeGrant(
    title: string,
    description: string,
    agency: string
  ): Promise<AIOperationResult<{ category: string; confidence: number }>>;
}

// =====================================================
// OPENAI PROVIDER IMPLEMENTATION
// =====================================================

class OpenAIProvider extends AIProvider {
  private client: OpenAI;
  private model: string;

  constructor(config: AIProviderConfig) {
    super(config);

    if (!config.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.client = new OpenAI({
      apiKey: config.apiKey,
      dangerouslyAllowBrowser: true, // For client-side usage
    });

    this.model = config.model || 'gpt-4o-mini'; // Cost-effective default
  }

  /**
   * Summarize NOFO PDF using OpenAI structured outputs
   */
  async summarizeNofo(pdfText: string, grantTitle: string): Promise<AIOperationResult<NofoSummary>> {
    const startTime = Date.now();

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are an expert grant analyst. Extract key information from NOFO (Notice of Funding Opportunity) documents.

Focus on:
- Application deadlines and key dates
- Eligibility requirements (organization types, geographic restrictions)
- Funding amounts (total, min/max awards, expected # of awards)
- Program focus areas and priorities
- Cost sharing requirements
- Key restrictions and requirements
- Application process details

Return a structured JSON summary with all available information.`,
          },
          {
            role: 'user',
            content: `Extract key information from this NOFO for: ${grantTitle}

NOFO Text:
${pdfText.slice(0, 30000)} // Limit to ~30k chars to manage token costs

Please extract all key dates, eligibility criteria, funding details, priorities, and requirements.`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3, // Lower temperature for factual extraction
      });

      const processingTimeMs = Date.now() - startTime;
      const content = response.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const summary: NofoSummary = JSON.parse(content);

      // Calculate approximate cost (GPT-4o-mini pricing: $0.15/1M input, $0.6/1M output)
      const inputTokens = response.usage?.prompt_tokens || 0;
      const outputTokens = response.usage?.completion_tokens || 0;
      const costUsd = (inputTokens * 0.00000015) + (outputTokens * 0.0000006);

      return {
        success: true,
        data: summary,
        metadata: {
          provider: 'openai',
          model: this.model,
          tokenCount: response.usage?.total_tokens,
          processingTimeMs,
          costUsd,
        },
      };
    } catch (error) {
      console.error('[AI Service] NOFO summarization failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          provider: 'openai',
          model: this.model,
          processingTimeMs: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Generate smart tags for a grant using OpenAI
   */
  async generateTags(grantText: string): Promise<AIOperationResult<string[]>> {
    const startTime = Date.now();

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are a grant categorization expert. Generate relevant tags for grants based on their content.

Tag categories:
- Focus areas: education, healthcare, environment, technology, arts-culture, etc.
- Eligibility: nonprofits, small-business, universities, state-local-gov
- Funding type: capacity-building, program-support, capital-projects, research
- Geographic: rural, urban, regional, national

Return 5-8 most relevant tags as a JSON array.`,
          },
          {
            role: 'user',
            content: `Generate relevant tags for this grant:

${grantText.slice(0, 5000)}

Return only a JSON array of tag strings.`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.5,
      });

      const processingTimeMs = Date.now() - startTime;
      const content = response.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const result = JSON.parse(content);
      const tags = result.tags || result;

      return {
        success: true,
        data: Array.isArray(tags) ? tags : Object.values(tags),
        metadata: {
          provider: 'openai',
          model: this.model,
          tokenCount: response.usage?.total_tokens,
          processingTimeMs,
        },
      };
    } catch (error) {
      console.error('[AI Service] Tag generation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          provider: 'openai',
          model: this.model,
          processingTimeMs: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Categorize grant into primary category
   */
  async categorizeGrant(
    title: string,
    description: string,
    agency: string
  ): Promise<AIOperationResult<{ category: string; confidence: number }>> {
    const startTime = Date.now();

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are a grant categorization expert. Categorize grants into one primary category.

Categories:
- Education
- Healthcare
- Environment
- Technology
- Community Development
- Arts & Culture
- Research
- Infrastructure
- Public Safety
- Economic Development

Return category name and confidence score (0-1) as JSON.`,
          },
          {
            role: 'user',
            content: `Categorize this grant:

Title: ${title}
Agency: ${agency}
Description: ${description.slice(0, 1000)}

Return JSON: {"category": "Category Name", "confidence": 0.95}`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const processingTimeMs = Date.now() - startTime;
      const content = response.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const result = JSON.parse(content);

      return {
        success: true,
        data: {
          category: result.category,
          confidence: result.confidence,
        },
        metadata: {
          provider: 'openai',
          model: this.model,
          tokenCount: response.usage?.total_tokens,
          processingTimeMs,
        },
      };
    } catch (error) {
      console.error('[AI Service] Categorization failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          provider: 'openai',
          model: this.model,
          processingTimeMs: Date.now() - startTime,
        },
      };
    }
  }
}

// =====================================================
// AI SERVICE FACTORY
// =====================================================

/**
 * Create AI provider based on configuration
 */
export function createAIProvider(config: AIProviderConfig): AIProvider {
  switch (config.provider) {
    case 'openai':
      return new OpenAIProvider(config);

    case 'claude':
      throw new Error('Claude provider not yet implemented');

    case 'local':
      throw new Error('Local model provider not yet implemented');

    default:
      throw new Error(`Unknown AI provider: ${config.provider}`);
  }
}

/**
 * Get default AI provider from environment
 */
export function getDefaultAIProvider(): AIProvider {
  const apiKey = import.meta.env.VITE_OPEN_AI_API_KEY;

  if (!apiKey) {
    throw new Error('VITE_OPEN_AI_API_KEY environment variable not set');
  }

  return createAIProvider({
    provider: 'openai',
    apiKey,
    model: 'gpt-4o-mini', // Cost-effective default
  });
}

// =====================================================
// CONVENIENCE FUNCTIONS
// =====================================================

/**
 * Summarize NOFO using default provider
 */
export async function summarizeNofo(
  pdfText: string,
  grantTitle: string
): Promise<AIOperationResult<NofoSummary>> {
  const provider = getDefaultAIProvider();
  return provider.summarizeNofo(pdfText, grantTitle);
}

/**
 * Generate tags using default provider
 */
export async function generateGrantTags(grantText: string): Promise<AIOperationResult<string[]>> {
  const provider = getDefaultAIProvider();
  return provider.generateTags(grantText);
}

/**
 * Categorize grant using default provider
 */
export async function categorizeGrant(
  title: string,
  description: string,
  agency: string
): Promise<AIOperationResult<{ category: string; confidence: number }>> {
  const provider = getDefaultAIProvider();
  return provider.categorizeGrant(title, description, agency);
}
