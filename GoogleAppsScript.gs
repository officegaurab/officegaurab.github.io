// Google Apps Script for Attendance Tracker v3
// Multi-tab database, Google identity verification, Dirty document tracking
// Deploy as web app: Deploy > New Deployment > Type: Web app

const SPREADSHEET_ID = '1xRWs999mHz51IGToz8gA-WjMuxAt9TB8fJXDqKv38-U';
const GOOGLE_OAUTH_CLIENT_ID = '83272451338-s55v870hpabod4lkr0bvkbgouulrnuso.apps.googleusercontent.com';

// Sheet names
const SHEETS = {
  attendance: 'Attendance',
  users: 'Users',
  saveLogs: 'SaveLogs',
  dirtyDocs: 'DirtyDocs'
};

function authorizeRequiredServices() {
  const spreadsheetName = SpreadsheetApp.openById(SPREADSHEET_ID).getName();
  const response = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=authorization-check',
    { muteHttpExceptions: true }
  );
  return 'Authorized spreadsheet access for "' + spreadsheetName + '" and external requests. Token check status: ' + response.getResponseCode();
}

function doPost(e) {
  try {
    const payload = parsePayload(e);
    const action = payload.action;
    const identity = verifyGoogleIdToken(payload.idToken);
    if (!payload.userId || payload.userId !== identity.sub) {
      return formatResponse(false, 'The requested account does not match the signed-in Google account.');
    }
    payload.verifiedEmail = identity.email;

    switch(action) {
      case 'saveAttendance':
        return saveAttendance(payload.userId, payload.date, payload.status);
      case 'getAttendance':
        return getAttendance(payload.userId);
      case 'saveUser':
        return saveUser(payload.userId, payload.userData, payload.verifiedEmail);
      case 'getUser':
        return getUser(payload.userId, payload.verifiedEmail);
      case 'checkSaveLimit':
        return checkSaveLimit(payload.userId);
      case 'getSaveCount':
        return getSaveCount(payload.userId);
      case 'getDirtyDocs':
        return getDirtyDocs(payload.userId);
      case 'markSynced':
        return markSynced(payload.userId, payload.date);
      default:
        return formatResponse(false, 'Unknown action');
    }
  } catch (error) {
    Logger.log('Error in doPost: ' + error.toString());
    return formatResponse(false, error.toString());
  }
}

function verifyGoogleIdToken(idToken) {
  if (!idToken || GOOGLE_OAUTH_CLIENT_ID.indexOf('YOUR_') === 0) {
    throw new Error('Google sign-in is not configured.');
  }

  const cache = CacheService.getScriptCache();
  const cacheKey = 'google-identity-' + idToken.slice(-96);
  const cachedClaims = cache.get(cacheKey);
  if (cachedClaims) return JSON.parse(cachedClaims);

  const response = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
    { muteHttpExceptions: true }
  );
  if (response.getResponseCode() !== 200) {
    throw new Error('Google sign-in expired. Please sign in again.');
  }

  const claims = JSON.parse(response.getContentText());
  const emailIsVerified = claims.email_verified === true || claims.email_verified === 'true';
  const issuerIsGoogle = claims.iss === 'https://accounts.google.com' || claims.iss === 'accounts.google.com';
  if (claims.aud !== GOOGLE_OAUTH_CLIENT_ID || !claims.sub || !emailIsVerified || !issuerIsGoogle) {
    throw new Error('Google identity could not be verified.');
  }
  cache.put(cacheKey, JSON.stringify(claims), 300);
  return claims;
}

function parsePayload(e) {
  if (e.postData && e.postData.contents) {
    try {
      return JSON.parse(e.postData.contents);
    } catch (error) {
      // Fall through to parse as URL-encoded parameters.
    }
  }

  const payload = {};
  if (e.parameter) {
    for (const key in e.parameter) {
      payload[key] = e.parameter[key];
    }
  }

  if (payload.userData && typeof payload.userData === 'string') {
    try {
      payload.userData = JSON.parse(payload.userData);
    } catch (error) {
      // Keep the original string if JSON parse fails.
    }
  }

  return payload;
}

