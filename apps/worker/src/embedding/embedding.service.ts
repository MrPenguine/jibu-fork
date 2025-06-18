import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Simple embedding service using hash-based vectors
 * This is a temporary solution that doesn't require ML models
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  
  constructor(private readonly configService: ConfigService) {
    this.logger.log('Initializing embedding service');
  }
  
  /**
   * Create embeddings for an array of texts
   */
  async embedTexts(texts: string[]): Promise<number[][]> {
    this.logger.log(`Generating embeddings for ${texts.length} texts`);
    const startTime = Date.now();
    
    try {
      // Generate random embeddings of the configured dimension for the MVP
      const dimension = parseInt(this.configService.get('VECTOR_DIMENSION') || '512', 10);
      
      // Create embeddings
      const embeddings = texts.map(text => {
        // For actual embeddings, we would call a real embedding API or model here
        // For now, generate random vectors of the configured dimension
        // Use deterministic approach based on the hash of the text
        const vector = new Array(dimension).fill(0);
        
        // Only generate actual embeddings for valid text content
        if (text && !text.startsWith('%PDF') && !/^\uFFFD/.test(text)) {
          // Simple hash function to get deterministic vectors based on text
          let hash = 0;
          for (let i = 0; i < text.length; i++) {
            hash = ((hash << 5) - hash) + text.charCodeAt(i);
            hash |= 0; // Convert to 32bit integer
          }
          
          // Seed random with hash
          const random = seedRandom(hash);
          
          // Fill vector with deterministic random values between -1 and 1
          for (let i = 0; i < dimension; i++) {
            vector[i] = random() * 2 - 1;
          }
          
          // Normalize the vector to have a magnitude of 1
          const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
          if (magnitude > 0) {
            for (let i = 0; i < dimension; i++) {
              vector[i] /= magnitude;
            }
          }
        } else {
          // For binary or invalid content, use a small non-zero vector instead of zeros
          // This helps avoid issues with Qdrant rejecting malformed vectors
          for (let i = 0; i < dimension; i++) {
            vector[i] = 0.00001 * (i % 2 === 0 ? 1 : -1);
          }
          
          // Normalize this tiny vector too
          const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
          if (magnitude > 0) {
            for (let i = 0; i < dimension; i++) {
              vector[i] /= magnitude;
            }
          }
        }
        
        return vector;
      });
      
      const elapsed = Date.now() - startTime;
      this.logger.log(`Generated ${embeddings.length} embeddings in ${elapsed}ms`);
      
      return embeddings;
    } catch (error) {
      this.logger.error(`Error generating embeddings: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Generate a single embedding for a text
   */
  async embedText(text: string): Promise<number[]> {
    const dimension = parseInt(this.configService.get('VECTOR_DIMENSION') || '512', 10);
    
    // Create a simple embedding based on text
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0;
    }
    
    const random = seedRandom(hash);
    const vector = new Array(dimension).fill(0);
    
    for (let i = 0; i < dimension; i++) {
      vector[i] = random() * 2 - 1;
    }
    
    // Normalize
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < dimension; i++) {
        vector[i] /= magnitude;
      }
    }
    
    return vector;
  }
}

/**
 * Simple seedable random number generator
 */
function seedRandom(seed: number) {
  return function() {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };
} 