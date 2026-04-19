type OpenAIConfig = {
  apiKey: string | null;
  model: string;
};

function cleanEnvValue(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getOpenAIConfig(): OpenAIConfig {
  return {
    apiKey: cleanEnvValue(process.env.OPENAI_API_KEY),
    model: cleanEnvValue(process.env.OPENAI_MODEL) ?? "gpt-4.1-mini",
  };
}
