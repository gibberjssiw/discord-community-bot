import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export const currencyItems = Object.freeze([
  Object.freeze({ id: "coffee", emoji: "☕", name: "Coffee", price: 50 }),
  Object.freeze({ id: "sparkle", emoji: "✨", name: "Pocket sparkle", price: 150 }),
  Object.freeze({ id: "ticket", emoji: "🎟️", name: "Golden ticket", price: 300 }),
  Object.freeze({ id: "crown", emoji: "👑", name: "Tiny crown", price: 500 }),
  Object.freeze({ id: "rocket", emoji: "🚀", name: "Rocket pin", price: 1_000 })
]);

const DATA_VERSION = 1;
const STARTING_COINS = 100;
const COOLDOWNS = Object.freeze({ daily: 24 * 60 * 60_000, work: 60 * 60_000 });

function emptyState() {
  return { version: DATA_VERSION, wallets: {} };
}

function validateState(state) {
  if (!state || state.version !== DATA_VERSION || !state.wallets || typeof state.wallets !== "object" || Array.isArray(state.wallets)) {
    throw new Error("Currency data has an unsupported format. Fix or remove the bot data file before restarting.");
  }
  for (const [key, wallet] of Object.entries(state.wallets)) {
    if (!/^\d{15,21}:\d{15,21}$/.test(key)
      || !wallet || typeof wallet !== "object" || Array.isArray(wallet)
      || !Number.isSafeInteger(wallet.coins) || wallet.coins < 0
      || !Number.isSafeInteger(wallet.dailyAt) || wallet.dailyAt < 0
      || !Number.isSafeInteger(wallet.workAt) || wallet.workAt < 0
      || !wallet.inventory || typeof wallet.inventory !== "object" || Array.isArray(wallet.inventory)) {
      throw new Error("Currency data contains an invalid wallet. Fix or remove the bot data file before restarting.");
    }
    for (const [itemId, quantity] of Object.entries(wallet.inventory)) {
      if (!currencyItems.some((item) => item.id === itemId) || !Number.isSafeInteger(quantity) || quantity < 1) {
        throw new Error("Currency data contains an invalid inventory. Fix or remove the bot data file before restarting.");
      }
    }
  }
}

