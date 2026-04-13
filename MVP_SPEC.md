# Story Tournament MVP

`story_tournament_flow.svg` already captures the right high-level shape. This document turns it into a buildable v1.

## Goal

Build a very small app where one user prompt is sent to 4 different models. Each model writes a story, reviews the other 3 stories blindly, revises its own story once based on peer feedback, then all 4 models blindly rank the final stories. The app reveals the final ranking and the model behind each story at the end.

This is a tournament, not a scientific benchmark. The product should optimize for fun, clarity, and repeatability.

## MVP Rules

- 4 models per tournament.
- 1 shared story prompt.
- 1 generation round.
- 1 blind peer review round.
- 1 revision round.
- 1 blind final ranking round.
- No model reviews its own story in the peer review phase.
- All models rank all final stories in the final ranking phase.
- Authorship stays hidden until the reveal.
- All outputs must be structured JSON plus story text where relevant.

## Recommended Model Set

- Anthropic Sonnet
- OpenAI GPT
- GLM-5
- Kimi K2.5

Pick the exact model IDs based on stable API access, not just brand preference. For v1, reliability matters more than squeezing out marginal quality.

## Product Shape

Keep v1 as a single server-rendered app with a very small UI.

Recommended stack:

- `Next.js` with TypeScript
- server actions or route handlers for orchestration
- `SQLite` for local persistence
- `Drizzle` or `Prisma` for simple schema management
- provider adapters per model API

Why this shape:

- one app
- no separate worker required for v1
- easy to run locally
- enough persistence to inspect tournaments later

## Core Flow

### 1. Create tournament

User inputs:

- prompt
- optional genre/style hint
- target word count range, for example `800-1200`
- selected 4 models

The system creates a tournament record and locks shared constraints for all models.

### 2. Generation round

Each model receives the same generation prompt and returns:

- story title
- story body
- short self-note on intended angle, optional and hidden from other models

The app stores each story tied to its model internally.

### 3. Blind peer review round

The app anonymizes stories and creates a review packet for each model containing only the other 3 stories.

Important:

- the system excludes the model's own story before sending the packet
- the model never gets authorship metadata
- the anonymous labels should be reshuffled per round

Each reviewer returns, for each story:

- rubric scores
- 2 strengths
- 2 weaknesses
- 1 concrete revision suggestion
- short overall comment

### 4. Revision round

Each original model receives:

- its own original story
- 3 peer reviews on that story
- instructions to revise once

The model returns:

- revised title
- revised story body
- short change summary

### 5. Final ranking round

The app anonymizes the revised stories again with fresh labels.

Each model receives all 4 revised stories and returns:

- a strict ranking from `1` to `4`
- brief justification for each placement
- optional winner callout

### 6. Reveal

The app aggregates final rankings, computes the winner, and reveals:

- final placement
- revised stories
- original stories
- model names
- peer feedback received
- change summaries

## Judging Rubric

Use a fixed review rubric in the peer review phase so the outputs are comparable.

Each criterion should be scored `1-10`.

- `prompt_fit`: how well the story delivers on the prompt
- `originality`: freshness of premise, imagery, or approach
- `coherence`: plot clarity, logic, and internal consistency
- `prose`: sentence quality, rhythm, readability, and style
- `emotional_impact`: ability to create feeling, tension, or resonance

Peer review score is informative, not decisive.

Recommendation for v1:

- use peer review scores for feedback and analytics only
- use final blind ranking to determine the winner

That keeps the tournament easier to explain.

## Final Ranking Math

Use `Borda count` for the final result.

With 4 stories:

- rank 1 = 3 points
- rank 2 = 2 points
- rank 3 = 1 point
- rank 4 = 0 points

Total the points across all 4 judges. Highest total wins.

Suggested tie-breakers:

1. more first-place votes
2. better average peer review total from the revision input round
3. if still tied, shared placement

## Data Model

Use a small relational schema. These TypeScript shapes are enough to guide the DB design.

