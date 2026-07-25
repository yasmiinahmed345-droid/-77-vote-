const { SlashCommandBuilder } = require('discord.js');
const { getActiveVote, saveActiveVote } = require('../storage');
const { updateVoteMessage, LETTER_LABELS } = require('../voteUtils');

const ADMIN_IDS = ['1307382619696267294', '725076744251637760'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setvotes')
    .setDescription('🔧 Set vote count for a user (Admin only)')
    .addUserOption((o) =>
      o.setName('user').setDescription('👤 The user').setRequired(true),
    )
    .addIntegerOption((o) =>
      o
        .setName('votes')
        .setDescription('🗳️ Number of votes')
        .setRequired(true)
        .setMinValue(0),
    ),

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

    if (vote.ended) {
      return interaction.reply({ content: '❌ Vote-ku wuu dhamaaday.', flags: 64 });
    }

    const targetUser = interaction.options.getUser('user');
    const votes = interaction.options.getInteger('votes');

    if (!vote.voters[targetUser.id]) {
      return interaction.reply({
        content: `❌ **${targetUser.username}** wali ma codayn.`,
        flags: 64,
      });
    }

    if (!vote.voteWeights) vote.voteWeights = {};
    const oldWeight = vote.voteWeights[targetUser.id] !== undefined ? vote.voteWeights[targetUser.id] : 1;
    vote.voteWeights[targetUser.id] = votes;
    saveActiveVote(interaction.guildId, vote);

    const voterInfo = vote.voters[targetUser.id];
    const letter = LETTER_LABELS[voterInfo.answerIndex];
    const answer = vote.answers[voterInfo.answerIndex];

    await interaction.reply({
      content: `✅ **${targetUser.username}** codkiisa **${letter}. ${answer}** waxaa loo beddelay **${oldWeight}** → **${votes}** Votes.`,
      flags: 64,
    });

    await updateVoteMessage(interaction.client, vote).catch(() => {});
  },
};
