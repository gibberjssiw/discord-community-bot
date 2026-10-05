import {
  ActivityType,
  Client,
  Events,
  GatewayIntentBits,
  PermissionsBitField
} from "discord.js";
import { commandCatalog } from "./catalog.js";
import { handleCommand } from "./commands.js";
import { createHelpPayload } from "./help.js";
import { handleTicketInteraction } from "./tickets.js";
import { createCommandEmbed } from "./command-embeds.js";

const token = process.env.DISCORD_BOT_TOKEN;
const prefix = process.env.BOT_PREFIX || "$";
if (!token) {
  throw new Error("DISCORD_BOT_TOKEN is missing. Add the bot token in Replit Secrets.");
}
if (prefix.length > 3 || /\s/.test(prefix)) {
  throw new Error("BOT_PREFIX must be one to three non-space characters.");
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});
const recentCommands = new Map();

client.once(Events.ClientReady, (readyClient) => {
  readyClient.user.setActivity(`${prefix}help • 🎮 games • 🪙 coins`, { type: ActivityType.Watching });
  const invitePermissions = [
    PermissionsBitField.Flags.ViewChannel,
    PermissionsBitField.Flags.SendMessages,
    PermissionsBitField.Flags.EmbedLinks,
    PermissionsBitField.Flags.ReadMessageHistory,
    PermissionsBitField.Flags.AddReactions,
    PermissionsBitField.Flags.ManageMessages,
    PermissionsBitField.Flags.KickMembers,
    PermissionsBitField.Flags.BanMembers,
    PermissionsBitField.Flags.ManageChannels,
    PermissionsBitField.Flags.ManageRoles,
    PermissionsBitField.Flags.ModerateMembers,
    PermissionsBitField.Flags.ManageNicknames
  ].reduce((bits, permission) => bits | permission, 0n);
  const invite = `https://discord.com/oauth2/authorize?client_id=${readyClient.user.id}&scope=bot%20applications.commands&permissions=${invitePermissions}`;
  console.info(`Discord bot connected as ${readyClient.user.tag}.`);
  console.info(`Bot user ID: ${readyClient.user.id}`);
  console.info(`Invite link (choose the permissions your server needs): ${invite}`);
  console.info(`Loaded ${commandCatalog.length} commands across the help categories.`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.content.startsWith(prefix)) return;
  const parts = message.content.slice(prefix.length).trim().split(/\s+/).filter(Boolean);
  const name = (parts.shift() ?? "").toLowerCase();
  if (!name) {
    await message.reply({ ...createHelpPayload(), allowedMentions: { parse: [] } }).catch((error) => {
      console.warn(`Could not send the help menu: ${error.message}`);
    });
    return;
  }

  const key = `${message.guildId ?? "dm"}:${message.author.id}`;
  const now = Date.now();
  const history = (recentCommands.get(key) ?? []).filter((time) => now - time < 3_000);
  if (history.length >= 6) return;
  history.push(now);
  recentCommands.set(key, history);

  if (name === "help") {
    await message.reply({ ...createHelpPayload(), allowedMentions: { parse: [] } }).catch((error) => {
      console.warn(`Could not send the help menu: ${error.message}`);
    });
    return;
  }
  await handleCommand(message, name, parts).catch((error) => {
    console.error(`Command $${name} failed: ${error instanceof Error ? error.message : "unknown error"}`);
  });
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isStringSelectMenu() && interaction.customId === "help:category") {
      return interaction.update(createHelpPayload(interaction.values[0], 0));
    }
    if (interaction.isButton() && interaction.customId.startsWith("help:")) {
      const [, direction, category, pageText] = interaction.customId.split(":");
      const page = Number(pageText) + (direction === "next" ? 1 : -1);
      return interaction.update(createHelpPayload(category, page));
    }
    if (interaction.customId?.startsWith("ticket:")) {
      return await handleTicketInteraction(interaction);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "That interaction couldn't be completed.";
    console.error(`Discord interaction failed: ${message}`);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({
        embeds: [createCommandEmbed("help", message, interaction)],
        allowedMentions: { parse: [] },
        ephemeral: true
      }).catch(() => undefined);
    }
  }
});

client.on(Events.ShardDisconnect, (event) => {
  if (event.code === 4014) {
    console.error("Discord rejected a privileged gateway intent. Enable Message Content Intent in the Discord Developer Portal.");
  } else {
    console.warn(`Discord gateway disconnected (code ${event.code}); the client will attempt to reconnect.`);
  }
});

client.on(Events.Error, (error) => {
  console.error(`Discord client error: ${error.message}`);
});

process.once("SIGINT", () => {
  client.destroy();
  process.exit(0);
});
process.once("SIGTERM", () => {
  client.destroy();
  process.exit(0);
});

client.login(token).catch((error) => {
  console.error(`Discord login failed: ${error.message}`);
  process.exitCode = 1;
});