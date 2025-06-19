import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class VoiceActivityService {
  private readonly logger = new Logger(VoiceActivityService.name);
  
  // Default thresholds for voice activity detection
  private readonly DEFAULT_SILENCE_THRESHOLD = -50; // dB
  private readonly DEFAULT_VOICE_THRESHOLD = -35; // dB
  private readonly DEFAULT_SILENCE_DURATION = 2000; // ms
  
  // Configurable thresholds
  private silenceThreshold: number;
  private voiceThreshold: number;
  private silenceDuration: number;

  constructor(private configService: ConfigService) {
    // Load configuration with defaults
    this.silenceThreshold = this.configService.get<number>(
      'LIVEKIT_SILENCE_THRESHOLD',
      this.DEFAULT_SILENCE_THRESHOLD,
    );
    this.voiceThreshold = this.configService.get<number>(
      'LIVEKIT_VOICE_THRESHOLD',
      this.DEFAULT_VOICE_THRESHOLD,
    );
    this.silenceDuration = this.configService.get<number>(
      'LIVEKIT_SILENCE_DURATION',
      this.DEFAULT_SILENCE_DURATION,
    );

    this.logger.log('VoiceActivityService initialized with thresholds:');
    this.logger.log(`Silence threshold: ${this.silenceThreshold} dB`);
    this.logger.log(`Voice threshold: ${this.voiceThreshold} dB`);
    this.logger.log(`Silence duration: ${this.silenceDuration} ms`);
  }

  /**
   * Determine if audio level indicates voice activity
   * @param audioLevel Audio level in dB
   * @returns Boolean indicating if voice is detected
   */
  isVoiceDetected(audioLevel: number): boolean {
    return audioLevel > this.voiceThreshold;
  }

  /**
   * Determine if audio level indicates silence
   * @param audioLevel Audio level in dB
   * @returns Boolean indicating if silence is detected
   */
  isSilenceDetected(audioLevel: number): boolean {
    return audioLevel < this.silenceThreshold;
  }

  /**
   * Get the current silence threshold
   * @returns Silence threshold in dB
   */
  getSilenceThreshold(): number {
    return this.silenceThreshold;
  }

  /**
   * Get the current voice threshold
   * @returns Voice threshold in dB
   */
  getVoiceThreshold(): number {
    return this.voiceThreshold;
  }

  /**
   * Get the current silence duration threshold
   * @returns Silence duration in ms
   */
  getSilenceDuration(): number {
    return this.silenceDuration;
  }

  /**
   * Update voice activity detection thresholds
   * @param silenceThreshold New silence threshold in dB
   * @param voiceThreshold New voice threshold in dB
   * @param silenceDuration New silence duration in ms
   */
  updateThresholds(
    silenceThreshold?: number,
    voiceThreshold?: number,
    silenceDuration?: number,
  ): void {
    if (silenceThreshold !== undefined) {
      this.silenceThreshold = silenceThreshold;
      this.logger.log(`Updated silence threshold to ${silenceThreshold} dB`);
    }
    
    if (voiceThreshold !== undefined) {
      this.voiceThreshold = voiceThreshold;
      this.logger.log(`Updated voice threshold to ${voiceThreshold} dB`);
    }
    
    if (silenceDuration !== undefined) {
      this.silenceDuration = silenceDuration;
      this.logger.log(`Updated silence duration to ${silenceDuration} ms`);
    }
  }
}
