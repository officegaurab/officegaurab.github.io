# Google Sign-In and Personal Sheets Setup

The app now uses Google as the account identity. Name and mobile number are required profile fields and are written to the app owner's main Google Sheet. Attendance stays in that central sheet unless the user separately authorizes a personal Sheet in their Drive.

## 1. Configure Google Cloud

1. Open [Google Cloud Console](https://console.cloud.google.com/) and select or create the project used by the app.
2. Enable the **Google Sheets API**.
3. Configure the OAuth consent screen. Add your app name, support email, and authorized domains. While the app is in Testing, add each tester as a test user.
4. Create an OAuth client ID with application type **Web application**.
5. Add the deployed site origin under **Authorized JavaScript origins**, for example `https://officegaurab.github.io`. For local testing, add `http://localhost:8000`.
6. There is no redirect URI for the popup flow used here.

## 2. Set the OAuth Client ID

Use the same Web client ID in both places:

- `index.html`: `GOOGLE_OAUTH_CLIENT_ID`
- `GoogleAppsScript.gs`: `GOOGLE_OAUTH_CLIENT_ID`

The client ID is public configuration, not a client secret. Never add a client secret to this static site.

## 3. Deploy the Central Profile Script

1. Keep `SPREADSHEET_ID` pointed at the app owner's main spreadsheet.
2. Copy the updated `GoogleAppsScript.gs` into that spreadsheet's Apps Script project.
3. Deploy as a Web app that **executes as you**, the spreadsheet owner.
4. Set access to **Anyone** so the static app can call it. The script verifies the Google ID token and checks that its subject matches the requested account before touching profile or attendance data.
5. Deploy a new version and set the resulting URL as `googleScriptURL` in `index.html`.

The first successful profile save upgrades the existing `Users` tab with personal-sheet metadata columns. Existing mobile-keyed profiles and attendance rows are migrated only when the saved email matches the signed-in Google account's verified email. Records without that match are not automatically claimed based on an unverified phone number.

## 4. User Flow

1. User signs in with Google.
2. User enters required name and mobile number. The app saves this profile to the owner's main spreadsheet before continuing.
3. User can allow the app to create an `Office Attendance - <name>` spreadsheet in their Drive, or continue using the central attendance sheet.
4. The app stores the personal spreadsheet ID in the central profile sheet. On another device, the user signs in with the same Google account and reconnects Drive from **My Profile** if prompted.

Personal attendance access uses the `drive.file` scope and the Sheets API directly from the browser. Users do not deploy Apps Script into their own spreadsheet. Their Google account must retain access to the created file and must authorize the app on each device when required.

## 5. Before Launch

### Testing with selected accounts

- In Google Cloud Console, open **Google Auth Platform → Branding** and set the app name to **Office Attendance Tracker**, with the app support email and developer contact email. This avoids displaying the unrelated `github.dev` name in Google's consent screen.
- Open **Google Auth Platform → Audience** and leave the app in **Testing** while developing.
- Under **Test users**, add every Google account that needs to try Drive connection, including `progaurab@gmail.com`.
- Save the changes, wait a few minutes, then retry from the same authorized JavaScript origin. Testing mode blocks accounts that are not on this list.

### Public launch

- When the app should be available to users beyond the test-user list, change the audience/publishing status to **In production** using **Google Auth Platform → Audience → Publish app**.
- Publishing and verification are separate: Google may allow production without additional review for the requested scopes, or may require verification depending on the app, audience, and scopes. Follow the requirements shown in the Cloud Console.
- If verification is requested, prepare a verified domain, public homepage, privacy policy explaining the Google account and Drive/Sheets data use, support contact, and any requested demonstration of the consent flow and data deletion process.
- Do not request broader Google Drive scopes than the app needs. This app requests `drive.file` so it can create and access the attendance spreadsheet the user chooses for the app.
- If users are only you or a small invited group, keep the app in Testing and maintain the test-user list instead of starting public verification.

- Test with at least two Google accounts and two devices.
- Verify the main `Users` row is saved before allowing the user to continue.
- Verify personal-Sheet creation, migration, reload, reset, and reconnect behavior.
- Do not distribute the app while either OAuth client ID is still the placeholder value.
