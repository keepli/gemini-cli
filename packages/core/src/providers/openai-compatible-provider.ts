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
import { DEFAULT_OPENAI_COMPATIBLE_MODEL } from '../config/models.js';

/**
 * OpenAI Compatible API interfaces
 */
interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
}

interface OpenAIResponse {
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

interface OpenAIStreamChunk {
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
 * OpenAI 兼容 API 供应商 - Claude 模型专用
 *
 * 🎭 支持的 Claude 模型：
 * - claude-sonnet-4-20250514: Claude Sonnet 4 最新版本
 * - claude-3-7-sonnet-20250219: Claude 3.7 Sonnet
 * - claude-3-5-sonnet-20241022: Claude 3.5 Sonnet
 *
 * 📝 配置方式：
 * - 设置 OPENAI_COMPATIBLE_API_KEY 环境变量
 * - 设置 OPENAI_COMPATIBLE_BASE_URL 环境变量
 * - 设置 OPENAI_COMPATIBLE_MODEL 环境变量（可选）
 */
export class OpenAICompatibleProvider extends BaseProvider {
  private static readonly PROVIDER_INFO: ProviderInfo = {
    name: 'openai-compatible',
    displayName: 'Claude AI (OpenAI Compatible)',
    authType: AuthType.OPENAI_COMPATIBLE_API_KEY,
    defaultModel: DEFAULT_OPENAI_COMPATIBLE_MODEL, // Claude 4 作为默认
    supportedModels: [
      // Claude 模型
      'claude-sonnet-4-20250514',      // Claude Sonnet 4 最新版本
      'claude-3-7-sonnet-20250219',    // Claude 3.7 Sonnet
      'claude-3-5-sonnet-20241022',    // Claude 3.5 Sonnet
    ],
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.agicto.cn/v1', // 默认 Claude 代理端点
  };

  constructor(config: ProviderConfig, gcConfig: Config) {
    super(config, gcConfig, OpenAICompatibleProvider.PROVIDER_INFO);
  }

  async validateConfig(): Promise<boolean> {
    if (!this.config.apiKey) {
      throw new Error('OpenAI Compatible API key is required');
    }
    if (!this.config.baseUrl) {
      throw new Error('OpenAI Compatible base URL is required');
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
    const testRequest: OpenAIRequest = {
      model: this.getEffectiveModel(),
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 1,
    };

    const response = await fetch(`${this.getBaseUrl()}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(testRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
  }

  async generateContent(
    request: GenerateContentParameters,
    _userPromptId: string,
  ): Promise<GenerateContentResponse> {
    const openaiRequest = this.convertToOpenAIRequest(request);
    
    try {
      const response = await fetch(`${this.getBaseUrl()}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(openaiRequest),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data: OpenAIResponse = await response.json();
      return this.convertToGeminiResponse(data);
    } catch (error) {
      throw this.handleApiError(error, 'generateContent');
    }
  }

  async generateContentStream(
    request: GenerateContentParameters,
    _userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    const openaiRequest = this.convertToOpenAIRequest(request, true);
    
    try {
      const response = await fetch(`${this.getBaseUrl()}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(openaiRequest),
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
    // 大多数 OpenAI 兼容 API 没有专门的 token 计数端点
    // 使用基于字符数的估算
    const content = this.extractTextFromContentListUnion(request.contents);
    const estimatedTokens = Math.ceil(content.length / 4); // 粗略估算：1 token ≈ 4 字符
    
    const response = new CountTokensResponse();
    response.totalTokens = estimatedTokens;
    return response;
  }

  async embedContent(_request: EmbedContentParameters): Promise<EmbedContentResponse> {
    // 大多数聊天模型不支持嵌入，如需要可以单独实现
    throw new Error('Embeddings are not supported by this OpenAI Compatible provider');
  }

  private convertToOpenAIRequest(
    request: GenerateContentParameters,
    stream = false,
  ): OpenAIRequest {
    const messages: OpenAIMessage[] = [];
    
    // 添加系统指令
    if (request.config?.systemInstruction) {
      const systemContent = this.extractTextFromContentUnion(request.config.systemInstruction);
      if (systemContent) {
        messages.push({ role: 'system', content: systemContent });
      }
    }

    // 转换内容为消息
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

  private convertToGeminiResponse(response: OpenAIResponse): GenerateContentResponse {
    const choice = response.choices[0];
    if (!choice) {
      throw new Error('No response choices received from OpenAI Compatible API');
    }

    // 检查消息内容
    const messageContent = choice.message?.content;
    if (!messageContent) {
      throw new Error('No message content in API response');
    }

    const geminiResponse = new GenerateContentResponse();
    geminiResponse.candidates = [
      {
        content: {
          parts: [{ text: messageContent }],
          role: 'model',
        },
        finishReason: this.mapFinishReason(choice.finish_reason),
        index: 0,
      },
    ];

    // 安全地处理 usage 数据
    if (response.usage) {
      geminiResponse.usageMetadata = {
        promptTokenCount: response.usage.prompt_tokens || 0,
        candidatesTokenCount: response.usage.completion_tokens || 0,
        totalTokenCount: response.usage.total_tokens || 0,
      };
    }

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
              const chunk: OpenAIStreamChunk = JSON.parse(data);
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
            } catch (_error) {
              // 跳过无效的 JSON 块
              continue;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
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

  protected getBaseUrl(): string {
    return this.config.baseUrl || this.info.defaultBaseUrl || 'https://api.openai.com/v1';
  }

  protected handleApiError(error: unknown, context: string): Error {
    const message = error instanceof Error ? error.message : String(error);
    return new Error(`OpenAI Compatible API error in ${context}: ${message}`);
  }

  private extractTextFromParts(parts: Part[]): string {
    return parts
      .filter(part => part.text)
      .map(part => part.text)
      .join(' ');
  }

  private extractTextFromContentListUnion(contents: unknown): string {
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
      const parts = (contents as { parts?: Part[] }).parts;
      return this.extractTextFromParts(parts || []);
    }
    if (contents && typeof contents === 'object' && 'text' in contents) {
      const text = (contents as { text?: string }).text;
      return text || '';
    }

    return '';
  }

  private extractTextFromContentUnion(content: unknown): string {
    if (!content) return '';
    if (typeof content === 'string') return content;
    if (content && typeof content === 'object' && 'parts' in content) {
      const parts = (content as { parts?: Part[] }).parts;
      return this.extractTextFromParts(parts || []);
    }
    if (content && typeof content === 'object' && 'text' in content) {
      const text = (content as { text?: string }).text;
      return text || '';
    }
    return '';
  }

  private normalizeContentListUnion(contents: unknown): Content[] {
    if (!contents) return [];

    if (Array.isArray(contents)) {
      return contents.filter(item => item && typeof item === 'object' && 'parts' in item) as Content[];
    }

    if (contents && typeof contents === 'object' && 'parts' in contents) {
      return [contents as Content];
    }

    return [];
  }
}
