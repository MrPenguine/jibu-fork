export class CreateOrganizationDto {
  name: string;
}

export class UpdateOrganizationDto {
  name?: string;
  email?: string;
  settings?: {
    channel?: string;
    callConcurrencyLimit?: number;
    hipaaEnabled?: boolean;
    pciEnabled?: boolean;
    serverUrl?: string;
    timeoutSeconds?: number;
    headers?: { name: string; value: string }[];
  };
} 