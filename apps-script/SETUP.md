# Backend Setup — Google Sheet + Apps Script

Follow these steps in order. Should take ~10 minutes.

## 1. Create the Google Sheet

1. Go to [sheets.new](https://sheets.new) (or `drive.google.com` → New → Google Sheet).
2. Rename it something like **Still Unnamed — Band Data**.
3. Leave it as-is for now. The script will create the three tabs for you.

## 2. Open the Apps Script editor

1. In the sheet, go to **Extensions → Apps Script**.
2. A new tab opens with a script editor and a default file `Code.gs`.
3. **Delete everything in `Code.gs`.**
4. Open `apps-script/Code.gs` from this project, copy its entire contents, and paste into the editor.

## 3. Set your shared token

Near the top of `Code.gs` you'll see:

```js
const SHARED_TOKEN = 'CHANGE_ME_BEFORE_DEPLOY';
```

Replace `CHANGE_ME_BEFORE_DEPLOY` with a random string of your choice. Anything 16+ characters is fine — for example:

```js
const SHARED_TOKEN = 'mystify-7f3a9b2c4d6e8a1';
```

**Save this string somewhere you'll remember.** It goes into the frontend later.

Click the floppy-disk **Save** icon (or ⌘S).

## 4. Create the sheet tabs

1. In the Apps Script editor's function dropdown (top toolbar, says "Select function"), choose **`setupSheets`**.
2. Click **Run**.
3. First time only: it'll ask for permissions. Click **Review permissions** → choose your Google account → "Advanced" → "Go to (unsafe)" → **Allow**. (Apps Script you write yourself will always show this warning. It's fine.)
4. Once it finishes, switch back to the spreadsheet tab. You should now see three tabs at the bottom: **SetList**, **Notes**, **SongLinks** — each with the right column headers in row 1.

## 5. Smoke test (optional but recommended)

In the Apps Script editor, choose **`smokeTest`** from the function dropdown and click **Run**. Open **View → Logs** (or "Execution log" at the bottom). You should see something like:

```
getAll: {"songs":[],"notes":[],"links":[]}
```

If you see that, the script can read all three sheets cleanly.

## 6. Deploy as a web app

1. Top-right of the Apps Script editor: click **Deploy → New deployment**.
2. Click the gear icon next to "Select type" → choose **Web app**.
3. Fill in:
   - **Description**: `Still Unnamed v1` (or anything)
   - **Execute as**: **Me** (your account)
   - **Who has access**: **Anyone**
     - This makes the URL public *to anyone who knows it*. The shared token in step 3 is what stops randoms from reading or writing your data. Don't post the URL publicly.
4. Click **Deploy**.
5. First time only: it may ask you to authorize again. Allow it.
6. Copy the **Web app URL**. It looks like:
   ```
   https://script.google.com/macros/s/AKfycby...../exec
   ```
7. **Save this URL.** It goes into the frontend along with the token.

## 7. Test the deployed endpoint

Open a new browser tab and paste this (replace `YOUR_URL` and `YOUR_TOKEN`):

```
YOUR_URL?action=getAll&token=YOUR_TOKEN
```

You should see JSON like:
```json
{"ok":true,"data":{"songs":[],"notes":[],"links":[]}}
```

If you see `{"ok":false,"error":"unauthorized"}` → the token doesn't match.
If you see anything else → check the Apps Script logs (View → Executions).

## 8. Add a test row (optional)

Try a write via curl from your terminal:

```bash
curl -X POST -H "Content-Type: text/plain" \
  -d '{"token":"YOUR_TOKEN","action":"addSong","title":"Black Hole Sun","artist":"Soundgarden"}' \
  YOUR_URL
```

You should get back a JSON response with the new `song_id`. Refresh your sheet — there should be a new row in **SetList**.

---

## What you have now

- A Google Sheet with three properly-structured tabs
- An Apps Script web app deployed at a stable URL, gated by a shared token
- All ten endpoints (read + write) wired and ready

## What goes into the frontend

Two values, both pasted at the top of the JS file when we wire it up:

```js
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/.../exec';
const SHARED_TOKEN = 'mystify-7f3a9b2c4d6e8a1';
```

That's it for the backend. Send me the URL once it's deployed and we'll wire the frontend up.

---

## Re-deploying after script changes

Apps Script web apps **don't auto-update** when you save. After changing the code:

1. **Deploy → Manage deployments**
2. Click the pencil icon on your existing deployment
3. Change "Version" to **New version**
4. **Deploy**

This keeps the same URL. (If you make a brand new deployment, you get a brand new URL and have to update the frontend.)
