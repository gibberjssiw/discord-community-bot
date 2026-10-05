const commands = [];
const seen = new Set();

function add(name, category, description, kind = "reply", value = "") {
  if (seen.has(name)) throw new Error(`Duplicate command: ${name}`);
  seen.add(name);
  commands.push(Object.freeze({ name, category, description, kind, value }));
}

const basics = [
  ["help", "Browse every command by category."],
  ["ping", "Check whether the bot is responding."],
  ["about", "About this server bot."],
  ["uptime", "How long the bot has been online."],
  ["invite", "Get the bot's invite link."],
  ["serverinfo", "Show details about this server."],
  ["profile", "Show a member's profile."],
  ["avatar", "Show a member's avatar."],
  ["membercount", "Show the current member count."],
  ["rolelist", "List this server's roles."],
  ["botstatus", "Show the bot's current status."],
  ["report", "Send a private report to the server team."]
];
for (const [name, description] of basics) {
  add(name, "Getting Started", description, name === "report" ? "report" : "core");
}

const utilityCommands = [
  ["calc", "Evaluate a basic arithmetic expression."],
  ["roll", "Roll dice using NdM notation, such as 2d6."],
  ["choose", "Choose one option separated by commas or |."],
  ["coinflip", "Flip a coin."],
  ["randomnumber", "Pick a number between two limits."],
  ["reverse", "Reverse text."],
  ["uppercase", "Convert text to uppercase."],
  ["lowercase", "Convert text to lowercase."],
  ["titlecase", "Capitalize the words in a phrase."],
  ["wordcount", "Count words in text."],
  ["charcount", "Count characters in text."],
  ["encode64", "Encode text as Base64."],
  ["decode64", "Decode Base64 text."],
  ["urlencode", "Encode text for a URL."],
  ["urldecode", "Decode URL-encoded text."],
  ["timestamp", "Format a date as Discord timestamps."],
  ["timezone", "Show the current time in an IANA timezone."],
  ["remind", "Set a reminder, up to 24 hours from now."],
  ["fliptext", "Flip text using Unicode characters."],
  ["palindrome", "Check whether text reads the same backwards."],
  ["initials", "Get the initials of a phrase."],
  ["slugify", "Turn text into a URL-friendly slug."],
  ["dedupe", "Remove repeated comma-separated values."],
  ["sort", "Sort words or numbers."],
  ["shuffle", "Shuffle a list of comma-separated items."],
  ["add", "Add numbers."],
  ["subtract", "Subtract numbers from the first value."],
  ["multiply", "Multiply numbers."],
  ["divide", "Divide the first number by the second."],
  ["percentage", "Find a percentage of a number."],
  ["progress", "Show progress toward a goal as an emoji bar."],
  ["randomcolor", "Generate a color or preview a six-digit hex code."],
  ["snowflake", "Convert a Discord ID into its creation date."],
  ["square", "Square a number."],
  ["squareroot", "Find a square root."],
  ["average", "Calculate the arithmetic mean."],
  ["median", "Find the median of a number list."],
  ["factorial", "Calculate a small non-negative factorial."],
  ["prime", "Check whether an integer is prime."],
  ["binary", "Convert a decimal integer to binary."],
  ["hexadecimal", "Convert a decimal integer to hexadecimal."],
  ["morse", "Encode text as Morse code."],
  ["roman", "Convert an integer to Roman numerals."],
  ["countdown", "Count down to a date and time."],
  ["formatnumber", "Format a number with separators."],
  ["compact", "Format a number in compact notation."],
  ["ordinal", "Convert a number to an ordinal."],
  ["clamp", "Clamp a value between a minimum and maximum."],
  ["converttemp", "Convert between Celsius and Fahrenheit."],
  ["convertlength", "Convert common metric and imperial lengths."],
  ["convertweight", "Convert kilograms and pounds."],
  ["morsedecode", "Decode a Morse-code message."],
  ["split", "Split text into numbered lines."],
  ["join", "Join words with a chosen separator."]
];
for (const [name, description] of utilityCommands) {
  add(name, "Utility", description, "utility", name);
}