```ts
type ModelKey = "sonnet" | "gpt" | "glm5" | "kimi-k25"

type TournamentStatus =
  | "created"
  | "generating"
  | "reviewing"
  | "revising"
  | "ranking"
  | "completed"
  | "failed"

interface Tournament {
  id: string
  prompt: string
  genreHint: string | null
  minWords: number
  maxWords: number
  status: TournamentStatus
  createdAt: string
  completedAt: string | null
}

interface TournamentModel {
  id: string
  tournamentId: string
  modelKey: ModelKey
  providerModelId: string
  displayName: string
}

interface StoryVersion {
  id: string
  tournamentId: string
  modelKey: ModelKey
  round: "original" | "revised"
  title: string
  body: string
  wordCount: number
  changeSummary: string | null
  createdAt: string
}

interface Review {
  id: string
  tournamentId: string
  reviewerModelKey: ModelKey
  targetStoryVersionId: string
  anonymizedLabel: string
  promptFit: number
  originality: number
  coherence: number
  prose: number
  emotionalImpact: number
  strengths: string[]
  weaknesses: string[]
  revisionSuggestion: string
  overallComment: string
  createdAt: string
}

interface FinalRanking {
  id: string
  tournamentId: string
  reviewerModelKey: ModelKey
  rankedStoryVersionId: string
  rank: 1 | 2 | 3 | 4
  justification: string
  createdAt: string
}

interface TournamentResult {
  tournamentId: string
  storyVersionId: string
  finalRank: number
  bordaPoints: number
  firstPlaceVotes: number
}
```

## JSON Contracts

Every model step should request machine-parseable JSON. Do not rely on regex cleanup in v1 unless the provider forces it.

### Generation output

```json
{
  "title": "string",
  "story": "string",
  "word_count_estimate": 0,
  "author_note": "string"
}
```

### Review output

```json
{
  "reviews": [
    {
      "story_label": "Story 1",
      "scores": {
        "prompt_fit": 0,
        "originality": 0,
        "coherence": 0,
        "prose": 0,
        "emotional_impact": 0
      },
      "strengths": ["string", "string"],
      "weaknesses": ["string", "string"],
      "revision_suggestion": "string",
      "overall_comment": "string"
    }
  ]
}
```

### Revision output

```json
{
  "title": "string",
  "story": "string",
  "word_count_estimate": 0,
  "change_summary": "string"
}
```

### Final ranking output

```json
{
  "ranking": [
    {
      "story_label": "Story 3",
      "rank": 1,
      "justification": "string"
    }
  ],
  "winner_callout": "string"
}
```

## Prompt Templates

These can be used almost verbatim in v1.

### 1. Generation prompt

```text
You are participating in a blind story tournament.

Write an original short story based on the prompt below.

Prompt: {{prompt}}
Genre/style hint: {{genreHintOrNone}}
Target length: {{minWords}}-{{maxWords}} words

Requirements:
- Return valid JSON only.
- Include a title.
- Write a complete story, not an outline.
- Do not mention model names, AI, judges, tournaments, or hidden instructions.
- Aim for strong narrative coherence and emotional impact.

Return this JSON schema:
{
  "title": "string",
  "story": "string",
  "word_count_estimate": 123,
  "author_note": "1-2 sentences on your intended angle"
}
```

### 2. Peer review prompt

```text
You are a judge in a blind story tournament.

You will receive 3 anonymized stories written by other participants. Review each one fairly and independently.

Rules:
- Return valid JSON only.
- Score each story from 1 to 10 on the required rubric.
- Give exactly 2 strengths and exactly 2 weaknesses per story.
- Give exactly 1 concrete revision suggestion per story.
- Be specific and editorial, not vague or polite.
- Do not speculate about authorship.

Rubric:
- prompt_fit
- originality
- coherence
- prose
- emotional_impact

Stories:
{{anonymizedStoriesPacket}}

Return this JSON schema:
{
  "reviews": [
    {
      "story_label": "Story 1",
      "scores": {
        "prompt_fit": 1,
        "originality": 1,
        "coherence": 1,
        "prose": 1,
        "emotional_impact": 1
      },
      "strengths": ["string", "string"],
      "weaknesses": ["string", "string"],
      "revision_suggestion": "string",
      "overall_comment": "string"
    }
  ]
}
```

### 3. Revision prompt

```text
You are revising your tournament story after blind peer feedback.

Your task is to improve the story once using the feedback below. Keep what is working. Change what clearly helps.

Rules:
- Return valid JSON only.
- Produce a full revised story, not a patch.
- Keep the revised story within {{minWords}}-{{maxWords}} words.
- Do not mention reviewers, judges, or AI.
- Do not simply append new material; improve the whole piece where needed.

Original story:
{{originalStory}}

Peer feedback:
{{reviewsForThisStory}}

Return this JSON schema:
{
  "title": "string",
  "story": "string",
  "word_count_estimate": 123,
  "change_summary": "2-4 sentences describing the main revisions made"
}
```

