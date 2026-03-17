# Project: conductor-companion

## Overview

Build a mobile companion app for [Conductor](https://conductor.build) — a Rust/Tauri desktop application for AI-assisted development. The companion app allows users to view, interact with, and manage their Conductor workspaces and chats from their phone without needing to remote into their desktop.

The system has two parts:
1. **Bridge Server** — a lightweight Rust server that runs on the same machine as Conductor, exposing Conductor's data over HTTP/WebSocket
2. **Mobile App** — a React Native app (iOS + Android) that connects to the bridge server

---

## Architecture

```
┌──────────────┐       ┌──────────────────┐       ┌──────────────┐
│  Conductor   │◄─────►│  Bridge Server   │◄─────►│  Mobile App  │
│  (Tauri/Rust)│ local │  (Axum/Rust)     │  net  │ (React Native)│
│  Desktop App │ fs/db │  HTTP + WebSocket │       │  iOS/Android  │
└──────────────┘       └──────────────────┘       └──────────────┘
```

### Bridge Server (Rust / Axum)
- Runs as a background process on the same machine as Conductor
- Reads Conductor's local data store (investigate storage format — likely SQLite or flat files in Tauri's app data directory)
- Exposes a REST API + WebSocket for real-time updates
- Single-user auth model: one user per machine, matching Conductor's GitHub login model
- Sends push notifications via Firebase Cloud Messaging (FCM) / Apple Push Notification Service (APNs) when Conductor is waiting for plan approval or user input

### Mobile App (React Native)
- Connects to the bridge server
- Displays workspaces, chats, plans, and task status
- Supports read and write: view chat history, send messages, approve/reject plans, create new chats in existing workspaces
- Push notification support for approval requests

---

## Phase 0: Investigate Conductor's Data Layer

Before writing any code, investigate how Conductor stores its data locally:

1. Find Conductor's Tauri app data directory (typically `~/Library/Application Support/conductor.build/` on macOS or similar)
2. Identify the storage format — SQLite database? Flat JSON/YAML files? Something else?
3. Map out the data model:
   - How are **workspaces** structured and stored?
   - How are **chats/conversations** stored? What fields exist (messages, timestamps, roles, status)?
   - How are **plans** represented? What states can they be in (pending approval, approved, rejected, executing, complete)?
   - How does Conductor track **task status** (running, waiting for input, complete, errored)?
   - How does Conductor handle the **GitHub authentication** session?
4. Determine if Conductor has any IPC mechanism, local API, or CLI that could be used instead of reading storage directly
5. Document findings in `docs/conductor-data-model.md`

**This step is critical.** The entire bridge server design depends on understanding Conductor's internal data format. Do not proceed to implementation until this is documented.

---

## Phase 1: Bridge Server

### Tech Stack
- **Language:** Rust
- **Framework:** Axum (lightweight, async, excellent WebSocket support)
- **Rationale:** Native compatibility with Conductor's Rust codebase; potential to share types/structs; minimal resource overhead running alongside Conductor

### API Design

#### Authentication
- Single-user model: on first launch, generate a random API token and display it in the terminal / save to a config file
- All API requests require `Authorization: Bearer <token>` header
- WebSocket connections authenticate on the initial handshake

#### REST Endpoints

```
GET    /api/health                          — Server status + Conductor connection status
GET    /api/workspaces                      — List all workspaces
GET    /api/workspaces/:id                  — Get workspace details
GET    /api/workspaces/:id/chats            — List chats in a workspace
POST   /api/workspaces/:id/chats            — Create a new chat in a workspace
GET    /api/chats/:id                       — Get full chat history (messages, status, plan)
POST   /api/chats/:id/messages              — Send a message to a chat
POST   /api/chats/:id/plan/approve          — Approve a pending plan
POST   /api/chats/:id/plan/reject           — Reject a pending plan (with optional reason)
GET    /api/notifications                   — List pending notifications (approvals, errors, completions)
POST   /api/notifications/:id/dismiss       — Dismiss a notification
```

