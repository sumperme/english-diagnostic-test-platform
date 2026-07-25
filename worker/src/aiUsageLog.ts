// DeepSeek API usage logging for admin spending visibility.
// Rates are for deepseek-v4-flash (cache-miss input / output).
// Stored at insert time so historical rows stay stable if pricing changes.

export type AiFeatureType = 'student_feedback' | 'class_overview';

export type AiUsageContext = {
  featureType: AiFeatureType;
  voucherCode?: string | null;
  teacherKey?: string | null;
  testCode?: string | null;
  attemptId?: string | null;
};

export type AiUsageLogEnv = {
  DB: D1Database;
};

/** USD per 1M tokens — deepseek-v4-flash cache-miss input / output (DeepSeek docs). */
const INPUT_COST_PER_M = 0.14;
const OUTPUT_COST_PER_M = 0.28;

export function estimateCostUsd(promptTokens: number, completionTokens: number): number {
  const input = (promptTokens / 1_000_000) * INPUT_COST_PER_M;
  const output = (completionTokens / 1_000_000) * OUTPUT_COST_PER_M;
  return Math.round((input + output) * 1_000_000) / 1_000_000;
}

export async function logAiUsage(
  env: AiUsageLogEnv,
  model: string,
  usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number },
  context: AiUsageContext,
): Promise<void> {
  const promptTokens = Number(usage.prompt_tokens ?? 0);
  const completionTokens = Number(usage.completion_tokens ?? 0);
  const totalTokens = Number(usage.total_tokens ?? promptTokens + completionTokens);
  if (totalTokens <= 0) return;

  const cost = estimateCostUsd(promptTokens, completionTokens);
  await env.DB.prepare(
    `INSERT INTO ai_api_usage_logs
       (created_at, feature_type, voucher_code, teacher_key, test_code, attempt_id,
        model, prompt_tokens, completion_tokens, total_tokens, estimated_cost_usd)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      Date.now(),
      context.featureType,
      context.voucherCode ?? null,
      context.teacherKey ?? null,
      context.testCode ?? null,
      context.attemptId ?? null,
      model,
      promptTokens,
      completionTokens,
      totalTokens,
      cost,
    )
    .run();
}
