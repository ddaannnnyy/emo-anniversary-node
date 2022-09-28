const axios = require('axios');

require('dotenv').config();

// global vars
let dateNow = new Date()
let yearNow = dateNow.getFullYear();
let monthNow = dateNow.getMonth() + 1;
let dayNow = dateNow.getDate();
let pfpSwap = true;
let releases = [];
let releaseCount = 5600;
let posts = [];

//.env vals
let mb_baseUrl = process.env.MB_BASE;
let mb_userAgent = process.env.MB_USER_AGENT;
let mb_query = encodeURIComponent(process.env.MB_QUERY);
let mb_url = `${mb_baseUrl}/release-group?query=${mb_query}&limit=100&offset=`

console.log(mb_url);

async function getReleases(offset) {
    console.log(`${offset} of ${releaseCount}`);
    try {
        const response = await axios.get(mb_url + offset,
            {
                headers: {
                    'User-Agent': mb_userAgent,
                    'Accept': 'application/json'
                }
            });
        releaseCount = response.data.count;
        await response.data['release-groups'].forEach(element => {
            let dateCheck = monthNow + '-' + dayNow;
            let releaseDate = element['first-release-date'];
            if (releaseDate && releaseDate.endsWith(dateCheck)) {
                releases.push(element);
            }
        });
        console.log(releases.length);
    } catch (error) {
        console.log(error);
    }
}

async function setCount() { await getReleases(0) };

setCount();

async function collection() {
    for (let index = 100; index <= 1000; index = index + 100) {
        getReleases(index);
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
    setPosts(releases);
}

async function setPosts(releases) {
    for (const release of releases) {
        let artistString;
        let albumArt;
        try {
            await axios.get('http://coverartarchive.org/release-group/' + release.id)
                .then((response) => {
                    let images = response.images[0];
                    if (images['thumbnails']['500']) {
                        albumArt = images['thumbnails']['500'];
                    }
                    else if (images['thumbnails']['250']) {
                        albumArt = images['thumbnails']['250']
                    }
                    else if (images['image']) {
                        albumArt = images['image']
                    }

                }).catch((err) => {
                    if (err.response.status == 404) {
                        albumArt = '';
                    }
                    else if (err.response.status == 429) {
                        setTimeout(setPosts, 10000, releases);
                    }
                });
            let artistCollection = release['artist-credit'];
            artistString = artistCollection[0].name;
            if (artistCollection.length > 1) {
                for (const artist in artistCollection) {
                    if (artist.index == artistCollection.length) {
                        artistString += artist.name;
                    } else {
                        artistString += artist.name + ', ';
                    }
                }
                if (artistString.length > 100) {
                    artistString = 'Multiple Artists. See the release link for more information.'
                }
            }
            posts.push({
                title: release['title'],
                artists: artistString,
                releaseDate: release['first-release-date'],
                cover: albumArt
            })
        } catch (error) {
            console.log(error)
        }
    }

    console.log(posts);
}

collection();

