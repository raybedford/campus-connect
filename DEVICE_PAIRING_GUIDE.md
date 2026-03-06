# 📱 Device Pairing Guide - Campus Connect

## Transfer Your Encryption Keys Between Devices

Campus Connect uses a **Smart TV-style pairing system** to easily transfer your encryption keys from one device to another. No typing long codes, no manual copy/paste - just scan and confirm!

---

## 🎯 When Do You Need This?

- **Setting up a new device** (e.g., you have the mobile app and want to add desktop)
- **Switching phones** (transferring keys to your new phone)
- **Adding a tablet** (want to use Campus Connect on multiple devices)
- **Lost keys on a device** (need to re-import from your primary device)

---

## 📋 Before You Start

### Requirements:
- ✅ You must be **logged in** on both devices
- ✅ Your **primary device** (the one with keys) must have access to encryption keys
- ✅ Your **new device** must have a camera to scan QR codes (or you can use the paste method)
- ✅ Both devices must have **internet access**

### What Gets Transferred:
- 🔐 Your **private encryption key** (securely encrypted during transfer)
- 🔑 Your **public key**
- ⏱️ Transfer expires after **5 minutes** for security

---

## 🚀 Method 1: Mobile → Desktop (Most Common)

This is perfect for setting up the desktop app when your mobile device is your primary device.

### Step 1: On Your Desktop

1. Open **Campus Connect Desktop App**
2. Click the **Settings** icon (⚙️ gear) in the top right
3. Click **"📱 QR Transfer"** button
4. Click the **"📱 Pair with Mobile"** tab (should be selected by default)
5. You'll see:
   - A large **QR code**
   - A **6-character code** (like "ABC123")
   - Message: "⏳ Waiting for your mobile device..."

### Step 2: On Your Mobile

1. Open your phone's **Camera app** (the built-in iOS/Android camera)
2. Point your camera at the **QR code** on your desktop screen
3. A notification will pop up - **Tap it** to open the link
4. You'll be taken to the pairing page showing:
   - The **same 6-character code** from your desktop
   - A "Transfer My Keys" button

### Step 3: Verify & Transfer

1. **Verify** the code on your mobile **matches** the code on your desktop
   - This ensures you're pairing with the correct device
   - Security measure to prevent unauthorized access
2. Tap **"🔐 Transfer My Keys"**
3. Wait a few seconds...

### Step 4: Done! ✅

- **Mobile**: Shows "✅ Keys transferred!"
- **Desktop**: Automatically receives keys and shows success message
- **Desktop**: You can now send and read encrypted messages!

---

## 🖥️ Method 2: Desktop → Mobile

This works when your desktop is your primary device and you're adding a mobile device.

### Step 1: On Your Mobile

1. Open **campusconnect.raybedford.net** in your browser
2. Log in to your account
3. Tap the **Settings** icon (⚙️)
4. Tap **"📱 QR Transfer"**
5. Tap **"📱 Pair with Mobile"** tab
6. You'll see the QR code and 6-character code

### Step 2: On Another Device

1. Use another device with a camera (phone, tablet, etc.)
2. Open **Camera app**
3. Scan the QR code
4. Verify the code matches
5. Tap "Transfer My Keys"

### Step 3: Done!

Your mobile device now has the encryption keys!

---

## 💻 Method 3: No Camera Available (Manual Transfer)

If you don't have a camera or the QR code isn't working, you can manually copy/paste the key data.

### On Source Device (Has Keys):

1. Go to Settings → QR Transfer
2. Click **"📤 Export Keys"** tab
3. You'll see encrypted key text
4. Click **"📋 Copy Text to Clipboard"**
5. Send to yourself via:
   - **Email** (send to your own email)
   - **iMessage** (send to yourself)
   - **AirDrop** (Mac/iPhone only)
   - **Note app** synced across devices

### On Destination Device (Needs Keys):

1. Go to Settings → QR Transfer
2. Click **"📥 Paste Keys"** tab
3. **Paste** the key text into the text box (Cmd+V or Ctrl+V)
4. Click **"📥 Import Keys"**
5. Success! Keys imported!

---

## ⏱️ How Long Does It Take?

- **QR Code Pairing**: 10-30 seconds total
- **Manual Copy/Paste**: 1-2 minutes

---

## 🔒 Security Features

### Encryption During Transfer
- Keys are **encrypted** before being sent
- Uses a temporary encryption key (changes every time)
- Even if someone intercepts the data, they can't decrypt it

### Time Limits
- **QR codes expire** after 15 minutes
- **Transfer codes expire** after 5 minutes
- Forces you to generate fresh codes for each transfer

### Code Verification
- 6-character code must match on both devices
- Prevents accidental pairing with wrong device
- Protects against QR code phishing

### One-Time Use
- Each transfer code can only be used **once**
- After successful transfer, the code is marked as "claimed"
- Can't reuse old QR codes

