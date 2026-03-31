/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from 'fs'
import { resolve } from 'path'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TelegramBot = require('node-telegram-bot-api')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cron = require('node-cron')

// Load .env.local manually (same pattern as seed.ts)
try {
  const envFile = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of envFile.split('\n')) {
    const [key, ...rest] = line.split('=')
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
  }
} catch {}

import { connectDB } from '../lib/db'
import { sendDebtsReport } from './reports/debts'
import { sendLowStockReport } from './reports/low-stock'
import { sendDailySalesReport } from './reports/daily-sales'
import { sendDbDump } from './reports/db-dump'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
if (!BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN is not defined')
  process.exit(1)
}

const isTest = process.argv.includes('--test')
const bot = new TelegramBot(BOT_TOKEN, { polling: !isTest })

const ALLOWED_CHAT_IDS = new Set(
  (process.env.TELEGRAM_CHAT_IDS || '').split(',').filter(Boolean)
)

function isAllowed(chatId: number): boolean {
  return ALLOWED_CHAT_IDS.has(String(chatId))
}

// Main menu keyboard
const mainMenu = {
  reply_markup: {
    keyboard: [
      [{ text: 'Sotuv hisoboti' }, { text: 'Qarzdorlar' }],
      [{ text: 'Kam qolgan' }, { text: 'DB dump' }],
      [{ text: 'To\'liq hisobot' }],
    ],
    resize_keyboard: true,
  },
}

// DB connection wrapper for command handlers
async function withDB(bot: any, chatId: number, fn: () => Promise<void>): Promise<void> {
  try {
    await connectDB()
    await fn()
  } catch (err: any) {
    console.error(`Error:`, err)
    await bot.sendMessage(chatId, 'Xatolik yuz berdi. Qayta urinib ko\'ring.')
  }
}

// /start command
bot.onText(/\/start/, async (msg: any) => {
  if (!isAllowed(msg.chat.id)) return
  await bot.sendMessage(
    msg.chat.id,
    'Salom! Quyidagi tugmalardan foydalaning:',
    mainMenu
  )
})

// /help command
bot.onText(/\/help/, async (msg: any) => {
  if (!isAllowed(msg.chat.id)) return
  const help = [
    '<b>Mavjud komandalar:</b>',
    '/start — Tugmalarni ko\'rsatish',
    '/sotuv — Bugungi sotuv hisoboti',
    '/qarz — Qarzdorlar ro\'yxati',
    '/kamqolgan — Kam qolgan mahsulotlar',
    '/dump — Mahsulotlar JSON + rasmlar',
    '/toliq — Barcha hisobotlar',
  ].join('\n')
  await bot.sendMessage(msg.chat.id, help, { parse_mode: 'HTML' })
})

// Commands
bot.onText(/\/sotuv/, async (msg: any) => {
  if (!isAllowed(msg.chat.id)) return
  await withDB(bot, msg.chat.id, () => sendDailySalesReport(bot, msg.chat.id))
})

bot.onText(/\/qarz/, async (msg: any) => {
  if (!isAllowed(msg.chat.id)) return
  await withDB(bot, msg.chat.id, () => sendDebtsReport(bot, msg.chat.id))
})

bot.onText(/\/kamqolgan/, async (msg: any) => {
  if (!isAllowed(msg.chat.id)) return
  await withDB(bot, msg.chat.id, () => sendLowStockReport(bot, msg.chat.id))
})

bot.onText(/\/dump/, async (msg: any) => {
  if (!isAllowed(msg.chat.id)) return
  await withDB(bot, msg.chat.id, () => sendDbDump(bot, msg.chat.id))
})

bot.onText(/\/toliq/, async (msg: any) => {
  if (!isAllowed(msg.chat.id)) return
  await withDB(bot, msg.chat.id, async () => {
    await sendDailySalesReport(bot, msg.chat.id)
    await sendDebtsReport(bot, msg.chat.id)
    await sendLowStockReport(bot, msg.chat.id)
    await sendDbDump(bot, msg.chat.id)
  })
})

// Button text handlers
bot.on('message', async (msg: any) => {
  if (!isAllowed(msg.chat.id) || !msg.text) return
  // Skip commands (handled by onText above)
  if (msg.text.startsWith('/')) return

  const chatId = msg.chat.id

  switch (msg.text) {
    case 'Sotuv hisoboti':
      await withDB(bot, chatId, () => sendDailySalesReport(bot, chatId))
      break
    case 'Qarzdorlar':
      await withDB(bot, chatId, () => sendDebtsReport(bot, chatId))
      break
    case 'Kam qolgan':
      await withDB(bot, chatId, () => sendLowStockReport(bot, chatId))
      break
    case 'DB dump':
      await withDB(bot, chatId, () => sendDbDump(bot, chatId))
      break
    case 'To\'liq hisobot':
      await withDB(bot, chatId, async () => {
        await sendDailySalesReport(bot, chatId)
        await sendDebtsReport(bot, chatId)
        await sendLowStockReport(bot, chatId)
        await sendDbDump(bot, chatId)
      })
      break
  }
})

// Cron: scheduled reports to all chats
async function runAllReports(): Promise<void> {
  console.log(`[${new Date().toISOString()}] Running scheduled reports...`)
  try {
    await connectDB()
  } catch (err) {
    console.error('Failed to connect to DB:', err)
    return
  }

  const reports = [
    { name: 'Debts', fn: sendDebtsReport },
    { name: 'Low Stock', fn: sendLowStockReport },
    { name: 'Daily Sales', fn: sendDailySalesReport },
    { name: 'DB Dump', fn: sendDbDump },
  ]

  for (const report of reports) {
    try {
      await report.fn(bot)
      console.log(`  ✓ ${report.name}`)
    } catch (err) {
      console.error(`  ✗ ${report.name}:`, err)
    }
  }
  console.log('Reports done.')
}

// Cron: every day at 22:00 Tashkent time
cron.schedule('0 22 * * *', runAllReports, { timezone: 'Asia/Tashkent' })

console.log('Bot started. Cron scheduled for 22:00 Asia/Tashkent.')
if (!isTest) console.log('Polling enabled — waiting for commands...')

// --test flag: run immediately and exit
if (isTest) {
  runAllReports().then(() => {
    setTimeout(() => process.exit(0), 5000)
  })
}
