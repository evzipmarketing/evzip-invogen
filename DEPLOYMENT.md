# Deploy EVZIP - Invogen to Render

Get your app online so your team can use it from anywhere.

**Quick checklist:**
1. Push code to GitHub
2. Go to [render.com](https://render.com) → New → Blueprint
3. Connect your repo (Render reads `render.yaml` automatically)
4. Share the live URL with your team

---

## Render Setup

Render works well with Puppeteer and offers a free tier. Your team will get a URL like `https://evzip-invogen.onrender.com`.

### Prerequisites

1. **GitHub account** – [github.com](https://github.com)
2. **Render account** – [render.com](https://render.com) (free signup)

### Steps

1. **Push your code to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/evzip-invogen.git
   git push -u origin main
   ```

2. **Deploy with Blueprint (one-click)**
   - Go to [dashboard.render.com](https://dashboard.render.com)
   - Click **New** → **Blueprint**
   - Connect your GitHub account and select the `invoice-generator` (or `evzip-invogen`) repo
   - Render will read `render.yaml` and create the service automatically
   - Click **Apply**

3. **Or create manually**
   - **New** → **Web Service** → select your repo
   - Build Command: `bash render-build.sh`
   - Start Command: `npm start`
   - Instance Type: Free

4. **Wait for the build** (first build may take 5–10 min for Chrome)

5. **Share the URL** with your team (e.g. `https://evzip-invogen.onrender.com`)

### Notes

- **Free tier**: Services spin down after 15 min of inactivity. First request after that may take 30–60 seconds to wake up.
- **Paid tier** ($7/mo): Keeps the app always on for faster response.
- **File size**: Free tier has memory limits; for large Excel files (500+ rows), consider a paid instance.

---

## Option 2: Railway

Similar to Render, with a simple deployment flow.

1. Go to [railway.app](https://railway.app) and sign up
2. **New Project** → **Deploy from GitHub** → select your repo
3. Railway auto-detects Next.js. Use:
   - **Build**: `npm install && npm run build`
   - **Start**: `npm start`
4. For Puppeteer, add a `nixpacks.toml` or use a Dockerfile with Chromium. Railway supports Docker.
5. Get your public URL from the project settings.

---

## Option 3: Vercel (Limited)

Vercel is easy for Next.js but **not ideal** for this app because:
- Serverless functions have short timeouts (10–60 sec)
- PDF generation with Puppeteer needs extra setup (`puppeteer-core` + `@sparticuz/chromium`)
- Large file uploads may hit body size limits

Use Vercel only for small batches or if you switch to a different PDF library.

---

## Option 4: Self-Hosted (VPS)

For full control, run on a VPS (DigitalOcean, AWS EC2, etc.):

1. **Create a server** (Ubuntu 22.04, 1GB RAM minimum)
2. **Install Node.js** (v18+)
3. **Clone and run**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/evzip-invogen.git
   cd evzip-invogen
   npm install
   npm run build
   npm start
   ```
4. Use **PM2** for process management: `pm2 start npm --name invogen -- start`
5. Set up **Nginx** as reverse proxy and **SSL** (Let's Encrypt)

---

## Quick Comparison

| Platform | Free Tier | Puppeteer | Best For |
|----------|-----------|-----------|----------|
| **Render** | Yes | ✅ Built-in | Recommended |
| **Railway** | $5 credit/mo | ✅ With config | Good alternative |
| **Vercel** | Yes | ⚠️ Complex | Small batches only |
| **VPS** | No | ✅ Full control | Enterprise / high volume |

---

## After Deployment

- Share the live URL with your team
- Consider adding authentication later (e.g. password protection) if the data is sensitive
- Monitor usage on the platform dashboard
