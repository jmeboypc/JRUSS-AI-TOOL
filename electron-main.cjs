const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');

function extractYouTubeVideoId(input) {
  if (!input) return null;
  const trimmed = String(input).trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const u = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0];
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      const v = u.searchParams.get('v');
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
      const parts = u.pathname.split('/').filter(Boolean);
      const markerIdx = parts.findIndex(p => ['shorts', 'embed', 'live', 'v'].includes(p));
      if (markerIdx !== -1 && parts[markerIdx + 1] && /^[a-zA-Z0-9_-]{11}$/.test(parts[markerIdx + 1])) {
        return parts[markerIdx + 1];
      }
    }
  } catch {
    // ignore invalid URL
  }
  return null;
}

function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function extractBalancedJson(html, marker) {
  const idx = html.indexOf(marker);
  if (idx === -1) return null;
  const start = html.indexOf('{', idx);
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
    } else {
      if (ch === '"') inString = true;
      else if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(html.slice(start, i + 1));
          } catch {
            return null;
          }
        }
      }
    }
  }
  return null;
}

function pickBestCaptionTrack(tracks) {
  if (!Array.isArray(tracks) || tracks.length === 0) return null;
  const score = (t) => {
    const lang = (t.languageCode || '').toLowerCase();
    const isEn = lang === 'en' || lang.startsWith('en-');
    const isAuto = t.kind === 'asr';
    if (isEn && !isAuto) return 0;
    if (isEn && isAuto) return 1;
    if (!isAuto) return 2;
    return 3;
  };
  return [...tracks].sort((a, b) => score(a) - score(b))[0];
}

ipcMain.handle('fetch-youtube-transcript', async (_event, rawUrl) => {
  try {
    const videoId = extractYouTubeVideoId(rawUrl);
    if (!videoId) {
      return { success: false, error: 'Could not find a valid YouTube video ID in that link.' };
    }

    const commonHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept-Language': 'en-GB,en;q=0.9',
      'Cookie': 'CONSENT=YES+cb.20210328-17-p0.en+FX+678'
    };

    let playerResponse = null;
    const watchRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, { headers: commonHeaders });
    if (watchRes.ok) {
      const html = await watchRes.text();
      playerResponse = extractBalancedJson(html, 'ytInitialPlayerResponse =') || extractBalancedJson(html, 'var ytInitialPlayerResponse =');
    }

    let tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    let title = playerResponse?.videoDetails?.title || '';

    // Fallback to YouTube Innertube Android player endpoint if watch page didn't expose captionTracks
    if (!Array.isArray(tracks) || tracks.length === 0) {
      const innerRes = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 14; en_GB) gzip',
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: 'ANDROID',
              clientVersion: '20.10.38',
              hl: 'en',
              gl: 'GB',
            },
          },
          videoId,
        }),
      });
      if (innerRes.ok) {
        const innerJson = await innerRes.json();
        tracks = innerJson?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        if (!title) title = innerJson?.videoDetails?.title || '';
      }
    }

    if (!Array.isArray(tracks) || tracks.length === 0) {
      return {
        success: false,
        error: 'No captions/transcript found for this video (it may have captions disabled, be private, or require sign-in).'
      };
    }

    const bestTrack = pickBestCaptionTrack(tracks);
    if (!bestTrack || !bestTrack.baseUrl) {
      return { success: false, error: 'Could not locate a readable caption track URL.' };
    }

    let textSegments = [];
    // Try JSON3 first for cleanest segment parsing
    const jsonUrl = bestTrack.baseUrl.includes('fmt=') ? bestTrack.baseUrl : `${bestTrack.baseUrl}&fmt=json3`;
    const capRes = await fetch(jsonUrl, { headers: commonHeaders });
    if (capRes.ok) {
      const rawBody = await capRes.text();
      if (rawBody.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(rawBody);
          if (Array.isArray(parsed.events)) {
            for (const ev of parsed.events) {
              if (!Array.isArray(ev.segs)) continue;
              const line = ev.segs.map(s => s.utf8 || '').join('').replace(/\s+/g, ' ').trim();
              if (line) textSegments.push(decodeHtmlEntities(line));
            }
          }
        } catch {
          // fall through to XML
        }
      }
      if (textSegments.length === 0 && rawBody.includes('<text')) {
        const matches = rawBody.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g);
        for (const m of matches) {
          const cleaned = decodeHtmlEntities(m[1]).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
          if (cleaned) textSegments.push(cleaned);
        }
      }
    }

    if (textSegments.length === 0) {
      return { success: false, error: 'Caption track was empty or could not be parsed.' };
    }

    // Group into readable paragraphs (~8 segments per paragraph)
    const paragraphs = [];
    for (let i = 0; i < textSegments.length; i += 8) {
      paragraphs.push(textSegments.slice(i, i + 8).join(' '));
    }

    return {
      success: true,
      videoId,
      title,
      language: bestTrack.name?.simpleText || bestTrack.languageCode || 'English',
      isAutoGenerated: bestTrack.kind === 'asr',
      transcript: paragraphs.join('\n\n'),
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to fetch YouTube transcript: ${err?.message || 'Unknown network error'}`
    };
  }
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1300,
    height: 850,
    title: 'JRUSS AI TOOL - v2.5.7',
    icon: path.join(__dirname, 'icon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'electron-preload.cjs'),
    }
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

// Global handler for all web contents (main window, secondary windows, webviews)
// Ensures any external link opens strictly in the user's default OS browser (Chrome, Edge, etc.)
app.on('web-contents-created', (_event, contents) => {
  const isDev = !app.isPackaged;

  // Intercept window.open and <a target="_blank">
  contents.setWindowOpenHandler(({ url }) => {
    // Allow internal secondary pupil projector window
    if (url.includes('whiteboard-pupil') || url.includes('#/whiteboard-pupil')) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 1280,
          height: 750,
          autoHideMenuBar: true,
          title: 'JRUSS AI TOOL - Whiteboard Projector Display',
          icon: path.join(__dirname, 'icon.ico'),
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
          }
        }
      };
    }

    // Open any external URL (updates, jruss.co.uk, Google AI, OpenAI, Anthropic) in default browser
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Intercept in-app navigations (e.g. clicking standard links inside markdown or html)
  contents.on('will-navigate', (event, url) => {
    const isDevServer = isDev && (url.startsWith('http://localhost:5173') || url.startsWith('http://127.0.0.1:5173'));
    if (!isDevServer && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:'))) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
