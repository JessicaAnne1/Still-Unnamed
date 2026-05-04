/**
 * Still Unnamed — Backend
 * Google Apps Script web app, container-bound to the band's Google Sheet.
 *
 * Sheets used (must exist with these column headers in row 1):
 *   SetList:    song_id | title | artist | date_added | is_active | status
 *   Notes:      note_id | song_id | for_member_id | author_member_id | notes | created_at | status
 *   SongLinks:  link_id | song_id | link_type | url | label | added_by | date_added
 *   Ratings:    rating_id | song_id | member_id | rating | updated_at
 */

// ============================================================
// CONFIG
// ============================================================
// Shared token. Anyone who knows this can read/write the band's data.
// Change this to a random string of your choice. Same string goes in the
// frontend JS as the SHARED_TOKEN constant.
const SHARED_TOKEN = 'CHANGE_ME_BEFORE_DEPLOY';

const VALID_MEMBERS = ['Michael', 'Steve', 'Justyn', 'Tom'];
const VALID_LINK_TYPES = ['tabs', 'youtube', 'recording'];
const STATUS_ACTIVE = 'active';
const STATUS_ARCHIVED = 'archived';

// ============================================================
// ROUTER
// ============================================================
function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    if (params.token !== SHARED_TOKEN) return jsonOut({ ok: false, error: 'unauthorized' });

    const action = params.action || '';
    switch (action) {
      case 'getSongs':         return jsonOut({ ok: true, data: getSongs(params.status || STATUS_ACTIVE) });
      case 'getFortnightSongs':return jsonOut({ ok: true, data: getFortnightSongs() });
      case 'getArchivedSongs': return jsonOut({ ok: true, data: getSongs(STATUS_ARCHIVED) });
      case 'getNotesByMember': return jsonOut({ ok: true, data: getNotesByMember(params.member) });
      case 'getNotesBySong':   return jsonOut({ ok: true, data: getNotesBySong(params.songId) });
      case 'getLinksBySong':   return jsonOut({ ok: true, data: getLinksBySong(params.songId) });
      case 'getRatings':       return jsonOut({ ok: true, data: getRatings() });
      case 'getAll':           return jsonOut({ ok: true, data: getAll() });
      default: return jsonOut({ ok: false, error: 'unknown_action: ' + action });
    }
  } catch (err) {
    return jsonOut({ ok: false, error: String(err && err.message || err) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.token !== SHARED_TOKEN) return jsonOut({ ok: false, error: 'unauthorized' });

    const action = body.action || '';
    switch (action) {
      case 'addSong':       return jsonOut({ ok: true, data: addSong(body) });
      case 'updateSong':    return jsonOut({ ok: true, data: updateSong(body) });
      case 'archiveSong':   return jsonOut({ ok: true, data: setSongStatus(body.songId, STATUS_ARCHIVED) });
      case 'restoreSong':   return jsonOut({ ok: true, data: setSongStatus(body.songId, STATUS_ACTIVE) });
      case 'deleteSong':    return jsonOut({ ok: true, data: deleteSong(body.songId) });
      case 'addNote':       return jsonOut({ ok: true, data: addNote(body) });
      case 'archiveNote':   return jsonOut({ ok: true, data: setNoteStatus(body.note_id, STATUS_ARCHIVED) });
      case 'restoreNote':   return jsonOut({ ok: true, data: setNoteStatus(body.note_id, STATUS_ACTIVE) });
      case 'deleteNote':    return jsonOut({ ok: true, data: deleteNote(body.note_id) });
      case 'addLink':       return jsonOut({ ok: true, data: addLink(body) });
      case 'deleteLink':    return jsonOut({ ok: true, data: deleteLink(body.link_id) });
      case 'setRating':     return jsonOut({ ok: true, data: setRating(body) });
      default: return jsonOut({ ok: false, error: 'unknown_action: ' + action });
    }
  } catch (err) {
    return jsonOut({ ok: false, error: String(err && err.message || err) });
  }
}

// ============================================================
// READS
// ============================================================
function getSongs(status) {
  const rows = readAll('SetList');
  return rows.filter(r => r.status === status)
             .sort((a, b) => String(a.title).localeCompare(String(b.title)));
}

function getFortnightSongs() {
  const rows = readAll('SetList');
  return rows.filter(r => r.status === STATUS_ACTIVE && truthy(r.is_active))
             .sort((a, b) => String(a.title).localeCompare(String(b.title)));
}

