/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CountTokensResponse,
  GenerateContentResponse,
  GenerateContentParameters,
  CountTokensParameters,
  EmbedContentResponse,
  EmbedContentParameters,
  GoogleGenAI,
} from '@google/genai';
import { createCodeAssistContentGenerator } from '../code_assist/codeAssist.js';
import { DEFAULT_GEMINI_MODEL, DEFAULT_SILICONFLOW_MODEL, DEFAULT_ZHIPU_MODEL, DEFAULT_OPENAI_COMPATIBLE_MODEL } from '../config/models.js';
import { Config } from '../config/config.js';
import { getEffectiveModel } from './modelCheck.js';
import { UserTierId } from '../code_assist/types.js';

/**
 * Interface abstracting the core functionalities for generating content and counting tokens.
 */
export interface ContentGenerator {
  generateContent(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<GenerateContentResponse>;

  generateContentStream(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>>;

  countTokens(request: CountTokensParameters): Promise<CountTokensResponse>;

  embedContent(request: EmbedContentParameters): Promise<EmbedContentResponse>;

  userTier?: UserTierId;
}

export enum AuthType {
  LOGIN_WITH_GOOGLE = 'oauth-personal',
  USE_GEMINI = 'gemini-api-key',
  USE_VERTEX_AI = 'vertex-ai',
  CLOUD_SHELL = 'cloud-shell',
  SILICONFLOW_API_KEY = 'siliconflow-api-key',
  ZHIPU_API_KEY = 'zhipu-api-key',
  OPENAI_COMPATIBLE_API_KEY = 'openai-compatible-api-key',
}

export type ContentGeneratorConfig = {
  model: string;
  apiKey?: string;
  vertexai?: boolean;
  authType?: AuthType | undefined;
  proxy?: string | undefined;
  provider?: string;
  baseUrl?: string;
  customHeaders?: Record<string, string>;
};

export function createContentGeneratorConfig(
  config: Config,
  authType: AuthType | undefined,
): ContentGeneratorConfig {
  const geminiApiKey = process.env.GEMINI_API_KEY || undefined;
  const googleApiKey = process.env.GOOGLE_API_KEY || undefined;
  const googleCloudProject = process.env.GOOGLE_CLOUD_PROJECT || undefined;
  const googleCloudLocation = process.env.GOOGLE_CLOUD_LOCATION || undefined;
  const siliconflowApiKey = process.env.GEMINI_SILICONFLOW_API_KEY || undefined;
  const zhipuApiKey = process.env.GEMINI_ZHIPU_API_KEY || undefined;
  const openaiCompatibleApiKey = process.env.GEMINI_OPENAI_COMPATIBLE_API_KEY || undefined;

  // Use runtime model from config if available; otherwise, fall back to parameter or default
  const effectiveModel = config.getModel() || DEFAULT_GEMINI_MODEL;

  const contentGeneratorConfig: ContentGeneratorConfig = {
    model: effectiveModel,
    authType,
    proxy: config?.getProxy(),
  };

  // If we are using Google auth or we are in Cloud Shell, there is nothing else to validate for now
  if (
    authType === AuthType.LOGIN_WITH_GOOGLE ||
    authType === AuthType.CLOUD_SHELL
  ) {
    return contentGeneratorConfig;
  }

  if (authType === AuthType.USE_GEMINI && geminiApiKey) {
    contentGeneratorConfig.apiKey = geminiApiKey;
    contentGeneratorConfig.vertexai = false;
    contentGeneratorConfig.provider = 'gemini';
    if (geminiApiKey) {
      getEffectiveModel(
        geminiApiKey,
        contentGeneratorConfig.model,
        contentGeneratorConfig.proxy,
      );
    }

    return contentGeneratorConfig;
  }

  if (
    authType === AuthType.USE_VERTEX_AI &&
    (googleApiKey || (googleCloudProject && googleCloudLocation))
  ) {
    contentGeneratorConfig.apiKey = googleApiKey;
    contentGeneratorConfig.vertexai = true;
    contentGeneratorConfig.provider = 'vertex-ai';

    return contentGeneratorConfig;
  }

  if (authType === AuthType.SILICONFLOW_API_KEY && siliconflowApiKey) {
    contentGeneratorConfig.apiKey = siliconflowApiKey;
    contentGeneratorConfig.provider = 'siliconflow';
    contentGeneratorConfig.baseUrl = 'https://api.siliconflow.cn/v1';
    contentGeneratorConfig.model = effectiveModel === DEFAULT_GEMINI_MODEL ? DEFAULT_SILICONFLOW_MODEL : effectiveModel;

    return contentGeneratorConfig;
  }

  if (authType === AuthType.ZHIPU_API_KEY && zhipuApiKey) {
    contentGeneratorConfig.apiKey = zhipuApiKey;
    contentGeneratorConfig.provider = 'zhipu';
    contentGeneratorConfig.baseUrl = 'https://open.bigmodel.cn/api/paas/v4';
    contentGeneratorConfig.model = effectiveModel === DEFAULT_GEMINI_MODEL ? DEFAULT_ZHIPU_MODEL : effectiveModel;

    return contentGeneratorConfig;
  }

  if (authType === AuthType.OPENAI_COMPATIBLE_API_KEY && openaiCompatibleApiKey) {
    contentGeneratorConfig.apiKey = openaiCompatibleApiKey;
    contentGeneratorConfig.provider = 'openai-compatible';
    contentGeneratorConfig.baseUrl = process.env.GEMINI_OPENAI_COMPATIBLE_BASE_URL || 'https://api.agicto.cn/v1';
    contentGeneratorConfig.model = process.env.GEMINI_OPENAI_COMPATIBLE_MODEL ||
                                   (effectiveModel === DEFAULT_GEMINI_MODEL ? DEFAULT_OPENAI_COMPATIBLE_MODEL : effectiveModel);

    return contentGeneratorConfig;
  }

  return contentGeneratorConfig;
}

export async function createContentGenerator(
  config: ContentGeneratorConfig,
  gcConfig: Config,
  sessionId?: string,
): Promise<ContentGenerator> {
  const version = process.env.CLI_VERSION || process.version;
  const httpOptions = {
    headers: {
      'User-Agent': `GeminiCLI/${version} (${process.platform}; ${process.arch})`,
    },
  };

  if (
    config.authType === AuthType.LOGIN_WITH_GOOGLE ||
    config.authType === AuthType.CLOUD_SHELL
  ) {
    return createCodeAssistContentGenerator(
      httpOptions,
      config.authType,
      gcConfig,
      sessionId,
    );
  }

  if (
    config.authType === AuthType.USE_GEMINI ||
    config.authType === AuthType.USE_VERTEX_AI
  ) {
    const googleGenAI = new GoogleGenAI({
      apiKey: config.apiKey === '' ? undefined : config.apiKey,
      vertexai: config.vertexai,
      httpOptions,
    });

    return googleGenAI.models;
  }

  // Handle custom providers
  if (config.authType === AuthType.SILICONFLOW_API_KEY) {
    const { SiliconFlowProvider } = await import('../providers/siliconflow-provider.js');
    const providerConfig = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
      proxy: config.proxy,
      customHeaders: config.customHeaders,
    };
    const provider = new SiliconFlowProvider(providerConfig, gcConfig);
    await provider.initialize();
    return provider;
  }

  if (config.authType === AuthType.ZHIPU_API_KEY) {
    const { ZhipuProvider } = await import('../providers/zhipu-provider.js');
    const providerConfig = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
      proxy: config.proxy,
      customHeaders: config.customHeaders,
    };
    const provider = new ZhipuProvider(providerConfig, gcConfig);
    await provider.initialize();
    return provider;
  }

  if (config.authType === AuthType.OPENAI_COMPATIBLE_API_KEY) {
    const { OpenAICompatibleProvider } = await import('../providers/openai-compatible-provider.js');
    const providerConfig = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
      proxy: config.proxy,
      customHeaders: config.customHeaders,
    };
    const provider = new OpenAICompatibleProvider(providerConfig, gcConfig);
    await provider.initialize();
    return provider;
  }

  throw new Error(
    `Error creating contentGenerator: Unsupported authType: ${config.authType}`,
  );
}
