const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getActiveVote, saveActiveVote } = require('../storage');
const { buildVoteEmbed, buildButtons, LETTER_LABELS } = require('../voteUtils');

const ADMIN_IDS = ['1307382619696267294', '725076744251637760'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('joojivote')
    .setDescription('🛑 Vote-ka socda jooji (Admin only)'),

  async execute(interaction) {
    if (!ADMIN_IDS.includes(interaction.user.id)) {
      return interaction.reply({
        content: '❌ Adigu permission kuma lihid command-kan isticmaalka.',
        flags: 64,
      });
    }

    if (!interaction.guildId) {
      return interaction.reply({
        content: '❌ Server gudihiisa kaliya waa la isticmaali karaa.',
        flags: 64,
      });
    }

    const vote = getActiveVote(interaction.guildId);
    if (!vote) {
      return interaction.reply({ content: '❌ Server-kan active vote ma jirto.', flags: 64 });
    }

    if (vote.ended) {
      return interaction.reply({ content: '❌ Vote-ku horay ayuu u dhamaaday.', flags: 64 });
    }

    // Mark as ended
    vote.ended = true;
    saveActiveVote(interaction.guildId, vote);

    // Disable buttons and update the original vote embed
    try {
      const channel = await interaction.client.channels.fetch(vote.channelId);
      const message = await channel.messages.fetch(vote.messageId);
      await message.edit({
        embeds: [buildVoteEmbed(vote, true)],
        components: buildButtons(vote, true),
      });
    } catch (err) {
      console.error('[joojivote] Failed to edit vote message:', err.message);
    }

    // Compute final results
    const counts = vote.answers.map((_, i) => {
      let total = 0;
      for (const [userId, voter] of Object.entries(vote.voters)) {
        if (voter.answerIndex === i) {
          const weight =
            vote.voteWeights?.[userId] !== undefined ? vote.voteWeights[userId] : 1;
          total += weight;
        }
      }
      return total;
    });

    const grandTotal = counts.reduce((a, b) => a + b, 0);
    const maxCount = Math.max(0, ...counts);
    const winnerIndex = counts.findIndex((c) => c === maxCount);

    const finalResultLines = vote.answers
      .map((ans, i) => {
        const isWinner = maxCount > 0 && counts[i] === maxCount;
        return `${LETTER_LABELS[i]}. ${ans} — **${counts[i]}** Votes ${isWinner ? '✅' : ''}`;
      })
      .join('\n');

    const finalEmbed = new EmbedBuilder()
      .setTitle('🛑 Vote La Joojiyay')
      .setColor(0xe74c3c)
      .addFields(
        {
          name: '👮 La joojiyay',
          value: `<@${interaction.user.id}>`,
          inline: true,
        },
        {
          name: '🗳️ Vote Title',
          value: vote.title,
          inline: true,
        },
        {
          name: '🥇 Winner',
          value:
            grandTotal > 0
              ? `**${vote.answers[winnerIndex]}** with **${maxCount}** Votes`
              : 'Codi ma jiro',
        },
        { name: '🗳️ Total Votes', value: String(grandTotal), inline: true },
        { name: '📊 Final Results', value: finalResultLines || 'Codi ma jiro' },
      )
      .setTimestamp();

    // Reply to the command and also send results in the vote channel
    await interaction.reply({ content: '✅ Vote-ka si guul leh ayaa loo joojiyay.', flags: 64 });

    try {
      const channel = await interaction.client.channels.fetch(vote.channelId);
      await channel.send({ embeds: [finalEmbed] });
    } catch (err) {
      console.error('[joojivote] Failed to send final embed:', err.message);
    }
  },
};
