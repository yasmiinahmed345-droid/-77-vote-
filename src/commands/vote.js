const { SlashCommandBuilder } = require('discord.js');
const { getActiveVote, saveActiveVote } = require('../storage');
const { buildVoteEmbed, buildButtons } = require('../voteUtils');

const TIME_MAP = { '1h': 3600000, '12h': 43200000, '1d': 86400000, '7d': 604800000 };

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vote')
    .setDescription('Vote commands')
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('🗳️ Create a new vote')
        .addStringOption((o) =>
          o.setName('title').setDescription('🏆 Vote title').setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName('end_time')
            .setDescription('⏳ Duration: 1h, 12h, 1d, 7d')
            .setRequired(true)
            .addChoices(
              { name: '1 Hour', value: '1h' },
              { name: '12 Hours', value: '12h' },
              { name: '1 Day', value: '1d' },
              { name: '7 Days', value: '7d' },
            ),
        )
        .addStringOption((o) =>
          o.setName('answer1').setDescription('👥 Answer 1').setRequired(true),
        )
        .addStringOption((o) =>
          o.setName('answer2').setDescription('👥 Answer 2').setRequired(true),
        )
        .addStringOption((o) =>
          o.setName('answer3').setDescription('👥 Answer 3').setRequired(true),
        )
        .addStringOption((o) =>
          o.setName('answer4').setDescription('👥 Answer 4 (Optional)').setRequired(false),
        ),
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'create') {
      if (!interaction.guildId) {
        return interaction.reply({ content: '❌ Command-kan server gudihiisa kaliya waa la isticmaali karaa.', flags: 64 });
      }

      const existing = getActiveVote(interaction.guildId);
      if (existing && !existing.ended) {
        return interaction.reply({
          content: '❌ Server-kan waxaa jira vote socda. Dhamee ka hor intaadan cusub samayn.',
          flags: 64,
        });
      }

      const title = interaction.options.getString('title');
      const endTimeKey = interaction.options.getString('end_time');
      const duration = TIME_MAP[endTimeKey];

      const answers = [
        interaction.options.getString('answer1'),
        interaction.options.getString('answer2'),
        interaction.options.getString('answer3'),
      ];
      const a4 = interaction.options.getString('answer4');
      if (a4) answers.push(a4);

      const endTime = Date.now() + duration;

      const vote = {
        title,
        answers,
        endTime,
        voters: {},
        voteWeights: {},
        ended: false,
        messageId: null,
        channelId: null,
        guildId: interaction.guildId,
      };

      const embed = buildVoteEmbed(vote);
      const buttons = buildButtons(vote);

      await interaction.reply({ embeds: [embed], components: buttons });
      const msg = await interaction.fetchReply();

      vote.messageId = msg.id;
      vote.channelId = msg.channelId;
      saveActiveVote(interaction.guildId, vote);
    }
  },
};
