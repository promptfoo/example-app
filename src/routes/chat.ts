import { Request, Response } from 'express';
import { z } from 'zod';
import { getSystemPrompt } from '../domains';

const LITELLM_SERVER_URL = process.env.LITELLM_SERVER_URL || 'http://localhost:4000';

// Tool definitions for AI function calling
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_user',
      description: 'Get information about the current authenticated user including their ID, role, and token details',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  }
];

// Execute tool calls and return results
function executeToolCall(toolName: string, args: any, req: Request): string {
  switch (toolName) {
    case 'get_user':
      if (req.user) {
        return JSON.stringify({
          userId: req.user.sub,
          role: req.user.role || 'unknown',
          issuer: req.user.iss,
          audience: req.user.aud,
          issuedAt: req.user.iat ? new Date(req.user.iat * 1000).toISOString() : null,
          expiresAt: req.user.exp ? new Date(req.user.exp * 1000).toISOString() : null,
          scope: req.user.scope || null
        });
      } else {
        return JSON.stringify({
          error: 'No authenticated user',
          message: 'This endpoint requires authentication to retrieve user information'
        });
      }
    default:
      return JSON.stringify({
        error: 'Unknown tool',
        message: `Tool '${toolName}' is not available`
      });
  }
}

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
  model: z.string().optional(),
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

    // Prepare LiteLLM request
    const litellmRequest: any = {
      messages: messages,
      tools: TOOLS,
      tool_choice: 'auto'
    };

    // Add model if provided
    if (model) {
      litellmRequest.model = model;
    }

    // Tool call loop - continue until we get a final response
    const MAX_TOOL_ITERATIONS = 10;
    let iteration = 0;

    while (iteration < MAX_TOOL_ITERATIONS) {
      iteration++;

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
      const assistantMessage = data.choices?.[0]?.message;

      // Check if the model wants to call tools
      if (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0) {
        // Add the assistant's message with tool calls to the conversation
        litellmRequest.messages.push({
          role: 'assistant',
          content: assistantMessage.content || null,
          tool_calls: assistantMessage.tool_calls
        });

        // Execute each tool call and add results
        for (const toolCall of assistantMessage.tool_calls) {
          const toolName = toolCall.function.name;
          let toolArgs = {};

          try {
            toolArgs = JSON.parse(toolCall.function.arguments || '{}');
          } catch {
            // If parsing fails, use empty args
          }

          const toolResult = executeToolCall(toolName, toolArgs, req);

          // Add tool result to messages
          litellmRequest.messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: toolResult
          });
        }

        // Continue the loop to get the model's response to tool results
        continue;
      }

      // No tool calls - return the final response
      res.json(data);
      return;
    }

    // If we hit max iterations, return an error
    res.status(500).json({
      error: 'Tool call limit exceeded',
      message: `Maximum tool call iterations (${MAX_TOOL_ITERATIONS}) reached`
    });
  } catch (error) {
    console.error('Error in chat handler:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