const infoReplies = [
  ["channelinfo", "Show details about the current channel.", "Channel information is available for text channels where I can view the channel."],
  ["roleinfo", "Look up a role by name or mention.", "Use a role name or role mention, for example: `$roleinfo Members`."],
  ["permissions", "Check your permissions in this server.", "Your server permissions are the capabilities Discord grants to your account and roles."],
  ["joined", "Show when a member joined this server.", "Mention a member to see their server join date."],
  ["created", "Show when a Discord account was created.", "Mention a member or provide a user ID to check the account creation date."],
  ["servericon", "Show this server's icon.", "The server icon is set by the server's administrators."],
  ["serverbanner", "Show this server's banner.", "A server banner appears here when the server has one configured."],
  ["serveremojis", "Browse the custom emojis available in this server.", "This server has no custom emojis yet."],
  ["toproles", "Show the highest roles in this server.", "Role order is controlled in Server Settings → Roles."],
  ["members", "Explain member-list visibility.", "Discord's member list follows your server access and privacy settings."],
  ["channeltopic", "Set or view the channel topic.", "Use `$channeltopic <new topic>` in a channel you can manage, or `$channeltopic view`."],
  ["rules", "Point to the server rules.", "Please check the server's rules channel and follow the moderation team's guidance."],
  ["status", "Explain Discord status indicators.", "Online, Idle, Do Not Disturb, and Invisible are Discord presence settings."],
  ["credits", "Show bot credits.", "Built for this server with Discord's official bot API."],
  ["features", "Summarize the bot's features.", "Browse `$help` by category for utilities, games, moderation, community tools, and tickets."],
  ["links", "Show this server's configured links.", "No server links have been configured in the bot yet."],
  ["faq", "Show common Discord answers.", "For account, safety, and billing questions, use Discord's official Help Center."],
  ["etiquette", "Share a short community etiquette guide.", "Be clear, respect channel topics, avoid pinging people unnecessarily, and follow the server rules."],
  ["privacy", "Explain privacy basics.", "Never share passwords or private account details in public channels. Review Discord's privacy settings regularly."],
  ["accessibility", "Share accessibility tips.", "Use clear text, descriptive link names, and avoid relying on color alone to communicate."],
  ["safety", "Share account-safety guidance.", "Use a unique password, enable two-factor authentication, and never scan a QR code you did not request."],
  ["aboutdiscord", "Explain what Discord is.", "Discord is a voice, video, and text communication service organized around servers and channels."],
  ["discordtips", "Share a Discord navigation tip.", "Use the channel list to find the right place for a conversation; check pinned messages for local guidance."],
  ["emojiinfo", "Explain custom server emoji.", "Custom emoji availability depends on server settings and your Discord account."],
  ["inviteinfo", "Explain server invite links.", "Only use invite links from people or communities you trust."],
  ["profilehelp", "Explain profile visibility.", "Your profile details and activity visibility depend on your account privacy settings."]
];
for (const [name, description, value] of infoReplies) {
  add(name, "Server Info", description, name === "channelinfo" || name === "roleinfo" || name === "permissions" || name === "joined" || name === "created" || name === "servericon" || name === "serverbanner" || name === "serveremojis" || name === "toproles" || name === "channeltopic" ? "info" : "reply", value);
}

const moderationCommands = [
  ["timeout", "Temporarily prevent a member from messaging."],
  ["untimeout", "Remove a member's timeout."],
  ["kick", "Remove a member from the server."],
  ["ban", "Ban a member from the server."],
  ["unban", "Remove a ban by user ID."],
  ["purge", "Delete recent messages from this channel."],
  ["slowmode", "Set this channel's slowmode in seconds."],
  ["lock", "Prevent @everyone from sending messages here."],
  ["unlock", "Restore @everyone's ability to send messages here."],
  ["nickname", "Change a member's server nickname."],
  ["addrole", "Give a member a role."],
  ["removerole", "Remove a role from a member."],
  ["banlist", "List banned accounts."],
  ["warn", "Send a member a direct warning."],
  ["pin", "Pin a message by its message ID."],
  ["unpin", "Unpin a message by its message ID."],
  ["say", "Repeat a message without pinging anyone (Manage Messages required)."],
  ["embedsay", "Post a formatted announcement embed (Manage Messages required)."],
  ["modhelp", "Show moderation command usage."]
];
for (const [name, description] of moderationCommands) {
  add(name, "Moderation", description, "moderation", name);
}

