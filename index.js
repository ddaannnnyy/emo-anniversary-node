const axios = require('axios');
const MusicBrainzApi = require('musicbrainz-api').MusicBrainzApi;
const {TwitterApi} = require('twitter-api-v2');
require('dotenv').config();

// global vars
var now = new Date();
var nowDate = now.getDate() < 10 ? `0${now.getDate()}` : now.getDate();
var nowMonth = now.getMonth() + 1 < 10 ? `0${now.getMonth() + 1}` : now.getMonth() + 1;
var nowDayMonth = `${nowMonth}-${nowDate}`;
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
    accessSecret: twitterAccessSecret
});

const mbApi = new MusicBrainzApi({
    appName: 'EmoAnniversary',
    appVersion: '2.0.1',
    appContactInfo: 'https://www.twitter.com/emoanniversary'
});

/// Utility functions
function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
}

/// This is a first, initial call which collects the first sweep of data, as well as useful data such as the count of albums.
async function gatherReleaseGroups(offset = 0) {
    await mbApi.searchReleaseGroup({query: 'tag:emo NOT primarytype:single NOT secondarytype:soundtrack NOT secondarytype:live', limit: 100, offset: offset})
    .then(
        (res) => {
            releaseCount = res.count;
            for (let index = 0; index < res['release-groups'].length; index++) {
                if (res['release-groups'][index]['first-release-date'].endsWith(nowDayMonth) 
                    && res['release-groups'][index]['first-release-date'].length > 9
                    && !res['release-groups'][index]['first-release-date'].endsWith(now.getFullYear())) {
                    releases.push(res['release-groups'][index]);
                }
            }
    }).catch((err) => {

    });
}

async function delayLoop() {
    for (let indexOffset = 100; indexOffset <= releaseCount; indexOffset = indexOffset+100) {
        console.log('searching offset ' + indexOffset);
        gatherReleaseGroups(indexOffset);
        console.log('releases now: ' + releases.length);
        await delay(1000);
    }
}

async function cleanAnniversaryReleases() {
    for (let index = 0; index < releases.length; index++) {
        let artists;
        try {
            artists = [];
        for (let artistIndex = 0; artistIndex < releases[index]['artist-credit'].length; artistIndex++) {
            if (!artists.includes(releases[index]['artist-credit'][artistIndex]['name'])) {
                artists.push(releases[index]['artist-credit'][artistIndex]['name']);
            }
        }
        } catch (error) {
            artists = releases[index]['artist-credit'][0]['name'];
        }

        let age = now.getFullYear() - new Date(releases[index]['first-release-date']).getFullYear(); 
        cleanReleases.push({
            'id': releases[index]['id'],
            'title': releases[index]['title'],
            'releaseDate': releases[index]['first-release-date'],
            'age': age,
            'artistCredit': artists.toString(),
        })
    }
}

async function fetchCoverArt(releases) {
    for (let index = 0; index < releases.length; index++) {
        axios.get(`http://coverartarchive.org/release-group/${releases[index]['id']}`)
        .then(async (res) => {
            let url;
            if (res.data.images[0]['thumbnails']['500']) {
                url = res.data.images[0]['thumbnails']['500']
            } else if (res.data.images[0]['thumbnails']['250']) {
                url = res.data.images[0]['thumbnails']['250']
            } else {
                url = res.data.images[0]['image']
            }

            const config = { responseType: 'arraybuffer'};
            await axios.get(url, config)
                .then((res) => {
                    let imageBuffer = Buffer.from(res.data);
                    // releases[index]['cover'] = Uint8Array.from(imageBuffer).buffer;
                    releases[index]['cover'] = imageBuffer;
                });
        })
        .catch((err) => {

        })

        await delay(1000);
    }
}

async function uploadMedia() {
    for (let index = 0; index < cleanReleases.length; index++) {
        if (cleanReleases[index]['cover']) {
            cleanReleases[index]['mediaId'] = await twitterClient.v1.uploadMedia(cleanReleases[index].cover, { mimeType: 'image/Jpeg' });
        }
    }
}

async function postTweets() {
    for (let index = 0; index < cleanReleases.length; index++) {
        let tweetBody = `${cleanReleases[index]['title']} by ${cleanReleases[index]['artistCredit']} is now ${cleanReleases[index]['age']}!\r\nIt was first released on ${new Date(cleanReleases[index]['releaseDate']).toLocaleDateString('en-AU', {year: 'numeric', month: 'long', day: 'numeric'}).toString()}`;
        if (cleanReleases[index]['mediaId']) {
            await twitterClient.v1.tweet(tweetBody, {media_ids:cleanReleases[index]['mediaId']}).catch(async (err) => {
                await twitterClient.v1.tweet(tweetBody);
            });
            if (pfpswap) {
                await twitterClient.v1.updateAccountProfileImage(cleanReleases[index]['cover']).then((res) => {
                    pfpswap = false;
                });
            }
        } else {
            await twitterClient.v1.tweet(tweetBody);
        }
    }
}

/// Program Flow
async function programHandler() {
    await gatherReleaseGroups(); // sets first collection of albums and fetches the total count of albums returned by search. Adds albums with MM-DD matching today to an array of releases.
    await delayLoop(); // futher fetches releases by incrementing the offset of the call until the all of the pagination of the release count has been handled. Continues to add valid releases to array of releases.
    await cleanAnniversaryReleases(); // re-sorts the data into a cleaner collection of information, reduces un-needed information, and fetches artist information.
    await fetchCoverArt(cleanReleases); // fetches cover art as ArrayBuffers
    await uploadMedia();
    await postTweets();
    
}

programHandler();



