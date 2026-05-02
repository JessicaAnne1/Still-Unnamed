# Mystify Band App — Build Plan

A mobile-first single-page app for a four-piece band (Michael, Steve, Justyn, Tom) to manage repertoire, set lists, links, and notes. Hosted on GitHub Pages, backed by Google Apps Script + a single Google Sheet.

---

## 1. Decisions locked in

| # | Topic | Decision |
|---|-------|----------|
| 1 | Auth | Shared token baked into the JS. Apps Script rejects requests without it. Not real security — just stops random scrapers. |
| 2 | CORS | POST as `text/plain`, parse JSON server-side. Avoids preflight pain. |
| 3 | Fortnight | 100% manual. Band sits at end of each rehearsal and toggles `is_active` for next fortnight. |
| 4 | Notes model | **Append-only log.** Every note is a new row, timestamped, with author. Members can delete or archive individual notes. No edits/overwrites. |
| 5 | Note attribution | Each note has `for_member_id` (whose section it appears under) and `author_member_id` (who wrote it). Notes from someone else show "— from Steve" under the target's section. |
| 6 | Archive | Soft-delete only. Songs and notes both. Restore brings notes back attached. |
| 7 | Offline | None. In-memory cache, clear error state if request fails. |
| 8 | Switch member link | Keep it, small and unobtrusive. Different purpose to Band tab: switch-member changes *whose phone this is*; Band tab writes notes *for* someone else from your own identity. |
| 9 | PWA | Yes — manifest + icon so members can "Add to Home Screen" and it opens fullscreen. |
| 10 | Optimistic UI | Everywhere — fortnight toggle, note add, link add. All feel instant; reconcile on response. |
| 11 | Links | Auto-prefix `https://` if missing. YouTube links render with embedded thumbnail (lazy, just the static thumbnail image, not the iframe). Tap opens in new tab. |
| 12 | Sync indicator | Tiny "last synced 2m ago" in header/footer area. |
| 13 | Visual vibe | 90s grunge / underground open mic / dark dingy bar. Blues + greens base, neon accent flashes (think hand-painted gig poster). Not polished-startup beautiful. |

---

## 2. Google Sheet schema

Single sheet, three tabs.

### `SetList`
| Column | Type | Notes |
|--------|------|-------|
| song_id | string | Timestamp-based unique ID |
| title | string | Required |
| artist | string | Required |
| date_added | ISO datetime | |
| is_active | boolean (TRUE/FALSE) | Fortnight flag |
| status | "active" \| "archived" | Soft-delete |

### `Notes` *(updated — append-only)*
| Column | Type | Notes |
|--------|------|-------|
| note_id | string | Timestamp-based unique ID |
| song_id | string | FK to SetList |
| for_member_id | "Michael" \| "Steve" \| "Justyn" \| "Tom" | Whose notes section this lives under |
| author_member_id | same enum | Who actually wrote it |
| notes | string | Free text |
| created_at | ISO datetime | |
| status | "active" \| "archived" | Per-note archive |

### `SongLinks`
| Column | Type | Notes |
|--------|------|-------|
| link_id | string | |
| song_id | string | FK |
| link_type | "tabs" \| "youtube" \| "recording" | |
| url | string | Auto-prefixed https:// if missing |
| label | string | Optional |
| added_by | member name | |
| date_added | ISO datetime | |

---

## 3. Apps Script endpoints

Single web app URL. All requests include `token` param/field.

### GET (query params)
- `getSongs` — optional `status` (default "active")
- `getFortnightSongs` — `is_active=TRUE` AND `status=active`
- `getArchivedSongs`
- `getNotesByMember` — `member` param. Returns active notes where `for_member_id = member`.
- `getNotesBySong` — `songId` param. Returns active notes for that song, all members.
- `getLinksBySong` — `songId` param

### POST (JSON body, `text/plain` content-type)
- `addSong` — { title, artist }
- `updateSong` — { songId, fields } — supports is_active toggle
- `archiveSong` — { songId }
- `restoreSong` — { songId }
- `addNote` — { song_id, for_member_id, author_member_id, notes } *(always inserts, never updates)*
- `archiveNote` — { note_id }
- `restoreNote` — { note_id }
- `deleteNote` — { note_id } *(hard delete — for typo cleanup)*
- `addLink` — { song_id, link_type, url, label, added_by }
- `deleteLink` — { link_id }