export function createEconomyStore(filePath = resolve(process.env.BOT_DATA_DIR || ".data", "economy.json")) {
  let state;
  let queue = Promise.resolve();

  async function load() {
    try {
      state = JSON.parse(await readFile(filePath, "utf8"));
    } catch (error) {
      if (error?.code === "ENOENT") {
        state = emptyState();
        return;
      }
      if (error instanceof SyntaxError) {
        throw new Error("Currency data is not valid JSON. Fix or remove the bot data file before restarting.");
      }
      throw error;
    }
    validateState(state);
  }

  function serialized(operation) {
    const result = queue.then(async () => {
      if (!state) await load();
      return operation();
    });
    queue = result.then(() => undefined, () => undefined);
    return result;
  }

  async function persist(nextState) {
    await mkdir(dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, `${JSON.stringify(nextState, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
      await rename(temporaryPath, filePath);
    } catch (error) {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  async function update(operation) {
    return serialized(async () => {
      const draft = structuredClone(state);
      const { result, changed = true } = operation(draft);
      if (changed) {
        await persist(draft);
        state = draft;
      }
      return result;
    });
  }

  function ensureWallet(draft, guildId, userId) {
    if (!/^\d{15,21}$/.test(String(guildId)) || !/^\d{15,21}$/.test(String(userId))) {
      throw new Error("Currency commands need valid server and member IDs.");
    }
    const key = `${guildId}:${userId}`;
    if (!Object.hasOwn(draft.wallets, key)) {
      draft.wallets[key] = { coins: STARTING_COINS, dailyAt: 0, workAt: 0, inventory: {} };
      return { key, wallet: draft.wallets[key], created: true };
    }
    return { key, wallet: draft.wallets[key], created: false };
  }

  return Object.freeze({
    async getWallet(guildId, userId) {
      return update((draft) => {
        const { wallet, created } = ensureWallet(draft, guildId, userId);
        return { result: structuredClone(wallet), changed: created };
      });
    },

    async claim(guildId, userId, type, amount, now = Date.now()) {
      const cooldown = COOLDOWNS[type];
      if (!cooldown || !Number.isSafeInteger(amount) || amount < 1 || !Number.isSafeInteger(now) || now < 0) {
        throw new Error("Invalid currency reward request.");
      }
      return update((draft) => {
        const { wallet, created } = ensureWallet(draft, guildId, userId);
        const timestampKey = `${type}At`;
        const remainingMs = wallet[timestampKey] ? Math.max(0, wallet[timestampKey] + cooldown - now) : 0;
        if (remainingMs > 0) {
          return { result: { claimed: false, remainingMs, coins: wallet.coins }, changed: created };
        }
        wallet.coins += amount;
        wallet[timestampKey] = now;
        return { result: { claimed: true, amount, coins: wallet.coins }, changed: true };
      });
    },

    async transfer(guildId, fromId, toId, amount) {
      if (fromId === toId) throw new Error("You can't send coins to yourself.");
      if (!Number.isSafeInteger(amount) || amount < 1) throw new Error("Send a whole-number amount of at least one coin.");
      return update((draft) => {
        const { wallet: sender, created: senderCreated } = ensureWallet(draft, guildId, fromId);
        const { wallet: recipient, created: recipientCreated } = ensureWallet(draft, guildId, toId);
        if (sender.coins < amount) {
          return {
            result: { transferred: false, balance: sender.coins },
            changed: senderCreated || recipientCreated
          };
        }
        sender.coins -= amount;
        recipient.coins += amount;
        return { result: { transferred: true, senderCoins: sender.coins, recipientCoins: recipient.coins } };
      });
    },

    async leaderboard(guildId, limit = 10) {
      return serialized(() => {
        const prefix = `${guildId}:`;
        return Object.entries(state.wallets)
          .filter(([key]) => key.startsWith(prefix))
          .map(([key, wallet]) => ({ userId: key.slice(prefix.length), coins: wallet.coins }))
          .sort((a, b) => b.coins - a.coins || a.userId.localeCompare(b.userId))
          .slice(0, limit);
      });
    },

    async buy(guildId, userId, itemId) {
      const item = currencyItems.find((candidate) => candidate.id === itemId);
      if (!item) throw new Error("That item isn't in the shop. Use `$shop` to browse.");
      return update((draft) => {
        const { wallet, created } = ensureWallet(draft, guildId, userId);
        if (wallet.coins < item.price) {
          return { result: { bought: false, balance: wallet.coins, price: item.price }, changed: created };
        }
        wallet.coins -= item.price;
        wallet.inventory[item.id] = (wallet.inventory[item.id] ?? 0) + 1;
        return { result: { bought: true, balance: wallet.coins, item, quantity: wallet.inventory[item.id] } };
      });
    },

    async playSlots(guildId, userId, bet, symbols) {
      if (!Number.isSafeInteger(bet) || bet < 1 || bet > 500 || !Array.isArray(symbols) || symbols.length !== 3) {
        throw new Error("Bet between 1 and 500 coins on three slot symbols.");
      }
      return update((draft) => {
        const { wallet, created } = ensureWallet(draft, guildId, userId);
        if (wallet.coins < bet) {
          return { result: { played: false, balance: wallet.coins, bet }, changed: created };
        }
        const distinctSymbols = new Set(symbols).size;
        const multiplier = distinctSymbols === 1 ? 5 : distinctSymbols === 2 ? 2 : 0;
        const payout = bet * multiplier;
        wallet.coins = wallet.coins - bet + payout;
        return { result: { played: true, balance: wallet.coins, bet, payout, multiplier, symbols } };
      });
    }
  });
}

export const economy = createEconomyStore();