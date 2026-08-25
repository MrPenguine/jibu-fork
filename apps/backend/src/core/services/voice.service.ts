import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import FormData from 'form-data';
import * as fs from 'fs';
import { Readable } from 'stream';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const prisma = new PrismaClient();

// Helper to get the correct Chatterbox URL (handles both Docker and local dev)
let activeChatterboxUrl = process.env.CHATTERBOX_URL || 'http://chatterbox:4123' || 'http://localhost:4123';

export class VoiceService {
  /**
   * List all voices in a workspace
   */
  static async listVoices(workspaceId: string) {
    return await prisma.voice.findMany({
      where: { workspaceId },
      include: { file: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Create a custom cloned voice
   */
  static async createVoice(data: {
    workspaceId: string;
    name: string;
    description?: string;
    language?: string;
    fileId: string; // The ID of the uploaded File record containing the voice sample
    metadata?: any;
    type?: string;
  }) {
    let voice = await prisma.voice.create({
      data: {
        workspaceId: data.workspaceId,
        name: data.name,
        description: data.description,
        language: data.language || 'en',
        type: data.type || 'cloned',
        fileId: data.fileId,
        metadata: data.metadata || { exaggeration: 0.5, cfg_weight: 0.5 }
      }
    });

    // Push the sample to Chatterbox's local VOICES_DIR so the file is available
    // inside the Chatterbox container/folder even if S3 is not reachable.
    if (data.fileId) {
      const file = await prisma.file.findUnique({ where: { id: data.fileId } });
      if (file) {
        console.log(`[VoiceService] Pushing voice ${voice.id} sample to Chatterbox at ${activeChatterboxUrl}`);
        const chatterboxVoiceName = await this.pushVoiceToChatterbox(voice, file);
        if (chatterboxVoiceName) {
          console.log(`[VoiceService] Voice ${voice.id} registered in Chatterbox as ${chatterboxVoiceName}`);
          voice = await prisma.voice.update({
            where: { id: voice.id },
            data: {
              metadata: {
                ...(voice.metadata as any || {}),
                chatterboxVoiceName
              }
            }
          });
        }
      } else {
        console.warn(`[VoiceService] No file found for fileId ${data.fileId}`);
      }
    }

    return voice;
  }

  /**
   * Delete a voice
   */
  static async deleteVoice(id: string, workspaceId: string) {
    return await prisma.voice.deleteMany({
      where: { id, workspaceId }
    });
  }

  /**
   * Update a custom voice's metadata
   */
  static async updateVoice(id: string, workspaceId: string, data: {
    name?: string;
    description?: string;
    language?: string;
    metadata?: any;
  }) {
    const existing = await prisma.voice.findFirst({ where: { id, workspaceId } });
    if (!existing) throw new Error('Voice not found');

    return await prisma.voice.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.language !== undefined ? { language: data.language } : {}),
        ...(data.metadata !== undefined ? { metadata: { ...(existing.metadata as any || {}), ...data.metadata } } : {}),
      }
    });
  }