function getNotesByMember(member) {
  if (!member) throw new Error('member required');
  const rows = readAll('Notes');
  return rows.filter(r => r.for_member_id === member && r.status === STATUS_ACTIVE)
             .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

function getNotesBySong(songId) {
  if (!songId) throw new Error('songId required');
  const rows = readAll('Notes');
  return rows.filter(r => r.song_id === songId && r.status === STATUS_ACTIVE)
             .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

function getLinksBySong(songId) {
  if (!songId) throw new Error('songId required');
  const rows = readAll('SongLinks');
  return rows.filter(r => r.song_id === songId)
             .sort((a, b) => String(a.date_added).localeCompare(String(b.date_added)));
}

function getRatings() {
  return readAll('Ratings');
}

// Combined fetch — useful for first paint, returns the lot in one trip.
function getAll() {
  const songs = readAll('SetList').filter(r => r.status === STATUS_ACTIVE);
  const notes = readAll('Notes').filter(r => r.status === STATUS_ACTIVE);
  const links = readAll('SongLinks');
  const ratings = readAll('Ratings');
  return { songs: songs, notes: notes, links: links, ratings: ratings };
}

// ============================================================
// WRITES — SONGS
// ============================================================
function addSong(body) {
  const title = (body.title || '').trim();
  const artist = (body.artist || '').trim();
  if (!title) throw new Error('title required');
  if (!artist) throw new Error('artist required');

  const songId = newId('song');
  const now = nowIso();
  appendRow('SetList', {
    song_id: songId,
    title: title,
    artist: artist,
    date_added: now,
    is_active: false,
    status: STATUS_ACTIVE
  });

  // Optional inline links from the Add Song form
  const links = Array.isArray(body.links) ? body.links : [];
  const addedLinks = [];
  links.forEach(function(l) {
    if (!l || !l.url) return;
    addedLinks.push(addLink({
      song_id: songId,
      link_type: l.link_type,
      url: l.url,
      label: l.label || '',
      added_by: l.added_by || ''
    }));
  });

  return { song_id: songId, links: addedLinks };
}

function updateSong(body) {
  const songId = body.songId;
  const fields = body.fields || {};
  if (!songId) throw new Error('songId required');

  const sheet = sheetByName('SetList');
  const rowIndex = findRowIndex(sheet, 'song_id', songId);
  if (rowIndex < 0) throw new Error('song not found');

  const headers = getHeaders(sheet);
  const allowed = ['title', 'artist', 'is_active', 'status'];
  const updates = [];
  allowed.forEach(function(key) {
    if (fields.hasOwnProperty(key)) {
      const col = headers.indexOf(key) + 1;
      if (col > 0) {
        let val = fields[key];
        if (key === 'is_active') val = !!val;
        sheet.getRange(rowIndex, col).setValue(val);
        updates.push(key);
      }
    }
  });
  return { songId: songId, updated: updates };
}

function setSongStatus(songId, status) {
  if (!songId) throw new Error('songId required');
  const sheet = sheetByName('SetList');
  const rowIndex = findRowIndex(sheet, 'song_id', songId);
  if (rowIndex < 0) throw new Error('song not found');
  const headers = getHeaders(sheet);
  const statusCol = headers.indexOf('status') + 1;
  sheet.getRange(rowIndex, statusCol).setValue(status);
  return { songId: songId, status: status };
}

// Hard-delete a song and all related notes, links, and ratings.
// Cannot be undone. Use archiveSong if the band might want history later.
function deleteSong(songId) {
  if (!songId) throw new Error('songId required');
  const counts = { notes: 0, links: 0, ratings: 0 };
  // Cascade — delete from bottom up so row indices stay valid.
  ['Notes', 'SongLinks', 'Ratings'].forEach(function(name) {
    const sheet = sheetByName(name);
    const headers = getHeaders(sheet);
    const songCol = headers.indexOf('song_id');
    if (songCol < 0) return;
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    const values = sheet.getRange(2, songCol + 1, lastRow - 1, 1).getValues();
    for (let i = values.length - 1; i >= 0; i--) {
      if (String(values[i][0]) === String(songId)) {
        sheet.deleteRow(i + 2);
        if (name === 'Notes') counts.notes++;
        else if (name === 'SongLinks') counts.links++;
        else if (name === 'Ratings') counts.ratings++;
      }
    }
  });
  // Finally remove the song itself
  const sheet = sheetByName('SetList');
  const rowIndex = findRowIndex(sheet, 'song_id', songId);
  if (rowIndex < 0) throw new Error('song not found');
  sheet.deleteRow(rowIndex);
  return { songId: songId, deleted: true, cascaded: counts };
}

// ============================================================
// WRITES — NOTES (append-only)
// ============================================================
function addNote(body) {
  const songId = body.song_id;
  const forMember = body.for_member_id;
  const authorMember = body.author_member_id;
  const text = (body.notes || '').trim();
  if (!songId) throw new Error('song_id required');
  if (!forMember) throw new Error('for_member_id required');
  if (!authorMember) throw new Error('author_member_id required');
  if (VALID_MEMBERS.indexOf(forMember) < 0) throw new Error('invalid for_member_id');
  if (VALID_MEMBERS.indexOf(authorMember) < 0) throw new Error('invalid author_member_id');
  if (!text) throw new Error('notes required');

  const noteId = newId('note');
  const now = nowIso();
  appendRow('Notes', {
    note_id: noteId,
    song_id: songId,
    for_member_id: forMember,
    author_member_id: authorMember,
    notes: text,
    created_at: now,
    status: STATUS_ACTIVE
  });
  return { note_id: noteId, song_id: songId, for_member_id: forMember,
           author_member_id: authorMember, notes: text, created_at: now, status: STATUS_ACTIVE };
}

function setNoteStatus(noteId, status) {
  if (!noteId) throw new Error('note_id required');
  const sheet = sheetByName('Notes');
  const rowIndex = findRowIndex(sheet, 'note_id', noteId);
  if (rowIndex < 0) throw new Error('note not found');
  const headers = getHeaders(sheet);
  const statusCol = headers.indexOf('status') + 1;
  sheet.getRange(rowIndex, statusCol).setValue(status);
  return { note_id: noteId, status: status };
}

function deleteNote(noteId) {
  if (!noteId) throw new Error('note_id required');
  const sheet = sheetByName('Notes');
  const rowIndex = findRowIndex(sheet, 'note_id', noteId);
  if (rowIndex < 0) throw new Error('note not found');
  sheet.deleteRow(rowIndex);
  return { note_id: noteId, deleted: true };
}

// ============================================================
// WRITES — LINKS
// ============================================================
function addLink(body) {
  const songId = body.song_id;
  const linkType = String(body.link_type || '').toLowerCase();
  let url = (body.url || '').trim();
  const label = (body.label || '').trim();
  const addedBy = (body.added_by || '').trim();
  if (!songId) throw new Error('song_id required');
  if (VALID_LINK_TYPES.indexOf(linkType) < 0) throw new Error('invalid link_type');
  if (!url) throw new Error('url required');

  // Auto-prefix https:// if missing
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  const linkId = newId('link');
  const now = nowIso();
  appendRow('SongLinks', {
    link_id: linkId,
    song_id: songId,
    link_type: linkType,
    url: url,
    label: label,
    added_by: addedBy,
    date_added: now
  });
  return { link_id: linkId, song_id: songId, link_type: linkType,
           url: url, label: label, added_by: addedBy, date_added: now };
}

function deleteLink(linkId) {
  if (!linkId) throw new Error('link_id required');
  const sheet = sheetByName('SongLinks');
  const rowIndex = findRowIndex(sheet, 'link_id', linkId);
  if (rowIndex < 0) throw new Error('link not found');
  sheet.deleteRow(rowIndex);
  return { link_id: linkId, deleted: true };
}

// ============================================================
// WRITES — RATINGS (upsert per song+member)
// ============================================================
function setRating(body) {
  const songId = body.song_id;
  const memberId = body.member_id;
  let rating = Number(body.rating);
  if (!songId) throw new Error('song_id required');
  if (VALID_MEMBERS.indexOf(memberId) < 0) throw new Error('invalid member_id');
  if (isNaN(rating)) throw new Error('rating must be a number');
  rating = Math.max(0, Math.min(5, Math.round(rating)));
  const now = nowIso();

  const sheet = sheetByName('Ratings');
  const headers = getHeaders(sheet);
  const lastRow = sheet.getLastRow();

  // Find existing row for (song_id, member_id)
  let existingRow = -1;
  if (lastRow >= 2) {
    const songCol = headers.indexOf('song_id');
    const memberCol = headers.indexOf('member_id');
    const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
    for (let i = 0; i < values.length; i++) {
      if (String(values[i][songCol]) === String(songId) &&
          String(values[i][memberCol]) === String(memberId)) {
        existingRow = i + 2;
        break;
      }
    }
  }

  if (existingRow >= 0) {
    const ratingCol = headers.indexOf('rating') + 1;
    const updatedCol = headers.indexOf('updated_at') + 1;
    sheet.getRange(existingRow, ratingCol).setValue(rating);
    sheet.getRange(existingRow, updatedCol).setValue(now);
    const ratingId = sheet.getRange(existingRow, headers.indexOf('rating_id') + 1).getValue();
    return { rating_id: ratingId, song_id: songId, member_id: memberId, rating: rating, updated_at: now };
  } else {
    const ratingId = newId('rating');
    appendRow('Ratings', {
      rating_id: ratingId,
      song_id: songId,
      member_id: memberId,
      rating: rating,
      updated_at: now
    });
    return { rating_id: ratingId, song_id: songId, member_id: memberId, rating: rating, updated_at: now };
  }
}

// ============================================================
// HELPERS
// ============================================================
function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function sheetByName(name) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sheet) throw new Error('sheet not found: ' + name);
  return sheet;
}

