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
  Content,
  Part,
  FinishReason,
} from '@google/genai';
import { BaseProvider, ProviderConfig, ProviderInfo } from './base-provider.js';
import { AuthType } from '../core/contentGenerator.js';
import { Config } from '../config/config.js';
import { DEFAULT_ZHIPU_MODEL } from '../config/models.js';

/**
 * Zhipu AI API response interfaces
 */
interface ZhipuMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ZhipuRequest {
  model: string;
  messages: ZhipuMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
}

interface ZhipuResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface ZhipuStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason?: string;
  }>;
}

/**
 * Zhipu AI provider implementation
 */
/**
 * 智谱轻言 GLM-4.5 系列模型
 *
 * 🚀 GLM-4.5: 最新旗舰，性能最优，强大推理能力和代码生成
 * 🏃 GLM-4.5-X: 旗舰极速版，适合实时翻译、智能助手等场景
 * 💰 GLM-4.5-Air: 高性价比，同参数规模性能最佳
 * ⚡ GLM-4.5-AirX: 高性价比极速版，速度快价格适中
 * 🆓 GLM-4.5-Flash: 免费模型，最新基座模型的普惠版本
 */
export class ZhipuProvider extends BaseProvider {
  private static readonly PROVIDER_INFO: ProviderInfo = {
    name: 'zhipu',
    displayName: 'Zhipu AI (智谱轻言)',
    authType: AuthType.ZHIPU_API_KEY,
    defaultModel: DEFAULT_ZHIPU_MODEL,
    supportedModels: [
      // GLM-4.5 系列
      'glm-4.5',
      'glm-4.5-x',
      'glm-4.5-air',
      'glm-4.5-airx',
      'glm-4.5-flash',
    ],
    requiresApiKey: true,
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
  };

  constructor(config: ProviderConfig, gcConfig: Config) {
    super(config, gcConfig, ZhipuProvider.PROVIDER_INFO);
  }

  async validateConfig(): Promise<boolean> {
    if (!this.config.apiKey) {
      throw new Error('Zhipu AI API key is required');
    }
    return true;
  }

  async initialize(): Promise<void> {
    await this.validateConfig();
    // Test API connection
    try {
      await this.testConnection();
    } catch (error) {
      throw this.handleApiError(error, 'initialization');
    }
  }