function createJsonResponse(response) {
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===== ATTENDANCE FUNCTIONS =====

function saveAttendance(userId, date, status) {
  let lock = null;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(10000);
    ensureSheets();
    const attendanceSheet = getSheet(SHEETS.attendance);
    const dirtySheet = getSheet(SHEETS.dirtyDocs);

    // ── 1. Upsert into Attendance sheet ──────────────────────────────────────────────
    // Delete ALL existing rows for (date, userId) from bottom to top (avoids row-shift
    // bugs), then append one fresh row. String() conversion prevents the Date-object
    // vs string === false bug that caused historical duplicates.
    upsertAttendanceRow(attendanceSheet, userId, date, status);

    // ── 2. Upsert DirtyDocs: delete all existing rows for (userId,date) then append one ──
    // This avoids the Date-object vs string === bug and prevents duplicate rows.
    upsertDirtyDoc(dirtySheet, userId, date, status);

    // ── 3. Auto-clean confirmed rows older than 7 days ────────────────────────────────
    cleanOldSyncedRows(dirtySheet);

    logSave(userId);
    Logger.log('Attendance saved: ' + userId + ' - ' + date + ' - ' + status);
    return formatResponse(true, 'Attendance saved');
  } catch (error) {
    return formatResponse(false, error.toString());
  } finally {
    if (lock) lock.releaseLock();
  }
}

/**
 * Deletes ALL existing DirtyDocs rows for (userId, date) then appends one
 * fresh row with Synced=FALSE.  Deleting from the bottom avoids row-index
 * shifting.  This replaces the broken find-and-update approach that failed
 * because sheet date cells are Date objects, not strings.
 */
function upsertDirtyDoc(dirtySheet, userId, date, status) {
  const values = dirtySheet.getDataRange().getValues();
  // Collect row numbers (1-indexed) to delete, from bottom to top.
  const toDelete = [];
  for (let i = values.length - 1; i >= 1; i--) {
    if (String(values[i][0]) === String(userId) && String(values[i][1]) === String(date)) {
      toDelete.push(i + 1);
    }
  }
  toDelete.forEach(function(rowNum) { dirtySheet.deleteRow(rowNum); });
  dirtySheet.appendRow([userId, date, status, new Date().toISOString(), false, '']);
}

/**
 * Removes DirtyDocs rows where Synced=TRUE and SyncedAt is older than 7 days.
 * Keeps the sheet from growing unboundedly.
 */
function cleanOldSyncedRows(dirtySheet) {
  var KEEP_DAYS = 7;
  var cutoff = new Date(Date.now() - KEEP_DAYS * 86400000);
  var values = dirtySheet.getDataRange().getValues();
  var toDelete = [];
  for (var i = values.length - 1; i >= 1; i--) {
    var synced = values[i][4];
    var syncedAt = values[i][5];
    if ((synced === true || synced === 'TRUE') && syncedAt) {
      var syncedDate = new Date(syncedAt);
      if (!isNaN(syncedDate) && syncedDate < cutoff) toDelete.push(i + 1);
    }
  }
  toDelete.forEach(function(rowNum) { dirtySheet.deleteRow(rowNum); });
}

/**
 * Deletes ALL existing Attendance rows for (userId, date) then appends one
 * fresh row with the latest status.  Mirrors upsertDirtyDoc to guarantee
 * exactly one row per (date, userId) in the sheet.
 */
function upsertAttendanceRow(attendanceSheet, userId, date, status) {
  const values = attendanceSheet.getDataRange().getValues();
  const toDelete = [];
  for (let i = values.length - 1; i >= 1; i--) {
    if (String(values[i][0]) === String(date) && String(values[i][1]) === String(userId)) {
      toDelete.push(i + 1); // 1-indexed
    }
  }
  // Delete from bottom to top so row indices stay valid
  toDelete.forEach(function(rowNum) { attendanceSheet.deleteRow(rowNum); });
  attendanceSheet.appendRow([date, userId, status]);
}

/**
 * ONE-TIME cleanup: deduplicate the Attendance sheet so each (date, userId)
 * has exactly one row — the LAST recorded status.
 * Call this once from the Apps Script editor: cleanupAttendanceSheet()
 */
function cleanupAttendanceSheet() {
  ensureSheets();
  const attendanceSheet = getSheet(SHEETS.attendance);
  const values = attendanceSheet.getDataRange().getValues();

  // Build a map: "date|userId" -> last row index (0-based)
  const lastRowIndex = {};
  for (let i = 1; i < values.length; i++) {
    const key = String(values[i][0]) + '|' + String(values[i][1]);
    lastRowIndex[key] = i; // later rows overwrite earlier ones
  }

  // Collect row numbers (1-indexed) that are NOT the last row for their key
  const toDelete = [];
  for (let i = values.length - 1; i >= 1; i--) {
    const key = String(values[i][0]) + '|' + String(values[i][1]);
    if (lastRowIndex[key] !== i) {
      toDelete.push(i + 1); // 1-indexed sheet row
    }
  }

  // Delete from bottom to top
  toDelete.forEach(function(rowNum) { attendanceSheet.deleteRow(rowNum); });
  Logger.log('cleanupAttendanceSheet: deleted ' + toDelete.length + ' duplicate rows.');
  return 'Deleted ' + toDelete.length + ' duplicate attendance rows.';
}

