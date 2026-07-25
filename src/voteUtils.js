const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

const LETTER_LABELS = ['A', 'B', 'C', 'D'];

function getVoteCounts(vote) {
  const counts = new Array(vote.answers.length).fill(0);
  for (const [userId, voter] of Object.entries(vote.voters)) {
    const weight =
      vote.voteWeights && vote.voteWeights[userId] !== undefined
        ? vote.voteWeights[userId]
        : 1;
    counts[voter.answerIndex] += weight;
  }
  return counts;
}

function buildProgressBar(count, total, length = 12) {
  if (total === 0) return '`' + '░'.repeat(length) + '` 0%';
  const filled = Math.round((count / total) * length);
  const pct = Math.round((count / total) * 100);
  return '`' + '█'.repeat(filled) + '░'.repeat(length - filled) + '`' + ` ${pct}%`;
}

function buildVoteEmbed(vote, ended = false) {
  const counts = getVoteCounts(vote);
  const total = counts.reduce((a, b) => a + b, 0);
  const endTimeSec = Math.floor(vote.endTime / 1000);

  const embed = new EmbedBuilder().setColor(ended ? 0xf39c12 : 0x5865f2);

  if (ended) {
    embed.setTitle(`🏆 Vote Ended — ${vote.title}`);
  } else {
    embed.setTitle(`🗳️ ${vote.title}`);
    embed.addFields(
      { name: '⏳ Ends', value: `<t:${endTimeSec}:R>`, inline: true },
      { name: '📅 Ends At', value: `<t:${endTimeSec}:F>`, inline: true },
    );
  }

  const maxCount = Math.max(...counts);
  const resultsLines = vote.answers
    .map((answer, i) => {
      const count = counts[i];
      const bar = buildProgressBar(count, total);
      const isWinner = ended && count === maxCount && maxCount > 0;
      return `**${LETTER_LABELS[i]}. ${answer}** — ${count} Votes ${isWinner ? '✅' : ''}\n${bar}`;
    })
    .join('\n\n');

  embed.addFields({ name: '📊 Current Votes', value: resultsLines || 'No votes yet.' });
  embed.addFields({ name: '👥 Total Votes', value: String(total), inline: true });

  if (ended) {
    const winnerIndex = counts.findIndex((c) => c === maxCount);
    embed.addFields({
      name: '🥇 Winner',
      value: `**${vote.answers[winnerIndex]}** with **${maxCount}** votes!`,
    });
  }

  embed.setTimestamp();
  return embed;
}

function buildButtons(vote, disabled = false) {
  const buttons = vote.answers.map((_, i) =>
    new ButtonBuilder()
      .setCustomId(`vote_${i}`)
      .setLabel(LETTER_LABELS[i])
      .setEmoji('☑️')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
  );
  return [new ActionRowBuilder().addComponents(buttons)];
}

async function updateVoteMessage(client, vote, ended = false) {
  try {
    const channel = await client.channels.fetch(vote.channelId);
    const message = await channel.messages.fetch(vote.messageId);
    const embed = buildVoteEmbed(vote, ended);
    const components = buildButtons(vote, ended);
    await message.edit({ embeds: [embed], components });
  } catch (err) {
    console.error('Failed to update vote message:', err.message);
  }
}

module.exports = { getVoteCounts, buildVoteEmbed, buildButtons, updateVoteMessage, LETTER_LABELS };
