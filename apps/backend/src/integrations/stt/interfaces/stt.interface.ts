/**
 * Interface for Speech-to-Text providers
 */
export interface ISttService {
  /**
   * Convert audio stream to text
   * @param audioStream Audio stream to transcribe
   * @returns Promise with transcription result
   */
  streamToText(audioStream: any): Promise<string>;

  /**
   * Start a continuous transcription session
   * @returns Session ID
   */
  startContinuousTranscription(): Promise<string>;

  /**
   * Add audio chunk to an ongoing transcription session
   * @param sessionId Session ID from startContinuousTranscription
   * @param audioChunk Audio chunk as ArrayBuffer
   */
  addAudioChunk(sessionId: string, audioChunk: ArrayBuffer): Promise<void>;

  /**
   * Get intermediate transcription results
   * @param sessionId Session ID
   * @returns Current transcription
   */
  getIntermediateTranscription(sessionId: string): Promise<string>;

  /**
   * End a continuous transcription session and get final result
   * @param sessionId Session ID
   * @returns Final transcription
   */
  endContinuousTranscription(sessionId: string): Promise<string>;
}
