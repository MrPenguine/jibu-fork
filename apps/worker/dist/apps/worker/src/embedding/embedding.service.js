"use strict";
var EmbeddingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmbeddingService = exports.DEFAULT_EMBEDDING_MODEL = exports.EMBEDDING_MODELS = void 0;
exports.resolveEmbeddingModel = resolveEmbeddingModel;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const generative_ai_1 = require("@google/generative-ai");
const openai_1 = require("openai");
exports.EMBEDDING_MODELS = {
    'gemini-embedding-001': { provider: 'gemini', dimension: 768, maxChunkChars: 8000 },
    'text-embedding-3-small': { provider: 'openai', dimension: 1536, maxChunkChars: 32000 },
    'text-embedding-3-large': { provider: 'openai', dimension: 3072, maxChunkChars: 32000 },
};
exports.DEFAULT_EMBEDDING_MODEL = 'gemini-embedding-001';
function resolveEmbeddingModel(model) {
    const name = model && exports.EMBEDDING_MODELS[model] ? model : exports.DEFAULT_EMBEDDING_MODEL;
    return { model: name, spec: exports.EMBEDDING_MODELS[name] };
}
let EmbeddingService = EmbeddingService_1 = class EmbeddingService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(EmbeddingService_1.name);
        this.logger.log('Initializing embedding service');
        const geminiApiKey = this.configService.get('GEMINI_API_KEY');
        const openaiApiKey = this.configService.get('OPENAI_API_KEY');
        this.defaultModelName = this.configService.get('EMBEDDING_MODEL', exports.DEFAULT_EMBEDDING_MODEL);
        this.defaultDimension = parseInt(this.configService.get('VECTOR_DIMENSION', '768'), 10);
        this.genAI = geminiApiKey ? new generative_ai_1.GoogleGenerativeAI(geminiApiKey) : null;
        this.openai = openaiApiKey ? new openai_1.default({ apiKey: openaiApiKey }) : null;
        if (!this.genAI) {
            this.logger.error('GEMINI_API_KEY is not set. Gemini embeddings will not function.');
        }
        if (!this.openai) {
            this.logger.warn('OPENAI_API_KEY is not set. OpenAI embedding models are unavailable.');
        }
        this.logger.log(`Embedding service ready. Default model: ${this.defaultModelName} (${this.defaultDimension}d)`);
    }
    resolve(model) {
        if (!model) {
            const spec = exports.EMBEDDING_MODELS[this.defaultModelName];
            return spec
                ? { model: this.defaultModelName, provider: spec.provider, dimension: this.defaultDimension }
                : { model: this.defaultModelName, provider: 'gemini', dimension: this.defaultDimension };
        }
        const { model: name, spec } = resolveEmbeddingModel(model);
        return { model: name, provider: spec.provider, dimension: spec.dimension };
    }
    getDimension(model) {
        return this.resolve(model).dimension;
    }
    buildFallbackVector(dimension) {
        const vector = new Array(dimension).fill(0).map((_, i) => 0.00001 * (i % 2 === 0 ? 1 : -1));
        const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
        if (magnitude > 0) {
            for (let i = 0; i < dimension; i++)
                vector[i] /= magnitude;
        }
        return vector;
    }
    async embedDocuments(documents, opts) {
        const { model, provider, dimension } = this.resolve(opts === null || opts === void 0 ? void 0 : opts.model);
        this.logger.log(`Generating embeddings for ${documents.length} documents using ${model} (${provider}, ${dimension}d)`);
        const startTime = Date.now();
        const validDocumentsToEmbed = [];
        documents.forEach((doc, index) => {
            if (doc.text && doc.text.trim().length > 0 && !doc.text.startsWith('%PDF') && !/^\uFFFD/.test(doc.text)) {
                validDocumentsToEmbed.push({ text: doc.text.trim(), originalIndex: index });
            }
        });
        const allEmbeddings = new Array(documents.length)
            .fill(null)
            .map(() => this.buildFallbackVector(dimension));
        if (validDocumentsToEmbed.length === 0) {
            this.logger.log('No valid documents to embed, returning default vectors.');
            return allEmbeddings;
        }
        try {
            let vectors;
            if (provider === 'openai') {
                vectors = await this.openaiEmbed(model, validDocumentsToEmbed.map((d) => d.text), dimension);
            }
            else {
                vectors = await this.geminiEmbedDocuments(model, validDocumentsToEmbed.map((d) => d.text), dimension);
            }
            vectors.forEach((values, i) => {
                if (values && values.length === dimension) {
                    allEmbeddings[validDocumentsToEmbed[i].originalIndex] = values;
                }
                else {
                    this.logger.warn(`Malformed/incorrect dimension embedding for document at index ${validDocumentsToEmbed[i].originalIndex}`);
                }
            });
            this.logger.log(`Generated ${vectors.length} embeddings (of ${documents.length}) in ${Date.now() - startTime}ms`);
            return allEmbeddings;
        }
        catch (error) {
            this.logger.error(`Error generating document embeddings (${model}): ${error.message}`, error.stack);
            this.logger.error('Returning default vectors due to embedding API error.');
            return allEmbeddings;
        }
    }
    async embedQuery(queryText, opts) {
        var _a;
        const { model, provider, dimension } = this.resolve(opts === null || opts === void 0 ? void 0 : opts.model);
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
            if (!this.genAI)
                return fallbackVector;
            const generativeModel = this.genAI.getGenerativeModel({ model });
            const result = await generativeModel.embedContent({
                content: { parts: [{ text: queryText.trim() }] },
                taskType: 'RETRIEVAL_QUERY',
                outputDimensionality: dimension,
            });
            const values = (_a = result === null || result === void 0 ? void 0 : result.embedding) === null || _a === void 0 ? void 0 : _a.values;
            this.logger.log(`Generated query embedding in ${Date.now() - startTime}ms`);
            return values && values.length === dimension ? values : fallbackVector;
        }
        catch (error) {
            this.logger.error(`Error generating query embedding (${model}): ${error.message}`, error.stack);
            return fallbackVector;
        }
    }
    async geminiEmbedDocuments(model, texts, dimension) {
        if (!this.genAI)
            throw new Error('Gemini API key not configured');
        const generativeModel = this.genAI.getGenerativeModel({ model });
        const requests = texts.map((text) => ({
            content: { parts: [{ text }] },
            taskType: 'RETRIEVAL_DOCUMENT',
            outputDimensionality: dimension,
        }));
        const result = await generativeModel.batchEmbedContents({ requests });
        const embeddingResponses = result.embeddings;
        if (!embeddingResponses || !Array.isArray(embeddingResponses)) {
            throw new Error('Invalid response from Gemini embedding API.');
        }
        return embeddingResponses.map((e) => (e === null || e === void 0 ? void 0 : e.values) || []);
    }
    async openaiEmbed(model, texts, dimension) {
        if (!this.openai) {
            this.logger.error(`OpenAI model ${model} requested but OPENAI_API_KEY is not set — using fallback vectors`);
            return texts.map(() => this.buildFallbackVector(dimension));
        }
        const response = await this.openai.embeddings.create({
            model,
            input: texts,
            dimensions: dimension,
        });
        return response.data.map((d) => d.embedding);
    }
    async embedText(text, opts) {
        const embeddings = await this.embedDocuments([{ text }], opts);
        return embeddings[0];
    }
};
exports.EmbeddingService = EmbeddingService;
exports.EmbeddingService = EmbeddingService = EmbeddingService_1 = tslib_1.__decorate([
    (0, common_1.Injectable)(),
    tslib_1.__metadata("design:paramtypes", [config_1.ConfigService])
], EmbeddingService);
//# sourceMappingURL=embedding.service.js.map