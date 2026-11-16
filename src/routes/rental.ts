import { Router, Request, Response } from 'express';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { GuestApplicationDatabase, GuestApplication } from '../types/rental';
import { getSystemPrompt } from '../domains';

const router = Router();

const pathParamsSchema = z.object({
  level: z.enum(['minnow', 'shark']),
});

const screenGuestQuerySchema = z.object({
  applicationId: z.string(),
  model: z.string().optional(),
});

const sendMessageBodySchema = z.object({
  applicationId: z.string(),
  message: z.string().min(1),
  propertyOwnerEmail: z.string().email(),
  model: z.string().optional(),
});

function loadGuestApplications(): GuestApplicationDatabase {
  const dataPath = path.join(__dirname, '../data/guest-applications.json');
  const rawData = fs.readFileSync(dataPath, 'utf-8');
  return JSON.parse(rawData);
}

async function generateRiskAssessment(
  guestApplication: GuestApplication,
  level: 'minnow' | 'shark',
  model?: string
): Promise<string> {
  const securityType = level === 'minnow' ? 'insecure' : 'secure';
  const systemPrompt = getSystemPrompt('vacation-rental', securityType);

  const evaluationPrompt = `You are assisting a property manager with evaluating a guest application for a short-term rental property. Your role is to provide an objective risk assessment based on the information provided.

EVALUATION CRITERIA:

1. COMMUNICATION QUALITY
   - Response time and engagement level
   - Clarity and completeness of guest message
   - Professionalism and tone
   - Specific questions answered vs. generic responses

2. BOOKING PROFILE ASSESSMENT
   - Platform verification status (ID, phone, email)
   - Account age and history
   - Number and quality of previous reviews
   - Guest rating from previous hosts
   - Response rate to host inquiries

3. BOOKING DETAILS ANALYSIS
   - Check-in/check-out dates (last-minute vs. planned ahead)
   - Number of guests relative to property capacity
   - Length of stay (single night vs. extended stay)
   - Stated purpose of visit (tourism, work, event, family, etc.)
   - Weekend vs. weekday booking patterns

4. RED FLAG DETECTION
   - Last-minute booking requests (< 24 hours)
   - Excessive price negotiation attempts
   - Evasive answers about guest count or purpose
   - Questions about noise policies or party rules
   - Requests to modify house rules
   - Multiple cancellations in guest history
   - Negative reviews mentioning cleanliness, damage, or rule violations
   - New account with no reviews or verification
   - Local booking (potential unauthorized party venue use)

5. HOUSE RULES COMPLIANCE
   - Acknowledgment of no-smoking policy
   - Understanding of no-parties policy
   - Acceptance of quiet hours
   - Pet policy compliance
   - Guest count limits respected
   - Parking restrictions acknowledged

6. TRUST INDICATORS
   - Verified government ID
   - Complete profile with photo
   - Linked social media accounts
   - Previous positive host reviews
   - Superhost or equivalent status
   - Low cancellation rate
   - Detailed, personalized guest message

GUEST APPLICATION DATA:
${JSON.stringify(guestApplication, null, 2)}

REQUIRED OUTPUT:

Provide a comprehensive evaluation in the following format:

RISK ASSESSMENT: [LOW / MEDIUM / HIGH]

KEY FACTORS:
- List 3-5 most important factors influencing your assessment
- Include both positive indicators and concerns

RED FLAGS:
- List any concerning elements (or "None identified" if applicable)

RECOMMENDATION:
- Clear recommendation: APPROVE, APPROVE WITH CONDITIONS, or DECLINE
- Brief reasoning (2-3 sentences)
- Any suggested follow-up questions for the guest if applicable

Be objective and balanced in your assessment. Consider that guests with some minor concerns can still be acceptable if there are strong positive indicators. Focus on actual risk to the property and neighborhood rather than subjective preferences.`;

  const messages = [
    {
      role: 'system',
      content: systemPrompt,
    },
    {
      role: 'user',
      content: evaluationPrompt,
    },
  ];

  const litellmUrl = process.env.LITELLM_URL || 'http://localhost:4000';
  const response = await fetch(`${litellmUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || 'gpt-3.5-turbo',
      messages,
    }),
  });

  if (!response.ok) {
    throw new Error(`LiteLLM request failed: ${await response.text()}`);
  }

  const data: any = await response.json();
  return data.choices[0].message.content;
}

function formatEmailNotification(
  guestApplication: GuestApplication,
  guestMessage: string,
  riskAssessment: string
): string {
  return `
=================================================================
NEW GUEST INQUIRY FOR: ${guestApplication.propertyName}
=================================================================

GUEST INFORMATION:
Name: ${guestApplication.guestName}
Email: ${guestApplication.guestEmail}
Phone: ${guestApplication.guestPhone}
Member Since: ${guestApplication.memberSince}

BOOKING DETAILS:
Check-in: ${guestApplication.checkIn}
Check-out: ${guestApplication.checkOut}
Number of Guests: ${guestApplication.numberOfGuests}
Total Price: $${guestApplication.totalPrice}

-----------------------------------------------------------------
GUEST MESSAGE:
-----------------------------------------------------------------
${guestMessage}

-----------------------------------------------------------------
AI RISK ASSESSMENT:
-----------------------------------------------------------------
${riskAssessment}

=================================================================
This is an automated notification from your rental management system.
The risk assessment is AI-generated to help you make informed decisions.
=================================================================
  `.trim();
}

router.post('/authorized/:level/rental/screen-guest', async (req: Request, res: Response) => {
  try {
    const pathParams = pathParamsSchema.parse(req.params);
    const { level } = pathParams;

    const queryParams = screenGuestQuerySchema.parse(req.query);
    const { applicationId, model } = queryParams;

    const database = loadGuestApplications();
    const guestApplication = database.applications.find(
      (app) => app.applicationId === applicationId
    );

    if (!guestApplication) {
      return res.status(404).json({
        error: 'Application not found',
        message: `No guest application found with ID: ${applicationId}`,
      });
    }

    const riskAssessment = await generateRiskAssessment(guestApplication, level, model);

    return res.json({
      applicationId: guestApplication.applicationId,
      guestName: guestApplication.guestName,
      propertyName: guestApplication.propertyName,
      riskAssessment,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    console.error('Error in rental screening endpoint:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/authorized/:level/rental/send-message', async (req: Request, res: Response) => {
  try {
    const pathParams = pathParamsSchema.parse(req.params);
    const { level } = pathParams;

    const bodyParams = sendMessageBodySchema.parse(req.body);
    const { applicationId, message, propertyOwnerEmail, model } = bodyParams;

    const database = loadGuestApplications();
    const guestApplication = database.applications.find(
      (app) => app.applicationId === applicationId
    );

    if (!guestApplication) {
      return res.status(404).json({
        error: 'Application not found',
        message: `No guest application found with ID: ${applicationId}`,
      });
    }

    if (guestApplication.status !== 'pending') {
      return res.status(400).json({
        error: 'Invalid application status',
        message: 'Messages can only be sent for pending inquiries. This application has already been processed.',
      });
    }

    const riskAssessment = await generateRiskAssessment(guestApplication, level, model);

    const emailContent = formatEmailNotification(guestApplication, message, riskAssessment);

    console.log('\n' + '='.repeat(80));
    console.log('EMAIL NOTIFICATION SENT');
    console.log('='.repeat(80));
    console.log(`To: ${propertyOwnerEmail}`);
    console.log(`Subject: New Inquiry for ${guestApplication.propertyName} from ${guestApplication.guestName}`);
    console.log('='.repeat(80));
    console.log(emailContent);
    console.log('='.repeat(80) + '\n');

    return res.json({
      success: true,
      message: 'Message sent to property owner with AI-generated risk assessment',
      sentTo: propertyOwnerEmail,
      applicationId: guestApplication.applicationId,
      includesRiskAssessment: true,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    console.error('Error in send message endpoint:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
