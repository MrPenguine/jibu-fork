export class CreateOrganizationDto {
  name: string;
}

export class UpdateOrganizationDto {
  name?: string;
  email?: string;
  settings?: Record<string, any>;
}

export class InviteMembersDto {
  emails: string[];
  role: string;
  message?: string;
}

export class RespondToInvitationDto {
  action: 'accept' | 'reject';
}

export class UpdateMemberRoleDto {
  role: string;
} 