"use client";

import { useState } from "react";
import { ProviderCard } from "./provider-card";
import { ConnectCard } from "./connect-card";
import { ExtendedProviderCard } from "./extended-provider-card";
import { CloudProviderCard } from "./cloud-provider-card";
import { SipTrunkConfig } from "./sip-trunk-config";
import { WebhookServer } from "./webhook-server";
import { AzureSpeechCard } from "./azure-speech-card";

const voiceProviders = {
  "PlayHT": {
    name: "PlayHT",
    description: "For using custom voices from PlayHT",
    fields: [
      {
        name: "api_key",
        label: "API Key",
        placeholder: "Enter API Key",
        type: "text",
      },
      {
        name: "user_id",
        label: "User ID",
        placeholder: "Enter User ID",
        type: "text",
      },
    ],
  },
  "Rime.AI": {
    name: "Rime.AI",
    description: "For using your own Rime.AI credentials",
    fields: [
      {
        name: "api_key",
        label: "API Key",
        placeholder: "Enter API Key",
        type: "text",
      },
    ],
  },
  "SmallestAI": {
    name: "SmallestAI",
    description: "For using your own SmallestAI credentials",
    fields: [
      {
        name: "api_key",
        label: "API Key",
        placeholder: "Enter API Key",
        type: "text",
      },
    ],
  },
  "Neuphonic": {
    name: "Neuphonic",
    description: "For using your own Neuphonic credentials",
    fields: [
      {
        name: "api_key",
        label: "API Key",
        placeholder: "Enter API Key",
        type: "text",
      },
    ],
  },
  "ElevenLabs": {
    name: "ElevenLabs",
    description: "For using custom voices from ElevenLabs",
    fields: [
      {
        name: "api_key",
        label: "API Key",
        placeholder: "Enter API Key",
        type: "text",
      },
    ],
  },
  "Deepgram": {
    name: "Deepgram",
    description: "For using custom STT and TTS models",
    fields: [
      {
        name: "api_key",
        label: "API Key",
        placeholder: "Enter API Key",
        type: "text",
      },
      {
        name: "api_url",
        label: "API URL",
        placeholder: "Enter API URL",
        type: "text",
      },
    ],
  },
  "Hume": {
    name: "Hume",
    description: "For using your Hume credentials",
    fields: [
      {
        name: "api_key",
        label: "API Key",
        placeholder: "Enter API Key",
        type: "text",
      },
    ],
  },
  "Ceribell": {
    name: "Ceribell",
    description: "For using custom voices from Ceribell",
    fields: [
      {
        name: "api_key",
        label: "API Key",
        placeholder: "Enter API Key",
        type: "text",
      },
    ],
  },
  "LMNT": {
    name: "LMNT",
    description: "For using custom voices from LMNT",
    fields: [
      {
        name: "api_key",
        label: "API Key",
        placeholder: "Enter API Key",
        type: "text",
      },
    ],
  },
  "Tavus": {
    name: "Tavus",
    description: "For using your custom replicas from Tavus",
    fields: [
      {
        name: "api_key",
        label: "API Key",
        placeholder: "Enter API Key",
        type: "text",
      },
    ],
  },
  "Azure Speech": {
    name: "Azure Speech",
    description: "Microsoft Azure Cognitive Services",
    fields: [
      {
        name: "region",
        label: "Region",
        placeholder: "Select a region",
        type: "region",
      },
      {
        name: "api_key",
        label: "API Key",
        placeholder: "Enter API Key",
        type: "text",
      },
    ],
  },
  "Google TTS": {
    name: "Google TTS",
    description: "Text-to-Speech by Google Cloud",
    fields: [
      {
        name: "api_key",
        label: "API Key",
        placeholder: "Enter API Key",
        type: "text",
      },
    ],
  },
};

