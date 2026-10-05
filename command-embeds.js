import { EmbedBuilder } from "discord.js";
import { commandByName } from "./catalog.js";

export const CATEGORY_STYLES = Object.freeze({
  "Getting Started": { emoji: "✨", color: 0x6c83f2 },
  Utility: { emoji: "🧰", color: 0x42a5f5 },
  "Server Info": { emoji: "ℹ️", color: 0x7e57c2 },
  Moderation: { emoji: "🛡️", color: 0xef5350 },
  Games: { emoji: "🎮", color: 0xffb300 },
  Fun: { emoji: "🎉", color: 0xec407a },
  Community: { emoji: "💬", color: 0x26a69a },
  Economy: { emoji: "🪙", color: 0xf1c40f },
  Tickets: { emoji: "🎟️", color: 0x5c6bc0 }
});

const COMMAND_EMOJI = {
  ping: "🏓",
  about: "🤖",
  uptime: "⏱️",
  invite: "🔗",
  serverinfo: "🏠",
  profile: "👤",
  avatar: "🖼️",
  calc: "🧮",
  roll: "🎲",
  coinflip: "🪙",
  progress: "📊",
  randomcolor: "🎨",
  snowflake: "❄️",
  serveremojis: "😀",
  timeout: "⏳",
  kick: "👢",
  ban: "🔨",
  purge: "🧹",
  poll: "📊",
  daily: "🎁",
  work: "🛠️",
  balance: "💰",
  shop: "🛍️",
  slots: "🎰",
  ticket: "🎟️",
  ticketpanel: "🆘",
  sue: "⚖️",
  magic8ball: "🔮"
};

const COMMAND_LABELS = {
  calc: "Calculator",
  randomcolor: "Random Color",
  serveremojis: "Server Emojis",
  magic8ball: "Magic 8-Ball"
};

function humanize(name) {
  return COMMAND_LABELS[name]
    ?? name.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^\w/, (letter) => letter.toUpperCase());
}

export function createCommandEmbed(name, description, context = {}, options = {}) {
  const commandName = String(name || "command").toLowerCase();
  const category = commandByName.get(commandName)?.category ?? "Getting Started";
  const style = CATEGORY_STYLES[category] ?? CATEGORY_STYLES["Getting Started"];
  const actor = context.author ?? context.user;
  const iconURL = actor?.displayAvatarURL?.({ size: 64 });
  const prefix = process.env.BOT_PREFIX || "$";
  const embed = new EmbedBuilder()
    .setColor(options.color ?? style.color)
    .setTitle(`${COMMAND_EMOJI[commandName] ?? style.emoji} ${humanize(commandName)}`.slice(0, 256))
    .setDescription(String(description || "\u200b").slice(0, 4096))
    .setFooter({ text: `${category}  •  ${prefix}${commandName}` })
    .setTimestamp();

  if (actor) {
    embed.setAuthor({
      name: `Requested by ${actor.displayName ?? actor.username ?? actor.tag ?? "member"}`,
      ...(iconURL ? { iconURL } : {})
    });
  }
  if (options.image) embed.setImage(options.image);
  return embed;
}
