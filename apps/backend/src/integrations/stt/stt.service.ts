import { Injectable, Logger } from '@nestjs/common';
import { SttFactory } from './stt.factory';
import { ISttService } from './interfaces/stt.interface';

/**
 * General Speech-to-Text service that delegates to the appropriate provider
 */
@Injectable()
export class SttService implements ISttService {
  private readonly logger = new Logger(SttService.name);
  private readonly sttService: ISttService;

  constructor(private sttFactory: SttFactory) {
    this.sttService = this.sttFactory.createSttService();
  }

  async streamToText(audioStream: any): Promise<string> {
    try {
      return await this.sttService.streamToText(audioStream);
    } catch (error) {
      this.logger.error(`Error in streamToText: ${error.message}`);
      throw error;
    }
  }

  async startContinuousTranscription(): Promise<string> {
    try {
      return await this.sttService.startContinuousTranscription();
    } catch (error) {
      this.logger.error(`Error in startContinuousTranscription: ${error.message}`);
      throw error;
    }
  }

  async addAudioChunk(sessionId: string, audioChunk: ArrayBuffer): Promise<void> {
    try {
      await this.sttService.addAudioChunk(sessionId, audioChunk);
    } catch (error) {
      this.logger.error(`Error in addAudioChunk: ${error.message}`);
      throw error;
    }
  }

  async getIntermediateTranscription(sessionId: string): Promise<string> {
    try {
      return await this.sttService.getIntermediateTranscription(sessionId);
    } catch (error) {
      this.logger.error(`Error in getIntermediateTranscription: ${error.message}`);
      throw error;
    }
  }

  async endContinuousTranscription(sessionId: string): Promise<string> {
    try {
      return await this.sttService.endContinuousTranscription(sessionId);
    } catch (error) {
      this.logger.error(`Error in endContinuousTranscription: ${error.message}`);
      throw error;
    }
  }
}
