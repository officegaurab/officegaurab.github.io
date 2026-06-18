# Attendance Tracker - New Features Implementation

## Overview
Your attendance tracker has been enhanced with automatic data persistence, dirty document marking, intelligent syncing, and a flexible login system. All changes are backward compatible with existing functionality.

---

## ✨ New Features

### 1. **Header Redesign**
**What Changed:**
- Header now shows: `[User Name]` | `Attendance Tracker` | `Current Date`
- Example: Shows "John Doe" with "Attendance Tracker" subtitle and today's date
- Updates automatically on page load and page refresh

**User Benefit:** Cleaner, more informative header that always displays current date.

---

### 2. **Persistent Data (Always Works)**
**What Changed:**
- All attendance data saved to browser's localStorage automatically
- Data persists when you refresh the page or close the browser

**Technical Details:**
- Stored under: `attendance_${userId}` and `userProfile_${userId}`
- Works completely offline
- Syncs to Google Sheets when connection available

**User Benefit:** Never lose your attendance data even if page refreshes or connection drops.

---

### 3. **Dirty Document Marking System**
**What Changed:**
- Unsynced records are marked as "dirty" automatically
- Dirty documents stored locally and tracked for cloud sync
- When synced to Google Sheets, marked as "clean"

**How it Works:**
1. User marks attendance locally → Stored in localStorage
2. System marks record as "dirty" 
3. Background scheduler attempts sync 3x per day
4. On successful sync → Marked as "clean"

**User Benefit:** Know which records are saved locally vs. synced to cloud.

---

### 4. **Intelligent 3x Daily Sync**
**What Changed:**
- Automatic cloud sync attempts scheduled 3 times per day
- Sync times: 9 AM, 1 PM, 5 PM (your timezone)
- Additional interval-based sync every 4 hours
- Respects daily sync limit (3 attempts max per day)

**How it Works:**
- Syncs only when connection available
- Syncs only if records are marked as "dirty"
- Won't sync more than 3 times per day
- Next sync resets at midnight

**User Benefit:** Your data automatically syncs to Google Sheets multiple times daily without manual action.

---

### 5. **Login Skip After 5 Saves (Current Month Only)**
**What Changed:**
- After 5 local saves, app grants temporary access for the entire current month
- No login required for the rest of the current month
- Resets at month boundary

**How it Works:**
1. User makes 1st-4th saves → See message asking to login
2. On 5th save → Message: "5 Saves Unlocked! You can now use this app for the rest of the month without logging in!"
3. Can use freely until month ends
4. New month arrives → Prompted to login again

**Login Requirement Timeline:**
- Saves 1-4: Optional login
- Saves 5+: Full month access granted (no login needed)
- New month: Login required again

**User Benefit:** Use the app freely for current month after just 5 saves, then login next month.

---

### 6. **Dynamic Menu (Login/Logout Toggle)**
**What Changed:**
- Menu changes based on login status
- Non-authenticated users see: **Login** 🚪
- Authenticated users see: **Logout** 🚪

**Menu Options:**
- **My Profile** → Edit your profile
- **Login/Logout** → Toggle authentication (text changes based on status)
- **Help** → Contact support

**User Benefit:** Always know your login status from the menu.

---

### 7. **Month-End Login Check**
**What Changed:**
- At the start of each new month, system checks if login is needed
- Reminds non-logged-in users to login for new month

**How it Works:**
1. User uses app in January without logging in
2. February 1st arrives → Gets message: "New Month - Please login to continue"
3. Can skip and continue using for 5 more saves in February

**User Benefit:** System reminds you to login when new month starts.

---

## 📊 Data Storage Architecture

### Local Storage (Browser)
```
attendance_${userId}           → Current month's attendance data
userProfile_${userId}          → User profile info
dirty_${userId}_${date}        → Dirty document tracking
lastUserId                      → Last used user ID
localCalendarSaveCount         → Count of local saves
remoteSyncQueue               → Pending sync queue
lastLoginCheckMonth           → Last checked month
monthApproved_YYYY-MM         → Current month approval
```

### Google Sheets (Cloud - Optional)
```
Attendance Sheet              → Master record (synced)
Users Sheet                  → User profiles
SaveLogs Sheet              → Daily sync count tracking
DirtyDocs Sheet             → Dirty document tracking
```

---

## 🔄 Sync Workflow

