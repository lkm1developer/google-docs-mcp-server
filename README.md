# Google Docs MCP Server

A powerful Model Context Protocol (MCP) server implementation for seamless Google Docs API integration, enabling AI assistants to create, read, update, and manage Google Docs.

## Features

- Create new Google Docs with custom titles and content
- Retrieve document content and metadata
- Update existing documents with new content
- List all accessible documents
- Delete documents
- Export documents to different formats (PDF, plain text, etc.)
- Share documents with specific users
- Search for documents by title or content
- Verify connection and credentials

## Prerequisites

- Node.js 18 or higher
- A Google Cloud project with the Google Docs API enabled
- Authentication credentials (API key, service account, or OAuth2)

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/lkm1developer/google-docs-mcp-server.git
   cd google-docs-mcp-server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with your Google Cloud credentials:
   ```
   # Required
   GOOGLE_CLOUD_PROJECT_ID=your-project-id
   
   # Choose one authentication method:
   
   # Option 1: Service Account (recommended for production)
   GOOGLE_APPLICATION_CREDENTIALS=path/to/your-service-account-key.json
   
   # Option 2: API Key (simpler for development)
   GOOGLE_API_KEY=your-api-key
   
   # Option 3: OAuth2 (required for user-specific operations)
   GOOGLE_OAUTH_CLIENT_ID=your-oauth-client-id
   GOOGLE_OAUTH_CLIENT_SECRET=your-oauth-client-secret
   GOOGLE_OAUTH_REFRESH_TOKEN=your-oauth-refresh-token
   ```

## Authentication Setup

### Service Account Authentication

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Docs API and Google Drive API
4. Go to "IAM & Admin" > "Service Accounts"
5. Create a new service account
6. Grant it the necessary roles (e.g., "Docs API User", "Drive API User")
7. Create and download a JSON key for the service account
8. Set the path to this JSON file in your `.env` file

### OAuth2 Authentication

