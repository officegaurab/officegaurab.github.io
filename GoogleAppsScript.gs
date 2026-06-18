// Google Apps Script for Attendance Tracker v3
// Multi-tab database, direct mobile login, Dirty document tracking
// Deploy as web app: Deploy > New Deployment > Type: Web app

const SPREADSHEET_ID = '1xRWs999mHz51IGToz8gA-WjMuxAt9TB8fJXDqKv38-U';

// Sheet names
const SHEETS = {
  attendance: 'Attendance',
  users: 'Users',
  saveLogs: 'SaveLogs',
  dirtyDocs: 'DirtyDocs'
};

function doPost(e) {
  try {
    const payload = parsePayload(e);
    const action = payload.action;

    switch(action) {
      case 'saveAttendance':
        return saveAttendance(payload.userId, payload.date, payload.status);
      case 'getAttendance':
        return getAttendance(payload.userId);
      case 'saveUser':
        return saveUser(payload.userId, payload.userData);
      case 'getUser':
        return getUser(payload.userId);
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
  try {
    ensureSheets();
    const attendanceSheet = getSheet(SHEETS.attendance);
    const dirtySheet = getSheet(SHEETS.dirtyDocs);
    
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
      logSave(userId);
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
    
    Logger.log('Attendance saved: ' + userId + ' - ' + date + ' - ' + status);
    return formatResponse(true, 'Attendance saved');
  } catch (error) {
    return formatResponse(false, error.toString());
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

function saveUser(userId, userData) {
  try {
    ensureSheets();
    const usersSheet = getSheet(SHEETS.users);
    const values = usersSheet.getDataRange().getValues();
    
    let found = false;
    
    // Check if user exists
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === userId) {
        // Update existing user
        usersSheet.getRange(i + 1, 1, 1, 8).setValues([[
          userId,
          userData.mobile || '',
          userData.name || '',
          userData.email || '',
          userData.company || '',
          userData.inTime || '',
          userData.outTime || '',
          userData.profilePhoto || ''
        ]]);
        found = true;
        break;
      }
    }
    
    if (!found) {
      // Create new user
      usersSheet.appendRow([
        userId,
        userData.mobile || '',
        userData.name || '',
        userData.email || '',
        userData.company || '',
        userData.inTime || '',
        userData.outTime || '',
        userData.profilePhoto || '',
        new Date().toISOString()
      ]);
    }
    
    Logger.log('User saved: ' + userId);
    return formatResponse(true, 'User profile saved');
  } catch (error) {
    return formatResponse(false, error.toString());
  }
}

function getUser(userId) {
  try {
    ensureSheets();
    const usersSheet = getSheet(SHEETS.users);
    const values = usersSheet.getDataRange().getValues();
    
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === userId) {
        return formatResponse(true, {
          userId: values[i][0],
          mobile: values[i][1],
          name: values[i][2],
          email: values[i][3],
          company: values[i][4],
          inTime: values[i][5],
          outTime: values[i][6],
          profilePhoto: values[i][7]
        });
      }
    }
    
    return formatResponse(false, 'User not found');
  } catch (error) {
    return formatResponse(false, error.toString());
  }
}

// ===== SAVE LIMIT FUNCTIONS =====

function checkSaveLimit(userId) {
  try {
    ensureSheets();
    const count = getDailySaveCount(userId);
    const limit = 3; // 2-3 saves per day
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
    sheet.appendRow(['UserID', 'Mobile', 'Name', 'Email', 'Company', 'InTime', 'OutTime', 'ProfilePhoto', 'CreatedAt']);
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