const modelProviders = {
  "OpenAI": {
    name: "OpenAI",
    description: "For using your OpenAI account",
    fields: [
      {
        name: "api_key",
        label: "API Key",
        placeholder: "Enter API Key",
        type: "text",
      },
    ],
  },
  "Anthropic": {
    name: "Anthropic",
    description: "For using your Anthropic account",
    fields: [
      {
        name: "api_key",
        label: "API Key",
        placeholder: "Enter API Key",
        type: "text",
      },
    ],
  },
  "Google": {
    name: "Google",
    description: "For using Gemini, the Google AI Model",
    fields: [
      {
        name: "api_key",
        label: "API Key",
        placeholder: "Enter API Key",
        type: "text",
      },
    ],
  },
  "ReflectionAI": {
    name: "ReflectionAI",
    description: "For using your ReflectionAI account",
    fields: [
      {
        name: "api_key",
        label: "API Key",
        placeholder: "Enter API Key",
        type: "text",
      },
    ],
  },
  "Cerebras": {
    name: "Cerebras",
    description: "For using your Cerebras account",
    fields: [
      {
        name: "api_key",
        label: "API Key",
        placeholder: "Enter API Key",
        type: "text",
      },
    ],
  },
  "XAI": {
    name: "XAI",
    description: "For using your XAI account",
    fields: [
      {
        name: "api_key",
        label: "API Key",
        placeholder: "Enter API Key",
        type: "text",
      },
    ],
  },
  "Mistral": {
    name: "Mistral",
    description: "For using your Mistral account",
    fields: [
      {
        name: "api_key",
        label: "API Key",
        placeholder: "Enter API Key",
        type: "text",
      },
    ],
  },
  "TogetherAI": {
    name: "TogetherAI",
    description: "For using your TogetherAI account",
    fields: [
      {
        name: "api_key",
        label: "API Key",
        placeholder: "Enter API Key",
        type: "text",
      },
    ],
  },
  "Anyscale": {
    name: "Anyscale",
    description: "For using your Anyscale account",
    fields: [
      {
        name: "api_key",
        label: "API Key",
        placeholder: "Enter API Key",
        type: "text",
      },
    ],
  },
  "OpenRouter": {
    name: "OpenRouter",
    description: "For using your OpenRouter account",
    fields: [
      {
        name: "api_key",
        label: "API Key",
        placeholder: "Enter API Key",
        type: "text",
      },
    ],
  },
  "PerplexityAI": {
    name: "PerplexityAI",
    description: "For using your PerplexityAI account",
    fields: [
      {
        name: "api_key",
        label: "API Key",
        placeholder: "Enter API Key",
        type: "text",
      },
    ],
  },
  "DeepInfra": {
    name: "DeepInfra",
    description: "For using your DeepInfra account",
    fields: [
      {
        name: "api_key",
        label: "API Key",
        placeholder: "Enter API Key",
        type: "text",
      },
    ],
  },
  "Custom LLM": {
    name: "Custom LLM",
    description: "For using your own Custom LLM",
    fields: [
      {
        name: "api_key",
        label: "API Key",
        placeholder: "Enter API Key",
        type: "text",
      },
      {
        name: "model_url",
        label: "Model URL",
        placeholder: "Enter Model URL",
        type: "text",
      },
      {
        name: "model_id",
        label: "Model ID",
        placeholder: "Enter Model ID",
        type: "text",
      },
      {
        name: "client_id",
        label: "Client ID",
        placeholder: "Enter Client ID",
        type: "text",
      },
      {
        name: "client_secret",
        label: "Client Secret",
        placeholder: "Enter Client Secret",
        type: "text",
      },
    ],
  },
  "Azure OpenAI": {
    name: "Azure OpenAI",
    description: "For using your Azure OpenAI account",
    fields: [
      {
        name: "region",
        label: "Region",
        placeholder: "Select a region",
        type: "region",
      },
      {
        name: "model_id",
        label: "Model ID",
        placeholder: "Enter Model ID",
        type: "text",
      },
      {
        name: "deployment_name",
        label: "Deployment Name",
        placeholder: "Enter Deployment Name",
        type: "text",
      },
      {
        name: "api_key",
        label: "API Key",
        placeholder: "Enter API Key",
        type: "text",
      },
      {
        name: "subscription_key",
        label: "Subscription Key",
        placeholder: "Enter Subscription Key",
        type: "text",
      },
    ],
  },
};