function getAttendance(userId) {
  try {
    ensureSheets();
    const attendanceSheet = getSheet(SHEETS.attendance);
    const values = attendanceSheet.getDataRange().getValues();
    
    const data = {};
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (String(row[1]) === String(userId) && row[0]) {
        let dateStr = row[0];
        if (dateStr instanceof Date) {
          dateStr = Utilities.formatDate(dateStr, Session.getScriptTimeZone() || 'GMT', 'yyyy-MM-dd');
        } else {
          dateStr = String(dateStr);
        }
        data[dateStr] = row[2];
      }
    }
    
    return formatResponse(true, data);
  } catch (error) {
    return formatResponse(false, error.toString());
  }
}

// ===== USER FUNCTIONS =====

function saveUser(userId, userData, verifiedEmail) {
  try {
    if (!userData || !String(userData.name || '').trim() || !String(userData.mobile || '').trim()) {
      return formatResponse(false, 'Name and mobile number are required.');
    }
    userData.email = verifiedEmail;
    ensureSheets();
    const usersSheet = getSheet(SHEETS.users);
    const values = usersSheet.getDataRange().getValues();
    let targetRow = -1;
    let oldUserId = '';

    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === userId) {
        targetRow = i + 1;
        oldUserId = values[i][0];
        break;
      }
    }

    // Reclaim legacy records only when their stored email matches Google's verified email.
    if (targetRow < 0 && verifiedEmail) {
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][3] || '').trim().toLowerCase() === verifiedEmail.trim().toLowerCase()) {
          targetRow = i + 1;
          oldUserId = values[i][0];
          break;
        }
      }
    }

    const profileRow = [
        userId,                                                                          // col 0
        userData.mobile || '',                                                           // col 1
        userData.name || '',                                                             // col 2
        userData.email || '',                                                            // col 3
        userData.company || '',                                                          // col 4
        userData.inTime || '',                                                           // col 5
        userData.outTime || '',                                                          // col 6
        userData.profilePhoto || '',                                                     // col 7
        targetRow > 0 ? (values[targetRow - 1][8] || new Date().toISOString()) : new Date().toISOString(), // col 8 createdAt
        userData.personalSpreadsheetId || '',                                            // col 9
        userData.personalSheetSkipped === true,                                          // col 10
        userData.officeLat    || '',                                                     // col 11
        userData.officeLng    || '',                                                     // col 12
        userData.officeRadius || 200,                                                    // col 13
        userData.officeName   || '',                                                     // col 14
        userData.homeLat      || '',                                                     // col 15
        userData.homeLng      || '',                                                     // col 16
        userData.homeRadius   || 200,                                                    // col 17
        userData.homeName     || ''                                                      // col 18
      ];

    if (targetRow > 0) {
      usersSheet.getRange(targetRow, 1, 1, profileRow.length).setValues([profileRow]);
      if (oldUserId && oldUserId !== userId) migrateLegacyUserData(oldUserId, userId);
    } else {
      usersSheet.appendRow(profileRow);
    }
    
    Logger.log('User saved: ' + userId);
    return formatResponse(true, 'User profile saved');
  } catch (error) {
    return formatResponse(false, error.toString());
  }
}

