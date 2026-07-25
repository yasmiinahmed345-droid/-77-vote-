const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getActiveVote } = require('../storage');
const { LETTER_LABELS } = require('../voteUtils');

const ADMIN_IDS = ['1307382619696267294', '725076744251637760'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('voteusers')
    .setDescription('📋 Show all voters with details (Admin only)'),

  async execute(interaction) {
    if (!ADMIN_IDS.includes(interaction.user.id)) {
      return interaction.reply({
        content: '❌ Adigu permission kuma lihid command-kan isticmaalka.',
        flags: 64,
      });
    }

    if (!interaction.guildId) {
      return interaction.reply({ content: '❌ Server gudihiisa kaliya waa la isticmaali karaa.', flags: 64 });
    }

    const vote = getActiveVote(interaction.guildId);
    if (!vote) {
      return interaction.reply({ content: '❌ Server-kan active vote ma jirto.', flags: 64 });
    }

    const voterEntries = Object.entries(vote.voters);
    if (voterEntries.length === 0) {
      return interaction.reply({ content: '📭 Wali qof ma codayn.', flags: 64 });
    }

    const lines = voterEntries.map(([userId, voter]) => {
      const letter = LETTER_LABELS[voter.answerIndex];
      const answer = vote.answers[voter.answerIndex];
      const time = `<t:${Math.floor(voter.timestamp / 1000)}:F>`;
      return `👤 <@${userId}> → 🗳️ **${letter}. ${answer}** — 🕒 ${time}`;
    });

    const PAGE_SIZE = 20;
    const page = lines.slice(0, PAGE_SIZE);
    const extra = voterEntries.length > PAGE_SIZE ? `\n…and ${voterEntries.length - PAGE_SIZE} more` : '';

    const embed = new EmbedBuilder()
      .setTitle('🗳️ Vote Voters — Full List')
      .setDescription(page.join('\n') + extra)
      .setColor(0x5865f2)
      .addFields(
        { name: '👥 Total Voters', value: String(voterEntries.length), inline: true },
        { name: '🗳️ Vote Title', value: vote.title, inline: true },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: 64 });
  },
};
