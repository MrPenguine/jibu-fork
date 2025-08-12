import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware that redacts sensitive information from request bodies and logs
 * to prevent exposure of sensitive data in logs and error messages
 */
@Injectable()
export class RedactionLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RedactionLoggingMiddleware.name);
  
  // List of keys that should be redacted from logs
  private readonly sensitiveKeys = [
    'apiKey',
    'token',
    'encryptedKeyValue',
    'password',
    'secret',
    'accessToken',
    'refreshToken',
    'authorization',
    'key',
    'privateKey',
    'credential',
    'jwt',
  ];

  use(req: Request, res: Response, next: NextFunction) {
    // Clone the request body to avoid modifying the original
    if (req.body) {
      // Store original body for processing
      const originalBody = JSON.parse(JSON.stringify(req.body));
      
      // Create a redacted copy for logging
      const redactedBody = this.redactSensitiveData(originalBody);
      
      // Log the redacted request body
      this.logger.log(`Request [${req.method}] ${req.url}: ${JSON.stringify(redactedBody)}`);
    } else {
      this.logger.log(`Request [${req.method}] ${req.url}`);
    }

    // Capture and redact response body
    const originalSend = res.send;
    res.send = function(body) {
      const response = body;
      
      // Only attempt to redact if the response is JSON
      if (typeof response === 'string' && response.startsWith('{')) {
        try {
          const parsedResponse = JSON.parse(response);
          const redactedResponse = this.redactSensitiveData(parsedResponse);
          this.logger.log(`Response: ${JSON.stringify(redactedResponse)}`);
        } catch (e) {
          // If parsing fails, don't log the response body
          this.logger.log(`Response: [Non-JSON response]`);
        }
      }
      
      return originalSend.call(this, body);
    }.bind(this);

    next();
  }

  /**
   * Recursively redacts sensitive data from objects
   * @param data The data to redact
   * @returns A copy of the data with sensitive values redacted
   */
  redactSensitiveData(data: any): any {
    if (!data) return data;
    
    // Handle different data types
    if (typeof data !== 'object') {
      return data;
    }
    
    // Handle arrays
    if (Array.isArray(data)) {
      return data.map(item => this.redactSensitiveData(item));
    }
    
    // Handle objects
    const result = { ...data };
    
    for (const key in result) {
      // Check if the key is sensitive (case-insensitive)
      const lowerKey = key.toLowerCase();
      const isSensitive = this.sensitiveKeys.some(
        sensitiveKey => lowerKey.includes(sensitiveKey.toLowerCase())
      );
      
      if (isSensitive) {
        // Redact sensitive values
        result[key] = '[REDACTED]';
      } else if (typeof result[key] === 'object' && result[key] !== null) {
        // Recursively process nested objects
        result[key] = this.redactSensitiveData(result[key]);
      }
    }
    
    return result;
  }
}
