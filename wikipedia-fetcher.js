const fetch = require('node-fetch');
const cheerio = require('cheerio');
const TurndownService = require('turndown');

async function fetchWikipediaArticle(url) {
  const response = await fetch(url);
  const html = await response.text();

  const $ = cheerio.load(html);
  const content = $('#content #bodyContent #mw-content-text .mw-parser-output').html();

  const turndownService = new TurndownService();
  const markdown = turndownService.turndown(content);

  return markdown;
}

module.exports = {fetchWikipediaArticle}