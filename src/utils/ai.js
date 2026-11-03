/**
 * Sanitizes and deduplicates API keys (e.g. from accidental paste doubling or quotes)
 * @param {string} key
 * @returns {string}
 */
export function sanitizeApiKey(key) {
  if (!key) return '';
  let clean = key.trim().replace(/^["']|["']$/g, '');
  if (clean.startsWith('AQ.') && clean.indexOf('AQ.', 3) !== -1) {
    clean = clean.substring(0, clean.indexOf('AQ.', 3));
  } else if (clean.startsWith('AIza') && clean.indexOf('AIza', 4) !== -1) {
    clean = clean.substring(0, clean.indexOf('AIza', 4));
  } else if (clean.startsWith('sk-ant-') && clean.indexOf('sk-ant-', 7) !== -1) {
    clean = clean.substring(0, clean.indexOf('sk-ant-', 7));
  } else if (clean.startsWith('sk-') && clean.indexOf('sk-', 3) !== -1) {
    clean = clean.substring(0, clean.indexOf('sk-', 3));
  }
  return clean;
}

/**
 * Calls the Google Gemini API to generate content.
 * @param {string} apiKey 
 * @param {string} model 
 * @param {string} systemPrompt 
 * @param {string} userPrompt 
 * @returns {Promise<string>}
 */
async function callGemini(apiKey, model, systemPrompt, userPrompt) {
  const cleanKey = sanitizeApiKey(apiKey);
  const cleanModel = (model || '').trim();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent`;
  
  // Prepend system prompt inside the main user contents block to prevent version compatibility issues with 'systemInstruction'
  const combinedText = systemPrompt 
    ? `[SYSTEM INSTRUCTION]\n${systemPrompt}\n\n[USER CONTEXT & MATERIALS]\n${userPrompt}`
    : userPrompt;

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: combinedText }]
      }
    ],
    generationConfig: {
      temperature: 0.3,
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': cleanKey
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    let rawMsg = '';
    try {
      const errorJson = await response.json();
      if (errorJson.error && errorJson.error.message) {
        rawMsg = errorJson.error.message;
      }
    } catch {
      // ignore
    }

    if (response.status === 401) {
      throw new Error(`Gemini Authentication Error (401): API key rejected by Google (${rawMsg || 'API key not valid'}). Please ensure your key was created at aistudio.google.com/apikey with the Generative Language API enabled. If created under an existing project, try clicking "Create API key in new project".`);
    } else if (response.status === 429) {
      throw new Error(`Gemini Free/Paid Tier Rate Limit Reached (429): ${rawMsg || 'Too many requests or daily quota exceeded. If using the Free Tier, wait 30-60 seconds or switch to a Flash model in Engine Settings.'}`);
    } else if (response.status === 404) {
      throw new Error(`Gemini Model '${model}' Not Found (404): ${rawMsg || 'Please check that this model exists in Google AI Studio or select a recommended model (e.g. gemini-2.5-flash) in Engine Settings.'}`);
    } else if (response.status === 403) {
      throw new Error(`Gemini Permission / Quota Error (403): ${rawMsg || 'Invalid API key or project permission denied. Please verify your Google AI Studio API key in Engine Settings.'}`);
    } else {
      throw new Error(rawMsg ? `Gemini API error (${response.status}): ${rawMsg}` : `Gemini API returned status ${response.status}`);
    }
  }

  const data = await response.json();
  
  // Check for prompt feedback blocks (safety, etc.)
  if (data.promptFeedback && data.promptFeedback.blockReason) {
    throw new Error(`Gemini blocked the request due to content policies. Reason: ${data.promptFeedback.blockReason}`);
  }

  const candidate = data.candidates && data.candidates[0];
  if (!candidate) {
    throw new Error("Gemini returned no content candidates. Response payload: " + JSON.stringify(data));
  }

  // Check if content was blocked during generation (safety, recitation, etc.)
  if (candidate.finishReason && candidate.finishReason !== "STOP" && candidate.finishReason !== "MAX_TOKENS") {
    throw new Error(`Gemini generation stopped prematurely. Reason: ${candidate.finishReason}`);
  }

  try {
    const text = candidate.content.parts[0].text;
    if (!text || !text.trim()) {
      throw new Error("Text content is empty");
    }
    return text;
  } catch (err) {
    throw new Error("Failed to parse content text from Gemini response candidate: " + err.message);
  }
}

/**
 * Calls the OpenAI Chat Completions API.
 * @param {string} apiKey 
 * @param {string} model 
 * @param {string} systemPrompt 
 * @param {string} userPrompt 
 * @returns {Promise<string>}
 */
async function callOpenAI(apiKey, model, systemPrompt, userPrompt) {
  const url = 'https://api.openai.com/v1/chat/completions';
  
  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: userPrompt });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      temperature: 0.3
    })
  });

  if (!response.ok) {
    let errMsg = `OpenAI API returned status ${response.status}`;
    try {
      const errorJson = await response.json();
      if (errorJson.error && errorJson.error.message) {
        errMsg = errorJson.error.message;
      }
    } catch {
      // ignore
    }
    throw new Error(errMsg);
  }

  const data = await response.json();
  
  try {
    return data.choices[0].message.content;
  } catch (err) {
    throw new Error("Failed to extract text from OpenAI response structure: " + err.message);
  }
}

/**
 * Calls the Anthropic Claude Messages API.
 * @param {string} apiKey 
 * @param {string} model 
 * @param {string} systemPrompt 
 * @param {string} userPrompt 
 * @returns {Promise<string>}
 */
async function callAnthropic(apiKey, model, systemPrompt, userPrompt) {
  const url = 'https://api.anthropic.com/v1/messages';
  
  const body = {
    model: model || 'claude-3-7-sonnet-latest',
    max_tokens: 4096,
    messages: [
      { role: 'user', content: userPrompt }
    ]
  };

  if (systemPrompt && systemPrompt.trim()) {
    body.system = systemPrompt.trim();
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey.trim(),
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    let errMsg = `Anthropic API returned status ${response.status}`;
    try {
      const errorJson = await response.json();
      if (errorJson.error && errorJson.error.message) {
        errMsg = errorJson.error.message;
      }
    } catch {
      // ignore
    }

    if (response.status === 401) {
      throw new Error(`Anthropic Authentication Error (401): ${errMsg || 'Invalid Claude API key. Keys typically start with sk-ant-.'}`);
    } else if (response.status === 429) {
      throw new Error(`Anthropic Rate Limit Reached (429): ${errMsg || 'Rate limit or account credit limit reached. Please check console.anthropic.com.'}`);
    } else if (response.status === 404) {
      throw new Error(`Claude Model '${model}' Not Found (404): ${errMsg || 'Please verify the model ID in Engine Settings.'}`);
    } else {
      throw new Error(`Anthropic API error (${response.status}): ${errMsg}`);
    }
  }

  const data = await response.json();

  if (!data.content || !Array.isArray(data.content)) {
    throw new Error("Anthropic returned unexpected response payload: " + JSON.stringify(data));
  }

  const textParts = data.content
    .filter(part => part.type === 'text' && part.text)
    .map(part => part.text);

  if (textParts.length === 0) {
    throw new Error("No text content returned from Claude model.");
  }

  return textParts.join('\n');
}

/**
 * Main AI generation entrypoint
 * @param {object} params
 * @param {string} params.provider - 'gemini' or 'openai'
 * @param {string} params.apiKey
 * @param {string} params.model
 * @param {string} params.systemPrompt
 * @param {string} params.userPrompt
 * @returns {Promise<string>}
 */
export async function generateContent({ provider, apiKey, model, systemPrompt, userPrompt }) {
  const cleanKey = sanitizeApiKey(apiKey);
  if (!cleanKey) {
    throw new Error("API Key is missing. Please enter your API Key in the settings.");
  }
  
  if (provider === 'gemini') {
    return await callGemini(cleanKey, model, systemPrompt, userPrompt);
  } else if (provider === 'openai') {
    return await callOpenAI(cleanKey, model, systemPrompt, userPrompt);
  } else if (provider === 'claude' || provider === 'anthropic') {
    return await callAnthropic(cleanKey, model, systemPrompt, userPrompt);
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }
}

/**
 * Fetches the available content generation models for a Gemini API key.
 * @param {string} apiKey 
 * @returns {Promise<Array<{ id: string, name: string, description: string, tier: 'free' | 'paid' | 'other', badge: string, speed: string, isFlash: boolean, isPro: boolean, recommended?: boolean }>>}
 */
export async function fetchAvailableGeminiModels(apiKey) {
  const cleanKey = sanitizeApiKey(apiKey);
  if (!cleanKey) {
    throw new Error("Gemini API key is required to detect models.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models`;
  const response = await fetch(url, {
    headers: {
      'x-goog-api-key': cleanKey
    }
  });

  if (!response.ok) {
    let errMsg = `Gemini API returned status ${response.status}`;
    try {
      const errorJson = await response.json();
      if (errorJson.error && errorJson.error.message) {
        errMsg = errorJson.error.message;
      }
    } catch {
      // ignore
    }
    if (response.status === 401 || response.status === 400 || response.status === 403) {
      throw new Error(`Invalid Gemini API Key (${response.status}): ${errMsg || 'Key rejected by Google. Ensure it was created at aistudio.google.com/apikey with Generative Language API enabled.'}`);
    }
    throw new Error(errMsg);
  }

  const data = await response.json();
  if (!data.models || !Array.isArray(data.models)) {
    throw new Error("No models returned from Gemini API.");
  }

  // Filter for models that support text / multimodal content generation
  const contentModels = data.models
    .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes("generateContent"))
    .map(m => {
      const id = m.name.replace(/^models\//, '');
      const lower = id.toLowerCase();
      const isArgon = lower.includes('argon');
      const isGemini4 = lower.includes('gemini-4') || lower.includes('gemini4') || isArgon;
      const isFlash = lower.includes('flash');
      const isPro = lower.includes('pro');
      const isLite = lower.includes('lite');

      let tier = 'other';
      let badge = 'Available';
      let speed = 'Standard';

      if (isArgon) {
        tier = 'paid';
        badge = 'Flagship Reasoning (Gemini 4 Argon)';
        speed = 'Deep Reasoning';
      } else if (isFlash) {
        tier = 'free';
        badge = isLite ? 'Free Tier (Lightweight)' : 'Free Tier (1,500 req/day)';
        speed = isLite ? 'Instant' : 'Ultra Fast';
      } else if (isPro) {
        tier = 'paid';
        badge = 'Paid / Pro Tier (Deep Reasoning)';
        speed = 'Deep Reasoning';
      } else if (isGemini4) {
        tier = 'paid';
        badge = 'Gemini 4 Flagship';
        speed = 'Deep Reasoning';
      }

      return {
        id,
        name: m.displayName || id,
        description: m.description || '',
        tier,
        badge,
        speed,
        isFlash,
        isPro,
        isArgon,
        isGemini4,
        recommended: id === 'gemini-3.5-flash-lite' || id === 'gemini-3.5-flash' || id === 'gemini-3.8-flash'
      };
    });

  // Sort so fastest stable Free Tier (3.5 Flash-Lite / 3.5 Flash / 3.8 Flash) are on top for free educators, followed by Gemini 4 Argon
  contentModels.sort((a, b) => {
    if (a.id === 'gemini-3.5-flash-lite') return -1;
    if (b.id === 'gemini-3.5-flash-lite') return 1;
    if (a.id === 'gemini-3.5-flash') return -1;
    if (b.id === 'gemini-3.5-flash') return 1;
    if (a.id === 'gemini-3.8-flash') return -1;
    if (b.id === 'gemini-3.8-flash') return 1;

    // Prioritize Gemini 4 Argon flagship
    if (a.id.toLowerCase().includes('argon') && !b.id.toLowerCase().includes('argon')) return -1;
    if (!a.id.toLowerCase().includes('argon') && b.id.toLowerCase().includes('argon')) return 1;

    const a38 = a.id.includes('3.8') || a.id.includes('3-8');
    const b38 = b.id.includes('3.8') || b.id.includes('3-8');
    if (a38 && a.isFlash && !(b38 && b.isFlash)) return -1;
    if (!(a38 && a.isFlash) && b38 && b.isFlash) return 1;

    const a35 = a.id.includes('3.5') || a.id.includes('3-5');
    const b35 = b.id.includes('3.5') || b.id.includes('3-5');
    if (a35 && a.isFlash && !(b35 && b.isFlash)) return -1;
    if (!(a35 && a.isFlash) && b35 && b.isFlash) return 1;

    if (a.isFlash && !b.isFlash) return -1;
    if (!a.isFlash && b.isFlash) return 1;

    if (a.isGemini4 && !b.isGemini4) return -1;
    if (!a.isGemini4 && b.isGemini4) return 1;

    if (a.isPro && !b.isPro) return -1;
    if (!a.isPro && b.isPro) return 1;
    return a.name.localeCompare(b.name);
  });

  return contentModels;
}

/**
 * Fetches available models for an OpenAI API key.
 * @param {string} apiKey 
 * @returns {Promise<Array<{ id: string, name: string, description: string, tier: string, badge: string, speed: string }>>}
 */
export async function fetchAvailableOpenAIModels(apiKey) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error("OpenAI API key is required to detect models.");
  }

  const response = await fetch('https://api.openai.com/v1/models', {
    headers: {
      'Authorization': `Bearer ${apiKey.trim()}`
    }
  });

  if (!response.ok) {
    let errMsg = `OpenAI API returned status ${response.status}`;
    try {
      const errorJson = await response.json();
      if (errorJson.error && errorJson.error.message) {
        errMsg = errorJson.error.message;
      }
    } catch {
      // ignore
    }
    throw new Error(errMsg);
  }

  const data = await response.json();
  if (!data.data || !Array.isArray(data.data)) {
    throw new Error("No models returned from OpenAI API.");
  }

  // Filter for relevant GPT chat completion models
  const chatModels = data.data
    .filter(m => m.id && (m.id.startsWith('gpt-4') || m.id.startsWith('o1') || m.id.startsWith('o3') || m.id.startsWith('chatgpt')))
    .map(m => {
      const isMini = m.id.includes('mini');
      return {
        id: m.id,
        name: m.id,
        description: isMini ? 'Fast & cost-effective OpenAI model.' : 'Advanced reasoning OpenAI model.',
        tier: isMini ? 'standard' : 'premium',
        badge: isMini ? 'Fast & Affordable' : 'Flagship Intelligence',
        speed: isMini ? 'Fast' : 'Deep Reasoning'
      };
    });

  chatModels.sort((a, b) => a.id.localeCompare(b.id));
  return chatModels;
}

