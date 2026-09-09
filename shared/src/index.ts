import { z } from 'zod';

export interface HealthResponse {
  data: { status: 'ok'; service: 'capstone-api'; timestamp: string };
}

export const usernameSchema = z.string().trim().min(3).max(80).regex(
  /^[A-Za-z0-9_-]+$/,
  'Use only letters, numbers, underscores, and hyphens.',
);
export const passwordSchema = z.string().min(8).max(128);
export const registerRequestSchema = z.object({ username: usernameSchema, password: passwordSchema });
export const loginRequestSchema = registerRequestSchema;

export interface AuthUser { id: number; username: string }
export interface AuthResponse { user: AuthUser }

export const symptomCategories = ['Physical Pain', 'Physical Other', 'Mental', 'Cognitive'] as const;
export const symptomCategorySchema = z.enum(symptomCategories);
export type SymptomCategory = z.infer<typeof symptomCategorySchema>;
export const factorCategories = ['Lifestyle', 'Sleep', 'Mental / Behavioral', 'Physical', 'Food / Substances', 'Environment'] as const;
export const factorCategorySchema = z.enum(factorCategories);
export type FactorCategory = z.infer<typeof factorCategorySchema>;

const symptomRatingSchema = z.object({
  symptomId: z.number().int().positive(),
  severity: z.number().int().min(0).max(4),
});
const factorRatingSchema = z.object({
  factorId: z.number().int().positive(),
  intensity: z.number().int().min(1).max(3),
});

export const createCheckInRequestSchema = z.object({
  mood: z.number().int().min(1).max(5),
  feelingIds: z.array(z.number().int().positive()).default([]),
  pain: z.number().int().min(0).max(10).nullable().optional(),
  symptoms: z.array(symptomRatingSchema).default([]),
  factors: z.array(factorRatingSchema).default([]),
}).superRefine((value, context) => {
  addDuplicateIssue(value.feelingIds, 'Feeling IDs must be unique.', ['feelingIds'], context);
  addDuplicateIssue(value.symptoms.map(({ symptomId }) => symptomId), 'Symptoms must be unique.', ['symptoms'], context);
  addDuplicateIssue(value.factors.map(({ factorId }) => factorId), 'Factors must be unique.', ['factors'], context);
});

export type CreateCheckInRequest = z.input<typeof createCheckInRequestSchema>;
export type CreateCheckInInput = z.output<typeof createCheckInRequestSchema>;
function addDuplicateIssue(values: number[], message: string, path: string[], context: z.RefinementCtx): void {
  if (new Set(values).size !== values.length) context.addIssue({ code: 'custom', message, path });
}

export interface Feeling { id: number; slug: string | null; name: string; isBuiltin: boolean; isPinned: boolean }
export interface Symptom { id: number; slug: string | null; name: string; category: SymptomCategory; isBuiltin: boolean; isPinned: boolean }
export interface SymptomRating { symptomId: number; name: string; category: SymptomCategory; severity: number }
export interface Factor { id: number; slug: string; name: string; category: FactorCategory; intensity: number | null; isBuiltin: boolean; isPinned: boolean }
export interface CheckIn {
  id: number;
  occurredAt: string;
  logicalDate: string;
  mood: number | null;
  feelings: Feeling[];
  pain: number | null;
  symptoms: SymptomRating[];
  factors: Factor[];
}
export interface CheckInResponse { checkIn: CheckIn }
export interface CheckInListResponse { checkIns: CheckIn[] }
export interface FactorListResponse { factors: Factor[] }
export interface FeelingListResponse { feelings: Feeling[] }
export interface SymptomListResponse { symptoms: Symptom[] }
export const preferenceRequestSchema = z.object({ ids: z.array(z.number().int().positive()) });
export const customFeelingRequestSchema = z.object({ name: z.string().trim().min(1).max(100) });
export const customSymptomRequestSchema = z.object({ name: z.string().trim().min(1).max(120), category: symptomCategorySchema });
export const customFactorRequestSchema = z.object({ name: z.string().trim().min(1).max(100), category: factorCategorySchema });
export interface ApiErrorResponse { error: { code: string; message: string; details?: unknown } }
