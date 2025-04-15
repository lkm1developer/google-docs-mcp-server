#!/usr/bin/env node
import { GoogleDocsClient } from './google-docs-client.js';
import * as dotenv from 'dotenv';
import { parseArgs } from 'node:util';

// Load environment variables
dotenv.config();

/**
 * Test script to verify connection with Google Docs API
 * 
 * Usage:
 *   npx tsx src/test-connection.ts
 *   
 * Optional arguments:
 *   --credentials-path <path>      Path to service account key file
 *   --api-key <key>                Google API key (alternative to service account)
 *   --project-id <id>              Google Cloud project ID
 *   --oauth-client-id <id>         OAuth client ID
 *   --oauth-client-secret <secret> OAuth client secret
 *   --oauth-refresh-token <token>  OAuth refresh token
 */
async function main() {
  console.log('Google Docs API Connection Test');
  console.log('===============================');
  
  try {
    // Parse command line arguments
    const { values } = parseArgs({
      options: {
        'credentials-path': { type: 'string' },
        'api-key': { type: 'string' },
        'project-id': { type: 'string' },
        'oauth-client-id': { type: 'string' },
        'oauth-client-secret': { type: 'string' },
        'oauth-refresh-token': { type: 'string' }
      }
    });
    
    // Get authentication parameters
    const serviceAccountPath = values['credentials-path'] || process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const apiKey = values['api-key'] || process.env.GOOGLE_API_KEY;
    const projectId = values['project-id'] || process.env.GOOGLE_CLOUD_PROJECT_ID;
    const oauthClientId = values['oauth-client-id'] || process.env.GOOGLE_OAUTH_CLIENT_ID;
    const oauthClientSecret = values['oauth-client-secret'] || process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    const oauthRefreshToken = values['oauth-refresh-token'] || process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
    
    if (!serviceAccountPath && !apiKey && !(oauthClientId && oauthClientSecret && oauthRefreshToken)) {
      throw new Error('Either GOOGLE_APPLICATION_CREDENTIALS, GOOGLE_API_KEY, or OAuth credentials are required');
    }
    
    if (!projectId) {
      throw new Error('GOOGLE_CLOUD_PROJECT_ID environment variable is required');
    }
    
    if (serviceAccountPath) {
      console.log(`Using credentials: ${serviceAccountPath}`);
    }
    if (apiKey) {
      console.log(`Using API key: ${apiKey.substring(0, 4)}...`);
    }
    if (oauthClientId && oauthClientSecret && oauthRefreshToken) {
      console.log(`Using OAuth credentials with client ID: ${oauthClientId.substring(0, 4)}...`);
    }
    console.log(`Using project ID: ${projectId}`);
    console.log('');
    
    // Create Google Docs client
    const googleDocs = new GoogleDocsClient({
      serviceAccountPath,
      apiKey,
      projectId,
      oauthClientId,
      oauthClientSecret,
      oauthRefreshToken
    });
    
    // Test connection
    console.log('Testing connection...');
    const result = await googleDocs.verifyConnection();
    
    // Display results
    console.log('');
    console.log('Connection Result:');
    console.log(JSON.stringify(result, null, 2));
    
    // Exit with appropriate code
    if (result.connected) {
      console.log('');
      console.log('✅ Connection successful!');
      process.exit(0);
    } else {
      console.log('');
      
      // Provide more helpful information based on the error
      if (result.error?.code === 403) {
        console.log('❌ Connection failed due to permission issues!');
        console.log('');
        console.log('This is likely because:');
        console.log('1. The service account does not have the necessary permissions');
        console.log('2. The Google Docs API is not enabled in your Google Cloud project');
        console.log('3. The OAuth credentials might be invalid or expired');
        console.log('');
        console.log('To fix this:');
        console.log('1. Make sure the Docs API is enabled: https://console.cloud.google.com/apis/library/docs.googleapis.com');
        console.log('2. Grant the service account the necessary permissions (e.g., "Docs API User" role)');
        console.log('3. If using OAuth, ensure your credentials are valid and have the correct scopes');
      } else {
        console.log('❌ Connection failed!');
      }
      
      process.exit(1);
    }
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
