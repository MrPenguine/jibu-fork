import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

@Injectable()
export class N8nAdminClient {
  private readonly logger = new Logger(N8nAdminClient.name);
  private readonly apiBase: string;
  private readonly apiKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly http: HttpService,
  ) {
    const raw = (this.configService.get<string>('N8N_API_URL') || '').replace(/\/$/, '');
    // Ensure we hit the public API base (usually /api/v1)
    if (/\/api(\/v\d+)?$/.test(raw)) {
      this.apiBase = raw;
    } else {
      this.apiBase = `${raw}/api/v1`;
    }
    this.apiKey = this.configService.get<string>('N8N_API_KEY')!;
  }

  private headers() {
    return { 'X-N8N-API-KEY': this.apiKey, 'Content-Type': 'application/json' };
  }

  async createWorkflow(workflow: any) {
    const url = `${this.apiBase}/workflows`;
    const res = await firstValueFrom(
      this.http.post(url, workflow, { headers: this.headers() }).pipe(
        map((r) => r.data),
        catchError((err) => {
          this.logger.error(`Failed to create workflow: ${err.message}`, err.stack);
          throw err;
        }),
      ),
    );
    return res; // expects { id, ... }
  }

  async updateWorkflow(id: string, workflow: any) {
    const url = `${this.apiBase}/workflows/${id}`;
    const res = await firstValueFrom(
      this.http.patch(url, workflow, { headers: this.headers() }).pipe(
        map((r) => r.data),
        catchError((err) => {
          this.logger.error(`Failed to update workflow ${id}: ${err.message}`, err.stack);
          throw err;
        }),
      ),
    );
    return res;
  }

  async getWorkflow(id: string) {
    const url = `${this.apiBase}/workflows/${id}`;
    const res = await firstValueFrom(
      this.http.get(url, { headers: this.headers() }).pipe(
        map((r) => r.data),
        catchError((err) => {
          this.logger.error(`Failed to fetch workflow ${id}: ${err.message}`, err.stack);
          throw err;
        }),
      ),
    );
    return res;
  }

  async setActive(id: string, active: boolean) {
    const url = `${this.apiBase}/workflows/${id}/${active ? 'activate' : 'deactivate'}`;
    const res = await firstValueFrom(
      this.http.post(url, {}, { headers: this.headers() }).pipe(
        map((r) => r.data),
        catchError((err) => {
          this.logger.error(`Failed to set active=${active} for workflow ${id}: ${err.message}`, err.stack);
          throw err;
        }),
      ),
    );
    return res;
  }
}
