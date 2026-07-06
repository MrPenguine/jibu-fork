"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisService = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ioredis_1 = require("ioredis");
let RedisService = class RedisService {
    constructor(configService) {
        this.configService = configService;
    }
    onModuleInit() {
        this.initRedisClient();
    }
    onModuleDestroy() {
        this.disconnect();
    }
    initRedisClient() {
        try {
            const host = this.configService.get('REDIS_HOST') || 'localhost';
            const port = this.configService.get('REDIS_PORT') || 6379;
            const password = this.configService.get('REDIS_PASSWORD');
            const options = {
                host,
                port,
                password: password || undefined,
                retryStrategy: (times) => {
                    return Math.min(times * 500, 3000);
                },
            };
            this.redisClient = new ioredis_1.default(options);
            this.redisClient.on('error', (error) => {
                console.error('Redis connection error:', error);
            });
            this.redisClient.on('connect', () => {
                console.log(`Connected to Redis at ${host}:${port}`);
            });
        }
        catch (error) {
            console.error('Failed to initialize Redis client:', error);
        }
    }
    async get(key) {
        try {
            return await this.redisClient.get(key);
        }
        catch (error) {
            console.error(`Error getting value for key ${key}:`, error);
            return null;
        }
    }
    async set(key, value, expirySeconds) {
        try {
            if (expirySeconds) {
                await this.redisClient.set(key, value, 'EX', expirySeconds);
            }
            else {
                await this.redisClient.set(key, value);
            }
            return true;
        }
        catch (error) {
            console.error(`Error setting value for key ${key}:`, error);
            return false;
        }
    }
    async del(key) {
        try {
            await this.redisClient.del(key);
            return true;
        }
        catch (error) {
            console.error(`Error deleting key ${key}:`, error);
            return false;
        }
    }
    async exists(key) {
        try {
            const result = await this.redisClient.exists(key);
            return result === 1;
        }
        catch (error) {
            console.error(`Error checking existence for key ${key}:`, error);
            return false;
        }
    }
    async hset(key, field, value) {
        try {
            await this.redisClient.hset(key, field, value);
            return true;
        }
        catch (error) {
            console.error(`Error setting hash field ${field} for key ${key}:`, error);
            return false;
        }
    }
    async hget(key, field) {
        try {
            return await this.redisClient.hget(key, field);
        }
        catch (error) {
            console.error(`Error getting hash field ${field} for key ${key}:`, error);
            return null;
        }
    }
    async hgetall(key) {
        try {
            return await this.redisClient.hgetall(key);
        }
        catch (error) {
            console.error(`Error getting all hash fields for key ${key}:`, error);
            return {};
        }
    }
    async hdel(key, field) {
        try {
            await this.redisClient.hdel(key, field);
            return true;
        }
        catch (error) {
            console.error(`Error deleting hash field ${field} for key ${key}:`, error);
            return false;
        }
    }
    disconnect() {
        if (this.redisClient) {
            this.redisClient.disconnect();
            console.log('Disconnected from Redis');
        }
    }
};
exports.RedisService = RedisService;
exports.RedisService = RedisService = tslib_1.__decorate([
    (0, common_1.Injectable)(),
    tslib_1.__metadata("design:paramtypes", [config_1.ConfigService])
], RedisService);
//# sourceMappingURL=redis.service.js.map