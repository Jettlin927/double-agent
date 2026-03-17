import type {
  ToolDefinition,
  ToolHandler,
  ToolContext,
  ToolResult,
  WebSearchArgs,
  CodeExecutionArgs,
  AskOtherAgentArgs,
  SummarizeArgs,
  FactCheckArgs,
  CalculateArgs,
  MemoryArgs,
} from './types';

// Tool Registry - 管理所有可用工具
export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private handlers: Map<string, ToolHandler> = new Map();

  register(definition: ToolDefinition, handler: ToolHandler) {
    this.tools.set(definition.name, definition);
    this.handlers.set(definition.name, handler);
  }

  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  getToolsForAgent(_personality: 'gentle' | 'angry'): ToolDefinition[] {
    // 可以在这里根据Agent性格过滤工具
    return this.getAllTools();
  }

  async execute(
    toolName: string,
    args: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    const handler = this.handlers.get(toolName);
    if (!handler) {
      return {
        success: false,
        data: null,
        error: `Tool not found: ${toolName}`,
        executionTime: 0,
      };
    }

    const startTime = Date.now();
    try {
      const result = await handler(args, context);
      result.executionTime = Date.now() - startTime;
      return result;
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
      };
    }
  }

  // 生成工具描述的system prompt片段
  generateToolsPrompt(): string {
    const tools = this.getAllTools();
    if (tools.length === 0) return '';

    let prompt = '\n\n## 可用工具\n你可以使用以下工具来辅助讨论：\n\n';

    for (const tool of tools) {
      prompt += `### ${tool.name}\n`;
      prompt += `${tool.description}\n`;
      prompt += '参数：\n';
      for (const param of tool.parameters) {
        const required = param.required !== false ? '(必填)' : '(可选)';
        const enumValues = param.enum ? ` [可选值: ${param.enum.join(', ')}]` : '';
        prompt += `  - ${param.name}: ${param.type} ${required} - ${param.description}${enumValues}\n`;
      }
      prompt += '\n';
    }

    prompt += '\n## 如何使用工具\n';
    prompt += '当你需要使用工具时，请在回复中包含以下格式的JSON：\n';
    prompt += '```tool\n{\n  "tool": "工具名称",\n  "arguments": {\n    "参数名": "参数值"\n  }\n}\n```\n';
    prompt += '系统会执行工具并将结果返回给你。\n';

    return prompt;
  }
}

// 创建全局tool registry实例
export const toolRegistry = new ToolRegistry();

// ========== 内置工具实现 ==========

// 1. WebSearch - 模拟搜索（实际实现需要接入搜索引擎API）
const webSearchTool: ToolDefinition = {
  name: 'web_search',
  description: '搜索网络信息，获取最新数据和事实',
  parameters: [
    {
      name: 'query',
      type: 'string',
      description: '搜索关键词',
      required: true,
    },
    {
      name: 'limit',
      type: 'number',
      description: '返回结果数量（默认5）',
      required: false,
    },
  ],
};

const webSearchHandler: ToolHandler = async (args) => {
  const { query } = args as unknown as WebSearchArgs;

  // 注意：这里需要接入实际的搜索引擎API
  // 例如：SerpAPI, Bing Search API, Google Custom Search等

  // 模拟搜索结果
  return {
    success: true,
    data: {
      query,
      results: [
        {
          title: `搜索结果: ${query}`,
          snippet: '这是一个模拟的搜索结果。实际使用时需要配置搜索引擎API。',
          url: 'https://example.com',
        },
      ],
      note: '请配置SERP_API_KEY环境变量以使用真实搜索功能',
    },
    executionTime: 0,
  };
};

// 2. CodeExecution - 执行代码
const codeExecutionTool: ToolDefinition = {
  name: 'execute_code',
  description: '执行代码并返回结果，支持Python、JavaScript和Bash',
  parameters: [
    {
      name: 'language',
      type: 'string',
      description: '编程语言',
      required: true,
      enum: ['python', 'javascript', 'bash'],
    },
    {
      name: 'code',
      type: 'string',
      description: '要执行的代码',
      required: true,
    },
    {
      name: 'timeout',
      type: 'number',
      description: '超时时间（秒，默认30）',
      required: false,
    },
  ],
};

const codeExecutionHandler: ToolHandler = async (args) => {
  const { language, code } = args as unknown as CodeExecutionArgs;

  // 注意：实际实现需要安全的代码执行环境
  // 可以使用 WebContainer, Docker, 或沙箱环境

  return {
    success: true,
    data: {
      language,
      code,
      output: `[模拟输出] 执行了${language}代码\n\n实际使用时需要配置代码执行环境`,
      executed: false,
      note: '请配置安全的代码执行环境（如WebContainer）以使用此功能',
    },
    executionTime: 0,
  };
};

// 3. AskOtherAgent - 询问另一个Agent
const askOtherAgentTool: ToolDefinition = {
  name: 'ask_other_agent',
  description: '向另一个Agent提问，获取对方的观点或分析',
  parameters: [
    {
      name: 'question',
      type: 'string',
      description: '要问的问题',
      required: true,
    },
    {
      name: 'context',
      type: 'string',
      description: '额外的上下文信息',
      required: false,
    },
  ],
};

const askOtherAgentHandler: ToolHandler = async (args, context) => {
  const { question, context: extraContext } = args as unknown as AskOtherAgentArgs;

  if (!context.askOtherAgent) {
    return {
      success: false,
      data: null,
      error: '无法访问另一个Agent',
      executionTime: 0,
    };
  }

  const fullQuestion = extraContext
    ? `[上下文: ${extraContext}]\n\n${question}`
    : question;

  const response = await context.askOtherAgent(fullQuestion);

  return {
    success: true,
    data: {
      from: context.otherAgentName,
      question: fullQuestion,
      response,
    },
    executionTime: 0,
  };
};

