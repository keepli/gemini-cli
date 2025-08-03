/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

type Model = string;
type TokenCount = number;

export const DEFAULT_TOKEN_LIMIT = 1_048_576;

export function tokenLimit(model: Model): TokenCount {
  // Add other models as they become relevant or if specified by config
  // Pulled from https://ai.google.dev/gemini-api/docs/models
  switch (model) {
    case 'gemini-1.5-pro':
      return 2_097_152;
    case 'gemini-1.5-flash':
    case 'gemini-2.5-pro-preview-05-06':
    case 'gemini-2.5-pro-preview-06-05':
    case 'gemini-2.5-pro':
    case 'gemini-2.5-flash-preview-05-20':
    case 'gemini-2.5-flash':
    case 'gemini-2.5-flash-lite':
    case 'gemini-2.0-flash':
      return 1_048_576;
    case 'gemini-2.0-flash-preview-image-generation':
      return 32_000;

    // SiliconFlow models - 精选模型
    case 'zai-org/GLM-4.5':
      return 128_000;  // GLM-4.5 支持 128K 上下文
    case 'deepseek-ai/DeepSeek-R1':
      return 64_000;   // DeepSeek-R1 推理模型
    case 'Qwen/Qwen3-Coder-480B-A35B-Instruct':
      return 32_000;   // Qwen3 代码模型
    case 'moonshotai/Kimi-K2-Instruct':
      return 200_000;  // Kimi-K2 支持长上下文

    // Zhipu AI models - GLM-4.5 系列 (128K)
    case 'glm-4.5':
    case 'glm-4.5-x':
    case 'glm-4.5-air':
    case 'glm-4.5-airx':
    case 'glm-4.5-flash':
      return 128_000;

    // OpenAI Compatible models - Claude models only
    case 'claude-sonnet-4-20250514':
    case 'claude-3-7-sonnet-20250219':
    case 'claude-3-5-sonnet-20241022':
      return 200_000;

    default:
      return DEFAULT_TOKEN_LIMIT;
  }
}
