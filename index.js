// Import required modules 
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, Partials } = require('discord.js');
const cron = require('node-cron');
const fs = require('fs');
require('dotenv').config();
// Create a new Discord client with message intent 
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel]
});

let responses = new Map();
const supchatRoleId = "791007964525625354";

// Load from file if exists
try {
  const data = fs.readFileSync('responses.json', 'utf8');
  const parsed = JSON.parse(data);
  responses = new Map(Object.entries(parsed));
  console.log('✅ Responses loaded from file');
} catch (err) {
  console.log('No existing responses file, starting fresh');
}

// Bot is ready 
client.once('ready', () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});


//Skicka weekly summary
async function sendWeeklySummary(guild, roleName, responses) {
  try {
    const channel = guild.channels.cache.find(
      ch => ch.name === 'varjun' && ch.isTextBased()
    );

    const role = guild.roles.cache.find(r => r.name === roleName);

    if (!role) {
      console.log(`Role "${roleName}" Not found`);
      return;
    }

    const members = await guild.members.fetch();

    const NotAnsweredList = members
      .filter(member =>
        member.roles.cache.has(role.id) && !responses.has(member.id)
      )
      .map(member => member.displayName);

    NotAnsweredList.forEach(element => {
      console.log("notanswered: ", element)
    });

    if (!channel) {
      console.log('Varjun channel not found');
      return;
    }

    const JaList = [];
    const NejList = [];

    for (const [userId, choice] of responses.entries()) {
      const member = await guild.members.fetch(userId);

      if (choice === 'Ja') JaList.push(member.displayName);
      if (choice === 'Nej') NejList.push(member.displayName);
    }

    const summaryMessage = `
**Ikväll är det raid. Så här ser status ut:**

**✅ Ja (${JaList.length})**
${JaList.length ? JaList.join('\n') : 'No responses'}

**❌ Nej (${NejList.length})**
${NejList.length ? NejList.join('\n') : 'No responses'}

**❓ Ej svarat (${NotAnsweredList.length})**
${NotAnsweredList.length ? NotAnsweredList.join('\n') : 'Alla har svarat!'}
`;

    await channel.send(summaryMessage);
    console.log('Weekly summary sent');
  } catch (error) {
    console.error('Error sending weekly summary:', error);
  }
}



// Helper function to send DMs to all users with a specific role
async function sendDMsToRoleMembers(guild, roleName, message) {
  try {
    const role = guild.roles.cache.find(r => r.name === roleName);

    if (!role) {
      console.log(`Role "${roleName}" Not found`);
      return;
    }

    const members = await guild.members.fetch();
    const membersWithRole = members.filter(member =>
      member.roles.cache.has(role.id) && !responses.has(member.id)
    );

    console.log(`Found ${membersWithRole.size} members with role "${roleName}"`);

    for (const member of membersWithRole.values()) {
      try {
        const optionButtons = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('poll_Ja')
            .setLabel('Ja')
            .setStyle(ButtonStyle.Success),

          new ButtonBuilder()
            .setCustomId('poll_Nej')
            .setLabel('Nej')
            .setStyle(ButtonStyle.Danger)
        );

        await member.send({
          content: message,
          components: [optionButtons]
        });
        console.log(`Sent DM to ${member.user.tag}`);
      } catch (error) {
        console.log(`Could not send DM to ${member.user.tag}: ${error.message}`);
      }
    }
  } catch (error) {
    console.error('Error sending DMs:', error);
  }
}

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;

  const userId = interaction.user.id;
  let choice = null;

  if (interaction.customId === 'poll_Ja') choice = "Ja";
  if (interaction.customId === 'poll_Nej') choice = "Nej";

  if (!choice) return;

  responses.set(userId, choice);
  saveResponses();

  await interaction.reply({
    content: `You selected **${choice.toUpperCase()}**`,
    ephemeral: true
  });

  console.log(`User ${interaction.user.tag} chose ${choice}`);
  console.log(responses);
});

