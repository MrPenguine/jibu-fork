import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../../core/redis/redis.service';
import axios from 'axios';
import { createHash } from 'crypto';
import { EmbeddingService } from '../../../../../../worker/src/embedding/embedding.service';
import { VectorDbService, SearchResult } from '../../../../../../worker/src/vector-db/vector-db.service';

// Using SearchResult interface imported from vector-db.service

interface FallbackSearchOptions {
  exactMatch?: boolean;
  fuzzyMatch?: boolean;
  keywordMatch?: boolean;
  minScore?: number;
}

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  private readonly workerApiUrl: string;
  private readonly qdrantUrl: string;
  private readonly cacheTtl: number = 5; // 5 seconds TTL
  private readonly embeddingService: EmbeddingService;
  private readonly vectorDbService: VectorDbService;
  private readonly maxRetries: number = 2;
  private readonly fallbackThreshold: number = 0.15; // Threshold below which fallback searches are triggered
  
  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService
  ) {
    this.workerApiUrl = this.configService.get<string>('WORKER_API_URL') || 'http://localhost:3001';
    this.qdrantUrl = this.configService.get<string>('QDRANT_URL') || 'http://localhost:6333';
    
    // Initialize the embedding and vector database services directly
    this.embeddingService = new EmbeddingService(configService);
    this.vectorDbService = new VectorDbService(configService);
    
    this.logger.log(`Initialized RAG service with direct access to embedding and vector DB services`);
  }
  
  /**
   * Generate an embedding for a query using the embedding service directly
   */
  private async generateEmbedding(query: string): Promise<number[]> {
    try {
      // Generate a cache key based on the query
      const cacheKey = `embedding:${createHash('md5').update(query).digest('hex')}`;
      
      // Check if embedding is in cache
      const cachedEmbeddingJson = await this.redisService.get(cacheKey);
      if (cachedEmbeddingJson) {
        this.logger.debug(`Using cached embedding for query: ${query.substring(0, 30)}...`);
        return JSON.parse(cachedEmbeddingJson);
      }
      
      // Use the embedding service directly. Use the RETRIEVAL_QUERY task type
      // (embedQuery) so query embeddings are optimized for search rather than
      // the RETRIEVAL_DOCUMENT type used when indexing.
      this.logger.log(`Generating embedding directly for query: ${query.substring(0, 30)}...`);
      const embedding = await this.embeddingService.embedQuery(query);
      
      // Cache the embedding
      await this.redisService.set(cacheKey, JSON.stringify(embedding), this.cacheTtl);
      
      return embedding;
    } catch (error) {
      this.logger.error(`Error generating embedding: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Extract keywords from a query
   * @param query The query to extract keywords from
   * @returns An array of keywords
   */
  private extractKeywords(query: string): string[] {
    // Remove common stop words and punctuation
    const stopWords = ['a', 'an', 'the', 'is', 'are', 'in', 'on', 'at', 'of', 'for', 'with', 'by', 'to', 'from', 'and', 'or', 'but'];
    
    // Clean the query and split into words
    const words = query.toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 1 && !stopWords.includes(word));
    
    // Return unique keywords
    return [...new Set(words)];
  }

  /**
   * Perform a fallback search using alternative methods
   */
  private async fallbackSearch(
    knowledgeBaseId: string, 
    query: string, 
    limit: number = 5,
    options: FallbackSearchOptions = {}
  ): Promise<SearchResult[]> {
    const { exactMatch = true, fuzzyMatch = true, keywordMatch = true, minScore = 0.1 } = options;
    
    const collectionName = `kb_${knowledgeBaseId}`;
    let results: SearchResult[] = [];
    
    try {
      // Extract keywords for keyword-based search
      const keywords = this.extractKeywords(query);
      this.logger.log(`[RAG DEBUG] Extracted keywords for fallback search: ${keywords.join(', ')}`);
      
      // Get all vectors from the collection for local processing
      let allVectors = [];
      try {
        // Check if collection exists first
        let collectionExists = false;
        try {
          // First check if the collection exists directly
          await axios.get(`${this.qdrantUrl}/collections/${collectionName}`);
          collectionExists = true;
          this.logger.log(`[RAG DEBUG] Collection ${collectionName} exists for fallback search`);
        } catch (collectionError) {
          if (collectionError.response && collectionError.response.status === 404) {
            this.logger.warn(`[RAG DEBUG] Collection ${collectionName} does not exist for fallback search`);
            return [];
          }
          this.logger.warn(`[RAG DEBUG] Error checking collection existence: ${collectionError.message}`);
        }
        
        if (!collectionExists) {
          this.logger.warn(`[RAG DEBUG] Cannot perform fallback search on non-existent collection`);
          return [];
        }
        
        // The scroll method returns an array of SearchResult objects directly
        const response = await this.vectorDbService.scroll(collectionName, { limit: 500, with_payload: true });
        
        // Ensure we have a valid response
        if (response && Array.isArray(response)) {
          allVectors = response;
          this.logger.log(`[RAG DEBUG] Retrieved ${allVectors.length} vectors for fallback search`);
        } else if (response && typeof response === 'object') {
          // Type assertion to allow accessing potential properties
          const responseObj = response as Record<string, any>;
          
          // Check for points property (Qdrant API standard response)
          if (responseObj.points && Array.isArray(responseObj.points)) {
            allVectors = responseObj.points;
            this.logger.log(`[RAG DEBUG] Retrieved ${allVectors.length} vectors from response.points for fallback search`);
          } 
          // Check for result property (alternative response format)
          else if (responseObj.result && Array.isArray(responseObj.result)) {
            allVectors = responseObj.result;
            this.logger.log(`[RAG DEBUG] Retrieved ${allVectors.length} vectors from response.result for fallback search`);
          } else {
            this.logger.warn(`[RAG DEBUG] Response object does not contain a valid points or result array`);
            return [];
          }
        } else {
          this.logger.warn(`[RAG DEBUG] Retrieved undefined or invalid vectors for fallback search`);
          return [];
        }
      } catch (error) {
        this.logger.error(`[RAG DEBUG] Error retrieving vectors for fallback search: ${error.message}`);
        if (error.response) {
          this.logger.error(`[RAG DEBUG] Error response status: ${error.response.status}, data: ${JSON.stringify(error.response.data)}`);
        }
        return [];
      }
      
      if (allVectors.length === 0) {
        this.logger.warn(`[RAG DEBUG] No vectors found in collection ${collectionName} for fallback search`);
        return [];
      }
      
      // Process each vector
      const processedResults = [];
      
      for (const vector of allVectors) {
        if (!vector || !vector.payload) {
          this.logger.debug(`[RAG DEBUG] Skipping invalid vector in fallback search`);
          continue;
        }
        
        const text = vector.payload?.text || '';
        if (!text) {
          this.logger.debug(`[RAG DEBUG] Skipping vector with no text in payload: ${vector.id}`);
          continue;
        }
        
        let score = 0;
        
        // Exact match search
        if (exactMatch && text.toLowerCase().includes(query.toLowerCase())) {
          // Give a high score for exact matches
          score = Math.max(score, 0.9);
          this.logger.debug(`[RAG DEBUG] Found exact match for "${query}" in document ${vector.id}`);
        }
        
        // Keyword match search
        if (keywordMatch && keywords.length > 0) {
          const matchedKeywords = keywords.filter(keyword => 
            text.toLowerCase().includes(keyword.toLowerCase())
          );
          
          if (matchedKeywords.length > 0) {
            // Score based on the percentage of keywords matched
            const keywordScore = (matchedKeywords.length / keywords.length) * 0.8;
            score = Math.max(score, keywordScore);
            this.logger.debug(`[RAG DEBUG] Matched ${matchedKeywords.length}/${keywords.length} keywords in document ${vector.id}`);
          }
        }
        
        // Fuzzy match search (simplified implementation)
        if (fuzzyMatch) {
          const words = query.toLowerCase().split(/\s+/);
          const textWords = text.toLowerCase().split(/\s+/);
          
          // Count words that are similar (contain one another)
          let matchedWords = 0;
          for (const word of words) {
            if (word.length < 3) continue; // Skip very short words
            
            for (const textWord of textWords) {
              if (textWord.includes(word) || word.includes(textWord)) {
                matchedWords++;
                break;
              }
            }
          }
          
          if (matchedWords > 0) {
            const fuzzyScore = (matchedWords / words.length) * 0.7;
            score = Math.max(score, fuzzyScore);
            this.logger.debug(`[RAG DEBUG] Fuzzy matched ${matchedWords}/${words.length} words in document ${vector.id}`);
          }
        }
        
        // Add to results if score is above threshold
        if (score >= minScore) {
          processedResults.push({
            id: vector.id,
            score: score,
            payload: vector.payload
          });
        }
      }
      
      // Sort by score (highest first) and limit results
      results = processedResults
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
      
      this.logger.log(`[RAG DEBUG] Fallback search found ${results.length} results`);
      
      return results;
    } catch (error) {
      this.logger.error(`[RAG DEBUG] Error in fallback search: ${error.message}`);
      return [];
    }
  }

  /**
   * Search for relevant documents in the knowledge base
   */
  async searchKnowledgeBase(knowledgeBaseId: string, query: string, limit: number = 5): Promise<SearchResult[]> {
    try {
      this.logger.log(`[RAG DEBUG] Searching knowledge base ${knowledgeBaseId} for query: ${query}`);
      
      if (!knowledgeBaseId) {
        this.logger.warn(`[RAG DEBUG] Knowledge base ID is missing or empty`);
        return [];
      }
      
      // Generate a cache key based on the knowledge base ID and query
      const cacheKey = `search:${knowledgeBaseId}:${createHash('md5').update(query).digest('hex')}:${limit}`;
      
      // Check if results are in cache
      const cachedResultsJson = await this.redisService.get(cacheKey);
      if (cachedResultsJson) {
        this.logger.debug(`[RAG DEBUG] Using cached search results for knowledge base ${knowledgeBaseId} and query: ${query.substring(0, 30)}...`);
        return JSON.parse(cachedResultsJson);
      }
      
      // Generate embedding for the query using the embedding service directly
      const embedding = await this.generateEmbedding(query);
      
      // Use the vector database service directly to search
      const collectionName = `kb_${knowledgeBaseId}`;
      this.logger.log(`[RAG DEBUG] Using collection name: ${collectionName}`);
      
      try {
        // Check if collection exists
        try {
          // First check if the collection exists directly
          await axios.get(`${this.qdrantUrl}/collections/${collectionName}`);
          this.logger.log(`[RAG DEBUG] Collection ${collectionName} exists in Qdrant`);
        } catch (collectionError) {
          if (collectionError.response && collectionError.response.status === 404) {
            this.logger.warn(`[RAG DEBUG] Collection ${collectionName} does not exist in Qdrant`);
            return [];
          }
          // For other errors, continue with the search attempt
          this.logger.warn(`[RAG DEBUG] Error checking collection existence: ${collectionError.message}`);
        }
        
        this.logger.log(`[RAG DEBUG] Collection ${collectionName} exists, searching directly`);
        
        // Search using the vector database service directly
        const results = await this.vectorDbService.search(collectionName, {
          vector: embedding,
          limit: limit,
          with_payload: true
        });
        
        // Check if we need to use fallback search strategies
        if (!results || results.length === 0 || 
            (results.length > 0 && results[0].score < this.fallbackThreshold)) {
          this.logger.warn(`[RAG DEBUG] Vector search results insufficient for knowledge base ${knowledgeBaseId}, score: ${results.length > 0 ? results[0].score : 'N/A'}`);
          
          // Try fallback search strategies
          this.logger.log(`[RAG DEBUG] Attempting fallback search strategies for query: ${query}`);
          const fallbackResults = await this.fallbackSearch(knowledgeBaseId, query, limit);
          
          if (fallbackResults && fallbackResults.length > 0) {
            this.logger.log(`[RAG DEBUG] Fallback search successful, found ${fallbackResults.length} results`);
            
            // Merge results, keeping the highest scoring ones
            const mergedResults = [...(results || []), ...fallbackResults]
              .sort((a, b) => b.score - a.score)
              .slice(0, limit);
            
            // If we still have results after fallback, use those
            if (mergedResults.length > 0) {
              return mergedResults;
            }
          } else {
            this.logger.warn(`[RAG DEBUG] Fallback search also found no results`);
          }
          
          // If we have no results at all
          if (!results || results.length === 0) {
            return [];
          }
        }
        
        // Log the first result for debugging
        if (results.length > 0) {
          this.logger.log(`[RAG DEBUG] First result: ${JSON.stringify({
            id: results[0].id,
            score: results[0].score,
            text: results[0].payload?.text?.substring(0, 100) + '...' || 'No text'
          })}`);
        }
        
        // Cache the results
        await this.redisService.set(cacheKey, JSON.stringify(results), this.cacheTtl);
        
        this.logger.log(`[RAG DEBUG] Found ${results.length} results for knowledge base ${knowledgeBaseId}`);
        
        return results;
      } catch (error) {
        this.logger.error(`[RAG DEBUG] Error searching knowledge base: ${error.message}`);
        
        // Return empty results to avoid breaking the agent flow
        return [];
      }
    } catch (error) {
      this.logger.error(`Error searching knowledge base ${knowledgeBaseId}: ${error.message}`);
      
      // Return empty results to avoid breaking the agent flow
      return [];
    }
  }
  
  /**
   * Format search results as context for the LLM
   */
  formatSearchResultsAsContext(results: SearchResult[]): string {
    if (!results || results.length === 0) {
      return '';
    }
    
    // Sort by score (highest first)
    const sortedResults = [...results].sort((a, b) => b.score - a.score);
    
    // Format as context
    let context = 'Here is some relevant information from the knowledge base:\n\n';
    
    sortedResults.forEach((result, index) => {
      if (result.payload && result.payload.text) {
        // Include score information for debugging purposes
        const scoreInfo = `[Score: ${result.score.toFixed(3)}]`;
        context += `[Document ${index + 1}] ${scoreInfo}\n${result.payload.text}\n\n`;
      }
    });
    
    return context;
  }
  
  /**
   * Preprocess the query to improve search results
   * @param query The original query
   * @returns The preprocessed query
   */
  preprocessQuery(query: string): string {
    // Remove question marks and other punctuation that might affect search
    let processedQuery = query.replace(/\?/g, '');
    
    // Remove common prefixes that don't add semantic value
    const prefixesToRemove = [
      'tell me about', 'what is', 'who is', 'where is', 'when is',
      'how is', 'can you tell me about', 'i want to know about',
      'please tell me about', 'do you know', 'is there'
    ];
    
    for (const prefix of prefixesToRemove) {
      if (processedQuery.toLowerCase().startsWith(prefix)) {
        processedQuery = processedQuery.substring(prefix.length).trim();
        break;
      }
    }
    
    // If the query is asking about a category or classification, extract the entity name
    if (processedQuery.toLowerCase().includes('category') || 
        processedQuery.toLowerCase().includes('classified as') ||
        processedQuery.toLowerCase().includes('type of') ||
        processedQuery.toLowerCase().includes('which category') ||
        processedQuery.toLowerCase().includes('is in which')) {
      
      // Extract entity names that might be mentioned (proper nouns starting with capital letters)
      const entityMatch = processedQuery.match(/([A-Z][a-z]+(\s[A-Z][a-z]+)*)/g);
      if (entityMatch && entityMatch.length > 0) {
        // Use the first entity name as the query
        this.logger.log(`[RAG DEBUG] Extracted entity name from category query: ${entityMatch[0]}`);
        return entityMatch[0];
      }
    }
    
    // Check if the query itself is a proper noun (likely an entity name)
    // This helps with direct queries like "Samerd Properties"
    if (/^[A-Z][a-z]+(\s[A-Z][a-z]+)*$/.test(query)) {
      this.logger.log(`[RAG DEBUG] Query appears to be an entity name: ${query}`);
      // For entity names, we'll return as is - they're already optimized for search
      return query;
    }
    
    return processedQuery;
  }
}
