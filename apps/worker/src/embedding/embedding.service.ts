import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Simple embedding service using hash-based vectors
 * This is a temporary solution that doesn't require ML models
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly vectorDimension: number = 512;
  
  constructor() {
    this.logger.log('Initializing embedding service');
  }
  
  /**
   * Generate embeddings for a batch of texts
   */
  async embedTexts(texts: string[]): Promise<number[][]> {
    this.logger.log(`Generating embeddings for ${texts.length} texts`);
    const startTime = Date.now();
    
    try {
      // Process texts and generate embeddings
      const embeddings = texts.map(text => this.generateDeterministicEmbedding(text));
      
      const duration = Date.now() - startTime;
      this.logger.log(`Generated ${embeddings.length} embeddings in ${duration}ms`);
      
      return embeddings;
    } catch (error) {
      this.logger.error(`Error generating embeddings: ${error.message}`, error.stack);
      throw new Error(`Embedding generation failed: ${error.message}`);
    }
  }
  
  /**
   * Generate a single embedding for a text
   */
  async embedText(text: string): Promise<number[]> {
    return this.generateDeterministicEmbedding(text);
  }
  
  /**
   * Generate a deterministic embedding vector based on text content
   * This uses a hashing approach to create consistent vectors for the same input
   */
  private generateDeterministicEmbedding(text: string): number[] {
    // Create a deterministic seed from the text
    const hash = crypto.createHash('sha256').update(text).digest('hex');
    
    // Use the hash to seed a simple PRNG
    const vector: number[] = new Array(this.vectorDimension).fill(0);
    
    // Fill the vector with deterministic values based on the hash
    for (let i = 0; i < this.vectorDimension; i++) {
      // Use different parts of the hash as seeds for different dimensions
      const byte1 = parseInt(hash.substring((i * 2) % 64, (i * 2 + 2) % 64), 16);
      const byte2 = parseInt(hash.substring((i * 3) % 64, (i * 3 + 2) % 64), 16);
      
      // Generate a value between -1 and 1 using the hash bytes
      vector[i] = (byte1 / 255) * 2 - 1 + ((byte2 / 255) * 0.1); // Add some variation
    }
    
    // Normalize the vector to unit length for cosine similarity
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return vector.map(val => val / magnitude);
  }
} 