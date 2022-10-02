// @ts-nocheck
import * as dotenv from 'dotenv';
dotenv.config();

import cliProgress from 'cli-progress';
import { readJSON, readMappedJSON, writeJSON } from './utils.js';

// Setup Twitter client
import { Client } from 'twitter-api-sdk';
const twitter_client = new Client(`${process.env.TWITTER_API_KEY}`);

// Setup OpenAI client
import OpenAI from 'openai-api';
const openai_client = new OpenAI(process.env.OPENAI_API_KEY);

async function twitter_api(api_call, max_results) {
  let results = [];
  let pagination_token = '';

  while (results.length < max_results) {
    try {
      const response = await api_call(pagination_token);

      if (response?.data) {
        results = [...results, ...response.data];
      }

      if (response.meta.next_token) {
        pagination_token = response.meta.next_token;
      } else {
        break;
      }
    } catch (e) {
      console.log(e);
      break;
    }
  }

  return results;
}

async function get_list_members(list_id, max_results) {
  const list_members_api = async (pagination_token = null) => {
    const parameters = {
      max_results: max_results > 100 ? 100 : max_results,
      'user.fields': ['username'],
    };

    if (pagination_token) {
      parameters['pagination_token'] = pagination_token;
    }

    const response = await twitter_client.users.listGetMembers(list_id, parameters);

    return response;
  };

  const list_members = await twitter_api(list_members_api, max_results);

  return list_members;
}

async function get_user_tweets(user_id, max_results) {
  const list_members_api = async (pagination_token = null) => {
    const parameters = {
      max_results: max_results > 100 ? 100 : max_results,
      'tweet.fields': [
        'author_id',
        'conversation_id',
        'created_at',
        'id',
        'in_reply_to_user_id',
        'public_metrics',
        'referenced_tweets',
        'text',
      ],
      'media.fields': ['alt_text', 'type'],
    };

    if (pagination_token) {
      parameters['pagination_token'] = pagination_token;
    }

    const response = await twitter_client.tweets.usersIdTweets(user_id, parameters);

    return response;
  };

  const list_members = await twitter_api(list_members_api, max_results);

  return list_members;
}

async function get_users_interactions(user_a, user_b, max_results) {
  const search_api = async (pagination_token = null) => {
    const parameters = {
      max_results: max_results > 100 ? 100 : max_results,
      query: `(from:${user_a} to:${user_b}) OR (from:${user_b} to:${user_a})`,
    };

    if (pagination_token) {
      parameters['pagination_token'] = pagination_token;
    }

    const response = await twitter_client.tweets.tweetsRecentSearch(parameters);

    return response;
  };

  const users_interactions = await twitter_api(search_api, max_results);

  return users_interactions.length;
}

function clean_tweet(text) {
  // Regex to remove @usernames and https://t.co/ urls
  const regex = /(@.*?( |$)|https:\/\/t\.co\/.*?( |$)|\\)/gm;
  const clean_text = text.replace(regex, '');
  return clean_text;
}

async function get_embeddings(model, text) {
  try {
    const response = await openai_client.embeddings({
      engine: model,
      input: [text],
    });

    return response.data.data[0].embedding;
  } catch (e) {
    return [];
  }
}

function get_top_pairs(pairs_map, start = null, end = null) {
  const pairs = Array.from(pairs_map.entries());

  let top_pairs = pairs
    .sort((a, b) => b[1] - a[1])
    .map((pair) => {
      const [a, b] = pair[0].split(':');
      return {
        a,
        b,
        similarity: pair[1],
      };
    });

  if (start && end_position) top_pairs = top_pairs.slice(start, end);
  else if (start) top_pairs = top_pairs.slice(start);

  return top_pairs;
}

function get_pair_id(a, b) {
  let pair_id = '';

  if (a > b) {
    pair_id = `${a}:${b}`;
  } else if (a < b) {
    pair_id = `${b}:${a}`;
  }

  return pair_id;
}

