import { Injectable, Logger } from '@nestjs/common';
import { PayloadBuilderService } from '@jibu/payload-builder';
import { QueueService } from '../../core/queue/queue.service';
import { WebhookPayload, CallEventData, CallEventType, WebhookPriority } from '@jibu/queue-definitions';

interface TwilioVoiceWebhookPayload {
  CallSid?: string;
  From?: string;
  To?: string;
  CallStatus?: string;
  SpeechResult?: string;
  Digits?: string;
  RecordingStatus?: string;
  RecordingUrl?: string;
  workflowId?: string;
  WorkflowId?: string;
  sessionId?: string;
  SessionId?: string;
  [key: string]: any;
}

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);

  constructor(
    private readonly payloadBuilder: PayloadBuilderService,
    private readonly queueService: QueueService,
  ) {}

  async handleTwilioWebhook(body: TwilioVoiceWebhookPayload): Promise<void> {
    const callSid = body.CallSid;
    const from = body.From;
    const to = body.To;
    const callStatusRaw = (body.CallStatus || '').toLowerCase();
    const speechResult = body.SpeechResult;
    const digits = body.Digits;
    const recordingStatusRaw = (body.RecordingStatus || '').toLowerCase();
    const recordingUrl = body.RecordingUrl as string | undefined;

    const workflowId =
      body.workflowId ||
      body.WorkflowId ||
      undefined;

    const sessionId =
      body.sessionId ||
      body.SessionId ||
      callSid ||
      undefined;

    if (!workflowId || !sessionId) {
      this.logger.warn(
        `[VOICE][Twilio] Missing workflowId or sessionId for CallSid=${callSid || 'unknown'} — skipping queue enqueue`,
      );
      return;
    }

    const baseExtra = {
      provider: 'twilio',
      callSid,
      callStatus: callStatusRaw,
    };

    const enqueueTasks: Promise<void>[] = [];

    // Speech event
    if (speechResult && speechResult.trim().length > 0) {
      enqueueTasks.push(
        this.buildAndEnqueueCallEvent({
          workflowId,
          sessionId,
          callEventType: 'speech',
          from,
          to,
          transcribedText: speechResult,
          extra: { ...baseExtra, event: 'speech' },
        }),
      );
    }

    // DTMF event
    if (digits && digits.trim().length > 0) {
      enqueueTasks.push(
        this.buildAndEnqueueCallEvent({
          workflowId,
          sessionId,
          callEventType: 'dtmf',
          from,
          to,
          dtmfDigits: digits,
          extra: { ...baseExtra, event: 'dtmf' },
        }),
      );
    }

    // Recording completed event (e.g. voicemail or call recording)
    const isRecordingEvent =
      !!recordingUrl ||
      recordingStatusRaw === 'completed' ||
      (typeof body.EventType === 'string' && body.EventType.toLowerCase().includes('recording'));

    if (isRecordingEvent) {
      enqueueTasks.push(
        this.buildAndEnqueueCallEvent({
          workflowId,
          sessionId,
          callEventType: 'recording',
          from,
          to,
          extra: { ...baseExtra, event: 'recording', recordingUrl },
        }),
      );
      // Recording completed — sent to agent via canonical path
    }

    // Hangup / completed call event
    if (this.isHangupStatus(callStatusRaw)) {
      enqueueTasks.push(
        this.buildAndEnqueueCallEvent({
          workflowId,
          sessionId,
          callEventType: 'hangup',
          from,
          to,
          extra: { ...baseExtra, event: 'hangup' },
        }),
      );
    }

    if (enqueueTasks.length === 0) {
      this.logger.debug(
        `[VOICE][Twilio] No actionable voice events detected for CallSid=${callSid || 'unknown'} — nothing enqueued`,
      );
      return;
    }

    await Promise.all(enqueueTasks);
  }

  private isHangupStatus(status: string): boolean {
    return ['completed', 'busy', 'failed', 'no-answer', 'canceled'].includes(status);
  }

  private async buildAndEnqueueCallEvent(params: {
    workflowId: string;
    sessionId: string;
    callEventType: CallEventType;
    from?: string;
    to?: string;
    dtmfDigits?: string;
    transcribedText?: string;
    extra?: Record<string, any>;
  }): Promise<void> {
    const { workflowId, sessionId, callEventType, from, to, dtmfDigits, transcribedText, extra } = params;

    const callEvent: CallEventData = {
      type: callEventType,
      from,
      to,
      dtmfDigits,
    };

    try {
      const payload: WebhookPayload = await this.payloadBuilder.buildCallPayload({
        workflowId,
        sessionId,
        callEvent,
        from,
        to,
        dtmfDigits,
        transcribedText,
        extra,
      });

      // Voice webhook — identical path as chat: canonical payload → WEBHOOK_DELIVERY queue
      await this.queueService.addWebhookDeliveryJob(payload, {
        priority: WebhookPriority.VOICE_EVENTS,
        attempts: 2,
        timeout: 5000,
      });

      this.logger.log(
        `[VOICE][Twilio] Enqueued voice event '${callEventType}' for workflow ${workflowId}, session ${sessionId}`,
      );
    } catch (error) {
      const err = error as Error;
      this.logger.warn(
        `[VOICE][Twilio] Failed to enqueue voice event '${callEventType}' for workflow ${workflowId}, session ${sessionId}: ${err.message}`,
      );
    }
  }
}
