var axios = require('axios');
var RateLimiter = require('limiter').RateLimiter;
var API_TOKEN = require('./token');


var limiter = new RateLimiter(1, 1000);

function testRequest() {
    axios.get('http://localhost:5000/api')
    .then(res => {
        console.log(res.data);
    })
    .catch(err => {
        console.log(err);
    });
}

function getDDragonChampKeys() {
    return axios.get('http://ddragon.leagueoflegends.com/cdn/9.21.1/data/en_US/championFull.json')
    .then(res => {
        let champFullData = res.data;
        let keys = champFullData["keys"];
        return keys;
    })
    .catch(err => {
        console.log(err);
        throw err;
    });
}

function getQueueType(queueID) {
    return axios.get('http://static.developer.riotgames.com/docs/lol/queues.json')
    .then(res => {
        let dataArray = res.data;
        for(let i = 0; i < dataArray.length; i++) {
            let dataObj = dataArray[i];
            if(dataObj["queueId"] == queueID) {
                return dataObj["description"];
            }
        }
        console.log(`queueID ${queueID} not found.`);
        return null;
    })
    .catch(err => {
        console.log(err);
        throw err;
    });
}

function getLOLSummonerID(summonerName) {
    return axios({
        url: `https://na1.api.riotgames.com/lol/summoner/v4/summoners/by-name/${summonerName}`,
        method: 'get',
        headers: {
            "X-Riot-Token": API_TOKEN
        }
    })
    .then(res => {
        let data = res.data;
        console.log(data);
        let summonerID = data["id"];
        return summonerID;
    })
    .catch(err => {
        console.log(err);
        throw err;
    });
}

function getLOLAccountID(summonerName) {
    return axios({
        url: `https://na1.api.riotgames.com/lol/summoner/v4/summoners/by-name/${summonerName}`,
        method: 'get',
        headers: {
            "X-Riot-Token": API_TOKEN
        }
    })
    .then(res => {
        let data = res.data;
        let accountID = data["accountId"];
        return accountID;
    })
    .catch(err => {
        console.log(err);
        throw err;
    });
}

// common queue types:
// 400: Draft Pick
// 420: Ranked Solo/Duo
// 430: Blind Pick
// 440: Ranked Flex
// 450: ARAM
// 460: Twisted Treeline 3v3

function getMatchList(summonerID, queueTypes) {
    let requestURL = null;
    requestURL = `https://na1.api.riotgames.com/lol/match/v4/matchlists/by-account/${summonerID}`;
    
    if(queueTypes !== undefined) {
        if(typeof(queueTypes) == 'number') {
            requestURL += `?queue=${queueTypes}`;
        } else if(typeof(queueTypes) == 'object') {
            for(let i = 0; i < queueTypes.length; i++) {
                let queueType = queueTypes[i];
                if(isNaN(queueType)) {
                    console.log("queueType is not a number.");
                    return null;
                }
                if(i === 0) {
                    requestURL += `?queue=${queueType}`;
                } else {
                    requestURL += `&queue=${queueType}`;
                }
            }
        } else {
            return null;
        }
    }
    return axios({
        url: requestURL,
        method: 'get',
        headers: {
            "X-Riot-Token": API_TOKEN
        }
    })
    .then(res => {
        let data = res.data["matches"];
        // console.log(data);
        return data;
    })
    .catch(err => {
        console.log(err);
        throw err;
    });
}

