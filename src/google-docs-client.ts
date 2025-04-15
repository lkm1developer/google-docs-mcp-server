import { google, docs_v1 } from 'googleapis';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

export class GoogleDocsClient {
  private docsClient: docs_v1.Docs;
  private driveClient: any; // Using any type to bypass TypeScript errors
  private projectId: string;
  private auth: any;
  
  constructor(options: {
    serviceAccountPath?: string;
    apiKey?: string;
    projectId?: string;
    oauthClientId?: string;
    oauthClientSecret?: string;
    oauthRefreshToken?: string;
  }) {
    // Get project ID from environment variables or constructor parameters
    this.projectId = options.projectId || process.env.GOOGLE_CLOUD_PROJECT_ID || '';
    
    if (!this.projectId) {
      throw new Error('GOOGLE_CLOUD_PROJECT_ID environment variable or projectId parameter is required');
    }
    
    // Check if API key is provided
    const apiKey = options.apiKey || process.env.GOOGLE_API_KEY;
    
    // Check if service account path is provided
    const serviceAccountPath = options.serviceAccountPath || process.env.GOOGLE_APPLICATION_CREDENTIALS;
    
    // Check if OAuth credentials are provided
    const oauthClientId = options.oauthClientId || process.env.GOOGLE_OAUTH_CLIENT_ID;
    const oauthClientSecret = options.oauthClientSecret || process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    const oauthRefreshToken = options.oauthRefreshToken || process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
    
    // We need either an API key, a service account, or OAuth credentials
    if (!apiKey && !serviceAccountPath && !(oauthClientId && oauthClientSecret && oauthRefreshToken)) {
      throw new Error('Either GOOGLE_API_KEY, GOOGLE_APPLICATION_CREDENTIALS, or OAuth credentials must be provided');
    }
    
    if (apiKey) {
      // Use API key authentication
      console.log('Using API key authentication');
      this.auth = apiKey;
    } else if (serviceAccountPath) {
      // Check if the credentials file exists
      if (!fs.existsSync(serviceAccountPath)) {
        throw new Error(`Service account key file not found at: ${serviceAccountPath}`);
      }
      
      // Use service account authentication
      console.log('Using service account authentication');
      this.auth = new google.auth.GoogleAuth({
        keyFile: serviceAccountPath,
        scopes: [
          'https://www.googleapis.com/auth/documents',
          'https://www.googleapis.com/auth/drive'
        ]
      });
    } else if (oauthClientId && oauthClientSecret && oauthRefreshToken) {
      // Use OAuth2 authentication
      console.log('Using OAuth2 authentication');
      const oauth2Client = new google.auth.OAuth2(
        oauthClientId,
        oauthClientSecret
      );
      
      oauth2Client.setCredentials({
        refresh_token: oauthRefreshToken
      });
      
      this.auth = oauth2Client;
    }
    
    // Create the docs client
    this.docsClient = google.docs({
      version: 'v1',
      auth: this.auth
    });
    
    // Create the drive client (needed for some operations like creating documents)
    this.driveClient = google.drive({
      version: 'v3',
      auth: this.auth
    });
    
    console.log('Google Docs client initialized');
  }
  
  /**
   * Create a new Google Doc
   * @param title Title of the document
   * @param content Initial content (optional)
   * @returns Created document details
   */
  async createDocument(title: string, content?: string): Promise<any> {
    try {
      // First, create an empty document using Drive API
      const driveResponse = await this.driveClient.files.create({
        requestBody: {
          name: title,
          mimeType: 'application/vnd.google-apps.document'
        }
      });
      
      const documentId = driveResponse.data.id;
      
      // If content is provided, update the document with the content
      if (content && documentId) {
        // Parse the content and create appropriate requests
        const requests = this.convertContentToRequests(content);
        
        if (requests.length > 0) {
          await this.docsClient.documents.batchUpdate({
            documentId,
            requestBody: {
              requests
            }
          });
        }
      }
      
      // Get the document details
      const document = await this.docsClient.documents.get({
        documentId: documentId || ''
      });
      
      return {
        documentId,
        title,
        url: `https://docs.google.com/document/d/${documentId}/edit`,
        document: document.data
      };
    } catch (error: any) {
      console.error('Error creating document:', error);
      return { error: error.message };
    }
  }
  
  /**
   * Get a Google Doc by ID
   * @param documentId ID of the document to retrieve
   * @returns Document details
   */
  async getDocument(documentId: string): Promise<any> {
    try {
      const response = await this.docsClient.documents.get({
        documentId
      });
      
      return response.data;
    } catch (error: any) {
      console.error('Error getting document:', error);
      return { error: error.message };
    }
  }
  
  /**
   * Update a Google Doc with new content
   * @param documentId ID of the document to update
   * @param content New content to add or replace
   * @param replaceAll Whether to replace all content (true) or append (false)
   * @returns Updated document details
   */
  async updateDocument(documentId: string, content: string, replaceAll: boolean = false): Promise<any> {
    try {
      // If replaceAll is true, first clear the document
      if (replaceAll) {
        // Get the current document to find its content
        const currentDoc = await this.docsClient.documents.get({
          documentId
        });
        
        // Check if there's content to delete
        if (currentDoc.data.body?.content && currentDoc.data.body.content.length > 1) {
          // Create a delete request for all content (except the first element which is required)
          const endIndex = currentDoc.data.body.content[currentDoc.data.body.content.length - 1].endIndex || 1;
          
          // Delete all content
          await this.docsClient.documents.batchUpdate({
            documentId,
            requestBody: {
              requests: [
                {
                  deleteContentRange: {
                    range: {
                      startIndex: 1,
                      endIndex: endIndex - 1
                    }
                  }
                }
              ]
            }
          });
        }
      }
      
      // Parse the content and create appropriate requests
      const requests = this.convertContentToRequests(content);
      
      if (requests.length > 0) {
        // Update the document with the new content
        await this.docsClient.documents.batchUpdate({
          documentId,
          requestBody: {
            requests
          }
        });
      }
      
      // Get the updated document
      const document = await this.docsClient.documents.get({
        documentId
      });
      
      return document.data;
    } catch (error: any) {
      console.error('Error updating document:', error);
      return { error: error.message };
    }
  }
  
