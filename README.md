# Anon Chat — NGL-style Anonymous Messaging App

A self-hosted anonymous messaging app: create an account, get a shareable
link, and receive anonymous messages from anyone who visits it. Built with
Node.js, Express, EJS, and MongoDB (via Mongoose).

## Features  

- **App-shell UI** — sidebar navigation on desktop, bottom nav on mobile;
  Home, Inbox, and Settings as separate app sections, fully responsive
- **Landing page** — a "Get Started" page at `/` for logged-out visitors
- **Multi-step signup** — username + display name → password → optional
  profile photo, with a progress-dot indicator
- **Accounts** — signup/login with hashed passwords (bcrypt) and sessions
- **Settings page** — update display name, profile photo, password, or
  delete your account
- **Anonymous link** — every user gets `yoursite.com/u/username`
- **Prompt templates** — visitors see a rotating prompt pulled from the
  database; add your own anytime
- **List-style inbox** — messages appear as rows; unread ones show
  "New Message!" in an accent color with a colored icon, read ones show a
  body preview with a muted icon. Tap a row to open the full message
- **Message detail view** — an animated gradient header card (the header
  color continuously sweeps rather than sitting static), with message
  actions tucked into a three-dot menu: Share, Report, Block Sender, Delete
- **Block Sender** — blocks a specific anonymous sender from messaging you
  again, without ever exposing who they are (see "How Block Sender Works"
  below)
- **Shareable link card** — sharing your link (Home tab → Share) generates a
  branded image — your avatar, display name, username, and the "Send me
  anonymous messages!" tagline — attached alongside the link where supported
- **Shareable message cards** — any received message can be exported as a
  downloadable/shareable PNG card
- **Auto-refreshing inbox** — polls for new messages every 15 seconds
- **Relative timestamps** — "13 minutes ago", "2 days ago", "3 weeks ago",
  etc. (seconds through years), refreshed every 30 seconds
- **Profile photos** — uploaded via Settings, stored as files, shown in the
  sidebar/mobile header and on your public send-message page
- **Custom favicon & Apple touch icon**
- **"Powered by DevAfeez" badge** — dismissible, bottom-right, on every page.
  Dismissing it only lasts for that page view — it always reappears on the
  next refresh, by design
- **Basic spam protection** — rate limiting (5 messages/minute per IP)
- **All interface icons are SVG** — no emoji glyphs in nav bars, buttons,
  badges, or message icons, for consistent rendering everywhere

## What This Update Deliberately Does NOT Include

You asked for a "Sender Hint" feature (showing a message's sender IP,
location, and device) gated behind an admin page. I didn't build that, and
want to be upfront about why rather than quietly dropping it.

This app's entire premise is that senders are anonymous. A feature that
unmasks a sender's IP, location, and device for the recipient to view
directly breaks that promise for anyone using the app trusting its stated
purpose — an admin gate doesn't change that, since building the
de-anonymization capability itself is the actual harm surface, not just who
holds the toggle. So there's no admin panel and no sender IP/location/device
capture or display anywhere in this codebase.

**Block Sender is still fully implemented** — just built differently, in a
way that never requires storing or exposing a sender's real identity.

## How Block Sender Works Without Breaking Anonymity

When someone sends a message, the server computes an HMAC-SHA256 hash of
their IP address, keyed with a secret (`IP_HASH_SECRET` in `.env`), and
stores only that hash on the message (`sender_hash` — see
`utils/senderHash.js`).

- Because it's an HMAC (not a bare hash), the sender's real IP **cannot be
  recovered** from the stored hash — not by you, not by an attacker, not by
  an admin. It's only useful for one thing: checking whether two messages
  came from the same sender.
- Clicking **Block Sender** on a message records
  `(your account, that message's sender_hash)` in a `BlockedSender`
  collection.
- The next time anyone messages you, the server hashes their IP the same way
  and checks it against your blocked list. A match gets a generic "not
  accepting messages from you right now" response, rejected before anything
  is stored.
- **The client never receives `sender_hash` at all** — it's marked
  `select: false` on the schema and excluded from every API response. It
  exists purely as a server-side matching key.

The tradeoff: this blocks by IP, so it won't catch someone who switches
networks or uses a VPN, and could rarely over-block people who share an IP
(e.g. behind restrictive NAT). That's the honest ceiling of what's possible
without compromising anonymity — a stronger fingerprint would mean tracking
more about senders, which is exactly what this app promises not to do.

## Project Structure

