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
      // If ends with /api only, upgrade to /api/v1
      this.apiBase = /\/api$/.test(raw) ? `${raw}/v1` : raw;
    } else {
      this.apiBase = `${raw}/api/v1`;
    }
    this.apiKey = this.configService.get<string>('N8N_API_KEY')!;
    if (!this.apiKey) {
      this.logger.error('N8N_API_KEY is missing; cannot call n8n API');
      throw new Error('Missing N8N_API_KEY');
    }
    const mask = (k: string) => (k.length > 12 ? `${k.slice(0, 6)}...${k.slice(-4)}` : '***');
    this.logger.log(`n8n apiBase resolved to: ${this.apiBase}; using key=${mask(this.apiKey)}`);
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
          const status = err?.response?.status;
          const data = err?.response?.data;
          this.logger.error(`Failed to create workflow [POST ${url}] status=${status}: ${err.message} body=${JSON.stringify(data)}`);
          throw err;
        }),
      ),
    );
    return res; // expects { id, ... }
  }

  async updateWorkflow(id: string, workflow: any) {
    const url = `${this.apiBase}/workflows/${id}`;
    const res = await firstValueFrom(
      this.http.put(url, workflow, { headers: this.headers() }).pipe(
        map((r) => r.data),
        catchError((err) => {
          const status = err?.response?.status;
          const data = err?.response?.data;
          this.logger.error(`Failed to update workflow ${id} [PUT ${url}] status=${status}: ${err.message} body=${JSON.stringify(data)}`);
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
          const status = err?.response?.status;
          const data = err?.response?.data;
          this.logger.error(`Failed to fetch workflow ${id} [GET ${url}] status=${status}: ${err.message} body=${JSON.stringify(data)}`);
          throw err;
        }),
      ),
    );
    return res;
  }

  private isNotFound(err: any) {
    return err?.response?.status === 404;
  }

  async workflowExists(id: string): Promise<boolean> {
    try {
      await this.getWorkflow(id);
      return true;
    } catch (err: any) {
      if (this.isNotFound(err)) return false;
      throw err;
    }
  }

  async setActive(id: string, active: boolean) {
    const url = `${this.apiBase}/workflows/${id}/${active ? 'activate' : 'deactivate'}`;
    const res = await firstValueFrom(
      this.http.post(url, {}, { headers: this.headers() }).pipe(
        map((r) => r.data),
        catchError((err) => {
          const status = err?.response?.status;
          const data = err?.response?.data;
          this.logger.error(`Failed to set active=${active} for workflow ${id} [POST ${url}] status=${status}: ${err.message} body=${JSON.stringify(data)}`);
          throw err;
        }),
      ),
    );
    return res;
  }

  async listWorkflows(params?: { name?: string; limit?: number }) {
    const qp = new URLSearchParams();
    if (params?.name) qp.set('name', params.name);
    if (params?.limit) qp.set('limit', String(params.limit));
    const url = `${this.apiBase}/workflows${qp.toString() ? `?${qp.toString()}` : ''}`;
    const res = await firstValueFrom(
      this.http.get(url, { headers: this.headers() }).pipe(
        map((r) => r.data),
        catchError((err) => {
          const status = err?.response?.status;
          const data = err?.response?.data;
          this.logger.error(`Failed to list workflows [GET ${url}] status=${status}: ${err.message} body=${JSON.stringify(data)}`);
          throw err;
        }),
      ),
    );
    return res; // { data: [...], nextCursor? }
  }

  async findWorkflowByName(name: string): Promise<any | null> {
    const res = await this.listWorkflows({ name, limit: 5 });
    const arr = Array.isArray(res?.data) ? res.data : [];
    const found = arr.find((w: any) => (w?.name || '').toLowerCase() === name.toLowerCase());
    return found || null;
  }
}