/**
 * Default vetted Anthropic Claude model presets
 */
export const CLAUDE_DEFAULT_PRESETS = [
  {
    id: 'claude-3-7-sonnet-latest',
    name: 'Claude 3.7 Sonnet (Beta)',
    tier: 'premium',
    badge: 'Flagship Hybrid Reasoning',
    speed: 'Deep Reasoning',
    description: 'Anthropic\'s latest flagship model with hybrid instant/extended thinking capabilities for advanced lesson design and deep subject analysis.'
  },
  {
    id: 'claude-3-5-sonnet-latest',
    name: 'Claude 3.5 Sonnet (Beta)',
    tier: 'premium',
    badge: 'High Intelligence & Speed',
    speed: 'Fast Reasoning',
    description: 'Top-tier Anthropic model widely acclaimed for sophisticated pedagogy, nuanced student scaffolding, and structured schemas.'
  },
  {
    id: 'claude-3-5-haiku-latest',
    name: 'Claude 3.5 Haiku (Beta)',
    tier: 'standard',
    badge: 'Ultra Fast & Affordable',
    speed: 'Instant',
    description: 'Rapid, lightweight Claude model designed for instant classroom summaries, worksheets, and quick pedagogical tasks.'
  },
  {
    id: 'claude-3-opus-latest',
    name: 'Claude 3 Opus (Beta)',
    tier: 'premium',
    badge: 'Deep Pedagogical Depth',
    speed: 'Deep Reasoning',
    description: 'Heavyweight reasoning model for complex curriculum plans and multi-stage academic schemes of work.'
  }
];

