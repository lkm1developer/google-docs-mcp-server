# Testing Your Google Docs API Connection

This guide will help you verify that your Google Docs MCP server can successfully connect to the Google Docs API using your credentials.

## Prerequisites

Before testing your connection, make sure you have:

1. Created a Google Cloud project
2. Enabled the Google Docs API and Google Drive API
3. Set up authentication credentials (API key, service account, or OAuth2)
4. Added your credentials to the `.env` file

## Running the Connection Test

The Google Docs MCP server includes a connection test script that verifies your credentials and API access.

### Basic Usage

```bash
npx tsx src/test-connection.ts
```

This will use the credentials from your `.env` file to test the connection.

### Command Line Options

You can also provide credentials directly via command line arguments:

```bash
npx tsx src/test-connection.ts \
  --project-id=your-project-id \
  --credentials-path=/path/to/service-account.json
```

Available options:

- `--credentials-path`: Path to service account key file
- `--api-key`: Google API key
- `--project-id`: Google Cloud project ID
- `--oauth-client-id`: OAuth client ID
- `--oauth-client-secret`: OAuth client secret
- `--oauth-refresh-token`: OAuth refresh token

## Understanding the Results

### Successful Connection

A successful connection will show output similar to:

```
Google Docs API Connection Test
===============================
Using credentials: /path/to/service-account.json
Using project ID: your-project-id

Testing connection...

Connection Result:
{
  "connected": true,
  "projectId": "your-project-id",
  "timestamp": "2025-04-15T07:30:00.000Z",
  "details": {
    "authType": "Service Account",
    "apiVersion": "v1",
    "documentCount": 5
  }
}

✅ Connection successful!
```

### Failed Connection

If the connection fails, you'll see an error message with details about what went wrong:

```
Google Docs API Connection Test
===============================
Using credentials: /path/to/service-account.json
Using project ID: your-project-id

Testing connection...

Connection Result:
{
  "connected": false,
  "projectId": "your-project-id",
  "timestamp": "2025-04-15T07:30:00.000Z",
  "error": {
    "message": "Request had insufficient authentication scopes.",
    "code": "403",
    "details": "..."
  }
}

❌ Connection failed due to permission issues!

This is likely because:
1. The service account does not have the necessary permissions
2. The Google Docs API is not enabled in your Google Cloud project
3. The OAuth credentials might be invalid or expired

To fix this:
1. Make sure the Docs API is enabled: https://console.cloud.google.com/apis/library/docs.googleapis.com
2. Grant the service account the necessary permissions (e.g., "Docs API User" role)
3. If using OAuth, ensure your credentials are valid and have the correct scopes
```

## Common Issues and Solutions

### API Not Enabled

If you see an error about the API not being enabled:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/apis/library)
2. Search for "Google Docs API" and "Google Drive API"
3. Enable both APIs for your project

### Insufficient Permissions

If your service account lacks the necessary permissions:

1. Go to the [IAM & Admin](https://console.cloud.google.com/iam-admin/iam) section
2. Find your service account
3. Add the following roles:
   - "Docs API User"
   - "Drive API User"

### Invalid OAuth Credentials

If your OAuth credentials are invalid or expired:

1. Verify your client ID and client secret
2. Generate a new refresh token using the included script:
   ```bash
   node src/get-refresh-token.js
   ```
3. Update your `.env` file with the new refresh token

### Quota Exceeded

If you've exceeded your API quota:

1. Go to the [API Dashboard](https://console.cloud.google.com/apis/dashboard)
2. Check your quota usage
3. Consider requesting a quota increase or waiting until the quota resets

## Next Steps

Once your connection test is successful, you can:

1. Build the project: `npm run build`
2. Start the MCP server: `npm start`
3. Configure your MCP settings to use the Google Docs MCP server
