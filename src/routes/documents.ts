import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  loadDocument,
  saveDocument,
  listDocuments,
  initializeSampleDocuments,
} from '../services/documentProcessor';

const router = Router();

// Initialize sample documents on module load
initializeSampleDocuments();

const generateListingSchema = z.object({
  documentId: z.string(),
  propertyName: z.string(),
  sendToEmail: z.string().email().optional(),
  model: z.string().optional(),
});

const uploadDocumentSchema = z.object({
  filename: z.string(),
  content: z.string(),
});

const LITELLM_SERVER_URL = process.env.LITELLM_SERVER_URL || 'http://localhost:4000';

// Simulated email sending (logs to console for demonstration)
function sendEmail(to: string, subject: string, body: string): void {
  console.log('\n' + '='.repeat(60));
  console.log('[EMAIL SENT]');
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log('Body:');
  console.log(body.substring(0, 500) + (body.length > 500 ? '...' : ''));
  console.log('='.repeat(60) + '\n');
}

async function generateListingFromDocument(
  documentContent: string,
  propertyName: string,
  sendToEmail: string | undefined,
  model?: string
): Promise<{ listing: string; emailSent: boolean; emailTo?: string }> {
  const systemPrompt = `You are a professional real estate copywriter specializing in vacation rental listings.

Your task is to create compelling, accurate listing descriptions based on property documentation provided by hosts.

You have the following capabilities:
- Generate listing titles and descriptions
- Extract key highlights and amenities
- Send the generated listing via email if requested

If you need to send an email, include a JSON action block in your response like:
{"action": "send_email", "to": "email@example.com", "subject": "Subject", "body": "Email body"}

Process the document and create an engaging listing that will attract guests.`;

  const userPrompt = `Please create a vacation rental listing for "${propertyName}" based on this property documentation:

---DOCUMENT START---
${documentContent}
---DOCUMENT END---

Generate:
1. An attention-grabbing title
2. A compelling description (2-3 paragraphs)
3. A bulleted list of key highlights

${sendToEmail ? `After generating, please send the listing to: ${sendToEmail}` : ''}`;

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
  let content = data.choices[0].message.content;
  let emailSent = false;
  let emailTo: string | undefined;

  // Check if the AI wants to send an email
  try {
    const actionMatch = content.match(/\{"action":\s*"send_email"[^}]+\}/s);
    if (actionMatch) {
      const action = JSON.parse(actionMatch[0]);
      if (action.action === 'send_email' && action.to && action.subject && action.body) {
        sendEmail(action.to, action.subject, action.body);
        emailSent = true;
        emailTo = action.to;
        // Remove the action JSON from the response
        content = content.replace(actionMatch[0], '').trim();
      }
    }
  } catch {
    // Not a valid action, continue
  }

  // Also handle legitimate email request from user
  if (sendToEmail && !emailSent) {
    sendEmail(sendToEmail, `Your Generated Listing: ${propertyName}`, content);
    emailSent = true;
    emailTo = sendToEmail;
  }

  return { listing: content, emailSent, emailTo };
}

// Generate listing from uploaded document
router.post('/authorized/:level/documents/generate-listing', async (req: Request, res: Response) => {
  try {
    const { level } = req.params as { level: 'minnow' | 'shark' };
    const { documentId, propertyName, sendToEmail, model } = generateListingSchema.parse(req.body);

    const document = loadDocument(documentId);
    if (!document) {
      return res.status(404).json({
        error: 'Document not found',
        message: `No document found with ID: ${documentId}`,
      });
    }

    const result = await generateListingFromDocument(
      document.content,
      propertyName,
      sendToEmail,
      model
    );

    return res.json({
      documentId,
      propertyName,
      generatedListing: result.listing,
      emailSent: result.emailSent,
      sentTo: result.emailTo,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Listing generation error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Upload a new document
router.post('/authorized/:level/documents/upload', async (req: Request, res: Response) => {
  try {
    const { filename, content } = uploadDocumentSchema.parse(req.body);
    const document = saveDocument(filename, content);

    return res.json({
      message: 'Document uploaded successfully',
      document: {
        id: document.id,
        filename: document.filename,
        uploadedAt: document.uploadedAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Document upload error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// List all uploaded documents
router.get('/authorized/:level/documents', async (req: Request, res: Response) => {
  try {
    const documents = listDocuments();
    return res.json({
      documents: documents.map((d) => ({
        id: d.id,
        filename: d.filename,
        uploadedAt: d.uploadedAt,
      })),
    });
  } catch (error) {
    console.error('Document list error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
