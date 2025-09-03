import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
// Fix import to avoid esModuleInterop error
const vaultFactory = require('node-vault');

// Define interfaces for TypeScript
interface VaultClient {
  approleLogin: (options: any) => Promise<any>;
  health: () => Promise<any>;
  write: (path: string, data: any) => Promise<any>;
  read: (path: string) => Promise<any>;
  list: (path: string) => Promise<any>;
  delete: (path: string) => Promise<any>;
}

interface VaultOptions {
  apiVersion: string;
  endpoint: string;
  token?: string;
}

@Injectable()
export class VaultService implements OnModuleInit {
    private readonly logger = new Logger(VaultService.name);
    private client: VaultClient;

    private readonly masterKey: Buffer;

constructor(private readonly configService: ConfigService) {
    const masterKeyString = this.configService.get<string>('ENCRYPTION_MASTER_KEY');
    if (!masterKeyString) {
        throw new Error('FATAL: ENCRYPTION_MASTER_KEY not configured!');
    }
    
    // Convert the hex string to a Buffer for cryptographic operations
    try {
        this.masterKey = Buffer.from(masterKeyString, 'hex');
        // Validate key length (32 bytes = 256 bits for AES-256)
        if (this.masterKey.length !== 32) {
            throw new Error(`FATAL: ENCRYPTION_MASTER_KEY must be 64 hex characters (32 bytes) for AES-256, got ${this.masterKey.length} bytes`);
        }
    } catch (error) {
        throw new Error(`FATAL: Invalid ENCRYPTION_MASTER_KEY format: ${error.message}`);
    }
}

    async onModuleInit() {
        const vaultAddr = this.configService.get<string>('VAULT_ADDR');
        const vaultToken = this.configService.get<string>('VAULT_TOKEN');
        const vaultRoleId = this.configService.get<string>('VAULT_APPROLE_ROLE_ID');
        const vaultSecretId = this.configService.get<string>('VAULT_APPROLE_SECRET_ID');

        if (!vaultAddr) {
            this.logger.error('VAULT_ADDR is not configured. VaultService will not initialize.');
            return;
        }

        const options: VaultOptions = {
            apiVersion: 'v1',
            endpoint: vaultAddr,
        };

        if (vaultToken) {
            options.token = vaultToken;
            this.logger.log('Initializing Vault client with Token authentication');
        }

        try {
            this.client = vaultFactory(options);
            if (vaultRoleId && vaultSecretId) {
                await this.client.approleLogin({
                    role_id: vaultRoleId,
                    secret_id: vaultSecretId,
                });
                this.logger.log('Vault AppRole login successful. Client token obtained.');
            } else if (vaultToken) {
                const health = await this.client.health();
                if (!health || !health.initialized || health.sealed) {
                    throw new Error(`Vault connection failed or Vault is sealed/uninitialized. Health: ${JSON.stringify(health)}`);
                }
                this.logger.log('Vault client initialized and connection healthy (Token Auth)');
            }
        } catch (error) {
            this.logger.error(`Failed to initialize Vault client or authenticate: ${error.message}`, error.stack);
            this.client = null;
        }
    }

    private ensureClient(): VaultClient {
        if (!this.client) {
            this.logger.error('Vault client is not initialized or failed to initialize.');
            throw new Error('Vault client is not available.');
        }
        return this.client;
    }
    
    /**
     * Encrypts data using the master key
     * @param data The data to encrypt
     * @returns The encrypted data and IV as a hex string
     */
    encrypt(data: string): string {
        const iv = crypto.randomBytes(16); // 16 bytes IV for AES
        const cipher = crypto.createCipheriv('aes-256-cbc', this.masterKey, iv);
        
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        // Return IV + encrypted data (IV is needed for decryption)
        return iv.toString('hex') + ':' + encrypted;
    }
    
