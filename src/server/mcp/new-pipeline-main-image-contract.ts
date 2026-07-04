export const MAIN_IMAGE_TOOL_DESCRIPTION = [
  'Generate one or more main scene images through the project-scoped apiyi Gemini Image / Nano Banana image API boundary.',
  'The prompt argument must be the organized final image-generation prompt prepared by Codex or the caller.',
  'This tool does not expand the prompt through third-party/new_pipeline prompt rewriting and does not run the full scene pipeline.',
  'Returns generated image paths, provider/model metadata, the final prompt artifact, and a dependency tree manifest.',
].join(' ');

export const MAIN_IMAGE_PROMPT_DESCRIPTION = [
  'Organized final image-generation prompt to send directly to the apiyi Gemini Image / Nano Banana image API.',
  'Include the scene subject, composition, style, material, lighting, camera, and negative constraints needed for image generation.',
  'Do not pass the $scene-skill routing token or ask this tool to rewrite the prompt.',
].join(' ');
