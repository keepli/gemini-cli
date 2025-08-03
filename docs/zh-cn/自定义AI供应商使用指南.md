# 自定义 AI 供应商使用指南

Gemini CLI 现在支持多个 AI 模型供应商，除了 Google 的 Gemini 模型外，还支持硅基流动和智谱轻言等国内优秀的 AI 服务提供商。

## 支持的供应商

### 1. 硅基流动 (SiliconFlow)

硅基流动提供精选的高质量 AI 模型，专注于最优秀的模型。

**支持的模型：**

### 🤖 精选模型
- `zai-org/GLM-4.5` (默认) - 智谱轻言最新旗舰模型，强大的中文理解和生成能力
- `deepseek-ai/DeepSeek-R1` - DeepSeek 推理模型，专注于复杂推理任务
- `Qwen/Qwen3-Coder-480B-A35B-Instruct` - 通义千问代码专用模型，代码生成和理解专家
- `moonshotai/Kimi-K2-Instruct` - 月之暗面对话模型，优秀的对话交互能力

### 2. 智谱轻言 (Zhipu AI)

智谱 AI 提供 GLM 系列模型，在中文理解和生成方面表现优异。

**支持的模型：**

### 🚀 GLM-4.5 系列 - 高智能旗舰
- `glm-4.5` (默认) - 性能最优，强大推理能力和代码生成
- `glm-4.5-x` - 旗舰极速版，适合实时翻译、智能助手
- `glm-4.5-air` - 高性价比，同参数规模性能最佳
- `glm-4.5-airx` - 高性价比极速版，价格适中速度快
- `glm-4.5-flash` - 免费模型，最新基座模型的普惠版本

### 3. Claude AI (OpenAI 兼容)

通过 OpenAI 兼容 API 格式访问 Claude 模型。

**支持的模型：**

### 🎭 Claude 模型
- `claude-sonnet-4-20250514` - Claude Sonnet 4 最新版本
- `claude-3-7-sonnet-20250219` - Claude 3.7 Sonnet
- `claude-3-5-sonnet-20241022` (默认) - Claude 3.5 Sonnet

## 配置方法

### 方法一：环境变量配置

在终端中设置环境变量：

```bash
# 硅基流动
export SILICONFLOW_API_KEY="你的硅基流动API密钥"

# 智谱轻言
export ZHIPU_API_KEY="你的智谱AI密钥"

# Claude AI (OpenAI 兼容)
export OPENAI_COMPATIBLE_API_KEY="你的API密钥"
export OPENAI_COMPATIBLE_BASE_URL="https://api.agicto.cn/v1"  # Claude AI 代理服务
export OPENAI_COMPATIBLE_MODEL="claude-sonnet-4-20250514"  # 可选：默认模型（Claude 4）
```

### 方法二：.env 文件配置

在项目根目录创建 `.env` 文件：

```env
# 硅基流动配置
SILICONFLOW_API_KEY=你的硅基流动API密钥

# 智谱轻言配置
ZHIPU_API_KEY=你的智谱AI密钥

# Claude AI (OpenAI 兼容) 配置
OPENAI_COMPATIBLE_API_KEY=你的API密钥
OPENAI_COMPATIBLE_BASE_URL=https://api.agicto.cn/v1
OPENAI_COMPATIBLE_MODEL=claude-sonnet-4-20250514

# 可选：设置默认认证方式
GEMINI_DEFAULT_AUTH_TYPE=openai-compatible-api-key
```

### 方法三：配置文件设置

编辑用户配置文件 `~/.gemini/settings.json`：

```json
{
  "selectedAuthType": "siliconflow-api-key",
  "providers": {
    "siliconflow": {
      "apiKey": "你的硅基流动API密钥",
      "model": "deepseek-chat",
      "baseUrl": "https://api.siliconflow.cn/v1"
    },
    "zhipu": {
      "apiKey": "你的智谱AI密钥",
      "model": "glm-4.5",
      "baseUrl": "https://open.bigmodel.cn/api/paas/v4"
    },
    "openai-compatible": {
      "apiKey": "你的API密钥",
      "baseUrl": "https://api.agicto.cn/v1",
      "model": "claude-sonnet-4-20250514"
    }
  }
}
```

