import { Injectable } from '@nestjs/common';
import { VaultService } from '../../../core/encryption/vault.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { CreateCredentialDto } from './dto/create-credential.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class CredentialService {
  constructor(
    private readonly vaultService: VaultService,
    private readonly prisma: PrismaService,
  ) {}

  async createCredential(body: CreateCredentialDto, workspaceId: string, userId: string) {
    const { type, name, data } = body;
    const credentialId = randomUUID();
    const provider = 'custom'; // Or extract from body if needed

    // 1. Store secret in Vault
    await this.vaultService.writeSecret('credentials', workspaceId, credentialId, data, userId);

    // 2. Store metadata in DB
    const created = await this.prisma.credential.create({
      data: {
        id: credentialId,
        workspaceId: workspaceId,
        provider,
        type,
        name,
        encryptedCredentials: '', // Not used, as secret is in Vault
        metadata: {},
        userId,
      },
    });
    return { id: created.id, name: created.name, type: created.type };
  }

  async listCredentials(workspaceId: string) {
    return this.prisma.credential.findMany({
      where: { workspaceId: workspaceId },
      select: { id: true, name: true, type: true, createdAt: true, updatedAt: true },
    });
  }

  async getCredential(id: string, workspaceId: string, userId: string) {
    // 1. Get metadata from DB
    const meta = await this.prisma.credential.findUnique({ where: { id } });
    if (!meta) return null;
    // 2. Get secret from Vault
    const secret = await this.vaultService.readSecret('credentials', workspaceId, id, userId);
    return { ...meta, secret };
  }

  async deleteCredential(id: string, workspaceId: string, userId: string) {
    // 1. Get metadata from DB
    const meta = await this.prisma.credential.findUnique({ where: { id } });
    if (!meta) return null;
    // 2. Delete from Vault
    await this.vaultService.deleteSecret('credentials', workspaceId, id, userId);
    // 3. Delete metadata from DB
    await this.prisma.credential.delete({ where: { id } });
    return { id };
  }

  async updateCredential(id: string, workspaceId: string, userId: string, data: { name?: string; type?: string }) {
    return this.prisma.credential.update({
      where: { id },
      data,
    });
  }
}