const transcriberProviders = {
  "Deepgram": {
    name: "Deepgram",
    description: "For using custom STT and TTS models",
    fields: [
      {
        name: "api_key",
        label: "API Key",
        placeholder: "Enter API Key",
        type: "text",
      },
      {
        name: "api_url",
        label: "API URL",
        placeholder: "Enter API URL",
        type: "text",
      },
    ],
  },
  "Gladia": {
    name: "Gladia",
    description: "For using Gladia transcription",
    fields: [
      {
        name: "api_key",
        label: "API Key",
        placeholder: "Enter API Key",
        type: "text",
      },
    ],
  },
  "AssemblyAI": {
    name: "AssemblyAI",
    description: "For using AssemblyAI transcription",
    fields: [
      {
        name: "api_key",
        label: "API Key",
        placeholder: "Enter API Key",
        type: "text",
      },
    ],
  },
  "Azure Speech": {
    name: "Azure Speech",
    description: "For using Azure Speech Services",
    fields: [
      {
        name: "region",
        label: "Region",
        placeholder: "Select a region",
        type: "region",
      },
      {
        name: "api_key",
        label: "API Key",
        placeholder: "Enter API Key",
        type: "text",
      },
    ],
  },
  "Speechmatics": {
    name: "Speechmatics",
    description: "For using Speechmatics transcription",
    fields: [
      {
        name: "api_key",
        label: "API Key",
        placeholder: "Enter API Key",
        type: "text",
      },
    ],
  },
  "Deep Speech": {
    name: "Deep Speech",
    description: "Speech recognition powered by Mozilla",
    fields: [
      {
        name: "model_path",
        label: "Model Path",
        placeholder: "Enter model path",
        type: "text",
      },
    ],
  },
  "Google STT": {
    name: "Google STT",
    description: "Speech-to-Text by Google Cloud",
    fields: [
      {
        name: "api_key",
        label: "API Key",
        placeholder: "Enter API Key",
        type: "text",
      },
    ],
  },
  "Whisper API": {
    name: "Whisper API",
    description: "OpenAI's speech recognition model",
    fields: [
      {
        name: "api_key",
        label: "API Key",
        placeholder: "Enter API Key",
        type: "text",
      },
    ],
  },
};

const toolProviders = {
  "make.com": {
    name: "make.com",
    description: "To Connect your Make Scenarios with Tools",
    fields: [
      {
        name: "region",
        label: "Region (eu1,us1,eu2,us2)",
        placeholder: "Enter Region (eu1,us1,eu2,us2)",
        type: "text",
      },
      {
        name: "api_key",
        label: "API Key",
        placeholder: "Enter API Key",
        type: "text",
      },
      {
        name: "team_id",
        label: "Team ID",
        placeholder: "Enter Team ID",
        type: "text",
      },
    ],
  },
  "GoHighLevel": {
    name: "GoHighLevel",
    description: "To Connect your GoHighLevel Workflows with Tools",
    fields: [
      {
        name: "api_key",
        label: "API Key",
        placeholder: "Enter API Key",
        type: "text",
      },
    ],
  },
  "Slack": {
    name: "Slack",
    description: "For integrating with Slack workspaces",
    fields: [
      {
        name: "api_key",
        label: "API Key",
        placeholder: "Enter API Key",
        type: "text",
      },
    ],
  },
  "Google Calendar": {
    name: "Google Calendar",
    description: "For calendar-based scheduling",
    fields: [
      {
        name: "api_key",
        label: "API Key",
        placeholder: "Enter API Key",
        type: "text",
      },
    ],
  },
  "Google Sheets": {
    name: "Google Sheets",
    description: "For spreadsheet-based data management",
    fields: [
      {
        name: "api_key",
        label: "API Key",
        placeholder: "Enter API Key",
        type: "text",
      },
    ],
  },
  "GitHub": {
    name: "GitHub",
    description: "API access for GitHub repositories",
    fields: [
      {
        name: "access_token",
        label: "Access Token",
        placeholder: "Enter GitHub Token",
        type: "text",
      },
    ],
  },
  "Zapier": {
    name: "Zapier",
    description: "Integration with Zapier automations",
    fields: [
      {
        name: "api_key",
        label: "API Key",
        placeholder: "Enter Zapier API Key",
        type: "text",
      },
    ],
  },
};

