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
      // Create documents from text - this will split according to our configuration
      const documents = await this.textSplitter.createDocuments([text]);
      
      // Extract the page content from each document
      const chunks = documents.map(doc => doc.pageContent);
      
      this.logger.log(`Successfully split text into ${chunks.length} chunks`);
      return chunks;
    } catch (error) {
      this.logger.error(`Error splitting text: ${error.message}`);
      throw new Error(`Failed to split text: ${error.message}`);
    }
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