---

## ❓ Troubleshooting

### "QR Code Doesn't Scan"

**Solution 1**: Increase screen brightness
- Make sure your desktop/mobile screen is at **maximum brightness**
- Dark screens are harder for cameras to read

**Solution 2**: Adjust distance
- Hold camera **6-12 inches** from the screen
- Too close or too far won't work

**Solution 3**: Use manual transfer instead
- Switch to "📥 Paste Keys" tab
- Use copy/paste method (see Method 3 above)

### "Transfer Code Expired"

**Solution**: Generate a new code
- Click the "📱 Pair with Mobile" tab again
- A fresh QR code and transfer code will be generated
- You have 5 minutes to complete the transfer

### "No Apps Can Open This Link"

**Cause**: Your phone doesn't recognize the URL

**Solution**:
- Make sure you're using the **Camera app** (not a third-party QR scanner)
- iOS: Use the built-in Camera app
- Android: Use Google Camera or built-in Camera app
- If still doesn't work, use manual transfer method

### "Table Error" or "RLS Policy Error"

**Cause**: Database permissions issue

**Solution**: Contact admin to verify:
- `key_transfers` table exists
- RLS policies are configured correctly
- `encrypted_key_data` column allows NULL values

### Desktop Shows Wrong URL

**Cause**: Old version cached

**Solution**:
- Close and restart the desktop app
- Check the QR code URL should be: `campusconnect.raybedford.net`
- Not: `localhost` or `frontend-xxx.vercel.app`

### "Waiting for Mobile Device..." Forever

**Possible Causes**:
1. **Mobile transfer didn't complete**: Check if mobile shows success
2. **Network issue**: Check internet connection on both devices
3. **Transfer expired**: Generate new code and try again

**Solution**:
- Click the mode tab again to generate a new code
- Try manual transfer method instead

---

## 💡 Tips & Best Practices

### First Time Setup
1. Set up your **mobile device first** (easiest to carry around)
2. Then pair your **desktop** from mobile
3. Keep at least **2 devices** with keys (backup in case one is lost)

### For IT Admins
- Train users on QR code pairing during onboarding
- Have a printed guide available
- Emphasize the **5-minute time limit**
- Remind users to verify the 6-character code

### Security Best Practices
- **Never share** QR code screenshots
- **Don't leave** QR codes visible on screen when away
- **Only pair** devices you personally own and control
- **Verify** the 6-character code every time

### If You Lose Your Keys
- Keys cannot be recovered if lost on all devices
- **You will lose access to all encrypted messages**
- Future messages will work fine (new keys generated)
- Keep keys on at least 2 devices as backup

---

## 📱 Platform-Specific Notes

### iOS (iPhone/iPad)
- Use built-in **Camera app**
- QR codes detected automatically
- Notification appears at top of screen
- Works with installed PWA or Safari browser

### Android
- Use **Google Camera** or built-in camera
- Some phones show notification, others open directly
- Works with Chrome browser or installed PWA

### macOS Desktop (Mac Mini, MacBook, etc.)
- No camera needed - you're **showing** the QR code
- Edit menu enabled (Cmd+C, Cmd+V work)
- Native notifications supported

### Windows Desktop
- Shows QR code for mobile to scan
- Edit menu works (Ctrl+C, Ctrl+V)
- Native notifications supported

---

## 🎓 How It Works (Technical)

For those curious about what's happening behind the scenes:

1. **Desktop generates**:
   - Random 6-character transfer code
   - Stores it in database with expiration time
   - Creates QR code with URL: `campusconnect.raybedford.net/pair?code=ABC123`

2. **Mobile scans & uploads**:
   - Scans QR code, opens pairing page
   - Encrypts your keys with temporary encryption key
   - Uploads encrypted keys to database linked to transfer code

3. **Desktop polls & imports**:
   - Checks database every 5 seconds for uploaded keys
   - Downloads encrypted keys when available
   - Decrypts and imports into local storage
   - Marks transfer as "claimed"

4. **Cleanup**:
   - Transfer code expires after 5 minutes
   - Claimed transfers are marked as used
   - Database auto-deletes old transfers after 1 hour

---

## 📞 Need Help?

- **Check Console**: Settings → About → Enable Developer Mode
- **Contact Support**: Report issues via Settings → Help
- **GitHub Issues**: https://github.com/anthropics/campus-connect/issues

---

## ✅ Quick Reference

| Scenario | Method | Time |
|----------|--------|------|
| Mobile → Desktop | QR Pairing | 30 sec |
| Desktop → Mobile | QR Pairing | 30 sec |
| No Camera | Manual Copy/Paste | 2 min |
| Multiple Devices | Repeat Pairing | 30 sec each |

---

**Last Updated**: March 5, 2026
**Version**: 1.0
**Feature**: Smart TV-Style Device Pairing