  /**
   * Generate streaming TTS audio using Chatterbox (Backend Proxy)
   */
  static async generateStreamingSpeech(text: string, voiceId: string, workspaceId?: string): Promise<Readable> {
    const voice = await prisma.voice.findFirst({
      where: workspaceId ? { id: voiceId, workspaceId } : { id: voiceId },
      include: { file: true }
    });

    if (!voice) {
      throw new Error('Voice not found');
    }

    const requestData = {
      input: text,
      streaming_strategy: 'sentence',
      streaming_chunk_size: 200,
      ...((voice.metadata as any) || {})
    };

    if (voice.file || (voice.metadata as any)?.chatterboxVoiceName) {
      const formData = new FormData();
      formData.append('input', requestData.input);

      // If the voice was previously registered in Chatterbox's local VOICES_DIR,
      // reference it by name instead of shipping the whole file every request.
      const chatterboxVoiceName = (voice.metadata as any)?.chatterboxVoiceName;
      if (chatterboxVoiceName) {
        formData.append('voice', chatterboxVoiceName);
      } else {
        const fileBuffer = await this.getVoiceSampleBuffer(voice.file);
        formData.append('voice_file', fileBuffer, {
          filename: voice.file.name,
          knownLength: voice.file.sizeBytes
        });
      }

      if (requestData.exaggeration !== undefined) formData.append('exaggeration', requestData.exaggeration.toString());
      if (requestData.cfg_weight !== undefined) formData.append('cfg_weight', requestData.cfg_weight.toString());
      if (requestData.temperature !== undefined) formData.append('temperature', requestData.temperature.toString());
      // Add streaming parameters that Chatterbox now accepts but may ignore
      if (requestData.streaming_strategy) formData.append('streaming_strategy', requestData.streaming_strategy.toString());
      if (requestData.streaming_chunk_size) formData.append('streaming_chunk_size', requestData.streaming_chunk_size.toString());

      let response;
      try {
        response = await axios.post(`${activeChatterboxUrl}/v1/audio/speech/stream`, formData, {
          headers: formData.getHeaders(),
          responseType: 'stream'
        });
      } catch (err: any) {
        if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
          activeChatterboxUrl = 'http://localhost:4123';
          response = await axios.post(`${activeChatterboxUrl}/v1/audio/speech/stream`, formData, {
            headers: formData.getHeaders(),
            responseType: 'stream'
          });
        } else throw err;
      }

      return response.data;
    } else {
      let response;
      try {
        response = await axios.post(`${activeChatterboxUrl}/v1/audio/speech/json`, requestData, {
          headers: { 'Content-Type': 'application/json' },
          responseType: 'stream'
        });
      } catch (err: any) {
        if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
          activeChatterboxUrl = 'http://localhost:4123';
          response = await axios.post(`${activeChatterboxUrl}/v1/audio/speech/json`, requestData, {
            headers: { 'Content-Type': 'application/json' },
            responseType: 'stream'
          });
        } else throw err;
      }
      return response.data;
    }
  }

  /**
   * Upload a voice sample to the Chatterbox container's local voice library.
   * Returns the registered voice name, or null if Chatterbox is unreachable.
   */
  private static async pushVoiceToChatterbox(voice: any, file: any): Promise<string | null> {
    try {
      const fileBuffer = await this.getVoiceSampleBuffer(file);
      const formData = new FormData();
      formData.append('voice_name', voice.id);
      formData.append('language', voice.language || 'en');
      formData.append('voice_file', fileBuffer, {
        filename: file.name,
        knownLength: file.sizeBytes
      });

      let response;
      try {
        response = await axios.post(`${activeChatterboxUrl}/voices`, formData, {
          headers: formData.getHeaders(),
          responseType: 'json'
        });
      } catch (err: any) {
        if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
          activeChatterboxUrl = 'http://localhost:4123';
          response = await axios.post(`${activeChatterboxUrl}/voices`, formData, {
            headers: formData.getHeaders(),
            responseType: 'json'
          });
        } else {
          throw err;
        }
      }

      return response.data?.voice_name || voice.id;
    } catch (err) {
      console.warn(`Failed to push voice ${voice.id} to Chatterbox, will stream file buffer instead:`, err instanceof Error ? err.message : String(err));
      return null;
    }
  }

  /**
   * Retrieve the voice sample buffer from S3/Supabase, falling back to a local
   * uploads directory so the clip is accessible when running outside of S3.
   */
  private static async getVoiceSampleBuffer(file: any): Promise<Buffer> {
    const storageProvider = file.storageProvider || 's3';

    if (storageProvider === 's3' || storageProvider === 'supabase') {
      try {
        const s3Client = new S3Client({
          region: process.env.AWS_S3_REGION || 'us-east-1',
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
          },
        });
        const command = new GetObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET_NAME,
          Key: file.storageKey,
        });
        const s3Response = await s3Client.send(command);
        return Buffer.from(await s3Response.Body.transformToByteArray());
      } catch (err) {
        console.warn(`S3 fetch failed for voice sample ${file.storageKey}, trying local fallback`, err instanceof Error ? err.message : String(err));
      }
    }

    // Local fallback paths: relative to backend and via absolute project path
    const candidates = [
      `uploads/${file.storageKey}`,
      `uploads/${file.id}/${file.name}`,
      `apps/backend/uploads/${file.storageKey}`,
      `apps/backend/uploads/${file.id}/${file.name}`,
    ];

    for (const filePath of candidates) {
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath);
      }
    }

    throw new Error('Voice sample file not found on disk or S3');
  }
}
