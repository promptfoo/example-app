import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import { chatHandler } from './routes/chat';
import { tokenHandler, jwksHandler } from './routes/oauth';
import rentalRouter from './routes/rental';
import { generateRSAKeyPair } from './utils/jwt-keys';
import { authenticateToken } from './middleware/auth';

dotenv.config();

// Initialize OAuth key pair on startup
generateRSAKeyPair();
console.log('OAuth RSA key pair generated');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For OAuth token endpoint (application/x-www-form-urlencoded)

// Healthcheck endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Chat endpoints with fish-named security levels (minnow=insecure, shark=secure)
app.post('/:level/chat', chatHandler);
app.post('/authorized/:level/chat', authenticateToken, chatHandler);

// OAuth endpoints
app.post('/oauth/token', tokenHandler);
app.get('/.well-known/jwks.json', jwksHandler);

// Rental guest screening endpoints
app.use('/', authenticateToken, rentalRouter);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