function getUser(userId, verifiedEmail) {
  let lock = null;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(10000);
    ensureSheets();
    const usersSheet = getSheet(SHEETS.users);
    const values = usersSheet.getDataRange().getValues();
    let userRow = -1;
    
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === userId) {
        userRow = i;
        break;
      }
    }

    if (userRow < 0 && verifiedEmail) {
      const normalizedEmail = String(verifiedEmail).trim().toLowerCase();
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][3] || '').trim().toLowerCase() === normalizedEmail) {
          userRow = i;
          const oldUserId = values[i][0];
          usersSheet.getRange(i + 1, 1).setValue(userId);
          if (oldUserId && oldUserId !== userId) migrateLegacyUserData(oldUserId, userId);
          break;
        }
      }
    }

    if (userRow >= 0) {
      return formatResponse(true, {
        userId:               userId,
        mobile:               values[userRow][1],
        name:                 values[userRow][2],
        email:                values[userRow][3],
        company:              values[userRow][4],
        inTime:               values[userRow][5],
        outTime:              values[userRow][6],
        profilePhoto:         values[userRow][7],
        personalSpreadsheetId: values[userRow][9]  || '',
        personalSheetSkipped:  values[userRow][10] === true || values[userRow][10] === 'TRUE',
        officeLat:            values[userRow][11] || '',
        officeLng:            values[userRow][12] || '',
        officeRadius:         values[userRow][13] || 200,
        officeName:           values[userRow][14] || '',
        homeLat:              values[userRow][15] || '',
        homeLng:              values[userRow][16] || '',
        homeRadius:           values[userRow][17] || 200,
        homeName:             values[userRow][18] || ''
      });
    }
    
    return formatResponse(false, 'User not found');
  } catch (error) {
    return formatResponse(false, error.toString());
  } finally {
    if (lock) lock.releaseLock();
  }
}

// ===== SAVE LIMIT FUNCTIONS =====

/**
 * Rewrites all sheet references from oldUserId (legacy mobile) to newUserId (Google ID),
 * then deduplicates Attendance so there's at most 1 row per (date, newUserId).
 */
function migrateLegacyUserData(oldUserId, newUserId) {
  // ── Attendance ────────────────────────────────────────────────────────────
  const attendanceSheet = getSheet(SHEETS.attendance);
  const attendanceValues = attendanceSheet.getDataRange().getValues();
  for (let i = 1; i < attendanceValues.length; i++) {
    if (String(attendanceValues[i][1]) === String(oldUserId)) {
      attendanceSheet.getRange(i + 1, 2).setValue(newUserId);
    }
  }
  // After rewriting IDs a user may now have both old-mobile rows and Google-ID rows
  // for the same date → deduplicate to keep only the last status per date.
  cleanupAttendanceSheet();

  // ── DirtyDocs ─────────────────────────────────────────────────────────────
  const dirtySheet = getSheet(SHEETS.dirtyDocs);
  const dirtyValues = dirtySheet.getDataRange().getValues();
  for (let i = 1; i < dirtyValues.length; i++) {
    if (String(dirtyValues[i][0]) === String(oldUserId)) {
      dirtySheet.getRange(i + 1, 1).setValue(newUserId);
    }
  }

  // ── SaveLogs ──────────────────────────────────────────────────────────────
  const saveLogsSheet = getSheet(SHEETS.saveLogs);
  const saveLogValues = saveLogsSheet.getDataRange().getValues();
  for (let i = 1; i < saveLogValues.length; i++) {
    if (String(saveLogValues[i][0]) === String(oldUserId)) {
      saveLogsSheet.getRange(i + 1, 1).setValue(newUserId);
    }
  }

  Logger.log('migrateLegacyUserData: ' + oldUserId + ' → ' + newUserId);
}

/**
 * Returns true if the id looks like a legacy mobile number
 * (all digits, length ≤ 15) rather than a Google account ID (≥ 18 digits).
 */
function isMobileId(id) {
  // Strips optional leading '+' then checks: all digits, length ≤ 15.
  // Covers both 918904201135 and +918904201135.
  // Google IDs are ≥ 18 digits so they will never match.
  return /^\+?\d{1,15}$/.test(String(id).trim());
}

/**
 * ONE-TIME bulk migration: for every user row whose userId is still a mobile
 * number, find their matching Google-ID row (matched by email) and rewrite
 * all Attendance / DirtyDocs / SaveLogs references.
 *
 * Run once from the Apps Script editor: migrateAllLegacyUsers()
 * Safe to run multiple times — skips rows that are already Google IDs.
 */
function migrateAllLegacyUsers() {
  ensureSheets();
  const usersSheet = getSheet(SHEETS.users);
  const values = usersSheet.getDataRange().getValues();

  // Build email → Google ID map from rows that already have a Google ID
  const emailToGoogleId = {};
  for (let i = 1; i < values.length; i++) {
    const uid = String(values[i][0] || '').trim();
    const email = String(values[i][3] || '').trim().toLowerCase();
    if (!isMobileId(uid) && email) {
      emailToGoogleId[email] = uid;
    }
  }

  let migrated = 0;
  let skipped = 0;

  for (let i = 1; i < values.length; i++) {
    const uid = String(values[i][0] || '').trim();
    const email = String(values[i][3] || '').trim().toLowerCase();

    if (!isMobileId(uid)) { skipped++; continue; }   // already a Google ID
    if (!email) { skipped++; continue; }              // no email → can't map

    const googleId = emailToGoogleId[email];
    if (!googleId || googleId === uid) { skipped++; continue; } // no Google login yet

    // Update the Users sheet row userId column
    usersSheet.getRange(i + 1, 1).setValue(googleId);

    // Migrate all other sheets
    migrateLegacyUserData(uid, googleId);
    migrated++;
  }

  const msg = 'migrateAllLegacyUsers: migrated=' + migrated + ', skipped=' + skipped;
  Logger.log(msg);
  return msg;
}

