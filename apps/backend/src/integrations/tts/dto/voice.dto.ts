/**
 * DTO for voice data from ElevenLabs API
 */
export class VoiceDTO {
  /** The ID of the voice */
  voiceId: string;
  
  /** The name of the voice */
  name: string;
  
  /** The provider of the voice (e.g., ElevenLabs, Azure, etc.) */
  provider?: string;
  
  /** The price per minute for using this voice */
  pricePerMinute?: string;
  
  /** Samples associated with the voice */
  samples?: VoiceSampleDTO[];
  
  /** The category of the voice (premade, cloned, generated, professional) */
  category?: string;
  
  /** Fine-tuning information for the voice */
  fineTuning?: FineTuningDTO;
  
  /** Labels associated with the voice (accent, age, description, gender, use_case) */
  labels?: Record<string, string>;
  
  /** The description of the voice */
  description?: string;
  
  /** The preview URL of the voice */
  previewUrl?: string;
  
  /** The tiers the voice is available for */
  availableForTiers?: string[];
  
  /** The settings of the voice */
  settings?: VoiceSettingsDTO;
  
  /** The sharing information of the voice */
  sharing?: VoiceSharingDTO;
  
  /** The base model IDs for high-quality voices */
  highQualityBaseModelIds?: string[];
  
  /** The verified languages of the voice */
  verifiedLanguages?: VerifiedLanguageDTO[];
  
  /** The safety controls of the voice */
  safetyControl?: string;
  
  /** Whether the voice is owned by the user */
  isOwner?: boolean;
  
  /** Whether the voice is legacy */
  isLegacy?: boolean;

  /** The gender of the voice (extracted from labels) */
  get gender(): string {
    return this.labels?.gender || 'Unknown';
  }

  /** The accent of the voice (extracted from labels) */
  get accent(): string {
    return this.labels?.accent || 'Unknown';
  }

  /** The language of the voice (based on accent or other properties) */
  get language(): string {
    // For now, we'll default to English since most voices are in English
    // This could be enhanced with better language detection
    if (this.labels?.accent === 'italian') return 'italian';
    if (this.labels?.accent === 'swedish') return 'swedish';
    return 'english';
  }

  /** Get tags for the voice */
  get tags(): string[] {
    const tags: string[] = [];
    if (this.gender) tags.push(this.gender);
    if (this.accent) tags.push(this.accent);
    if (this.category) tags.push(this.category);
    return tags;
  }
  
  /** Whether the voice is mixed */
  isMixed?: boolean;
  
  /** The creation time of the voice in Unix time */
  createdAtUnix?: number;
}

/**
 * DTO for voice sample data
 */
export class VoiceSampleDTO {
  /** The ID of the sample */
  sampleId?: string;
  
  /** The name of the sample file */
  fileName?: string;
  
  /** The MIME type of the sample file */
  mimeType?: string;
  
  /** The size of the sample file in bytes */
  sizeBytes?: number;
  
  /** The hash of the sample file */
  hash?: string;
  
  /** The duration of the sample in seconds */
  durationSecs?: number;
}

/**
 * DTO for voice fine-tuning information
 */
export class FineTuningDTO {
  /** Whether the user is allowed to fine-tune the voice */
  isAllowedToFineTune?: boolean;
  
  /** The state of the fine-tuning process for each model */
  state?: Record<string, string>;
  
  /** List of verification failures in the fine-tuning process */
  verificationFailures?: string[];
  
  /** The number of verification attempts in the fine-tuning process */
  verificationAttemptsCount?: number;
  
  /** Whether a manual verification was requested for the fine-tuning process */
  manualVerificationRequested?: boolean;
}

/**
 * DTO for voice settings
 */
export class VoiceSettingsDTO {
  /** Stability setting (0-1) */
  stability?: number;
  
  /** Similarity boost setting (0-1) */
  similarityBoost?: number;
  
  /** Style setting (0-1) */
  style?: number;
  
  /** Whether to use speaker boost */
  useSpeakerBoost?: boolean;
  
  /** Speed setting */
  speed?: number;
}

/**
 * DTO for voice sharing information
 */
export class VoiceSharingDTO {
  /** The status of the voice sharing (enabled, disabled, copied, copied_disabled) */
  status?: string;
  
  /** The sample ID of the history item */
  historyItemSampleId?: string;
  
  /** The date of the voice sharing in Unix time */
  dateUnix?: number;
  
  /** A list of whitelisted emails */
  whitelistedEmails?: string[];
  
  /** The ID of the public owner */
  publicOwnerId?: string;
  
  /** The ID of the original voice */
  originalVoiceId?: string;
  
  /** Whether financial rewards are enabled */
  financialRewardsEnabled?: boolean;
  
  /** Whether free users are allowed */
  freeUsersAllowed?: boolean;
  
  /** Whether live moderation is enabled */
  liveModerationEnabled?: boolean;
  
  /** The rate of the voice sharing */
  rate?: number;
  
  /** Whether voice mixing is allowed */
  voiceMixingAllowed?: boolean;
  
  /** Whether the voice is featured */
  featured?: boolean;
  
  /** The category of the voice */
  category?: string;
  
  /** Whether the reader app is enabled */
  readerAppEnabled?: boolean;
  
  /** The number of likes on the voice */
  likedByCount?: number;
  
  /** The number of clones on the voice */
  clonedByCount?: number;
}

/**
 * DTO for verified language information
 */
export class VerifiedLanguageDTO {
  /** The language of the voice */
  language: string;
  
  /** The voice's model ID */
  modelId: string;
  
  /** The voice's accent, if applicable */
  accent?: string;
  
  /** The voice's locale, if applicable */
  locale?: string;
  
  /** The voice's preview URL, if applicable */
  previewUrl?: string;
}

/**
 * DTO for the response from the ElevenLabs API when listing voices
 */
export class ListVoicesResponseDTO {
  /** List of voices */
  voices: VoiceDTO[];
  
  /** Whether there are more voices to fetch */
  hasMore: boolean;
  
  /** Total count of voices */
  totalCount?: number;
  
  /** Token for the next page */
  nextPageToken?: string;
}
