import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createEconomyStore } from "../economy.js";

const guildId = "123456789012345678";
const userId = "234567890123456789";

async function withStore(run) {
  const directory = await mkdtemp(join(tmpdir(), "discord-bot-economy-"));
  try {
    const filePath = join(directory, "economy.json");
    await run(createEconomyStore(filePath), filePath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("wallets, rewards, and cooldowns persist across store restarts", async () => {
  await withStore(async (store, filePath) => {
    assert.equal((await store.getWallet(guildId, userId)).coins, 100);
    const daily = await store.claim(guildId, userId, "daily", 125, 1_000_000);
    assert.deepEqual(daily, { claimed: true, amount: 125, coins: 225 });

    const restarted = createEconomyStore(filePath);
    assert.equal((await restarted.getWallet(guildId, userId)).coins, 225);
    const cooldown = await restarted.claim(guildId, userId, "daily", 125, 1_000_000 + 1_000);
    assert.equal(cooldown.claimed, false);
    assert.ok(cooldown.remainingMs > 0);
  });
});

test("simultaneous reward claims cannot double-credit a wallet", async () => {
  await withStore(async (store) => {
    const [first, second] = await Promise.all([
      store.claim(guildId, userId, "work", 40, 2_000_000),
      store.claim(guildId, userId, "work", 40, 2_000_000)
    ]);
    assert.equal([first, second].filter((result) => result.claimed).length, 1);
    assert.equal((await store.getWallet(guildId, userId)).coins, 140);
  });
});

test("transfers and slot payouts update balances atomically", async () => {
  await withStore(async (store) => {
    await store.getWallet(guildId, userId);
    const recipient = "345678901234567890";
    await store.getWallet(guildId, recipient);
    assert.deepEqual(await store.transfer(guildId, userId, recipient, 25), {
      transferred: true,
      senderCoins: 75,
      recipientCoins: 125
    });
    const slot = await store.playSlots(guildId, userId, 10, ["🍒", "🍒", "🍒"]);
    assert.equal(slot.payout, 50);
    assert.equal(slot.balance, 115);
  });
});