import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 5000;
  const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL || '';
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
  const WEB_APP_URL = process.env.WEB_APP_URL || ''; // URL where Vite app is hosted (e.g. ngrok or production domain)

  // Middlewares
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Initialize Telegram Bot
  let bot: TelegramBot | null = null;

  if (BOT_TOKEN) {
    try {
      bot = new TelegramBot(BOT_TOKEN, { polling: true });
      console.log('Telegram Bot successfully initialized with polling.');
      
      bot.on('polling_error', (error) => {
        console.error('Telegram Bot Polling Error:', error.message || error);
      });

      bot.on('error', (error) => {
        console.error('Telegram Bot General Error:', error.message || error);
      });
      
      // Command /start
      bot.onText(/\/start/, async (msg) => {
        const chatId = msg.chat.id;
        
        const welcomeText = 
          `👋 Assalomu alaykum! dukon Laziz tizimiga xush kelibsiz.\n\n` +
          `🔒 Tizimdan foydalanish uchun telefon raqamingizni yuborish orqali avtorizatsiyadan o'ting.\n\n` +
          `👋 Welcome to dukon Laziz!\n` +
          `🔒 To use the bot, please verify your identity by sharing your contact.`;
        
        await bot?.sendMessage(chatId, welcomeText, {
          reply_markup: {
            keyboard: [
              [{ text: '📱 Telefon raqamni yuborish / Send Phone Number', request_contact: true }]
            ],
            resize_keyboard: true,
            one_time_keyboard: true
          }
        });
      });

      // Handle shared contact
      bot.on('contact', async (msg) => {
        const chatId = msg.chat.id;
        const contact = msg.contact;
        
        if (!contact) return;
        
        let phone = contact.phone_number;
        // Ensure phone starts with +
        if (!phone.startsWith('+')) {
          phone = '+' + phone;
        }
        
        console.log(`Verifying contact: ${phone} for chat ID ${chatId}`);
        
        if (!GOOGLE_SCRIPT_URL) {
          await bot?.sendMessage(chatId, '⚠️ Tizim sozlamalarida xatolik mavjud (Google Script URL aniqlanmagan). Iltimos, administratorga murojaat qiling.\n\n⚠️ System configuration error (Google Script URL is missing). Please contact admin.');
          return;
        }
        
        try {
          // Request Google Sheets Apps Script to check if the phone is authorized
          const checkUrl = `${GOOGLE_SCRIPT_URL}?action=checkPhone&phone=${encodeURIComponent(phone)}`;
          const response = await fetch(checkUrl);
          const authData: any = await response.json();
          
          if (authData.allowed) {
            // Construct Mini App Link with query parameters
            // If WEB_APP_URL is empty, we fall back to a placeholder or direct user to standard warning
            const appLink = WEB_APP_URL 
              ? `${WEB_APP_URL}?phone=${encodeURIComponent(phone)}&name=${encodeURIComponent(authData.name)}`
              : '';
            
            let responseMsg = `✅ Muvaffaqiyatli avtorizatsiya qilindi!\n\nFoydalanuvchi: *${authData.name}*\nTelefon: *${phone}*\n\nDasturni ochish uchun quyidagi tugmani bosing:`;
            
            const replyMarkupInline = appLink ? {
              inline_keyboard: [
                [{ text: '🛍&nbsp;dukon Laziz App', web_app: { url: appLink } }]
              ]
            } : {
              inline_keyboard: [
                [{ text: '⚠️ Web App URL Not Configured', callback_data: 'no_url' }]
              ]
            };

            if (!WEB_APP_URL) {
              responseMsg += '\n\n*(Eslatma: Administrator hali Web App URL manzilini bot sozlamalariga kiritmagan)*';
            }
            
            await bot?.sendMessage(chatId, responseMsg, {
              parse_mode: 'Markdown',
              reply_markup: replyMarkupInline
            });
          } else {
            await bot?.sendMessage(
              chatId, 
              `❌ Kechirasiz, sizning telefon raqamingiz (*${phone}*) tizimga kiritilmagan.\n` +
              `Iltimos, kirish huquqini olish uchun administratorga murojaat qiling.\n\n` +
              `❌ Sorry, your phone number (*${phone}*) is not authorized.\n` +
              `Please request access from the owner.`,
              { parse_mode: 'Markdown' }
            );
          }
        } catch (err) {
          console.error('Error verifying phone with Google Sheets:', err);
          await bot?.sendMessage(chatId, '❌ Xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring.\n\n❌ Connection error occurred. Please try again.');
        }
      });

    } catch (error) {
      console.error('Failed to initialize Telegram Bot:', error);
    }
  } else {
    console.warn('TELEGRAM_BOT_TOKEN is not set. Running server without Telegram Bot capabilities.');
  }

  // API PROXY ENDPOINTS (Vite Web App -> Node Express -> Google Sheets Apps Script)

  // 1. Check user authorization
  app.get('/api/check-auth', async (req, res) => {
    const { phone } = req.query;
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number parameter is required' });
    }
    
    try {
      const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=checkPhone&phone=${encodeURIComponent(phone as string)}`);
      const data = await response.json();
      return res.json(data);
    } catch (error: any) {
      console.error('Error in /api/check-auth:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // 2. Get Products list
  app.get('/api/products', async (req, res) => {
    try {
      const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getProducts`);
      const data = await response.json();
      return res.json(data);
    } catch (error: any) {
      console.error('Error in /api/products:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // 3. Get Purchase History for a specific product and user
  app.get('/api/history', async (req, res) => {
    const { productId, phone } = req.query;
    
    let url = `${GOOGLE_SCRIPT_URL}?action=getHistory`;
    if (productId) url += `&productId=${encodeURIComponent(productId as string)}`;
    if (phone) url += `&phone=${encodeURIComponent(phone as string)}`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      return res.json(data);
    } catch (error: any) {
      console.error('Error in /api/history:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // 4. Get Debts list
  app.get('/api/debts', async (req, res) => {
    const { productId, phone } = req.query;
    
    let url = `${GOOGLE_SCRIPT_URL}?action=getDebts`;
    if (productId) url += `&productId=${encodeURIComponent(productId as string)}`;
    if (phone) url += `&phone=${encodeURIComponent(phone as string)}`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      return res.json(data);
    } catch (error: any) {
      console.error('Error in /api/debts:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // 5. Record a new purchase
  app.post('/api/buy', async (req, res) => {
    try {
      const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'recordPurchase',
          data: req.body
        })
      });
      const data = await response.json();
      return res.json(data);
    } catch (error: any) {
      console.error('Error in /api/buy:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // 6. Pay off a debt
  app.post('/api/pay-debt', async (req, res) => {
    try {
      const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'payDebt',
          data: req.body
        })
      });
      const data = await response.json();
      return res.json(data);
    } catch (error: any) {
      console.error('Error in /api/pay-debt:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // 7. Add an authorized phone number
  app.post('/api/add-user', async (req, res) => {
    try {
      const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addAllowedPhone',
          data: req.body
        })
      });
      const data = await response.json();
      return res.json(data);
    } catch (error: any) {
      console.error('Error in /api/add-user:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // Vite or static files serving based on NODE_ENV
  if (process.env.NODE_ENV !== 'production') {
    console.log('Integrating Vite dev middleware...');
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    console.log('Serving production static files from dist...');
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Start Server
  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`✅ dukon Laziz Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
});
