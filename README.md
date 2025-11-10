# AI Chat API Gateway

## Executive Summary

This application provides a secure, enterprise-ready API gateway for AI-powered chat interactions. It enables organizations to offer domain-specific AI assistance with granular access control, ensuring that sensitive conversations in areas like finance, healthcare, and legal matters are handled with appropriate security and compliance measures.

### Key Business Value

- **Domain-Specific Intelligence**: Tailored AI responses for finance, medicine, taxes, vacation rentals, and general inquiries
- **Security & Compliance**: Multi-tier security model with role-based access control (read-only, read-write, admin)
- **Enterprise Authentication**: OAuth 2.0 implementation with JWT tokens for secure API access
- **Flexible Integration**: Compatible with multiple AI models through LiteLLM integration
- **Operational Excellence**: Health monitoring, structured error handling, and production-ready architecture

### Use Cases

- **Financial Services**: Provide compliant financial guidance without offering investment advice
- **Healthcare**: Deliver medical information with appropriate disclaimers and safety guardrails
- **Tax Services**: Assist with tax-related questions while maintaining legal boundaries
- **Property Management**: Support vacation rental inquiries with domain-specific knowledge
- **General Support**: Handle diverse customer service interactions with context-aware responses

---

## Quick Start

### Prerequisites

- Node.js 20+ 
- Docker and Docker Compose (for LiteLLM)
- npm or yarn

### Installation

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Copy the `.env.example` file to `.env` and update with your credentials:
   ```bash
   cp .env.example .env
   ```

3. **Start LiteLLM server:**
   ```bash
   docker-compose up -d
   ```

4. **Build and start the application:**
   ```bash
   npm run build
   npm start
   ```

   Or for development:
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:3000`

---

## API Overview

### Endpoints

#### Public Endpoints

- **`POST /:level/chat`** - Unauthenticated chat endpoint (level: `minnow` or `shark`)
- **`GET /health`** - Health check endpoint

#### Authenticated Endpoints

- **`POST /authorized/:level/chat`** - Authenticated chat endpoint (requires Bearer token, level: `minnow` or `shark`)

#### Security Levels

Security levels are specified using fish names in the URL path:
- **`minnow`** - Standard security level (equivalent to "insecure")
- **`shark`** - Enhanced security level (equivalent to "secure") with compliance guardrails

#### OAuth Endpoints

- **`POST /oauth/token`** - OAuth 2.0 token endpoint (client credentials grant)
- **`GET /.well-known/jwks.json`** - JSON Web Key Set for token verification

### Authentication Flow

1. Obtain an access token from `/oauth/token` using client credentials
2. Include the token in the `Authorization` header: `Bearer <token>`
3. Access protected endpoints with the token

---

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `LITELLM_SERVER_URL` | LiteLLM server URL | `http://localhost:4000` |
| `OAUTH_TOKEN_EXPIRES_IN` | Token expiration (seconds) | `3600` |
| `OAUTH_CLIENT_ID_READONLY` | Read-only client ID | Required |
| `OAUTH_CLIENT_SECRET_READONLY` | Read-only client secret | Required |
| `OAUTH_CLIENT_ID_READWRITE` | Read-write client ID | Required |
| `OAUTH_CLIENT_SECRET_READWRITE` | Read-write client secret | Required |
| `OAUTH_CLIENT_ID_ADMIN` | Admin client ID | Required |
| `OAUTH_CLIENT_SECRET_ADMIN` | Admin client secret | Required |

### Client Roles

- **readonly**: Read-only access (tokens include `role: "readonly"`)
- **readwrite**: Read-write access (tokens include `role: "readwrite"`)
- **admin**: Administrative access (tokens include `role: "admin"`)

---

## Usage Examples

### Get Access Token

```bash
curl -X POST http://localhost:3000/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET"
```

Response:
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "chat"
}
```

### Chat Request (Unauthenticated)

```bash
# Using minnow (standard) security level
curl -X POST http://localhost:3000/minnow/chat?domain=general \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'

# Using shark (enhanced) security level for sensitive domains
curl -X POST http://localhost:3000/shark/chat?domain=finance \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "What is a 401(k)?"}
    ]
  }'
```

### Chat Request (Authenticated)

```bash
# Authenticated request with shark security level
curl -X POST http://localhost:3000/authorized/shark/chat?domain=medicine \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "What are the symptoms of diabetes?"}
    ]
  }'

# Authenticated request with minnow security level
curl -X POST http://localhost:3000/authorized/minnow/chat?domain=general \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