function getStatsByGame(gameID, championID) {
    return axios({
        url: `https://na1.api.riotgames.com/lol/match/v4/matches/${gameID}`,
        method: 'get',
        headers: {
            "X-Riot-Token": API_TOKEN
        }
    })
    .then(res => {
        let data = res.data;
        let playerDataArr = data["participants"];
        for(let i = 0; i < playerDataArr.length; i++) {
            let playerData = playerDataArr[i];
            // console.log(playerData["championId"]);
            if(playerData["championId"] == championID) {
                return playerData["stats"];
            }
        }
        throw "championID not found";
    })
    // .then(data => {
    //     console.log(data);
    // })
    .then(({win, kills, assists, deaths, wardsPlaced, totalMinionsKilled, totalDamageDealt, totalDamageDealtToChampions, goldEarned}) => {
        let essentialInfo = {win, kills, assists, deaths, wardsPlaced, totalMinionsKilled, totalDamageDealt, totalDamageDealtToChampions, goldEarned};
        // console.log(essentialInfo);
        return essentialInfo;
    })
    .catch(err => {
        console.log(err);
        throw err;
    });
}

function getStats(summonerName, queueType, numGames) {
    if(isNaN(numGames)) {
        console.log("Please request a numeric value for numGames.");
        return null;
    } else if(numGames < 1) {
        console.log("Please request numGames of at least 1.");
        return null;
    }
    let maxNumGames = 5;
    let numGamesRetrieved = numGames > maxNumGames ? maxNumGames : numGames;
    console.log(numGamesRetrieved);
    return getLOLAccountID(summonerName)
    .then(id => {
        console.log(id);
        return getMatchList(id, queueType)
        .then(matchList => {
            // uses object destructuring
            let gameInfoArr = matchList.map(({ gameId, champion }) => {
                return { gameId, champion };
            });
            // for debugging purposes
            // console.log(gameInfoArr);
            return gameInfoArr;
        })
        .then(gameInfoArr => {
            if(numGamesRetrieved > gameInfoArr.length) {
                numGamesRetrieved = gameInfoArr.length;
            }

            let gamesRetrieved = gameInfoArr.slice(0, numGamesRetrieved);

            let statsArray = [];

            // non rate limited version
            if(false) {
                statsArray = Promise.all(gamesRetrieved.map(gameInfo => {
                    // getStatsByGame needs to be rate limited
                    return getStatsByGame(gameInfo["gameId"], gameInfo["champion"])
                    .catch(err => {
                        throw err;
                    });
                }))
                .catch(err => {
                    throw err;
                });
            } else { // testing rate limited version
                // rate limited version works
                // current rate limit is 1 per second: overly conservative
                gamesRetrieved.map(gameInfo => {
                    limiter.removeTokens(1, (err, requestsRemaining) => {
                        getStatsByGame(gameInfo["gameId"], gameInfo["champion"])
                        .then(stats => {
                            statsArray.push(stats);
                        })
                        .catch(err => {
                            console.log(err);
                        });
                    });
                });
            }

            return statsArray;
        })
        .catch(err => {
            throw err;
        });
    })
    .catch(err => {
        console.log(err);
    });
}

function getPokemonName(pokedexID) {
    if(isNaN(pokedexID)) {
        return null;
    }
    return axios.get(`https://pokeapi.co/api/v2/pokemon/${pokedexID}`)
    .then(res => {
        // console.log(res.data);
        return res.data["forms"][0]["name"];
    })
    .catch(err => {
        console.log(err);
        throw err;
    });
}

function promiseAllTest() {
    let idArray = [1, 2, 3, 4, 5];

    Promise.all(idArray.map(id => {
        return getPokemonName(id)
        .catch(err => {
            throw err;
        });
    }))
    .then(array => {
        console.log("succeeded!");
        console.log(array);
    })
    .catch(err => {
        console.log("failed!");
        console.log(err);
    });
}



// testRequest();

// printResult(getDDragonChampKeys);
// getLOLSummonerID("TitaniumGod");
let stats = getStats("TitaniumGod", [420, 430], 5);

setTimeout(() => {
    stats
    .then(statsArr => {
        console.log(statsArr);
    })
    .catch(err => {
        console.log(err);
    });
}, 10000);

// can only make 20 requests per second
// can only make 100 requests per 2 minutes
// getStatsByGame(3192594419, 74);

// getPokemonData(1);
// promiseAllTest();