const vectorStoreProviders = {
  "Trieve": {
    name: "Trieve",
    description: "For using chunks from your Trieve account",
    fields: [
      {
        name: "api_key",
        label: "API Key",
        placeholder: "Enter API Key",
        type: "text",
      },
    ],
  },
  "Pinecone": {
    name: "Pinecone",
    description: "Vector database for embeddings",
    fields: [
      {
        name: "api_key",
        label: "API Key",
        placeholder: "Enter Pinecone API Key",
        type: "text",
      },
      {
        name: "environment",
        label: "Environment",
        placeholder: "Enter environment name",
        type: "text",
      },
    ],
  },
  "Chroma": {
    name: "Chroma",
    description: "Open-source embedding database",
    fields: [
      {
        name: "host",
        label: "Host URL",
        placeholder: "Enter Chroma Host URL",
        type: "text",
      },
    ],
  },
};

const phoneNumberProviders = {
  "Telnyx": {
    name: "Telnyx",
    description: "For importing your Telnyx phone numbers",
    fields: [
      {
        name: "api_key",
        label: "API Key",
        placeholder: "Enter API Key",
        type: "text",
      },
    ],
  },
  "Vonage": {
    name: "Vonage",
    description: "For importing your Vonage phone numbers",
    fields: [
      {
        name: "api_key",
        label: "API Key",
        placeholder: "Enter API Key",
        type: "text",
      },
      {
        name: "api_secret",
        label: "API Secret",
        placeholder: "Enter API Secret",
        type: "text",
      },
    ],
  },
  "Twilio": {
    name: "Twilio",
    description: "Cloud communications platform",
    fields: [
      {
        name: "account_sid",
        label: "Account SID",
        placeholder: "Enter Account SID",
        type: "text",
      },
      {
        name: "auth_token",
        label: "Auth Token",
        placeholder: "Enter Auth Token",
        type: "text",
      },
    ],
  },
};

const sipTrunkProviders = {
  "SIP Trunk": {
    name: "Add New SIP Trunk",
    description: "Configure a new SIP trunk connection",
    fields: [
      {
        name: "username",
        label: "SIP Username",
        placeholder: "Enter SIP username",
        type: "text",
      },
      {
        name: "password",
        label: "SIP Password",
        placeholder: "Enter SIP password",
        type: "text",
      },
      {
        name: "domain",
        label: "SIP Domain",
        placeholder: "e.g., sip.example.com",
        type: "text",
      },
      {
        name: "port",
        label: "SIP Port",
        placeholder: "e.g., 5060",
        type: "text",
      },
    ],
  },
};