### Query Parameters

- **`domain`** (optional): Domain for the chat (`general`, `finance`, `medicine`, `taxes`, `vacation-rental`). Defaults to `general`.
- **`model`** (optional): AI model to use. If not specified, LiteLLM will use its default model.

---

## Technical Architecture

### Technology Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Authentication**: OAuth 2.0 (client credentials grant) with JWT (RS256)
- **Validation**: Zod for request validation
- **AI Integration**: LiteLLM proxy for multi-model support
- **Security**: RSA 2048-bit key pairs for JWT signing

### Project Structure

```
src/
├── domains/              # Domain-specific prompts and configurations
│   ├── finance/
│   ├── medicine/
│   ├── taxes/
│   ├── vacation-rental/
│   └── general/
├── middleware/           # Express middleware
│   └── auth.ts          # JWT authentication middleware
├── routes/              # API route handlers
│   ├── chat.ts         # Chat endpoint handlers
│   └── oauth.ts        # OAuth token and JWKS endpoints
├── types/               # TypeScript type definitions
│   └── express.d.ts    # Express Request extensions
├── utils/               # Utility functions
│   └── jwt-keys.ts     # RSA key generation and JWKS conversion
└── server.ts           # Application entry point
```

### Security Features

1. **OAuth 2.0 Implementation**
   - Client credentials grant flow
   - RSA-signed JWT tokens (RS256)
   - Token expiration and validation
   - JWKS endpoint for public key distribution

2. **Role-Based Access Control**
   - Three-tier access model (readonly, readwrite, admin)
   - Role information embedded in JWT claims
   - Extensible for future endpoint-level restrictions

3. **Domain Security Levels**
   - Security levels are specified in the URL path using fish names:
     - **`minnow`**: Standard security level (equivalent to "insecure") - Standard prompts for general use
     - **`shark`**: Enhanced security level (equivalent to "secure") - Enhanced prompts with compliance guardrails for sensitive domains
   - The fish names obscure the actual security level from end users while maintaining internal consistency

### Domain-Specific Prompts

The application supports five domains, each with two security levels:

- **General**: Broad-purpose AI assistance
- **Finance**: Financial information with compliance guardrails
- **Medicine**: Medical information with appropriate disclaimers
- **Taxes**: Tax-related guidance with legal boundaries
- **Vacation Rental**: Property management and rental inquiries

Each domain includes:
- `insecure.txt`: Standard prompt configuration (used when `minnow` level is specified)
- `secure.txt`: Enhanced prompt with domain-specific safety measures (used when `shark` level is specified)
- `prompts.ts`: TypeScript module exporting prompt configurations

The security level is specified in the URL path (`minnow` or `shark`), which internally maps to `insecure` or `secure` respectively.

### Key Generation

- RSA 2048-bit key pairs generated on server startup
- Keys stored in memory (regenerated on restart)
- Public keys exposed via JWKS endpoint for token verification
- Private keys used exclusively for token signing

### Error Handling

- Structured error responses following OAuth 2.0 standards
- Comprehensive validation using Zod schemas
- Detailed error messages for debugging
- Graceful error handling with appropriate HTTP status codes

---

## Development

### Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run compiled application
- `npm run dev` - Run with ts-node for development
- `npm run watch` - Watch mode for TypeScript compilation

### Building

```bash
npm run build
```

Output is compiled to the `dist/` directory.

### Type Safety

The application uses TypeScript with strict mode enabled. All request/response types are validated at runtime using Zod schemas, ensuring type safety throughout the application lifecycle.

---

## Production Considerations

### Security

- **Never commit `.env` files** - Use secure secret management in production
- **Rotate client secrets regularly** - Implement secret rotation policies
- **Use HTTPS** - Always use TLS in production environments
- **Key Management** - Consider using a key management service for production deployments
- **Rate Limiting** - Implement rate limiting for API endpoints
- **Monitoring** - Set up logging and monitoring for security events

### Scalability

- Stateless design enables horizontal scaling
- Key generation on startup may impact cold start times
- Consider persistent key storage for production (currently in-memory)

### Deployment

The application is designed to run in containerized environments. Ensure:
- Environment variables are properly configured
- LiteLLM service is accessible
- Network policies allow necessary connections
- Health check endpoint is monitored

---

## License

Copyright (c) 2024 Promptfoo. All rights reserved.

This software is proprietary and confidential. Unauthorized copying, modification, distribution, or use of this software, via any medium, is strictly prohibited without the express written permission of Promptfoo.

See [LICENSE](LICENSE) for full terms.

