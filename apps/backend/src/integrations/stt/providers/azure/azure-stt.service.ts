import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ISttService } from '../../interfaces/stt.interface';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

@Injectable()
export class AzureSttService implements ISttService {
  private readonly logger = new Logger(AzureSttService.name);
  private readonly subscriptionKey: string;
  private readonly region: string;
  private readonly endpoint: string;
  private readonly activeSessions: Map<string, {
    recognizer: sdk.SpeechRecognizer,
    transcription: string,
    audioConfig: sdk.AudioConfig
  }> = new Map();

  constructor(private configService: ConfigService) {
    this.subscriptionKey = this.configService.get<string>('AZURE_RESOURCE_KEY');
    this.region = this.configService.get<string>('AZURE_REGION');
    this.endpoint = this.configService.get<string>('AZURE_SPEECH_TO_TEXT_ENDPOINT');
    
    if (!this.subscriptionKey || !this.region) {
      this.logger.warn('Azure STT credentials not properly configured');
    } else {
      this.logger.log('Azure STT service initialized');
    }
  }

  async streamToText(audioStream: any): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      try {
        const pushStream = sdk.AudioInputStream.createPushStream();
        
        // Push audio data to the stream
        if (audioStream instanceof Buffer) {
          pushStream.write(audioStream);
        } else {
          reject(new Error('Unsupported audio stream format'));
          return;
        }
        
        // Close the stream to indicate end of audio
        pushStream.close();
        
        const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
        const speechConfig = sdk.SpeechConfig.fromSubscription(this.subscriptionKey, this.region);
        
        // Configure speech recognition
        speechConfig.speechRecognitionLanguage = 'en-US';
        
        const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
        
        recognizer.recognizeOnceAsync(
          (result) => {
            recognizer.close();
            if (result.reason === sdk.ResultReason.RecognizedSpeech) {
              resolve(result.text);
            } else {
              resolve(''); // No speech recognized
            }
          },
          (err) => {
            recognizer.close();
            reject(err);
          }
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  async startContinuousTranscription(): Promise<string> {
    try {
      // Create a session ID
      const sessionId = Date.now().toString();
      
      // Create a push stream for continuous audio
      const pushStream = sdk.AudioInputStream.createPushStream();
      
      // Create audio config from the push stream
      const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
      
      // Create speech config
      const speechConfig = sdk.SpeechConfig.fromSubscription(this.subscriptionKey, this.region);
      speechConfig.speechRecognitionLanguage = 'en-US';
      
      // Enable continuous recognition
      speechConfig.enableDictation();
      
      // Create recognizer
      const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
      
      let transcription = '';
      
      // Set up event handlers
      recognizer.recognized = (s, e) => {
        if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
          const session = this.activeSessions.get(sessionId);
          if (session) {
            session.transcription += ' ' + e.result.text;
            this.activeSessions.set(sessionId, session);
          }
        }
      };
      
      recognizer.recognizing = (s, e) => {
        // Handle intermediate results if needed
      };
      
      // Start continuous recognition
      recognizer.startContinuousRecognitionAsync(
        () => {
          this.logger.log(`Started continuous recognition session: ${sessionId}`);
        },
        (err) => {
          this.logger.error(`Error starting continuous recognition: ${err}`);
        }
      );
      
      // Store session data
      this.activeSessions.set(sessionId, {
        recognizer,
        transcription,
        audioConfig: audioConfig as any
      });
      
      return sessionId;
    } catch (error) {
      this.logger.error(`Error in startContinuousTranscription: ${error.message}`);
      throw error;
    }
  }

  async addAudioChunk(sessionId: string, audioChunk: ArrayBuffer): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    try {
      // Get the push stream from the audio config
      const pushStream = (session.audioConfig as any).privPushStream;
      
      // Convert ArrayBuffer to Buffer and push to the stream
      const buffer = Buffer.from(audioChunk);
      pushStream.write(buffer);
    } catch (error) {
      this.logger.error(`Error adding audio chunk to session ${sessionId}: ${error.message}`);
      throw error;
    }
  }

  async getIntermediateTranscription(sessionId: string): Promise<string> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    return session.transcription;
  }

  async endContinuousTranscription(sessionId: string): Promise<string> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    return new Promise<string>((resolve, reject) => {
      try {
        session.recognizer.stopContinuousRecognitionAsync(
          () => {
            const finalTranscription = session.transcription;
            
            // Clean up resources
            session.recognizer.close();
            this.activeSessions.delete(sessionId);
            
            resolve(finalTranscription);
          },
          (err) => {
            this.logger.error(`Error stopping continuous recognition: ${err}`);
            reject(err);
          }
        );
      } catch (error) {
        this.logger.error(`Error in endContinuousTranscription: ${error.message}`);
        reject(error);
      }
    });
  }
}
