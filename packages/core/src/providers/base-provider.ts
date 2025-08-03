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
} from '@google/genai';
import { ContentGenerator, AuthType } from '../core/contentGenerator.js';
import { Config } from '../config/config.js';

/**
 * Configuration for a specific AI provider
 */
export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  model: string;
  proxy?: string;
  customHeaders?: Record<string, string>;
  [key: string]: unknown; // Allow provider-specific config
}

/**
 * Provider metadata and capabilities
 */
export interface ProviderInfo {
  name: string;
  displayName: string;
  authType: AuthType;
  defaultModel: string;
  supportedModels: string[];
  requiresApiKey: boolean;
  defaultBaseUrl?: string;
  tokenLimits?: Record<string, number>;
}

/**
 * Abstract base class for AI providers
 */
export abstract class BaseProvider implements ContentGenerator {
  protected config: ProviderConfig;
  protected gcConfig: Config;
  protected info: ProviderInfo;

  constructor(config: ProviderConfig, gcConfig: Config, info: ProviderInfo) {
    this.config = config;
    this.gcConfig = gcConfig;
    this.info = info;
  }

  /**
   * Get provider information
   */
  getProviderInfo(): ProviderInfo {
    return this.info;
  }

  /**
   * Validate provider configuration
   */
  abstract validateConfig(): Promise<boolean>;

  /**
   * Initialize the provider (setup connections, validate auth, etc.)
   */
  abstract initialize(): Promise<void>;

  /**
   * Generate content using the provider's API
   */
  abstract generateContent(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<GenerateContentResponse>;

  /**
   * Generate content stream using the provider's API
   */
  abstract generateContentStream(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>>;

  /**
   * Count tokens for the given request
   */
  abstract countTokens(request: CountTokensParameters): Promise<CountTokensResponse>;

  /**
   * Generate embeddings (optional, not all providers support this)
   */
  abstract embedContent(request: EmbedContentParameters): Promise<EmbedContentResponse>;

  /**
   * Get the effective model name (with provider-specific mapping if needed)
   */
  protected getEffectiveModel(requestedModel?: string): string {
    return requestedModel || this.config.model || this.info.defaultModel;
  }

  /**
   * Get HTTP headers for API requests
   */
  protected getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': `GeminiCLI/${process.env.CLI_VERSION || 'dev'} (${process.platform}; ${process.arch})`,
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    if (this.config.customHeaders) {
      Object.assign(headers, this.config.customHeaders);
    }

    return headers;
  }

  /**
   * Get the base URL for API requests
   */
  protected getBaseUrl(): string {
    return this.config.baseUrl || this.info.defaultBaseUrl || '';
  }

  /**
   * Handle API errors in a consistent way
   */
  protected handleApiError(error: unknown, context: string): Error {
    if (error instanceof Error) {
      return new Error(`${this.info.displayName} API error in ${context}: ${error.message}`);
    }
    return new Error(`${this.info.displayName} API error in ${context}: ${String(error)}`);
  }
}

/**
 * Registry for AI providers
 */
export class ProviderRegistry {
  private static providers = new Map<AuthType, typeof BaseProvider>();
  private static providerInfos = new Map<AuthType, ProviderInfo>();

  /**
   * Register a provider class
   */
  static registerProvider(
    authType: AuthType,
    providerClass: typeof BaseProvider,
    info: ProviderInfo,
  ): void {
    this.providers.set(authType, providerClass);
    this.providerInfos.set(authType, info);
  }

  /**
   * Get a provider class by auth type
   */
  static getProvider(authType: AuthType): typeof BaseProvider | undefined {
    return this.providers.get(authType);
  }

  /**
   * Get provider info by auth type
   */
  static getProviderInfo(authType: AuthType): ProviderInfo | undefined {
    return this.providerInfos.get(authType);
  }

  /**
   * Get all registered providers
   */
  static getAllProviders(): Map<AuthType, ProviderInfo> {
    return new Map(this.providerInfos);
  }

  /**
   * Check if a provider is registered
   */
  static hasProvider(authType: AuthType): boolean {
    return this.providers.has(authType);
  }
}
