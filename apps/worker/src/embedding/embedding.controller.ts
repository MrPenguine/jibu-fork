import { Controller, Post, Body, Logger } from '@nestjs/common';
import { EmbeddingService } from './embedding.service';

interface EmbeddingRequest {
  text: string;
}

@Controller('api/embedding')
export class EmbeddingController {
  private readonly logger = new Logger(EmbeddingController.name);
  
  constructor(private readonly embeddingService: EmbeddingService) {}
  
  @Post('generate')
  async generateEmbedding(@Body() request: EmbeddingRequest) {
    this.logger.log(`Generating embedding for text: ${request.text.substring(0, 30)}...`);
    
    if (!request.text) {
      return { error: 'Text is required' };
    }
    
    try {
      const embedding = await this.embeddingService.embedText(request.text);
      
      return {
        success: true,
        embedding
      };
    } catch (error) {
      this.logger.error(`Error generating embedding: ${error.message}`);
      
      return {
        success: false,
        error: error.message
      };
    }
  }
}
