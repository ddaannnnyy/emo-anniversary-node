const axios = require("axios");
const MusicBrainzApi = require("musicbrainz-api").MusicBrainzApi;
const { TwitterApi } = require("twitter-api-v2");
const puppeteer = require("puppeteer");
const functions = require("@google-cloud/functions-framework");
require("dotenv").config();

// global vars
var now = new Date();
var nowDate = now.getDate() < 10 ? `0${now.getDate()}` : now.getDate();
var nowMonth =
  now.getMonth() + 1 < 10 ? `0${now.getMonth() + 1}` : now.getMonth() + 1;
var nowDayMonth = `${nowMonth}-${nowDate}`;
console.log(nowDayMonth);
var releases = [];
var cleanReleases = [];
var releaseCount = 0;
var pfpswap = true;

//.env vals
var twitterAppKey = process.env.TWITTER_APP_KEY;
var twitterAppSecret = process.env.TWITTER_APP_SECRET;
var twitterAccessToken = process.env.TWITTER_ACCESS_TOKEN;
var twitterAccessSecret = process.env.TWITTER_ACCESS_SECRET;

const twitterClient = new TwitterApi({
  appKey: twitterAppKey,
  appSecret: twitterAppSecret,
  accessToken: twitterAccessToken,
  accessSecret: twitterAccessSecret,
});

const mbApi = new MusicBrainzApi({
  appName: "EmoAnniversary",
  appVersion: "2.1.0",
  appContactInfo: "https://www.twitter.com/emoanniversary",
});

/// Utility functions
function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

/// This is a first, initial call which collects the first sweep of data, as well as useful data such as the count of albums.
async function gatherReleaseGroups(offset = 0) {
  await mbApi
    .searchReleaseGroup({ query: "tag:emo", limit: 100, offset: offset })
    .then((res) => {
      releaseCount = res.count;
      for (let index = 0; index < res["release-groups"].length; index++) {
        if (
          res["release-groups"][index]["first-release-date"].endsWith(
            nowDayMonth
          ) &&
          res["release-groups"][index]["first-release-date"].length > 9 &&
          !res["release-groups"][index]["first-release-date"].endsWith(
            now.getFullYear()
          ) &&
          res["release-groups"][index]["primary-type"] != "Single"
        ) {
          releases.push(res["release-groups"][index]);
        }
      }
    })
    .catch((err) => {});
}

async function delayLoop() {
  for (
    let indexOffset = 100;
    indexOffset <= releaseCount;
    indexOffset = indexOffset + 100
  ) {
    console.log("searching offset " + indexOffset);
    gatherReleaseGroups(indexOffset);
    console.log("releases now: " + releases.length);
    await delay(1000);
  }
}

async function cleanAnniversaryReleases() {
  for (let index = 0; index < releases.length; index++) {
    let artists;
    try {
      artists = [];
      for (
        let artistIndex = 0;
        artistIndex < releases[index]["artist-credit"].length;
        artistIndex++
      ) {
        if (
          !artists.includes(
            releases[index]["artist-credit"][artistIndex]["name"]
          )
        ) {
          const twitterHandle = await returnTwitterHandle(
            releases[index]["artist-credit"][artistIndex]["artist"]["id"]
          );
          artists.push(
            `${releases[index]["artist-credit"][artistIndex]["name"]}${twitterHandle}`
          );
          if (releases[index]["artist-credit"][artistIndex]["joinphrase"]) {
            artists.push(
              releases[index]["artist-credit"][artistIndex]["joinphrase"]
            );
          }
        }
      }
    } catch (error) {
      artists = releases[index]["artist-credit"][0]["name"];
    }

    let age =
      now.getFullYear() -
      new Date(releases[index]["first-release-date"]).getFullYear();
    cleanReleases.push({
      id: releases[index]["id"],
      title: releases[index]["title"],
      releaseDate: releases[index]["first-release-date"],
      age: age,
      artistCredit: artists.toString(),
    });
  }
}

async function returnTwitterHandle(id) {
  let pageUrl = `https://musicbrainz.org/artist/${id}`;

  // fetch twitter handle
  const browser = await puppeteer.launch({
    headless: "new",
  });
  const page = await browser.newPage();
  await page.goto(pageUrl);

  const twitterLinkElement = await page.$(".twitter-favicon a");
  const twitterHandle = await page.evaluate(
    (el) => el.innerText,
    twitterLinkElement
  );

  await browser.close();
  await delay(1000);

  const suppliedHandle = twitterHandle ? ` (${twitterHandle})` : null;
  return suppliedHandle;
}

