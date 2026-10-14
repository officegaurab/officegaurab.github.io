# 📊 Office Attendance Tracker - V2

> **Professional attendance management with Firebase authentication and Google Sheets database**

---

## 🎯 What This App Does

✅ Mark office/home/leave attendance  
✅ Track monthly attendance automatically  
✅ Multi-user support (login with phone)  
✅ User profiles with photos  
✅ Save rate limiting (prevent spam)  
✅ Real-time Google Sheet sync  
✅ Mobile friendly  

---

## 🚀 Quick Start (Choose Your Path)

### Path 1️⃣: Complete Setup (First Time)
**Time: 30 min | Level: Beginner**

1. Read: [FIREBASE_QUICK_START.md](FIREBASE_QUICK_START.md) (Firebase config)
2. Read: [SETUP_V2.md](SETUP_V2.md) (Complete guide)
3. Done! Deploy and test

### Path 2️⃣: Firebase Only (Already have Google Apps Script)
**Time: 5 min | Level: Intermediate**

1. Read: [FIREBASE_QUICK_START.md](FIREBASE_QUICK_START.md)
2. Update `index.html` with Firebase config
3. Deploy and test

### Path 3️⃣: Upgrading from V1
**Time: 15 min | Level: Intermediate**

1. Backup your Google Sheet
2. Read: [CHANGELOG.md](CHANGELOG.md) (what's new)
3. Follow: [SETUP_V2.md](SETUP_V2.md)
4. Redeploy everything

---

## 📋 What You Need

- ✅ Google Account (for Firebase + Sheet)
- ✅ Phone number (for OTP login)
- ✅ GitHub Pages (or any web host)
- ✅ 30 minutes (one-time setup)

**No coding needed!** Everything is pre-built.

---

## 🎨 Features Overview

### 🔐 Authentication
- Phone-based OTP login
- Firebase (secure, verified users)
- Multi-device support
- Automatic session management

### 👤 User Profiles
- **Editable fields**: Name, Email, Company, Office Hours
- **Profile photo**: Upload and display (rounded)
- **All fields optional** except mobile
- **Auto-saved** to Google Sheet

### 📅 Attendance Tracking
- Mark: Office, Home, Holiday, Leave, No-Show
- View: Monthly calendar with stats
- Statistics: Working days, office %, required days
- Progress bar: Visual representation

### 🎚️ Rate Limiting
- **Limit**: 10 Google Sheets saves per day
- **Purpose**: Prevent accidental spam
- **Resets**: Daily at midnight
- **Feedback**: Shows remaining saves

### 📱 Navigation Drawer
- Right-side menu
- Quick access to: Profile, Settings, Logout, Help
- Professional animation
- Mobile-optimized

### 📊 Database (Google Sheet)
- **3 tabs**: Attendance, Users, SaveLogs
- **Always synced**: Real-time updates
- **Shareable**: Team access (if shared)
- **Exportable**: Download as CSV/Excel

---

## 🔧 System Architecture

```
┌─────────────────────────────────────────┐
│      Firebase Phone Authentication      │
│         (OTP via SMS)                   │
└──────────────────┬──────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
   ┌────▼────┐         ┌─────▼──────┐
   │ Browser │────────▶│   Google   │
   │  (V2)   │         │   Sheet    │
   │ index.  │◀────────│  Database  │
   │  html   │         │(3 tabs)    │
   └────────┘         └────────────┘
        │
        └──▶ Apps Script
             (Backend logic)
```

---

## 📁 File Guide

| File | Purpose | Edit? |
|------|---------|-------|
| **index.html** | Main app | ⚠️ Firebase config only |
| **GoogleAppsScript.gs** | Backend | Deploy to Google |
| **SETUP_V2.md** | Full setup guide | 📖 Read |
| **FIREBASE_QUICK_START.md** | Firebase (5 min) | 📖 Read |
| **CHANGELOG.md** | What's new | 📖 Read |
| **README.md** | This file | 📖 Read |

---

## 🎯 30-Minute Setup Plan

### ⏱️ Minutes 1-10: Firebase Setup
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create project "attendance-tracker-v2"
3. Enable Phone authentication
4. Copy Firebase config

### ⏱️ Minutes 11-20: Update App
1. Open `index.html` in VS Code
2. Find line ~480 (firebaseConfig)
3. Paste your Firebase config
4. Save file

### ⏱️ Minutes 21-25: Deploy Google Apps Script
1. Open your Google Sheet
2. Extensions → Apps Script
3. Paste `GoogleAppsScript.gs` code
4. Deploy as Web app

### ⏱️ Minutes 26-30: Test
1. Get deployment URL
2. Add to app Settings
3. Test login with your phone
4. Mark one day to verify

✅ **Done!**

---

## 📱 How to Use (User Guide)

### First Time
```
1. Open app
2. Enter phone: +91 9876543210
3. Click "Send OTP"
4. Check SMS for 6-digit code
5. Enter OTP
6. Fill registration form
7. Click "Save Profile"
8. Start marking days!
```

### Returning User
```
1. Open app
2. Automatically logged in
3. Click calendar day
4. Choose status (Office/Home/etc.)
5. Auto-saves to Google Sheet
```

### Change Profile
```
1. Click 👤 button (top-right)
2. Edit any field
3. Upload photo
4. Click "Save Changes"
```

### View Stats
```
1. Right sidebar shows:
   - Working days
   - Office days
   - WFH days
   - Leave days
   - Required office (50%)
   - Progress to target
```

---

## ⚙️ Configuration

### Google Apps Script URL
1. After deploying Google Apps Script
2. You get a URL: `https://script.google.com/macros/s/[ID]/userweb`
3. Copy this URL
4. In app: Click ☰ (menu) → Settings
5. Paste URL → Save

### Firebase Config
In `index.html` (line ~480), replace:
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

---

## 🔒 Security & Privacy

✅ **Phone verified**: Only real phone numbers  
✅ **User authenticated**: Firebase handles it  
✅ **HTTPS only**: Encrypted connection  
✅ **Data isolated**: Each user sees only their data  
✅ **Photos local**: Base64 processing (no upload server)  
✅ **Google Sheet**: Protected by your account  

---

## 📊 Google Sheet Structure

### Tab 1: Attendance
```
Date       | User           | Status
2024-06-13 | +91 98765 4321 | office
2024-06-12 | +91 98765 4321 | home
```

### Tab 2: Users
```
UserID        | Mobile         | Name | Email           | Company | InTime | OutTime
+91 98765 4321| +91 98765 4321 | John | john@email.com  | Acme    | 9      | 18
```

### Tab 3: SaveLogs
```
UserID         | Date       | Count
+91 98765 4321 | 06/13/2024 | 3
```

---

## 🐛 Troubleshooting

### App won't load
- Clear browser cache (Ctrl+Shift+Delete)
- Check Firebase config in index.html
- Check browser console (F12) for errors

### OTP not received
- Check phone number format: +91 9876543210
- Wait 30 seconds
- Check Firebase Console → Users tab

### Can't save attendance
- Check: Did you register? (should auto-trigger)
- Check: Have you reached the 10/day limit?
- Check: Google Apps Script URL in Settings

### Profile photo not showing
- Try: Different image format (JPG/PNG)
- Check: Image size (< 2MB)
- Reload: Browser page

---

## 📚 Documentation Structure

```
README.md (START HERE)
  ├─ FIREBASE_QUICK_START.md (5 min setup)
  ├─ SETUP_V2.md (complete guide)
  ├─ CHANGELOG.md (what's new)
  └─ GoogleAppsScript.gs (code reference)
```

---

## 🚀 Deployment

### Push to GitHub Pages
```bash
cd /workspaces/officegaurab.github.io

# Stage changes
git add .

# Commit
git commit -m "V2: Firebase auth, user profiles, drawer"

# Push
git push origin main
```

### Access App
- **URL**: https://officegaurab.github.io/
- **Mobile**: Works on phones (responsive)
- **Desktop**: Works on laptops/PCs

---

## 💡 Tips & Tricks

### 🎯 Pro Tips
- **Bookmark app**: Pin to home screen (mobile)
- **Offline access**: Calendar loads cached (no internet)
- **Share sheet**: Invite team to view data
- **Export data**: Download from Google Sheet
- **Bulk edit**: Edit Google Sheet directly (advanced)

### 🔄 Syncing
- **Real-time**: Changes show instantly
- **Background**: No refresh needed
- **Offline**: Retries when online
- **Multi-device**: All devices sync

### 📱 Mobile
- **Responsive**: Designed for phones
- **Drawer**: Swipe from right
- **Photos**: Tap to upload
- **Touch**: Buttons optimized for fingers

---

## 📞 Support

### Getting Help
1. Check: [CHANGELOG.md](CHANGELOG.md) (what's new)
2. Check: Troubleshooting section above
3. Check: Browser console (F12) for errors
4. Check: Firebase Console for logs

### Common Issues
- **"Phone invalid"**: Use format +91 9876543210
- **"reCAPTCHA error"**: Refresh and try again
- **"Connection failed"**: Check Apps Script URL

---

## 🎯 Next Steps

### Immediate ✅
1. Read: [FIREBASE_QUICK_START.md](FIREBASE_QUICK_START.md)
2. Setup: Firebase project
3. Update: index.html with config
4. Deploy: Google Apps Script
5. Test: Login and mark attendance

### Short Term (Week 1)
- [ ] Test with team members
- [ ] Verify sync with Google Sheet
- [ ] Share sheet with viewers
- [ ] Export data to verify

### Medium Term (Month 1)
- [ ] Customize office hours
- [ ] Gather feedback
- [ ] Plan enhancements
- [ ] Document processes

### Long Term (Roadmap)
- [ ] Admin dashboard
- [ ] Attendance reports
- [ ] Team management
- [ ] Mobile app

---

## 📈 Version History

| Version | Release | Key Feature |
|---------|---------|-------------|
| **V1** | Mar 2024 | Device-based, localStorage |
| **V2** | Jun 2024 | Firebase auth, Google Sheet DB |
| **V3** | Q1 2025 | Admin dashboard, Reports |

---

## 🎓 Learning Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Google Apps Script Guide](https://developers.google.com/apps-script)
- [Google Sheets API](https://developers.google.com/sheets/api)

---

## ✅ Pre-Launch Checklist

- [ ] Firebase project created
- [ ] Phone auth enabled
- [ ] Firebase config added
- [ ] Google Apps Script deployed
- [ ] Apps Script URL configured
- [ ] Test user registered
- [ ] Attendance marked & verified
- [ ] Profile photo uploaded
- [ ] Save limit tested
- [ ] All 3 tabs populated

---

## 🎉 You're All Set!

Everything is ready to go. Follow the **30-Minute Setup Plan** above and you'll be running in no time.

**Questions?** Check [SETUP_V2.md](SETUP_V2.md) or [FIREBASE_QUICK_START.md](FIREBASE_QUICK_START.md)

**Ready?** Let's go! 🚀

---

**Latest Version**: V2 (Firebase Authentication)  
**Last Updated**: June 2024  
**Status**: ✅ Production Ready
