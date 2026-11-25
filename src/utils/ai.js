/**
 * Sanitizes and deduplicates API keys (e.g. from accidental paste doubling or quotes)
 * @param {string} key
 * @returns {string}
 */
export function sanitizeApiKey(key) {
  if (!key) return '';
  let clean = key.trim().replace(/^["']|["']$/g, '').replace(/\s+/g, '');
  if (clean.startsWith('AQ.') && clean.indexOf('AQ.', 3) !== -1) {
    clean = clean.substring(0, clean.indexOf('AQ.', 3));
  } else if (clean.startsWith('AIza') && clean.indexOf('AIza', 4) !== -1) {
    clean = clean.substring(0, clean.indexOf('AIza', 4));
  } else if (clean.startsWith('sk-ant-') && clean.indexOf('sk-ant-', 7) !== -1) {
    clean = clean.substring(0, clean.indexOf('sk-ant-', 7));
  } else if (clean.startsWith('sk-proj-') && clean.indexOf('sk-proj-', 8) !== -1) {
    clean = clean.substring(0, clean.indexOf('sk-proj-', 8));
  } else if (clean.startsWith('sk-svcacct-') && clean.indexOf('sk-svcacct-', 11) !== -1) {
    clean = clean.substring(0, clean.indexOf('sk-svcacct-', 11));
  } else if (clean.startsWith('sk-') && !clean.startsWith('sk-proj-') && !clean.startsWith('sk-svcacct-') && clean.indexOf('sk-', 3) !== -1) {
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
  const cleanKey = sanitizeApiKey(apiKey);
  const cleanModel = (model || 'gpt-4o-mini').trim();
  const url = 'https://api.openai.com/v1/chat/completions';
  
  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: userPrompt });

  // OpenAI reasoning / o-series & gpt-5 models reject custom temperature values
  const lowerModel = cleanModel.toLowerCase();
  const isReasoningOrGpt5 = /^(o1|o3|o4|gpt-5)/.test(lowerModel);
  const payload = {
    model: cleanModel,
    messages: messages,
  };
  if (!isReasoningOrGpt5) {
    payload.temperature = 0.3;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cleanKey}`
    },
    body: JSON.stringify(payload)
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
      const isHydrogen = lower.includes('hydrogen');
      const isArgon = lower.includes('argon');
      const isCarbon = lower.includes('carbon');
      const isNeon = lower.includes('neon');
      const isGemini4 = lower.includes('gemini-4') || lower.includes('gemini4') || isHydrogen || isArgon || isCarbon || isNeon;
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
      } else if (isHydrogen) {
        tier = 'paid';
        badge = 'Gemini 4 Hydrogen (Reasoning)';
        speed = 'Deep Reasoning';
      } else if (isCarbon) {
        tier = 'free';
        badge = 'Gemini 4 Carbon (Balanced)';
        speed = 'Fast';
      } else if (isNeon) {
        tier = 'free';
        badge = 'Gemini 4 Neon (Fast)';
        speed = 'Ultra Fast';
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
        badge = 'Gemini 4';
        speed = 'Fast';
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
        isHydrogen,
        isArgon,
        isCarbon,
        isNeon,
        isGemini4,
        recommended: isNeon || isCarbon || id === 'gemini-3.5-flash-lite' || id === 'gemini-3.5-flash' || id === 'gemini-3.8-flash'
      };
    });

  // Sort: Gemini 4 Neon/Carbon/Hydrogen/Argon & fast Free Tier Flash models at top
  const gemini4Order = (m) => {
    if (m.isNeon) return 0;
    if (m.isCarbon) return 1;
    if (m.isHydrogen) return 2;
    if (m.isArgon) return 3;
    if (m.isGemini4) return 4;
    return 99;
  };

  contentModels.sort((a, b) => {
    const g4a = gemini4Order(a);
    const g4b = gemini4Order(b);
    if (g4a !== g4b) return g4a - g4b;

    if (a.id === 'gemini-3.5-flash-lite') return -1;
    if (b.id === 'gemini-3.5-flash-lite') return 1;
    if (a.id === 'gemini-3.5-flash') return -1;
    if (b.id === 'gemini-3.5-flash') return 1;
    if (a.id === 'gemini-3.8-flash') return -1;
    if (b.id === 'gemini-3.8-flash') return 1;

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
  const cleanKey = sanitizeApiKey(apiKey);
  if (!cleanKey) {
    throw new Error("OpenAI API key is required to detect models.");
  }

  const response = await fetch('https://api.openai.com/v1/models', {
    headers: {
      'Authorization': `Bearer ${cleanKey}`
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

  // Filter for relevant GPT / o-series chat completion models, excluding audio/image/realtime-only endpoints
  const chatModels = data.data
    .filter(m => {
      if (!m.id) return false;
      const id = m.id.toLowerCase();
      const isChatFamily = id.startsWith('gpt-5') || id.startsWith('gpt-4') || id.startsWith('o4') || id.startsWith('o3') || id.startsWith('o1') || id.startsWith('chatgpt');
      const isNonText = /audio|realtime|transcribe|tts|image|search|dall-e|whisper|embedding|moderation/.test(id);
      return isChatFamily && !isNonText;
    })
    .map(m => {
      const id = m.id;
      const lower = id.toLowerCase();
      const isMiniOrNano = lower.includes('mini') || lower.includes('nano');
      return {
        id,
        name: id,
        description: isMiniOrNano ? 'Fast & cost-effective OpenAI model.' : 'Advanced reasoning OpenAI model.',
        tier: isMiniOrNano ? 'standard' : 'premium',
        badge: isMiniOrNano ? 'Fast & Affordable' : 'Flagship Intelligence',
        speed: isMiniOrNano ? 'Fast' : 'Deep Reasoning'
      };
    });

  // Sort newest flagship families first (gpt-5, gpt-4.1, o4, o3, gpt-4o)
  const rank = (id) => {
    const l = id.toLowerCase();
    if (l.startsWith('gpt-5')) return 0;
    if (l.startsWith('gpt-4.1')) return 1;
    if (l.startsWith('o4')) return 2;
    if (l.startsWith('o3')) return 3;
    if (l.startsWith('gpt-4o')) return 4;
    return 5;
  };
  chatModels.sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id));
  return chatModels;
}

/**
 * Default vetted Anthropic Claude model presets
 */
export const CLAUDE_DEFAULT_PRESETS = [
  {
    id: 'claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5',
    tier: 'premium',
    badge: 'Flagship Hybrid Reasoning',
    speed: 'Fast Reasoning',
    description: 'Anthropic\'s latest Sonnet model for sophisticated pedagogy, nuanced scaffolding, and structured lesson resources.'
  },
  {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    tier: 'standard',
    badge: 'Ultra Fast & Affordable',
    speed: 'Instant',
    description: 'Rapid, lightweight Claude 4.5 model designed for instant classroom summaries, worksheets, and quick tasks.'
  },
  {
    id: 'claude-opus-4-1',
    name: 'Claude Opus 4.1',
    tier: 'premium',
    badge: 'Deep Pedagogical Depth',
    speed: 'Deep Reasoning',
    description: 'Heavyweight Claude 4.1 reasoning model for complex curriculum plans and multi-stage academic schemes of work.'
  },
  {
    id: 'claude-3-7-sonnet-latest',
    name: 'Claude 3.7 Sonnet (Legacy)',
    tier: 'premium',
    badge: 'Hybrid Reasoning',
    speed: 'Deep Reasoning',
    description: 'Proven Claude 3.7 Sonnet model with extended thinking capabilities.'
  },
  {
    id: 'claude-3-5-haiku-latest',
    name: 'Claude 3.5 Haiku (Legacy)',
    tier: 'standard',
    badge: 'Fast & Affordable',
    speed: 'Instant',
    description: 'Previous-generation lightweight Claude model for rapid classroom tasks.'
  }
];

/**
 * Fetches available models for an Anthropic Claude API key.
 * @param {string} apiKey 
 * @returns {Promise<Array<{ id: string, name: string, description: string, tier: string, badge: string, speed: string }>>}
 */
export async function fetchAvailableClaudeModels(apiKey) {
  const trimmed = sanitizeApiKey(apiKey);
  if (!trimmed) {
    throw new Error("Claude API key is required to detect models.");
  }

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
            const isGen4 = /claude-(?:sonnet|opus|haiku)-4|claude-4/.test(lower);

            let badge = 'Available';
            let speed = 'Fast';
            let tier = 'premium';

            if (isHaiku) {
              badge = isGen4 ? 'Claude 4 Haiku (Fast)' : 'Ultra Fast & Affordable';
              speed = 'Instant';
              tier = 'standard';
            } else if (isSonnet) {
              badge = isGen4 ? 'Claude 4 Sonnet (Flagship)' : 'High Intelligence & Speed';
              speed = 'Fast Reasoning';
              tier = 'premium';
            } else if (isOpus) {
              badge = isGen4 ? 'Claude 4 Opus (Deep)' : 'Deep Pedagogical Depth';
              speed = 'Deep Reasoning';
              tier = 'premium';
            }

            return {
              id,
              name: m.display_name || id,
              description: isHaiku ? 'Fast, lightweight Claude model for instant classroom tasks.' : 'Advanced intelligence Anthropic model for secondary lesson plans.',
              tier,
              badge,
              speed,
              isGen4
            };
          });

        if (models.length > 0) {
          models.sort((a, b) => {
            if (a.isGen4 && !b.isGen4) return -1;
            if (!a.isGen4 && b.isGen4) return 1;
            if (a.id.includes('4-5') && !b.id.includes('4-5')) return -1;
            if (!a.id.includes('4-5') && b.id.includes('4-5')) return 1;
            if (a.id.includes('3-7') && !b.id.includes('3-7')) return -1;
            if (!a.id.includes('3-7') && b.id.includes('3-7')) return 1;
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
