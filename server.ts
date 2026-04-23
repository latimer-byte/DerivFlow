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
    const appId = req.headers['x-deriv-app-id'] || '33433';

    if (!token) return res.status(401).json({ error: "Unauthorized" });

    try {
      const response = await fetch("https://api.derivws.com/trading/v1/options/accounts", {
        headers: {
          "Authorization": token,
          "Deriv-App-ID": appId.toString()
        }
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch accounts" });
    }
  });

  // Proxy route for Deriv OTP
  app.post("/api/deriv/otp/:accountId", async (req, res) => {
    const { accountId } = req.params;
    const token = req.headers.authorization;
    const appId = req.headers['x-deriv-app-id'] || '33433';

    if (!token) return res.status(401).json({ error: "Unauthorized" });

    try {
      const response = await fetch(`https://api.derivws.com/trading/v1/options/accounts/${accountId}/otp`, {
        method: "POST",
        headers: {
          "Authorization": token,
          "Deriv-App-ID": appId.toString()
        }
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch OTP" });
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
