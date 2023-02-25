const axios = require('axios');
const { off } = require('process');
const MusicBrainzApi = require('musicbrainz-api').MusicBrainzApi;
require('dotenv').config();

// global vars
var now = new Date();
var nowDate = now.getDate() < 10 ? `0${now.getDate()}` : now.getDate();
var nowMonth = now.getMonth() + 1 < 10 ? `0${now.getMonth() + 1}` : now.getMonth() + 1;
var nowDayMonth = `${nowMonth}-${nowDate}`;
var releases = [];
var releaseCount = 0;

//.env vals
 

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
    await mbApi.searchReleaseGroup({query: 'tag:emo AND NOT primarytype:single OR NOT secondarytype:soundtrack OR NOT secondarytype:live', limit: 100, offset: offset})
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
    for (let indexOffset = 0; indexOffset <= releaseCount; indexOffset = indexOffset+100) {
        console.log('searching offset ' + indexOffset);
        gatherReleaseGroups(indexOffset);
        console.log('releases now: ' + releases.length);
        await delay(1000);
    }
}

function cleanAnniversaryReleases() {
    let cleanReleases = [];
    for (let index = 0; index < releases.length; index++) {
        let artists = [];
        for (let artistIndex = 0; artistIndex < releases[index]['artist-credit'].length; artistIndex++) {
            if (!artists.includes(releases[index]['artist-credit'][artistIndex]['name'])) {
                artists.push(releases[index]['artist-credit'][artistIndex]['name']);
            }
        }

        let age = now.getFullYear() - new Date(releases[index]['first-release-date']).getFullYear();

        
        cleanReleases.push({
            'id': releases[index]['id'],
            'title': releases[index]['title'],
            'releaseDate': releases[index]['first-release-date'],
            'age': age,
            'artistCredit': artists.toString()
        })
    }
    releases = cleanReleases;
    console.log(releases[0]);
}

/// Program Flow
async function programHandler() {
    await gatherReleaseGroups();
    console.log(releaseCount);
    await delayLoop();
    cleanAnniversaryReleases();
}

programHandler();