function checkSaveLimit(userId) {
  try {
    ensureSheets();
    const count = getDailySaveCount(userId);
    
    return formatResponse(true, {
      allowed: true,
      count: count,
      limit: null,
      remaining: null
    });
  } catch (error) {
    return formatResponse(false, error.toString());
  }
}

function getSaveCount(userId) {
  try {
    const count = getDailySaveCount(userId);
    return formatResponse(true, { count: count });
  } catch (error) {
    return formatResponse(false, error.toString());
  }
}

function getDailySaveCount(userId) {
  const saveLogsSheet = getSheet(SHEETS.saveLogs);
  const values = saveLogsSheet.getDataRange().getValues();
  const today = new Date().toDateString();
  
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === userId && values[i][1] === today) {
      return values[i][2] || 0;
    }
  }
  
  return 0;
}

function logSave(userId) {
  const saveLogsSheet = getSheet(SHEETS.saveLogs);
  const values = saveLogsSheet.getDataRange().getValues();
  const today = new Date().toDateString();
  
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === userId && values[i][1] === today) {
      saveLogsSheet.getRange(i + 1, 3).setValue((values[i][2] || 0) + 1);
      return;
    }
  }
  
  // Create new log entry
  saveLogsSheet.appendRow([userId, today, 1]);
}

// ===== UTILITY FUNCTIONS =====

function ensureSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // Attendance sheet
  if (!ss.getSheetByName(SHEETS.attendance)) {
    const sheet = ss.insertSheet(SHEETS.attendance);
    sheet.appendRow(['Date', 'User', 'Status']);
  }
  
  // Users sheet
  if (!ss.getSheetByName(SHEETS.users)) {
    const sheet = ss.insertSheet(SHEETS.users);
    sheet.appendRow(['UserID', 'Mobile', 'Name', 'Email', 'Company', 'InTime', 'OutTime', 'ProfilePhoto', 'CreatedAt', 'PersonalSpreadsheetId', 'PersonalSheetSkipped']);
  }
  
  const usersSheet = ss.getSheetByName(SHEETS.users);
  const existingColumns = usersSheet.getLastColumn();
  if (existingColumns < 10) {
    usersSheet.getRange(1, existingColumns + 1, 1, 2)
      .setValues([['PersonalSpreadsheetId', 'PersonalSheetSkipped']]);
  } else if (existingColumns === 10) {
    usersSheet.getRange(1, 11).setValue('PersonalSheetSkipped');
  }

  // SaveLogs sheet
  if (!ss.getSheetByName(SHEETS.saveLogs)) {
    const sheet = ss.insertSheet(SHEETS.saveLogs);
    sheet.appendRow(['UserID', 'Date', 'Count']);
  }
  
  // DirtyDocs sheet
  if (!ss.getSheetByName(SHEETS.dirtyDocs)) {
    const sheet = ss.insertSheet(SHEETS.dirtyDocs);
    sheet.appendRow(['UserID', 'Date', 'Status', 'MarkedAt', 'Synced', 'SyncedAt']);
  }
}

function getSheet(sheetName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Sheet "' + sheetName + '" not found');
  }
  return sheet;
}

function formatResponse(success, data) {
  const response = {
    success: success,
    data: data,
    timestamp: new Date().toISOString()
  };
  return createJsonResponse(response);
}

// ===== DIRTY DOCUMENT FUNCTIONS =====

/**
 * Returns the latest unsynced (Synced=FALSE) entry per date for this user.
 * Deduplicates in case old rows with the same date exist — only the most
 * recently marked entry per date is returned to the client.
 */
