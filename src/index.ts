#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import { GoogleDocsClient } from './google-docs-client.js';
import * as dotenv from 'dotenv';
import { parseArgs } from 'node:util';

// Load environment variables
dotenv.config();

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

class GoogleDocsServer {
  // Core server properties
  private server: Server;
  private googleDocs: GoogleDocsClient;

  constructor() {
    this.server = new Server(
      {
        name: 'google-docs-manager',
        version: '0.1.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );
    if (serviceAccountPath) {
      console.log(`Using service account: ${serviceAccountPath}`);
    }
    if (apiKey) {
      console.log(`Using API key: ${apiKey.substring(0, 4)}...`);
    }
    if (oauthClientId && oauthClientSecret && oauthRefreshToken) {
      console.log(`Using OAuth credentials with client ID: ${oauthClientId.substring(0, 4)}...`);
    }
    console.log(`Using project ID: ${projectId}`);
    this.googleDocs = new GoogleDocsClient({
      serviceAccountPath,
      apiKey,
      projectId,
      oauthClientId,
      oauthClientSecret,
      oauthRefreshToken
    });
    
    // Log authentication information
   

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });

    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception:', error);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled rejection at:', promise, 'reason:', reason);
    });
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      // Define available tools
      const tools: Tool[] = [
        {
          name: 'google_docs_create',
          description: 'Create a new Google Doc',
          inputSchema: {
            type: 'object',
            properties: {
              title: { 
                type: 'string', 
                description: 'Title of the document' 
              },
              content: { 
                type: 'string', 
                description: 'Initial content of the document (plain text)' 
              }
            },
            required: ['title']
          }
        },
        {
          name: 'google_docs_get',
          description: 'Get a Google Doc by ID',
          inputSchema: {
            type: 'object',
            properties: {
              documentId: { 
                type: 'string', 
                description: 'ID of the document to retrieve' 
              }
            },
            required: ['documentId']
          }
        },
        {
          name: 'google_docs_update',
          description: 'Update a Google Doc with new content',
          inputSchema: {
            type: 'object',
            properties: {
              documentId: { 
                type: 'string', 
                description: 'ID of the document to update' 
              },
              content: { 
                type: 'string', 
                description: 'New content to add or replace (plain text)' 
              },
              replaceAll: { 
                type: 'boolean', 
                description: 'Whether to replace all content (true) or append (false)' 
              }
            },
            required: ['documentId', 'content']
          }
        },
        {
          name: 'google_docs_list',
          description: 'List Google Docs accessible to the authenticated user',
          inputSchema: {
            type: 'object',
            properties: {
              pageSize: { 
                type: 'number', 
                description: 'Number of documents to return (default: 10)' 
              },
              pageToken: { 
                type: 'string', 
                description: 'Token for pagination' 
              }
            }
          }
        },
        {
          name: 'google_docs_delete',
          description: 'Delete a Google Doc',
          inputSchema: {
            type: 'object',
            properties: {
              documentId: { 
                type: 'string', 
                description: 'ID of the document to delete' 
              }
            },
            required: ['documentId']
          }
        },
        {
          name: 'google_docs_export',
          description: 'Export a Google Doc to different formats',
          inputSchema: {
            type: 'object',
            properties: {
              documentId: { 
                type: 'string', 
                description: 'ID of the document to export' 
              },
              mimeType: { 
                type: 'string', 
                description: 'MIME type for export (e.g., "application/pdf", "text/plain")' 
              }
            },
            required: ['documentId']
          }
        },
        {
          name: 'google_docs_share',
          description: 'Share a Google Doc with specific users',
          inputSchema: {
            type: 'object',
            properties: {
              documentId: { 
                type: 'string', 
                description: 'ID of the document to share' 
              },
              emailAddress: { 
                type: 'string', 
                description: 'Email address to share with' 
              },
              role: { 
                type: 'string', 
                description: 'Role to assign (reader, writer, commenter)' 
              }
            },
            required: ['documentId', 'emailAddress']
          }
        },
        {
          name: 'google_docs_search',
          description: 'Search for Google Docs by title or content',
          inputSchema: {
            type: 'object',
            properties: {
              query: { 
                type: 'string', 
                description: 'Search query for document title or content' 
              },
              pageSize: { 
                type: 'number', 
                description: 'Number of results to return (default: 10)' 
              },
              pageToken: { 
                type: 'string', 
                description: 'Token for pagination' 
              }
            },
            required: ['query']
          }
        },
        {
          name: 'google_docs_verify_connection',
          description: 'Verify connection with Google Docs API and check credentials',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        }
      ];
      
      return { tools };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const args = request.params.arguments ?? {};

        switch (request.params.name) {
          case 'google_docs_create': {
            const result = await this.googleDocs.createDocument(
              args.title as string,
              args.content as string | undefined
            );
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }]
            };
          }
          
          case 'google_docs_get': {
            const result = await this.googleDocs.getDocument(args.documentId as string);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }]
            };
          }
          
          case 'google_docs_update': {
            const result = await this.googleDocs.updateDocument(
              args.documentId as string,
              args.content as string,
              args.replaceAll as boolean | undefined
            );
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }]
            };
          }
          
          case 'google_docs_list': {
            const result = await this.googleDocs.listDocuments(
              args.pageSize as number | undefined,
              args.pageToken as string | undefined
            );
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }]
            };
          }
          
          case 'google_docs_delete': {
            const result = await this.googleDocs.deleteDocument(args.documentId as string);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }]
            };
          }
          
          case 'google_docs_export': {
            const result = await this.googleDocs.exportDocument(
              args.documentId as string,
              args.mimeType as string | undefined
            );
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }]
            };
          }
          
          case 'google_docs_share': {
            const result = await this.googleDocs.shareDocument(
              args.documentId as string,
              args.emailAddress as string,
              args.role as string | undefined
            );
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }]
            };
          }
          
          case 'google_docs_search': {
            const result = await this.googleDocs.searchDocuments(
              args.query as string,
              args.pageSize as number | undefined,
              args.pageToken as string | undefined
            );
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }]
            };
          }
          
          case 'google_docs_verify_connection': {
            const result = await this.googleDocs.verifyConnection();
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }]
            };
          }

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error: any) {
        console.error(`Error executing tool ${request.params.name}:`, error);
        return {
          content: [{
            type: 'text',
            text: `Google Docs API error: ${error.message}`
          }],
          isError: true,
        };
      }
    });
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('Google Docs MCP server started');
  }
}

export async function serve(): Promise<void> {
  const server = new GoogleDocsServer();
  await server.run();
}

const server = new GoogleDocsServer();
server.run().catch(console.error);
