import { Injectable, Logger } from '@nestjs/common';
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

/**
 * Text chunking service for breaking down documents into manageable pieces
 */
@Injectable()
export class ChunkingService {
  private readonly logger = new Logger(ChunkingService.name);
  private readonly textSplitter: RecursiveCharacterTextSplitter;
  
  constructor() {
    // Configure text splitter with appropriate settings for knowledge base
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,         // Target chunk size - adjust based on embedding model
      chunkOverlap: 200,       // Overlap between chunks for context preservation
      separators: [           // Custom separators in order of priority
        "\n\n",               // Paragraphs
        "\n",                 // Lines
        ". ",                 // Sentences
        "! ",                 // Exclamations
        "? ",                 // Questions
        ";",                  // Semicolons
        ":",                  // Colons
        " ",                  // Words
        "",                   // Characters
      ],
    });
    
    this.logger.log('ChunkingService initialized with RecursiveCharacterTextSplitter');
  }
  
  /**
   * Splits text into chunks using RecursiveCharacterTextSplitter
   * @param text The text to split into chunks
   * @returns Array of text chunks
   */
  async splitTextIntoChunks(text: string): Promise<string[]> {
    this.logger.log(`Splitting text of length ${text.length} into chunks`);
    
    try {
      // Handle binary/PDF content or very short texts
      if (!text || text.length < 10) {
        this.logger.warn('Text is too short, returning single chunk');
        return [text || ''];
      }
      
      // Check if this might be binary content based on common patterns
      const isBinaryLike = this.containsBinaryPatterns(text);
      
      if (isBinaryLike) {
        this.logger.warn('Text appears to contain binary data, using safe chunking mode');
        // For binary-like content, use simple splitting by length to avoid processing issues
        return this.splitByLength(text, 800, 100);
      }
      
      // Create documents from text - this will split according to our configuration
      const documents = await this.textSplitter.createDocuments([text]);
      
      // Extract the page content from each document
      const chunks = documents.map(doc => doc.pageContent);
      
      this.logger.log(`Successfully split text into ${chunks.length} chunks`);
      return chunks;
    } catch (error) {
      this.logger.error(`Error splitting text: ${error.message}`);
      // Fallback to simple splitting in case of error
      this.logger.warn('Falling back to simple splitting method');
      return this.splitByLength(text, 800, 100);
    }
  }
  
  /**
   * Simple method to split text by length for binary or problematic content
   */
  private splitByLength(text: string, chunkSize: number, overlap: number): string[] {
    if (!text) return [''];
    
    const chunks: string[] = [];
    let startIndex = 0;
    
    while (startIndex < text.length) {
      const endIndex = Math.min(startIndex + chunkSize, text.length);
      chunks.push(text.substring(startIndex, endIndex));
      startIndex += chunkSize - overlap;
    }
    
    this.logger.log(`Split text into ${chunks.length} chunks using simple length-based splitting`);
    return chunks;
  }
  
  /**
   * Check if text contains patterns indicating it might be binary data
   */
  private containsBinaryPatterns(text: string): boolean {
    // Check for PDF markers
    if (text.includes('%PDF-')) return true;
    
    // Check for high concentration of control characters or null bytes
    const controlCharCount = (text.match(/[\x00-\x1F\x7F-\x9F]/g) || []).length;
    const controlCharRatio = controlCharCount / text.length;
    
    // If more than 5% of text is control characters, treat as binary
    if (controlCharRatio > 0.05) return true;
    
    // Check for common binary file signatures
    const commonBinarySigs = [
      'PK\x03\x04',           // ZIP archive
      '\x89PNG',              // PNG image
      'GIF8',                 // GIF image
      '\xff\xd8\xff',         // JPEG image
      '%!PS',                 // PostScript
      'BM'                    // BMP image
    ];
    
    for (const sig of commonBinarySigs) {
      if (text.includes(sig)) return true;
    }
    
    return false;
  }
  
  /**
   * Adjusts splitting parameters 
   * @param chunkSize The target size of each chunk
   * @param chunkOverlap The overlap between chunks
   */
  setChunkParameters(chunkSize: number, chunkOverlap: number): void {
    this.logger.log(`Updating chunk parameters: size=${chunkSize}, overlap=${chunkOverlap}`);
    
    this.textSplitter.chunkSize = chunkSize;
    this.textSplitter.chunkOverlap = chunkOverlap;
  }
} 