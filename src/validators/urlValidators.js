import { z } from 'zod';

const urlSchema = z
  .string()
  .trim()
  .url('Enter a valid URL')
  .refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), {
    message: 'URL must start with http:// or https://',
  });

const customCodeSchema = z
  .string()
  .trim()
  .min(4, 'Short code must have at least 4 characters')
  .max(30, 'Short code must be less than 30 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Short code can only contain letters, numbers, underscore and dash');

const futureDateSchema = z
  .union([z.string().datetime(), z.literal(''), z.null()])
  .optional()
  .transform((value) => {
    if (!value) return null;
    return new Date(value);
  })
  .refine((value) => value === null || value > new Date(), {
    message: 'Expiry date must be in the future',
  });

export const createUrlSchema = z.object({
  originalUrl: urlSchema,
  customCode: customCodeSchema.optional().or(z.literal('')),
  expiresAt: futureDateSchema,
});

export const updateUrlSchema = z.object({
  originalUrl: urlSchema.optional(),
  customCode: customCodeSchema.optional().or(z.literal('')),
  expiresAt: futureDateSchema,
});
