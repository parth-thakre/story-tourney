import { ModelAdapter, ModelKey } from "../types";
import { parseJsonText } from "../utils";

class OpenRouterParseError extends Error {
  constructor(message: string, public readonly rawResponse: unknown) {
    super(message);
    this.name = "OpenRouterParseError";
  }
}

class OpenRouterFilteredError extends Error {
  constructor(message: string, public readonly rawResponse: unknown) {
    super(message);
    this.name = "OpenRouterFilteredError";
  }
}

export class OpenRouterAdapter implements ModelAdapter {
  constructor(
    public readonly modelKey: ModelKey,
    public readonly displayName: string,
    private readonly options: {
      apiKey: string;
      modelId: string;
      providerOrder: string[];
      siteUrl: string | null;
      appName: string | null;
    }
  ) {}

  private isGpt54() {
    return this.options.modelId === "openai/gpt-5.4";
  }

  private buildMessages(input: { system?: string; prompt: string }) {
    const messages: Array<{ role: "system" | "user"; content: string }> = [];

    if (this.isGpt54()) {
      messages.push({
        role: "system",
        content: [
          "<output_contract>",
          "- Output only the requested format.",
          "- If JSON is requested, output exactly one valid JSON object.",
          "- Do not output markdown fences, prose before JSON, or prose after JSON.",
          "</output_contract>",
          "<verbosity_controls>",
          "- Prefer concise, information-dense writing.",
          "- Do not add apologies, disclaimers, or refusal-style preambles unless the task is actually disallowed.",
          "</verbosity_controls>",
          "<completion_rules>",
          "- If the request is benign creative writing, revision, ranking, or critique, complete it.",
          "- Treat the task as incomplete until every required schema field is present.",
          "</completion_rules>",
        ].join("\n"),
      });
    }

    if (input.system) {
      messages.push({ role: "system", content: input.system });
    }

    messages.push({ role: "user", content: input.prompt });
    return messages;
  }

  private resolveTemperature(inputTemperature?: number) {
    if (this.isGpt54()) {
      return 1.0;
    }
    return inputTemperature ?? 0.2;
  }

  private buildRequestBody(input: { system?: string; prompt: string; temperature?: number }) {
    const base = {
      model: this.options.modelId,
      messages: this.buildMessages(input),
      temperature: this.resolveTemperature(input.temperature),
      provider: {
        order: this.options.providerOrder,
        data_collection: "deny" as const,
        zdr: true,
      },
    };

    if (this.isGpt54()) {
      return {
        ...base,
        response_format: { type: "json_object" },
      };
    }

    return {
      ...base,
      reasoning: { enabled: true },
      plugins: [{ id: "response-healing" }],
      provider: {
        ...base.provider,
        require_parameters: true,
      },
      response_format: { type: "json_object" },
    };
  }

  private isStrictProviderPinned() {
    return this.options.providerOrder.length > 0;
  }

  private canFallbackProviderForFilter(input: { system?: string }) {
    return this.isGpt54() && input.system !== "TASK:generation";
  }