function getHeaders(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function(h) { return String(h).trim(); });
}

function readAll(name) {
  const sheet = sheetByName(name);
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) return [];
  const headers = getHeaders(sheet);
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  return values.map(function(row) {
    const obj = {};
    headers.forEach(function(h, i) {
      let v = row[i];
      if (v instanceof Date) v = v.toISOString();
      obj[h] = v;
    });
    return obj;
  });
}

function appendRow(name, obj) {
  const sheet = sheetByName(name);
  const headers = getHeaders(sheet);
  const row = headers.map(function(h) {
    if (!obj.hasOwnProperty(h)) return '';
    const v = obj[h];
    if (typeof v === 'boolean') return v;
    return v;
  });
  sheet.appendRow(row);
}

function findRowIndex(sheet, idColumn, idValue) {
  const headers = getHeaders(sheet);
  const idCol = headers.indexOf(idColumn);
  if (idCol < 0) return -1;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const values = sheet.getRange(2, idCol + 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(idValue)) return i + 2; // sheet rows are 1-indexed, headers in row 1
  }
  return -1;
}

function newId(prefix) {
  return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

function nowIso() {
  return new Date().toISOString();
}

function truthy(v) {
  if (v === true) return true;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    return s === 'true' || s === 'yes' || s === '1';
  }
  return !!v;
}

