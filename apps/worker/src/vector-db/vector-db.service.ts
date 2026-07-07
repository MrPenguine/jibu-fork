import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

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
 * This implementation connects to Qdrant via HTTP API
 */
@Injectable()
export class VectorDbService {
  private readonly logger = new Logger(VectorDbService.name);
  private readonly qdrantUrl: string;
  
  constructor(private readonly configService: ConfigService) {
    this.logger.log('Initializing Qdrant vector database service');
    // Get Qdrant URL from config or use default
    this.qdrantUrl = this.configService.get('QDRANT_URL') || 'http://localhost:6333';
    this.logger.log(`Using Qdrant URL: ${this.qdrantUrl}`);
  }
  
  /**
   * Get a list of all collections
   */
  async getCollections(): Promise<{collections: {name: string}[]}> {
    try {
      const response = await axios.get(`${this.qdrantUrl}/collections`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get collections: ${error.message}`);
      return { collections: [] };
    }
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
    try {
      this.logger.log(`Creating collection: ${name} with vector size ${options.vectors.size}`);
      await axios.put(`${this.qdrantUrl}/collections/${name}`, {
        vectors: options.vectors,
        optimizers_config: options.optimizers_config,
        replication_factor: options.replication_factor,
      });
      this.logger.log(`Collection ${name} created successfully`);
    } catch (error) {
      if (error.response && error.response.status === 409) {
      this.logger.log(`Collection ${name} already exists`);
      } else {
        this.logger.error(`Failed to create collection ${name}: ${error.message}`);
        throw error;
      }
    }
  }
  
  /**
   * Ensure a collection exists, creating it if needed. If the collection exists
   * but its declared vector size does not match the expected dimension, it is
   * dropped and recreated so the new model's dimension is used.
   */
  async ensureCollection(name: string, vectorSize?: number): Promise<void> {
    const dimension = vectorSize;
    if (!dimension) {
      throw new Error(`Cannot ensure collection ${name}: vector size is required`);
    }

    try {
      this.logger.log(`Ensuring collection ${name} exists with vector size ${dimension}`);
      
      // Check if collection exists and has the right size
      const existingSize = await this.getCollectionVectorSize(name);
      if (existingSize !== null && existingSize !== dimension) {
        this.logger.warn(
          `Collection ${name} has vector size ${existingSize}, expected ${dimension}. Dropping and recreating.`,
        );
        await this.deleteCollection(name);
      } else if (existingSize === dimension) {
        this.logger.log(`Collection ${name} already exists with correct vector size ${dimension}`);
        return;
      }
      
      await this.createCollection(name, {
        vectors: {
          size: dimension,
          distance: 'Cosine',
        },
        optimizers_config: {
          default_segment_number: 2,
        },
        replication_factor: 1,
      });
    } catch (error) {
      this.logger.error(`Error ensuring collection ${name}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Return the declared vector size for a collection, or null if it does not exist.
   */
  async getCollectionVectorSize(name: string): Promise<number | null> {
    try {
      const response = await axios.get(`${this.qdrantUrl}/collections/${name}`);
      const size = response.data?.result?.config?.params?.vectors?.size;
      return typeof size === 'number' ? size : null;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return null;
      }
      this.logger.warn(`Error reading collection ${name} size: ${error.message}`);
      return null;
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
      dimension?: number;
    }
  ): Promise<void> {
    try {
      await this.ensureCollection(collection, data.dimension);

      // Expected dimension for validation: explicit param or the vectors' own length.
      const expectedDimension =
        data.dimension ||
        data.points[0]?.vector?.length;
      if (!expectedDimension) {
        throw new Error(`Cannot upsert to collection ${collection}: dimension is required`);
      }
    
      // Format points for Qdrant API
      const qdrantPoints = data.points.map(point => {
        // Ensure point ID is a valid UUID without hyphens (Qdrant format)
        const pointId = typeof point.id === 'string' ? 
          point.id.replace(/-/g, '') : // Remove hyphens if it's a UUID with hyphens
          String(point.id);
        
        // Ensure vectors are valid floats, not NaN or Infinity
        const sanitizedVector = point.vector.map(v => {
          if (Number.isNaN(v) || !Number.isFinite(v)) {
            return 0.0; // Replace invalid values with 0
          }
          return v;
        });
        
        // Check if vector has valid length
        if (sanitizedVector.length !== expectedDimension) {
          this.logger.warn(`Vector dimension mismatch: ${sanitizedVector.length} vs expected ${expectedDimension}`);
        }
        
        // Ensure payload doesn't contain circular references or invalid types
        let sanitizedPayload = {};
        try {
          // Only keep simple types in payload
          Object.keys(point.payload || {}).forEach(key => {
            const value = point.payload[key];
            if (
              typeof value === 'string' || 
              typeof value === 'number' || 
              typeof value === 'boolean' ||
              value === null
            ) {
              sanitizedPayload[key] = value;
            } else if (Array.isArray(value) && value.every(item => typeof item === 'string' || typeof item === 'number')) {
              sanitizedPayload[key] = value;
            } else {
              sanitizedPayload[key] = String(value); // Convert other types to string
            }
          });
        } catch (e) {
          this.logger.warn(`Error sanitizing payload: ${e.message}. Using minimal payload.`);
          sanitizedPayload = { 
            text: typeof point.payload?.text === 'string' ? 
              point.payload.text.substring(0, 1000) : 'Invalid text',
            sourceId: point.payload?.sourceId || 'unknown'
          };
        }
        
        return {
          id: pointId,
          vector: sanitizedVector,
          payload: sanitizedPayload
        };
      });
      
      const waitParam = data.wait !== false;
      
      // Log the first point for debugging (abbreviated)
      if (qdrantPoints.length > 0) {
        const samplePoint = {...qdrantPoints[0]};
        if (samplePoint.vector) {
          // Use proper type handling for the vector preview
          const vectorPreview = samplePoint.vector.slice(0, 5);
          this.logger.debug(`Sample point: ${JSON.stringify({
            ...samplePoint,
            vector: [...vectorPreview, '...more']
          })}`);
        } else {
          this.logger.debug(`Sample point: ${JSON.stringify(samplePoint)}`);
        }
      }
      
      // Split into smaller batches to avoid request size limits
      const BATCH_SIZE = 100;
      for (let i = 0; i < qdrantPoints.length; i += BATCH_SIZE) {
        const batch = qdrantPoints.slice(i, i + BATCH_SIZE);
        this.logger.log(`Upserting batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(qdrantPoints.length/BATCH_SIZE)} of ${batch.length} points`);
        
        await axios.put(`${this.qdrantUrl}/collections/${collection}/points?wait=${waitParam}`, {
          points: batch
        });
      }
      
      this.logger.log(`Upserted ${qdrantPoints.length} points to collection ${collection}`);
    } catch (error) {
      this.logger.error(`Failed to upsert points to collection ${collection}: ${error.message}`);
      
      // Log more details about the error
      if (error.response) {
        this.logger.error(`Response data: ${JSON.stringify(error.response.data)}`);
      }
      
      throw error;
    }
  }
  
  /**
   * Check if a collection exists
   */
  async collectionExists(name: string): Promise<boolean> {
    try {
      const response = await axios.get(`${this.qdrantUrl}/collections/${name}`);
      return response.status === 200;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return false;
      }
      // For other errors, log but don't fail - assume it might exist
      this.logger.warn(`Error checking if collection ${name} exists: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Delete vectors from a collection by a filter
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
    try {
      // First check if collection exists to avoid unnecessary API calls
      const exists = await this.collectionExists(collection);
    
      if (!exists) {
        this.logger.warn(`Collection ${collection} doesn't exist, skipping delete operation`);
      return;
    }
    
      const url = `${this.qdrantUrl}/collections/${collection}/points/delete`;
      
      // If no filter, clear the collection points
      if (!filter.filter?.must) {
        this.logger.debug(`Deleting all vectors from ${collection}`);
        const response = await axios.post(url, {
          filter: {} // Empty filter means delete all points
        });
        
        if (response.status === 200) {
          this.logger.debug(`Successfully cleared all vectors from ${collection}`);
        } else {
          this.logger.warn(`Unexpected response when clearing vectors: ${response.status} ${response.statusText}`);
        }
        return;
      }
      
      // Convert our filter format to Qdrant's filter format
      const qdrantFilter = {
        must: filter.filter.must.map(condition => ({
          key: condition.key,
          match: condition.match
        }))
      };
      
      this.logger.debug(`Deleting vectors from ${collection} with filter: ${JSON.stringify(qdrantFilter)}`);
      
      const response = await axios.post(url, {
        filter: qdrantFilter,
        wait: filter.wait !== false
      });
      
      if (response.status === 200) {
        this.logger.debug(`Successfully deleted vectors from ${collection}`);
        
        // Log response data for debugging
        if (response.data) {
          this.logger.debug(`Delete response: ${JSON.stringify(response.data)}`);
        }
      } else {
        this.logger.warn(`Unexpected response when deleting vectors: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      // Enhanced error logging for better diagnostics
      this.logger.error(`Error deleting vectors from collection ${collection}: ${error.message}`);
      
      if (error.response) {
        // The request was made and the server responded with a status code outside of 2xx
        this.logger.error(`Qdrant API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      } else if (error.request) {
        // The request was made but no response was received
        this.logger.error(`No response received from Qdrant: ${error.request}`);
      }
      
      throw new Error(`Failed to delete vectors: ${error.message}`);
    }
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
    try {
      const response = await axios.post(`${this.qdrantUrl}/collections/${collection}/points/search`, {
        vector: query.vector,
        limit: query.limit,
        with_payload: query.with_payload !== false,
        with_vector: query.with_vector === true,
        filter: query.filter
      });
      
      return response.data.result || [];
    } catch (error) {
      this.logger.error(`Failed to search in collection ${collection}: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Scroll through all points in a collection
   * This is useful for retrieving all points for local processing
   */
  async scroll(
    collection: string,
    options: {
      limit?: number;
      offset?: number;
      with_payload?: boolean;
      with_vector?: boolean;
      filter?: any;
    } = {}
  ): Promise<SearchResult[]> {
    try {
      const { limit = 100, offset = 0, with_payload = true, with_vector = false, filter } = options;
      
      // Check if collection exists first
      const exists = await this.collectionExists(collection);
      if (!exists) {
        this.logger.warn(`Collection ${collection} does not exist for scroll operation`);
        return [];
      }
      
      const response = await axios.post(`${this.qdrantUrl}/collections/${collection}/points/scroll`, {
        limit,
        offset,
        with_payload,
        with_vector,
        filter
      });
      
      return response.data.result || [];
    } catch (error) {
      this.logger.error(`Failed to scroll collection ${collection}: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Retrieve specific points by their ids (payload + optional vector).
   * Accepts ids with or without hyphens (Qdrant stores them hyphen-stripped).
   */
  async retrieve(
    collection: string,
    ids: string[],
    options: { with_payload?: boolean; with_vector?: boolean } = {},
  ): Promise<SearchResult[]> {
    try {
      const exists = await this.collectionExists(collection);
      if (!exists) return [];

      const normalizedIds = ids.map((id) =>
        typeof id === 'string' ? id.replace(/-/g, '') : String(id),
      );

      const response = await axios.post(
        `${this.qdrantUrl}/collections/${collection}/points`,
        {
          ids: normalizedIds,
          with_payload: options.with_payload !== false,
          with_vector: options.with_vector === true,
        },
      );
      return response.data.result || [];
    } catch (error) {
      this.logger.error(`Failed to retrieve points from ${collection}: ${error.message}`);
      return [];
    }
  }

  /**
   * Delete specific points by their ids.
   */
  async deleteByIds(collection: string, ids: string[]): Promise<void> {
    try {
      const exists = await this.collectionExists(collection);
      if (!exists) {
        this.logger.warn(`Collection ${collection} doesn't exist, skipping deleteByIds`);
        return;
      }
      const normalizedIds = ids.map((id) =>
        typeof id === 'string' ? id.replace(/-/g, '') : String(id),
      );
      await axios.post(
        `${this.qdrantUrl}/collections/${collection}/points/delete?wait=true`,
        { points: normalizedIds },
      );
      this.logger.debug(`Deleted ${normalizedIds.length} points from ${collection}`);
    } catch (error) {
      this.logger.error(`Failed to delete points by id from ${collection}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a collection
   */
  async deleteCollection(name: string): Promise<boolean> {
    try {
      // First check if collection exists
      const exists = await this.collectionExists(name);
      
      if (!exists) {
        this.logger.warn(`Collection ${name} doesn't exist, skipping deletion`);
        return false;
      }
      
      const response = await axios.delete(`${this.qdrantUrl}/collections/${name}`);
      
      if (response.status === 200) {
        this.logger.debug(`Successfully deleted collection ${name}`);
        return true;
      } else {
        this.logger.warn(`Unexpected response when deleting collection: ${response.status} ${response.statusText}`);
        return false;
      }
    } catch (error) {
      this.logger.error(`Failed to delete collection ${name}: ${error.message}`);
      
      if (error.response) {
        this.logger.error(`Qdrant API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    }
    
      return false;
    }
  }
} 