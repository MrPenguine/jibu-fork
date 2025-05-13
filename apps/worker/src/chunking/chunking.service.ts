import { Injectable, Logger } from '@nestjs/common';
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

/**
 * Text chunking service for breaking down documents into manageable pieces
 */
@Injectable()
export class ChunkingService {
  private readonly logger = new Logger(ChunkingService.name);
  private readonly textSplitter: RecursiveCharacterTextSplitter;
  private readonly pdfSplitter: RecursiveCharacterTextSplitter;
  
  constructor() {
    // Configure text splitter with appropriate settings for general text
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
    
    // Configure a specialized splitter for PDF content
    this.pdfSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 800,          // Smaller chunks for PDFs to handle formatting artifacts
      chunkOverlap: 150,       // Substantial overlap to maintain context across PDF chunks
      separators: [
        // PDF-specific separator patterns in order of priority (similar to LangChain example)
        "\n\n\n",             // Multiple paragraph breaks - highest priority
        "\n\n",               // Paragraph breaks
        "\n",                 // Line breaks
        ". ",                 // Sentences
        ".\n",                // End of sentences with line breaks
        "! ",                 // Exclamations
        "? ",                 // Questions
        ";\n",                // Semicolons with line breaks
        "; ",                 // Semicolons
        ":\n",                // Colons with line breaks
        ": ",                 // Colons
        " - ",                // Dash separators
        ", ",                 // Commas (lower priority than in regular text)
        " ",                  // Words
        "",                   // Characters - lowest priority
      ],
      keepSeparator: true,     // Keep the separator at the end of each chunk like in LangChain
    });
    
    this.logger.log('ChunkingService initialized with specialized splitters for different content types');
  }
  
  /**
   * Splits text into chunks using RecursiveCharacterTextSplitter
   * @param text The text to split into chunks
   * @returns Array of text chunks
   */
  async splitTextIntoChunks(text: string, mimeType?: string): Promise<string[]> {
    this.logger.log(`Splitting text of length ${text.length} into chunks${mimeType ? ` (mime: ${mimeType})` : ''}`);
    
    try {
      // Handle empty or very short texts
      if (!text || text.length < 10) {
        this.logger.warn('Text is too short, returning single chunk');
        return [text || ''];
      }
      
      // Check if this looks like extracted PDF content
      const isPdfContent = mimeType?.includes('pdf') || 
                          this.containsPdfPatterns(text);
      
      // Check if this might be binary content based on common patterns
      const isBinaryLike = this.containsBinaryPatterns(text);
      
      if (isBinaryLike) {
        this.logger.warn('Text appears to contain binary data, using safe chunking mode');
        // For binary-like content, use simple splitting by length to avoid processing issues
        return this.splitByLength(text, 800, 100);
      }
      
      // Create documents from text using the appropriate splitter
      const splitter = isPdfContent ? this.pdfSplitter : this.textSplitter;
      this.logger.debug(`Using ${isPdfContent ? 'PDF' : 'standard'} text splitter`);
      
      const documents = await splitter.createDocuments([text]);
      
      // Extract the page content from each document
      const chunks = documents.map(doc => doc.pageContent);
      
      this.logger.log(`Successfully split text into ${chunks.length} chunks`);
      
      // Apply post-processing to clean up chunks if needed
      const processedChunks = isPdfContent ? 
        chunks.map(chunk => this.postProcessPdfChunk(chunk)) : 
        chunks;
      
      return processedChunks;
    } catch (error) {
      this.logger.error(`Error splitting text: ${error.message}`);
      // Fallback to simple splitting in case of error
      this.logger.warn('Falling back to simple splitting method');
      return this.splitByLength(text, 800, 100);
    }
  }
  
  /**
   * Post-processes PDF chunks to clean up common PDF extraction artifacts
   */
  private postProcessPdfChunk(chunk: string): string {
    // Remove common PDF artifacts and clean up the text
    return chunk
      // Remove PDF operator remnants 
      .replace(/\/([\w]+)(?=[\s\d])/g, '')
      // Remove incomplete hex codes
      .replace(/[<>]/g, ' ')
      // Remove lone numbers that might be object IDs
      .replace(/^\d+\s*$/gm, '')
      // Remove PDF syntax elements
      .replace(/\b(obj|endobj|stream|endstream|xref|trailer|startxref)\b/g, ' ')
      // Remove PDF operators
      .replace(/\b(Tj|TJ|Td|TD|Tf|Tc|Tw|Tz|BT|ET|cm|gs|re|q|Q|Do)\b/g, ' ')
      // Remove common non-text artifacts
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Replace unhelpful binary/hex data patterns
      .replace(/(?:\\x[0-9a-f]{2}|\\u[0-9a-f]{4})+/gi, ' ')
      // Replace form feed characters with newlines
      .replace(/\f/g, '\n')
      // Replace any non-printable or control characters
      .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, ' ')
      // Replace multiple spaces with single space
      .replace(/\s+/g, ' ')
      // Trim the chunk
      .trim();
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
   * Check if text contains patterns indicating it might be extracted PDF content
   */
  private containsPdfPatterns(text: string): boolean {
    // Check for specific PDF content patterns
    const pdfPatterns = [
      // Content likely from a PDF
      /Page \d+ of \d+/i,
      /^\s*\d+\s*$/m,  // Page numbers on their own lines
      /©.*\d{4}/,      // Copyright notices with years
      /Figure \d+:/i,  // Figure captions
      /Table \d+:/i,   // Table captions
      /References:/i,  // Academic reference sections
      /et al\./i,      // Academic citations
      // Additional PDF-specific markers
      /^\s*\d+\s*$/m,  // Page numbers
      /^Contents$/m,   // Table of contents
      /^Index$/m,      // Index page
      /^Appendix [A-Z]$/m, // Appendix headings
    ];
    
    return pdfPatterns.some(pattern => pattern.test(text));
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
    
    // Check for high concentration of non-ASCII characters (possible binary content)
    const nonAsciiCount = (text.match(/[^\x20-\x7E\xA0-\xFF\s]/g) || []).length;
    const nonAsciiRatio = nonAsciiCount / text.length;
    
    // If more than 10% non-ASCII/non-whitespace, likely binary or corrupted text
    if (nonAsciiRatio > 0.1) return true;
    
    // Check for sequences of binary data markers
    if (/(?:hÞ|ÂÃ|Ø×|õô)/i.test(text)) return true;
    
    // Check for common binary file signatures
    const commonBinarySigs = [
      'PK\x03\x04',           // ZIP archive
      '\x89PNG',              // PNG image
      'GIF8',                 // GIF image
      '\xff\xd8\xff',         // JPEG image
      '%!PS',                 // PostScript
      'BM',                   // BMP image
      'obj',                  // PDF object marker
      'endobj',               // PDF object end marker
      'stream',               // PDF stream marker
      'endstream'             // PDF stream end marker
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
    
    // Also update PDF splitter but with slightly smaller chunks
    this.pdfSplitter.chunkSize = Math.floor(chunkSize * 0.8);
    this.pdfSplitter.chunkOverlap = Math.floor(chunkOverlap * 1.25);
  }
} 