declare module 'elevenlabs' {
  export interface VoiceSettings {
    stability?: number;
    similarity_boost?: number;
    style?: number;
    use_speaker_boost?: boolean;
  }

  export interface TextToSpeechOptions {
    output_format?: string;
    model_id?: string;
    text: string;
    voice_settings?: VoiceSettings;
    optimize_streaming_latency?: number;
    apply_text_normalization?: 'auto' | 'on' | 'off';
    apply_language_text_normalization?: boolean;
    seed?: number;
    previous_text?: string;
    next_text?: string;
    previous_request_ids?: string[];
    next_request_ids?: string[];
  }

  export interface TextToSpeech {
    convertAsStream(voiceId: string, options: TextToSpeechOptions): Promise<AsyncIterable<Buffer>>;
  }

  export interface ElevenLabsClientOptions {
    apiKey: string;
  }

  export class ElevenLabsClient {
    constructor(options: ElevenLabsClientOptions);
    textToSpeech: TextToSpeech;
  }
}
