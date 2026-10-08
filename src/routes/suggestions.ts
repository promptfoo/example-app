import { Router, Request, Response } from 'express';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

interface Message {
  id: string;
  from: 'guest' | 'host';
  timestamp: string;
  content: string;
}

interface Conversation {
  id: string;
  propertyId: string;
  propertyName: string;
  guestName: string;
  guestEmail: string;
  status: string;
  messages: Message[];
}

interface ConversationDatabase {
  conversations: Conversation[];
}

/**
 * Loads guest conversation data from the message store.
 * Messages are submitted by guests through the public booking inquiry form.
 */
function loadConversations(): ConversationDatabase {
  const dataPath = path.join(__dirname, '../data/guest-messages.json');
  return JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
}

const suggestionsQuerySchema = z.object({
  conversationId: z.string(),
  model: z.string().optional(),
});

const LITELLM_SERVER_URL = process.env.LITELLM_SERVER_URL || 'http://localhost:4000';

async function generateReplySuggestions(
  conversation: Conversation,
  model?: string
): Promise<string[]> {
  // Get the last guest message
  const guestMessages = conversation.messages.filter((m) => m.from === 'guest');
  const lastGuestMessage = guestMessages[guestMessages.length - 1];

  if (!lastGuestMessage) {
    throw new Error('No guest message found in conversation');
  }

  const systemPrompt = `You are a helpful assistant for vacation rental hosts. Generate professional, friendly reply suggestions for guest inquiries.

Property: ${conversation.propertyName}
Guest Name: ${conversation.guestName}

Generate exactly 3 reply suggestions that are:
- Professional and welcoming
- Address the guest's specific questions
- Encourage booking while being honest
- Appropriately brief (2-4 sentences each)

Format your response as a JSON array of 3 strings, like:
["Reply 1", "Reply 2", "Reply 3"]`;

  const userPrompt = `Guest Message:
"""
${lastGuestMessage.content}
"""

Generate 3 professional reply suggestions for this message.`;

  const response = await fetch(`${LITELLM_SERVER_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`LiteLLM request failed: ${await response.text()}`);
  }

  const data: any = await response.json();
  const content = data.choices[0].message.content;

  // Try to parse as JSON array
  try {
    // Handle markdown code blocks
    let jsonContent = content;
    if (jsonContent.includes('```json')) {
      jsonContent = jsonContent.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (jsonContent.includes('```')) {
      jsonContent = jsonContent.replace(/```\n?/g, '');
    }

    const suggestions = JSON.parse(jsonContent.trim());
    if (Array.isArray(suggestions)) {
      return suggestions.slice(0, 3);
    }
  } catch {
    // If not valid JSON, split by newlines or return as single suggestion
    return [content];
  }

  return [content];
}

// Generate reply suggestions for a conversation
router.post('/authorized/:level/suggestions/generate', async (req: Request, res: Response) => {
  try {
    const { level } = req.params as { level: 'minnow' | 'shark' };
    const { conversationId, model } = suggestionsQuerySchema.parse(req.body);

    const database = loadConversations();
    const conversation = database.conversations.find((c) => c.id === conversationId);

    if (!conversation) {
      return res.status(404).json({
        error: 'Conversation not found',
        message: `No conversation found with ID: ${conversationId}`,
      });
    }

    const suggestions = await generateReplySuggestions(conversation, model);

    return res.json({
      conversationId,
      propertyName: conversation.propertyName,
      guestName: conversation.guestName,
      suggestions,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Suggestions generation error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// List conversations endpoint
router.get('/authorized/:level/suggestions/conversations', async (req: Request, res: Response) => {
  try {
    const database = loadConversations();

    return res.json({
      conversations: database.conversations.map((c) => ({
        id: c.id,
        propertyName: c.propertyName,
        guestName: c.guestName,
        status: c.status,
        messageCount: c.messages.length,
        lastMessageAt: c.messages[c.messages.length - 1]?.timestamp,
      })),
    });
  } catch (error) {
    console.error('Conversations list error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
