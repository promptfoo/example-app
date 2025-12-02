import { Request, Response } from 'express';
import { z } from 'zod';
import { getSystemPrompt } from '../domains';
import { getAllowedModels, isModelAllowed } from '../utils/litellm-config';

const LITELLM_SERVER_URL = process.env.LITELLM_SERVER_URL || 'http://localhost:4000';

// Get allowed models from LiteLLM config
const allowedModels = getAllowedModels();

// Map fish names to internal security levels
const FISH_TO_LEVEL: Record<string, 'insecure' | 'secure'> = {
  minnow: 'insecure',
  shark: 'secure',
};

// Zod schema for path parameters (security level)
const levelPathSchema = z.object({
  level: z.enum(['minnow', 'shark']),
});

// Zod schema for query parameters
const chatQuerySchema = z.object({
  model: z.string().optional().refine(
    (val) => {
      // If no model specified, allow it (LiteLLM will use default)
      if (!val) return true;
      // If no allowed models configured, allow any model (fail open)
      if (allowedModels.length === 0) return true;
      // Otherwise, check if model is in allowed list
      return isModelAllowed(val);
    },
    {
      message: `Model must be one of the allowed models: ${allowedModels.join(', ')}`,
    }
  ),
  domain: z.enum(['general', 'finance', 'medicine', 'vacation-rental', 'taxes']).default('general'),
}).strict();

// Helper function to normalize messages input
function normalizeMessages(input: unknown): Array<{ role: string; content: string }> {
  // If it's already an array, return it
  if (Array.isArray(input)) {
    return input;
  }
  
  // If it's a string, try to parse as JSON first
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      // If parsed to a single object, wrap it in an array
      if (parsed && typeof parsed === 'object') {
        return [parsed];
      }
      // If parsed but not an array or object, treat original string as single message
      return [{ role: 'user', content: input }];
    } catch {
      // If JSON parse fails, treat as single message string
      return [{ role: 'user', content: input }];
    }
  }
  
  // Fallback: wrap in array
  return [{ role: 'user', content: String(input) }];
}

// Zod schema for request body - messages can be string, array, or JSON string
const chatBodySchema = z.object({
  messages: z.preprocess(
    normalizeMessages,
    z.array(z.object({
      role: z.string(),
      content: z.string(),
    })).min(1)
  ),
});

export async function chatHandler(req: Request, res: Response): Promise<void> {
  try {
    // Parse and validate path parameters (security level)
    const pathParseResult = levelPathSchema.safeParse(req.params);
    
    if (!pathParseResult.success) {
      res.status(400).json({
        error: 'Invalid path parameter',
        message: `Security level must be 'minnow' or 'shark'. ${pathParseResult.error.errors.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', ')}`
      });
      return;
    }

    // Map fish name to internal security level
    const fishLevel = pathParseResult.data.level;
    const level = FISH_TO_LEVEL[fishLevel];

    // Parse and validate query parameters
    const queryParseResult = chatQuerySchema.safeParse(req.query);
    
    if (!queryParseResult.success) {
      res.status(400).json({
        error: 'Invalid query parameters',
        message: queryParseResult.error.errors.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', ')
      });
      return;
    }

    const { model, domain } = queryParseResult.data;

    // Parse and validate request body
    const bodyParseResult = chatBodySchema.safeParse(req.body);
    
    if (!bodyParseResult.success) {
      res.status(400).json({
        error: 'Invalid request body',
        message: bodyParseResult.error.errors.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', ') || 'Request body must contain "messages" field (string, array, or JSON string representing an array)'
      });
      return;
    }

    const { messages: userMessages } = bodyParseResult.data;

    // Get system prompt based on domain and level
    const systemPrompt = getSystemPrompt(domain, level);

    // Prepare messages array with system message first, then user messages
    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...userMessages
    ];

    // Prepare LiteLLM request with default model
    const litellmRequest: any = {
      messages: messages,
      model: model || 'gpt-5-mini', // Default to gpt-5-mini if not specified
    };

    // Forward request to LiteLLM server
    const response = await fetch(`${LITELLM_SERVER_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(litellmRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      res.status(response.status).json({
        error: 'LiteLLM server error',
        message: errorText
      });
      return;
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error in chat handler:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