// 4. Summarize - 总结对话
const summarizeTool: ToolDefinition = {
  name: 'summarize',
  description: '总结当前对话的要点和结论',
  parameters: [
    {
      name: 'format',
      type: 'string',
      description: '总结格式',
      required: true,
      enum: ['brief', 'detailed', 'bullet_points'],
    },
    {
      name: 'focus',
      type: 'string',
      description: '关注特定方面（如"分歧点"、"共识"、"行动项"）',
      required: false,
    },
  ],
};

const summarizeHandler: ToolHandler = async (args, context) => {
  const { format, focus } = args as unknown as SummarizeArgs;
  const history = context.getConversationHistory?.() || '';

  // 这里可以实现更复杂的总结逻辑
  // 或者将总结请求发送给LLM

  return {
    success: true,
    data: {
      format,
      focus: focus || 'general',
      historyLength: history.length,
      note: '总结功能需要接入LLM或实现本地总结算法',
    },
    executionTime: 0,
  };
};

// 5. FactCheck - 事实核查
const factCheckTool: ToolDefinition = {
  name: 'fact_check',
  description: '核查某个陈述的事实准确性',
  parameters: [
    {
      name: 'claim',
      type: 'string',
      description: '需要核查的陈述',
      required: true,
    },
    {
      name: 'evidence',
      type: 'string',
      description: '支持或反驳的证据',
      required: false,
    },
  ],
};

const factCheckHandler: ToolHandler = async (args) => {
  const { claim, evidence } = args as unknown as FactCheckArgs;

  // 实际实现可以：
  // 1. 使用web_search搜索相关信息
  // 2. 使用LLM分析陈述和证据
  // 3. 标记为"已验证"、"存疑"或"已证伪"

  return {
    success: true,
    data: {
      claim,
      evidence,
      status: 'pending',
      note: '事实核查需要接入搜索引擎和知识库',
    },
    executionTime: 0,
  };
};

// 6. Calculate - 精确计算
const calculateTool: ToolDefinition = {
  name: 'calculate',
  description: '执行数学计算，返回精确结果',
  parameters: [
    {
      name: 'expression',
      type: 'string',
      description: '数学表达式（如 "2 + 2 * 3" 或 "Math.sin(Math.PI/2)"）',
      required: true,
    },
  ],
};

const calculateHandler: ToolHandler = async (args) => {
  const { expression } = args as unknown as CalculateArgs;

  try {
    // 使用 Function 构造器安全地计算表达式
    // 注意：实际生产环境需要更安全的沙箱
    const sanitized = expression.replace(/[^0-9+\-*/().\sMath\w]/g, '');
    const result = new Function(`return ${sanitized}`)();

    return {
      success: true,
      data: {
        expression,
        result,
        type: typeof result,
      },
      executionTime: 0,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: `计算错误: ${error instanceof Error ? error.message : String(error)}`,
      executionTime: 0,
    };
  }
};

// 7. Memory - 记忆存储
const memoryTool: ToolDefinition = {
  name: 'memory',
  description: '存储或检索对话中的重要信息',
  parameters: [
    {
      name: 'action',
      type: 'string',
      description: '操作类型',
      required: true,
      enum: ['store', 'retrieve', 'list'],
    },
    {
      name: 'key',
      type: 'string',
      description: '记忆的键名',
      required: false,
    },
    {
      name: 'value',
      type: 'string',
      description: '要存储的值',
      required: false,
    },
    {
      name: 'category',
      type: 'string',
      description: '分类（如"fact", "decision", "action_item"）',
      required: false,
    },
  ],
};

// 简单的内存存储（实际应使用持久化存储）
const memoryStore: Map<string, { value: string; category: string; timestamp: number }> = new Map();

const memoryHandler: ToolHandler = async (args) => {
  const { action, key, value, category = 'general' } = args as unknown as MemoryArgs;

  switch (action) {
    case 'store':
      if (!key || !value) {
        return {
          success: false,
          data: null,
          error: 'store操作需要key和value',
          executionTime: 0,
        };
      }
      memoryStore.set(key, { value, category, timestamp: Date.now() });
      return {
        success: true,
        data: { action: 'stored', key, category },
        executionTime: 0,
      };

    case 'retrieve':
      if (!key) {
        return {
          success: false,
          data: null,
          error: 'retrieve操作需要key',
          executionTime: 0,
        };
      }
      const item = memoryStore.get(key);
      return {
        success: true,
        data: item || null,
        executionTime: 0,
      };

    case 'list':
      const items = Array.from(memoryStore.entries()).map(([k, v]) => ({
        key: k,
        ...v,
      }));
      return {
        success: true,
        data: category
          ? items.filter((i) => i.category === category)
          : items,
        executionTime: 0,
      };

    default:
      return {
        success: false,
        data: null,
        error: `未知的action: ${action}`,
        executionTime: 0,
      };
  }
};

// 注册所有内置工具
export function registerBuiltInTools() {
  toolRegistry.register(webSearchTool, webSearchHandler);
  toolRegistry.register(codeExecutionTool, codeExecutionHandler);
  toolRegistry.register(askOtherAgentTool, askOtherAgentHandler);
  toolRegistry.register(summarizeTool, summarizeHandler);
  toolRegistry.register(factCheckTool, factCheckHandler);
  toolRegistry.register(calculateTool, calculateHandler);
  toolRegistry.register(memoryTool, memoryHandler);

  console.log('[Tools] 已注册内置工具:', toolRegistry.getAllTools().map((t) => t.name).join(', '));
}
