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
import { DEFAULT_SILICONFLOW_MODEL } from '../config/models.js';

/**
 * SiliconFlow API response interfaces
 */
interface SiliconFlowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface SiliconFlowRequest {
  model: string;
  messages: SiliconFlowMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
}

interface SiliconFlowResponse {
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

interface SiliconFlowStreamChunk {
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
 * SiliconFlow 供应商 - 精选模型
 *
 * 🤖 支持的模型：
 * - GLM-4.5: 智谱轻言最新旗舰模型，强大的中文理解和生成能力
 * - DeepSeek-R1: DeepSeek 推理模型，专注于复杂推理任务
 * - Qwen3-Coder: 通义千问代码专用模型，代码生成和理解专家
 * - Kimi-K2: 月之暗面对话模型，优秀的对话交互能力
 */
export class SiliconFlowProvider extends BaseProvider {
  private static readonly PROVIDER_INFO: ProviderInfo = {
    name: 'siliconflow',
    displayName: 'SiliconFlow (精选模型)',
    authType: AuthType.SILICONFLOW_API_KEY,
    defaultModel: DEFAULT_SILICONFLOW_MODEL,
    supportedModels: [
      'zai-org/GLM-4.5',                           // 智谱轻言 GLM-4.5
      'deepseek-ai/DeepSeek-R1',                   // DeepSeek 推理模型
      'Qwen/Qwen3-Coder-480B-A35B-Instruct',      // 通义千问代码模型
      'moonshotai/Kimi-K2-Instruct',               // 月之暗面 Kimi
    ],
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.siliconflow.cn/v1',
  };

  constructor(config: ProviderConfig, gcConfig: Config) {
    super(config, gcConfig, SiliconFlowProvider.PROVIDER_INFO);
  }

  async validateConfig(): Promise<boolean> {
    if (!this.config.apiKey) {
      throw new Error('SiliconFlow API key is required');
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
    const testRequest: SiliconFlowRequest = {
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
    const siliconFlowRequest = this.convertToSiliconFlowRequest(request);
    
    try {
      const response = await fetch(`${this.getBaseUrl()}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(siliconFlowRequest),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data: SiliconFlowResponse = await response.json();
      return this.convertToGeminiResponse(data);
    } catch (error) {
      throw this.handleApiError(error, 'generateContent');
    }
  }

  async generateContentStream(
    request: GenerateContentParameters,
    _userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    const siliconFlowRequest = this.convertToSiliconFlowRequest(request, true);
    
    try {
      const response = await fetch(`${this.getBaseUrl()}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(siliconFlowRequest),
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
    // SiliconFlow doesn't have a dedicated token counting endpoint
    // We'll estimate based on content length (rough approximation)
    const content = this.extractTextFromContentListUnion(request.contents);
    const estimatedTokens = Math.ceil(content.length / 4); // Rough estimate: 1 token ≈ 4 characters

    const response = new CountTokensResponse();
    response.totalTokens = estimatedTokens;
    return response;
  }

  async embedContent(_request: EmbedContentParameters): Promise<EmbedContentResponse> {
    // SiliconFlow doesn't support embeddings in the same way as Gemini
    throw new Error('Embeddings are not supported by SiliconFlow provider');
  }

  private convertToSiliconFlowRequest(
    request: GenerateContentParameters,
    stream = false,
  ): SiliconFlowRequest {
    const messages: SiliconFlowMessage[] = [];
    
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

  private convertToGeminiResponse(response: SiliconFlowResponse): GenerateContentResponse {
    const choice = response.choices[0];
    if (!choice) {
      throw new Error('No response choices received from SiliconFlow');
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
              const chunk: SiliconFlowStreamChunk = JSON.parse(data);
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

  private extractTextFromContentListUnion(contents: unknown): string {
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