// ============================================================
// ONE-TIME SETUP — run from the Apps Script editor to create
// the three sheet tabs with correct headers if they don't exist.
// ============================================================
function setupSheets() {
  const ss = SpreadsheetApp.getActive();
  const specs = [
    { name: 'SetList',   headers: ['song_id', 'title', 'artist', 'date_added', 'is_active', 'status'] },
    { name: 'Notes',     headers: ['note_id', 'song_id', 'for_member_id', 'author_member_id', 'notes', 'created_at', 'status'] },
    { name: 'SongLinks', headers: ['link_id', 'song_id', 'link_type', 'url', 'label', 'added_by', 'date_added'] },
    { name: 'Ratings',   headers: ['rating_id', 'song_id', 'member_id', 'rating', 'updated_at'] }
  ];
  specs.forEach(function(spec) {
    let sheet = ss.getSheetByName(spec.name);
    if (!sheet) sheet = ss.insertSheet(spec.name);
    const existing = sheet.getRange(1, 1, 1, spec.headers.length).getValues()[0];
    const needsHeader = existing.every(function(c) { return c === '' || c == null; });
    if (needsHeader) {
      sheet.getRange(1, 1, 1, spec.headers.length).setValues([spec.headers]);
      sheet.setFrozenRows(1);
    }
  });
  // Remove the default Sheet1 if it's empty and not one of ours
  const default1 = ss.getSheetByName('Sheet1');
  if (default1 && default1.getLastRow() === 0 && default1.getLastColumn() === 0 && ss.getSheets().length > 1) {
    ss.deleteSheet(default1);
  }
  Logger.log('Setup complete.');
}

// Quick smoke test — run from editor to verify
function smokeTest() {
  Logger.log('getAll: ' + JSON.stringify(getAll()));
}
