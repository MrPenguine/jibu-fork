import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { ChunkingService } from './chunking.service';

export interface ChunkConfig {
  strategies?: string[];
  chunkSize?: number;
  chunkOverlap?: number;
}

export interface ChunkResult {
  text: string;
  chunkType: string; // 'content' | 'faq_question'
  strategies: string[];
}

/**
 * Runs the configurable chunking pipeline in a fixed canonical order regardless
 * of the order the user selected strategies:
 *
 *   clean_html -> summarize -> [split: smart | default(size/overlap)] -> headers -> faq
 *
 * LLM-backed stages (summarize / smart / headers / faq) are only invoked when the
 * corresponding strategy is selected, and route through OpenRouter so a single key
 * covers all chunking models.
 */
@Injectable()
export class StrategyChunkingService {
  private readonly logger = new Logger(StrategyChunkingService.name);
  private readonly llm: OpenAI | null;
  private readonly llmModel: string;

  constructor(private readonly chunkingService: ChunkingService) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    this.llmModel = process.env.CHUNKING_LLM_MODEL || 'openai/gpt-4o-mini';
    if (apiKey) {
      this.llm = new OpenAI({
        apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
      });
      this.logger.log(`Strategy chunking LLM ready via OpenRouter (model: ${this.llmModel})`);
    } else {
      this.llm = null;
      this.logger.warn(
        'OPENROUTER_API_KEY not set — LLM chunking strategies (summarize/smart/headers/faq) will be skipped',
      );
    }
  }

  async chunk(
    text: string,
    mimeType: string | undefined,
    config?: ChunkConfig,
  ): Promise<ChunkResult[]> {
    const strategies = (config?.strategies || []).filter(Boolean);
    const applied: string[] = [];

    let working = text;

    // --- Pre-process: clean_html ---
    if (strategies.includes('clean_html')) {
      working = this.cleanHtml(working);
      applied.push('clean_html');
    }

    // --- Pre-process: summarize (whole-doc) ---
    if (strategies.includes('summarize') && this.llm) {
      const summarized = await this.llmSummarize(working);
      if (summarized) {
        working = summarized;
        applied.push('summarize');
      }
    }

    // --- Split: smart (LLM topic grouping) OR default recursive splitter ---
    let baseChunks: string[];
    if (strategies.includes('smart') && this.llm) {
      baseChunks = await this.smartSplit(working, config);
      applied.push('smart');
    } else {
      if (config?.chunkSize) {
        this.chunkingService.setChunkParameters(
          config.chunkSize,
          config.chunkOverlap ?? Math.floor(config.chunkSize * 0.2),
        );
      }
      baseChunks = await this.chunkingService.splitTextIntoChunks(working, mimeType);
    }

    const results: ChunkResult[] = [];

    for (const raw of baseChunks) {
      let chunkText = raw;

      // --- Post: headers (prepend a short topic header per chunk) ---
      if (strategies.includes('headers') && this.llm) {
        const header = await this.llmHeader(chunkText);
        if (header) {
          chunkText = `${header}\n\n${chunkText}`;
        }
      }

      const contentStrategies = [...applied];
      if (strategies.includes('headers')) contentStrategies.push('headers');

      results.push({
        text: chunkText,
        chunkType: 'content',
        strategies: contentStrategies,
      });

      // --- Augment: faq (add extra question chunks pointing at this content) ---
      if (strategies.includes('faq') && this.llm) {
        const questions = await this.llmFaqQuestions(chunkText);
        for (const q of questions) {
          results.push({
            text: q,
            chunkType: 'faq_question',
            strategies: [...contentStrategies, 'faq'],
          });
        }
      }
    }

    this.logger.log(
      `Chunking produced ${results.length} chunks (strategies: [${strategies.join(', ') || 'none'}])`,
    );
    return results;
  }

  private cleanHtml(text: string): string {
    return text
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async llmSummarize(text: string): Promise<string | null> {
    const input = text.slice(0, 24000);
    const content = await this.complete(
      'You compress documents. Rewrite the text keeping only the key facts and points, preserving concrete details (names, numbers, dates). Return prose only.',
      input,
    );
    return content;
  }

  private async smartSplit(text: string, config?: ChunkConfig): Promise<string[]> {
    // Ask the LLM to segment by topic; fall back to the default splitter on failure.
    const input = text.slice(0, 24000);
    const content = await this.complete(
      'Split the text into coherent, self-contained sections grouped by topic. Return each section separated by a line containing only "---". Do not add commentary.',
      input,
    );
    if (!content) {
      return this.chunkingService.splitTextIntoChunks(text);
    }
    const sections = content
      .split(/^\s*---\s*$/m)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    return sections.length > 0 ? sections : this.chunkingService.splitTextIntoChunks(text);
  }

  private async llmHeader(chunk: string): Promise<string | null> {
    const content = await this.complete(
      'Write a single short topic header (max 10 words) summarizing the text. Return only the header, no punctuation at the end.',
      chunk.slice(0, 4000),
    );
    return content ? content.split('\n')[0].trim() : null;
  }

  private async llmFaqQuestions(chunk: string): Promise<string[]> {
    const content = await this.complete(
      'Generate up to 3 natural questions a user might ask that this text answers. Return one question per line, no numbering.',
      chunk.slice(0, 4000),
    );
    if (!content) return [];
    return content
      .split('\n')
      .map((l) => l.replace(/^\s*[-*\d.)]+\s*/, '').trim())
      .filter((l) => l.length > 3)
      .slice(0, 3);
  }

  private async complete(system: string, user: string): Promise<string | null> {
    if (!this.llm) return null;
    try {
      const resp = await this.llm.chat.completions.create({
        model: this.llmModel,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.2,
      });
      return resp.choices?.[0]?.message?.content?.trim() || null;
    } catch (err: any) {
      this.logger.warn(`LLM chunking call failed: ${err?.message || err}`);
      return null;
    }
  }
}