#### WebSocket

```
WS     /api/ws                              — Real-time event stream
```

Events pushed to the client:
- `chat.message` — new message in any chat
- `chat.status_changed` — chat status update (running → waiting, complete, error)
- `plan.pending_approval` — a plan needs user approval
- `plan.status_changed` — plan approved/rejected/executing/complete
- `workspace.updated` — workspace metadata changed

#### Push Notifications
- Integrate with FCM (Android) and APNs (iOS) for:
  - Plan awaiting approval
  - Task completed
  - Task errored
- Mobile app registers its device token via `POST /api/device-token`
- Bridge server sends push when Conductor enters a "waiting for approval" state
- Use a lightweight push notification crate (e.g., `a2` for APNs, `fcm` for Firebase)

### Configuration
- Config file at `~/.config/conductor-companion/config.toml`
- Settings: port (default 3847), bind address (default 0.0.0.0), Conductor data path (auto-detect with override), push notification credentials
- First-run setup wizard in terminal that generates the auth token and prints connection instructions

### Startup
- Can run standalone: `conductor-companion-server`
- Ideally, Conductor could launch it automatically in the future, but for V1 it runs independently
- Should detect if Conductor is running and warn if not

---

## Phase 2: Mobile App (React Native)

### Tech Stack
- **Framework:** React Native (Expo managed workflow for faster iteration)
- **State Management:** Zustand or React Context (keep it simple)
- **Navigation:** React Navigation
- **Push Notifications:** expo-notifications (wraps FCM + APNs)

### Screens

#### Connection Setup
- First launch: enter bridge server address (IP:port) and auth token
- Option to scan a QR code displayed by the bridge server for easy setup
- Save connection details locally
- Show connection status indicator throughout the app

#### Workspace List (Home)
- List of all workspaces with name, description, active chat count
- Badge showing pending approvals per workspace
- Pull-to-refresh

#### Chat List (per workspace)
- List of chats in a workspace, sorted by most recent activity
- Status indicators: running (spinner), waiting for approval (orange badge), complete (checkmark), error (red)
- Tap to open chat

#### Chat View
- Scrollable message history with role indicators (user / assistant / system)
- Input field at bottom to send new messages
- If a plan is pending approval: show plan details with Approve / Reject buttons prominently
- If Conductor is actively working: show streaming status / progress indicator
- Code blocks should be syntax-highlighted and horizontally scrollable

#### New Chat
- Accessible from the chat list screen
- Text input for the initial message
- Sends to the selected workspace

#### Notifications
- Tab or badge-accessible list of pending items
- Tapping a notification navigates to the relevant chat

### Design Principles
- Dark mode by default (matches typical dev tool aesthetic), with light mode option
- Minimal, fast, focused — this is a companion tool, not a replacement for the desktop app
- Offline-tolerant: show cached data when disconnected, queue messages for when reconnected

---

## Phase 3: Network Access

### Local Network (automatic)
- Bridge server binds to `0.0.0.0` by default, so it's accessible on LAN immediately
- Mobile app connects via local IP (e.g., `192.168.1.x:3847`)
- Zero additional setup required

### Remote Access
Provide documentation and optional setup scripts for two approaches:

#### Option A: Tailscale (recommended, simplest)
- Install Tailscale on the desktop machine and phone
- Connect to bridge server via Tailscale IP (e.g., `100.x.y.z:3847`)
- End-to-end encrypted, no port forwarding, works through NAT
- Include setup guide in `docs/remote-access-tailscale.md`

#### Option B: Cloudflare Tunnel (alternative, no client needed on phone)
- Install `cloudflared` on the desktop machine
- Create a tunnel to `localhost:3847`
- Access via a public URL (e.g., `conductor.yourdomain.com`)
- Better for sharing with teammates or if Tailscale isn't an option
- Include setup guide in `docs/remote-access-cloudflare.md`

---

## Project Structure

