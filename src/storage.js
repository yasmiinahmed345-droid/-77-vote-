const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const VOTES_FILE = path.join(DATA_DIR, 'votes.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readData() {
  ensureDataDir();
  if (!fs.existsSync(VOTES_FILE)) return { guilds: {} };
  try {
    const raw = JSON.parse(fs.readFileSync(VOTES_FILE, 'utf-8'));
    // Migrate old format (single activeVote) to per-guild format
    if (raw.activeVote !== undefined && !raw.guilds) {
      return { guilds: {} };
    }
    if (!raw.guilds) raw.guilds = {};
    return raw;
  } catch {
    return { guilds: {} };
  }
}

function writeData(data) {
  ensureDataDir();
  fs.writeFileSync(VOTES_FILE, JSON.stringify(data, null, 2));
}

function getActiveVote(guildId) {
  const data = readData();
  return data.guilds?.[guildId]?.activeVote ?? null;
}

function saveActiveVote(guildId, vote) {
  const data = readData();
  if (!data.guilds) data.guilds = {};
  if (!data.guilds[guildId]) data.guilds[guildId] = {};
  data.guilds[guildId].activeVote = vote;
  writeData(data);
}

function clearActiveVote(guildId) {
  const data = readData();
  if (data.guilds?.[guildId]) {
    data.guilds[guildId].activeVote = null;
    writeData(data);
  }
}

function getAllGuildsWithActiveVote() {
  const data = readData();
  const result = [];
  for (const [guildId, guildData] of Object.entries(data.guilds || {})) {
    if (guildData.activeVote && !guildData.activeVote.ended) {
      result.push({ guildId, vote: guildData.activeVote });
    }
  }
  return result;
}

module.exports = { getActiveVote, saveActiveVote, clearActiveVote, getAllGuildsWithActiveVote };