For operations that require user consent (like creating/editing documents):

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Docs API and Google Drive API
4. Go to "APIs & Services" > "Credentials"
5. Create OAuth client ID credentials (Web application type)
6. Add authorized redirect URIs (e.g., http://localhost:3000/oauth2callback)
7. Note your Client ID and Client Secret
8. Use the following script to get a refresh token:

```javascript
// get-refresh-token.js
const { google } = require('googleapis');
const http = require('http');
const url = require('url');
const open = require('open');
const destroyer = require('server-destroy');

async function getRefreshToken() {
  const oauth2Client = new google.auth.OAuth2(
    'YOUR_CLIENT_ID',
    'YOUR_CLIENT_SECRET',
    'http://localhost:3000/oauth2callback'
  );

  const scopes = [
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/drive'
  ];

  const authorizeUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });

  console.log('Opening browser for authorization...');
  open(authorizeUrl);

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const queryParams = url.parse(req.url, true).query;
        
        if (queryParams.code) {
          res.end('Authentication successful! You can close this window.');
          server.destroy();
          
          const { tokens } = await oauth2Client.getToken(queryParams.code);
          console.log('\nRefresh Token:', tokens.refresh_token);
          console.log('\nAdd this refresh token to your .env file as GOOGLE_OAUTH_REFRESH_TOKEN');
          
          resolve(tokens.refresh_token);
        }
      } catch (e) {
        reject(e);
      }
    }).listen(3000);
    
    destroyer(server);
  });
}

getRefreshToken().catch(console.error);
```

Run this script with:
```bash
npm install googleapis open server-destroy
node get-refresh-token.js
```

## Building and Running

1. Build the project:
   ```bash
   npm run build
   ```

2. Test your connection:
   ```bash
   npx tsx src/test-connection.ts
   ```

3. Run the server:
   ```bash
   npm start
   ```

   Or with specific credentials:
   ```bash
   npm start -- --credentials-path=/path/to/service-account.json --project-id=your-project-id
   ```

4. Run the SSE server with authentication:
   ```bash
   npx mcp-proxy-auth node dist/index.js
   ```

### Implementing Authentication in SSE Server

The SSE server uses the [mcp-proxy-auth](https://www.npmjs.com/package/mcp-proxy-auth) package for authentication. To implement authentication:

1. Install the package:
   ```bash
   npm install mcp-proxy-auth
   ```

2. Set the `AUTH_SERVER_URL` environment variable to point to your API key verification endpoint:
   ```bash
   export AUTH_SERVER_URL=https://your-auth-server.com/verify
   ```

3. Run the SSE server with authentication:
   ```bash
   npx mcp-proxy-auth node dist/index.js
   ```

4. The SSE URL will be available at:
   ```
   localhost:8080/sse?apiKey=apikey
   ```

   Replace `apikey` with your actual API key for authentication.

The `mcp-proxy-auth` package acts as a proxy that:
- Intercepts requests to your SSE server
- Verifies API keys against your authentication server
- Only allows authenticated requests to reach your SSE endpoint

### Docker Support

You can also run the server using Docker:

1. Build the Docker image:
   ```bash
   docker build -t google-docs-mcp-server .
   ```

2. Run the container:
   ```bash
   docker run -p 8080:8080 \
     -e GOOGLE_CLOUD_PROJECT_ID=your-project-id \
     -e GOOGLE_OAUTH_CLIENT_ID=your-client-id \
     -e GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret \
     -e GOOGLE_OAUTH_REFRESH_TOKEN=your-refresh-token \
     -e AUTH_SERVER_URL=https://your-auth-server.com/verify \
     google-docs-mcp-server
   ```

## MCP Integration

To use this server with Claude or other MCP-compatible assistants, add it to your MCP settings:

```json
{
  "mcpServers": {
    "google-docs": {
      "command": "node",
      "args": ["/path/to/google-docs-mcp-server/dist/index.js"],
      "env": {
        "GOOGLE_CLOUD_PROJECT_ID": "your-project-id",
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/your-service-account-key.json",
        "GOOGLE_API_KEY": "your-api-key",
        "GOOGLE_OAUTH_CLIENT_ID": "your-oauth-client-id",
        "GOOGLE_OAUTH_CLIENT_SECRET": "your-oauth-client-secret",
        "GOOGLE_OAUTH_REFRESH_TOKEN": "your-oauth-refresh-token"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

## Available Tools

| Tool Name | Description | Required Parameters |
|-----------|-------------|---------------------|
| `google_docs_create` | Create a new Google Doc | `title`, `content` (optional) |
| `google_docs_get` | Get a Google Doc by ID | `documentId` |
| `google_docs_update` | Update a Google Doc with new content | `documentId`, `content`, `replaceAll` (optional) |
| `google_docs_list` | List Google Docs accessible to the authenticated user | `pageSize` (optional), `pageToken` (optional) |
| `google_docs_delete` | Delete a Google Doc | `documentId` |
| `google_docs_export` | Export a Google Doc to different formats | `documentId`, `mimeType` (optional) |
| `google_docs_share` | Share a Google Doc with specific users | `documentId`, `emailAddress`, `role` (optional) |
| `google_docs_search` | Search for Google Docs by title or content | `query`, `pageSize` (optional), `pageToken` (optional) |
| `google_docs_verify_connection` | Verify connection with Google Docs API | None |

## Example Usage

Here are some examples of how to use the tools:

### Create a new document

```json
{
  "name": "google_docs_create",
  "arguments": {
    "title": "My New Document",
    "content": "This is the content of my new document."
  }
}
```

### Get a document

```json
{
  "name": "google_docs_get",
  "arguments": {
    "documentId": "1Ax7vsdg3_YhKjkl2P0TZ5XYZ123456"
  }
}
```

### Update a document

```json
{
  "name": "google_docs_update",
  "arguments": {
    "documentId": "1Ax7vsdg3_YhKjkl2P0TZ5XYZ123456",
    "content": "This is the new content.",
    "replaceAll": true
  }
}
```

### Search for documents

```json
{
  "name": "google_docs_search",
  "arguments": {
    "query": "meeting notes",
    "pageSize": 5
  }
}
```

## License

MIT
