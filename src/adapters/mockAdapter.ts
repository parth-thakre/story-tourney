import { ModelAdapter, ModelKey } from "../types";
import { stableHash, wordCount } from "../utils";
import { GenerationOutput, RankingOutput, ReviewOutput, RevisionOutput } from "../validation";

function splitPrompt(prompt: string) {
  return prompt.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
}

function titleCase(text: string) {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function extractTask(system?: string) {
  const match = system?.match(/TASK:(generation|review|revision|ranking)/i);
  return match?.[1].toLowerCase() ?? "generation";
}

function pickSentence(seed: number, options: string[]) {
  return options[seed % options.length];
}

function buildStory(prompt: string, modelKey: string, extra: string) {
  const words = splitPrompt(prompt);
  const focus = words.slice(0, 6).join(" ") || prompt;
  const tone = pickSentence(stableHash(`${modelKey}:${prompt}`), [
    "quietly lyrical",
    "tight and cinematic",
    "wistful and intimate",
    "lean and urgent",
  ]);
  return [
    `The story opens on a world shaped by ${focus}.`,
    `Its center is a character who keeps moving forward even as the smallest choices begin to echo.`,
    `The atmosphere stays ${tone}, with images that keep circling back to the prompt's core tension.`,
    extra,
    `By the end, the piece resolves with a clear emotional turn rather than a neat answer.`,
  ].join(" ");
}

function mockGeneration(modelKey: string, prompt: string): GenerationOutput {
  const titleSeed = stableHash(`${modelKey}:${prompt}:title`);
  const body = buildStory(
    prompt,
    modelKey,
    `A turning-point scene forces the protagonist to choose between comfort and consequence.`
  );
  return {
    title: titleCase(`${splitPrompt(prompt).slice(0, 3).join(" ")} ${modelKey}`.trim()) || `Story ${titleSeed % 1000}`,
    story: body,
    word_count_estimate: wordCount(body),
    author_note: `I emphasized ${pickSentence(titleSeed, [
      "internal conflict and delayed revelation",
      "atmosphere and consequence",
      "character pressure and a decisive ending",
      "small details that accumulate into a larger turn",
    ])}.`,
  };
}

function scoreFromHash(seed: number, offset: number) {
  return 4 + ((seed + offset) % 6);
}

function reviewLabelScore(label: string, story: string, reviewer: string) {
  return stableHash(`${label}:${story}:${reviewer}`);
}

function mockReview(prompt: string): ReviewOutput {
  const storyEntries = prompt.match(/Story \d+:\nTitle:[\s\S]*?(?=\n\nStory \d+:|$)/g) ?? [];
  const reviews = storyEntries.map((entry, index) => {
    const label = `Story ${index + 1}`;
    const scoreSeed = reviewLabelScore(label, entry, prompt);
    const strengths = [
      pickSentence(scoreSeed, [
        "Strong narrative momentum.",
        "A clear emotional spine.",
        "Vivid image choices.",
        "Confident scene construction.",
      ]),
      pickSentence(scoreSeed + 11, [
        "The central conflict is easy to follow.",
        "The prose has a controlled rhythm.",
        "The ending lands cleanly.",
        "The premise has real staying power.",
      ]),
    ];
    const weaknesses = [
      pickSentence(scoreSeed + 19, [
        "The middle could tighten its transitions.",
        "One emotional beat needs more room.",
        "A few details feel generic.",
        "The payoff arrives a little too quickly.",
      ]),
      pickSentence(scoreSeed + 31, [
        "The final image could be sharper.",
        "Some dialogue is functional rather than memorable.",
        "The setup could do more atmospheric work.",
        "The stakes could be clarified earlier.",
      ]),
    ];
    return {
      story_label: label,
      scores: {
        prompt_fit: scoreFromHash(scoreSeed, 1),
        originality: scoreFromHash(scoreSeed, 2),
        coherence: scoreFromHash(scoreSeed, 3),
        prose: scoreFromHash(scoreSeed, 4),
        emotional_impact: scoreFromHash(scoreSeed, 5),
      },
      strengths,
      weaknesses,
      revision_suggestion: pickSentence(scoreSeed + 41, [
        "Rework the second half so the protagonist's choice feels less pre-decided.",
        "Give the ending one extra beat of sensory specificity.",
        "Collapse a few explanatory lines and let the scene carry more weight.",
        "Sharpen the character's central desire in the opening paragraph.",
      ]),
      overall_comment: pickSentence(scoreSeed + 53, [
        "Competent and readable, with room to sharpen the distinctive voice.",
        "This has a strong core and only needs tighter execution.",
        "The piece is already working; the revision should focus on precision.",
        "A promising draft with enough cohesion to reward a focused pass.",
      ]),
    };
  });
  return { reviews };
}

function mockRevision(prompt: string): RevisionOutput {
  const seed = stableHash(prompt);
  const shouldRevise = (seed % 3) !== 0;
  if (!shouldRevise) {
    return {
      should_revise: false,
      title: pickSentence(seed, [
        "A Better Way Home",
        "What the Dark Keeps",
        "The Last Quiet Hour",
        "The Shape of Leaving",
      ]),
      story: buildStory(
        prompt,
        "revision",
        "The original version already carries the piece effectively, so the revision makes no substantive changes."
      ),
      word_count_estimate: wordCount(prompt),
      change_summary: "No changes made. The original version already best serves the prompt.",
    };
  }
  return {
    should_revise: true,
    title: titleCase(pickSentence(seed, [
      "A Better Way Home",
      "What the Dark Keeps",
      "The Last Quiet Hour",
      "The Shape of Leaving",
    ])),
    story: buildStory(
      prompt,
      "revision",
      "The revised version gives the central conflict more breathing room and ends on a firmer emotional image."
    ),
    word_count_estimate: wordCount(prompt) + 180,
    change_summary: pickSentence(seed + 9, [
      "The revision sharpens the opening, trims the middle, and gives the ending a more resonant final image.",
      "I leaned harder into the central conflict, clarified the character's motivation, and strengthened the closing beat.",
      "The new pass reduces repetition, improves scene transitions, and restores a stronger emotional arc.",
      "This version keeps the original premise but rebalances the pacing and makes the ending land with more force.",
    ]),
  };
}

function mockRanking(prompt: string): RankingOutput {
  const seed = stableHash(prompt);
  const labels = prompt
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => /^Story \d+:$/.test(line))
    .map((line) => line.slice(0, -1));
  const sorted = [...labels].sort((a, b) => stableHash(`${seed}:${a}`) - stableHash(`${seed}:${b}`));
  const ranking = sorted.map((label, index) => ({
    story_label: label,
    rank: index + 1,
    justification: pickSentence(seed + index * 7, [
      "Best balance of voice, momentum, and emotional payoff.",
      "The cleanest execution and strongest control of tone.",
      "Good ideas, but the story loses some force in the middle.",
      "The premise is clear, but the writing is less vivid than the others.",
    ]),
  }));

  return {
    ranking,
    winner_callout: `The top pick is the story that feels most complete and emotionally sure-footed in this round.`,
  };
}

export class MockModelAdapter implements ModelAdapter {
  constructor(
    public readonly modelKey: ModelKey,
    public readonly displayName: string,
  ) {}

  async generateJson<T>(input: { system?: string; prompt: string; temperature?: number }): Promise<{ parsed: T; rawResponse: unknown; requestBody: unknown }> {
    const task = extractTask(input.system);
    const payload = (() => {
      if (task === "review") {
        return mockReview(input.prompt);
      }
      if (task === "revision") {
        return mockRevision(input.prompt);
      }
      if (task === "ranking") {
        return mockRanking(input.prompt);
      }
      return mockGeneration(this.modelKey, input.prompt);
    })();

    return {
      parsed: payload as T,
      rawResponse: payload,
      requestBody: {
        system: input.system,
        prompt: input.prompt,
        temperature: input.temperature,
      },
    };
  }
}
