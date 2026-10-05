import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder
} from "discord.js";
import { commandCatalog, commandCategories } from "./catalog.js";
import { CATEGORY_STYLES } from "./command-embeds.js";

const PAGE_SIZE = 18;
const CATEGORY_EMOJI = Object.fromEntries(Object.entries(CATEGORY_STYLES).map(([name, style]) => [name, style.emoji]));

export function createHelpPayload(category = commandCategories[0], page = 0) {
  const selected = commandCategories.includes(category) ? category : commandCategories[0];
  const entries = commandCatalog.filter((item) => item.category === selected);
  const pageCount = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const safePage = Math.max(0, Math.min(pageCount - 1, page));
  const pageEntries = entries.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const description = pageEntries
    .map((item) => `\`$${item.name}\` — ${item.description}`)
    .join("\n");

  const embed = new EmbedBuilder()
    .setColor(CATEGORY_STYLES[selected]?.color ?? 0x6c83f2)
    .setTitle(`${CATEGORY_EMOJI[selected] ?? "✨"} ${selected} commands`)
    .setDescription(description || "No commands in this category yet.")
    .setFooter({
      text: `${commandCatalog.length} commands • Page ${safePage + 1} of ${pageCount} • Select a category below`
    });

  const categorySelect = new StringSelectMenuBuilder()
    .setCustomId("help:category")
    .setPlaceholder("Choose a command category")
    .addOptions(commandCategories.map((name) => ({
      label: name,
      value: name,
      description: `${commandCatalog.filter((item) => item.category === name).length} commands`,
      emoji: { name: CATEGORY_EMOJI[name] ?? "✨" },
      default: name === selected
    })));

  const selectRow = new ActionRowBuilder().addComponents(categorySelect);
  const navigationRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`help:prev:${selected}:${safePage}`)
      .setLabel("Back")
      .setEmoji("⬅️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safePage === 0),
    new ButtonBuilder()
      .setCustomId(`help:next:${selected}:${safePage}`)
      .setLabel("Next")
      .setEmoji("➡️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safePage >= pageCount - 1),
    new ButtonBuilder()
      .setCustomId("ticket:open")
      .setLabel("Support")
      .setEmoji("🎟️")
      .setStyle(ButtonStyle.Success)
  );

  return { embeds: [embed], components: [selectRow, navigationRow] };
}