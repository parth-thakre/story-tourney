"use client";

import type { ProviderCall } from "@/types";

interface DevDrawerProps {
  call: ProviderCall;
}

export default function DevDrawer({ call }: DevDrawerProps) {
  let parsedRequest: string = call.requestJson;
  let parsedResponse: string | null = call.responseJson;

  try {
    parsedRequest = JSON.stringify(JSON.parse(call.requestJson), null, 2);
  } catch {}

  if (parsedResponse) {
    try {
      parsedResponse = JSON.stringify(JSON.parse(parsedResponse), null, 2);
    } catch {}
  }

  return (
    <div className="mt-1 p-3 rounded-md bg-zinc-950/80 border border-zinc-800/50 text-xs font-mono">
      <div className="flex flex-col gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-zinc-500 uppercase tracking-wider">Phase</span>
            <span className="text-zinc-400">{call.phase}</span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-500 uppercase tracking-wider">Attempt</span>
            <span className="text-zinc-400">{call.attempt}</span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-500 uppercase tracking-wider">Status</span>
            <span className={call.status === "succeeded" ? "text-emerald-400" : call.status === "failed" ? "text-red-400" : "text-zinc-400"}>
              {call.status}
            </span>
          </div>
        </div>
        <div>
          <span className="text-zinc-500 uppercase tracking-wider">Prompt</span>
          <pre className="mt-1 text-zinc-400 whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
            {parsedRequest}
          </pre>
        </div>
        {parsedResponse && (
          <div>
            <span className="text-zinc-500 uppercase tracking-wider">Response</span>
            <pre className="mt-1 text-zinc-400 whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
              {parsedResponse}
            </pre>
          </div>
        )}
        {call.error && (
          <div>
            <span className="text-red-500 uppercase tracking-wider">Error</span>
            <pre className="mt-1 text-red-400 whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
              {call.error}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}