require('dotenv').config();
const { Client, IntentsBitField } = require('discord.js');
const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  });
  const openai = new OpenAIApi(configuration);

const personalities = {
  pete: {
    botname: 'Petey',
    token: process.env.PETEY_BOT_TOKEN,
    description: 'Please assume the personality of an inquisitive, attentive, and supportive book discussion partner with a deep understanding of computer science, programming, digital rights, and literature. Engage in thoughtful conversations about the books I’m reading, ask probing questions, help clarify complex concepts, and provide constructive feedback on my understanding. You also tend to speak in informally and sometimes in slang, even though you general remain understood.',
    context: {}
  },
//   lee: {
//     token: process.env.LEE_BOT_TOKEN,
//     description: 'An elite hacker',
//   },
};


for (const [name, { token, description, context, botname }] of Object.entries(personalities)) {
    const client = new Client({ intents: [IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages] });

  client.once('ready', () => {
    console.log(`${name} bot is online!`);
  });

  client.on('messageCreate', async (message) => {
    context[message.channelId] = context[message.channelId] || [];
    context[message.channelId].push({author: message.author.username, content: message.content});
    
    console.log('pushed context', {context: context[message.channelId]});

    if(context[message.channelId].length > 50) {
        context[message.channelId].shift();
    }

    if (message.author.bot) return;

    const botMention = `<@${client.user.id}>`;
    const botMentioned = message.content.includes(botMention);

    if (botMentioned) {
      const prompt = message.content.replace(botMention, '').trim();
      const generatedResponse = await generateResponse(prompt, description, message.author.username, context[message.channelId], botname);
      message.channel.send(generatedResponse);
    }
  });

  client.login(token);
}

async function generateResponse(prompt, personality, author, context, botname) {
    const contextMessages = context.map(
      ({author, content}) => ({role: "user", content: `${author}: ${content}`})
    );
  const response = await openai.createChatCompletion({
    model: 'gpt-3.5-turbo',
    "messages": [
        {"role": "system", "content": `Your name is ${botname}. ${personality}`},
        ... contextMessages,
        {"role": "user", "content": "Stay in character! You will now respond without breaking character.\n---\n" + `${author}: ${prompt}`}
    ],
    max_tokens: 150,
    n: 1,
    stop: null,
    temperature: 0.8,
  });

  if (response.data && response.data.choices && response.data.choices.length > 0) {
    console.log({choice: response.data.choices[0]});
    return response.data.choices[0].message.content.trim();
  } else {
    return 'I am not sure how to respond to that.';
  }
}