```
ANON-CHAT/
├── server.js                 # App entry point
├── db.js                     # Mongoose schemas: User, Template, Message, BlockedSender
├── middleware.js              # requireAuth guard
├── utils/
│   └── senderHash.js          # HMAC sender-IP hashing (Block Sender only)
├── routes/
│   ├── auth.js                 # signup, login, logout
│   ├── dashboard.js            # inbox API, read/report/block/delete
│   ├── settings.js             # profile/password/account settings
│   └── public.js               # public /u/:username send page + block check
├── views/                     # EJS templates
│   ├── partials/
│   │   ├── header.ejs            # <head>, favicon/apple-icon, Roboto font
│   │   └── footer.ejs            # DevAfeez badge, toast container, scripts
│   ├── landing.ejs               # "Get Started" landing page
│   ├── login.ejs
│   ├── signup.ejs                # 3-step wizard
│   ├── dashboard.ejs             # app shell: Home + Inbox tabs, detail overlay
│   ├── settings.ejs              # profile/password/delete account
│   ├── send-message.ejs
│   └── 404.ejs
├── public/
│   ├── css/style.css
│   ├── js/main.js                # badge, toast, relative time, share-card rendering
│   └── uploads/                  # uploaded profile photos (multer)
├── .env.example
└── package.json
```

## Setup

1. **Install dependencies** (requires internet access):
   ```bash
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   ```
   Fill in:
   - `MONGODB_URI` — your MongoDB connection string (Atlas or self-hosted)
   - `SESSION_SECRET` — a long random string
   - `IP_HASH_SECRET` — a **different** long random string, used only for
     the Block Sender hashing above — keep it separate from
     `SESSION_SECRET` so rotating one doesn't affect the other

   Generate random strings with:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. **Run it**:
   ```bash
   npm start
   ```
   Visit `http://localhost:3000`. For development with auto-restart:
   ```bash
   npm run dev
   ```

## How It Works

- Visitors land on `/` and see the "Get Started" landing page.
- Signup is a 3-step flow: username + display name → password → optional
  profile photo. Nothing is submitted until the final step.
- The dashboard is an app shell with **Home** (link, share tools, quick
  stats), **Inbox** (messages), and **Settings** — sidebar nav on desktop,
  bottom nav on mobile.
- Your Inbox shows messages as a list. Unread messages show "New Message!"
  in pink with a colored icon; read ones show a text preview with a muted
  icon. Tap a row to open the full message.
- The message detail view has an animated gradient header and a three-dot
  menu (top-right) with Share, Report, Block Sender, and Delete.
- The Inbox polls every 15 seconds for new messages, showing a toast when
  new ones arrive — no manual refresh needed.

**Note:** the dashboard renders the inbox with client-side JavaScript (for
live polling and instant actions), so JavaScript needs to be enabled for it
to work. This only affects the dashboard — the public send-message page
works without JS.

## Share Cards

Two different share images, both rendered client-side via the Canvas API
(no external image library):

1. **Link share card** (Home tab → Share) — your avatar, display name,
   username, and the "Send me anonymous messages!" tagline.