  private async testConnection(): Promise<void> {
    const testRequest: ZhipuRequest = {
      model: this.getEffectiveModel(),
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 1,
    };

    const response = await fetch(`${this.getBaseUrl()}/chat/completions`, {
      method: 'POST',
      headers: this.getZhipuHeaders(),
      body: JSON.stringify(testRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
  }

  async generateContent(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<GenerateContentResponse> {
    const zhipuRequest = this.convertToZhipuRequest(request);
    
    try {
      const response = await fetch(`${this.getBaseUrl()}/chat/completions`, {
        method: 'POST',
        headers: this.getZhipuHeaders(),
        body: JSON.stringify(zhipuRequest),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data: ZhipuResponse = await response.json();
      return this.convertToGeminiResponse(data);
    } catch (error) {
      throw this.handleApiError(error, 'generateContent');
    }
  }

  async generateContentStream(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    const zhipuRequest = this.convertToZhipuRequest(request, true);
    
    try {
      const response = await fetch(`${this.getBaseUrl()}/chat/completions`, {
        method: 'POST',
        headers: this.getZhipuHeaders(),
        body: JSON.stringify(zhipuRequest),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return this.parseStreamResponse(response);
    } catch (error) {
      throw this.handleApiError(error, 'generateContentStream');
    }
  }

  async countTokens(request: CountTokensParameters): Promise<CountTokensResponse> {
    // Zhipu AI doesn't have a dedicated token counting endpoint
    // We'll estimate based on content length (rough approximation)
    const content = this.extractTextFromContentListUnion(request.contents);
    const estimatedTokens = Math.ceil(content.length / 4); // Rough estimate: 1 token ≈ 4 characters

    const response = new CountTokensResponse();
    response.totalTokens = estimatedTokens;
    return response;
  }

  async embedContent(_request: EmbedContentParameters): Promise<EmbedContentResponse> {
    // Zhipu AI has embedding models, but they use a different API
    // For now, we'll throw an error and can implement this later if needed
    throw new Error('Embeddings are not yet supported by Zhipu provider');
  }

  private getZhipuHeaders(): Record<string, string> {
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

  private convertToZhipuRequest(
    request: GenerateContentParameters,
    stream = false,
  ): ZhipuRequest {
    const messages: ZhipuMessage[] = [];
    
    // Add system instruction if present
    if (request.config?.systemInstruction) {
      const systemContent = this.extractTextFromContentUnion(request.config.systemInstruction);
      if (systemContent) {
        messages.push({ role: 'system', content: systemContent });
      }
    }

    // Convert contents to messages
    const contents = this.normalizeContentListUnion(request.contents);
    for (const content of contents) {
      const text = this.extractTextFromParts(content.parts || []);
      if (text) {
        const role = content.role === 'model' ? 'assistant' : 'user';
        messages.push({ role, content: text });
      }
    }

    return {
      model: this.getEffectiveModel(request.model),
      messages,
      stream,
      temperature: request.config?.temperature,
      max_tokens: request.config?.maxOutputTokens,
      top_p: request.config?.topP,
    };
  }

  private convertToGeminiResponse(response: ZhipuResponse): GenerateContentResponse {
    const choice = response.choices[0];
    if (!choice) {
      throw new Error('No response choices received from Zhipu AI');
    }

    const geminiResponse = new GenerateContentResponse();
    geminiResponse.candidates = [
      {
        content: {
          parts: [{ text: choice.message.content }],
          role: 'model',
        },
        finishReason: this.mapFinishReason(choice.finish_reason),
        index: 0,
      },
    ];
    geminiResponse.usageMetadata = {
      promptTokenCount: response.usage.prompt_tokens,
      candidatesTokenCount: response.usage.completion_tokens,
      totalTokenCount: response.usage.total_tokens,
    };

    return geminiResponse;
  }

  private async* parseStreamResponse(
    response: Response,
  ): AsyncGenerator<GenerateContentResponse> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body available for streaming');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              return;
            }

            try {
              const chunk: ZhipuStreamChunk = JSON.parse(data);
              const choice = chunk.choices[0];
              if (choice?.delta?.content) {
                const streamResponse = new GenerateContentResponse();
                streamResponse.candidates = [
                  {
                    content: {
                      parts: [{ text: choice.delta.content }],
                      role: 'model',
                    },
                    finishReason: choice.finish_reason ? this.mapFinishReason(choice.finish_reason) : undefined,
                    index: 0,
                  },
                ];
                yield streamResponse;
              }
            } catch (error) {
              // Skip invalid JSON chunks
              continue;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private extractTextFromParts(parts: Part[]): string {
    return parts
      .filter((part): part is { text: string } => 'text' in part)
      .map(part => part.text)
      .join(' ');
  }

  private extractTextFromContents(contents: Content[]): string {
    return contents
      .map(content => this.extractTextFromParts(content.parts || []))
      .join(' ');
  }

  private extractTextFromContentListUnion(contents: any): string {
    // Handle ContentListUnion which can be Content | Content[] | PartUnion | PartUnion[]
    if (!contents) return '';

    if (Array.isArray(contents)) {
      return contents
        .map(item => {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object' && 'parts' in item) {
            return this.extractTextFromParts(item.parts || []);
          }
          if (item && typeof item === 'object' && 'text' in item) {
            return item.text;
          }
          return '';
        })
        .join(' ');
    }

    if (typeof contents === 'string') return contents;
    if (contents && typeof contents === 'object' && 'parts' in contents) {
      return this.extractTextFromParts(contents.parts || []);
    }
    if (contents && typeof contents === 'object' && 'text' in contents) {
      return contents.text;
    }

    return '';
  }

  private extractTextFromContentUnion(content: any): string {
    if (!content) return '';
    if (typeof content === 'string') return content;
    if (content && typeof content === 'object' && 'parts' in content) {
      return this.extractTextFromParts(content.parts || []);
    }
    if (content && typeof content === 'object' && 'text' in content) {
      return content.text;
    }
    return '';
  }

  private normalizeContentListUnion(contents: any): Content[] {
    if (!contents) return [];

    if (Array.isArray(contents)) {
      return contents.filter(item => item && typeof item === 'object' && 'parts' in item);
    }

    if (contents && typeof contents === 'object' && 'parts' in contents) {
      return [contents];
    }

    return [];
  }

  private mapFinishReason(reason: string): FinishReason {
    switch (reason) {
      case 'stop':
        return FinishReason.STOP;
      case 'length':
        return FinishReason.MAX_TOKENS;
      case 'content_filter':
        return FinishReason.SAFETY;
      default:
        return FinishReason.OTHER;
    }
  }
}