// Function to send collected responses to one or more users
async function sendResponsesToAdmins(client, targetUserIds, responses) {
  if (!Array.isArray(targetUserIds)) {
    // allow comma-separated string for backward compatibility
    targetUserIds = String(targetUserIds).split(',').map(id => id.trim()).filter(id => id);
  }

  for (const id of targetUserIds) {
    try {
      const targetUser = await client.users.fetch(id);
      if (!targetUser) {
        console.log(`Target user ${id} Not found`);
        continue;
      }

      // Format the responses
      let responseText = '**Status på de som dyker upp på raiden ikväll:**\n';
      let JaCount = 0, NejCount = 0;

      for (const [userId, choice] of responses) {
        const user = await client.users.fetch(userId);
        responseText += `${user.tag}: **${choice.toUpperCase()}**\n`;
        if (choice === 'Ja') JaCount++;
        if (choice === 'Nej') NejCount++;
      }

      responseText += `\n**Summary:**\nJa: ${JaCount}\nNej: ${NejCount}`;

      await targetUser.send(responseText);
      console.log(`Sent responses to ${targetUser.tag}`);
    } catch (error) {
      console.error(`Error sending responses to ${id}:`, error);
    }
  }
}

async function sendRaidAnnouncement(guild) {
  try {
    const channel = guild.channels.cache.find(
      ch => ch.name === 'varjun' && ch.isTextBased()
    );

    if (!channel) {
      console.log('Channel not found');
      return;
    }

    await channel.send({
      content: `<@&${supchatRoleId}> Imorn kör vi nästa epic raid kl 18:00. Kom ihåg att meddela om du vet att du inte kan dyka upp.`,
      files: ['./raidbanner.png']
    });

    console.log('📢 Raid announcement sent');
  } catch (error) {
    console.error('Error sending raid announcement:', error);
  }
}

async function sendHousingannouncement(guild) {
  try {
    const channel = guild.channels.cache.find(
      ch => ch.name === 'varjun' && ch.isTextBased()
    );

    if (!channel) {
      console.log('Channel not found');
      return;
    }

    await channel.send({
      content: `<@&${supchatRoleId}> Det är något stort på g! Sup chat housing tournament competition är tävlingen där du kan vinna fett mycket guld genom att bygga det fräckaste huset i SUP CHAT guild neighbourhood!.`,
      files: ['./housingcompetition.png']
    });

    console.log('📢 Housing announcement sent');
  } catch (error) {
    console.error('Error sending housing announcement:', error);
  }
}

//helper function for saving to local file storage
function saveResponses() {
  const obj = Object.fromEntries(responses);
  fs.writeFileSync('responses.json', JSON.stringify(obj, null, 2));
}

function clearResponses() {
  responses.clear()
  fs.writeFileSync('responses.json', JSON.stringify({}, null, 2));
  console.log('🗑️ Responses cleared');
}


async function transferPoints(sender, receiver, numberOfPoints, message) {
  try {
    console.log("Sender", sender.username, " sends", numberOfPoints, "sup chat points to receiver", receiver)
    const data = loadPoints();
    const sanatizedSender = translateName(sender.username.toLowerCase())
    const sanatizedReceiver = receiver.toLowerCase();
    console.log("SanatizedSender: ", sanatizedSender)

    // Ensure both users exist in file
    if (!data[sanatizedSender]) {
      console.log("sender does not exist")
      message.reply("Sender was not found")
      return 0;
    } else {
      console.log("sender exists")
    }

    //console.log("Data: ", data)

    if (!data[sanatizedReceiver]) {
      console.log("receiver does not exist")
      message.reply("Receiver was not found")
      return 0;
    } else {
      console.log("receiver exists")
    }

    // Check balance
    if (data[sanatizedSender].points < numberOfPoints) {
      return message.reply('You do not have enough points.');
    }

    if (numberOfPoints < 0) {
      return message.reply('Hey kid you cant send someone a negative amount of points!');
    }

    // Transfer
    data[sanatizedSender].points -= numberOfPoints;
    data[sanatizedReceiver].points += numberOfPoints;



    savePoints(data);

    message.reply(
      `${sanatizedSender} sent ${numberOfPoints} SUP CHAT Points™ to ${sanatizedReceiver} 💵`
    );
  } catch (error) {
    console.log(error)
  }
}

