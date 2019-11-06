var axios = require('axios');
var RateLimiter = require('limiter').RateLimiter;

// class that all calls to League of Legends APIs are made through
// TODO: Convert all axios requests to na1.api.riotgames.com to use RateLimiter
class RequestMaker {
    constructor(apiToken) {
        // limit is one fourth of actual rate limit
        this.limiter = new RateLimiter(25, 120000);
        this.apiToken = apiToken;
        this.gameType = {
            "400": "Draft Pick",
            "420": "Ranked Solo/Duo",
            "430": "Blind Pick",
            "440": "Ranked Flex",
            "450": "ARAM",
            "460": "Twisted Treeline 3v3"
        }
    }

    removeToken() {
        return new Promise((resolve) => {
            this.limiter.removeTokens(1, resolve);
        });
    }

    getDDragonChampKeys() {
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

    getQueueType(queueID) {
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

    getLOLSummonerID(summonerName) {
        return axios({
            url: `https://na1.api.riotgames.com/lol/summoner/v4/summoners/by-name/${summonerName}`,
            method: 'get',
            headers: {
                "X-Riot-Token": this.apiToken
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

    getLOLAccountID(summonerName) {
        return axios({
            url: `https://na1.api.riotgames.com/lol/summoner/v4/summoners/by-name/${summonerName}`,
            method: 'get',
            headers: {
                "X-Riot-Token": this.apiToken
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

    getMatchList(summonerID, queueTypes) {
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
                "X-Riot-Token": this.apiToken
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

    getStatsByGame(gameID, championID) {
        return axios({
            url: `https://na1.api.riotgames.com/lol/match/v4/matches/${gameID}`,
            method: 'get',
            headers: {
                "X-Riot-Token": this.apiToken
            }
        })
        .then(res => {
            let data = res.data;
            let playerDataArr = data["participants"];

            function getPlayerStats() {
                for(let i = 0; i < playerDataArr.length; i++) {
                    let playerData = playerDataArr[i];
                    if(playerData["championId"] == championID) {
                        return playerData["stats"];
                    }
                }
            }

            let fullStats = getPlayerStats();

            function processStats({win, kills, assists, deaths, wardsPlaced, totalMinionsKilled, totalDamageDealt, totalDamageDealtToChampions, goldEarned}) {
                return {win, kills, assists, deaths, wardsPlaced, totalMinionsKilled, totalDamageDealt, totalDamageDealtToChampions, goldEarned};
            } 

            let gameStats = processStats(fullStats);

            let gameInfo = {
                championID,
                gameStats
            };
            return gameInfo;
        })
        // .then(data => {
        //     console.log(data);
        // })
        .catch(err => {
            console.log(err);
            throw err;
        });
    }

    getStats(summonerName, queueType, numGames) {
        if(isNaN(numGames)) {
            console.log("Please request a numeric value for numGames.");
            return null;
        } else if(numGames < 1) {
            console.log("Please request numGames of at least 1.");
            return null;
        }
        let maxNumGames = 20;
        let numGamesRetrieved = numGames > maxNumGames ? maxNumGames : numGames;
        console.log(`numGamesRetrieved: ${numGamesRetrieved}`);
        return this.getLOLAccountID(summonerName)
        .then(id => {
            // console.log(id);
            return this.getMatchList(id, queueType)
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
    
                // non rate limited version
    
                // return Promise.all(gamesRetrieved.map(gameInfo => {
                //     // getStatsByGame needs to be rate limited
                //     return getStatsByGame(gameInfo["gameId"], gameInfo["champion"])
                //     .catch(err => {
                //         throw err;
                //     });
                // }))
                // .catch(err => {
                //     throw err;
                // });
    
                // testing rate limited version (v1)
                // rate limited version works but is a very inelegant solution
                // cannot get the entire statsArray at one time
                // current rate limit is 1 per second: overly conservative
    
                // gamesRetrieved.map(gameInfo => {
                //     limiter.removeTokens(1, (err, requestsRemaining) => {
                //         getStatsByGame(gameInfo["gameId"], gameInfo["champion"])
                //         .then(stats => {
                //             statsArray.push(stats);
                //         })
                //         .catch(err => {
                //             console.log(err);
                //         });
                //     });
                // });
    
                // testing rate limited version (v2)
                // rate limited version works
                // uses promisifying the rate limiter call as suggested in:
                // https://stackoverflow.com/questions/52051275/promisify-callbacks-that-use-rate-limiter
                // current rate limit is 1 per second: overly conservative
    
                return Promise.all(gamesRetrieved.map(gameInfo => {
                    return this.removeToken()
                    .then(() => {
                        return this.getStatsByGame(gameInfo["gameId"], gameInfo["champion"])
                        .catch(err => {
                            throw err;
                        });
                    })
                    .catch(err => {
                        console.log(err);
                        throw err;
                    });
                }))
                // used for debugging
                // .then(data => {
                //     console.log(data);
                // })
                .catch(err => {
                    console.log("some error occurred in promise all"); 
                });
                
            })
            .catch(err => {
                throw err;
            });
        })
        .catch(err => {
            console.log(err);
        });
    }
}


module.exports = RequestMaker;
