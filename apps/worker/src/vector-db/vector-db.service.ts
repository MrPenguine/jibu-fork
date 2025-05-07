import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface VectorEntry {
  id: string;
  vector: number[];
  payload: Record<string, any>;
}

export interface SearchResult {
  id: string;
  score: number;
  vector?: number[];
  payload?: Record<string, any>;
}

/**
 * Vector database service for storing and retrieving vectors
 * This implementation uses a simple in-memory store for development
 * In production, this would connect to a real vector database like Qdrant
 */
@Injectable()
export class VectorDbService {
  private readonly logger = new Logger(VectorDbService.name);
  private collections: Map<string, VectorEntry[]> = new Map();
  
  constructor(private readonly configService: ConfigService) {
    this.logger.log('Initializing vector database service');
  }
  
  /**
   * Get a list of all collections
   */
  async getCollections(): Promise<{collections: {name: string}[]}> {
    return {
      collections: Array.from(this.collections.keys()).map(name => ({ name }))
    };
  }
  
  /**
   * Create a new collection
   */
  async createCollection(
    name: string, 
    options: {
      vectors: { size: number; distance: string };
      optimizers_config?: any;
      replication_factor?: number;
    }
  ): Promise<void> {
    if (this.collections.has(name)) {
      this.logger.log(`Collection ${name} already exists`);
      return;
    }
    
    this.logger.log(`Creating collection: ${name} with vector size ${options.vectors.size}`);
    this.collections.set(name, []);
  }
  
  /**
   * Ensure a collection exists, creating it if needed
   */
  async ensureCollection(name: string, vectorSize: number = 512): Promise<void> {
    const collections = await this.getCollections();
    const exists = collections.collections.some(c => c.name === name);
    
    if (!exists) {
      await this.createCollection(name, {
        vectors: {
          size: vectorSize,
          distance: 'Cosine',
        },
        optimizers_config: {
          default_segment_number: 2,
        },
        replication_factor: 1,
      });
    }
  }
  
  /**
   * Add or update vectors in a collection
   */
  async upsert(
    collection: string, 
    data: {
      points: VectorEntry[];
      wait?: boolean;
    }
  ): Promise<void> {
    await this.ensureCollection(collection);
    
    const collectionData = this.collections.get(collection) || [];
    
    // Remove existing points with same IDs
    const existingIds = new Set(data.points.map(p => p.id));
    const filtered = collectionData.filter(p => !existingIds.has(p.id));
    
    // Add new points
    this.collections.set(collection, [...filtered, ...data.points]);
    this.logger.log(`Upserted ${data.points.length} points to collection ${collection}`);
  }
  
  /**
   * Delete vectors from a collection
   */
  async delete(
    collection: string, 
    filter: {
      filter?: {
        must?: Array<{
          key: string;
          match: {
            value: any;
          };
        }>;
      };
      wait?: boolean;
    }
  ): Promise<void> {
    const collectionData = this.collections.get(collection) || [];
    
    if (!filter.filter?.must) {
      // If no filter, clear the collection
      this.collections.set(collection, []);
      this.logger.log(`Cleared all points from collection ${collection}`);
      return;
    }
    
    // Apply filters
    const filtered = collectionData.filter(point => {
      for (const condition of filter.filter.must) {
        const { key, match } = condition;
        const pointValue = point.payload?.[key];
        
        if (pointValue !== match.value) {
          return true; // Keep points that don't match the filter
        }
      }
      
      return false; // Remove points that match all conditions
    });
    
    const removedCount = collectionData.length - filtered.length;
    this.collections.set(collection, filtered);
    this.logger.log(`Deleted ${removedCount} points from collection ${collection}`);
  }
  
  /**
   * Search for similar vectors
   */
  async search(
    collection: string, 
    query: {
      vector: number[];
      limit: number;
      with_payload?: boolean;
      with_vector?: boolean;
      filter?: any;
    }
  ): Promise<SearchResult[]> {
    const collectionData = this.collections.get(collection) || [];
    
    if (collectionData.length === 0) {
      return [];
    }
    
    // Calculate cosine similarity for each vector
    const results = collectionData.map(entry => {
      const score = this.cosineSimilarity(query.vector, entry.vector);
      
      return {
        id: entry.id,
        score,
        ...(query.with_vector ? { vector: entry.vector } : {}),
        ...(query.with_payload ? { payload: entry.payload } : {}),
      };
    });
    
    // Sort by similarity score (descending)
    results.sort((a, b) => b.score - a.score);
    
    // Return top N results
    return results.slice(0, query.limit);
  }
  
  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error(`Vector dimensions don't match: ${a.length} vs ${b.length}`);
    }
    
    let dotProduct = 0;
    let aMagnitude = 0;
    let bMagnitude = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      aMagnitude += a[i] * a[i];
      bMagnitude += b[i] * b[i];
    }
    
    aMagnitude = Math.sqrt(aMagnitude);
    bMagnitude = Math.sqrt(bMagnitude);
    
    if (aMagnitude === 0 || bMagnitude === 0) {
      return 0;
    }
    
    return dotProduct / (aMagnitude * bMagnitude);
  }
} 