const cloudProviders = {
  "AWS S3": {
    name: "AWS S3 credentials",
    description: "For storing files/recordings in your Amazon S3",
    fields: [
      {
        name: "aws_access_key_id",
        label: "AWS Access Key ID",
        placeholder: "Enter AWS Access Key ID",
        type: "text",
      },
      {
        name: "aws_secret_access_key",
        label: "AWS Secret Access Key",
        placeholder: "Enter AWS Secret Access Key",
        type: "text",
      },
      {
        name: "s3_bucket_region",
        label: "S3 Bucket Region (eg: us-east-1)",
        placeholder: "Enter S3 Bucket Region",
        type: "text",
      },
      {
        name: "s3_bucket_name",
        label: "S3 Bucket Name",
        placeholder: "Enter S3 Bucket Name",
        type: "text",
      },
      {
        name: "s3_path_prefix",
        label: "S3 Path Prefix (Optional)",
        placeholder: "Enter S3 Path Prefix",
        type: "text",
      },
    ],
  },
  "Azure Blob Storage": {
    name: "Azure Blob Storage",
    description: "For storing files/recordings in your Azure Blob Storage",
    fields: [
      {
        name: "region",
        label: "Region",
        placeholder: "Select a region",
        type: "region",
      },
      {
        name: "connection_string",
        label: "Connection String",
        placeholder: "Enter Connection String",
        type: "text",
      },
      {
        name: "container_name",
        label: "Container Name",
        placeholder: "Enter Container Name",
        type: "text",
      },
      {
        name: "path",
        label: "Path",
        placeholder: "Enter Path",
        type: "text",
      },
    ],
  },
  "GCP credentials": {
    name: "GCP credentials",
    description: "For storing files/recordings in your Google Cloud Storage",
    fields: [
      {
        name: "credential_json",
        label: "Credential reference name",
        placeholder: "Enter credential reference name",
        type: "text",
      },
      {
        name: "service_account_key",
        label: "GCP Service Account Key (JSON)",
        placeholder: "Enter GCP Service Account Key",
        type: "text",
      },
      {
        name: "bucket",
        label: "Bucket (optional)",
        placeholder: "Enter bucket name",
        type: "text",
      },
      {
        name: "bucket_region",
        label: "Bucket Region",
        placeholder: "Enter bucket region",
        type: "text",
      },
      {
        name: "path_prefix",
        label: "Path Prefix",
        placeholder: "Enter path prefix",
        type: "text",
      },
      {
        name: "hmac_access_id",
        label: "HMAC Access ID",
        placeholder: "Enter HMAC Access ID",
        type: "text",
      },
      {
        name: "hmac_secret",
        label: "HMAC Secret",
        placeholder: "Enter HMAC Secret",
        type: "text",
      },
    ],
  },
  "CloudFlare credentials": {
    name: "CloudFlare credentials",
    description: "For storing files/recordings in your CloudFlare R2",
    fields: [
      {
        name: "cloudflare_account_id",
        label: "CloudFlare Account ID",
        placeholder: "Enter CloudFlare Account ID",
        type: "text",
      },
      {
        name: "cloudflare_account_email",
        label: "CloudFlare Account Email",
        placeholder: "Enter CloudFlare Account Email",
        type: "text",
      },
      {
        name: "cloudflare_api_key_token",
        label: "CloudFlare API Key/Token",
        placeholder: "Enter CloudFlare API Key/Token",
        type: "text",
      },
      {
        name: "bucket",
        label: "Bucket (optional)",
        placeholder: "Enter Bucket",
        type: "text",
      },
      {
        name: "url",
        label: "URL",
        placeholder: "Enter URL",
        type: "text",
      },
      {
        name: "path_prefix",
        label: "Path Prefix",
        placeholder: "Enter Path Prefix",
        type: "text",
      },
      {
        name: "access_key_id",
        label: "Access Key ID",
        placeholder: "Enter Access Key ID",
        type: "text",
      },
      {
        name: "secret_access_key",
        label: "Secret Access Key",
        placeholder: "Enter Secret Access Key",
        type: "text",
      },
    ],
  },
  "Supabase credentials": {
    name: "Supabase credentials",
    description: "For storing files/recordings in your Supabase Storage",
    fields: [
      {
        name: "bucket_name",
        label: "Bucket Name",
        placeholder: "Enter Bucket Name",
        type: "text",
      },
      {
        name: "bucket_region",
        label: "Bucket Region",
        placeholder: "Enter Bucket Region",
        type: "text",
      },
      {
        name: "path_prefix",
        label: "Path Prefix",
        placeholder: "Enter Path Prefix",
        type: "text",
      },
      {
        name: "supabase_url",
        label: "Supabase URL",
        placeholder: "Enter Supabase URL",
        type: "text",
      },
      {
        name: "supabase_api_key",
        label: "Supabase API Key",
        placeholder: "Enter Supabase API Key",
        type: "text",
      },
      {
        name: "supabase_storage_bucket",
        label: "Supabase Storage Bucket",
        placeholder: "Enter Supabase Storage Bucket",
        type: "text",
      },
      {
        name: "supabase_service_key",
        label: "Supabase Service Key",
        placeholder: "Enter Supabase Service Key",
        type: "text",
      },
    ],
  },
  "AWS": {
    name: "AWS",
    description: "Amazon Web Services",
    fields: [
      {
        name: "region",
        label: "Region",
        placeholder: "Select a region",
        type: "region",
      },
      {
        name: "access_key",
        label: "Access Key",
        placeholder: "Enter Access Key",
        type: "text",
      },
      {
        name: "secret_key",
        label: "Secret Key",
        placeholder: "Enter Secret Key",
        type: "text",
      },
    ],
  },
  "Google Cloud": {
    name: "Google Cloud",
    description: "Google Cloud Platform",
    fields: [
      {
        name: "project_id",
        label: "Project ID",
        placeholder: "Enter Project ID",
        type: "text",
      },
      {
        name: "api_key",
        label: "API Key",
        placeholder: "Enter API Key",
        type: "text",
      },
    ],
  },
  "Azure": {
    name: "Azure",
    description: "Microsoft Azure Cloud",
    fields: [
      {
        name: "subscription_id",
        label: "Subscription ID",
        placeholder: "Enter Subscription ID",
        type: "text",
      },
      {
        name: "tenant_id",
        label: "Tenant ID",
        placeholder: "Enter Tenant ID",
        type: "text",
      },
    ],
  },
};