const gameReplies = [
  ["guess", "Start a number-guessing round or submit a guess.", "guess"],
  ["trivia", "Get a trivia question.", "trivia"],
  ["riddle", "Get a riddle with its answer hidden.", "riddle"],
  ["dice", "Roll one or more six-sided dice.", "dice"],
  ["d20", "Roll a twenty-sided die.", "d20"],
  ["d100", "Roll a percentile die.", "d100"],
  ["slots", "Play the coin-powered slot machine.", "slots"],
  ["slot", "Quick alias for `$slots`.", "slot"],
  ["roulette", "Get a random roulette-style outcome.", "roulette"],
  ["rps", "Play rock-paper-scissors against the bot.", "rps"],
  ["coinrace", "Simulate a race to three heads.", "coinrace"],
  ["mathrace", "Get a quick arithmetic challenge.", "mathrace"],
  ["scramble", "Unscramble a word.", "scramble"],
  ["wordchain", "Get a word to continue in a word-chain game.", "wordchain"],
  ["highlow", "Guess whether the next number is higher or lower.", "highlow"],
  ["blackjack", "Draw a blackjack hand against the bot.", "blackjack"],
  ["duel", "Roll a friendly, fictional duel outcome.", "duel"],
  ["anagram", "Get a short anagram challenge.", "anagram"],
  ["hangman", "Start a short hangman challenge.", "hangman"],
  ["oddoneout", "Find the item that does not belong.", "oddoneout"],
  ["wouldyourather", "Get a would-you-rather prompt.", "wouldyourather"],
  ["numberfact", "Get a quick number fact.", "numberfact"],
  ["quiz", "Get a general-knowledge quiz question.", "quiz"],
  ["animalguess", "Guess an animal from a clue.", "animalguess"],
  ["emojiquiz", "Guess a phrase from emoji clues.", "emojiquiz"],
  ["moviequiz", "Get a movie trivia question.", "moviequiz"],
  ["geographyquiz", "Get a geography trivia question.", "geographyquiz"],
  ["historyquiz", "Get a history trivia question.", "historyquiz"],
  ["sciencequiz", "Get a science trivia question.", "sciencequiz"],
  ["wordle", "Start a five-letter word challenge.", "wordle"],
  ["pickapath", "Choose a lighthearted story path.", "pickapath"]
];
for (const [name, description, value] of gameReplies) {
  add(name, "Games", description, "game", value);
}

