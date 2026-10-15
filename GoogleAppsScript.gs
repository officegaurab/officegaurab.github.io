// Google Apps Script for Attendance Tracker v3
// Multi-tab database, Google identity verification, Dirty document tracking
// Deploy as web app: Deploy > New Deployment > Type: Web app

const SPREADSHEET_ID = '1xRWs999mHz51IGToz8gA-WjMuxAt9TB8fJXDqKv38-U';
const DAILY_SAVE_LIMIT = 10;
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
    const count = getDailySaveCount(userId);
    if (count >= DAILY_SAVE_LIMIT) {
      return formatResponse(false, {
        limitReached: true,
        count: count,
        limit: DAILY_SAVE_LIMIT
      });
    }
    
    // Find and update existing entry or create new
    const values = attendanceSheet.getDataRange().getValues();
    let found = false;
    
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === date && values[i][1] === userId) {
        attendanceSheet.getRange(i + 1, 3).setValue(status);
        found = true;
        break;
      }
    }
    
    if (!found) {
      attendanceSheet.appendRow([date, userId, status]);
    }
    
    // Log to dirty docs for tracking
    const dirtyValues = dirtySheet.getDataRange().getValues();
    let dirtyFound = false;
    
    for (let i = 1; i < dirtyValues.length; i++) {
      if (dirtyValues[i][0] === userId && dirtyValues[i][1] === date) {
        dirtySheet.getRange(i + 1, 3).setValue(status);
        dirtySheet.getRange(i + 1, 5).setValue(false);
        dirtyFound = true;
        break;
      }
    }
    
    if (!dirtyFound) {
      dirtySheet.appendRow([userId, date, status, new Date().toISOString(), false, '']);
    }

    logSave(userId);
    
    Logger.log('Attendance saved: ' + userId + ' - ' + date + ' - ' + status);
    return formatResponse(true, 'Attendance saved');
  } catch (error) {
    return formatResponse(false, error.toString());
  } finally {
    if (lock) lock.releaseLock();
  }
}

function getAttendance(userId) {
  try {
    ensureSheets();
    const attendanceSheet = getSheet(SHEETS.attendance);
    const values = attendanceSheet.getDataRange().getValues();
    
    const data = {};
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (row[1] === userId && row[0]) {
        data[row[0]] = row[2];
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
        userId,
        userData.mobile || '',
        userData.name || '',
        userData.email || '',
        userData.company || '',
        userData.inTime || '',
        userData.outTime || '',
        userData.profilePhoto || '',
        targetRow > 0 ? (values[targetRow - 1][8] || new Date().toISOString()) : new Date().toISOString(),
        userData.personalSpreadsheetId || '',
        userData.personalSheetSkipped === true
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
        userId: userId,
        mobile: values[userRow][1],
        name: values[userRow][2],
        email: values[userRow][3],
        company: values[userRow][4],
        inTime: values[userRow][5],
        outTime: values[userRow][6],
        profilePhoto: values[userRow][7],
        personalSpreadsheetId: values[userRow][9] || '',
        personalSheetSkipped: values[userRow][10] === true || values[userRow][10] === 'TRUE'
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

function migrateLegacyUserData(oldUserId, newUserId) {
  const attendanceSheet = getSheet(SHEETS.attendance);
  const attendanceValues = attendanceSheet.getDataRange().getValues();
  for (let i = 1; i < attendanceValues.length; i++) {
    if (attendanceValues[i][1] === oldUserId) attendanceSheet.getRange(i + 1, 2).setValue(newUserId);
  }

  const dirtySheet = getSheet(SHEETS.dirtyDocs);
  const dirtyValues = dirtySheet.getDataRange().getValues();
  for (let i = 1; i < dirtyValues.length; i++) {
    if (dirtyValues[i][0] === oldUserId) dirtySheet.getRange(i + 1, 1).setValue(newUserId);
  }

  const saveLogsSheet = getSheet(SHEETS.saveLogs);
  const saveLogValues = saveLogsSheet.getDataRange().getValues();
  for (let i = 1; i < saveLogValues.length; i++) {
    if (saveLogValues[i][0] === oldUserId) saveLogsSheet.getRange(i + 1, 1).setValue(newUserId);
  }
}

function checkSaveLimit(userId) {
  try {
    ensureSheets();
    const count = getDailySaveCount(userId);
    const limit = DAILY_SAVE_LIMIT;
    const allowed = count < limit;
    
    return formatResponse(true, {
      allowed: allowed,
      count: count,
      limit: limit,
      remaining: Math.max(0, limit - count)
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

function getDirtyDocs(userId) {
  try {
    ensureSheets();
    const dirtySheet = getSheet(SHEETS.dirtyDocs);
    const values = dirtySheet.getDataRange().getValues();
    
    const dirtyDocs = [];
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (row[0] === userId && row[4] === false) {
        dirtyDocs.push({
          date: row[1],
          status: row[2],
          markedAt: row[3],
          synced: row[4]
        });
      }
    }
    
    return formatResponse(true, dirtyDocs);
  } catch (error) {
    return formatResponse(false, error.toString());
  }
}

function markSynced(userId, date) {
  try {
    ensureSheets();
    const dirtySheet = getSheet(SHEETS.dirtyDocs);
    const values = dirtySheet.getDataRange().getValues();
    
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === userId && values[i][1] === date) {
        dirtySheet.getRange(i + 1, 5).setValue(true);
        dirtySheet.getRange(i + 1, 6).setValue(new Date().toISOString());
        return formatResponse(true, 'Marked as synced');
      }
    }
    
    return formatResponse(false, 'Document not found');
  } catch (error) {
    return formatResponse(false, error.toString());
  }
}

function doGet(e) {
  return createJsonResponse({ success: true, data: 'OK' });
}
