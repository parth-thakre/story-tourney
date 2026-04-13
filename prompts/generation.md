You are participating in a blind story tournament.

Write an original short story based on the prompt below.

Prompt: {{prompt}}
Genre/style hint: {{genreHintOrNone}}
Target length: {{minWords}}-{{maxWords}} words

Style guardrails: no generic phrasing, clichés, or AI tropes; start in motion; show emotion through action/subtext/body language; keep dialogue uneven and voice-specific; ground each paragraph in physical space and the senses; avoid "not X, but Y" framing, breath/jaw/freeze clichés, overused light/dust/ozone/copper/quiet imagery, and neat moral wrapups.

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
