# Comic Animator - Todo

## Phase 1: Database & Schema
- [x] Add projects table (id, userId, name, aspectRatio, createdAt, updatedAt)
- [x] Add panels table (id, projectId, order, backgroundUrl, duration, transition)
- [x] Add layers table (id, panelId, type, imageUrl, x, y, width, height, animations JSON)
- [x] Run database migration
- [x] Add server-side tRPC routers for projects, panels, layers

## Phase 2: Upload & Editor UI
- [x] Landing/login page with auth
- [x] Dashboard: list of user projects
- [x] New project page: choose aspect ratio (9:16 or 4:3)
- [x] Panel editor: upload background image
- [x] Layer manager: upload character PNG layers
- [x] Layer positioning: drag to reposition layers on canvas
- [x] Layer resize handles (width/height sliders)
- [x] Panel timeline: list panels, add/delete

## Phase 3: Animation Engine
- [x] Animation types: blink, wink-left, wink-right
- [x] Animation types: eye movement (look left/right/up/down, wander)
- [x] Animation types: wave hand, hug, kiss
- [x] Animation types: laugh (shake/bounce)
- [x] Animation types: fat/thin illusion (scaleX squash/stretch)
- [x] Animation types: ear scale (big/small)
- [x] Animation types: hair fly (sway)
- [x] Animation types: sit down, get up
- [x] Animation types: walk cycle, run cycle
- [x] Animation types: crawl
- [x] Animation types: move left/right across scene
- [x] Animation types: pan & zoom on panel
- [x] Animation types: fade in/out, bounce, shake, spin, float
- [x] Per-layer animation assignment UI
- [x] Animation timing controls (start time, duration, intensity, repeat)
- [x] Unit tests for animation engine (13 tests passing)

## Phase 4: Preview & Export
- [x] Reel preview player (canvas-based playback with play/pause)
- [x] Export as WebM video using MediaRecorder API
- [x] Export quality and FPS controls
- [x] Export progress indicator
- [ ] Test export end-to-end with real panels

## Phase 5: Polish & User Accounts
- [x] User login/logout (via Manus OAuth)
- [x] Project save/load from database
- [x] Project rename/delete
- [ ] Edit username
- [ ] Limit registration to 3 users
- [ ] Responsive design improvements
- [ ] Push final code to GitHub
