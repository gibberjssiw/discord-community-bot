import {
  EmbedBuilder,
  PermissionsBitField
} from "discord.js";
import { commandByName } from "./catalog.js";
import { currencyItems, economy } from "./economy.js";
import { evaluateArithmetic, parseDuration } from "./math.js";
import { handleTicketCommand } from "./tickets.js";
import { createCommandEmbed } from "./command-embeds.js";

const guessRounds = new Map();
const highLowRounds = new Map();
const reminders = new Set();
const activeCommands = new WeakMap();
const HELP = "Use `$help` to browse commands by category.";
const noMentions = { parse: [] };

const morseMap = {
  a: ".-", b: "-...", c: "-.-.", d: "-..", e: ".", f: "..-.",
  g: "--.", h: "....", i: "..", j: ".---", k: "-.-", l: ".-..",
  m: "--", n: "-.", o: "---", p: ".--.", q: "--.-", r: ".-.",
  s: "...", t: "-", u: "..-", v: "...-", w: ".--", x: "-..-",
  y: "-.--", z: "--..", "0": "-----", "1": ".----", "2": "..---",
  "3": "...--", "4": "....-", "5": ".....", "6": "-....",
  "7": "--...", "8": "---..", "9": "----.", ".": ".-.-.-",
  ",": "--..--", "?": "..--..", "!": "-.-.--", " ": "/"
};
const reverseMorseMap = Object.fromEntries(Object.entries(morseMap).map(([letter, code]) => [code, letter]));

const trivia = [
  ["Which planet is known as the Red Planet?", "Mars"],
  ["What is the largest ocean on Earth?", "The Pacific Ocean"],
  ["How many sides does a hexagon have?", "Six"],
  ["Which gas do plants absorb from the atmosphere?", "Carbon dioxide"],
  ["What is the capital of Japan?", "Tokyo"],
  ["What is the chemical symbol for gold?", "Au"],
  ["Which mammal lays eggs?", "The platypus"],
  ["How many minutes are in two hours?", "120"],
  ["What is the closest star to Earth?", "The Sun"],
  ["What is the largest planet in our solar system?", "Jupiter"]
];
const riddles = [
  ["What has keys but cannot open locks?", "A piano"],
  ["What gets wetter the more it dries?", "A towel"],
  ["What has a face and two hands but no arms or legs?", "A clock"],
  ["What has one eye but cannot see?", "A needle"],
  ["What can travel around the world while staying in one corner?", "A stamp"],
  ["What has many teeth but cannot bite?", "A comb"]
];
const prompts = {
  roulette: ["red", "black", "odd", "even", "green zero"],
  wouldyourather: ["Explore the ocean or outer space?", "Read minds or speak every language?", "Have a pause button or a rewind button?", "Visit the past for one day or the future for one day?"],
  oddoneout: ["cedar, maple, oak, salmon — salmon is the odd one out.", "triangle, square, circle, Tuesday — Tuesday is the odd one out.", "violin, cello, flute, telescope — telescope is the odd one out."],
  wordchain: ["lantern", "river", "meadow", "compass", "window", "thunder"],
  animalguess: ["I have black-and-white stripes and live in Africa. (zebra)", "I carry my home on my back. (turtle)", "I am a flightless bird from Antarctica. (penguin)"],
  emojiquiz: ["🌧️🐱🐶 — raining cats and dogs", "🦁👑 — The Lion King", "⭐🚶 — A Star Is Born"],
  moviequiz: ["Which film features the line “May the Force be with you”? (Star Wars)", "What is the name of the toy cowboy in Toy Story? (Woody)", "Which animated film features a snowman named Olaf? (Frozen)"],
  geographyquiz: ["Which country has the cities of Lisbon and Porto? (Portugal)", "Which river runs through London? (The Thames)", "What is the capital of Canada? (Ottawa)"],
  historyquiz: ["Which ancient civilization built Machu Picchu? (The Inca)", "In which year did the first Moon landing happen? (1969)", "Which wall divided Berlin until 1989? (The Berlin Wall)"],
  sciencequiz: ["What is the hardest natural substance? (Diamond)", "How many bones are in the adult human body? (206)", "What force keeps planets in orbit? (Gravity)"],
  pickapath: ["A quiet forest path or a lantern-lit city street? Pick one and tell the group what you find."]
};

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function send(message, content, extra = {}) {
  const { embedColor, image, ...payloadOptions } = extra;
  const name = activeCommands.get(message) ?? "command";
  const embed = createCommandEmbed(name, content, message, { color: embedColor, image });
  return message.reply({ embeds: [embed], allowedMentions: noMentions, ...payloadOptions });
}

function numberArgs(args, minimum = 1) {
  const numbers = args.map(Number);
  if (numbers.length < minimum || numbers.some((value) => !Number.isFinite(value))) {
    throw new Error("Please provide the required numbers.");
  }
  return numbers;
}

function ordinal(number) {
  const mod100 = number % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${number}th`;
  return `${number}${({ 1: "st", 2: "nd", 3: "rd" })[number % 10] ?? "th"}`;
}

function toRoman(number) {
  if (!Number.isInteger(number) || number < 1 || number > 3999) {
    throw new Error("Use an integer from 1 to 3,999.");
  }
  const digits = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"],
    [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"],
    [5, "V"], [4, "IV"], [1, "I"]
  ];
  let remaining = number;
  let result = "";
  for (const [value, symbol] of digits) {
    while (remaining >= value) {
      result += symbol;
      remaining -= value;
    }
  }
  return result;
}

function parseMember(message, raw) {
  const mentioned = message.mentions.members.first();
  if (mentioned) return Promise.resolve(mentioned);
  const id = String(raw ?? "").replace(/[<@!>]/g, "");
  if (!/^\d{15,21}$/.test(id)) return Promise.resolve(null);
  return message.guild.members.fetch(id).catch(() => null);
}

function parseRole(message, raw) {
  const mentioned = message.mentions.roles.first();
  if (mentioned) return mentioned;
  const id = String(raw ?? "").replace(/[<@&>]/g, "");
  return message.guild.roles.cache.get(id)
    ?? message.guild.roles.cache.find((role) => role.name.toLowerCase() === String(raw ?? "").toLowerCase())
    ?? null;
}

function requirePermission(message, permission) {
  if (!message.member.permissions.has(permission)) {
    throw new Error("You don't have permission to use that moderation command.");
  }
  if (!message.guild.members.me.permissions.has(permission)) {
    throw new Error("I don't have the required server permission for that action.");
  }
}

function usage(name) {
  const examples = {
    timeout: "$timeout @member 10m reason",
    untimeout: "$untimeout @member",
    kick: "$kick @member reason",
    ban: "$ban @member reason",
    unban: "$unban user-id",
    purge: "$purge 10",
    slowmode: "$slowmode 5",
    lock: "$lock",
    unlock: "$unlock",
    nickname: "$nickname @member New nickname",
    addrole: "$addrole @member @role",
    removerole: "$removerole @member @role",
    banlist: "$banlist",
    warn: "$warn @member reason",
    pin: "$pin message-id",
    unpin: "$unpin message-id",
    say: "$say message to repeat",
    embedsay: "$embedsay title | message body"
  };
  return `Usage: \`${examples[name] ?? `$${name}`}\``;
}

