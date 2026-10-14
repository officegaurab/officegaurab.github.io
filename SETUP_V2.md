# Office Attendance Tracker - V2 Setup Guide

## 🎉 What's New in V2

✅ **Firebase Phone Authentication (OTP)**  
✅ **Google Sheets Database** (Attendance + Users + SaveLogs)  
✅ **Right-Side Navigation Drawer**  
✅ **User Profile Management** (with photo upload)  
✅ **10 Saves Per Day Limit**
✅ **Auto-Registration on First Save**  
✅ **Editable Profile Fields** (optional)  
✅ **Rounded Profile Photos** (Base64 storage)  

---

## 📋 Prerequisites

1. **Google Sheet**: Already created (your current sheet)
2. **Firebase Project**: Free tier is sufficient
3. **Web Server**: Your GitHub Pages (officegaurab.github.io)

---

## STEP 1: Set Up Firebase Project

### 1.1 Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **Add Project**
3. Enter name: "attendance-tracker-v2"
4. Choose region, accept terms
5. Create project

### 1.2 Get Firebase Web Config

1. In Firebase Console: **Project Settings** (gear icon)
2. Go to **General** tab
3. Scroll to "Your apps" section
4. Click "Web" app icon (icon: `</>`)
5. Register app with name "Attendance Tracker"
6. Copy the config object:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "attendance-tracker-v2.firebaseapp.com",
  projectId: "attendance-tracker-v2",
  storageBucket: "attendance-tracker-v2.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123xyz..."
};
```

### 1.3 Enable Phone Authentication

1. In Firebase Console: **Authentication**
2. Click **Sign-in method** tab
3. Click **Phone** provider
4. Enable it
5. Add your own phone number for testing (optional)
6. Save

### 1.4 Set Up reCAPTCHA v3 (Required for Phone Auth)

1. In Firebase Console: **Authentication** → **Settings** tab
2. Look for "reCAPTCHA Enterprise" section
3. Click "Create Key" or use existing
4. Note the site key (you'll need it)

---

## STEP 2: Update index.html with Firebase Config

1. Open `index.html` in VS Code
2. Find this section (around line 480):

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_ID",
  appId: "YOUR_APP_ID"
};
```

3. Replace with your actual Firebase config
4. Save file

---

## STEP 3: Deploy Updated Google Apps Script

### 3.1 Open Google Apps Script

1. Open your Google Sheet
2. Click **Extensions** → **Apps Script**
3. Delete all existing code
4. Copy entire `GoogleAppsScript.gs` file
5. Paste into Apps Script editor
6. Save (Ctrl+S)

### 3.2 Deploy as Web App

1. Click **Deploy** button
2. Select **New Deployment**
3. Click gear icon → Choose **Web app**
4. Settings:
   - **Execute as**: Your account (Owner email)
   - **Who has access**: **Anyone**
   - ⚠️ **IMPORTANT**: Choose "Anyone" for public access
5. Click **Deploy**
6. Copy the deployment URL

### 3.3 Update App with Script URL

1. Open your attendance app
2. Profile menu (👤) → Login → Wait until logged in
3. Click menu (☰) → Settings
4. Paste Google Apps Script URL
5. Click Save
6. Should see "Connection successful"

---

## STEP 4: Test the Complete Flow

### Test Login
1. **Open app** in browser
2. Enter test phone number (e.g., +91 9876543210)
3. Click "Send OTP"
4. Complete reCAPTCHA
5. Enter OTP (check Firebase Console for test OTP)
6. Click "Verify & Login"

### Test Registration
1. After first login, registration form appears
2. **Mobile**: Auto-filled (required)
3. Fill: Name, Email, Company, Office Hours
4. Click "Save Profile"
5. ✅ Check Google Sheet → "Users" tab → Should see your entry

### Test Attendance Marking
1. Click any day in calendar
2. Choose status (Office/Home/Holiday/etc.)
3. Should see "Saves today: 1/3"
4. ✅ Check Google Sheet → "Attendance" tab → Should see entry

### Test Save Limit
1. Mark 3 more days (total 3)
2. After 3rd save, message shows "Limit reached"
3. Try 4th save → Button disabled
4. Next day (or wait 24 hours) → Limit resets

### Test Profile
1. Click 👤 button (top-right)
2. Update any field
3. Upload profile photo
4. Click "Save Changes"
5. ✅ Check Google Sheet → "Users" tab → Photo updated

---

## 📱 User Testing Scenario

### User 1: +91 98765 43210
1. Login → Register with name "John"
2. Mark 2 office days
3. Check Google Sheet (should see 2 entries)