function getDirtyDocs(userId) {
  try {
    ensureSheets();
    const dirtySheet = getSheet(SHEETS.dirtyDocs);
    const values = dirtySheet.getDataRange().getValues();

    // Build a map: date → latest entry (by MarkedAt timestamp)
    const latestByDate = {};
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (String(row[0]) !== String(userId)) continue;
      const synced = row[4];
      if (synced === true || synced === 'TRUE') continue; // already confirmed

      const date = String(row[1]);
      const markedAt = row[3] ? new Date(row[3]).getTime() : 0;
      if (!latestByDate[date] || markedAt > latestByDate[date].markedAt) {
        latestByDate[date] = {
          date: date,
          status: String(row[2]),
          markedAt: markedAt,
          markedAtIso: row[3]
        };
      }
    }

    return formatResponse(true, Object.values(latestByDate));
  } catch (error) {
    return formatResponse(false, error.toString());
  }
}

/**
 * Marks ALL DirtyDocs rows for this (userId, date) as Synced=TRUE.
 * Handles duplicates that existed before the upsertDirtyDoc fix.
 */
function markSynced(userId, date) {
  try {
    ensureSheets();
    const dirtySheet = getSheet(SHEETS.dirtyDocs);
    const values = dirtySheet.getDataRange().getValues();
    const syncedAt = new Date().toISOString();
    let markedCount = 0;

    for (let i = 1; i < values.length; i++) {
      if (String(values[i][0]) === String(userId) && String(values[i][1]) === String(date)) {
        dirtySheet.getRange(i + 1, 5).setValue(true);
        dirtySheet.getRange(i + 1, 6).setValue(syncedAt);
        markedCount++;
      }
    }

    if (markedCount === 0) {
      return formatResponse(false, 'No DirtyDocs entry found for that date');
    }
    return formatResponse(true, 'Marked ' + markedCount + ' row(s) as synced');
  } catch (error) {
    return formatResponse(false, error.toString());
  }
}

/**
 * ONE-TIME CLEANUP — Run manually from the Apps Script editor (not via the web app).
 *
 * The DirtyDocs sheet accumulated:
 *   • Duplicate rows (same userId+date) because of the === comparison bug
 *   • Synced=FALSE rows that are actually already in the Attendance sheet
 *     (markSynced was never called from the frontend before the fix)
 *
 * This function:
 *   1. Cross-checks every Synced=FALSE DirtyDocs row against the Attendance
 *      sheet.  If a matching (userId, date) row exists in Attendance → mark
 *      the DirtyDocs row as Synced=TRUE (the data is safe).
 *   2. For each (userId, date) with multiple DirtyDocs rows, deletes all but
 *      the latest one.
 *
 * Run once after deploying this updated script.
 */
function cleanupAndReconcileDirtyDocs() {
  ensureSheets();
  const attendanceSheet = getSheet(SHEETS.attendance);
  const dirtySheet = getSheet(SHEETS.dirtyDocs);

  // Build confirmed attendance set: "userId|date" keys
  const confirmed = {};
  const attValues = attendanceSheet.getDataRange().getValues();
  for (let i = 1; i < attValues.length; i++) {
    const key = String(attValues[i][1]) + '|' + String(attValues[i][0]);
    confirmed[key] = true;
  }

  const dirtyValues = dirtySheet.getDataRange().getValues();
  const syncedAt = new Date().toISOString();

  // Group rows by "userId|date"
  const grouped = {};
  for (let i = 1; i < dirtyValues.length; i++) {
    const key = String(dirtyValues[i][0]) + '|' + String(dirtyValues[i][1]);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push({ rowIndex: i, markedAt: new Date(dirtyValues[i][3] || 0).getTime() });
  }

  const rowsToDelete = [];
  Object.keys(grouped).forEach(function(key) {
    const rows = grouped[key].sort(function(a, b) { return b.markedAt - a.markedAt; });
    // Mark duplicates (all but latest) for deletion
    for (let j = 1; j < rows.length; j++) rowsToDelete.push(rows[j].rowIndex + 1);
    // For the latest row: if data already in Attendance, mark as synced
    const latestIdx = rows[0].rowIndex;
    if (confirmed[key]) {
      dirtySheet.getRange(latestIdx + 1, 5).setValue(true);
      dirtySheet.getRange(latestIdx + 1, 6).setValue(syncedAt);
    }
  });

  // Delete from bottom to top so indices stay valid
  rowsToDelete.sort(function(a, b) { return b - a; });
  rowsToDelete.forEach(function(rowNum) { dirtySheet.deleteRow(rowNum); });

  const msg = 'cleanupAndReconcileDirtyDocs done. Deleted ' + rowsToDelete.length + ' duplicate rows.';
  Logger.log(msg);
  return msg;
}

function doGet(e) {
  return createJsonResponse({ success: true, data: 'OK' });
}
