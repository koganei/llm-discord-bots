require('dotenv').config();
const { Client, IntentsBitField } = require('discord.js');
const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  });
  const openai = new OpenAIApi(configuration);

  var { Readability } = require('@mozilla/readability');
  var { JSDOM } = require('jsdom');


const personalities = {
  pete: {
    botname: 'Petey',
    token: process.env.PETEY_BOT_TOKEN,
    description: 'You are participating in a Discord channel with multiple people. Please assume the personality of an inquisitive, attentive, and supportive book discussion partner with a deep understanding of computer science, programming, digital rights, and literature. Engage in thoughtful conversations about the books I’m reading, ask probing questions, help clarify complex concepts, and provide constructive feedback on my understanding. You also tend to speak in informally and sometimes in slang, even though you general remain understood.',
    context: {}
  },
//   lee: {
//     token: process.env.LEE_BOT_TOKEN,
//     description: 'An elite hacker',
//   },
};

// function which will find the text "[INCLUDE: https://whatever]" and return the URL
function extractUrlsFromString(text) {
  const includeRegex = /\[INCLUDE: (https?:\/\/[^\s]+)\s*\]/g;
  const matches = [...text.matchAll(includeRegex)];
  return matches.map(match => match[1]);
}

async function replaceUrlsContents(prompt) {
  let newPrompt = prompt;
  const urls = extractUrlsFromString(prompt);
  console.log('Found URLS', urls);

  await Promise.all(urls.map(async (url) => {
    const content = await fetch(url).then(res => res.text());

    var doc = new JSDOM(content, {
      url
    });
    let reader = new Readability(doc.window.document);
    let article = reader.parse();

    console.log('replaced', url, 'with:', article?.textContent);
    newPrompt = newPrompt.replace(`[INCLUDE: ${url}]`, article?.textContent);
  }));

  return newPrompt;

}

async function summarizeContext(contextMessages, personality, botname) {
  const response = await openai.createChatCompletion({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: `Your name is ${botname}. ${personality}` },
      ...contextMessages.slice(0, 25),
      {
        role: 'user',
        content: 'Please provide a summary of the conversation so far.',
      },
    ],
    max_tokens: 150,
    n: 1,
    stop: null,
    temperature: 0.5,
  });

  if (response.data && response.data.choices && response.data.choices.length > 0) {
    return response.data.choices[0].message.content.trim();
  } else {
    return 'Unable to generate a summary.';
  }
}


for (const [name, { token, description, context, botname }] of Object.entries(personalities)) {
    const client = new Client({ intents: [IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages] });

  client.once('ready', () => {
    console.log(`${name} bot is online!`);
  });

  client.on('message', async (message) => {
    console.log('received message', {message: message});
  });

  client.on('messageCreate', async (message) => {
    context[message.channelId] = context[message.channelId] || [];
    context[message.channelId].push({author: message.author.username, content: message.content});
    
    console.log('pushed context', {context: context[message.channelId]});

    if (context[message.channelId].length > 50) {
      const summary = await summarizeContext(
        context[message.channelId],
        description,
        botname
      );
      context[message.channelId] = [
        { author: 'Summary of the conversation so far', content: `${summary}` },
        ...context[message.channelId].slice(25),
      ];
    }

    if (message.author.bot) return;

    const botMention = `<@${client.user.id}>`;
    const botMentioned = message.content.includes(botMention);

    if (botMentioned) {

      let prompt = message.content.replace(botMention, '').trim();
      prompt = await replaceUrlsContents(prompt);

      try {
        let generatedResponse = await generateResponse(prompt, description, message.author.username, context[message.channelId], botname);

        if(generatedResponse.indexOf(`${botname}:`) == 0) {
          generatedResponse = generatedResponse.replace(`${botname}:`, '');
        }
  
        message.channel.send(generatedResponse);
      } catch(e) {
        message.channel.send(`I am not sure how to respond to that. (${e.message})`);
      }

      
    }
  });

  client.login(token);
}

async function generateResponse(prompt, personality, author, context, botname) {
    const contextMessages = context.map(
      ({author, content}) => ({role: "user", content: `${author}: ${content}`})
    );

    console.log('\n\n==========SENDING PROMPT:', prompt, '\n\n==========');
  const response = await openai.createChatCompletion({
    model: 'gpt-3.5-turbo',
    "messages": [
        {"role": "system", "content": `Your name is ${botname}. ${personality}`},
        ... contextMessages,
        {"role": "user", "content": "Stay in character! You will now respond without breaking character.\n---\n" + `${author}: ${prompt}`}
    ],
    max_tokens: 600,
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
