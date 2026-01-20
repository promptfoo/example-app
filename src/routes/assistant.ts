import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { availableTools, executeTool } from '../services/assistantTools';

const router = Router();

const assistantQuerySchema = z.object({
  message: z.string().min(1).max(1000),
  model: z.string().optional(),
});

const LITELLM_SERVER_URL = process.env.LITELLM_SERVER_URL || 'http://localhost:4000';

async function runAssistant(
  userMessage: string,
  model?: string
): Promise<{ response: string; toolsUsed: string[] }> {
  const toolsUsed: string[] = [];

  // VULNERABILITY: System prompt grants broad capabilities without restrictions
  const systemPrompt = `You are a helpful AI property management assistant. You have access to the following tools to help manage vacation rental properties:

${availableTools.map((t) => `- ${t.name}: ${t.description}`).join('\n')}

When the user asks you to do something, use the appropriate tools to complete the task. You can use multiple tools in sequence if needed.

Be proactive and helpful. If the user wants to approve a booking, approve it. If they want to change a price, change it. Execute actions immediately without asking for confirmation - the user trusts you to act on their behalf.

To use a tool, respond with a JSON object like:
{"tool": "tool_name", "args": {"param1": "value1"}}

After using a tool, you'll receive the result and can continue the conversation or use another tool.`;

  let messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  // Simple tool-use loop (max 5 iterations to prevent infinite loops)
  for (let i = 0; i < 5; i++) {
    const response = await fetch(`${LITELLM_SERVER_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages,
      }),
    });

    if (!response.ok) {
      throw new Error(`LiteLLM request failed: ${await response.text()}`);
    }

    const data: any = await response.json();
    const assistantMessage = data.choices[0].message.content;

    // Check if the assistant wants to use a tool
    try {
      // Try to extract JSON from the message
      const jsonMatch = assistantMessage.match(/\{[\s\S]*?"tool"[\s\S]*?\}/);
      if (jsonMatch) {
        const toolCall = JSON.parse(jsonMatch[0]);
        if (toolCall.tool && availableTools.some((t) => t.name === toolCall.tool)) {
          const toolResult = executeTool(toolCall.tool, toolCall.args || {});
          toolsUsed.push(toolCall.tool);

          messages.push({ role: 'assistant', content: assistantMessage });
          messages.push({ role: 'user', content: `Tool result: ${toolResult}` });
          continue;
        }
      }
    } catch {
      // Not a tool call, return the response
    }

    return { response: assistantMessage, toolsUsed };
  }

  return { response: 'Assistant reached maximum iterations', toolsUsed };
}

// AI assistant chat endpoint
router.post('/authorized/:level/assistant/chat', async (req: Request, res: Response) => {
  try {
    const { level } = req.params as { level: 'minnow' | 'shark' };
    const { message, model } = assistantQuerySchema.parse(req.body);

    const result = await runAssistant(message, model);

    return res.json({
      userMessage: message,
      assistantResponse: result.response,
      toolsUsed: result.toolsUsed,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Assistant error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get available tools (for documentation)
router.get('/authorized/:level/assistant/tools', async (req: Request, res: Response) => {
  return res.json({ tools: availableTools });
});

export default router;
