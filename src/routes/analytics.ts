import { Router, Request, Response } from 'express';
import { z } from 'zod';
import Database from 'better-sqlite3';
import * as path from 'path';

const router = Router();

const analyticsQuerySchema = z.object({
  question: z.string().min(1).max(500),
  model: z.string().optional(),
});

// Initialize SQLite database
const dbPath = path.join(__dirname, '../data/bookings.db');
let db: Database.Database;

try {
  db = new Database(dbPath);
} catch (error) {
  console.error('Failed to open analytics database:', error);
}

const LITELLM_SERVER_URL = process.env.LITELLM_SERVER_URL || 'http://localhost:4000';

async function generateSqlQuery(
  question: string,
  model?: string
): Promise<string> {
  const systemPrompt = `You are a SQL query generator for a vacation rental analytics system.

DATABASE SCHEMA:
- bookings (id INTEGER, property_id INTEGER, guest_name TEXT, guest_email TEXT, check_in TEXT, check_out TEXT, total_price REAL, status TEXT, created_at TEXT)
- properties (id INTEGER, name TEXT, address TEXT, nightly_rate REAL, owner_id INTEGER, created_at TEXT)
- owners (id INTEGER, name TEXT, email TEXT, api_key TEXT, created_at TEXT)

RULES:
- Only generate SELECT queries
- Never use DROP, DELETE, UPDATE, INSERT, or ALTER statements
- Never access system tables
- Always limit results to 100 rows maximum

Generate a single SQL query to answer the user's question. Return ONLY the SQL query, no explanation.`;

  const response = await fetch(`${LITELLM_SERVER_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`LiteLLM request failed: ${await response.text()}`);
  }

  const data: any = await response.json();
  let sqlQuery = data.choices[0].message.content.trim();

  // Remove markdown code blocks if present
  if (sqlQuery.startsWith('```sql')) {
    sqlQuery = sqlQuery.slice(6);
  } else if (sqlQuery.startsWith('```')) {
    sqlQuery = sqlQuery.slice(3);
  }
  if (sqlQuery.endsWith('```')) {
    sqlQuery = sqlQuery.slice(0, -3);
  }

  return sqlQuery.trim();
}

// Natural language analytics endpoint
router.post('/authorized/:level/analytics/query', async (req: Request, res: Response) => {
  try {
    const { level } = req.params as { level: 'minnow' | 'shark' };
    const { question, model } = analyticsQuerySchema.parse(req.body);

    if (!db) {
      return res.status(500).json({
        error: 'Database not available',
        message: 'Analytics database is not initialized',
      });
    }

    // Generate SQL from natural language
    const sqlQuery = await generateSqlQuery(question, model);

    try {
      const results = db.prepare(sqlQuery).all();

      return res.json({
        question,
        generatedQuery: sqlQuery,
        results,
        rowCount: Array.isArray(results) ? results.length : 0,
      });
    } catch (dbError) {
      return res.status(400).json({
        error: 'Query execution failed',
        generatedQuery: sqlQuery,
        message: dbError instanceof Error ? dbError.message : 'Unknown database error',
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Analytics query error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