```
conductor-companion/
├── server/                     # Rust bridge server
│   ├── Cargo.toml
│   ├── src/
│   │   ├── main.rs
│   │   ├── config.rs           # Config file management
│   │   ├── auth.rs             # Token auth middleware
│   │   ├── conductor/          # Conductor data layer integration
│   │   │   ├── mod.rs
│   │   │   ├── data.rs         # Read/watch Conductor's storage
│   │   │   └── models.rs       # Shared data models
│   │   ├── api/                # REST endpoints
│   │   │   ├── mod.rs
│   │   │   ├── workspaces.rs
│   │   │   ├── chats.rs
│   │   │   └── notifications.rs
│   │   ├── ws.rs               # WebSocket handler
│   │   └── push.rs             # Push notification sender
│   └── docs/
│       ├── conductor-data-model.md
│       ├── remote-access-tailscale.md
│       └── remote-access-cloudflare.md
├── mobile/                     # React Native app
│   ├── package.json
│   ├── app.json                # Expo config
│   ├── src/
│   │   ├── screens/
│   │   │   ├── ConnectionSetup.tsx
│   │   │   ├── WorkspaceList.tsx
│   │   │   ├── ChatList.tsx
│   │   │   ├── ChatView.tsx
│   │   │   └── NewChat.tsx
│   │   ├── components/
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── PlanApproval.tsx
│   │   │   ├── StatusBadge.tsx
│   │   │   └── CodeBlock.tsx
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts
│   │   │   └── useBridgeAPI.ts
│   │   ├── stores/
│   │   │   └── appStore.ts
│   │   └── utils/
│   │       ├── api.ts          # REST client
│   │       └── notifications.ts
│   └── assets/
├── scripts/
│   ├── setup.sh                # First-time setup script
│   └── generate-token.sh       # Auth token generator
├── README.md
├── LICENSE
└── .github/
    └── workflows/
        └── ci.yml
```

---

## Implementation Order

1. **Phase 0** — Investigate Conductor's data layer, document findings
2. **Phase 1a** — Bridge server: config, auth, health check, workspace/chat read endpoints
3. **Phase 1b** — Bridge server: WebSocket events, write endpoints (send message, approve/reject plan)
4. **Phase 1c** — Bridge server: push notification integration
5. **Phase 2a** — Mobile app: connection setup, workspace list, chat list (read-only views)
6. **Phase 2b** — Mobile app: chat view with messaging, plan approval UI
7. **Phase 2c** — Mobile app: push notifications, new chat creation
8. **Phase 3** — Remote access documentation and setup scripts

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Bridge server language | Rust (Axum) | Native compat with Conductor's Rust/Tauri stack |
| Mobile framework | React Native (Expo) | Cross-platform, native feel, push notification support |
| Auth model | Single-user bearer token | Matches Conductor's one-GitHub-account-per-app model |
| Real-time updates | WebSocket | Low latency for chat messages and status changes |
| Push notifications | FCM + APNs | Required for plan approval alerts |
| Local network access | 0.0.0.0 bind | Works out of the box on LAN |
| Remote access | Tailscale (primary) / Cloudflare Tunnel (alt) | No port forwarding, encrypted, easy setup |
| Day-one interaction | Read-write | Create chats, send messages, approve plans from V1 |
| New workspace creation | Not in V1 | Create new chats in existing workspaces only |

---

## Non-Goals for V1

- Creating new workspaces from mobile
- File editing or code review from mobile
- Running Conductor commands directly
- Multi-user / team features
- App Store / Play Store distribution (sideload or TestFlight for now)

---

## Open Questions to Resolve During Phase 0

- What is Conductor's exact storage format and location?
- Does Conductor have any IPC/API/CLI we can hook into instead of reading storage directly?
- Can we watch Conductor's data files for changes (fs events) or do we need to poll?
- How does Conductor represent a "plan awaiting approval" in its data model?
- Is there a clean way to inject a user message into a chat without Conductor's UI?