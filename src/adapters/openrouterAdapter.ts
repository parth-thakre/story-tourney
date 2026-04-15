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

    let response = await this.sendRequest(baseBody);

    if (response.status === 404) {
      response = await this.sendRequest({
        ...baseBody,
        provider: {
          order: this.options.providerOrder,
          data_collection: "deny",
          zdr: true,
        },
      });
    }

    if (response.status === 404 && !this.isStrictProviderPinned()) {
      response = await this.sendRequest({
        ...baseBody,
        provider: {
          data_collection: "deny",
          zdr: true,
        },
      });
    }

    if (!response.ok) {
      throw await this.buildHttpError(response);
    }

    let raw = await response.json();

    if (this.isFiltered(raw)) {
      if (!this.isStrictProviderPinned() || this.canFallbackProviderForFilter(input)) {
        const retryResponse = await this.sendRequest({
          ...baseBody,
          provider: {
            data_collection: "deny",
            zdr: true,
          },
        });

        if (!retryResponse.ok) {
          throw new OpenRouterFilteredError(this.filteredMessage(raw), raw);
        }

        raw = await retryResponse.json();
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
      const retryResponse = await this.sendRequest({
        ...baseBody,
        messages: this.buildRefusalRetryMessages(baseBody.messages),
      });

      if (!retryResponse.ok) {
        throw await this.buildHttpError(retryResponse);
      }

      raw = await retryResponse.json();
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
        requestBody: baseBody,
      };
    } catch (error) {
      throw new OpenRouterParseError(error instanceof Error ? error.message : String(error), raw);
    }
  }
}
