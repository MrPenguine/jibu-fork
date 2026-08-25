import { Controller, Get, Post, Patch, Delete, Body, Param, Logger, UseGuards, Request, Query, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { VoiceService } from '../../../core/services/voice.service';
import axios from 'axios';

let activeChatterboxUrl = process.env.CHATTERBOX_URL || 'http://chatterbox:4123' || 'http://localhost:4123';

@ApiTags('custom-voices')
@Controller('v1/custom-voices')
export class CustomVoicesController {
  private readonly logger = new Logger(CustomVoicesController.name);

  private getWorkspaceId(req: any): string {
    const wid = req.headers?.['x-workspace-id'] || req.workspace?.id || req.user?.lastWorkspaceId;
    if (!wid) throw new HttpException('Workspace ID is required', HttpStatus.BAD_REQUEST);
    return wid;
  }

  @Get()
  @ApiOperation({ summary: 'List custom voices' })
  async listVoices(@Request() req: any) {
    const workspaceId = this.getWorkspaceId(req);
    return VoiceService.listVoices(workspaceId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a cloned voice' })
  async createVoice(@Request() req: any, @Body() body: any) {
    const workspaceId = this.getWorkspaceId(req);
    return VoiceService.createVoice({
      workspaceId,
      name: body.name,
      description: body.description,
      language: body.language,
      fileId: body.fileId,
      metadata: body.metadata,
      type: body.type,
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a custom voice' })
  @ApiParam({ name: 'id' })
  async updateVoice(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    const workspaceId = this.getWorkspaceId(req);
    return VoiceService.updateVoice(id, workspaceId, {
      name: body.name,
      description: body.description,
      language: body.language,
      metadata: body.metadata,
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a custom voice' })
  @ApiParam({ name: 'id' })
  async deleteVoice(@Request() req: any, @Param('id') id: string) {
    const workspaceId = this.getWorkspaceId(req);
    await VoiceService.deleteVoice(id, workspaceId);
    return { success: true };
  }

  // ── Chatterbox Proxy Endpoints ────────────────────────────────────────────

  @Get('chatterbox/status')
  @ApiOperation({ summary: 'Get Chatterbox TTS processing status' })
  async getChatterboxStatus(
    @Query('include_memory') includeMemory?: string,
    @Query('include_history') includeHistory?: string,
    @Query('include_stats') includeStats?: string,
  ) {
    try {
      const params = new URLSearchParams();
      if (includeMemory) params.set('include_memory', includeMemory);
      if (includeHistory) params.set('include_history', includeHistory);
      if (includeStats) params.set('include_stats', includeStats);

      try {
        const response = await axios.get(`${activeChatterboxUrl}/status?${params.toString()}`, { timeout: 5000 });
        return response.data;
      } catch (err: any) {
        if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
          activeChatterboxUrl = 'http://localhost:4123';
          const response = await axios.get(`${activeChatterboxUrl}/status?${params.toString()}`, { timeout: 5000 });
          return response.data;
        }
        throw err;
      }
    } catch (err: any) {
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
        return { status: 'offline', is_processing: false, message: 'Chatterbox service is not reachable' };
      }
      throw new HttpException(err.message, HttpStatus.BAD_GATEWAY);
    }
  }

  @Get('chatterbox/status/progress')
  @ApiOperation({ summary: 'Get lightweight Chatterbox progress (for polling)' })
  async getChatterboxProgress() {
    try {
      try {
        const response = await axios.get(`${activeChatterboxUrl}/status/progress`, { timeout: 5000 });
        return response.data;
      } catch (err: any) {
        if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
          activeChatterboxUrl = 'http://localhost:4123';
          const response = await axios.get(`${activeChatterboxUrl}/status/progress`, { timeout: 5000 });
          return response.data;
        }
        throw err;
      }
    } catch (err: any) {
      return { is_processing: false, status: 'offline', message: 'Chatterbox service is not reachable' };
    }
  }

  @Get('chatterbox/status/statistics')
  @ApiOperation({ summary: 'Get Chatterbox processing statistics' })
  async getChatterboxStatistics() {
    try {
      try {
        const response = await axios.get(`${activeChatterboxUrl}/status/statistics`, { timeout: 5000 });
        return response.data;
      } catch (err: any) {
        if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
          activeChatterboxUrl = 'http://localhost:4123';
          const response = await axios.get(`${activeChatterboxUrl}/status/statistics`, { timeout: 5000 });
          return response.data;
        }
        throw err;
      }
    } catch (err: any) {
      return { error: 'Chatterbox service is not reachable' };
    }
  }

  @Get('chatterbox/status/history')
  @ApiOperation({ summary: 'Get Chatterbox request history' })
  async getChatterboxHistory(@Query('limit') limit?: string) {
    try {
      try {
        const response = await axios.get(`${activeChatterboxUrl}/status/history${limit ? `?limit=${limit}` : ''}`, { timeout: 5000 });
        return response.data;
      } catch (err: any) {
        if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
          activeChatterboxUrl = 'http://localhost:4123';
          const response = await axios.get(`${activeChatterboxUrl}/status/history${limit ? `?limit=${limit}` : ''}`, { timeout: 5000 });
          return response.data;
        }
        throw err;
      }
    } catch (err: any) {
      return { error: 'Chatterbox service is not reachable' };
    }
  }

  @Get('chatterbox/info')
  @ApiOperation({ summary: 'Get Chatterbox API info' })
  async getChatterboxInfo() {
    try {
      try {
        const response = await axios.get(`${activeChatterboxUrl}/info`, { timeout: 5000 });
        return response.data;
      } catch (err: any) {
        if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
          activeChatterboxUrl = 'http://localhost:4123';
          const response = await axios.get(`${activeChatterboxUrl}/info`, { timeout: 5000 });
          return response.data;
        }
        throw err;
      }
    } catch (err: any) {
      return { status: 'offline', error: 'Chatterbox service is not reachable' };
    }
  }

  @Get('chatterbox/logs')
  @ApiOperation({ summary: 'Get Chatterbox container logs' })
  async getChatterboxLogs() {
    return new Promise((resolve) => {
      import('child_process').then(cp => {
        // Run podman compose logs --tail 100 chatterbox
        cp.exec('podman compose logs --tail 100 chatterbox', { cwd: require('path').resolve(process.cwd(), '../../') }, (error, stdout, stderr) => {
          if (error) {
            resolve({ logs: `Error fetching logs: ${error.message}\n${stderr}` });
          } else {
            resolve({ logs: stdout });
          }
        });
      }).catch(err => {
        resolve({ logs: `Error: ${err.message}` });
      });
    });
  }
}
