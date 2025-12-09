"use strict";
var EmbeddingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmbeddingService = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const generative_ai_1 = require("@google/generative-ai");
let EmbeddingService = EmbeddingService_1 = class EmbeddingService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(EmbeddingService_1.name);
        this.logger.log('Initializing embedding service');
        const geminiApiKey = this.configService.get('GEMINI_API_KEY');
        this.modelName = this.configService.get('EMBEDDING_MODEL', 'text-embedding-004');
        this.vectorDimension = parseInt(this.configService.get('VECTOR_DIMENSION', '768'), 10);
        if (!geminiApiKey) {
            this.logger.error('GEMINI_API_KEY is not set. Embedding service will not function correctly.');
            throw new Error('GEMINI_API_KEY is required for the EmbeddingService.');
        }
        const genAI = new generative_ai_1.GoogleGenerativeAI(geminiApiKey);
        this.generativeModel = genAI.getGenerativeModel({ model: this.modelName });
        this.logger.log(`Using Google Gemini embedding model: ${this.modelName} with dimension: ${this.vectorDimension}`);
    }
    async embedDocuments(documents) {
        this.logger.log(`Generating embeddings for ${documents.length} documents using ${this.modelName}`);
        const startTime = Date.now();
        const validDocumentsToEmbed = [];
        documents.forEach((doc, index) => {
            if (doc.text && doc.text.trim().length > 0 && !doc.text.startsWith('%PDF') && !/^\uFFFD/.test(doc.text)) {
                validDocumentsToEmbed.push({ text: doc.text.trim(), title: doc.title, originalIndex: index });
            }
        });
        const allEmbeddings = new Array(documents.length).fill(null).map(() => {
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
                taskType: 'RETRIEVAL_DOCUMENT',
            }));
            const result = await this.generativeModel.batchEmbedContents({ requests });
            const embeddingResponses = result.embeddings;
            if (embeddingResponses && Array.isArray(embeddingResponses)) {
                embeddingResponses.forEach((embedding, i) => {
                    if (embedding && embedding.values && embedding.values.length === this.vectorDimension) {
                        const originalIndex = validDocumentsToEmbed[i].originalIndex;
                        allEmbeddings[originalIndex] = embedding.values;
                    }
                    else {
                        this.logger.warn(`Received malformed or incorrect dimension embedding for document at original index ${validDocumentsToEmbed[i].originalIndex}`);
                    }
                });
            }
            else {
                this.logger.error('Unexpected response format from Gemini embedding API.');
                throw new Error('Invalid response from embedding API.');
            }
            const elapsed = Date.now() - startTime;
            this.logger.log(`Generated ${embeddingResponses.length} actual embeddings (out of ${documents.length}) in ${elapsed}ms`);
            return allEmbeddings;
        }
        catch (error) {
            this.logger.error(`Error generating document embeddings with Gemini API: ${error.message}`, error.stack);
            this.logger.error('Returning default vectors due to embedding API error.');
            return allEmbeddings;
        }
    }
    async embedQuery(queryText) {
        this.logger.log(`Generating embedding for query: "${queryText}" using ${this.modelName}`);
        const startTime = Date.now();
        let embeddingVector = null;
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
                taskType: 'RETRIEVAL_QUERY',
            });
            if (result && result.embedding && result.embedding.values) {
                embeddingVector = result.embedding.values;
            }
            else {
                this.logger.warn('Received malformed embedding for query.');
            }
            const elapsed = Date.now() - startTime;
            this.logger.log(`Generated query embedding in ${elapsed}ms`);
            return embeddingVector || fallbackVector;
        }
        catch (error) {
            this.logger.error(`Error generating query embedding with Gemini API: ${error.message}`, error.stack);
            this.logger.error('Returning default fallback vector due to embedding API error.');
            return fallbackVector;
        }
    }
    async embedText(text) {
        this.logger.warn("Using generic embedText. Consider using embedDocuments or embedQuery for specific task types.");
        const embeddings = await this.embedDocuments([{ text: text }]);
        return embeddings[0];
    }
};
exports.EmbeddingService = EmbeddingService;
exports.EmbeddingService = EmbeddingService = EmbeddingService_1 = tslib_1.__decorate([
    (0, common_1.Injectable)(),
    tslib_1.__metadata("design:paramtypes", [config_1.ConfigService])
], EmbeddingService);
//# sourceMappingURL=embedding.service.js.map