```
┌─────────────────────────────────────────────────────┐
│ User Marks Attendance                              │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│ 1. Save to localStorage (IMMEDIATE)                │
│ 2. Mark as "dirty" locally                         │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
    ┌──────────────────────┐
    │ Wait for Next Sync   │
    │ Time (9AM/1PM/5PM)   │
    └──────────────┬───────┘
                   │
                   ▼
    ┌──────────────────────────────────────┐
    │ Background Sync Attempt              │
    │ (Only if dirty & sync remaining)    │
    └──────────┬───────────────────────────┘
               │
               ▼
    ┌──────────────────────────────────────┐
    │ Push to Google Sheets Cloud          │
    │ Mark as "synced" locally & remotely  │
    │ Increment daily sync counter         │
    └──────────────────────────────────────┘
```

---

## 💾 Key Files Modified

### index.html
- **Header section:** Updated to show name, "Attendance Tracker", current date
- **Menu:** Changed logout to dynamic login/logout based on auth state
- **JavaScript Functions Added:**
  - `updateAuthMenuText()` → Updates menu text
  - `handleAuthMenu()` → Handles login/logout action
  - `markDirty()` → Marks record as dirty
  - `getDirtyDocuments()` → Retrieves unsynced records
  - `clearDirty()` → Clears dirty flag
  - `initializeSyncScheduler()` → Sets up 3x daily sync
  - `scheduleSyncAtTime()` → Schedules sync at specific hour
  - `syncDirtyDocuments()` → Performs sync
  - `checkMonthlyLoginRequired()` → Month-end login check
  - `approveCurrentMonth()` → Approves month for access

### GoogleAppsScript.gs
- **New Sheet:** `DirtyDocs` for tracking synced/unsynced records
- **New Actions:**
  - `getDirtyDocs` → Retrieves dirty documents from server
  - `markSynced` → Marks document as synced on server
- **Enhanced saveAttendance:** Now logs to DirtyDocs sheet
- **Enhanced ensureSheets:** Creates DirtyDocs sheet if missing

---

## 🚀 Usage Guide

### Regular User (No Login)
1. Open app → Start marking attendance
2. First 4 saves → Optional login prompt
3. 5th save → "5 Saves Unlocked!" message
4. Rest of month → Full access without login
5. New month → Login prompt appears

### Authenticated User (Logged In)
1. Open app → Already logged in
2. Mark attendance → Saved locally & queued for sync
3. Background system → Syncs 3 times daily to Google Sheets
4. Any time → Can logout from menu

### Checking Sync Status
- Look at the message near attendance options
- Shows: "Cloud sync attempts today: X/3"
- Also shows pending items in sync queue

---

## ⚙️ Configuration

### Sync Times (Default: 9 AM, 1 PM, 5 PM)
To change sync times, edit in `index.html`:
```javascript
const syncTimes = [9, 13, 17]; // Change these hours (24-hour format)
```

### Daily Sync Limit (Default: 3)
To change max syncs per day, edit in `GoogleAppsScript.gs`:
```javascript
const limit = 3; // Change this number
```

### Month Approval Threshold (Default: 5 saves)
Currently hardcoded at 5 saves, can be modified in `saveAttendance()` function.

---

## 🔐 Privacy & Data

- **Local Data:** Stored only in your browser
- **Cloud Data:** Only pushed if you configure Google Sheets integration
- **Deletion:** Clear browser cache/localStorage to delete local data
- **Month Reset:** Each month gets fresh tracking for sync limits

---

## 🐛 Troubleshooting

### Data Not Persisting
- Check: Browser's localStorage is enabled
- Solution: Clear cache and reload page

### Not Syncing to Google Sheets
- Check: Google Apps Script URL configured in settings
- Check: Google Apps Script deployed correctly
- Check: Sync limit reached (3/3 for today)

### Login Prompt Not Appearing
- Check: localStorage key `lastLoginCheckMonth` 
- Solution: Clear localStorage for your userId

---

## 📝 Summary of Changes

| Feature | Before | After |
|---------|--------|-------|
| Header | User info only | Name + "Attendance Tracker" + Date |
| Menu | Only Logout | Login/Logout toggle |
| Data on Refresh | Lost | Persistent (localStorage) |
| Syncing | Manual/On-demand | 3x daily automatic |
| Unsynced Tracking | None | Marked as "dirty" |
| Login Requirement | Always required | Skip after 5 saves (current month) |
| Monthly Reset | None | Prompt on new month |

---

## 🔄 Next Steps

1. **Update Google Apps Script** (if using cloud sync):
   - Deploy new version with DirtyDocs sheet support
   - Copy code from `GoogleAppsScript.gs`

2. **Test Locally**:
   - Make 5 attendance marks
   - Verify 5-save unlock message appears
   - Check localStorage data persists on refresh

3. **Monitor Sync**:
   - Check sync messages near attendance options
   - Verify data appears in Google Sheets after sync times

---

## 📞 Support

For issues or questions:
- Check the help section in the menu (?)
- Review this documentation
- Check browser console for error messages (F12 → Console)

