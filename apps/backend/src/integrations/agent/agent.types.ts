export enum AgentProvider {
  LANGFLOW = 'langflow',
}

export interface LangflowPayload {
  input_value: string;
  output_type: 'chat' | 'text';
  input_type: 'chat' | 'text';
  session_id?: string;
  tweaks?: Record<string, any>;
}
