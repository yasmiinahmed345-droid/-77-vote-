require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Collection,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const { getActiveVote, saveActiveVote, getAllGuildsWithActiveVote } = require('./storage');
const { buildVoteEmbed, buildButtons, updateVoteMessage, LETTER_LABELS } = require('./voteUtils');

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('Missing DISCORD_TOKEN environment variable.');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

// ─── Global error handlers ────────────────────────────────────────────────────
client.on('error', (err) => console.error('[Discord Client Error]', err.message));
process.on('unhandledRejection', (reason) => console.error('[Unhandled Rejection]', reason?.message ?? reason));
process.on('uncaughtException', (err) => console.error('[Uncaught Exception]', err.message));

// ─── Load commands ────────────────────────────────────────────────────────────
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command.data && command.execute) {
    client.commands.set(command.data.name, command);
  }
}

// ─── Vote expiry checker — runs for ALL guilds ────────────────────────────────
async function checkVoteExpiry() {
  const activeGuilds = getAllGuildsWithActiveVote();

  for (const { guildId, vote } of activeGuilds) {
    if (Date.now() < vote.endTime) continue;

    vote.ended = true;
    saveActiveVote(guildId, vote);

    try {
      const channel = await client.channels.fetch(vote.channelId);
      const message = await channel.messages.fetch(vote.messageId);

      await message.edit({
        embeds: [buildVoteEmbed(vote, true)],
        components: buildButtons(vote, true),
      });

      const counts = vote.answers.map((_, i) => {
        let total = 0;
        for (const [userId, voter] of Object.entries(vote.voters)) {
          if (voter.answerIndex === i) {
            const weight = vote.voteWeights?.[userId] !== undefined ? vote.voteWeights[userId] : 1;
            total += weight;
          }
        }
        return total;
      });

      const grandTotal = counts.reduce((a, b) => a + b, 0);
      const maxCount = Math.max(...counts);
      const winnerIndex = counts.findIndex((c) => c === maxCount);

      const finalResultLines = vote.answers
        .map((ans, i) => {
          const isWinner = counts[i] === maxCount && maxCount > 0;
          return `${LETTER_LABELS[i]}. ${ans} — **${counts[i]}** Votes ${isWinner ? '✅' : ''}`;
        })
        .join('\n');

      const finalEmbed = new EmbedBuilder()
        .setTitle('🏆 Vote Ended')
        .setColor(0xf39c12)
        .addFields(
          { name: '🥇 Winner', value: `**${vote.answers[winnerIndex]}**` },
          { name: '🗳️ Total Votes', value: String(grandTotal), inline: true },
          { name: '📊 Final Results', value: finalResultLines },
        )
        .setTimestamp();

      await channel.send({ embeds: [finalEmbed] });
    } catch (err) {
      console.error(`[Vote Expiry Error] Guild ${guildId}:`, err.message);
    }
  }
}

setInterval(checkVoteExpiry, 30_000);

// ─── Ready ────────────────────────────────────────────────────────────────────
client.once('clientReady', () => {
  console.log(`✅ Bot is online as ${client.user.tag}`);
  checkVoteExpiry();
});

// ─── Interactions ─────────────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  // ── Slash commands ──────────────────────────────────────────────────────────
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(`[Command Error] /${interaction.commandName}:`, err.message);
      const msg = { content: '❌ Error ayaa dhacay. Dib u isku day.', flags: MessageFlags.Ephemeral };
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(msg);
        } else {
          await interaction.reply(msg);
        }
      } catch (_) {}
    }
    return;
  }

  // ── Button interactions ─────────────────────────────────────────────────────
  if (interaction.isButton()) {
    const { customId, user, guildId } = interaction;
    if (!customId.startsWith('vote_')) return;

    // Defer immediately within 3 seconds
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    } catch {
      return;
    }

    try {
      const answerIndex = parseInt(customId.replace('vote_', ''), 10);

      if (!guildId) {
        return interaction.editReply({ content: '❌ Server gudihiis kaliya waa la isticmaali karaa.' });
      }

      const vote = getActiveVote(guildId);
      if (!vote || vote.ended) {
        return interaction.editReply({ content: '❌ Server-kan active vote ma jirto.' });
      }

      if (Date.now() >= vote.endTime) {
        vote.ended = true;
        saveActiveVote(guildId, vote);
        await updateVoteMessage(client, vote, true).catch(() => {});
        return interaction.editReply({ content: '⏰ Vote-ku waqtigiisu wuu dhamaaday. Ma codeyn kartid.' });
      }

      if (isNaN(answerIndex) || answerIndex < 0 || answerIndex >= vote.answers.length) {
        return interaction.editReply({ content: '❌ Answer-ka jiro ma aha.' });
      }

      const prevVote = vote.voters[user.id];
      const letter = LETTER_LABELS[answerIndex];
      const answer = vote.answers[answerIndex];

      if (prevVote && prevVote.answerIndex === answerIndex) {
        return interaction.editReply({ content: `ℹ️ Hore ayaad ugu codaysay **${letter}. ${answer}**.` });
      }

      const previousInfo = prevVote
        ? `\n*(Hore: **${LETTER_LABELS[prevVote.answerIndex]}. ${vote.answers[prevVote.answerIndex]}** → Cusub: **${letter}. ${answer}**)*`
        : '';

      vote.voters[user.id] = {
        answerIndex,
        username: user.username,
        timestamp: Date.now(),
      };

      saveActiveVote(guildId, vote);
      await updateVoteMessage(client, vote, false).catch(() => {});

      await interaction.editReply({
        content: `☑️ Codkaagu waa **${letter}. ${answer}** la diiwaan geliyey!${previousInfo}`,
      });
    } catch (err) {
      console.error('[Button Error]', err.message);
      try {
        await interaction.editReply({ content: '❌ Error ayaa dhacay. Dib u isku day.' });
      } catch (_) {}
    }
  }
});

client.login(token);