const observabilityProviders = {
  "Langfuse Credentials": {
    name: "Langfuse Credentials",
    description: "For sending traces to Langfuse",
    fields: [
      {
        name: "secret_key",
        label: "Secret Key",
        placeholder: "Enter Secret Key",
        type: "text",
      },
      {
        name: "public_key",
        label: "Public Key",
        placeholder: "Enter Public Key",
        type: "text",
      },
      {
        name: "host_url",
        label: "Host URL",
        placeholder: "Enter Host URL",
        type: "text",
      },
    ],
  },
  "Datadog": {
    name: "Datadog",
    description: "Monitoring and analytics platform",
    fields: [
      {
        name: "api_key",
        label: "API Key",
        placeholder: "Enter Datadog API Key",
        type: "text",
      },
      {
        name: "app_key",
        label: "Application Key",
        placeholder: "Enter Datadog App Key",
        type: "text",
      }
    ],
  },
  "New Relic": {
    name: "New Relic",
    description: "Observability platform",
    fields: [
      {
        name: "api_key",
        label: "API Key",
        placeholder: "Enter New Relic API Key",
        type: "text",
      },
      {
        name: "account_id",
        label: "Account ID",
        placeholder: "Enter Account ID",
        type: "text",
      }
    ],
  },
  "Prometheus": {
    name: "Prometheus",
    description: "Monitoring system & time series database",
    fields: [
      {
        name: "url",
        label: "Prometheus URL",
        placeholder: "Enter Prometheus URL",
        type: "text",
      },
      {
        name: "basic_auth",
        label: "Basic Auth Token (optional)",
        placeholder: "Enter Basic Auth Token",
        type: "text",
      }
    ],
  },
};

const serverConfigProviders = {
  "Webhook Server": {
    name: "Webhook Server",
    description: "For setting up authentication for the webhook",
    fields: [
      {
        name: "oauth2_url",
        label: "OAuth2 URL",
        placeholder: "Enter OAuth2 URL",
        type: "text",
      },
      {
        name: "oauth2_client_id",
        label: "OAuth2 Client ID",
        placeholder: "Enter OAuth2 Client ID",
        type: "text",
      },
      {
        name: "oauth2_client_secret",
        label: "OAuth2 Client Secret",
        placeholder: "Enter OAuth2 Client Secret",
        type: "text",
      },
      {
        name: "oauth2_scope",
        label: "OAuth2 Scope",
        placeholder: "Enter OAuth2 Scope",
        type: "text",
      },
    ],
  },
};

