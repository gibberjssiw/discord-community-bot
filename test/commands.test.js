import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after } from "node:test";
import { PermissionsBitField } from "discord.js";

const dataDir = await mkdtemp(join(tmpdir(), "discord-bot-commands-"));
process.env.BOT_DATA_DIR = dataDir;
const { handleCommand } = await import("../commands.js");
after(() => rm(dataDir, { recursive: true, force: true }));

const staffPermissions = new PermissionsBitField([
  PermissionsBitField.Flags.ManageMessages,
  PermissionsBitField.Flags.EmbedLinks
]);

function mockMessage({ permissions = staffPermissions } = {}) {
  const replies = [];
  const channelMessages = [];
  const member = { id: "234567890123456789", displayName: "Moderator", permissions };
  const guild = {
    members: { me: { permissions } }
  };
  return {
    replies,
    channelMessages,
    guild,
    guildId: "123456789012345678",
    channelId: "345678901234567890",
    author: {
      id: member.id,
      username: "Moderator",
      bot: false,
      displayAvatarURL: () => "https://cdn.discordapp.com/embed/avatars/0.png"
    },
    member,
    mentions: {
      members: { first: () => null },
      users: { first: () => null }
    },
    channel: {
      send: async (payload) => {
        channelMessages.push(payload);
        return payload;
      }
    },
    reply: async (payload) => {
      replies.push(payload);
      return payload;
    }
  };
}

test("say posts a themed embed without allowing mention pings", async () => {
  const message = mockMessage();
  await handleCommand(message, "say", ["@everyone", "maintenance", "soon"]);
  assert.equal(message.channelMessages[0].embeds[0].data.description, "@everyone maintenance soon");
  assert.equal(message.channelMessages[0].embeds[0].data.title, "📣 Server announcement");
  assert.deepEqual(message.channelMessages[0].allowedMentions, { parse: [] });
});

test("embedsay parses a title and body into a formatted embed", async () => {
  const message = mockMessage();
  await handleCommand(message, "embedsay", ["Server", "|", "Maintenance", "at", "8"]);
  const embed = message.channelMessages[0].embeds[0].toJSON();
  assert.equal(embed.title, "Server");
  assert.equal(embed.description, "Maintenance at 8");
  assert.deepEqual(message.channelMessages[0].allowedMentions, { parse: [] });
});

test("say commands are blocked without Manage Messages", async () => {
  const message = mockMessage({ permissions: new PermissionsBitField([]) });
  await handleCommand(message, "embedsay", ["Server", "|", "Notice"]);
  assert.equal(message.channelMessages.length, 0);
  assert.match(message.replies[0].embeds[0].data.description, /permission to use that moderation command/);
});

test("court commands stay explicitly fictional", async () => {
  const message = mockMessage();
  await handleCommand(message, "sue", ["the", "missing", "cookie"]);
  assert.match(message.replies[0].embeds[0].data.description, /Mock case opened/);
  assert.match(message.replies[0].embeds[0].data.description, /not legal advice or a real legal notice/);
});

test("daily rewards persist through the user-facing economy commands", async () => {
  const message = mockMessage();
  await handleCommand(message, "daily", []);
  assert.match(message.replies[0].embeds[0].data.description, /Daily reward/);
  assert.match(message.replies[0].embeds[0].data.description, /🪙/);
  assert.equal(message.replies[0].embeds[0].data.title, "🎁 Daily");

  const secondClaim = mockMessage();
  await handleCommand(secondClaim, "daily", []);
  assert.match(secondClaim.replies[0].embeds[0].data.description, /already claimed/);

  const balance = mockMessage();
  await handleCommand(balance, "bal", []);
  assert.equal(balance.replies[0].embeds[0].data.title, "💰 Moderator's wallet");
});

test("utility commands show useful results in themed embeds", async () => {
  const progress = mockMessage();
  await handleCommand(progress, "progress", ["35", "80"]);
  assert.match(progress.replies[0].embeds[0].data.description, /43\.8%\*\* complete/);
  assert.match(progress.replies[0].embeds[0].data.title, /Progress/);

  const color = mockMessage();
  await handleCommand(color, "randomcolor", ["#4F46E5"]);
  assert.match(color.replies[0].embeds[0].data.description, /#4F46E5/);
  assert.equal(color.replies[0].embeds[0].data.color, 0x4f46e5);

  const snowflake = mockMessage();
  await handleCommand(snowflake, "snowflake", ["175928847299117063"]);
  assert.match(snowflake.replies[0].embeds[0].data.description, /Created <t:\d+:F>/);
});