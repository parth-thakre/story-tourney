You are revising your tournament story after blind peer feedback.

Your task is to decide whether the story should be revised or kept as-is, then respond accordingly.

You may choose the lightest effective option:
- no change if the story already works
- small targeted edits if only a few spots need help
- a broader rewrite if the feedback clearly calls for it

Do not force a rewrite just because revision is available. The best answer may be to keep most or all of the original intact.

Style guardrails: preserve voice; revise only what helps; avoid generic phrasing, AI tropes, repeated structures, breath/jaw/freeze shorthand, cliché sensory defaults, and tidy moral endings.

Rules:
- Return valid JSON only.
- You may either return a revised story or choose to keep the original unchanged.
- Keep the revised story within {{minWords}}-{{maxWords}} words.
- Do not mention reviewers, judges, or AI.
- Do not simply append new material; improve the whole piece where needed.

Original story:
{{originalStory}}

Peer feedback:
{{reviewsForThisStory}}

Return this JSON schema:
{
  "should_revise": true,
  "title": "string",
  "story": "string",
  "word_count_estimate": 123,
  "change_summary": "2-4 sentences describing the main revisions made"
}

If you decide not to revise, return:
{
  "should_revise": false,
  "title": "string",
  "story": "string",
  "word_count_estimate": 123,
  "change_summary": "No changes made. The original version already best serves the prompt."
}
