import assert from "node:assert/strict";
import test from "node:test";
import { commandCatalog, commandCategories } from "../catalog.js";
import { createHelpPayload } from "../help.js";

test("the bot ships more than 200 distinct commands across categories", () => {
  assert.ok(commandCatalog.length >= 200, `Expected 200+ commands, got ${commandCatalog.length}`);
  assert.equal(new Set(commandCatalog.map((command) => command.name)).size, commandCatalog.length);
  assert.ok(commandCategories.length >= 6);
});

test("the help menu exposes every command across its category pages", () => {
  const listed = [];
  for (const category of commandCategories) {
    for (let page = 0; page < Math.ceil(commandCatalog.filter((command) => command.category === category).length / 18); page++) {
      const payload = createHelpPayload(category, page);
      listed.push(...payload.embeds[0].data.description
        .split("\n")
        .map((line) => /^\`\$(\w+)\` —/.exec(line)?.[1])
        .filter(Boolean));
    }
  }
  assert.deepEqual([...listed].sort(), commandCatalog.map((command) => command.name).sort());
});

test("the help menu gives categories and navigation buttons emoji icons", () => {
  const payload = createHelpPayload("Economy", 0);
  const rows = payload.components.map((row) => row.toJSON());
  const options = rows[0].components[0].options;
  assert.equal(options.find((option) => option.value === "Economy").emoji.name, "🪙");
  assert.equal(rows[1].components[0].emoji.name, "⬅️");
  assert.equal(rows[1].components[1].emoji.name, "➡️");
  assert.equal(rows[1].components[2].emoji.name, "🎟️");
});