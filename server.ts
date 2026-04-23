import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API Route for token exchange
  app.post("/api/deriv/token", async (req, res) => {
    const { code, code_verifier, redirect_uri, client_id } = req.body;

    if (!code || !code_verifier || !redirect_uri || !client_id) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    try {
      const response = await fetch("https://auth.deriv.com/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id,
          code,
          code_verifier,
          redirect_uri,
        }).toString(),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Deriv Token Error:", data);
        return res.status(response.status).json(data);
      }

      res.json(data);
    } catch (error) {
      console.error("Server Token Error:", error);
      res.status(500).json({ error: "Internal server error during token exchange" });
    }
  });

  // Proxy route for Deriv Accounts
  app.get("/api/deriv/accounts", async (req, res) => {
    const token = req.headers.authorization;
    const appId = req.headers['x-deriv-app-id'] || process.env.VITE_DERIV_APP_ID || '33433';

    if (!token) return res.status(401).json({ error: "Unauthorized" });

    try {
      console.log(`Fetching Deriv accounts for App ID: ${appId}`);
      const response = await fetch("https://api.derivws.com/trading/v1/options/accounts", {
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
        console.warn("Deriv returned non-JSON response:", text);
        data = { error: { message: text || "Invalid response from Deriv" } };
      }
      
      if (!response.ok) {
        console.error("Deriv Accounts Fetch Failed:", {
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
    const appId = req.headers['x-deriv-app-id'] || process.env.VITE_DERIV_APP_ID || '33433';

    if (!token) return res.status(401).json({ error: "Unauthorized" });

    try {
      console.log(`Requesting OTP for Account: ${accountId} using App ID: ${appId}`);
      const response = await fetch(`https://api.derivws.com/trading/v1/options/accounts/${accountId}/otp`, {
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
        console.warn("Deriv (OTP) returned non-JSON response:", text);
        data = { error: { message: text || "Invalid response from Deriv" } };
      }
      
      if (!response.ok) {
        console.error("Deriv OTP Request Failed:", {
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

  // OAuth Callback Bridge (for popup flow)
  app.get(["/callback", "/api/auth/callback"], (req, res) => {
    const { code, state, error } = req.query;
    
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