async function runModeration(message, name, args) {
  if (!message.guild || !message.member) throw new Error("Use moderation commands in a server.");
  const memberPermissions = PermissionsBitField.Flags;
  if (name === "say" || name === "embedsay") {
    requirePermission(message, memberPermissions.ManageMessages);
    const content = args.join(" ").trim();
    if (!content) throw new Error(name === "say"
      ? "Usage: `$say message to repeat`."
      : "Usage: `$embedsay title | message body`.");
    if (name === "say") {
      if (content.length > 1900) throw new Error("Keep repeated messages under 1,900 characters.");
      const embed = createCommandEmbed(name, content, message)
        .setTitle("📣 Server announcement")
        .setFooter({ text: `Posted by ${message.member.displayName} • $say` });
      return message.channel.send({ embeds: [embed], allowedMentions: noMentions });
    }
    if (!message.guild.members.me.permissions.has(memberPermissions.EmbedLinks)) {
      throw new Error("I need the Embed Links permission to post announcements.");
    }
    const divider = content.indexOf("|");
    const title = divider < 0 ? "📢 Server announcement" : content.slice(0, divider).trim();
    const body = divider < 0 ? content : content.slice(divider + 1).trim();
    if (!title || title.length > 256 || !body || body.length > 3500) {
      throw new Error("Use `$embedsay title | message body`; keep the title under 256 and body under 3,500 characters.");
    }
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(title)
      .setDescription(body)
      .setFooter({ text: `Posted by ${message.member.displayName}` })
      .setTimestamp();
    return message.channel.send({ embeds: [embed], allowedMentions: noMentions });
  }
  const target = await parseMember(message, args[0]);
  const reasonStart = name === "timeout" ? 2 : 1;
  const reason = args.slice(reasonStart).join(" ").slice(0, 400) || "No reason supplied";

  if (name === "modhelp") {
    return send(message, [
      "**Moderation command usage**",
      "`$timeout @member 10m reason` · `$untimeout @member`",
      "`$kick @member reason` · `$ban @member reason` · `$unban user-id`",
      "`$purge 10` · `$slowmode 5` · `$lock` · `$unlock`",
      "`$nickname @member New name` · `$addrole @member @role` · `$removerole @member @role`",
      "`$warn @member reason` · `$pin message-id` · `$unpin message-id` · `$banlist`",
      "`$say message` · `$embedsay title | message` (Manage Messages required)"
    ].join("\n"));
  }

  if (name === "unban") {
    requirePermission(message, memberPermissions.BanMembers);
    const id = args[0]?.replace(/[<@!>]/g, "");
    if (!/^\d{15,21}$/.test(id ?? "")) throw new Error(usage(name));
    await message.guild.members.unban(id, reason);
    return send(message, `Removed the ban for user \`${id}\`.`);
  }

  if (name === "banlist") {
    requirePermission(message, memberPermissions.BanMembers);
    const bans = await message.guild.bans.fetch({ limit: 25 });
    const lines = [...bans.values()].slice(0, 20).map((ban) => `${ban.user.tag} — ${ban.user.id}`);
    return send(message, lines.length ? `**Banned accounts**\n${lines.join("\n")}` : "There are no bans to show.");
  }

  if (name === "purge") {
    requirePermission(message, memberPermissions.ManageMessages);
    const count = Number(args[0]);
    if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error("Choose a number from 1 to 100.");
    const deleted = await message.channel.bulkDelete(Math.min(count + 1, 100), true);
    return send(message, `Deleted ${Math.max(0, deleted.size - 1)} recent message(s).`);
  }

  if (name === "slowmode") {
    requirePermission(message, memberPermissions.ManageChannels);
    const seconds = Number(args[0]);
    if (!Number.isInteger(seconds) || seconds < 0 || seconds > 21600) {
      throw new Error("Choose a slowmode from 0 to 21,600 seconds.");
    }
    await message.channel.setRateLimitPerUser(seconds);
    return send(message, seconds ? `Slowmode set to ${seconds} seconds.` : "Slowmode is off.");
  }

  if (name === "lock" || name === "unlock") {
    requirePermission(message, memberPermissions.ManageChannels);
    await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
      SendMessages: name === "lock" ? false : null
    });
    return send(message, name === "lock" ? "This channel is locked for @everyone." : "This channel is unlocked.");
  }

  if (name === "pin" || name === "unpin") {
    requirePermission(message, memberPermissions.ManageMessages);
    const id = args[0];
    if (!/^\d{15,21}$/.test(id ?? "")) throw new Error(usage(name));
    const targetMessage = await message.channel.messages.fetch(id);
    if (name === "pin") await targetMessage.pin();
    else await targetMessage.unpin();
    return send(message, name === "pin" ? "Pinned that message." : "Unpinned that message.");
  }

  if (!target) throw new Error(usage(name));
  if (target.id === message.author.id) throw new Error("You can't use that action on yourself.");
  if (target.id === message.guild.ownerId && message.author.id !== message.guild.ownerId) {
    throw new Error("That member is protected by the server owner role.");
  }

  const required = {
    timeout: memberPermissions.ModerateMembers,
    untimeout: memberPermissions.ModerateMembers,
    kick: memberPermissions.KickMembers,
    ban: memberPermissions.BanMembers,
    nickname: memberPermissions.ManageNicknames,
    addrole: memberPermissions.ManageRoles,
    removerole: memberPermissions.ManageRoles,
    warn: memberPermissions.ManageMessages
  }[name];
  requirePermission(message, required);

  if (name === "timeout" || name === "untimeout") {
    const durationIndex = 1;
    const duration = parseDuration(args[durationIndex]);
    if (name === "timeout" && (!duration || duration < 5_000 || duration > 28 * 86_400_000)) {
      throw new Error(`${usage(name)}. Duration must be 5 seconds to 28 days.`);
    }
    await target.timeout(name === "timeout" ? duration : null, reason);
    return send(message, name === "timeout"
      ? `Timed out ${target.user.tag} for ${args[durationIndex]}.`
      : `Removed ${target.user.tag}'s timeout.`);
  }
  if (name === "kick") {
    await target.kick(reason);
    return send(message, `Kicked ${target.user.tag}.`);
  }
  if (name === "ban") {
    await target.ban({ reason });
    return send(message, `Banned ${target.user.tag}.`);
  }
  if (name === "nickname") {
    const nickname = args.slice(1).join(" ").slice(0, 32);
    if (!nickname) throw new Error(usage(name));
    await target.setNickname(nickname, reason);
    return send(message, `Updated ${target.user.tag}'s nickname.`);
  }
  if (name === "addrole" || name === "removerole") {
    const role = parseRole(message, args[1]);
    if (!role) throw new Error(usage(name));
    if (role.id === message.guild.id || role.managed) throw new Error("That role can't be changed by this command.");
    if (message.guild.members.me.roles.highest.comparePositionTo(role) <= 0) {
      throw new Error("My highest role must be above the role you want to change.");
    }
    await target.roles[name === "addrole" ? "add" : "remove"](role, reason);
    return send(message, `${name === "addrole" ? "Added" : "Removed"} **${role.name}** ${name === "addrole" ? "to" : "from"} ${target.user.tag}.`);
  }
  if (name === "warn") {
    const warning = reason === "No reason supplied" ? "Please review the server rules." : reason;
    await target.send(`A moderator in **${message.guild.name}** sent you a warning: ${warning}`).catch(() => {
      throw new Error("I couldn't DM that member. Their privacy settings may block messages from server members.");
    });
    return send(message, `Sent a warning to ${target.user.tag}.`);
  }
  throw new Error("That moderation command isn't available.");
}