async function checkBalance(sender, message) {
  const data = loadPoints();
  const sanatizedSender = translateName(sender.username.toLowerCase())
  if (sanatizedSender === "erkan") {
    message.reply(`${sanatizedSender}, you have 1337 SUP CHAT Points™ 💰`);
    return 0;
  }
  if (!sanatizedSender) {
    console.log("User not found when checking balance")
    return 0;
  }
  const points = data[sanatizedSender].points;
  message.reply(`${sanatizedSender}, you have ${points} SUP CHAT Points™ 💰`);
}

async function gulaSidorna(message) {
  try {
    const data = loadPoints();

    const users = Object.keys(data); // gets all keys (displayNames)

    if (users.length === 0) {
      return message.reply('No users found.');
    }

    message.reply(`📒 Gula sidorna with the address of the people in the SUP CHAT Points™ ecosystem:\n\n${users.join('\n')}`);
  } catch (error) {
    console.log(error);
    message.reply('Something went wrong.');
  }
}

function translateName(rawSenderName) {
  console.log("rawSenderName: ", rawSenderName)
  let storedName = "";

  switch (rawSenderName) {
    case ("buckykentuckycool"):
      storedName = "erkan"
      return storedName;
    case ("timhanks"):
      storedName = "timhanks"
      return storedName;
    case ("leoleoleoleoleo8375"):
      storedName = "cheche"
      return storedName;
    case ("oashdfo"):
      storedName = "kasdbau"
      return storedName;
    case ("adajac116"):
      storedName = "adam"
      return storedName;
    case ("jampanos"):
      storedName = "jampanos"
      return storedName;
    case ("axle_2"):
      storedName = "axle2"
      return storedName;
    case ("gogando_98_78741"):
      storedName = "jaget"
      return storedName;
    case ("bepisborger"):
      storedName = "elgon"
      return storedName;
    case ("e11en_55_47453"):
      storedName = "eddo"
      return storedName;
    case (".ginste"):
      storedName = "fixxul"
      return storedName;
    case ("maazing"):
      storedName = "maazing"
      return storedName;
    case ("isbel69"):
      storedName = "isbel"
      return storedName;
    case ("radioactive0375"):
      storedName = "frotilopi"
      return storedName;
    case ("spycrawler"):
      storedName = "spycrawler"
      return storedName;
    case ("emeraude3557"):
      storedName = "gustav"
      return storedName;
    case ("sjanti"):
      storedName = "arwendi"
      return storedName;
    case ("hampus117"):
      storedName = "pentagona"
      return storedName;
    case ("detiora"):
      storedName = "detiora"
      return storedName;

    default:
      console.log("Name not found");
      return 0;
  }

}

async function help(message) {
  message.reply("Hello esteemed member of the world first raiding guild SUP CHAT, here is a list of all the commands available through the Raidinator interface: \n\n💵 [!transferpoints] - This is for sending SUP CHAT Points™ to another member. Simply type the username of the member you want to send points to and the amount of points you intend to send (ex. '!transferpoints timhanks 10') \n\n💰 [!checkbalance] - Check the current amount of SUP CHAT Points™ you have at your disposal \n\n📒 [!gulasidorna] - See a list of all the people who are in the SUP CHAT Points™ currency system");
}


function loadPoints() {
  console.log("loadPoints")
  return JSON.parse(fs.readFileSync('./points.json', 'utf8'));
}

function savePoints(data) {
  console.log("sendPoints")
  fs.writeFileSync('./points.json', JSON.stringify(data, null, 2));
}