export default function Providers() {
  const [activeCategory, setActiveCategory] = useState<string>("voice");

  // Use a consistent card style for all categories based on the observability card in the image
  const cardClass = "bg-purple-50 border border-purple-100";

  // Header style with subtle radius at the end of the bottom border
  const headerClass = "py-4 bg-background border-b relative after:content-[''] after:absolute after:bottom-0 after:right-6 after:w-16 after:h-[1px] after:bg-transparent after:rounded-full";

  return (
    <div className="flex h-full gap-6">
      {/* Category sidebar */}
      <div className="w-64 flex flex-col space-y-1 sticky top-16 self-start h-[calc(100vh-4rem)] overflow-y-auto pr-2">
        <CategoryButton
          active={activeCategory === "voice"}
          onClick={() => setActiveCategory("voice")}
          label="Voice Providers"
        />
        <CategoryButton
          active={activeCategory === "model"}
          onClick={() => setActiveCategory("model")}
          label="Model Providers"
        />
        <CategoryButton
          active={activeCategory === "transcriber"}
          onClick={() => setActiveCategory("transcriber")}
          label="Transcriber Providers"
        />
        <CategoryButton
          active={activeCategory === "tool"}
          onClick={() => setActiveCategory("tool")}
          label="Tool Providers"
        />
        <CategoryButton
          active={activeCategory === "vectorstore"}
          onClick={() => setActiveCategory("vectorstore")}
          label="Vector Store Providers"
        />
        <CategoryButton
          active={activeCategory === "phonenumber"}
          onClick={() => setActiveCategory("phonenumber")}
          label="Phone Number Providers"
        />
        <CategoryButton
          active={activeCategory === "siptrunk"}
          onClick={() => setActiveCategory("siptrunk")}
          label="SIP Trunk Credentials"
        />
        <CategoryButton
          active={activeCategory === "cloud"}
          onClick={() => setActiveCategory("cloud")}
          label="Cloud Providers"
        />
        <CategoryButton
          active={activeCategory === "observability"}
          onClick={() => setActiveCategory("observability")}
          label="Observability Providers"
        />
        <CategoryButton
          active={activeCategory === "server"}
          onClick={() => setActiveCategory("server")}
          label="Server Configuration"
        />
        <CategoryButton
          active={activeCategory === "connect"}
          onClick={() => setActiveCategory("connect")}
          label="Connect New Provider"
        />
      </div>
      
      {/* Main content */}
      <div className="flex-1 flex flex-col h-[calc(100vh-4rem)]">
        {activeCategory === "voice" && (
          <div className="flex flex-col h-full">
            <div className={headerClass}>
              <h2 className="text-2xl font-bold tracking-tight">Voice Providers</h2>
            </div>
            <div className="flex-1 overflow-y-auto pb-24">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto pt-8">
                {Object.entries(voiceProviders).map(([key, provider]) => {
                  if (key === "Azure Speech") {
                    return (
                      <AzureSpeechCard
                        key={provider.name}
                        name={provider.name}
                        description={provider.description}
                        className={cardClass}
                      />
                    );
                  }
                  return (
                    <ProviderCard
                      key={provider.name}
                      name={provider.name}
                      description={provider.description}
                      fields={provider.fields}
                      className={cardClass}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        )}
        
        {activeCategory === "model" && (
          <div className="flex flex-col h-full">
            <div className={headerClass}>
              <h2 className="text-2xl font-bold tracking-tight">Model Providers</h2>
            </div>
            <div className="flex-1 overflow-y-auto pb-24">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto pt-8">
                {Object.values(modelProviders).map((provider) => (
                  <ExtendedProviderCard
                    key={provider.name}
                    name={provider.name}
                    description={provider.description}
                    fields={provider.fields}
                    className={cardClass}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        
        {activeCategory === "transcriber" && (
          <div className="flex flex-col h-full">
            <div className={headerClass}>
              <h2 className="text-2xl font-bold tracking-tight">Transcriber Providers</h2>
            </div>
            <div className="flex-1 overflow-y-auto pb-24">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto pt-8">
                {Object.values(transcriberProviders).map((provider) => (
                  <ProviderCard
                    key={provider.name}
                    name={provider.name}
                    description={provider.description}
                    fields={provider.fields}
                    className={cardClass}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        
        {activeCategory === "tool" && (
          <div className="flex flex-col h-full">
            <div className={headerClass}>
              <h2 className="text-2xl font-bold tracking-tight">Tool Providers</h2>
            </div>
            <div className="flex-1 overflow-y-auto pb-24">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto pt-8">
                {Object.values(toolProviders).map((provider) => (
                  <ProviderCard
                    key={provider.name}
                    name={provider.name}
                    description={provider.description}
                    fields={provider.fields}
                    className={cardClass}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        
        {activeCategory === "vectorstore" && (
          <div className="flex flex-col h-full">
            <div className={headerClass}>
              <h2 className="text-2xl font-bold tracking-tight">Vector Store Providers</h2>
            </div>
            <div className="flex-1 overflow-y-auto pb-24">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto pt-8">
                {Object.values(vectorStoreProviders).map((provider) => (
                  <ExtendedProviderCard
                    key={provider.name}
                    name={provider.name}
                    description={provider.description}
                    fields={provider.fields}
                    className={cardClass}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        
        {activeCategory === "phonenumber" && (
          <div className="flex flex-col h-full">
            <div className={headerClass}>
              <h2 className="text-2xl font-bold tracking-tight">Phone Number Providers</h2>
            </div>
            <div className="flex-1 overflow-y-auto pb-24">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto pt-8">
                {Object.values(phoneNumberProviders).map((provider) => (
                  <ProviderCard
                    key={provider.name}
                    name={provider.name}
                    description={provider.description}
                    fields={provider.fields}
                    className={cardClass}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        
        {activeCategory === "siptrunk" && (
          <div className="flex flex-col h-full">
            <div className={headerClass}>
              <h2 className="text-2xl font-bold tracking-tight">SIP Trunk Credentials</h2>
            </div>
            <div className="flex-1 overflow-y-auto pb-24">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto pt-8">
                {Object.entries(sipTrunkProviders).map(([key, provider]) => (
                  <SipTrunkConfig
                    key={provider.name}
                    name={provider.name}
                    description={provider.description}
                    className={cardClass}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        
        {activeCategory === "cloud" && (
          <div className="flex flex-col h-full">
            <div className={headerClass}>
              <h2 className="text-2xl font-bold tracking-tight">Cloud Providers</h2>
            </div>
            <div className="flex-1 overflow-y-auto pb-24">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto pt-8">
                {Object.entries(cloudProviders).map(([key, provider]) => (
                  <CloudProviderCard
                    key={provider.name}
                    name={provider.name}
                    description={provider.description}
                    fields={provider.fields}
                    className={cardClass}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        
        {activeCategory === "observability" && (
          <div className="flex flex-col h-full">
            <div className={headerClass}>
              <h2 className="text-2xl font-bold tracking-tight">Observability Providers</h2>
            </div>
            <div className="flex-1 overflow-y-auto pb-24">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto pt-8">
                {Object.values(observabilityProviders).map((provider) => (
                  <ExtendedProviderCard
                    key={provider.name}
                    name={provider.name}
                    description={provider.description}
                    fields={provider.fields}
                    className={cardClass}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        
        {activeCategory === "server" && (
          <div className="flex flex-col h-full">
            <div className={headerClass}>
              <h2 className="text-2xl font-bold tracking-tight">Server Configuration</h2>
            </div>
            <div className="flex-1 overflow-y-auto pb-24">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto pt-8">
                {Object.entries(serverConfigProviders).map(([key, provider]) => (
                  <WebhookServer
                    key={provider.name}
                    name={provider.name}
                    description={provider.description}
                    className={cardClass}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        
        {activeCategory === "connect" && (
          <div className="flex flex-col h-full">
            <div className={headerClass}>
              <h2 className="text-2xl font-bold tracking-tight">Connect New Provider</h2>
            </div>
            <div className="flex-1 overflow-y-auto pb-24">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto pt-8">
                <ConnectCard className={cardClass} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-left text-sm font-medium ${
        active
          ? "bg-primary text-primary-foreground"
          : "hover:bg-accent hover:text-accent-foreground"
      }`}
    >
      {label}
    </button>
  );
} 