async function runUtility(message, name, args) {
  const raw = args.join(" ");
  const numbers = (minimum = 1) => numberArgs(args, minimum);
  switch (name) {
    case "calc": return send(message, `Result: **${evaluateArithmetic(raw)}**`);
    case "roll": {
      const match = /^(\d{1,2})d(\d{1,4})$/i.exec(args[0] ?? "1d6");
      if (!match) throw new Error("Use dice notation such as `$roll 2d6`.");
      const count = Number(match[1]);
      const sides = Number(match[2]);
      if (count < 1 || count > 20 || sides < 2 || sides > 1000) throw new Error("Roll 1–20 dice with 2–1,000 sides each.");
      const values = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides));
      return send(message, `Roll: ${values.join(", ")} — total **${values.reduce((sum, value) => sum + value, 0)}**`);
    }
    case "progress": {
      const [current, total] = numbers(2);
      if (current < 0 || total <= 0) throw new Error("Use a non-negative current value and a total above zero.");
      const percent = Math.min(100, current / total * 100);
      const filled = Math.round(percent / 10);
      const bar = "🟩".repeat(filled) + "⬜".repeat(10 - filled);
      return send(message, `\`${bar}\`\n**${percent.toFixed(1)}%** complete · ${Math.max(0, total - current).toLocaleString()} remaining`);
    }
    case "randomcolor": {
      const supplied = args[0]?.replace(/^#/, "");
      if (args.length && !/^[\da-f]{6}$/i.test(supplied ?? "")) {
        throw new Error("Use `$randomcolor` for a surprise or `$randomcolor #4F46E5` for a specific color.");
      }
      const hex = supplied
        ? `#${supplied.toUpperCase()}`
        : `#${Math.floor(Math.random() * 0x1000000).toString(16).padStart(6, "0").toUpperCase()}`;
      const value = Number.parseInt(hex.slice(1), 16);
      const red = value >> 16;
      const green = (value >> 8) & 0xff;
      const blue = value & 0xff;
      return send(message, `**${hex}**\nRGB: \`${red}, ${green}, ${blue}\`\nCopy the hex code into your next design.`, { embedColor: value });
    }
    case "snowflake": {
      const id = (args[0] ?? "").replace(/[<@!>]/g, "");
      if (!/^\d{15,21}$/.test(id)) throw new Error("Give me a Discord ID, such as `$snowflake 123456789012345678`.");
      const snowflake = BigInt(id);
      if (snowflake > 0xffffffffffffffffn) throw new Error("That ID is too large to be a Discord snowflake.");
      const createdAt = Number((snowflake >> 22n) + 1_420_070_400_000n);
      if (!Number.isFinite(createdAt)) throw new Error("That Discord ID is outside the supported range.");
      const seconds = Math.floor(createdAt / 1000);
      return send(message, `Created <t:${seconds}:F>\nRelative: <t:${seconds}:R>`);
    }
    case "choose": {
      const options = raw.split(/\s*[|,]\s*/).filter(Boolean);
      if (options.length < 2) throw new Error("Give at least two options separated by commas or `|`.");
      return send(message, `I choose: **${randomItem(options)}**`);
    }
    case "coinflip": return send(message, `It's **${Math.random() < 0.5 ? "heads" : "tails"}**.`);
    case "randomnumber": {
      const [min, max] = numbers(2);
      if (!Number.isInteger(min) || !Number.isInteger(max) || max < min || max - min > 1_000_000) throw new Error("Use integer limits, with the second number greater than the first and a range under one million.");
      return send(message, `Random number: **${min + Math.floor(Math.random() * (max - min + 1))}**`);
    }
    case "reverse": return send(message, raw ? raw.split("").reverse().join("") : "Give me some text to reverse.");
    case "uppercase": return send(message, raw ? raw.toLocaleUpperCase() : "Give me some text.");
    case "lowercase": return send(message, raw ? raw.toLocaleLowerCase() : "Give me some text.");
    case "titlecase": return send(message, raw ? raw.toLocaleLowerCase().replace(/(^|[\s'-])\p{L}/gu, (letter) => letter.toLocaleUpperCase()) : "Give me some text.");
    case "wordcount": return send(message, `Word count: **${raw.trim() ? raw.trim().split(/\s+/).length : 0}**`);
    case "charcount": return send(message, `Character count: **${raw.length}**`);
    case "encode64": return send(message, raw ? Buffer.from(raw, "utf8").toString("base64") : "Give me some text to encode.");
    case "decode64": {
      if (!raw || !/^[\w+/]*={0,2}$/.test(raw)) throw new Error("Give me valid Base64 text.");
      return send(message, Buffer.from(raw, "base64").toString("utf8"));
    }
    case "urlencode": return send(message, encodeURIComponent(raw));
    case "urldecode": {
      try { return send(message, decodeURIComponent(raw.replaceAll("+", " "))); }
      catch { throw new Error("That text isn't valid URL encoding."); }
    }
    case "timestamp": {
      const when = raw ? Date.parse(raw) : Date.now();
      if (!Number.isFinite(when)) throw new Error("Give a date I can parse, such as `2027-04-20 18:30 UTC`.");
      const seconds = Math.floor(when / 1000);
      return send(message, `Full: <t:${seconds}:F>\nRelative: <t:${seconds}:R>`);
    }
    case "timezone": {
      const zone = args[0] || "UTC";
      try {
        const formatted = new Intl.DateTimeFormat("en", { timeZone: zone, dateStyle: "full", timeStyle: "long" }).format(new Date());
        return send(message, `Current time in **${zone}**: ${formatted}`);
      } catch { throw new Error("Use an IANA timezone, such as `Europe/Bucharest` or `America/New_York`."); }
    }
    case "remind": {
      const delay = parseDuration(args[0]);
      const text = args.slice(1).join(" ");
      if (!delay || delay < 5_000 || delay > 86_400_000 || !text) throw new Error("Use `$remind 30m take a break` (5 seconds to 24 hours).");
      const timer = setTimeout(() => {
        reminders.delete(timer);
        const embed = createCommandEmbed(name, `<@${message.author.id}> Reminder: ${text}`, message);
        message.channel.send({
          embeds: [embed],
          allowedMentions: { users: [message.author.id] }
        }).catch(() => undefined);
      }, delay);
      reminders.add(timer);
      return send(message, `I'll remind you in **${args[0]}**.`);
    }
    case "fliptext": {
      const flip = { a: "ɐ", b: "q", c: "ɔ", d: "p", e: "ǝ", f: "ɟ", g: "ƃ", h: "ɥ", i: "ᴉ", j: "ɾ", k: "ʞ", l: "ן", m: "ɯ", n: "u", r: "ɹ", t: "ʇ", v: "ʌ", w: "ʍ", y: "ʎ", ".": "˙", "?": "¿", "!": "¡", "(": ")", ")": "(", "[": "]", "]": "[" };
      return send(message, [...raw].reverse().map((char) => flip[char.toLowerCase()] ?? char).join(""));
    }
    case "palindrome": {
      const normalized = raw.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
      if (!normalized) throw new Error("Give me some text to check.");
      return send(message, normalized === [...normalized].reverse().join("") ? "That is a palindrome." : "That is not a palindrome.");
    }
    case "initials": return send(message, raw.trim().split(/\s+/).filter(Boolean).map((word) => [...word][0].toLocaleUpperCase()).join("") || "Give me a name or phrase.");
    case "slugify": return send(message, raw.normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "Give me some text.");
    case "dedupe": return send(message, [...new Set(raw.split(",").map((item) => item.trim()).filter(Boolean))].join(", ") || "Give me comma-separated values.");
    case "sort": {
      const list = raw.split(",").map((item) => item.trim()).filter(Boolean);
      if (list.length < 2) throw new Error("Give at least two comma-separated items.");
      const sorted = list.every((item) => Number.isFinite(Number(item)))
        ? list.sort((a, b) => Number(a) - Number(b))
        : list.sort((a, b) => a.localeCompare(b));
      return send(message, sorted.join(", "));
    }
    case "shuffle": {
      const list = raw.split(",").map((item) => item.trim()).filter(Boolean);
      if (list.length < 2) throw new Error("Give at least two comma-separated items.");
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
      return send(message, list.join(", "));
    }
    case "add":
    case "subtract":
    case "multiply":
    case "divide":
    case "average":
    case "median": {
      const values = numbers(name === "average" || name === "median" || name === "subtract" || name === "multiply" ? 2 : 2);
      let result;
      if (name === "add") result = values.reduce((sum, value) => sum + value, 0);
      if (name === "subtract") result = values.slice(1).reduce((total, value) => total - value, values[0]);
      if (name === "multiply") result = values.reduce((total, value) => total * value, 1);
      if (name === "divide") {
        if (values[1] === 0) throw new Error("Division by zero is undefined.");
        result = values[0] / values[1];
      }
      if (name === "average") result = values.reduce((sum, value) => sum + value, 0) / values.length;
      if (name === "median") {
        const sorted = [...values].sort((a, b) => a - b);
        const middle = Math.floor(sorted.length / 2);
        result = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
      }
      if (!Number.isFinite(result)) throw new Error("That result is outside the supported range.");
      return send(message, `Result: **${result}**`);
    }
    case "percentage": {
      const [percent, value] = numbers(2);
      return send(message, `${percent}% of ${value} is **${value * percent / 100}**.`);
    }
    case "square": {
      const [value] = numbers();
      return send(message, `**${value}² = ${value ** 2}**`);
    }
    case "squareroot": {
      const [value] = numbers();
      if (value < 0) throw new Error("Use a non-negative number.");
      return send(message, `√${value} = **${Math.sqrt(value)}**`);
    }
    case "factorial": {
      const [value] = numbers();
      if (!Number.isInteger(value) || value < 0 || value > 170) throw new Error("Use a whole number from 0 to 170.");
      let result = 1;
      for (let i = 2; i <= value; i++) result *= i;
      return send(message, `${value}! = **${result}**`);
    }
    case "prime": {
      const [value] = numbers();
      if (!Number.isInteger(value)) throw new Error("Use a whole number.");
      let isPrime = value >= 2;
      for (let divisor = 2; divisor <= Math.sqrt(value) && isPrime; divisor++) isPrime = value % divisor !== 0;
      return send(message, `**${value}** ${isPrime ? "is" : "is not"} prime.`);
    }
    case "binary":
    case "hexadecimal": {
      const [value] = numbers();
      if (!Number.isInteger(value)) throw new Error("Use a whole number.");
      return send(message, `${name === "binary" ? "Binary" : "Hex"}: **${value.toString(name === "binary" ? 2 : 16)}**`);
    }
    case "morse": return send(message, [...raw.toLowerCase()].map((char) => morseMap[char] ?? "").join(" ").trim() || "Give me text to encode.");
    case "morsedecode": {
      const decoded = raw.trim().split(/\s+/).map((code) => code === "/" ? " " : reverseMorseMap[code]);
      if (!decoded.length || decoded.some((character) => character === undefined)) throw new Error("Use Morse codes separated by spaces and `/` between words.");
      return send(message, decoded.join(""));
    }
    case "roman": {
      const [value] = numbers();
      return send(message, toRoman(value));
    }
    case "countdown": {
      const target = Date.parse(raw);
      if (!raw || !Number.isFinite(target)) throw new Error("Give a date and time, such as `2027-04-20 18:30 UTC`.");
      const difference = target - Date.now();
      if (difference <= 0) return send(message, "That date is in the past.");
      const days = Math.floor(difference / 86_400_000);
      const hours = Math.floor((difference % 86_400_000) / 3_600_000);
      const minutes = Math.floor((difference % 3_600_000) / 60_000);
      return send(message, `${days} day(s), ${hours} hour(s), ${minutes} minute(s) to go.`);
    }
    case "formatnumber":
    case "compact":
    case "ordinal": {
      const [value] = numbers();
      if (name === "ordinal") return send(message, ordinal(value));
      return send(message, new Intl.NumberFormat("en-US", { notation: name === "compact" ? "compact" : "standard", maximumFractionDigits: 2 }).format(value));
    }
    case "clamp": {
      const [value, minimum, maximum] = numbers(3);
      if (minimum > maximum) throw new Error("The minimum must not be greater than the maximum.");
      return send(message, `Clamped value: **${Math.max(minimum, Math.min(maximum, value))}**`);
    }
    case "converttemp": {
      const match = /^(-?\d+(?:\.\d+)?)(c|f)$/i.exec(args[0] ?? "");
      if (!match) throw new Error("Use `$converttemp 32f` or `$converttemp 20c`.");
      const value = Number(match[1]);
      return send(message, match[2].toLowerCase() === "f"
        ? `${value}°F = **${((value - 32) * 5 / 9).toFixed(2)}°C**`
        : `${value}°C = **${(value * 9 / 5 + 32).toFixed(2)}°F**`);
    }
    case "convertlength": {
      const match = /^(\d+(?:\.\d+)?)(mm|cm|m|km|in|ft|mi)$/i.exec(args[0] ?? "");
      if (!match) throw new Error("Use a value and unit, such as `$convertlength 5km` or `$convertlength 12in`.");
      const metersPerUnit = { mm: 0.001, cm: 0.01, m: 1, km: 1000, in: 0.0254, ft: 0.3048, mi: 1609.344 };
      const meters = Number(match[1]) * metersPerUnit[match[2].toLowerCase()];
      return send(message, `${meters.toLocaleString("en-US", { maximumFractionDigits: 4 })} m · ${(meters / 1000).toLocaleString("en-US", { maximumFractionDigits: 4 })} km · ${(meters / 0.3048).toLocaleString("en-US", { maximumFractionDigits: 4 })} ft`);
    }
    case "convertweight": {
      const match = /^(\d+(?:\.\d+)?)(kg|lb)$/i.exec(args[0] ?? "");
      if (!match) throw new Error("Use a value and unit, such as `$convertweight 70kg` or `$convertweight 150lb`.");
      const value = Number(match[1]);
      const kilograms = match[2].toLowerCase() === "lb" ? value / 2.2046226218 : value;
      return send(message, `${kilograms.toFixed(2)} kg · ${(kilograms * 2.2046226218).toFixed(2)} lb`);
    }
    case "split": {
      if (!raw) throw new Error("Give me some text to split.");
      return send(message, raw.split(/\s+/).map((word, index) => `${index + 1}. ${word}`).join("\n").slice(0, 1900));
    }
    case "join": {
      if (args.length < 2) throw new Error("Use `$join separator words...`, such as `$join - one two three`.");
      return send(message, args.slice(1).join(args[0]));
    }
    default: throw new Error("That utility command isn't available.");
  }
}

async function runInfo(message, name, args) {
  const guild = message.guild;
  const target = await parseMember(message, args[0]) ?? message.member;
  if (name === "channelinfo") {
    const channel = message.channel;
    return send(message, `**#${channel.name}** · ID \`${channel.id}\`\n${channel.topic || "No channel topic is set."}`);
  }
  if (name === "roleinfo") {
    const role = parseRole(message, args.join(" "));
    if (!role) throw new Error("Mention a role or give its exact name.");
    return send(message, `**${role.name}** · ${role.members.size} member(s) · color \`${role.hexColor}\` · position ${role.position}`);
  }
  if (name === "permissions") {
    return send(message, `**${message.member.displayName}** permissions: ${message.member.permissions.toArray().slice(0, 30).join(", ") || "none"}`);
  }
  if (name === "joined") {
    if (!guild) throw new Error("Use this command in a server.");
    return send(message, `${target.user.tag} joined <t:${Math.floor(target.joinedTimestamp / 1000)}:F>.`);
  }
  if (name === "created") {
    const user = message.mentions.users.first() ?? (args[0] ? await message.client.users.fetch(args[0].replace(/[<@!>]/g, "")).catch(() => null) : message.author);
    if (!user) throw new Error("I couldn't find that user.");
    return send(message, `${user.tag}'s account was created <t:${Math.floor(user.createdTimestamp / 1000)}:F>.`);
  }
  if (name === "servericon") {
    if (!guild) throw new Error("Use this command in a server.");
    const image = guild.iconURL({ size: 1024 });
    return image ? send(message, "A closer look at this server's icon.", { image }) : send(message, "This server doesn't have an icon set.");
  }
  if (name === "serverbanner") {
    if (!guild) throw new Error("Use this command in a server.");
    const image = guild.bannerURL({ size: 1024 });
    return image ? send(message, "A closer look at this server's banner.", { image }) : send(message, "This server doesn't have a banner set.");
  }
  if (name === "toproles") {
    return send(message, guild.roles.cache.sort((a, b) => b.position - a.position).first(10).map((role) => role.name).join(" · "));
  }
  if (name === "serveremojis") {
    if (!guild) throw new Error("Use this command in a server.");
    const emojis = [...guild.emojis.cache.values()];
    if (!emojis.length) return send(message, "This server hasn't added any custom emojis yet.");
    const shown = emojis.slice(0, 45).map((emoji) => `${emoji}  \`:${emoji.name}:\``);
    const remaining = emojis.length - shown.length;
    return send(message, `${shown.join("\n")}${remaining ? `\n\n…and ${remaining} more.` : ""}`);
  }
  if (name === "channeltopic") {
    if (args[0]?.toLowerCase() === "view") return send(message, message.channel.topic || "No topic is set for this channel.");
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) throw new Error("You need Manage Channels to change a topic.");
    if (!args.length) throw new Error("Usage: `$channeltopic <new topic>` or `$channeltopic view`.");
    if (typeof message.channel.setTopic !== "function") throw new Error("This channel type doesn't support a topic.");
    await message.channel.setTopic(args.join(" ").slice(0, 1024));
    return send(message, "Updated the channel topic.");
  }
  throw new Error("That information command isn't available.");
}

function cooldownText(milliseconds) {
  const totalSeconds = Math.ceil(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours ? `${hours}h` : "", minutes ? `${minutes}m` : "", !hours && !minutes ? `${seconds}s` : ""].filter(Boolean).join(" ");
}

function requireEconomyServer(message) {
  if (!message.guildId) throw new Error("The virtual coin wallet is available in servers, not DMs.");
}

async function runEconomy(message, name, args) {
  requireEconomyServer(message);
  if (name === "currency") {
    return send(message, "🪙 These are free, server-only fun coins. They have no cash value and cannot be bought or withdrawn. Claim `$daily`, earn more with `$work`, and browse `$shop`.");
  }
  if (name === "shop") {
    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle("🛍️ Coin shop")
      .setDescription(currencyItems.map((item) => `${item.emoji} **${item.name}** — \`${item.id}\` · 🪙 ${item.price.toLocaleString()}`).join("\n"))
      .setFooter({ text: "Buy with $buy <item> • Coins are just for fun and have no cash value" });
    return message.reply({ embeds: [embed], allowedMentions: noMentions });
  }
  if (name === "balance" || name === "bal") {
    const member = message.mentions.members.first();
    const user = member?.user ?? message.author;
    const wallet = await economy.getWallet(message.guildId, user.id);
    const collectibleCount = Object.values(wallet.inventory).reduce((sum, quantity) => sum + quantity, 0);
    const embed = new EmbedBuilder()
      .setColor(0xffc107)
      .setTitle(`💰 ${user.username}'s wallet`)
      .setDescription(`🪙 **${wallet.coins.toLocaleString()} coins**`)
      .addFields({ name: "🎒 Collectibles", value: `${collectibleCount} item(s) · use \`$bag\` to see them` })
      .setThumbnail(user.displayAvatarURL({ size: 128 }))
      .setFooter({ text: "Virtual coins have no real-world value" });
    return message.reply({ embeds: [embed], allowedMentions: noMentions });
  }
  if (name === "daily" || name === "work") {
    const amount = name === "daily"
      ? 100 + Math.floor(Math.random() * 51)
      : 25 + Math.floor(Math.random() * 56);
    const result = await economy.claim(message.guildId, message.author.id, name, amount);
    if (!result.claimed) {
      return send(message, `⏳ You've already claimed that reward. Try again in **${cooldownText(result.remainingMs)}**.`);
    }
    return send(message, `${name === "daily" ? "🎁 Daily reward" : "🛠️ Shift complete"}: **+${result.amount} 🪙**. Your balance is **${result.coins.toLocaleString()} coins**.`);
  }
  if (name === "pay") {
    const recipient = message.mentions.members.first();
    const amount = Number(args[1]);
    if (!recipient || !Number.isSafeInteger(amount) || amount < 1 || amount > 100_000) {
      throw new Error("Usage: `$pay @member amount` (1 to 100,000 coins).");
    }
    if (recipient.user.bot) throw new Error("You can send coins to server members, not bots.");
    const result = await economy.transfer(message.guildId, message.author.id, recipient.id, amount);
    if (!result.transferred) return send(message, `You have **${result.balance.toLocaleString()} 🪙**; that isn't enough for this transfer.`);
    return send(message, `💸 Sent **${amount.toLocaleString()} 🪙** to **${recipient.displayName}**. Your balance is **${result.senderCoins.toLocaleString()}**.`);
  }
  if (name === "leaderboard" || name === "lb") {
    const leaders = await economy.leaderboard(message.guildId);
    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle("🏆 Server coin leaderboard")
      .setDescription(leaders.length
        ? leaders.map((wallet, index) => `${["🥇", "🥈", "🥉"][index] ?? `**${index + 1}.**`} <@${wallet.userId}> — **${wallet.coins.toLocaleString()} 🪙**`).join("\n")
        : "No wallets yet. Start with `$daily`.")
      .setFooter({ text: "Only virtual coins earned in this server are shown" });
    return message.reply({ embeds: [embed], allowedMentions: noMentions });
  }
  if (name === "buy") {
    const selection = args.join(" ").toLowerCase();
    const item = currencyItems.find((candidate) => candidate.id === selection || candidate.name.toLowerCase() === selection);
    if (!item) throw new Error("Choose an item ID from `$shop`, such as `$buy coffee`.");
    const result = await economy.buy(message.guildId, message.author.id, item.id);
    if (!result.bought) return send(message, `You need **${result.price} 🪙**; your balance is **${result.balance} 🪙**.`);
    return send(message, `${item.emoji} Bought **${item.name}** for **${item.price} 🪙**. You now have ${result.quantity} in your bag.`);
  }
  if (name === "inventory" || name === "bag") {
    const wallet = await economy.getWallet(message.guildId, message.author.id);
    const lines = currencyItems
      .filter((item) => wallet.inventory[item.id])
      .map((item) => `${item.emoji} **${item.name}** × ${wallet.inventory[item.id]}`);
    const embed = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle(`🎒 ${message.author.username}'s collectibles`)
      .setDescription(lines.join("\n") || "Nothing in your bag yet. Try `$shop`.")
      .setFooter({ text: `Balance: ${wallet.coins.toLocaleString()} 🪙` });
    return message.reply({ embeds: [embed], allowedMentions: noMentions });
  }
  throw new Error("That economy command isn't available.");
}

function runCourtroom(message, name, args) {
  const mention = message.mentions.users.first();
  const freeText = args
    .filter((part) => !/^<@!?\d+>$/.test(part))
    .join(" ")
    .replace(/[\r\n*_~`|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
  const target = (mention?.username ?? freeText) || "the mysteriously missing snacks";
  const notice = "\n*Fictional courtroom roleplay only — not legal advice or a real legal notice.*";
  const verdicts = [
    "The accused must return the last cookie and share the next snack.",
    "Not guilty by reason of excellent vibes.",
    "The court orders one dramatic apology to the group chat.",
    "Case dismissed; the jury needs a snack break."
  ];
  const responses = {
    sue: `⚖️ **Mock case opened:** ${target} is accused of a highly fictional snack-related offense. Case type: ${freeText || "last-cookie dispute"}.`,
    lawyer: `🧑‍⚖️ ${target} has been assigned a pretend lawyer whose main qualification is owning a very small briefcase.`,
    court: "🏛️ The Court of Silly Disputes is now in session. Please present your case in one sentence.",
    verdict: `📜 **The mock jury's verdict:** ${randomItem(verdicts)}`,
    objection: `🙋 **Objection!** ${freeText || "That claim is far too dramatic for this courtroom."} The imaginary judge is considering it.`,
    subpoena: `📨 A pretend summons has been issued for **${target}** to appear before the Court of Silly Disputes.`,
    bail: `🪙 **Fictional bail:** ${10 + Math.floor(Math.random() * 91)} marshmallows. The court does not accept real payments.`,
    jury: `🦝 The imaginary jury of raccoons finds **${target}** ${randomItem(["guilty of stealing the spotlight", "not guilty, but suspiciously charming", "responsible for bringing snacks next time"])}.`
  };
  return send(message, `${responses[name] ?? "⚖️ The Court of Silly Disputes is adjourned."}${notice}`);
}

async function runGame(message, name, args) {
  if (name === "guess" || name === "wordle") {
    const key = `${message.guildId}:${message.channelId}:${message.author.id}:${name}`;
    const round = guessRounds.get(key);
    if (!round || Date.now() > round.expires) {
      const answer = name === "guess" ? String(1 + Math.floor(Math.random() * 20)) : randomItem(["crane", "slate", "proud", "flame", "beach", "grape"]);
      guessRounds.set(key, { answer, expires: Date.now() + 10 * 60_000, tries: 0 });
      return send(message, name === "guess"
        ? "I'm thinking of a number from 1 to 20. Reply with `$guess <number>`."
        : "I'm thinking of a five-letter word. Reply with `$wordle <word>`; I'll tell you whether the guess is right.");
    }
    const guess = (args[0] ?? "").toLowerCase();
    if (!guess) return send(message, `Send your guess with \`$${name} <${name === "guess" ? "number" : "word"}>\`.`);
    if (name === "guess" && (!/^\d+$/.test(guess) || Number(guess) < 1 || Number(guess) > 20)) {
      throw new Error("Guess a whole number from 1 to 20.");
    }
    round.tries++;
    if (guess === round.answer) {
      guessRounds.delete(key);
      return send(message, `Correct — you got it in ${round.tries} guess(es). Start another round with \`$${name}\`.`);
    }
    if (name === "guess") return send(message, Number(guess) < Number(round.answer) ? "Higher." : "Lower.");
    if (round.tries >= 6) {
      guessRounds.delete(key);
      return send(message, `Out of guesses. The word was **${round.answer}**. Start again with \`$wordle\`.`);
    }
    return send(message, `Not that word. You have ${6 - round.tries} guess(es) left. This simple mode checks the exact word.`);
  }
  if (name === "rps") {
    const choice = args[0]?.toLowerCase();
    if (!["rock", "paper", "scissors"].includes(choice)) throw new Error("Choose rock, paper, or scissors: `$rps rock`.");
    const bot = randomItem(["rock", "paper", "scissors"]);
    const outcome = choice === bot ? "It's a tie." : ({ rock: "scissors", paper: "rock", scissors: "paper" })[choice] === bot ? "You win." : "I win this round.";
    return send(message, `You chose **${choice}**; I chose **${bot}**. ${outcome}`);
  }
  if (name === "trivia" || name === "quiz") {
    const [question, answer] = randomItem(trivia);
    return send(message, `${question}\nAnswer: ||${answer}||`);
  }
  if (name === "riddle") {
    const [question, answer] = randomItem(riddles);
    return send(message, `${question}\nAnswer: ||${answer}||`);
  }
  if (name === "dice" || name === "d20" || name === "d100") {
    const sides = name === "dice" ? 6 : Number(name.slice(1));
    const count = name === "dice" && args[0] ? Number(args[0]) : 1;
    if (!Number.isInteger(count) || count < 1 || count > 20) throw new Error("Roll from 1 to 20 dice.");
    const values = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides));
    return send(message, `Roll${count > 1 ? "s" : ""}: ${values.join(", ")} — total **${values.reduce((sum, value) => sum + value, 0)}**`);
  }
  if (name === "slots" || name === "slot") {
    const icons = ["🍒", "🍋", "🔔", "⭐", "7️⃣"];
    const result = Array.from({ length: 3 }, () => randomItem(icons));
    if (!message.guildId) throw new Error("The coin-powered slot machine is available in servers, not DMs.");
    const bet = args[0] ? Number(args[0]) : 10;
    const spin = await economy.playSlots(message.guildId, message.author.id, bet, result);
    if (!spin.played) return send(message, `🎰 You need **${bet} 🪙** for that spin; your balance is **${spin.balance} 🪙**.`);
    const outcome = spin.multiplier === 5
      ? "🎉 Jackpot — five times your bet returned!"
      : spin.multiplier === 2
        ? "✨ A pair — twice your bet returned."
        : "No match — better luck next spin.";
    const embed = new EmbedBuilder()
      .setColor(spin.multiplier === 5 ? 0xf1c40f : spin.multiplier === 2 ? 0x57f287 : 0x5865f2)
      .setTitle("🎰 Coin slots")
      .setDescription(`${result.join("　")}\n\n${outcome}`)
      .addFields(
        { name: "Bet", value: `${spin.bet} 🪙`, inline: true },
        { name: "Payout", value: `${spin.payout} 🪙`, inline: true },
        { name: "Balance", value: `${spin.balance.toLocaleString()} 🪙`, inline: true }
      )
      .setFooter({ text: "Virtual coins only • Use $slot for a quick 10-coin spin" });
    return message.reply({ embeds: [embed], allowedMentions: noMentions });
  }
  if (name === "coinrace") {
    let playerHeads = 0;
    let botHeads = 0;
    const rounds = [];
    while (playerHeads < 3 && botHeads < 3 && rounds.length < 20) {
      const player = Math.random() < 0.5 ? "H" : "T";
      const bot = Math.random() < 0.5 ? "H" : "T";
      rounds.push(`${player}/${bot}`);
      if (player === "H") playerHeads++;
      if (bot === "H") botHeads++;
    }
    return send(message, `Race to three heads — you **${playerHeads}**, bot **${botHeads}** (${rounds.join(" · ")}). ${playerHeads === botHeads ? "It's a tie." : playerHeads > botHeads ? "You won." : "I won."}`);
  }
  if (name === "mathrace") {
    const a = 2 + Math.floor(Math.random() * 18);
    const b = 2 + Math.floor(Math.random() * 18);
    return send(message, `Quick challenge: **${a} × ${b} = ?**`);
  }
  if (name === "highlow") {
    const key = `${message.guildId}:${message.channelId}:${message.author.id}`;
    const current = highLowRounds.get(key);
    if (current === undefined) {
      const first = 1 + Math.floor(Math.random() * 13);
      highLowRounds.set(key, first);
      return send(message, `Your card is **${first}**. Guess \`higher\` or \`lower\` with \`$highlow higher\`.`);
    }
    const guess = args[0]?.toLowerCase();
    if (!["higher", "lower"].includes(guess)) throw new Error("Guess with `$highlow higher` or `$highlow lower`.");
    const next = 1 + Math.floor(Math.random() * 13);
    highLowRounds.delete(key);
    return send(message, `Next card: **${next}**. ${next === current ? "It matched; tie round." : (next > current ? "higher" : "lower") === guess ? "You guessed right." : "Not this time."}`);
  }
  if (name === "blackjack") {
    const hand = () => 2 + Math.floor(Math.random() * 10) + 2 + Math.floor(Math.random() * 10);
    const player = hand();
    const dealer = hand();
    return send(message, `Your draw: **${player}**. Dealer: **${dealer}**. ${player > 21 ? "Bust." : dealer > 21 || player > dealer ? "You win this hand." : player === dealer ? "Push." : "Dealer wins this hand."}`);
  }
  if (name === "duel") return send(message, `${message.author.username} rolled ${1 + Math.floor(Math.random() * 20)} on a friendly, fictional d20 duel.`);
  if (name === "anagram") return send(message, "Unscramble **HTREA**. Answer: ||HEART||");
  if (name === "scramble") return send(message, "Unscramble **NITCSE**. Answer: ||INSECT||");
  if (name === "hangman") return send(message, "Hangman word: **_ _ _ _ _**. Clue: a piece of furniture. Answer: ||TABLE||");
  if (name === "numberfact") {
    const number = 2 + Math.floor(Math.random() * 99);
    return send(message, `${number} is ${number % 2 ? "odd" : "even"}${number % 3 === 0 ? " and divisible by 3" : ""}.`);
  }
  if (prompts[name]) {
    const prompt = randomItem(prompts[name]);
    const withAnswer = /^(.*)\(([^()]*)\)$/.exec(prompt);
    return send(message, withAnswer ? `${withAnswer[1]}(||${withAnswer[2]}||)` : prompt);
  }
  const [question, answer] = randomItem(trivia);
  return send(message, `${question}\nAnswer: ||${answer}||`);
}

export async function handleCommand(message, rawName, args) {
  const name = rawName.toLowerCase();
  activeCommands.set(message, name);
  try {
    const definition = commandByName.get(name);
    if (!definition) return send(message, `I don't know \`$${name}\`. ${HELP}`);

    if (definition.kind === "utility") return await runUtility(message, name, args);
    if (definition.kind === "moderation") return await runModeration(message, name, args);
    if (definition.kind === "info") return await runInfo(message, name, args);
    if (definition.kind === "game") return await runGame(message, name, args);
    if (definition.kind === "ticket") return await handleTicketCommand(message, name, args);
    if (definition.kind === "economy") return await runEconomy(message, name, args);
    if (definition.kind === "poll") {
      const [question, ...options] = args.join(" ").split("|").map((item) => item.trim()).filter(Boolean);
      if (!question || options.length < 2 || options.length > 10) {
        throw new Error("Use `$poll question | option one | option two` (up to 10 choices).");
      }
      const numberEmojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
      const embed = new EmbedBuilder()
        .setColor(0x26a69a)
        .setTitle(question.slice(0, 256))
        .setDescription(options.map((option, index) => `${numberEmojis[index]} ${option}`).join("\n"))
        .setFooter({ text: `Poll by ${message.author.username}` });
      const poll = await message.channel.send({ embeds: [embed], allowedMentions: noMentions });
      for (let index = 0; index < options.length; index++) await poll.react(numberEmojis[index]);
      return message.delete().catch(() => undefined);
    }
    if (definition.kind === "community") {
      if (name === "team") {
        const people = [...message.mentions.users.values()];
        if (people.length < 2) throw new Error("Mention at least two people.");
        const shuffled = [...people].sort(() => Math.random() - 0.5);
        const first = shuffled.filter((_, index) => index % 2 === 0).map((user) => user.username);
        const second = shuffled.filter((_, index) => index % 2 === 1).map((user) => user.username);
        return send(message, `**Team 1:** ${first.join(", ")}\n**Team 2:** ${second.join(", ") || "Add one more player."}`);
      }
      return send(message, definition.value.replaceAll("{user}", message.mentions.users.first()?.username ?? message.author.username));
    }
    if (definition.kind === "fun") {
      if (["sue", "lawyer", "court", "verdict", "objection", "subpoena", "bail", "jury"].includes(name)) {
        return runCourtroom(message, name, args);
      }
      if (name === "magic8ball") {
        if (!args.length) throw new Error("Ask a yes-or-no question.");
        return send(message, randomItem(["It is certain.", "Signs point to yes.", "Ask again later.", "Outlook is good.", "Better not say right now.", "Very doubtful."]));
      }
      if (name === "rate") {
        const phrase = args.join(" ");
        return send(message, phrase ? `**${phrase.slice(0, 100)}** gets **${1 + Math.floor(Math.random() * 10)}/10**.` : "Give me something to rate.");
      }
      return send(message, definition.value);
    }
    if (definition.kind === "core") {
      switch (name) {
        case "ping": return send(message, `Pong — ${message.client.ws.ping} ms gateway latency.`);
        case "about": return send(message, `I'm **${message.client.user.username}**, a server bot with ${commandByName.size} commands. ${HELP}`);
        case "uptime": {
          const totalSeconds = Math.floor((message.client.uptime ?? 0) / 1000);
          const days = Math.floor(totalSeconds / 86400);
          const hours = Math.floor((totalSeconds % 86400) / 3600);
          const minutes = Math.floor((totalSeconds % 3600) / 60);
          return send(message, `Online for ${days}d ${hours}h ${minutes}m.`);
        }
        case "invite": {
          const permissionBits = [
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
          return send(message, `Invite me with [this link](https://discord.com/oauth2/authorize?client_id=${message.client.user.id}&scope=bot%20applications.commands&permissions=${permissionBits.toString()}). Only grant permissions your server needs.`);
        }
        case "serverinfo": {
          if (!message.guild) throw new Error("Use this command in a server.");
          return send(message, `**${message.guild.name}**\n${message.guild.memberCount} member(s) · ${message.guild.channels.cache.size} cached channel(s) · created <t:${Math.floor(message.guild.createdTimestamp / 1000)}:D>`);
        }
        case "profile": {
          const member = await parseMember(message, args[0]) ?? message.member;
          if (!member) throw new Error("Use this command in a server or mention a member.");
          return send(message, `**${member.user.tag}**\n${member.roles.highest.name} · joined <t:${Math.floor(member.joinedTimestamp / 1000)}:D>`);
        }
        case "avatar": {
          const user = message.mentions.users.first() ?? (args[0] ? await message.client.users.fetch(args[0].replace(/[<@!>]/g, "")).catch(() => null) : message.author);
          if (!user) throw new Error("I couldn't find that user.");
          return send(message, user.displayAvatarURL({ size: 1024 }));
        }
        case "membercount": return send(message, `This server has **${message.guild?.memberCount ?? "unknown"}** members.`);
        case "rolelist": {
          if (!message.guild) throw new Error("Use this command in a server.");
          const roles = message.guild.roles.cache.sort((a, b) => b.position - a.position).first(20);
          return send(message, roles.map((role) => `• ${role.name}`).join("\n").slice(0, 1800));
        }
        case "botstatus": return send(message, `Connected as **${message.client.user.tag}** · ${message.client.guilds.cache.size} server(s) · ${message.client.ws.ping} ms gateway ping.`);
        case "report": return send(message, "For a private report, open `$help` and use the **Open a ticket** button.");
      }
    }
    if (definition.kind === "report") return send(message, "For a private report, open `$help` and use the **Open a ticket** button.");
    return send(message, definition.value || HELP);
  } catch (error) {
    const text = error instanceof Error ? error.message : "That command couldn't be completed.";
    return send(message, `Couldn't complete that command: ${text}`);
  } finally {
    activeCommands.delete(message);
  }
}