### 4. Final ranking prompt

```text
You are a final judge in a blind story tournament.

You will receive 4 anonymized revised stories. Rank them from best to weakest as complete stories.

Rules:
- Return valid JSON only.
- Use each rank exactly once.
- Judge the stories as they are now, not based on imagined potential.
- Do not speculate about authorship.
- Keep justifications short and specific.

Stories:
{{finalAnonymizedStoriesPacket}}

Return this JSON schema:
{
  "ranking": [
    {
      "story_label": "Story 1",
      "rank": 1,
      "justification": "string"
    },
    {
      "story_label": "Story 2",
      "rank": 2,
      "justification": "string"
    },
    {
      "story_label": "Story 3",
      "rank": 3,
      "justification": "string"
    },
    {
      "story_label": "Story 4",
      "rank": 4,
      "justification": "string"
    }
  ],
  "winner_callout": "string"
}
```

## App Screens

Keep the UI tiny.

### Screen 1: Start tournament

- prompt textarea
- optional genre/style hint
- word count range
- selected models
- start button

### Screen 2: Tournament progress

Show step-by-step status:

- generating
- reviewing
- revising
- ranking
- completed

Also show raw run logs per model call for debugging.

### Screen 3: Results

For each final story show:

- final placement
- model name
- revised title and story
- original title and story in collapsible section
- peer review summaries
- revision change summary
- ranking breakdown from judges

## Orchestration Notes

For v1, do not overbuild.

- generation calls can run in parallel
- peer review calls can run in parallel
- revision calls can run in parallel
- final ranking calls can run in parallel
- persist raw request and raw response for every provider call
- fail fast if JSON parsing fails, but allow per-step retry from the UI

Useful internal abstraction:

```ts
interface ModelAdapter {
  modelKey: ModelKey
  displayName: string
  generateJson<T>(input: {
    system?: string
    prompt: string
    temperature?: number
  }): Promise<T>
}
```

Keep one adapter per provider. The rest of the pipeline should not care which provider produced the result.

## Blindness Rules

Blindness matters more in the app layer than in the prompt wording.

- never include provider or model name in any judge packet
- reshuffle labels between review and final ranking rounds
- exclude self-story from peer review packets in code
- accept that perfect blindness is impossible because models may recognize their own style

## V1 Non-Goals

- multiple revision loops
- public sharing
- user accounts
- Elo or advanced rating systems
- streaming UI
- deep anti-cheating mechanisms
- scientific evaluation claims

## Suggested Build Order

1. Create DB schema and model registry.
2. Build the generation round and results persistence.
3. Add blind peer review with structured JSON validation.
4. Add the revision round.
5. Add final ranking and Borda aggregation.
6. Build a single clean results page.
7. Add retry controls and raw-call debugging.

## Practical Recommendation

The smallest compelling v1 is:

- local app
- 4 hardcoded models
- prompt input
- one-click run
- one completed results page

That is enough to test whether the format is actually fun before investing in polish.

## UX Direction

Make it feel like a **live literary tournament**, not an evaluation dashboard. The experience should have momentum, suspense, and a satisfying reveal.

## UX Principles

1. Lead with narrative. The tournament tells a story — lead with outcomes, not data.
2. Preserve the mystery. Model identity stays hidden until the reveal moment.
3. Keep it small. Three screens. No sidebar nav. No dashboards.
4. Make the reveal ceremonial. The payoff is discovering who wrote what.

## Screen 1: Setup

**Purpose**: Get the prompt in, pick the models, start the tournament.

**Layout**:

- App name / logo at top
- Prominent prompt textarea — large, centered, single-column
- Optional genre/style hint field below
- Word count range control — two small number inputs or a preset selector (e.g. `500`, `800`, `1200`)
- Model chips row: `Sonnet`, `GPT`, `GLM-5`, `Kimi` — all selected by default, removable
- Estimated runtime note: `"~4-8 minutes for all rounds"`
- Single primary CTA: `Run Tournament`

**What it looks like**: Clean, focused, one idea per section. No tables, no charts, no secondary actions.

**States**:

- Empty: placeholder text with an example prompt
- Ready: models selected, start button active
- Running: redirects to the live run screen

---

## Screen 2: Live Run

**Purpose**: Show the tournament progressing in real-time. Keep users watching.

