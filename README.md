# Discord Community Bot

A Discord bot with 251 prefix commands, interactive categorized help, moderation tools, utilities, games, a virtual-coin economy, community features, and private support tickets. Command replies use themed embeds with category colors and emoji accents.

## Run the bot

Use Node.js 20 or newer:

```sh
npm install
DISCORD_BOT_TOKEN=your-bot-token npm start
```

Keep the bot token private. For Replit, save it as a Secret named `DISCORD_BOT_TOKEN` instead of putting it in a file. In the Discord Developer Portal, enable **Message Content Intent**, then invite the bot to your server with only the permissions you need. The default command prefix is `$`; set `BOT_PREFIX` to use a different one.

Run the test suite with `npm test`.

## Explore commands

Use `$help` to browse the interactive command menu by category. It lists every command and includes buttons to switch categories and pages.

- `$progress 35 80` — make an emoji progress bar.
- `$randomcolor` or `$randomcolor #4F46E5` — generate or preview a color.
- `$snowflake 123456789012345678` — show when a Discord ID was created.
- `$serveremojis` — browse a server's custom emoji.
- `$embedsay Maintenance | The server will be updated at 8 PM.` — post an announcement; Manage Messages permission is required.
- `$daily`, `$work`, `$bal`, and `$lb` — earn coins and check a wallet or leaderboard.
- `$pay @member 25`, `$shop`, and `$buy coffee` — send coins or buy emoji collectibles.
- `$slot` or `$slots 50` — play using virtual coins, with no real-money purchases or withdrawals.
- `$sue @member` and the other court commands are fictional roleplay, not real notices or legal advice.

## Permissions

For basic commands and the help menu, the bot needs View Channels, Send Messages, Embed Links, and Read Message History. Add Manage Channels for private tickets and ticket tools; Add Reactions for polls; and Manage Messages for `$say`, `$embedsay`, and applicable moderation commands. Other moderation commands need their corresponding Discord permissions. Role hierarchy still applies.

## Notes

- `$remind` reminders live in memory and are cleared if the bot restarts.
- `$warn` sends a direct message; it does not keep a persistent warning log.
- `$tickettranscript` exports up to 100 recent messages to the private ticket channel.
- Coin balances, cooldowns, and shop inventory persist in `.data/economy.json`, scoped by server. This file is ignored by Git; set `BOT_DATA_DIR` to store it elsewhere.
- Virtual coins have no cash value. The file-based wallet is intended for a single bot process, not multiple replicas writing to one file.
- Courtroom commands are jokes only; they do not provide legal advice or create real legal notices.
- Prefix commands require Message Content Intent to be enabled in the Developer Portal.