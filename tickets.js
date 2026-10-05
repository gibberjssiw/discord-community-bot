import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  PermissionsBitField,
  TextInputBuilder,
  TextInputStyle
} from "discord.js";
import { createCommandEmbed } from "./command-embeds.js";

const ticketOwnerPattern = /(?:^|;)ticket-owner=(\d{15,21})(?:;|$)/;
const ticketClaimPattern = /(?:^|;)ticket-claimed=(\d{15,21})(?:;|$)/;

function ticketOwner(channel) {
  return ticketOwnerPattern.exec(channel.topic ?? "")?.[1] ?? null;
}

function isTicket(channel) {
  return channel.type === ChannelType.GuildText && ticketOwner(channel) !== null;
}

function canManageTickets(member) {
  return member?.permissions.has(PermissionsBitField.Flags.ManageChannels) ?? false;
}

function canAccessTicket(member, channel) {
  return member?.id === ticketOwner(channel) || canManageTickets(member);
}

function safeSlug(value) {
  const slug = value.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
  return slug.slice(0, 30) || "member";
}

async function createPrivateTicket(guild, user, subject) {
  if (!guild.members.me.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
    throw new Error("I need the Manage Channels permission to create private tickets.");
  }
  const existing = guild.channels.cache.find((channel) => isTicket(channel) && ticketOwner(channel) === user.id);
  if (existing) return { channel: existing, alreadyOpen: true };

  const botId = guild.members.me.id;
  const parent = process.env.TICKET_CATEGORY_ID || undefined;
  const topic = `ticket-owner=${user.id};ticket-subject=${Buffer.from(subject || "Support request").toString("base64url")}`;
  const channel = await guild.channels.create({
    name: `ticket-${safeSlug(user.username)}`,
    type: ChannelType.GuildText,
    ...(parent ? { parent } : {}),
    topic,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionsBitField.Flags.ViewChannel]
      },
      {
        id: user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.AttachFiles
        ]
      },
      {
        id: botId,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.ManageChannels
        ]
      }
    ]
  });
  const closeButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket:close")
      .setLabel("🔒 Close ticket")
      .setStyle(ButtonStyle.Danger)
  );
  const embed = new EmbedBuilder()
    .setColor(0x5c6bc0)
    .setTitle("🎟️ Support ticket")
    .setDescription(`Hi <@${user.id}>. A private channel has been opened for your request.\n\n**Subject:** ${subject || "Support request"}\n\nA server moderator can reply here. Use the button below when you're finished.`)
    .setFooter({ text: "Private support channel" })
    .setTimestamp();
  await channel.send({ embeds: [embed], components: [closeButton], allowedMentions: { users: [user.id] } });
  return { channel, alreadyOpen: false };
}

function closeConfirmationRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket:close-confirm")
      .setLabel("✅ Confirm close")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("ticket:close-cancel")
      .setLabel("↩️ Keep open")
      .setStyle(ButtonStyle.Secondary)
  );
}

function ticketReply(message, name, description, extra = {}) {
  return message.reply({
    embeds: [createCommandEmbed(name, description, message)],
    allowedMentions: { parse: [] },
    ...extra
  });
}

function ticketInteractionReply(interaction, name, description, extra = {}) {
  return interaction.reply({
    embeds: [createCommandEmbed(name, description, interaction)],
    allowedMentions: { parse: [] },
    ...extra
  });
}

async function showCloseConfirmation(interaction) {
  if (!isTicket(interaction.channel)) {
    return ticketInteractionReply(interaction, "ticketclose", "This channel isn't an open ticket.", { ephemeral: true });
  }
  if (!canAccessTicket(interaction.member, interaction.channel)) {
    return ticketInteractionReply(interaction, "ticketclose", "Only the ticket owner or a moderator can close this ticket.", { ephemeral: true });
  }
  return ticketInteractionReply(interaction, "ticketclose", "Close this ticket? The private channel will be deleted.", {
    components: [closeConfirmationRow()],
    ephemeral: true
  });
}

async function closeTicket(interaction) {
  const channel = interaction.channel;
  if (!isTicket(channel)) return ticketInteractionReply(interaction, "ticketclose", "This channel isn't an open ticket.", { ephemeral: true });
  if (!canAccessTicket(interaction.member, channel)) {
    return ticketInteractionReply(interaction, "ticketclose", "Only the ticket owner or a moderator can close this ticket.", { ephemeral: true });
  }
  await interaction.update({
    embeds: [createCommandEmbed("ticketclose", "Ticket closed. This channel is being removed.", interaction)],
    components: []
  });
  await channel.delete(`Ticket closed by ${interaction.user.tag}`);
}