    /**
     * Decrypts data using the master key
     * @param encryptedData The encrypted data (IV + encrypted content)
     * @returns The decrypted data
     */
    decrypt(encryptedData: string): string {
        const [ivHex, encryptedHex] = encryptedData.split(':');
        
        if (!ivHex || !encryptedHex) {
            throw new Error('Invalid encrypted data format');
        }
        
        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', this.masterKey, iv);
        
        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }

    private buildSecretPath(basePath: string, orgId: string, pathSuffix: string, userId?: string | null, metadataPath: boolean = false): string {
        const prefix = metadataPath ? 'secret/metadata' : 'secret/data';
        let fullPath = `${prefix}/${basePath}/${orgId}`;
        if (userId) {
            fullPath += `/${userId}`;
        }
        fullPath += `/${pathSuffix}`;
        return fullPath;
    }

    async writeSecret<T = Record<string, any>>(
        basePath: string,
        orgId: string,
        pathSuffix: string,
        data: T,
        userId?: string | null,
    ): Promise<unknown> {
        this.ensureClient();
        const fullPath = this.buildSecretPath(basePath, orgId, pathSuffix, userId);
        this.logger.log(`Writing secret to Vault path: ${fullPath}`);
        try {
            return await this.client.write(fullPath, { data });
        } catch (error) {
            this.logger.error(`Failed to write secret to Vault path ${fullPath}: ${error.message}`, error.stack);
            throw error;
        }
    }

    async readSecret<T = Record<string, any>>(
        basePath: string,
        orgId: string,
        pathSuffix: string,
        userId?: string | null,
    ): Promise<T | null> {
        this.ensureClient();
        const fullPath = this.buildSecretPath(basePath, orgId, pathSuffix, userId);
        this.logger.log(`Reading secret from Vault path: ${fullPath}`);
        try {
            const response = await this.client.read(fullPath);
            return response?.data?.data as T ?? null;
        } catch (error) {
            if (error.response && error.response.statusCode === 404) {
                this.logger.warn(`Secret not found at Vault path: ${fullPath}`);
                return null;
            }
            this.logger.error(`Failed to read secret from Vault path ${fullPath}: ${error.message}`, error.stack);
            return null;
        }
    }

    async listSecrets(
        basePath: string,
        orgId: string,
        subPath: string = '',
        userId?: string | null,
    ): Promise<unknown> {
        this.ensureClient();
        const metadataPath = this.buildSecretPath(basePath, orgId, subPath, userId, true);
        this.logger.log(`Listing secrets under Vault path: ${metadataPath}`);
        try {
            const response = await this.client.list(metadataPath);
            return response?.data ?? null;
        } catch (error) {
            if (error.response && error.response.statusCode === 404) {
                this.logger.warn(`No secrets found to list under Vault path: ${metadataPath}`);
                return null;
            }
            this.logger.error(`Failed to list secrets under Vault path ${metadataPath}: ${error.message}`, error.stack);
            throw error;
        }
    }

    async deleteSecret(
        basePath: string,
        orgId: string,
        pathSuffix: string,
        userId?: string | null,
    ): Promise<any> {
        this.ensureClient();
        const fullPath = this.buildSecretPath(basePath, orgId, pathSuffix, userId);
        this.logger.log(`Deleting latest version of secret at Vault path: ${fullPath}`);
        try {
            return await this.client.delete(fullPath);
        } catch (error) {
            this.logger.error(`Failed to delete secret at Vault path ${fullPath}: ${error.message}`, error.stack);
            throw error;
        }
    }

    async destroySecret(
        basePath: string,
        orgId: string,
        pathSuffix: string,
        userId?: string | null,
    ): Promise<any> {
        this.ensureClient();
        const metadataPath = this.buildSecretPath(basePath, orgId, pathSuffix, userId, true);
        this.logger.log(`Permanently destroying secret and all versions at Vault path: ${metadataPath}`);
        try {
            return await this.client.delete(metadataPath);
        } catch (error) {
            this.logger.error(`Failed to destroy secret at Vault path ${metadataPath}: ${error.message}`, error.stack);
            throw error;
        }
    }
} 