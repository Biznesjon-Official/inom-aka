/* eslint-disable @typescript-eslint/no-explicit-any */

// Lazy evaluation — env may not be loaded at import time (hoisting)
function getChatIds(): string[] {
  return (process.env.TELEGRAM_CHAT_IDS || '').split(',').filter(Boolean)
}

// Send to a specific chat
export async function sendTo(bot: any, chatId: string | number, text: string): Promise<void> {
  const chunks = splitMessage(text)
  for (const chunk of chunks) {
    try {
      await bot.sendMessage(chatId, chunk, { parse_mode: 'HTML' })
    } catch (err) {
      console.error(`Failed to send to ${chatId}:`, err)
      await delay(3000)
      try {
        await bot.sendMessage(chatId, chunk, { parse_mode: 'HTML' })
      } catch (retryErr) {
        console.error(`Retry failed for ${chatId}:`, retryErr)
      }
    }
  }
}

export async function sendDocumentTo(
  bot: any,
  chatId: string | number,
  buffer: Buffer,
  filename: string,
  caption?: string
): Promise<void> {
  try {
    const contentType = filename.endsWith('.zip') ? 'application/zip' : 'application/json'
    await bot.sendDocument(chatId, buffer, { caption }, { filename, contentType })
  } catch (err) {
    console.error(`Failed to send document to ${chatId}:`, err)
  }
}

// Send to all configured chats
export async function sendToAll(bot: any, text: string): Promise<void> {
  for (const chatId of getChatIds()) {
    await sendTo(bot, chatId, text)
  }
}

export async function sendDocumentToAll(
  bot: any,
  buffer: Buffer,
  filename: string,
  caption?: string
): Promise<void> {
  for (const chatId of getChatIds()) {
    await sendDocumentTo(bot, chatId, buffer, filename, caption)
  }
}

export function splitMessage(text: string, limit = 4096): string[] {
  if (text.length <= limit) return [text]
  const chunks: string[] = []
  let remaining = text
  while (remaining.length > 0) {
    if (remaining.length <= limit) {
      chunks.push(remaining)
      break
    }
    // Find last newline before limit
    let splitAt = remaining.lastIndexOf('\n', limit)
    if (splitAt <= 0) splitAt = limit
    chunks.push(remaining.slice(0, splitAt))
    remaining = remaining.slice(splitAt)
  }
  return chunks
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
