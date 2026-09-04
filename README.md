# 🎲 Royal Ludo & Taas Arena (Online Multiplayer)

A high-performance, real-time multiplayer board and card game suite built with React 19, TypeScript, Vite, Tailwind CSS, and WebRTC.

---

## 🌟 Features

- **🌐 Serverless P2P Online Multiplayer (WebRTC)**:
  - Create custom private rooms with a 6-character room code or direct shareable invite link (`?room=CODE`).
  - Supports 2 to 4 concurrent human players with deterministic color seating:
    - **Seat 0 (Red)**: Room Host (Authoritative controller)
    - **Seat 1 (Green)**: Guest 1
    - **Seat 2 (Yellow)**: Guest 2
    - **Seat 3 (Blue)**: Guest 3
  - **Host-Authoritative Turn Isolation**: Guests send action requests to the host; the host validates game phase, moves, and dice values before broadcasting synchronized game snapshots.
  - **Seamless Bot Takeover**: If a guest player disconnects mid-game, an AI bot automatically takes over their turns to prevent match stall or deadlocks.
  - **Zero Server Costs**: Powered by WebRTC data channels with Google STUN infrastructure ($0 hosting overhead).

- **🎮 Game Suite**:
  - **Royal Ludo**: Classic & Luxury 3D boards, animated pawn hops, combat captures, safe stars, auto-play mode with adjustable speeds (Normal, Fast, Turbo), sound effects, and celebration bursts.
  - **Snakes & Ladders**: Dynamic board with audio and particle feedback.
  - **Traditional Card Games**: CallBreak, Poker, Teen Patti, Jut Patti, Dhumbal.

---

## 🚀 Quick Start (Local Development)

```bash
# 1. Install dependencies
npm install

# 2. Start local dev server
npm run dev

# 3. Run test suite
npm test

# 4. Build for production
npm run build
```

---

## 🌐 Deploy to Vercel & Custom Domain

### Step 1: Push to GitHub
Repository: `https://github.com/Siddarthaisback/LUDO_multiplayer.git`

### Step 2: Import Project on Vercel
1. Go to [vercel.com](https://vercel.com) and log in with your GitHub account.
2. Click **Add New...** -> **Project**.
3. Select the `LUDO_multiplayer` repository and click **Import**.
4. Framework Preset: **Vite** (detected automatically).
5. Build Command: `npm run build`
6. Output Directory: `dist`
7. Click **Deploy**. Your game is now live on `https://your-project.vercel.app`!

### Step 3: Add Your Custom Domain
1. In your Vercel Project Dashboard, navigate to **Settings** -> **Domains**.
2. Type your domain (e.g., `ludogame.com` or `play.yourdomain.com`) and click **Add**.
3. Vercel will provide the required DNS records:
   - For an apex domain (`example.com`): Add an **A Record** pointing to `76.76.21.21`.
   - For a subdomain (`play.example.com`): Add a **CNAME Record** pointing to `cname.vercel-dns.com`.
4. Log into your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.) and save the DNS records.
5. Vercel will automatically provision a free SSL certificate within a few minutes.

---

## 🧪 Testing

The repository includes a comprehensive unit test suite covering:
- Pure game engine rules and movement legality
- Room code generation & URL normalization
- Lobby capacity limits and deterministic seat assignment
- Fail-closed protocol version matching
- Idempotent in-flight request handling
- Host-side sender verification and guest disconnect handling

```bash
npm test
```