/**
 * Fetches available models for an Anthropic Claude API key.
 * @param {string} apiKey 
 * @returns {Promise<Array<{ id: string, name: string, description: string, tier: string, badge: string, speed: string }>>}
 */
export async function fetchAvailableClaudeModels(apiKey) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error("Claude API key is required to detect models.");
  }

  const trimmed = apiKey.trim();
  const url = 'https://api.anthropic.com/v1/models';

  try {
    const response = await fetch(url, {
      headers: {
        'x-api-key': trimmed,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (data.data && Array.isArray(data.data) && data.data.length > 0) {
        const models = data.data
          .filter(m => m.id && m.id.startsWith('claude'))
          .map(m => {
            const id = m.id;
            const lower = id.toLowerCase();
            const isHaiku = lower.includes('haiku');
            const isSonnet = lower.includes('sonnet');
            const isOpus = lower.includes('opus');
            const is37 = lower.includes('3-7') || lower.includes('3.7');

            let badge = 'Available';
            let speed = 'Fast';
            let tier = 'premium';

            if (isHaiku) {
              badge = 'Ultra Fast & Affordable';
              speed = 'Instant';
              tier = 'standard';
            } else if (is37) {
              badge = 'Flagship Hybrid Reasoning';
              speed = 'Deep Reasoning';
              tier = 'premium';
            } else if (isSonnet) {
              badge = 'High Intelligence & Speed';
              speed = 'Fast Reasoning';
              tier = 'premium';
            } else if (isOpus) {
              badge = 'Deep Pedagogical Depth';
              speed = 'Deep Reasoning';
              tier = 'premium';
            }

            return {
              id,
              name: m.display_name ? `${m.display_name} (Beta)` : `${id} (Beta)`,
              description: isHaiku ? 'Fast, lightweight Claude model for instant classroom tasks.' : 'Advanced intelligence Anthropic model for secondary lesson plans.',
              tier,
              badge,
              speed
            };
          });

        if (models.length > 0) {
          models.sort((a, b) => {
            if (a.id.includes('3-7') && !b.id.includes('3-7')) return -1;
            if (!a.id.includes('3-7') && b.id.includes('3-7')) return 1;
            if (a.id.includes('3-5-sonnet') && !b.id.includes('3-5-sonnet')) return -1;
            if (!a.id.includes('3-5-sonnet') && b.id.includes('3-5-sonnet')) return 1;
            return a.name.localeCompare(b.name);
          });
          return models;
        }
      }
    } else if (response.status === 401) {
      throw new Error(`Invalid Claude API Key (401): Please verify your Anthropic key.`);
    }
  } catch (err) {
    if (err.message && err.message.includes('401')) {
      throw err;
    }
    // Fallback gracefully to vetted Claude presets
  }

  return CLAUDE_DEFAULT_PRESETS;
}