const funReplies = [
  ["joke", "Get a short joke.", "I tried to write a joke about UDP, but I'm not sure you got it."],
  ["roast", "Get a gentle, opt-in roast.", "You have the confidence of someone who clicked `$help` and still asked what I do."],
  ["compliment", "Get a friendly compliment.", "You make this community better just by showing up."],
  ["fortune", "Get a playful fortune.", "A small task you finish today will make tomorrow easier."],
  ["quote", "Get a short quote.", "“Great things are done by a series of small things brought together.” — Vincent van Gogh"],
  ["advice", "Get a practical bit of advice.", "If it takes less than two minutes, consider doing it now."],
  ["cat", "Get a cat fact.", "Cats can make more than 100 different vocal sounds."],
  ["dog", "Get a dog fact.", "Dogs have a unique nose print, much like a human fingerprint."],
  ["fox", "Get a fox fact.", "A fox uses its whiskers to help navigate tight spaces."],
  ["duck", "Get a duck fact.", "Ducks have waterproof feathers thanks to oil they spread while preening."],
  ["panda", "Get a panda fact.", "Giant pandas spend many hours a day eating bamboo."],
  ["otter", "Get an otter fact.", "Sea otters have the densest fur of any mammal."],
  ["capybara", "Get a capybara fact.", "Capybaras are the world's largest living rodents."],
  ["shark", "Get a shark fact.", "Sharks have been around for hundreds of millions of years."],
  ["owl", "Get an owl fact.", "Many owls can rotate their heads about 270 degrees."],
  ["dragon", "Get a fantasy dragon fact.", "In many stories, dragons guard more than treasure: they guard a boundary."],
  ["unicorn", "Get a unicorn fact.", "In heraldry, the unicorn often represents strength and purity."],
  ["coffee", "Get a coffee thought.", "Coffee first, big decisions second."],
  ["tea", "Get a tea thought.", "A warm cup and a quiet minute can be a good reset."],
  ["pizza", "Get a pizza opinion.", "The best pizza topping is the one everyone at the table actually likes."],
  ["weatherjoke", "Get a weather joke.", "I wanted to tell a cloud joke, but it might go over your head."],
  ["proverb", "Get a proverb.", "A journey of a thousand miles begins with a single step."],
  ["haiku", "Get a short haiku.", "Soft rain on the roof / A quiet page turns slowly / Evening settles in"],
  ["poem", "Get a tiny poem.", "A little light / in a window at night / says someone is home."],
  ["rhyme", "Get a quick rhyme.", "Bright ideas take flight when the timing feels right."],
  ["pun", "Get a pun.", "I used to be afraid of hurdles, but I got over it."],
  ["dadjoke", "Get a dad joke.", "Why did the bicycle fall over? It was two-tired."],
  ["knockknock", "Get a knock-knock joke.", "Knock knock. Who's there? A little bot. A little bot who? A little bot of laughter."],
  ["meme", "Get a text-only meme caption.", "Me: I'll just check one channel. Also me: reading `$help` 10 minutes later."],
  ["ship", "Get a playful ship-name generator.", "Today's totally fictional ship: Pixel + Noodle = Poodle."],
  ["rate", "Rate a phrase from 1 to 10.", "My highly scientific rating system is calibrated entirely in vibes."],
  ["vibe", "Get a random vibe.", "Current vibe: focused, with a side of snack."],
  ["compatibility", "Get a playful compatibility score.", "Today's compatibility score is 87%: excellent teamwork, mild debate over snacks."],
  ["mood", "Get a mood check-in prompt.", "Quick check-in: what is one thing that would make the next hour better?"],
  ["motivation", "Get a short motivational message.", "Progress counts even when it is quieter than you expected."],
  ["goodmorning", "Say good morning.", "Good morning. Hope something goes your way today."],
  ["goodnight", "Say good night.", "Good night. You can pick this back up tomorrow."],
  ["hello", "Say hello.", "Hey there. Glad you stopped by."],
  ["bye", "Say goodbye.", "Take care. See you around."],
  ["celebrate", "Celebrate a small win.", "That counts as a win. Take a second to enjoy it."],
  ["facepalm", "Get a text facepalm.", "The plan was flawless. The execution has requested a meeting."],
  ["shrug", "Get a shrug.", "¯\\\\_(ツ)_/¯"],
  ["tableflip", "Get a harmless text table flip.", "(╯°□°)╯︵ ┻━┻"],
  ["magic8ball", "Ask a yes-or-no question.", "magic8ball"]
];
for (const [name, description, value] of funReplies) {
  add(name, "Fun", description, "fun", value);
}

const lawCommands = [
  ["sue", "Start a fictional, silly courtroom case; not legal advice."],
  ["lawyer", "Assign a pretend lawyer for a joke dispute."],
  ["court", "Open an imaginary courtroom for friendly roleplay."],
  ["verdict", "Get a playful, non-binding court verdict."],
  ["objection", "Raise a lighthearted mock-court objection."],
  ["subpoena", "Send a pretend courtroom summons; it has no legal effect."],
  ["bail", "Check a fictional bail amount in marshmallows."],
  ["jury", "Ask a jury of imaginary animals for a silly verdict."]
];
for (const [name, description] of lawCommands) {
  add(name, "Fun", description, "fun", name);
}