async function submitTicketModal(interaction) {
  if (!interaction.inGuild()) {
    return ticketInteractionReply(interaction, "ticket", "Tickets can only be opened from a server.", { ephemeral: true });
  }
  const subject = interaction.fields.getTextInputValue("ticket:subject").trim();
  try {
    const { channel, alreadyOpen } = await createPrivateTicket(interaction.guild, interaction.user, subject);
    return ticketInteractionReply(interaction, "ticket", alreadyOpen
        ? `You already have an open ticket: <#${channel.id}>`
        : `Your private ticket is ready: <#${channel.id}>`, {
      ephemeral: true
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "I couldn't create a ticket.";
    return ticketInteractionReply(interaction, "ticket", message, { ephemeral: true });
  }
}

export async function handleTicketInteraction(interaction) {
  if (interaction.isButton()) {
    if (interaction.customId === "ticket:open") {
      const modal = new ModalBuilder()
        .setCustomId("ticket:modal")
        .setTitle("Open a support ticket")
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("ticket:subject")
              .setLabel("What do you need help with?")
              .setStyle(TextInputStyle.Paragraph)
              .setPlaceholder("A short description helps the team route your request.")
              .setRequired(true)
              .setMaxLength(500)
          )
        );
      return interaction.showModal(modal);
    }
    if (interaction.customId === "ticket:close") return showCloseConfirmation(interaction);
    if (interaction.customId === "ticket:close-confirm") return closeTicket(interaction);
    if (interaction.customId === "ticket:close-cancel") {
      return interaction.update({
        embeds: [createCommandEmbed("ticketclose", "Ticket left open.", interaction)],
        components: []
      });
    }
  }

  if (interaction.isModalSubmit() && interaction.customId === "ticket:modal") {
    return submitTicketModal(interaction);
  }
}

export async function handleTicketCommand(message, name, args) {
  if (!message.guild || !message.member) throw new Error("Use ticket commands inside a server.");

  if (name === "ticketguide") {
    return ticketReply(message, name, "Use the **Open a ticket** button in `$help`, or run `$ticket` to create a private support channel. In an open ticket, the owner or a moderator can use the close button. Staff can also use `$ticketadd`, `$ticketremove`, `$ticketclaim`, and `$tickettranscript`.");
  }

  if (name === "ticket") {
    const subject = args.join(" ").trim() || "Support request";
    const { channel, alreadyOpen } = await createPrivateTicket(message.guild, message.author, subject);
    return ticketReply(message, name, alreadyOpen ? `You already have an open ticket: <#${channel.id}>` : `Your private ticket is ready: <#${channel.id}>`);
  }

  if (name === "ticketpanel") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      throw new Error("You need Manage Channels to post a ticket panel.");
    }
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("ticket:open").setLabel("🎟️ Open a ticket").setStyle(ButtonStyle.Primary)
    );
    const embed = new EmbedBuilder()
      .setColor(0x5c6bc0)
      .setTitle("🆘 Need help?")
      .setDescription("Press the button to open a private ticket with the server team.")
      .setFooter({ text: "Support • private tickets" })
      .setTimestamp();
    return message.channel.send({ embeds: [embed], components: [row] });
  }

  if (name === "ticketstats") {
    if (!canManageTickets(message.member)) throw new Error("You need Manage Channels to view ticket counts.");
    const count = message.guild.channels.cache.filter(isTicket).size;
    return ticketReply(message, name, `There are **${count}** open ticket(s).`);
  }

  if (!isTicket(message.channel)) throw new Error("Use this command inside an open ticket.");
  if (!canAccessTicket(message.member, message.channel)) throw new Error("Only the ticket owner or a moderator can manage this ticket.");

  if (name === "ticketclose") {
    const row = closeConfirmationRow();
    return ticketReply(message, name, "Close this ticket? The private channel will be deleted.", { components: [row] });
  }
  if (name === "ticketadd" || name === "ticketremove") {
    const member = message.mentions.members.first()
      ?? (args[0] ? await message.guild.members.fetch(args[0].replace(/[<@!>]/g, "")).catch(() => null) : null);
    if (!member) throw new Error(`Usage: \`$${name} @member\``);
    if (member.id === ticketOwner(message.channel) && name === "ticketremove") {
      throw new Error("The ticket owner can't be removed from their own ticket.");
    }
    await message.channel.permissionOverwrites[name === "ticketadd" ? "edit" : "delete"](member.id,
      name === "ticketadd" ? {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true
      } : undefined
    );
    return ticketReply(message, name, name === "ticketadd" ? `Added ${member.user.tag} to the ticket.` : `Removed ${member.user.tag} from the ticket.`);
  }
  if (name === "ticketrename") {
    const newName = args.join("-").toLowerCase().replace(/[^\p{L}\p{N}-]+/gu, "").replace(/-+/g, "-").slice(0, 90);
    if (!newName) throw new Error("Usage: `$ticketrename short-description`.");
    await message.channel.setName(newName.startsWith("ticket-") ? newName : `ticket-${newName}`);
    return ticketReply(message, name, "Renamed this ticket.");
  }
  if (name === "ticketclaim") {
    if (!canManageTickets(message.member)) throw new Error("Only a moderator can claim a ticket.");
    const topic = message.channel.topic ?? "";
    const cleaned = topic.replace(/;?ticket-claimed=\d{15,21}/, "").replace(/;$/, "");
    await message.channel.setTopic(`${cleaned};ticket-claimed=${message.author.id}`.slice(0, 1024));
    return ticketReply(message, name, `Ticket claimed by ${message.author.tag}.`);
  }
  if (name === "tickettranscript") {
    const messages = await message.channel.messages.fetch({ limit: 100 });
    const lines = [...messages.values()]
      .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
      .map((item) => `[${item.createdAt.toISOString()}] ${item.author.tag}: ${item.cleanContent || "[attachment/embed]"}`);
    const file = new AttachmentBuilder(Buffer.from(lines.join("\n"), "utf8"), {
      name: `${message.channel.name}-transcript.txt`
    });
    return message.channel.send({
      embeds: [createCommandEmbed(name, "Recent ticket transcript (up to 100 messages) is attached.", message)],
      files: [file],
      allowedMentions: { parse: [] }
    });
  }
  throw new Error("That ticket command isn't available.");
}

export function getTicketOwner(channel) {
  return ticketOwner(channel);
}