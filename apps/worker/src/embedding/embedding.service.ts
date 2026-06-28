import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

// You might need to import TaskType if you want to use the enum directly,
// though string literals are also fine.
// const { TaskType } = require('@google/generative-ai'); // If using CommonJS
// import { TaskType } from '@google/generative-ai/dist/generativelanguage_v1beta'; // This path is tricky, better to use string literals

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private generativeModel: any; // Type inferred by TypeScript later
  private modelName: string;
  private vectorDimension: number;

  constructor(private readonly configService: ConfigService) {
    this.logger.log('Initializing embedding service');

    const geminiApiKey = this.configService.get<string>('GEMINI_API_KEY');
    this.modelName = this.configService.get<string>('EMBEDDING_MODEL', 'gemini-embedding-001');
    this.vectorDimension = parseInt(this.configService.get<string>('VECTOR_DIMENSION', '768'), 10);

    if (!geminiApiKey) {
      this.logger.error('GEMINI_API_KEY is not set. Embedding service will not function correctly.');
      throw new Error('GEMINI_API_KEY is required for the EmbeddingService.');
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    this.generativeModel = genAI.getGenerativeModel({ model: this.modelName });

    this.logger.log(`Using Google Gemini embedding model: ${this.modelName} with dimension: ${this.vectorDimension}`);
  }

  /**
   * Create embeddings for an array of texts (documents for indexing)
   * This method explicitly uses 'RETRIEVAL_DOCUMENT' taskType.
   * You can optionally pass document titles if available.
   */
  async embedDocuments(documents: { text: string; title?: string }[]): Promise<number[][]> {
    this.logger.log(`Generating embeddings for ${documents.length} documents using ${this.modelName}`);
    const startTime = Date.now();

    const validDocumentsToEmbed: { text: string; title?: string; originalIndex: number }[] = [];
    documents.forEach((doc, index) => {
      if (doc.text && doc.text.trim().length > 0 && !doc.text.startsWith('%PDF') && !/^\uFFFD/.test(doc.text)) {
        validDocumentsToEmbed.push({ text: doc.text.trim(), title: doc.title, originalIndex: index });
      }
    });

    const allEmbeddings: number[][] = new Array(documents.length).fill(null).map(() => {
      const vector = new Array(this.vectorDimension).fill(0);
      for (let i = 0; i < this.vectorDimension; i++) {
        vector[i] = 0.00001 * (i % 2 === 0 ? 1 : -1);
      }
      const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
      if (magnitude > 0) {
        for (let i = 0; i < this.vectorDimension; i++) {
          vector[i] /= magnitude;
        }
      }
      return vector;
    });

    if (validDocumentsToEmbed.length === 0) {
      this.logger.log('No valid documents to embed, returning default vectors.');
      return allEmbeddings;
    }

    try {
      const requests = validDocumentsToEmbed.map(doc => ({
        content: { parts: [{ text: doc.text }] },
        taskType: 'RETRIEVAL_DOCUMENT', // Specify for indexing documents
        // Request the exact configured dimension. Models like gemini-embedding-001
        // default to 3072 but honor Matryoshka truncation, so this keeps the
        // returned vector length consistent with the Qdrant collection size.
        outputDimensionality: this.vectorDimension,
        // Optionally include title if available and relevant:
        // title: doc.title || undefined,
      }));

      const result = await this.generativeModel.batchEmbedContents({ requests });
      const embeddingResponses = result.embeddings;

      if (embeddingResponses && Array.isArray(embeddingResponses)) {
        embeddingResponses.forEach((embedding, i) => {
          if (embedding && embedding.values && embedding.values.length === this.vectorDimension) {
            const originalIndex = validDocumentsToEmbed[i].originalIndex;
            allEmbeddings[originalIndex] = embedding.values;
          } else {
            this.logger.warn(`Received malformed or incorrect dimension embedding for document at original index ${validDocumentsToEmbed[i].originalIndex}`);
          }
        });
      } else {
        this.logger.error('Unexpected response format from Gemini embedding API.');
        throw new Error('Invalid response from embedding API.');
      }

      const elapsed = Date.now() - startTime;
      this.logger.log(`Generated ${embeddingResponses.length} actual embeddings (out of ${documents.length}) in ${elapsed}ms`);

      return allEmbeddings;
    } catch (error) {
      this.logger.error(`Error generating document embeddings with Gemini API: ${error.message}`, error.stack);
      this.logger.error('Returning default vectors due to embedding API error.');
      return allEmbeddings;
    }
  }

  /**
   * Generate a single embedding for a query text
   * This method explicitly uses 'RETRIEVAL_QUERY' taskType.
   */
  async embedQuery(queryText: string): Promise<number[]> {
    this.logger.log(`Generating embedding for query: "${queryText}" using ${this.modelName}`);
    const startTime = Date.now();

    let embeddingVector: number[] | null = null;
    const fallbackVector = new Array(this.vectorDimension).fill(0).map((_, i) => 0.00001 * (i % 2 === 0 ? 1 : -1));
    const magnitude = Math.sqrt(fallbackVector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < this.vectorDimension; i++) {
        fallbackVector[i] /= magnitude;
      }
    }

    if (!queryText || queryText.trim().length === 0 || queryText.startsWith('%PDF') || /^\uFFFD/.test(queryText)) {
      this.logger.log('Invalid query text, returning default fallback vector.');
      return fallbackVector;
    }

    try {
      const result = await this.generativeModel.embedContent({
        content: { parts: [{ text: queryText.trim() }] },
        taskType: 'RETRIEVAL_QUERY', // Specify for search queries
        outputDimensionality: this.vectorDimension,
      });

      if (result && result.embedding && result.embedding.values) {
        embeddingVector = result.embedding.values;
      } else {
        this.logger.warn('Received malformed embedding for query.');
      }

      const elapsed = Date.now() - startTime;
      this.logger.log(`Generated query embedding in ${elapsed}ms`);

      return embeddingVector || fallbackVector;
    } catch (error) {
      this.logger.error(`Error generating query embedding with Gemini API: ${error.message}`, error.stack);
      this.logger.error('Returning default fallback vector due to embedding API error.');
      return fallbackVector;
    }
  }

  // You can still keep embedText if you want a generic single text embedding,
  // but it's more precise to use embedDocuments or embedQuery depending on context.
  // For RAG, you'll mainly use embedDocuments for indexing and embedQuery for search.
  async embedText(text: string): Promise<number[]> {
      // Decide whether this generic call is for a document or a query.
      // For simplicity, let's assume it's for a document if not specified.
      this.logger.warn("Using generic embedText. Consider using embedDocuments or embedQuery for specific task types.");
      const embeddings = await this.embedDocuments([{text: text}]);
      return embeddings[0];
  }
}