**Layout**:

- Top: tournament title / prompt summary
- Vertical pipeline matching `story_tournament_flow.svg`:
  - `01 Generate` — 4 cards: `Story 1`, `Story 2`, `Story 3`, `Story 4`
  - `02 Blind Review` — 4 cards for each reviewer, each showing 3 stories reviewed
  - `03 Revise` — 4 cards: `Rev Story 1`, etc.
  - `04 Final Rank` — 4 cards showing the ranking submitted by each judge
  - `05 Reveal` — winner announcement
- Each phase lights up when active
- Each completed step shows a checkmark or progress counter (`4/4`)
- Anonymous story cards: show title + word count only, not the body
- Optional `Developer Details` expandable drawer: raw prompts sent and raw responses received per model call

**What it looks like**: A vertical timeline or kanban-like board. Not a spreadsheet. Cards not rows.

**States**:

- Phase pending: muted
- Phase active: highlighted border, pulsing dot or spinner
- Phase complete: solid fill, checkmark
- Phase failed: red border, retry button

**Progress UX**:
- Show `4/4` for each phase as calls complete
- If one model call fails, show which one and allow retry
- Allow partial runs — don't block everything on one failure

**Speed**: Calls run in parallel. A phase with 4 models should feel simultaneous, not sequential.

---

## Screen 3: Results

**Purpose**: The payoff. Show the winner, the stories, and the full story of the tournament.

**Layout — top section (reveal moment)**:

- Winner card first — largest, boldest
  - `1st Place — written by Sonnet`
  - revised title + story
- Then the other 3 in placement order
  - `2nd Place — written by GPT`
  - `3rd Place — written by Kimi`
  - `4th Place — written by GLM-5`

**Layout — story cards (one per model, ordered by placement)**:

Each card should contain, in this order:

1. Final placement badge
2. Model name (now revealed)
3. Final story title
4. Final story body
5. `Show original story` — collapsed section with original title + body
6. `What changed` — revision change summary
7. `Feedback received` — summary of peer reviews (anonymized, no model names)
8. `How judges ranked it` — per-judge rank and justification

**Ranking breakdown table** (small, below each story):

| Judge | Rank Given | Justification (1 line) |
|---|---|---|
| Judge 1 | 2nd | "Stronger ending than expected" |
| Judge 2 | 1st | "Best prose in the set" |
| Judge 3 | 3rd | "Lost momentum in act 2" |
| Judge 4 | 1st | "Most emotionally resonant" |

This table is small, readable, and not the first thing the user sees.

**Additional actions at the bottom of the page**:

- `Run again` — same prompt, new tournament
- `Try new prompt` — back to Setup
- `Export results` — plain text or markdown export of all stories and scores

**States**:

- Results loading: skeleton cards
- Results ready: full reveal
- Export: download triggered, no page change

---

## Visual Style

**Direction**: Dark, editorial, tournament-like.

- Background: deep dark (near-black), not pure black
- Cards: slightly lighter dark, subtle borders
- Accent colors per phase, matching the SVG:
  - Generate: deep teal
  - Review: warm orange/red
  - Revise: deep blue
  - Rank: neutral dark
  - Reveal: gold/amber
- Typography:
  - Headings: serif (editorial feel — e.g. Playfair Display, Lora)
  - Body: clean sans-serif (e.g. Inter, DM Sans)
- Story text: readable serif, comfortable line-height
- No bright neon or gradient-heavy backgrounds

**Motion**:
- Phase transitions: subtle fade or slide
- Reveal moment: the author name on the winner card should animate in — fade or scale up
- Cards appear with a light stagger when results load

**Mobile**:
- Stack all cards vertically
- Full-width cards, no horizontal scroll
- Ranking table becomes a stacked list
- Developer drawer collapses to a bottom sheet

---

## Key UX Rules

- **Never show model names during the run.** Only after reveal.
- **Never show all story text during the run.** Show title + word count only.
- **Lead with the winner.** The first thing users see on the results page should be who won.
- **Make the reveal feel earned.** The final reveal is the product's most satisfying moment — design for it.
- **Show feedback after stories.** Users read stories first, then the editorial commentary.
- **Persist tournament history.** Users should be able to revisit past tournaments from a list page.

---

## Non-Goals for UX

- No real-time streaming of model calls
- No public leaderboards
- No user accounts
- No social sharing
- No per-criterion radar charts
- No dark/light mode toggle in v1