2. **Message share card** (message detail → Share) — a card showing a
   received message, always captioned "Send me anonymous messages!" (fixed,
   regardless of that message's actual randomized prompt) so every shared
   card looks consistent.

On devices/browsers that support the Web Share API with file attachments
(most mobile browsers), Share opens the native share sheet with the image
and caption pre-attached — the person then picks WhatsApp, Instagram,
Snapchat, or anything installed. Everywhere else, it downloads the PNG and
falls back to a platform-specific link:

- **WhatsApp** and **Snapchat** support real share-intent URLs (`wa.me` and
  Snapchat's `attachmentUrl` scheme), so the fallback opens the app/site
  with your link pre-filled.
- **Instagram has no public URL scheme for pre-filling a share** with an
  arbitrary link or image (a platform limitation). The fallback copies your
  link and opens instagram.com so you can paste it manually.

## Message Actions

- **Share** — see above.
- **Report** — flags the message (`flagged: true`). Nothing acts on flagged
  messages automatically yet — no admin view, no auto-filtering (see the
  section above on why there's no admin panel).
- **Block Sender** — see the dedicated section above.
- **Delete** — removes the message permanently.

## Typography & Icons

- Base font is **Roboto** (Google Fonts), replacing the system font stack
  for a more consistent, app-like look across platforms.
- Share-card text uses Roboto at 400–500 weight and smaller sizes, per your
  request — the in-app UI keeps a slightly bolder weight scale (500–800)
  for visual hierarchy.
- Every interface icon — nav items, message icons, action buttons, badges —
  is a hand-drawn inline SVG instead of an emoji glyph, since emoji
  rendering varies across OS/browser combinations.

## Bugs Fixed This Round

While rebuilding these sections, a few pre-existing issues surfaced and got
fixed along the way:

- **Settings page was broken** — `routes/settings.js` read
  `req.session.user._id` on the profile/password/delete routes, but the
  session is set at login/signup as `{ id, username }` (no `_id`). Every
  POST to Settings besides the initial page load hit
  `User.findById(undefined)` and failed. Fixed by using
  `req.session.user.id` consistently.
- **Login/signup/landing pages had the wrong background** — CSS defined
  `body.auth-page`/`body.landing-page` classes for the gradient background,
  but no template ever applied those classes, so those pages silently fell
  back to the dark dashboard background. Fixed by making the gradient the
  default `body` background again (the dashboard's `.app-shell` already
  overrides it at the container level, so the dashboard is unaffected).
- **Message rows were likely unclickable** — MongoDB IDs are strings, but
  old inline `onclick` handlers interpolated them unquoted
  (`onclick="openMessage(${m.id})"`), which produces invalid JavaScript once
  rendered. Fixed by quoting all ID interpolations in onclick attributes.
- **Relative timestamps could show "Invalid Date"** — the formatting helper
  was written for SQLite's naive timestamp format and blindly appended "Z".
  MongoDB timestamps are already full ISO strings with a timezone, so the
  old code appended a second "Z" and produced an unparseable string. Fixed
  by detecting which format is present before transforming it.

## Responsive Design

- **≥900px (desktop/tablet)** — persistent sidebar, no bottom nav.
- **<900px (tablet/mobile)** — sidebar hides; a compact top header and
  bottom nav bar take over.
- **<480px (small phones)** — link box and buttons stack vertically, stat
  cards tighten up, the message detail overlay and gradient header shrink
  their padding/font sizes, and toasts wrap instead of overflowing.

## Profile Photos

Photos are uploaded via **Settings** and stored as actual files (via
`multer`) in `public/uploads/`, referenced by URL rather than as base64
data. Two things worth knowing for deployment:

- `public/uploads/` needs to be **writable** wherever you deploy.
- It also needs to be on **persistent storage** — many container/serverless
  hosts wipe local disk on every deploy or restart, which would delete
  uploaded avatars. Mount a persistent volume at `public/uploads/`, or
  switch to object storage (S3-compatible) if deploying somewhere ephemeral.

## Managing Prompt Templates

Templates live in the `templates` MongoDB collection, seeded automatically
on first run (see the `defaults` array in `db.js`). To add, edit, or disable
prompts, connect to your MongoDB instance directly (`mongosh` or MongoDB
Compass) and update the collection. There's no admin UI for this yet.

## Deployment Notes

1. Set `MONGODB_URI`, `SESSION_SECRET`, `IP_HASH_SECRET`, and
   `NODE_ENV=production` on your host.
2. If you're behind a reverse proxy and want accurate IPs (for rate limiting
   and Block Sender), make sure `app.set('trust proxy', 1)` is set in
   `server.js` — check whether your host handles this automatically.
3. Make sure `public/uploads/` is on persistent, writable storage (above).
4. Run `npm install && npm start` as your build/start commands.
5. Put it behind HTTPS — the session cookie is marked `secure` in
   production and requires HTTPS to work.

## Security Notes / Things to Harden Before a Real Launch

- **Rate limiting** is per-IP and in-memory — resets on restart, won't help
  across multiple server instances. Use Redis with `express-rate-limit` for
  real scale.
- **Content moderation** — Report flags a message but nothing acts on it yet
  (deliberately no admin view — see above). No profanity/abuse filter on
  incoming messages either.
- **Account recovery** — no "forgot password" flow yet.
- **Input validation** is basic — consider `zod` or `joi` if the form
  surface grows.
- **Polling load** — every open dashboard tab polls every 15 seconds. Fine
  for personal use; consider WebSockets/SSE at higher scale.

## Possible Next Features

- Let users choose which template shows on their link (instead of random)
- Reply-to-message feature
- Image/GIF attachments in messages
- Email or push notification when a new message arrives
- A UI for managing prompt templates without touching MongoDB directly
- Object storage (S3-compatible) for profile photos instead of local disk

## Tech Stack

- **Backend**: Node.js, Express
- **Views**: EJS (server-rendered, no build step)
- **Database**: MongoDB via Mongoose
- **Auth**: `express-session` + `bcrypt`
- **File uploads**: `multer`
- **Rate limiting**: `express-rate-limit`
- **Fonts**: Roboto (Google Fonts)
