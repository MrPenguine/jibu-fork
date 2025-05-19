import { Controller, Post, Body, Logger, Param } from '@nestjs/common';
import { VectorDbService } from './vector-db.service';

interface SearchRequest {
  vector: number[];
  limit?: number;
  filter?: any;
}

@Controller('api/vector-db')
export class VectorDbController {
  private readonly logger = new Logger(VectorDbController.name);
  
  constructor(private readonly vectorDbService: VectorDbService) {}
  
  @Post(':collection/search')
  async search(@Param('collection') collection: string, @Body() request: SearchRequest) {
    this.logger.log(`Searching collection ${collection} with limit ${request.limit || 5}`);
    
    if (!request.vector || !Array.isArray(request.vector)) {
      return { error: 'Valid vector is required' };
    }
    
    try {
      const results = await this.vectorDbService.search(collection, {
        vector: request.vector,
        limit: request.limit || 5,
        with_payload: true,
        filter: request.filter
      });
      
      return {
        success: true,
        results
      };
    } catch (error) {
      this.logger.error(`Error searching collection ${collection}: ${error.message}`);
      
      return {
        success: false,
        error: error.message
      };
    }
  }
}
