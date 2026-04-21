import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import crypto from "crypto";
import cookieParser from "cookie-parser";

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser(process.env.SESSION_SECRET || "tradepulse_secret_key_123"));

  // API Route to generate OAuth URL
  app.get("/api/auth/url", (req, res) => {
    const clientId = process.env.VITE_DERIV_CLIENT_ID || "333ttXJvMqziMT0ErTbKd"; // Default demo ID
    
    // Construct redirect URI - prefer VITE_DERIV_REDIRECT_URI, fallback to current host
    // Important: behind proxies, req.protocol might be 'http' but we need 'https'
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['host'] || req.get('host');
    const redirectUri = process.env.VITE_DERIV_REDIRECT_URI || `${protocol}://${host}/auth/callback`;
    
    // 1. Generate PKCE code_verifier
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    
    // 2. Derive code_challenge
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    
    // 3. Generate state
    const state = crypto.randomBytes(16).toString('hex');
    
    // Store verifier and state in signed cookies (survives server restarts)
    const cookieOptions = {
      maxAge: 15 * 60 * 1000, // 15 minutes
      httpOnly: true,
      secure: true,
      sameSite: 'none' as const,
      signed: true
    };

    res.cookie('pkce_verifier', codeVerifier, cookieOptions);
    res.cookie('oauth_state', state, cookieOptions);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'trade account_manage',
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    // Optional legacy app support
    if (process.env.VITE_DERIV_APP_ID) {
      params.append('app_id', process.env.VITE_DERIV_APP_ID);
    }

    const authUrl = `https://auth.deriv.com/oauth2/auth?${params.toString()}`;
    res.json({ url: authUrl });
  });

  // OAuth Callback Handler
  app.get(["/auth/callback", "/auth/callback/"], async (req, res) => {
    const { code, state, error, error_description } = req.query;

    if (error) {
      return res.send(`
        <html>
          <body>
            <script>
              window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: '${error_description}' }, '*');
              window.close();
            </script>
          </body>
        </html>
      `);
    }

    // Retrieve from signed cookies
    const codeVerifier = req.signedCookies.pkce_verifier;
    const storedState = req.signedCookies.oauth_state;

    if (!codeVerifier || !storedState || state !== storedState) {
      console.error("Auth state mismatch or PKCE verifier missing in cookies");
      return res.status(400).send("Authentication session expired or invalid state. Please try again.");
    }

    // Exchange code for token
    try {
      const clientId = process.env.VITE_DERIV_CLIENT_ID || "333ttXJvMqziMT0ErTbKd";
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const host = req.headers['host'] || req.get('host');
      const redirectUri = process.env.VITE_DERIV_REDIRECT_URI || `${protocol}://${host}/auth/callback`;

      console.log(`Exchanging code for token. ClientID: ${clientId}, Redirect: ${redirectUri}`);

      const response = await fetch("https://auth.deriv.com/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: clientId,
          code: code as string,
          code_verifier: codeVerifier,
          redirect_uri: redirectUri,
        }),
      });

      const data = await response.json();
      
      // Clear cookies
      res.clearCookie('pkce_verifier');
      res.clearCookie('oauth_state');

      if (data.error) {
        throw new Error(data.error_description || data.error);
      }

      // Success! Send data back to the browser
      res.send(`
        <html>
          <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #0f172a; color: white;">
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'OAUTH_AUTH_SUCCESS', 
                  token: '${data.access_token}',
                  expires_in: ${data.expires_in}
                }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <div style="text-align: center;">
              <h3>Authentication Successful</h3>
              <p>Closing window...</p>
            </div>
          </body>
        </html>
      `);
    } catch (err: any) {
      console.error("Token exchange failed:", err);
      res.status(500).send(`Authentication failed: ${err.message}`);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
