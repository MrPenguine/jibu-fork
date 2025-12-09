"use strict";
var VectorDbService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VectorDbService = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = require("axios");
let VectorDbService = VectorDbService_1 = class VectorDbService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(VectorDbService_1.name);
        this.logger.log('Initializing Qdrant vector database service');
        this.qdrantUrl = this.configService.get('QDRANT_URL') || 'http://localhost:6333';
        this.logger.log(`Using Qdrant URL: ${this.qdrantUrl}`);
    }
    async getCollections() {
        try {
            const response = await axios_1.default.get(`${this.qdrantUrl}/collections`);
            return response.data;
        }
        catch (error) {
            this.logger.error(`Failed to get collections: ${error.message}`);
            return { collections: [] };
        }
    }
    async createCollection(name, options) {
        try {
            this.logger.log(`Creating collection: ${name} with vector size ${options.vectors.size}`);
            await axios_1.default.put(`${this.qdrantUrl}/collections/${name}`, {
                vectors: options.vectors,
                optimizers_config: options.optimizers_config,
                replication_factor: options.replication_factor,
            });
            this.logger.log(`Collection ${name} created successfully`);
        }
        catch (error) {
            if (error.response && error.response.status === 409) {
                this.logger.log(`Collection ${name} already exists`);
            }
            else {
                this.logger.error(`Failed to create collection ${name}: ${error.message}`);
                throw error;
            }
        }
    }
    async ensureCollection(name, vectorSize) {
        try {
            const dimension = vectorSize || parseInt(this.configService.get('VECTOR_DIMENSION') || '512', 10);
            this.logger.log(`Ensuring collection ${name} exists with vector size ${dimension}`);
            await axios_1.default.get(`${this.qdrantUrl}/collections/${name}`);
            this.logger.log(`Collection ${name} already exists`);
        }
        catch (error) {
            if (error.response && error.response.status === 404) {
                const dimension = vectorSize || parseInt(this.configService.get('VECTOR_DIMENSION') || '512', 10);
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
            }
            else {
                this.logger.error(`Error checking collection ${name}: ${error.message}`);
                throw error;
            }
        }
    }
    async upsert(collection, data) {
        try {
            await this.ensureCollection(collection);
            const qdrantPoints = data.points.map(point => {
                var _a, _b;
                const pointId = typeof point.id === 'string' ?
                    point.id.replace(/-/g, '') :
                    String(point.id);
                const sanitizedVector = point.vector.map(v => {
                    if (Number.isNaN(v) || !Number.isFinite(v)) {
                        return 0.0;
                    }
                    return v;
                });
                if (sanitizedVector.length !== parseInt(this.configService.get('VECTOR_DIMENSION') || '512', 10)) {
                    this.logger.warn(`Vector dimension mismatch: ${sanitizedVector.length} vs expected ${this.configService.get('VECTOR_DIMENSION')}`);
                }
                let sanitizedPayload = {};
                try {
                    Object.keys(point.payload || {}).forEach(key => {
                        const value = point.payload[key];
                        if (typeof value === 'string' ||
                            typeof value === 'number' ||
                            typeof value === 'boolean' ||
                            value === null) {
                            sanitizedPayload[key] = value;
                        }
                        else if (Array.isArray(value) && value.every(item => typeof item === 'string' || typeof item === 'number')) {
                            sanitizedPayload[key] = value;
                        }
                        else {
                            sanitizedPayload[key] = String(value);
                        }
                    });
                }
                catch (e) {
                    this.logger.warn(`Error sanitizing payload: ${e.message}. Using minimal payload.`);
                    sanitizedPayload = {
                        text: typeof ((_a = point.payload) === null || _a === void 0 ? void 0 : _a.text) === 'string' ?
                            point.payload.text.substring(0, 1000) : 'Invalid text',
                        sourceId: ((_b = point.payload) === null || _b === void 0 ? void 0 : _b.sourceId) || 'unknown'
                    };
                }
                return {
                    id: pointId,
                    vector: sanitizedVector,
                    payload: sanitizedPayload
                };
            });
            const waitParam = data.wait !== false;
            if (qdrantPoints.length > 0) {
                const samplePoint = Object.assign({}, qdrantPoints[0]);
                if (samplePoint.vector) {
                    const vectorPreview = samplePoint.vector.slice(0, 5);
                    this.logger.debug(`Sample point: ${JSON.stringify(Object.assign(Object.assign({}, samplePoint), { vector: [...vectorPreview, '...more'] }))}`);
                }
                else {
                    this.logger.debug(`Sample point: ${JSON.stringify(samplePoint)}`);
                }
            }
            const BATCH_SIZE = 100;
            for (let i = 0; i < qdrantPoints.length; i += BATCH_SIZE) {
                const batch = qdrantPoints.slice(i, i + BATCH_SIZE);
                this.logger.log(`Upserting batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(qdrantPoints.length / BATCH_SIZE)} of ${batch.length} points`);
                await axios_1.default.put(`${this.qdrantUrl}/collections/${collection}/points?wait=${waitParam}`, {
                    points: batch
                });
            }
            this.logger.log(`Upserted ${qdrantPoints.length} points to collection ${collection}`);
        }
        catch (error) {
            this.logger.error(`Failed to upsert points to collection ${collection}: ${error.message}`);
            if (error.response) {
                this.logger.error(`Response data: ${JSON.stringify(error.response.data)}`);
            }
            throw error;
        }
    }
    async collectionExists(name) {
        try {
            const response = await axios_1.default.get(`${this.qdrantUrl}/collections/${name}`);
            return response.status === 200;
        }
        catch (error) {
            if (error.response && error.response.status === 404) {
                return false;
            }
            this.logger.warn(`Error checking if collection ${name} exists: ${error.message}`);
            return false;
        }
    }
    async delete(collection, filter) {
        var _a;
        try {
            const exists = await this.collectionExists(collection);
            if (!exists) {
                this.logger.warn(`Collection ${collection} doesn't exist, skipping delete operation`);
                return;
            }
            const url = `${this.qdrantUrl}/collections/${collection}/points/delete`;
            if (!((_a = filter.filter) === null || _a === void 0 ? void 0 : _a.must)) {
                this.logger.debug(`Deleting all vectors from ${collection}`);
                const response = await axios_1.default.post(url, {
                    filter: {}
                });
                if (response.status === 200) {
                    this.logger.debug(`Successfully cleared all vectors from ${collection}`);
                }
                else {
                    this.logger.warn(`Unexpected response when clearing vectors: ${response.status} ${response.statusText}`);
                }
                return;
            }
            const qdrantFilter = {
                must: filter.filter.must.map(condition => ({
                    key: condition.key,
                    match: condition.match
                }))
            };
            this.logger.debug(`Deleting vectors from ${collection} with filter: ${JSON.stringify(qdrantFilter)}`);
            const response = await axios_1.default.post(url, {
                filter: qdrantFilter,
                wait: filter.wait !== false
            });
            if (response.status === 200) {
                this.logger.debug(`Successfully deleted vectors from ${collection}`);
                if (response.data) {
                    this.logger.debug(`Delete response: ${JSON.stringify(response.data)}`);
                }
            }
            else {
                this.logger.warn(`Unexpected response when deleting vectors: ${response.status} ${response.statusText}`);
            }
        }
        catch (error) {
            this.logger.error(`Error deleting vectors from collection ${collection}: ${error.message}`);
            if (error.response) {
                this.logger.error(`Qdrant API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
            }
            else if (error.request) {
                this.logger.error(`No response received from Qdrant: ${error.request}`);
            }
            throw new Error(`Failed to delete vectors: ${error.message}`);
        }
    }
    async search(collection, query) {
        try {
            const response = await axios_1.default.post(`${this.qdrantUrl}/collections/${collection}/points/search`, {
                vector: query.vector,
                limit: query.limit,
                with_payload: query.with_payload !== false,
                with_vector: query.with_vector === true,
                filter: query.filter
            });
            return response.data.result || [];
        }
        catch (error) {
            this.logger.error(`Failed to search in collection ${collection}: ${error.message}`);
            return [];
        }
    }
    async scroll(collection, options = {}) {
        try {
            const { limit = 100, offset = 0, with_payload = true, with_vector = false, filter } = options;
            const exists = await this.collectionExists(collection);
            if (!exists) {
                this.logger.warn(`Collection ${collection} does not exist for scroll operation`);
                return [];
            }
            const response = await axios_1.default.post(`${this.qdrantUrl}/collections/${collection}/points/scroll`, {
                limit,
                offset,
                with_payload,
                with_vector,
                filter
            });
            return response.data.result || [];
        }
        catch (error) {
            this.logger.error(`Failed to scroll collection ${collection}: ${error.message}`);
            return [];
        }
    }
    async deleteCollection(name) {
        try {
            const exists = await this.collectionExists(name);
            if (!exists) {
                this.logger.warn(`Collection ${name} doesn't exist, skipping deletion`);
                return false;
            }
            const response = await axios_1.default.delete(`${this.qdrantUrl}/collections/${name}`);
            if (response.status === 200) {
                this.logger.debug(`Successfully deleted collection ${name}`);
                return true;
            }
            else {
                this.logger.warn(`Unexpected response when deleting collection: ${response.status} ${response.statusText}`);
                return false;
            }
        }
        catch (error) {
            this.logger.error(`Failed to delete collection ${name}: ${error.message}`);
            if (error.response) {
                this.logger.error(`Qdrant API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
            }
            return false;
        }
    }
};
exports.VectorDbService = VectorDbService;
exports.VectorDbService = VectorDbService = VectorDbService_1 = tslib_1.__decorate([
    (0, common_1.Injectable)(),
    tslib_1.__metadata("design:paramtypes", [config_1.ConfigService])
], VectorDbService);
//# sourceMappingURL=vector-db.service.js.map