async function fetchCoverArt(releases) {
  for (let index = 0; index < releases.length; index++) {
    axios
      .get(`http://coverartarchive.org/release-group/${releases[index]["id"]}`)
      .then(async (res) => {
        let url;
        if (res.data.images[0]["thumbnails"]["500"]) {
          url = res.data.images[0]["thumbnails"]["500"];
        } else if (res.data.images[0]["thumbnails"]["250"]) {
          url = res.data.images[0]["thumbnails"]["250"];
        } else {
          url = res.data.images[0]["image"];
        }

        const config = { responseType: "arraybuffer" };
        await axios.get(url, config).then((res) => {
          let imageBuffer = Buffer.from(res.data);
          if (imageBuffer.byteLength <= 5242800) {
            releases[index]["cover"] = imageBuffer;
          }
        });
      })
      .catch((err) => {});

    await delay(1000);
  }
}

async function uploadMedia() {
  for (let index = 0; index < cleanReleases.length; index++) {
    if (cleanReleases[index]["cover"]) {
      cleanReleases[index]["mediaId"] = await twitterClient.v1.uploadMedia(
        cleanReleases[index].cover,
        { mimeType: "image/Jpeg" }
      );
    }
  }
}

async function postTweets() {
  if (cleanReleases.length == 0) {
    const tweet = await twitterClient.v2.tweet(
      "No releases today ):\r\nThrow what you're currently listening to in the comments.\r\nHave I missed one? Make sure to add the 'emo' tag on music-brainz.org and I'll nab it next year :)"
    );
  }
  let postedTweets = [];
  for (let index = 0; index < cleanReleases.length; index++) {
    console.log(cleanReleases[index]);
    if (!postedTweets.includes(cleanReleases[index]["id"])) {
      let tweetBody = `${cleanReleases[index]["title"]} by ${
        cleanReleases[index]["artistCredit"]
      } is now ${
        cleanReleases[index]["age"]
      }!\r\nIt was first released on ${new Date(
        cleanReleases[index]["releaseDate"]
      )
        .toLocaleDateString("en-AU", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
        .toString()}`;
      if (cleanReleases[index]["mediaId"]) {
        await twitterClient.v2
          .tweet(tweetBody, {
            media: { media_ids: [cleanReleases[index]["mediaId"]] },
          })
          .catch(async (err) => {
            await twitterClient.v2.tweet(tweetBody);
          });
        if (pfpswap) {
          const result = await twitterClient.v1
            .updateAccountProfileImage(cleanReleases[index]["cover"])
            .then((res) => {
              pfpswap = false;
            });
        }
      } else {
        await twitterClient.v2.tweet(tweetBody);
      }
      postedTweets.push(cleanReleases[index]["id"]);
    }
    await delay(30000);
  }
}

async function debugTweets() {
  if (cleanReleases.length == 0) {
    const tweet = await twitterClient.v2.tweet(
      "No releases today ):\r\nThrow what you're currently listening to in the comments.\r\nHave I missed one? Make sure to add the 'emo' tag on music-brainz.org and I'll nab it next year :)"
    );
  }
  let postedTweets = [];
  for (let index = 0; index < cleanReleases.length; index++) {
    if (!postedTweets.includes(cleanReleases[index]["id"])) {
      let tweetBody = `${cleanReleases[index]["title"]} by ${
        cleanReleases[index]["artistCredit"]
      } is now ${
        cleanReleases[index]["age"]
      }!\r\nIt was first released on ${new Date(
        cleanReleases[index]["releaseDate"]
      )
        .toLocaleDateString("en-AU", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
        .toString()}`;

      console.log(tweetBody);

      postedTweets.push(cleanReleases[index]["id"]);
    }
  }
}

/// Program Flow
async function programHandler() {
  try {
    await gatherReleaseGroups(); // sets first collection of albums and fetches the total count of albums returned by search. Adds albums with MM-DD matching today to an array of releases.
    await delayLoop(); // futher fetches releases by incrementing the offset of the call until the all of the pagination of the release count has been handled. Continues to add valid releases to array of releases.
    await cleanAnniversaryReleases(); // re-sorts the data into a cleaner collection of information, reduces un-needed information, and fetches artist information.
    await fetchCoverArt(cleanReleases); // fetches cover art as ArrayBuffers.
    await uploadMedia(); // uploads available media to twitter, returns a mediaid which is then assigned to an album to be attached to the tweet.
    // await debugTweets();
    await postTweets(); // posts formatted tweets for each release.
  } catch (error) {
    console.log(error);
  }
}

// google cloud functions runner
functions.http("helloHttp", (req, res) => {
  programHandler();
});
