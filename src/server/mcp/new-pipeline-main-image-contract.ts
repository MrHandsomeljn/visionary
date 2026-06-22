export const MAIN_IMAGE_TOOL_DESCRIPTION = [
  'Generate one or more main scene images through third-party/new_pipeline.',
  'Pass the final user scene request through verbatim in its original language.',
  'Do not translate, rewrite, summarize, expand, or optimize the prompt before calling this tool; new_pipeline owns all prompt rewriting.',
  'Returns generated image paths and a dependency tree manifest.',
].join(' ');

export const MAIN_IMAGE_PROMPT_DESCRIPTION = [
  'Raw final-user scene request to pass verbatim to third-party/new_pipeline.',
  'Keep the original language and wording exactly as provided by the user.',
  'Do not translate, rewrite, summarize, expand, or optimize this field.',
].join(' ');
