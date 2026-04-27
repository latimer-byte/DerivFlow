import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Logger for debugging
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", mode: process.env.NODE_ENV || "development" });
  });

  // API Route for token exchange
  app.post("/api/deriv/token", async (req, res) => {
    console.log("POST /api/deriv/token received");
    const { code, code_verifier, redirect_uri, client_id } = req.body;

    if (!code || !code_verifier || !redirect_uri || !client_id) {
      console.error("Missing parameters in /api/deriv/token:", { 
        hasCode: !!code, 
        hasVerifier: !!code_verifier, 
        hasRedirect: !!redirect_uri, 
        hasClientId: !!client_id 
      });
      return res.status(400).json({ error: "Missing required parameters" });
    }

    try {
      // Try the /oauth2/token endpoint
      console.log(`Exchanging code for token with client_id: ${client_id}`);
      
      const params = new URLSearchParams({
        grant_type: "authorization_code",
        client_id,
        code,
        code_verifier,
        redirect_uri,
      });

      const response = await fetch("https://auth.deriv.com/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json"
        },
        body: params.toString(),
      });

      let responseText = await response.text();
      let data: any;
      
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (e) {
        console.error("Failed to parse Deriv response:", responseText);
        data = { error: responseText || "Invalid response format" };
      }

      if (!response.ok) {
        console.error(`Deriv Token Exchange Failed (Status ${response.status}):`, data);
        
        // If 405, maybe it's the wrong endpoint, but Ory usually returns 405 for certain config issues.
        // Let's return a clearer error to the user
        if (response.status === 405) {
          return res.status(405).json({ 
            error: "The authentication terminal rejected the handshake method (405). This usually means the App ID is not configured for Authorization Code flow or the redirect URI doesn't match the dashboard exactly." 
          });
        }
        
        return res.status(response.status).json(data);
      }

      console.log("Token exchange successful!");
      res.json(data);
    } catch (error: any) {
      console.error("Server Token Error:", error);
      res.status(500).json({ error: error.message || "Internal server error during token exchange" });
    }
  });

  // Proxy route for Deriv Accounts
  app.get("/api/deriv/accounts", async (req, res) => {
    const token = req.headers.authorization;
    const appId = req.headers['x-deriv-app-id'] || process.env.VITE_DERIV_APP_ID || '336Jcj20DczhY7sKLv2Ri';

    if (!token) return res.status(401).json({ error: "Unauthorized" });

    try {
      console.log(`Fetching Deriv accounts for App ID: ${appId}`);
      // Hub API typically sits on hub.deriv.com for modern options trading
      const response = await fetch("https://hub.deriv.com/api/v1/trading/options/accounts", {
        headers: {
          "Authorization": token,
          "Deriv-App-ID": appId.toString()
        }
      });
      
      const contentType = response.headers.get("content-type");
      let data;
      
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.warn("Deriv Hub returned non-JSON response:", text);
        data = { error: { message: text || "Invalid response from Deriv" } };
      }
      
      if (!response.ok) {
        console.error("Deriv Hub Accounts Fetch Failed:", {
          status: response.status,
          error: data
        });
      }
      
      res.status(response.status).json(data);
    } catch (error: any) {
      console.error("Internal Proxy Error (Accounts):", error);
      res.status(500).json({ error: error.message || "Failed to fetch accounts" });
    }
  });

  // Proxy route for Deriv OTP
  app.post("/api/deriv/otp/:accountId", async (req, res) => {
    const { accountId } = req.params;
    const token = req.headers.authorization;
    const appId = req.headers['x-deriv-app-id'] || process.env.VITE_DERIV_APP_ID || '336Jcj20DczhY7sKLv2Ri';

    if (!token) return res.status(401).json({ error: "Unauthorized" });

    try {
      console.log(`Requesting OTP for Account: ${accountId} using App ID: ${appId}`);
      const response = await fetch(`https://hub.deriv.com/api/v1/trading/options/accounts/${accountId}/otp`, {
        method: "POST",
        headers: {
          "Authorization": token,
          "Deriv-App-ID": appId.toString()
        }
      });
      
      const contentType = response.headers.get("content-type");
      let data;
      
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.warn("Deriv Hub (OTP) returned non-JSON response:", text);
        data = { error: { message: text || "Invalid response from Deriv" } };
      }
      
      if (!response.ok) {
        console.error("Deriv Hub OTP Request Failed:", {
          status: response.status,
          error: data
        });
      }
      
      res.status(response.status).json(data);
    } catch (error: any) {
      console.error("Internal Proxy Error (OTP):", error);
      res.status(500).json({ error: error.message || "Failed to fetch OTP" });
    }
  });

  // OAuth Callback Bridge (for popup flow)
  // This MUST be before Vite/Static middleware to ensure it's caught correctly
  app.get(["/callback", "/api/auth/callback"], (req, res) => {
    const { code, state, error, token1, acct1, token, acct } = req.query;
    
    // Return a simple HTML page that communicates with the main window
    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Authentication Sync</title></head>
        <body style="background: #0f1115; color: #ffffff; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
          <div style="text-align: center;">
            <div style="width: 40px; height: 40px; border: 3px solid rgba(255,100,100,0.3); border-top-color: #ff444f; border-radius: 50%; animate: spin 1s linear infinite; margin-bottom: 20px; display: inline-block;"></div>
            <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
            <p id="status" style="font-weight: bold; text-transform: uppercase; letter-spacing: 0.1em; font-size: 12px;">Syncing session...</p>
          </div>
          <script>
            const data = { 
              type: 'DERIV_AUTH_COMPLETE', 
              code: ${JSON.stringify(code)}, 
              token: ${JSON.stringify(token1 || token)},
              accountId: ${JSON.stringify(acct1 || acct)},
              state: ${JSON.stringify(state)},
              error: ${JSON.stringify(error)}
            };
            
            if (window.opener) {
              window.opener.postMessage(data, '*');
              document.getElementById('status').innerText = 'Authenticated. Closing...';
              setTimeout(() => window.close(), 1000);
            } else {
              document.getElementById('status').innerText = 'Handshake failed: No parent window found.';
              setTimeout(() => window.location.href = '/', 2000);
            }
          </script>
        </body>
      </html>
    `);
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
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
