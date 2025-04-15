#!/usr/bin/env node
/**
 * This script helps you obtain a refresh token for Google OAuth2 authentication.
 * The refresh token is needed for operations that require user consent,
 * such as creating and editing Google Docs.
 * 
 * Usage:
 *   1. Update the CLIENT_ID and CLIENT_SECRET below with your OAuth credentials
 *   2. Run: node src/get-refresh-token.js
 *   3. Follow the browser prompts to authorize the application
 *   4. Copy the refresh token to your .env file
 */

const { google } = require('googleapis');
const http = require('http');
const url = require('url');
const open = require('open');
const destroyer = require('server-destroy');

// Update these with your OAuth credentials
const CLIENT_ID = 'YOUR_CLIENT_ID';
const CLIENT_SECRET = 'YOUR_CLIENT_SECRET';
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';

async function getRefreshToken() {
  console.log('Google OAuth2 Refresh Token Generator');
  console.log('=====================================');
  console.log('');
  
  // Create OAuth2 client
  const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
  );

  // Define the required scopes
  const scopes = [
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/drive'
  ];

  // Generate the authorization URL
  const authorizeUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'  // Force to get refresh token
  });

  console.log('Opening browser for authorization...');
  console.log('Please log in and authorize the application when prompted.');
  console.log('');
  
  // Open the browser for authorization
  await open(authorizeUrl);

  // Create a local server to receive the callback
  return new Promise((resolve, reject) => {
    const server = http
      .createServer(async (req, res) => {
        try {
          // Parse the query parameters
          const queryParams = url.parse(req.url, true).query;
          
          if (queryParams.code) {
            // Send a success response to the browser
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                  <h1>Authentication Successful!</h1>
                  <p>You can close this window and return to the terminal.</p>
                </body>
              </html>
            `);
            
            // Close the server
            server.destroy();
            
            // Exchange the authorization code for tokens
            const { tokens } = await oauth2Client.getToken(queryParams.code);
            
            console.log('\n✅ Authentication successful!\n');
            
            if (tokens.refresh_token) {
              console.log('Refresh Token:');
              console.log('==============');
              console.log(tokens.refresh_token);
              console.log('');
              console.log('Add this refresh token to your .env file as:');
              console.log('refresh_token=' + tokens.refresh_token);
            } else {
              console.log('⚠️ No refresh token was returned. This can happen if:');
              console.log('  1. You\'ve already authorized this application before');
              console.log('  2. You didn\'t include "prompt: consent" in the authorization URL');
              console.log('');
              console.log('Try revoking access at https://myaccount.google.com/permissions and run this script again.');
            }
            
            resolve(tokens.refresh_token);
          } else if (queryParams.error) {
            // Handle authorization error
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                  <h1>Authentication Error</h1>
                  <p>Error: ${queryParams.error}</p>
                  <p>You can close this window and return to the terminal.</p>
                </body>
              </html>
            `);
            
            server.destroy();
            reject(new Error(`Authorization error: ${queryParams.error}`));
          }
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h1>Server Error</h1>
                <p>An error occurred during authentication.</p>
                <p>You can close this window and return to the terminal.</p>
              </body>
            </html>
          `);
          
          server.destroy();
          reject(e);
        }
      })
      .listen(3000);
    
    // Enable server cleanup on close
    destroyer(server);
    
    console.log('Waiting for authentication...');
  });
}

// Run the script
getRefreshToken().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