## 使用方法

### 交互式使用

1. 启动 Gemini CLI：
   ```bash
   gemini
   ```

2. 在认证选择界面选择：
   - "SiliconFlow API Key" - 使用硅基流动
   - "Zhipu AI API Key (智谱轻言)" - 使用智谱轻言
   - "Claude AI (OpenAI Compatible)" - 使用 Claude AI

3. CLI 会自动使用配置的供应商和默认模型。

### 命令行直接使用

```bash
# 使用硅基流动的 DeepSeek Chat 模型
SILICONFLOW_API_KEY="你的密钥" gemini "解释一下机器学习的基本概念"

# 使用硅基流动的代码专用模型
SILICONFLOW_API_KEY="你的密钥" gemini --model deepseek-coder "写一个 Python 快速排序函数"

# 使用智谱轻言的 GLM-4 模型
ZHIPU_API_KEY="你的密钥" gemini "写一篇关于人工智能发展的短文"

# 使用智谱轻言的长上下文模型
ZHIPU_API_KEY="你的密钥" gemini --model glm-4-long "分析这份长文档：[粘贴你的内容]"
```

### 模型切换

在交互模式中，可以使用 `/model` 命令切换模型：

```
/model zai-org/GLM-4.5
/model deepseek-ai/DeepSeek-R1
/model Qwen/Qwen3-Coder-480B-A35B-Instruct
/model moonshotai/Kimi-K2-Instruct
/model glm-4.5
/model claude-sonnet-4-20250514
```

## API 密钥获取

### 硅基流动