async function main() {
  const DATASET_SIZE = 's';
  const MODEL = 'text-similarity-davinci-001';

  let members = [];
  let tweets = [];
  const list = '1401364440272961536'; // computing-utopias

  const progress = new cliProgress.SingleBar(
    {
      stopOnComplete: true,
      clearOnComplete: true,
      gracefulExit: true,
    },
    cliProgress.Presets.shades_classic
  );

  // --------------------------------------------------------------------------
  // Get and save list members
  // --------------------------------------------------------------------------

  console.info('Fetch list members');

  // members = await get_list_members(list, 200);
  // writeJSON(`/data/members.json`, members);

  members = readMappedJSON(`/data/users/users.json`, 'id');

  // --------------------------------------------------------------------------
  // Get tweets
  // --------------------------------------------------------------------------

  console.info('Fetch tweets');

  // progress.start(tweets.length, 0, {});
  // for (const user of [...members.keys()]) {
  //   const user_tweets = await get_user_tweets(user, 30);
  //   tweets = [...tweets, ...user_tweets];
  //   progress.increment();
  // }

  // writeJSON(`/data/tweets/tweets_${DATASET_SIZE}.json`, tweets);

  tweets = readJSON(`/data/tweets/tweets_${DATASET_SIZE}.json`);

  // --------------------------------------------------------------------------
  // Clean tweets
  // --------------------------------------------------------------------------

  console.info('Cleaning tweets');

  // for (const tweet of tweets) {
  //   tweet.text_cleaned = clean_tweet(tweet.text);
  // }

  // // Remove retweets, replies, and quote tweets, and short tweets

  // tweets = tweets.filter((tweet) => {
  //   if ('referenced_tweets' in tweet) {
  //     if (
  //       tweet.referenced_tweets[0].type !== 'retweeted' ||
  //       tweet.referenced_tweets[0].type !== 'replied_to' ||
  //       tweet.referenced_tweets[0].type !== 'quoted' ||
  //       tweet.text_cleaned.length < 15
  //     ) {
  //       return false;
  //     }
  //   }

  //   return true;
  // });

  // writeJSON(`/data/cleaned/tweets_cleaned_${DATASET_SIZE}.json`, tweets);

  tweets = readJSON(`/data/cleaned/tweets_cleaned_${DATASET_SIZE}.json`, 'id');

  // --------------------------------------------------------------------------
  // Link tweets to members
  // --------------------------------------------------------------------------

  for (const tweet of tweets) {
    if (members.has(tweet.author_id)) {
      const member = members.get(tweet.author_id);
      const member_tweets = 'tweets' in member ? member.tweets : [];
      members.set(tweet.author_id, { ...member, tweets: [...member_tweets, tweet.id] });
    }
  }

  // --------------------------------------------------------------------------
  // Get embeddings
  // --------------------------------------------------------------------------

  console.info('Fetching embeddings');

  // progress.start(tweets.length, 0, {});
  // for (const tweet of tweets) {
  //   tweet.embedding = await get_embeddings(MODEL, tweet.text_cleaned);
  //   progress.increment();
  // }

  // writeJSON(`/data/embedded/tweets_embedded_${DATASET_SIZE}.json`, tweets);

  tweets = readMappedJSON(`/data/embedded/tweets_embedded_${DATASET_SIZE}.json`, 'id');

  // --------------------------------------------------------------------------
  // Calculate Tweet Similarity
  // --------------------------------------------------------------------------

  console.info('Calculating tweet similarity');

  let tweets_similarity = new Map();

  // progress.start(tweets.size, 0, {});
  // for (const tweet_a of tweets.values()) {
  //   for (const tweet_b of tweets.values()) {
  //     let tweet_pair_id = get_pair_id(tweet_a.id, tweet_b.id);

  //     if (
  //       tweet_pair_id &&
  //       !tweets_similarity.has(tweet_pair_id) &&
  //       tweet_a.embedding.length &&
  //       tweet_b.embedding.length &&
  //       tweet_a.author_id !== tweet_b.author_id
  //     ) {
  //       const s = similarity(tweet_a.embedding, tweet_b.embedding);
  //       tweets_similarity.set(tweet_pair_id, s);
  //     }
  //   }

  //   progress.increment();
  // }

  // writeJSON(`/data/similarity/tweets_similarity_${DATASET_SIZE}.json`, Array.from(tweets_similarity.entries()));

  tweets_similarity = new Map(readJSON(`/data/similarity/tweets_similarity_${DATASET_SIZE}.json`));

  // --------------------------------------------------------------------------
  // TEST 1: Connection on Tweet
  // --------------------------------------------------------------------------

  console.info('Finding connections based on tweets only');

  // Get top tweet pairs
  let top_tweet_pairs = get_top_pairs(tweets_similarity);

  top_tweet_pairs = top_tweet_pairs.map((tweet_pair) => {
    const tweet_a = tweets.get(tweet_pair.a);
    const tweet_a_author = members.get(tweet_a.author_id);
    const tweet_b = tweets.get(tweet_pair.b);
    const tweet_b_author = members.get(tweet_b.author_id);

    return {
      tweet_a: {
        text: tweet_a.text_cleaned,
        user: tweet_a_author.name,
      },
      tweet_b: {
        text: tweet_b.text_cleaned,
        user: tweet_b_author.name,
      },
      similarity: tweet_pair.similarity,
    };
  });

  writeJSON(`/data/connections/tweet_connections_${DATASET_SIZE}.json`, top_tweet_pairs);
  console.log(top_tweet_pairs.slice(0, 100));

  // --------------------------------------------------------------------------
  // TEST 2A: Connection on Member/User
  // --------------------------------------------------------------------------

  console.info('Finding connections based on user');

  let members_similarity = new Map();

  for (const member_a of members.values()) {
    for (const member_b of members.values()) {
      let member_pair_id = get_pair_id(member_a.id, member_b.id);

      if (member_pair_id && member_a?.tweets && member_b?.tweets) {
        for (const tweet_a of member_a.tweets) {
          for (const tweet_b of member_b.tweets) {
            let tweet_pair_id = get_pair_id(tweet_a, tweet_b);

            const tweet_pair_similarity = tweets_similarity.has(tweet_pair_id)
              ? tweets_similarity.get(tweet_pair_id)
              : 0;

            let member_similarity = 0;
            if (members_similarity.has(member_pair_id)) {
              member_similarity = members_similarity.get(member_pair_id);
            }
            member_similarity += tweet_pair_similarity;
            members_similarity.set(member_pair_id, member_similarity);
          }
        }
      }
    }
  }

  let top_member_pairs = get_top_pairs(members_similarity);

  top_member_pairs = top_member_pairs.map((member_pair) => {
    const member_a = members.get(member_pair.a);
    const member_b = members.get(member_pair.b);

    const tweet_pairs = [];

    if (member_a?.tweets && member_b.tweets) {
      for (const tweet_a_id of member_a.tweets) {
        for (const tweet_b_id of member_b.tweets) {
          const tweet_a = tweets.get(tweet_a_id);
          const tweet_b = tweets.get(tweet_b_id);

          const tweet_pair_id = get_pair_id(tweet_a.id, tweet_b.id);
          const tweet_pair_similarity = tweets_similarity.get(tweet_pair_id);

          const tweet_pair = [
            {
              a: tweet_a.text_cleaned,
              b: tweet_b.text_cleaned,
            },
            tweet_pair_similarity,
          ];

          tweet_pairs.push(tweet_pair);
        }
      }
    }

    let top_pairs = tweet_pairs.sort((a, b) => b[1] - a[1]).slice(0, 5);

    return {
      member_a: {
        name: member_a.name,
        username: member_a.username,
      },
      member_b: {
        name: member_b.name,
        username: member_b.username,
      },
      top_pairs,
      similarity: member_pair.similarity,
    };
  });

  writeJSON(`/data/connections/user_connections_${DATASET_SIZE}.json`, top_member_pairs);
  console.log(top_member_pairs.slice(0, 10));

  // --------------------------------------------------------------------------
  // TEST 2B: Find new user pairs
  // --------------------------------------------------------------------------
  // Check if see if the users have interacted recently (Twitter only allows searching in the last seven days)

  let new_member_pairs = [];

  progress.start(top_member_pairs.slice(0, 10).length, 0, {});
  for (const member_pair of top_member_pairs.slice(0, 10)) {
    const interactions = await get_users_interactions(member_pair.member_a.username, member_pair.member_b.username, 10);
    if (interactions < 5) {
      new_member_pairs.push(member_pair);
    }
    progress.increment();
  }

  writeJSON(`/data/connections/new_user_connections_${DATASET_SIZE}.json`, new_member_pairs);
  console.log(new_member_pairs.slice(0, 10));
}

main();