### User 2: +91 87654 32109 (Different device)
1. Login with different number → Register with name "Jane"
2. Mark 3 different days
3. Check Google Sheet (should see 5 total entries: 2 John + 3 Jane)

### Back to User 1: Change device back
1. Login with +91 98765 43210
2. Should see John's 2 office days on calendar
3. User data isolated correctly ✅

---

## 📊 Google Sheet Tab Structure

### Tab 1: Attendance
```
Date           | User              | Status
2024-12-01     | +91 98765 43210   | office
2024-12-02     | +91 98765 43210   | home
2024-12-03     | +91 87654 32109   | holiday
```

### Tab 2: Users
```
UserID          | Mobile            | Name  | Email          | Company | InTime | OutTime | ProfilePhoto
+91 98765 43210 | +91 98765 43210   | John  | john@email.com | Acme    | 9      | 18      | data:image/...
+91 87654 32109 | +91 87654 32109   | Jane  | jane@email.com | Tech    | 8      | 17      | data:image/...
```

### Tab 3: SaveLogs
```
UserID          | Date       | Count
+91 98765 43210 | 12/13/2024 | 3
+91 87654 32109 | 12/13/2024 | 2
```

---

## 🔑 Key Features Explained

### Daily Google Sheets Save Limit (10/day)
- Users can sync attendance changes up to 10 times per day
- Counter resets at midnight
- After limit: changes remain saved locally on the current device

### Save Limit Logic
- Tracks: `SaveLogs` sheet
- Format: UserID | Date | Count
- Reset: Automatic (daily)
- Bypass: Only admin can override (future feature)

### Profile Photo
- Stored as: Base64 in "Users" sheet
- Size limit: ~2MB (browser FileReader)
- Format: JPEG/PNG/WebP
- Display: Rounded circle (CSS border-radius)

### Navigation Drawer
- Opens: Right side (RTL style)
- Menu items: Profile, Settings, Logout, Help
- Closes: On item click or overlay click

### Office Hours
- Format: 0-23 (24-hour format)
- Stored as: "9" (means 9:00 AM)
- Display: "9:00 (AM)"
- Flexible: Can edit anytime

---

## 🚀 Deployment

### Push to GitHub Pages

```bash
cd /workspaces/officegaurab.github.io
git add .
git commit -m "V2: Firebase auth, user profiles, save limits"
git push origin main
```

### Access App
- URL: https://officegaurab.github.io/
- Works on: Desktop + Mobile
- Mobile OTP: Get SMS on registered number

---

## 🐛 Troubleshooting

### "Phone number invalid"
- Use international format: +91 9876543210
- Include country code

### "reCAPTCHA error"
- Check Firebase → Authentication → Settings
- Ensure reCAPTCHA key is configured
- Clear browser cache and reload

### "Failed to save: Connection error"
- Check Google Apps Script URL in Settings
- Verify URL format: `https://script.google.com/macros/s/[ID]/userweb`
- Test: Open URL in browser (should show blank page, not error)

### "Profile not loading"
- User not registered yet
- Clear cache and logout/login again

### "Save limit not working"
- Check SaveLogs sheet exists (auto-created)
- Verify date format matches (MM/DD/YYYY)

---

## 🔐 Security Notes

- **Phone verified**: Firebase handles OTP validation
- **User data**: Each user only sees their own data
- **Profile photos**: Stored as Base64 (local processing)
- **Connection**: HTTPS only (GitHub Pages)
- **reCAPTCHA**: Prevents bot abuse

---

## 📈 Future Enhancements

- Export data to PDF/Excel
- Admin dashboard
- Team management
- Attendance reports
- Push notifications
- Offline mode (Service Worker)
- Dark theme

---

## 📞 Support

**Setup Issues?**
- Check Firebase config in index.html
- Verify Google Apps Script deployment
- Check browser console (F12) for errors

**Deployment Issues?**
- Run `git status` to see changes
- Run `git push` to deploy

---

## ✅ Checklist

- [ ] Firebase project created
- [ ] Phone auth enabled
- [ ] Firebase config added to index.html
- [ ] Google Apps Script deployed
- [ ] Apps Script URL added to Settings
- [ ] Test user registered
- [ ] Attendance marked and verified in Sheet
- [ ] Profile photo uploaded and displays
- [ ] Save limit tested
- [ ] All 3 tabs in Google Sheet populated

---

**Version**: V2 - Firebase Auth + Google Sheets  
**Last Updated**: June 2024  
**Status**: Ready for Production ✅