1. 访问 [硅基流动官网](https://siliconflow.cn/)
2. 注册账号并登录
3. 进入控制台，找到 API 密钥管理
4. 创建新的 API 密钥
5. 复制密钥并设置到环境变量中

### 智谱轻言

1. 访问 [智谱 AI 开放平台](https://open.bigmodel.cn/)
2. 注册账号并完成实名认证
3. 进入控制台，找到 API 密钥页面
4. 创建新的 API 密钥
5. 复制密钥并设置到环境变量中

## 功能特性

### ✅ 支持的功能
- 文本生成和对话
- 流式响应（实时输出）
- 系统指令设置
- 温度等生成参数调节
- Token 使用量统计（估算）
- 代理服务器支持

### ❌ 当前限制
- 暂不支持嵌入向量生成
- 部分模型不支持函数调用
- 视觉能力取决于具体模型

## 使用场景推荐

### 代码开发
```bash
# 使用 Qwen3-Coder 进行代码生成
SILICONFLOW_API_KEY="你的密钥" gemini --model "Qwen/Qwen3-Coder-480B-A35B-Instruct" "实现一个 React 组件用于显示用户列表"

# 使用 DeepSeek-R1 进行复杂推理
SILICONFLOW_API_KEY="你的密钥" gemini --model "deepseek-ai/DeepSeek-R1" "分析这个算法的时间复杂度并优化"
```

### 中文对话和理解
```bash
# 使用 GLM-4.5 进行中文对话（硅基流动版本）
SILICONFLOW_API_KEY="你的密钥" gemini --model "zai-org/GLM-4.5" "解释一下量子计算的基本原理"

# 使用 Kimi-K2 进行对话交互
SILICONFLOW_API_KEY="你的密钥" gemini --model "moonshotai/Kimi-K2-Instruct" "我想了解人工智能的发展历程"
```

### 高质量创作和写作
```bash
# 使用 GLM-4.5 进行高质量中文创作
ZHIPU_API_KEY="你的密钥" gemini --model glm-4.5 "帮我写一份产品发布会的演讲稿"

# 使用 GLM-4.5-Air 高性价比创作
ZHIPU_API_KEY="你的密钥" gemini --model glm-4.5-air "写一篇关于人工智能的科普文章"
```

### 实时对话和快速响应
```bash
# 使用 GLM-4.5-X 极速版进行实时翻译
ZHIPU_API_KEY="你的密钥" gemini --model glm-4.5-x "将以下中文实时翻译成英文"

# 使用 GLM-4.5-AirX 快速处理
ZHIPU_API_KEY="你的密钥" gemini --model glm-4.5-airx "快速回答这个问题"

# 使用免费的 GLM-4.5-Flash 进行日常对话
ZHIPU_API_KEY="你的密钥" gemini --model glm-4.5-flash "今天天气怎么样？"
```

### Claude AI 使用
```bash
# 使用 Claude Sonnet 4（默认）
OPENAI_COMPATIBLE_API_KEY="你的密钥" \
OPENAI_COMPATIBLE_BASE_URL="https://api.agicto.cn/v1" \
gemini "分析这段代码的逻辑"

# 使用 Claude Sonnet 4（最新版本）
OPENAI_COMPATIBLE_API_KEY="你的密钥" \
OPENAI_COMPATIBLE_BASE_URL="https://api.agicto.cn/v1" \
gemini --model "claude-sonnet-4-20250514" "写一个复杂的 Python 函数"

# 使用 Claude 3.7 Sonnet
OPENAI_COMPATIBLE_API_KEY="你的密钥" \
OPENAI_COMPATIBLE_BASE_URL="https://api.agicto.cn/v1" \
gemini --model "claude-3-7-sonnet-20250219" "解释这个算法的时间复杂度"

# 使用 Claude 3.5 Sonnet
OPENAI_COMPATIBLE_API_KEY="你的密钥" \
OPENAI_COMPATIBLE_BASE_URL="https://api.agicto.cn/v1" \
gemini --model "claude-3-5-sonnet-20241022" "翻译这段文本"
```

### 多语言翻译
```bash
# 使用 Qwen 进行翻译
SILICONFLOW_API_KEY="你的密钥" gemini --model "Qwen/Qwen2.5-72B-Instruct" "将以下英文翻译成中文"
```

## 故障排除

### 常见问题

1. **"找不到 API 密钥"错误**
   - 检查环境变量名称是否正确（区分大小写）
   - 确认密钥已正确设置
   - 重启终端后再试

2. **"未授权"错误**
   - 验证 API 密钥是否有效
   - 检查账户余额是否充足
   - 确认密钥权限设置正确

3. **"模型不存在"错误**
   - 检查模型名称拼写
   - 确认该模型在你的地区可用
   - 参考上方支持的模型列表

4. **连接错误**
   - 检查网络连接
   - 某些地区可能需要使用代理
   - 验证 API 端点 URL 是否正确

### 调试模式

启用调试模式查看详细的 API 请求信息：

```bash
DEBUG=1 gemini
```

## GLM-4.5 系列模型选择指南

### 🎯 按使用场景选择

| 使用场景 | 推荐模型 | 特点 | 上下文 |
|---------|---------|------|--------|
| **高质量创作** | `glm-4.5` | 性能最优，推理能力强 | 128K |
| **实时对话** | `glm-4.5-x` | 极速响应，适合助手 | 128K |
| **性价比优选** | `glm-4.5-air` | 同规模性能最佳 | 128K |
| **快速处理** | `glm-4.5-airx` | 速度快价格适中 | 128K |
| **免费体验** | `glm-4.5-flash` | 免费高质量模型 | 128K |

### 💰 成本效益对比

| 模型类型 | 响应速度 | 中文能力 | 推理能力 | 成本效益 |
|---------|----------|----------|----------|----------|
| GLM-4.5 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 💰💰💰💰 |
| GLM-4.5-X | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 💰💰💰💰 |
| GLM-4.5-Air | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 💰💰💰 |
| GLM-4.5-AirX | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | 💰💰 |
| GLM-4.5-Flash | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | 🆓 免费 |

## 技术支持

如果遇到问题，可以：

1. 查看 [GitHub Issues](https://github.com/google-gemini/gemini-cli/issues)
2. 参考官方文档
3. 在社区论坛提问
4. 联系对应供应商的技术支持
