import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  VAULT_ADDR: Joi.string().uri().required(),
  VAULT_TOKEN: Joi.string().optional(),
  VAULT_APPROLE_ROLE_ID: Joi.string().optional(),
  VAULT_APPROLE_SECRET_ID: Joi.string().optional(),
  // Add other environment variables as needed
}); 