---

## 4. Screen-by-screen behaviour

### First-load gate
Full-screen "Who are you?" with four big tap targets. Selection → localStorage. Persists forever unless cleared via switch-member link.

### Bottom nav (5 tabs)
My Notes · Shared Notes · Set List · Media · Band

Two-section layout pattern (used in My Notes, Shared Notes, Media, Band):
- **This fortnight** (top of fold) — songs where `is_active=TRUE`
- **All songs** — remaining active repertoire

### My Notes
Tap a song → opens note view for current member on that song. Shows all your active notes for that song, newest first, each with timestamp. Notes authored by someone else for you show "— from Steve, 12 Apr". Add-note input at bottom. Each note has its own delete and archive buttons.

### Shared Notes
Read-only across all four members. Each song expands to show all members' active notes, grouped by member, newest first within each. No editing here.

### Set List
Master control. Toggle: All songs / This fortnight.
Each row:
- Title + artist
- Fortnight toggle (optimistic, updates is_active)
- Manage links → panel with all links for that song; add new link form
- Remove → archives song (status = archived)

Header buttons:
- Add song — title + artist form
- Archive — view archived songs with restore button. Archived songs show their note history.

### Media
Same two-section layout. Each song shows all its links grouped by type (Tabs, YouTube with thumbnail, Recordings). Add-link form available inline per song. Any member can add to any song.

### Band
Selector at top: Michael / Steve / Justyn / Tom. Pick one → see their active notes across all active songs, two-section layout. You can add a note for them; it saves with `for_member_id = selected`, `author_member_id = current`. They (and everyone else via Shared Notes) will see it attributed to you.

### Always-visible
- Switch member link (small, settings-style — top corner or footer)
- Last synced indicator
- Loading spinner during fetches
- Inline error toast on failure with "Retry"

---

## 5. Visual direction

- **Background**: deep navy / near-black with subtle texture (dirty paper / faded poster)
- **Primary text**: off-white, slightly cream
- **Accents**: electric blue-green for active states, hot pink/magenta for fortnight-active flags, sodium-yellow for warnings
- **Type**: condensed sans for headings (gig poster feel), readable sans for body. Maybe one hand-drawn / stencil display face for the band name only.
- **Buttons**: chunky, slightly off-kilter, no perfect rounded corners
- **Borders**: roughed-up dividers, not crisp lines
- **Icons**: minimal, line-only

Mood reference: cassette tape liner notes, photocopied gig flyer, neon sign behind a bar.

---

## 6. PWA setup

- `manifest.webmanifest` with name, short_name, theme_color (deep navy), background_color, icons (192, 512)
- Service worker — minimal, just enables installability. No offline caching v1.
- Apple touch icon meta tag
- `display: standalone` so it opens fullscreen from home screen

---

## 7. Build order

1. **Sheet setup** — create sheet, three tabs, column headers, share with the Apps Script account
2. **Apps Script** — write all endpoints, deploy as web app, test with curl. Lock token check.
3. **Static mockup** — clickable HTML/CSS only, no backend wiring. Validates layout, visual vibe, and screen flow. **Checkpoint: review with you here.**
4. **Wire reads** — member gate, My Notes → Shared Notes → Media → Band → Set List
5. **Wire writes** — optimistic UI, error reconciliation
6. **Polish** — PWA manifest, icon, mobile spacing pass, last-synced indicator
7. **Deploy** — push to GitHub, enable Pages, test from phones

---

## 8. Open / parking lot (not blocking v1)

- Push notifications when someone writes a note for you
- Search across notes
- Export set list as printable PDF
- Multiple set lists (e.g. "gig 1", "gig 2") rather than just the fortnight flag
- Real auth (Google sign-in) if the band ever grows past trusted four

---

## Next step

Build the static clickable mockup (step 3). No data, no backend — just HTML/CSS to feel the layout and the grunge vibe. You click through, redline what's off, then we wire it up.