async function gallywixCollect(guild, targetTag) {
  try {
    const data = loadPoints();
    const members = await guild.members.fetch();
    const member = members.find(
      m => m.user.tag === targetTag
    );

    if (!member) {
      console.log("Target not found, gallywix returning emptyhanded")
      return 0;
    }
    console.log("Member: ", member.user.tag)

    try {
      const gallywixTarget = translateName(member.user.tag.toLowerCase())
      //data[sanatizedSender].points -= numberOfPoints;
      const gallywixCut = (data[gallywixTarget].points - Math.floor(data[gallywixTarget].points * 0.925))
      data[gallywixTarget].points = Math.floor(data[gallywixTarget].points * 0.925);
      data["Trade_Prince_Gallywix"].points += gallywixCut;
      await member.send({
        files: ['./gallywixCollect.png'],
        content: `Trade Prince Gallywix takes out a cut of 7,5% of your SUP CHAT Points™ (${gallywixCut} points). Your total is now ${data[gallywixTarget].points} points`
      });
      console.log(`Sent DM to ${member.user.tag}`);
    } catch (error) {
      console.log(`Could not send DM to ${member.user.tag}: ${error.message}`);
    }
    savePoints(data)
  } catch (error) {
    console.error('Error sending DMs:', error);
  }
}

async function sendMessage(guild) {
  try {
    const channel = guild.channels.cache.find(
      ch => ch.name === 'varjun' && ch.isTextBased()
    );

    if (!channel) {
      console.log('Channel not found');
      return;
    }

    await channel.send({
      content: `Precis! så du bäst akta dig, annars kommer boogeyman och tar dina sup chat points!.`
    });
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

// Listen and respond to messages 
client.on('messageCreate', async message => {
  if (message.author.bot) return;



  const content = message.content.toLowerCase();
  const isDM = !message.guild;

  // Only get guild when needed
  let guild = null;
  if (!isDM) {
    guild = message.guild;
  } else {
    guild = client.guilds.cache.first(); // fallback if needed
  }

  console.log("Message created client on");
  if (isDM) {
    console.log("Message: ", content)
  }

  // ================= COMMANDS =================

  if (content === '!initialize') {
    if (!guild) return message.reply('No guild found');

    await sendRaidAnnouncement(guild);
    return message.reply('✅ Raid announcement sent');
  }

  if (content === '!housing') {
    if (!guild) return message.reply('No guild found');

    await sendHousingannouncement(guild);
    return message.reply('✅ Housing announcement sent');
  }

  if (content === '!test2') {
    return message.reply(`Bot working in ${isDM ? 'DM' : 'server'} ✅`);
  }

  if (content === '!senddm') {
    if (!guild) return message.reply('No guild found');
    await sendDMsToRoleMembers(guild, 'SUP CHAT', 'Ikväll är det raid vid 18:00 ska du vara med?');
    return message.reply('✅ Sent DMs');
  }

  if (content === '!sendsummary') {
    if (!guild) return message.reply('No guild found');
    await sendWeeklySummary(guild, 'SUP CHAT', responses);
  }

  if (content === '!sendtoadmins') {
    await sendResponsesToAdmins(client, process.env.RESULTS_USER_ID, responses);
    return message.reply('✅ Sent to admins');
  }

  if (content === '!clearresponses') {
    clearResponses();
    return message.reply('🗑️ All responses have been cleared');
  }

  if (content.startsWith('!transferpoints')) {
    const args = content.split(' ');

    const targetUser = args[1];
    const amount = parseInt(args[2], 10);
    const sender = message.author;

    if (!targetUser || isNaN(amount)) {
      return message.reply('The number of SUP CHAT Points™ sent need to be a number value');
    }

    transferPoints(sender, targetUser, amount, message);
  }

  if (content === '!checkbalance') {
    const sender = message.author;
    checkBalance(sender, message)
  }

  if (content === '!gulasidorna') {
    gulaSidorna(message)
  }

  if (content === "!help") {
    help(message)
  }

  if (content === "!sendprankmessage") {
    sendMessage(guild);
  }

  if (content.startsWith('!gallywixcollect')) {
    if (!guild) return message.reply('No guild found');
    const args = content.split(' ');

    const targetUser = args[1];
    await gallywixCollect(guild, targetUser);
    return message.reply('✅ Sent out gallywix');
  }
});



// Log in to Discord using token from .env 
client.login(process.env.DISCORD_TOKEN);