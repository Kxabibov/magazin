# Setup Instructions: dukon Laziz Telegram Bot & Google Sheets Ledger

This guide provides instructions to connect the **dukon Laziz** React application and Node.js Express server to a Google Sheets database and launch the Telegram bot.

---

## 📅 Step 1: Create & Configure the Google Sheets Database

We use **Google Apps Script** to turn any Google Sheet into a secure, serverless database API.

1. Create a new sheet at [Google Sheets](https://sheets.google.com).
2. Name the spreadsheet (e.g., `dukon Laziz Database`).
3. In the top menu, click **Extensions** ➔ **Apps Script**.
4. Clear any default code in the editor.
5. Open the local file `google-apps-script.js` in your workspace, copy its entire contents, and paste them into the Apps Script editor.
6. Click the **Save** icon (disk icon).

> [!IMPORTANT]
> The script includes an `initializeSheet()` helper that automatically creates the required tables (`AllowedUsers`, `Products`, `Purchases`, `Payments`) and pre-fills mock products. You do not need to construct tables manually.

---

## 🚀 Step 2: Deploy the Google Apps Script Web App

To make the script accessible to your Node.js backend, you must deploy it as a public Web App:

1. In the top-right of the Apps Script page, click **Deploy** ➔ **New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Fill out the configuration:
   - **Description**: `dukon Laziz Database API`
   - **Execute as**: `Me (your-email@gmail.com)`
   - **Who has access**: `Anyone`
4. Click **Deploy**.
5. When prompted, click **Authorize access**, log in with your Google account, click **Advanced**, and then click **Go to Untitled project (unsafe)** to grant permissions.
6. Once the deployment completes, copy the **Web app URL** (it ends with `/exec`).

---

## 🤖 Step 3: Create the Telegram Bot

1. Open Telegram and search for [@BotFather](https://t.me/BotFather).
2. Type `/newbot` and follow the instructions to name your bot and choose a username (e.g. `dukon_laziz_bot`).
3. Copy the **HTTP API Token** provided by BotFather (e.g., `1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ`).
4. In BotFather, type `/setmenubutton` to configure a web app shortcut:
   - Select your bot.
   - Enter your public HTTPS URL (e.g. your ngrok tunnel URL or production URL).
   - Enter a title for the menu button (e.g., `🛍️ dukon Laziz`).

---

## ⚙️ Step 4: Configure Local Environment Variables

Create and edit the `.env` file in the root of the `dukon Laziz` directory:

1. Open the `.env` file.
2. Fill in the values:
   ```env
   PORT=5000
   TELEGRAM_BOT_TOKEN="your_token_from_botfather"
   GOOGLE_SCRIPT_URL="your_deployed_apps_script_url"
   WEB_APP_URL="your_public_https_url_pointing_to_server"
   ```

---

## 💻 Step 5: Testing Locally using a Tunnel (ngrok)

### What is ngrok and why do we need it?
By default, your app runs on `localhost:5000`, which is only accessible inside your own computer. Because Telegram's servers run on the public internet, they cannot talk to `localhost` directly. 

**ngrok** is a free program that acts as a secure "tunnel" or "bridge". It takes your private local port (`5000`) and generates a public, secure internet address (like `https://abc-123.ngrok-free.app`) pointing directly to your local computer.

### How to use ngrok locally:
1. Download the free tool from [ngrok.com](https://ngrok.com) and install it.
2. Open a separate terminal window and run:
   ```bash
   ngrok http 5000
   ```
3. Copy the secure forwarding URL starting with `https://` (e.g. `https://abc-123.ngrok-free.app`).
4. Set this URL as your `WEB_APP_URL` in `.env` and register it in BotFather for the menu button.

> [!NOTE]
> **Limitations of Local Running:**
> Running the app locally requires you to keep both the server terminal (`npm run dev`) and the `ngrok` terminal open at all times. If you shut down your computer or close the terminal, your Telegram bot will stop working. This is only meant for testing and development.

---

## 🌐 Step 6: Running the Bot 24/7 (Production Hosting)

If you want the bot to work all the time without keeping your computer on and without using `ngrok`, you should host the backend on a free cloud hosting provider. 

We recommend **Render.com** (it has a free tier that is perfect for this):

### How to deploy to Render:
1. **Push your code to GitHub**: (Done! Your project is already hosted at your GitHub repository).
2. **Create a Render Account**: Go to [Render.com](https://render.com) and sign up (connect your GitHub account).
3. **Create a new Web Service**:
   - In Render dashboard, click **New +** ➔ **Web Service**.
   - Select your repository.
4. **Configure Settings**:
   - **Language**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
   - **Instance Type**: `Free`
5. **Add Environment Variables**:
   Click on the **Environment** tab in Render and add the variables from your `.env` file:
   - `TELEGRAM_BOT_TOKEN`: `(your token from BotFather)`
   - `GOOGLE_SCRIPT_URL`: `(your web app URL from Google Sheets)`
   - `WEB_APP_URL`: `(Render will automatically generate a secure HTTPS url for you once deployed, e.g., https://magazin.onrender.com. Set this as your WEB_APP_URL value)`
6. **Deploy**: Click **Create Web Service**. 
7. **Configure BotFather**: Update the bot's Menu Button URL in BotFather to use your new Render URL (`https://magazin.onrender.com`).

Now your bot and ledger app will run in the cloud 24/7, completely independent of your local computer!