const communityReplies = [
  ["welcome", "Welcome a new member.", "Welcome in, {user}! Take a look at the server rules and make yourself at home."],
  ["goodbye", "Send a friendly goodbye.", "Take care, {user}. Hope to see you again soon."],
  ["thanks", "Say thanks to a member.", "Thanks, {user}. That was kind of you."],
  ["highfive", "Give a member a high-five.", "High five, {user}!"],
  ["hug", "Send a friendly virtual hug.", "A friendly virtual hug for {user}."],
  ["pat", "Send a friendly head-pat.", "A gentle, friendly pat for {user}."],
  ["wave", "Wave to a member.", "Hey {user}, welcome!"],
  ["fistbump", "Give a member a fist bump.", "Fist bump, {user}."],
  ["clap", "Applaud a member.", "A round of applause for {user}."],
  ["cheer", "Cheer on a member.", "You've got this, {user}!"],
  ["team", "Generate a two-team split from mentions.", "Mention at least two people and I'll split them into teams."],
  ["poll", "Create a simple reaction poll.", "Usage: `$poll question | option one | option two`. Polls use numbered reactions."],
  ["suggestion", "Share a suggestion with staff.", "Use the server's feedback channel if one is configured; otherwise mention the staff team."],
  ["feedback", "Share feedback guidance.", "Be specific about what happened and what outcome would help."],
  ["quoteoftheday", "Get a quote for the day.", "“It always seems impossible until it's done.” — Nelson Mandela"],
  ["prompt", "Get a creative prompt.", "Write about a place you remember differently each time you visit."],
  ["icebreaker", "Get a conversation icebreaker.", "What small thing are you looking forward to this week?"],
  ["topicstarter", "Get a topic starter.", "What is a hobby you would recommend to a beginner?"],
  ["introduce", "Get a member introduction template.", "Try: name or nickname, interests, and one thing you'd like to find here."],
  ["checkin", "Start a low-pressure check-in.", "How are you doing today: good, okay, or could use a hand?"],
  ["weeklygoal", "Set a small weekly goal.", "Pick one goal that is specific, realistic, and easy to check off."],
  ["challenge", "Get a friendly community challenge.", "Share one useful tip you learned this week."],
  ["gratitude", "Get a gratitude prompt.", "Name one person, place, or small thing you appreciated today."],
  ["shoutout", "Give a public shout-out.", "Mention someone and add a sentence about what they did well."],
  ["kudos", "Send kudos to a member.", "Kudos to {user} for being part of the community."],
  ["mytime", "Show your local time based on your profile settings.", "I can't infer your timezone. Use `$timezone Europe/Bucharest` or another IANA timezone."],
  ["serverguide", "Share a quick server-navigation guide.", "Start with `$help`, check pinned posts, and use the channel whose topic matches your question."],
  ["support", "Show the support options.", "Use the ticket button in `$help` to open a private support channel."],
  ["pollhelp", "Show poll syntax.", "Usage: `$poll question | option one | option two` (up to 10 choices)."],
  ["communitytip", "Get a community tip.", "Ask one clear question at a time; it makes it easier for people to help."],
  ["question", "Ask a friendly question.", "What is something you learned recently that surprised you?"],
  ["dailygoal", "Pick a small goal for today.", "Choose one task you can finish in 15 minutes."],
  ["wins", "Share a small-win prompt.", "What is one thing you got done today, even if it was small?"],
  ["reset", "Get a short reset exercise.", "Unclench your jaw, lower your shoulders, and take one slow breath."],
  ["encourage", "Encourage a member.", "Keep going, {user}. You don't have to solve everything at once."]
];
for (const [name, description, value] of communityReplies) {
  add(name, "Community", description, name === "poll" ? "poll" : "community", value);
}

const economyCommands = [
  ["balance", "Show your coin wallet; `$bal` is the short alias."],
  ["bal", "Quick alias for `$balance`."],
  ["daily", "Claim your server's daily coin reward."],
  ["work", "Earn coins with a job; cooldown applies."],
  ["pay", "Send coins to a server member."],
  ["leaderboard", "Show the richest wallets; `$lb` is the short alias."],
  ["lb", "Quick alias for `$leaderboard`."],
  ["shop", "Browse emoji collectibles you can buy with coins."],
  ["buy", "Buy a collectible by its short item name."],
  ["inventory", "Show the collectibles in your wallet; `$bag` is the short alias."],
  ["bag", "Quick alias for `$inventory`."],
  ["currency", "Explain the bot's virtual coins and cooldowns."]
];
for (const [name, description] of economyCommands) {
  add(name, "Economy", description, "economy", name);
}

const ticketCommands = [
  ["ticket", "Create a private support ticket."],
  ["ticketclose", "Request confirmation before closing the current ticket."],
  ["ticketadd", "Add a member to the current ticket."],
  ["ticketremove", "Remove a member from the current ticket."],
  ["ticketrename", "Rename the current ticket."],
  ["ticketclaim", "Mark the current ticket as claimed by you."],
  ["tickettranscript", "Export recent ticket messages as a text file."],
  ["ticketstats", "Count open tickets in this server."],
  ["ticketpanel", "Post a button for opening a private ticket."],
  ["ticketguide", "Show the ticket workflow."]
];
for (const [name, description] of ticketCommands) {
  add(name, "Tickets", description, "ticket", name);
}

export const commandCatalog = Object.freeze(commands);
export const commandByName = new Map(commandCatalog.map((command) => [command.name, command]));
export const commandCategories = Object.freeze([...new Set(commandCatalog.map((command) => command.category))]);