  /**
   * List documents accessible to the authenticated user
   * @param pageSize Number of documents to return
   * @param pageToken Token for pagination
   * @returns List of documents
   */
  async listDocuments(pageSize: number = 10, pageToken?: string): Promise<any> {
    try {
      const response = await this.driveClient.files.list({
        pageSize,
        pageToken,
        q: "mimeType='application/vnd.google-apps.document'",
        fields: 'nextPageToken, files(id, name, createdTime, modifiedTime, webViewLink)'
      });
      
      return {
        documents: response.data.files,
        nextPageToken: response.data.nextPageToken
      };
    } catch (error: any) {
      console.error('Error listing documents:', error);
      return { error: error.message };
    }
  }
  
  /**
   * Delete a Google Doc
   * @param documentId ID of the document to delete
   * @returns Success status
   */
  async deleteDocument(documentId: string): Promise<any> {
    try {
      await this.driveClient.files.delete({
        fileId: documentId
      });
      
      return {
        success: true,
        documentId,
        message: `Document ${documentId} successfully deleted`
      };
    } catch (error: any) {
      console.error('Error deleting document:', error);
      return { 
        success: false,
        error: error.message 
      };
    }
  }
  
  /**
   * Export a Google Doc to different formats
   * @param documentId ID of the document to export
   * @param mimeType MIME type for export (e.g., 'application/pdf', 'text/plain')
   * @returns Exported document content
   */
  async exportDocument(documentId: string, mimeType: string = 'application/pdf'): Promise<any> {
    try {
      const response = await this.driveClient.files.export({
        fileId: documentId,
        mimeType
      }, {
        responseType: 'arraybuffer'
      });
      
      // Convert the buffer to base64
      const base64Content = Buffer.from(response.data).toString('base64');
      
      return {
        documentId,
        mimeType,
        content: base64Content
      };
    } catch (error: any) {
      console.error('Error exporting document:', error);
      return { error: error.message };
    }
  }
  
  /**
   * Share a Google Doc with specific users
   * @param documentId ID of the document to share
   * @param emailAddress Email address to share with
   * @param role Role to assign (reader, writer, commenter)
   * @returns Share details
   */
  async shareDocument(documentId: string, emailAddress: string, role: string = 'reader'): Promise<any> {
    try {
      const response = await this.driveClient.permissions.create({
        fileId: documentId,
        requestBody: {
          type: 'user',
          role,
          emailAddress
        }
      });
      
      return {
        success: true,
        documentId,
        permission: response.data
      };
    } catch (error: any) {
      console.error('Error sharing document:', error);
      return { 
        success: false,
        error: error.message 
      };
    }
  }
  
  /**
   * Search for documents by title or content
   * @param query Search query
   * @param pageSize Number of results to return
   * @param pageToken Token for pagination
   * @returns Search results
   */
  async searchDocuments(query: string, pageSize: number = 10, pageToken?: string): Promise<any> {
    try {
      const response = await this.driveClient.files.list({
        pageSize,
        pageToken,
        q: `mimeType='application/vnd.google-apps.document' and (name contains '${query}' or fullText contains '${query}')`,
        fields: 'nextPageToken, files(id, name, createdTime, modifiedTime, webViewLink)'
      });
      
      return {
        documents: response.data.files,
        nextPageToken: response.data.nextPageToken
      };
    } catch (error: any) {
      console.error('Error searching documents:', error);
      return { error: error.message };
    }
  }
  
  /**
   * Verify connection with Google Docs API
   * @returns Connection status and details
   */
  async verifyConnection(): Promise<any> {
    try {
      // Try to list a single document to verify connectivity
      const response = await this.driveClient.files.list({
        pageSize: 1,
        q: "mimeType='application/vnd.google-apps.document'",
        fields: 'files(id, name)'
      });
      
      return {
        connected: true,
        projectId: this.projectId,
        timestamp: new Date().toISOString(),
        details: {
          authType: this.getAuthType(),
          apiVersion: 'v1',
          documentCount: response.data.files?.length || 0
        }
      };
    } catch (error: any) {
      console.error('Error verifying Google Docs API connection:', error);
      
      // Return detailed error information
      return {
        connected: false,
        projectId: this.projectId,
        timestamp: new Date().toISOString(),
        error: {
          message: error.message,
          code: error.code || 'UNKNOWN_ERROR',
          details: error.details || error.stack
        }
      };
    }
  }
  
  /**
   * Helper method to determine the authentication type being used
   * @returns Authentication type string
   */
  private getAuthType(): string {
    if (typeof this.auth === 'string') {
      return 'API Key';
    } else if (this.auth instanceof google.auth.GoogleAuth) {
      return 'Service Account';
    } else if (this.auth instanceof google.auth.OAuth2) {
      return 'OAuth2';
    }
    return 'Unknown';
  }
  
  /**
   * Helper method to convert plain text content to Google Docs API requests
   * @param content Plain text content
   * @returns Array of requests for batchUpdate
   */
  private convertContentToRequests(content: string): any[] {
    // For simplicity, we're just inserting text at the beginning of the document
    // In a more advanced implementation, you could parse markdown or HTML
    return [
      {
        insertText: {
          location: {
            index: 1
          },
          text: content
        }
      }
    ];
  }
}
