import { moodTrendResponseSchema, type MoodTrendResponse } from '@capstone/shared';
import { apiRequest } from '../../api/api';

export async function getMoodTrend(): Promise<MoodTrendResponse> {
  return moodTrendResponseSchema.parse(await apiRequest<unknown>('/api/insights/mood-trend'));
}