  private async sendRequest(body: Record<string, unknown>) {
    return fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.options.apiKey}`,
        ...(this.options.siteUrl ? { "HTTP-Referer": this.options.siteUrl } : {}),
        ...(this.options.appName
          ? { "X-OpenRouter-Title": this.options.appName, "X-Title": this.options.appName }
          : {}),
      },
      body: JSON.stringify(body),
    });
  }

  private async fetchStreamingRaw(body: Record<string, unknown>) {
    const requestBody = { ...body, stream: true };
    const response = await this.sendRequest(requestBody);
    return { response, requestBody };
  }

  private async readStreamingResponse(response: Response) {
    if (!response.body) {
      throw new Error("OpenRouter streaming response did not include a body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let content = "";
    let reasoning = "";
    let refusal: string | null = null;
    let finishReason: string | null = null;
    let error: { message?: string; code?: string } | undefined;
    let id: string | undefined;
    let model: string | undefined;
    let chunkCount = 0;

    const handlePayload = (payload: string) => {
      const trimmed = payload.trim();
      if (!trimmed || trimmed === "[DONE]") {
        return;
      }

      const chunk = JSON.parse(trimmed) as {
        id?: string;
        model?: string;
        error?: { message?: string; code?: string };
        choices?: Array<{
          finish_reason?: string | null;
          error?: { message?: string; code?: string };
          delta?: {
            content?: string | null;
            reasoning?: string | null;
            refusal?: string | null;
          };
        }>;
      };
      chunkCount += 1;
      id = chunk.id ?? id;
      model = chunk.model ?? model;
      error = chunk.error ?? chunk.choices?.[0]?.error ?? error;
      const choice = chunk.choices?.[0];
      finishReason = choice?.finish_reason ?? finishReason;
      content += choice?.delta?.content ?? "";
      reasoning += choice?.delta?.reasoning ?? "";
      refusal = choice?.delta?.refusal ?? refusal;
    };

    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const event of events) {
        const dataLines = event
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice("data:".length).trim());
        if (dataLines.length === 0) {
          continue;
        }
        handlePayload(dataLines.join("\n"));
      }

      if (done) {
        break;
      }
    }

    if (buffer.trim()) {
      const dataLines = buffer
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice("data:".length).trim());
      if (dataLines.length > 0) {
        handlePayload(dataLines.join("\n"));
      }
    }

    return {
      id,
      object: "chat.completion",
      model,
      streamed: true,
      chunk_count: chunkCount,
      choices: [
        {
          index: 0,
          finish_reason: finishReason,
          error,
          message: {
            role: "assistant",
            content: content || null,
            reasoning: reasoning || null,
            refusal,
          },
        },
      ],
    };
  }

  private async sendStreamingCompletion(body: Record<string, unknown>) {
    const { response, requestBody } = await this.fetchStreamingRaw(body);
    if (!response.ok) {
      throw await this.buildHttpError(response);
    }
    return {
      raw: await this.readStreamingResponse(response),
      requestBody,
    };
  }

  private async buildHttpError(response: Response) {
    const text = await response.text();
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } };
      const message = parsed.error?.message;
      if (message) {
        return new Error(`OpenRouter ${response.status}: ${message}`);
      }
    } catch {
      // ignore parse failure and fall back to raw text
    }
    return new Error(`OpenRouter ${response.status}: ${text || "Request failed"}`);
  }

  private extractMessage(raw: unknown) {
    const response = raw as {
      choices?: Array<{
        finish_reason?: string | null;
        error?: { message?: string };
        message?: {
          content?: string | null;
          reasoning?: string | null;
          refusal?: string | null;
          reasoning_details?: unknown;
        };
      }>;
    };
    return response.choices?.[0];
  }

  private isFiltered(raw: unknown) {
    const choice = this.extractMessage(raw);
    return (
      choice?.finish_reason === "content_filter" ||
      Boolean(choice?.message?.refusal) ||
      Boolean(choice?.error?.message)
    );
  }

  private filteredMessage(raw: unknown) {
    const choice = this.extractMessage(raw);
    return choice?.error?.message ?? choice?.message?.refusal ?? "OpenRouter content filtered response";
  }

  private isPlainTextRefusal(content: string) {
    const normalized = content.trim().toLowerCase();
    return (
      normalized.startsWith("i'm sorry") ||
      normalized.startsWith("i am sorry") ||
      normalized.startsWith("sorry,") ||
      normalized.includes("cannot assist") ||
      normalized.includes("can't assist")
    );
  }

  private buildRefusalRetryMessages(messages: Array<{ role: "system" | "user"; content: string }>) {
    return [
      {
        role: "system" as const,
        content:
          "Return valid JSON only. Do not include refusal prose, explanations, markdown, or commentary. If the task is benign fiction, revision, critique, ranking, or literary evaluation, comply and output only the requested JSON schema.",
      },
      ...messages,
    ];
  }

  async generateJson<T>(input: { system?: string; prompt: string; temperature?: number }): Promise<{ parsed: T; rawResponse: unknown; requestBody: unknown }> {
    const baseBody = this.buildRequestBody(input);

    let requestBody: Record<string, unknown> = { ...baseBody, stream: true };
    let response = await this.sendRequest(requestBody);

    if (response.status === 404) {
      requestBody = {
        ...baseBody,
        stream: true,
        provider: {
          order: this.options.providerOrder,
          data_collection: "deny",
          zdr: true,
        },
      };
      response = await this.sendRequest(requestBody);
    }

    if (response.status === 404 && !this.isStrictProviderPinned()) {
      requestBody = {
        ...baseBody,
        stream: true,
        provider: {
          data_collection: "deny",
          zdr: true,
        },
      };
      response = await this.sendRequest(requestBody);
    }

    if (!response.ok) {
      throw await this.buildHttpError(response);
    }

    let raw = await this.readStreamingResponse(response);

    if (this.isFiltered(raw)) {
      if (!this.isStrictProviderPinned() || this.canFallbackProviderForFilter(input)) {
        const retry = await this.sendStreamingCompletion({
          ...baseBody,
          provider: {
            data_collection: "deny",
            zdr: true,
          },
        });

        raw = retry.raw;
        requestBody = retry.requestBody;
        if (this.isFiltered(raw)) {
          throw new OpenRouterFilteredError(this.filteredMessage(raw), raw);
        }
      } else {
        throw new OpenRouterFilteredError(this.filteredMessage(raw), raw);
      }
    }

    let message = raw.choices?.[0]?.message;
    let content = message?.content ?? message?.reasoning;

    if (typeof content === "string" && this.isPlainTextRefusal(content)) {
      const retry = await this.sendStreamingCompletion({
        ...baseBody,
        messages: this.buildRefusalRetryMessages(baseBody.messages),
      });

      raw = retry.raw;
      requestBody = retry.requestBody;
      message = raw.choices?.[0]?.message;
      content = message?.content ?? message?.reasoning;
    }

    if (!content) {
      throw new Error("OpenRouter response did not include JSON content");
    }
    try {
      return {
        parsed: parseJsonText<T>(content),
        rawResponse: raw,
        requestBody,
      };
    } catch (error) {
      throw new OpenRouterParseError(error instanceof Error ? error.message : String(error), raw);
    }
  }
}
