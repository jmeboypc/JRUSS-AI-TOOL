/**
 * Calls the Google Gemini API to generate content.
 * @param {string} apiKey 
 * @param {string} model 
 * @param {string} systemPrompt 
 * @param {string} userPrompt 
 * @returns {Promise<string>}
 */
async function callGemini(apiKey, model, systemPrompt, userPrompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
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
      'Content-Type': 'application/json'
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

    if (response.status === 429) {
      throw new Error(`Gemini Free/Paid Tier Rate Limit Reached (429): ${rawMsg || 'Too many requests or daily quota exceeded. If using the Free Tier, wait 30-60 seconds or switch to a Flash model in Engine Settings.'}`);
    } else if (response.status === 404) {
      throw new Error(`Gemini Model '${model}' Not Found (404): ${rawMsg || 'Please check that this model exists in Google AI Studio or select a recommended model (e.g. gemini-2.5-flash) in Engine Settings.'}`);
    } else if (response.status === 403) {
      throw new Error(`Gemini Authentication Error (403): ${rawMsg || 'Invalid API key or project permission denied. Please verify your Google AI Studio API key in Engine Settings.'}`);
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
  if (!apiKey || !apiKey.trim()) {
    throw new Error("API Key is missing. Please enter your API Key in the settings.");
  }
  
  if (provider === 'gemini') {
    return await callGemini(apiKey.trim(), model, systemPrompt, userPrompt);
  } else if (provider === 'openai') {
    return await callOpenAI(apiKey.trim(), model, systemPrompt, userPrompt);
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
  if (!apiKey || !apiKey.trim()) {
    throw new Error("Gemini API key is required to detect models.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`;
  const response = await fetch(url);

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
    if (response.status === 400 || response.status === 403) {
      throw new Error(`Invalid Gemini API Key (${response.status}): ${errMsg}`);
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
      const isFlash = lower.includes('flash');
      const isPro = lower.includes('pro');
      const isLite = lower.includes('lite');

      let tier = 'other';
      let badge = 'Available';
      let speed = 'Standard';

      if (isFlash) {
        tier = 'free';
        badge = isLite ? 'Free Tier (Lightweight)' : 'Free Tier (1,500 req/day)';
        speed = isLite ? 'Instant' : 'Ultra Fast';
      } else if (isPro) {
        tier = 'paid';
        badge = 'Paid / Pro Tier (Deep Reasoning)';
        speed = 'Deep Reasoning';
      }

      const is38 = lower.includes('3.8') || lower.includes('3-8');

      return {
        id,
        name: m.displayName || id,
        description: m.description || '',
        tier,
        badge,
        speed,
        isFlash,
        isPro,
        recommended: id === 'gemini-3.8-flash-lite' || id === 'gemini-3.8-flash' || id === 'gemini-3.5-flash-lite' || (isFlash && is38)
      };
    });

  // Sort so newest Flash-Lite / Flash (3.8 / 3.5) are on top, followed by other Flash, then Pro, then others
  contentModels.sort((a, b) => {
    if (a.id === 'gemini-3.8-flash-lite') return -1;
    if (b.id === 'gemini-3.8-flash-lite') return 1;
    if (a.id === 'gemini-3.8-flash') return -1;
    if (b.id === 'gemini-3.8-flash') return 1;
    if (a.id === 'gemini-3.5-flash-lite') return -1;
    if (b.id === 'gemini-3.5-flash-lite') return 1;
    if (a.id === 'gemini-3.5-flash') return -1;
    if (b.id === 'gemini-3.5-flash') return 1;

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
