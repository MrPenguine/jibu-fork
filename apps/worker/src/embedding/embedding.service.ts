import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

export type EmbeddingProvider = 'gemini' | 'openai';

export interface EmbeddingModelSpec {
  provider: EmbeddingProvider;
  dimension: number;
  /** Max input size in characters we allow per chunk before the model degrades. */
  maxChunkChars: number;
}

/**
 * Registry of supported embedding models. An embedding model fixes a vector
 * space + dimension, so the same model MUST be used for indexing a document and
 * for embedding a query against it. `maxChunkChars` bounds the chunk-size slider
 * in the UI so chunks never exceed the model's input window.
 */
export const EMBEDDING_MODELS: Record<string, EmbeddingModelSpec> = {
  'gemini-embedding-001': { provider: 'gemini', dimension: 768, maxChunkChars: 8000 },
  'text-embedding-3-small': { provider: 'openai', dimension: 1536, maxChunkChars: 32000 },
  'text-embedding-3-large': { provider: 'openai', dimension: 3072, maxChunkChars: 32000 },
};

export const DEFAULT_EMBEDDING_MODEL = 'gemini-embedding-001';

export function resolveEmbeddingModel(model?: string | null): {
  model: string;
  spec: EmbeddingModelSpec;
} {
  const name = model && EMBEDDING_MODELS[model] ? model : DEFAULT_EMBEDDING_MODEL;
  return { model: name, spec: EMBEDDING_MODELS[name] };
}

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly genAI: GoogleGenerativeAI | null;
  private readonly openai: OpenAI | null;
  private readonly defaultModelName: string;
  private readonly defaultDimension: number;

  constructor(private readonly configService: ConfigService) {
    this.logger.log('Initializing embedding service');

    const geminiApiKey = this.configService.get<string>('GEMINI_API_KEY');
    const openaiApiKey = this.configService.get<string>('OPENAI_API_KEY');

    // The env EMBEDDING_MODEL/VECTOR_DIMENSION remain the fallback default so
    // existing KBs (which have no per-KB model stored) keep working unchanged.
    this.defaultModelName = this.configService.get<string>('EMBEDDING_MODEL', DEFAULT_EMBEDDING_MODEL);
    this.defaultDimension = parseInt(
      this.configService.get<string>('VECTOR_DIMENSION', '768'),
      10,
    );

    this.genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;
    this.openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

    if (!this.genAI) {
      this.logger.error('GEMINI_API_KEY is not set. Gemini embeddings will not function.');
    }
    if (!this.openai) {
      this.logger.warn('OPENAI_API_KEY is not set. OpenAI embedding models are unavailable.');
    }

    this.logger.log(
      `Embedding service ready. Default model: ${this.defaultModelName} (${this.defaultDimension}d)`,
    );
  }

  /** Resolve the effective model + dimension for a given (optional) model name. */
  private resolve(model?: string | null): { model: string; provider: EmbeddingProvider; dimension: number } {
    if (!model) {
      const spec = EMBEDDING_MODELS[this.defaultModelName];
      return spec
        ? { model: this.defaultModelName, provider: spec.provider, dimension: this.defaultDimension }
        : { model: this.defaultModelName, provider: 'gemini', dimension: this.defaultDimension };
    }
    const { model: name, spec } = resolveEmbeddingModel(model);
    return { model: name, provider: spec.provider, dimension: spec.dimension };
  }

  /** Public helper so callers (worker/RAG) can size the Qdrant collection. */
  getDimension(model?: string | null): number {
    return this.resolve(model).dimension;
  }

  private buildFallbackVector(dimension: number): number[] {
    const vector = new Array(dimension).fill(0).map((_, i) => 0.00001 * (i % 2 === 0 ? 1 : -1));
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < dimension; i++) vector[i] /= magnitude;
    }
    return vector;
  }

  /**
   * Create embeddings for an array of texts (documents for indexing).
   * Uses the requested model (defaults to the env/Gemini model).
   */
  async embedDocuments(
    documents: { text: string; title?: string }[],
    opts?: { model?: string | null },
  ): Promise<number[][]> {
    const { model, provider, dimension } = this.resolve(opts?.model);
    this.logger.log(
      `Generating embeddings for ${documents.length} documents using ${model} (${provider}, ${dimension}d)`,
    );
    const startTime = Date.now();

    const validDocumentsToEmbed: { text: string; originalIndex: number }[] = [];
    documents.forEach((doc, index) => {
      if (doc.text && doc.text.trim().length > 0 && !doc.text.startsWith('%PDF') && !/^\uFFFD/.test(doc.text)) {
        validDocumentsToEmbed.push({ text: doc.text.trim(), originalIndex: index });
      }
    });

    const allEmbeddings: number[][] = new Array(documents.length)
      .fill(null)
      .map(() => this.buildFallbackVector(dimension));

    if (validDocumentsToEmbed.length === 0) {
      this.logger.log('No valid documents to embed, returning default vectors.');
      return allEmbeddings;
    }

    try {
      let vectors: number[][];
      if (provider === 'openai') {
        vectors = await this.openaiEmbed(
          model,
          validDocumentsToEmbed.map((d) => d.text),
          dimension,
        );
      } else {
        vectors = await this.geminiEmbedDocuments(
          model,
          validDocumentsToEmbed.map((d) => d.text),
          dimension,
        );
      }

      vectors.forEach((values, i) => {
        if (values && values.length === dimension) {
          allEmbeddings[validDocumentsToEmbed[i].originalIndex] = values;
        } else {
          this.logger.warn(
            `Malformed/incorrect dimension embedding for document at index ${validDocumentsToEmbed[i].originalIndex}`,
          );
        }
      });

      this.logger.log(
        `Generated ${vectors.length} embeddings (of ${documents.length}) in ${Date.now() - startTime}ms`,
      );
      return allEmbeddings;
    } catch (error) {
      this.logger.error(`Error generating document embeddings (${model}): ${error.message}`, error.stack);
      this.logger.error('Returning default vectors due to embedding API error.');
      return allEmbeddings;
    }
  }

  /**
   * Generate a single embedding for a query text using the requested model.
   */
  async embedQuery(queryText: string, opts?: { model?: string | null }): Promise<number[]> {
    const { model, provider, dimension } = this.resolve(opts?.model);
    this.logger.log(`Generating query embedding using ${model} (${provider}, ${dimension}d)`);
    const startTime = Date.now();

    const fallbackVector = this.buildFallbackVector(dimension);

    if (!queryText || queryText.trim().length === 0 || queryText.startsWith('%PDF') || /^\uFFFD/.test(queryText)) {
      this.logger.log('Invalid query text, returning default fallback vector.');
      return fallbackVector;
    }

    try {
      if (provider === 'openai') {
        const vectors = await this.openaiEmbed(model, [queryText.trim()], dimension);
        return vectors[0] && vectors[0].length === dimension ? vectors[0] : fallbackVector;
      }

      if (!this.genAI) return fallbackVector;
      const generativeModel = this.genAI.getGenerativeModel({ model });
      const result = await generativeModel.embedContent({
        content: { parts: [{ text: queryText.trim() }] },
        taskType: 'RETRIEVAL_QUERY',
        outputDimensionality: dimension,
      } as any);

      const values = result?.embedding?.values;
      this.logger.log(`Generated query embedding in ${Date.now() - startTime}ms`);
      return values && values.length === dimension ? values : fallbackVector;
    } catch (error) {
      this.logger.error(`Error generating query embedding (${model}): ${error.message}`, error.stack);
      return fallbackVector;
    }
  }

  private async geminiEmbedDocuments(
    model: string,
    texts: string[],
    dimension: number,
  ): Promise<number[][]> {
    if (!this.genAI) throw new Error('Gemini API key not configured');
    const generativeModel = this.genAI.getGenerativeModel({ model });
    const requests = texts.map((text) => ({
      content: { parts: [{ text }] },
      taskType: 'RETRIEVAL_DOCUMENT',
      outputDimensionality: dimension,
    }));
    const result = await generativeModel.batchEmbedContents({ requests } as any);
    const embeddingResponses = result.embeddings;
    if (!embeddingResponses || !Array.isArray(embeddingResponses)) {
      throw new Error('Invalid response from Gemini embedding API.');
    }
    return embeddingResponses.map((e: any) => e?.values || []);
  }

  private async openaiEmbed(model: string, texts: string[], dimension: number): Promise<number[][]> {
    if (!this.openai) {
      this.logger.error(`OpenAI model ${model} requested but OPENAI_API_KEY is not set — using fallback vectors`);
      return texts.map(() => this.buildFallbackVector(dimension));
    }
    const response = await this.openai.embeddings.create({
      model,
      input: texts,
      dimensions: dimension,
    });
    return response.data.map((d) => d.embedding as number[]);
  }

  async embedText(text: string, opts?: { model?: string | null }): Promise<number[]> {
    const embeddings = await this.embedDocuments([{ text }], opts);
    return embeddings[0];
  }
}
