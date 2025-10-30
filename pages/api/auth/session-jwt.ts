import type { NextApiRequest, NextApiResponse } from 'next';

function parseCookieHeader(header?: string | string[]) {
  const out: Record<string, string> = {};
  if (!header) return out;
  const raw = Array.isArray(header) ? header.join('; ') : header;
  raw.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx > -1) {
      const k = part.slice(0, idx).trim();
      const v = decodeURIComponent(part.slice(idx + 1).trim());
      if (k) out[k] = v;
    }
  });
  return out;
}

// Returns the JWT from cookies so the client can sync it into localStorage
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Allow explicit cookie name via query (?key=JWT)
    const explicitKey = (req.query.key as string | undefined) || undefined;

    // Merge Next's parsed cookies with manual parse to preserve case-sensitive names
    const parsedByNext = (req as any).cookies || {};
    const parsedByHeader = parseCookieHeader(req.headers.cookie);
    const all: Record<string, string> = { ...parsedByHeader, ...parsedByNext };

    let token = '';

    if (explicitKey && all[explicitKey]) {
      token = all[explicitKey];
    } else {
      // Try common names in a case-insensitive way
      const candidates = ['jwt', 'token', 'access_token'];
      for (const [k, v] of Object.entries(all)) {
        const lower = k.toLowerCase();
        if (candidates.includes(lower)) {
          token = v;
          break;
        }
      }
      // As a last resort, pick any cookie value that looks like a JWT
      if (!token) {
        for (const v of Object.values(all)) {
          if (v && v.startsWith('eyJ')) { // typical JWT prefix
            token = v;
            break;
          }
        }
      }
    }

    if (!token) {
      return res.status(404).json({ success: false, message: 'JWT cookie not found' });
    }

    return res.status(200).json({ success: true, token });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error?.message || 'Unexpected error' });
  }
}


