from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Probe OpenRouter GPT 5.4 request shapes"
    )
    parser.add_argument("--model", default="openai/gpt-5.4")
    parser.add_argument(
        "--provider-order",
        default="azure",
        help="Comma-separated provider order, or empty for none",
    )
    parser.add_argument("--require-parameters", action="store_true")
    parser.add_argument("--data-collection", default="deny")
    parser.add_argument("--zdr", action="store_true")
    parser.add_argument("--reasoning", action="store_true")
    parser.add_argument("--json-mode", action="store_true")
    parser.add_argument("--temperature", type=float, default=None)
    parser.add_argument("--system", default=None)
    parser.add_argument("--prompt", default='Return valid JSON only: {"ok": true}')
    parser.add_argument("--prompt-file", default=None)
    parser.add_argument("--continue-reasoning", action="store_true")
    parser.add_argument("--dump-request", action="store_true")
    return parser


def make_client() -> OpenAI:
    repo_root = Path(__file__).resolve().parent.parent
    load_dotenv(repo_root / ".env")
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise SystemExit("OPENROUTER_API_KEY missing")
    return OpenAI(base_url="https://openrouter.ai/api/v1", api_key=api_key)


def build_messages(system: str | None, prompt: str) -> list[dict[str, object]]:
    messages: list[dict[str, object]] = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    return messages


def build_extra_body(args: argparse.Namespace) -> dict[str, object]:
    extra_body: dict[str, object] = {}
    provider: dict[str, object] = {}

    provider_order = [
        value.strip() for value in args.provider_order.split(",") if value.strip()
    ]
    if provider_order:
        provider["order"] = provider_order

    if args.require_parameters:
        provider["require_parameters"] = True

    if args.data_collection:
        provider["data_collection"] = args.data_collection

    if args.zdr:
        provider["zdr"] = True

    if provider:
        extra_body["provider"] = provider

    if args.reasoning:
        extra_body["reasoning"] = {"enabled": True}

    if args.json_mode:
        extra_body["response_format"] = {"type": "json_object"}

    return extra_body


def main() -> int:
    args = build_parser().parse_args()
    client = make_client()
    prompt = (
        Path(args.prompt_file).read_text(encoding="utf8")
        if args.prompt_file
        else args.prompt
    )
    messages = build_messages(args.system, prompt)
    extra_body = build_extra_body(args)

    request: dict[str, object] = {
        "model": args.model,
        "messages": messages,
    }

    if args.temperature is not None:
        request["temperature"] = args.temperature

    if extra_body:
        request["extra_body"] = extra_body

    if args.dump_request:
        print("REQUEST")
        print(json.dumps(request, indent=2))

    try:
        response = client.chat.completions.create(**request)
    except Exception as error:
        print(f"ERROR: {error}")
        return 1

    message = response.choices[0].message
    print("FIRST_RESPONSE")
    print(json.dumps(response.model_dump(), indent=2))

    if not args.continue_reasoning:
        return 0

    continued_messages = [
        *messages,
        {
            "role": "assistant",
            "content": message.content,
            "reasoning_details": message.reasoning_details,
        },
        {"role": "user", "content": "Are you sure? Think carefully."},
    ]

    continue_request: dict[str, object] = {
        "model": args.model,
        "messages": continued_messages,
    }

    if args.temperature is not None:
        continue_request["temperature"] = args.temperature

    if extra_body:
        continue_request["extra_body"] = extra_body

    if args.dump_request:
        print("CONTINUE_REQUEST")
        print(json.dumps(continue_request, indent=2))

    try:
        response2 = client.chat.completions.create(**continue_request)
    except Exception as error:
        print(f"CONTINUE_ERROR: {error}")
        return 1

    print("SECOND_RESPONSE")
    print(json.dumps(response2.model_dump(), indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
