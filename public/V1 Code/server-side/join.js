const AWS = require('aws-sdk');
const documentClient = new AWS.DynamoDB.DocumentClient({ region: 'us-east-2' });
const jwt = require('jsonwebtoken');
const request = require('request-promise');

const STRINGS = {
    teamData: 'Unable to retrieve team data',
    tableName: 'Twitch-Ext-Viewers'
};

const verifyAndDecode = auth => {
    const bearerPrefix = 'Bearer ';
    if (!auth.startsWith(bearerPrefix)) return { err: 'Invalid authorization header' };
    try {
        const token = auth.substring(bearerPrefix.length);
        const secret = process.env.secret;
        return jwt.verify(token, Buffer.from(secret, 'base64'), { algorithms: ['HS256'] });
    } catch (err) {
        return { err: 'Invalid JWT' };
    }
};

const getChannelData = async channelId => {
    const params = {
        TableName: 'Twitch-Ext-Viewers',
        Key: { channel: channelId }
    };

    const channelData = await documentClient.get(params).promise();

    if (channelData.Item) return channelData.Item;

    const newEntry = {
        TableName: STRINGS.tableName,
        Item: {
            channel: channelId,
            viewers: {},
            teams: {
                1: {
                    color: '2F55DE',
                    hp: 100,
                    repairs: 0,
                    count: 0
                },
                2: {
                    color: 'EB4D4D',
                    hp: 100,
                    repairs: 0,
                    count: 0
                }
            },
            spaces: {},
            nextTurn: {
                viewers: {},
                spaces: {}
            }
        }
    };

    console.log('Creating item...');
    await documentClient.put(newEntry).promise();
    return newEntry.Item;
};

const getStartingData = async function (channelData, userId) {
    let user = channelData.viewers[userId];

    if (user) {
        console.log('Existing user: ' + userId);
        return {
            userId: userId,
            user: user,
            teams: channelData.teams,
            spaces: channelData.spaces
        };
    }

    let team = 0;
    let minCount = Infinity;
    Object.keys(channelData.teams).forEach(key => {
        if (channelData.teams[key].count < minCount) {
            minCount = channelData.teams[key].count;
            team = key;
        }
    });
    let position = [0, 0];
    switch (team) {
        case '1':
            position = [2, 2];
            break;
        case '2':
            position = [-1, -1];
            break;
        default:
            console.error('invalid team: ' + team);
            return;
    }
    let plusOneCount = 1;
    let newX = false;
    if (channelData.spaces[position[0]]) {
        if (channelData.spaces[position[0]][position[1]]) {
            plusOneCount = ++channelData.spaces[position[0]][position[1]].count;
        } else {
            channelData.spaces[position[0]][position[1]] = {
                count: 1,
                team: team
            };
        }
    } else {
        newX = true;
        channelData.spaces[position[0]] = {};
        channelData.spaces[position[0]][position[1]] = {
            count: 1,
            team: team
        };
    }

    channelData.teams[team].count = channelData.teams[team].count + 1;
    channelData.viewers[userId] = user = {
        team: team,
        element: 'neutral',
        position: position,
        crystals: 0
    };

    const params = {
        TableName: STRINGS.tableName,
        Key: {
            "channel": channelData.channel
        },
        UpdateExpression: "set teams.#team.#c = :ct, viewers.#id = :vs",
        ExpressionAttributeNames: {
            "#team": team,
            "#c": "count",
            "#id": userId,
            "#x": position[0],
            "#space": "spaces"
        },
        ExpressionAttributeValues: {
            ":ct": channelData.teams[team].count,
            ":vs": channelData.viewers[userId]
        },
        ReturnValues: "UPDATED_NEW"
    };
    if (newX) {
        params.UpdateExpression += ", #space.#x = :sp";
        let mapping = {};
        mapping[position[1]] = {
            count: plusOneCount,
            team: team
        };
        params.ExpressionAttributeValues[":sp"] = mapping;
    } else {
        params.UpdateExpression += ", #space.#x.#y = :sp";
        params.ExpressionAttributeNames["#y"] = position[1];
        params.ExpressionAttributeValues[":sp"] = {
            count: plusOneCount,
            team: team
        };
    }

    console.log("Updating the item...");
    await documentClient.update(params, function (err, data) {
        if (err) {
            console.error("Unable to update item. Error JSON: ", JSON.stringify(err, null, 2));
        } else {
            console.log("UpdateItem succeeded: ", JSON.stringify(data, null, 2));
        }
    }).promise();

    return {
        userId: userId,
        user: user,
        teams: channelData.teams,
        spaces: channelData.spaces
    };
};

// Create and return a JWT for use by this service.
const makeServerToken = channelID => {
    const serverTokenDurationSec = 30;

    const payload = {
        exp: Math.floor(Date.now() / 1000) + serverTokenDurationSec,
        channel_id: '' + channelID,
        user_id: process.env.ownerId,
        role: 'external',
        pubsub_perms: {
            send: ['*'],
        },
    };

    const secret = Buffer.from(process.env.secret, 'base64');
    return jwt.sign(payload, secret, { algorithm: 'HS256' });
};

const SendDataBroadcast = (channelId, data) => {
    // Set the HTTP headers required by the Twitch API.
    const bearerPrefix = 'Bearer ';
    const headers = {
        'Client-ID': 'njydti6v8hjhgjlreu1pbacttmu5sc',
        'Content-Type': 'application/json',
        'Authorization': bearerPrefix + makeServerToken(channelId),
    };

    // Create the POST body for the Twitch API request.
    const body = JSON.stringify({
        content_type: 'application/json',
        message: JSON.stringify({
            event: "USER_JOINED",
            userId: data.userId,
            user: data.user,
            teams: data.teams,
            spaces: data.spaces
        }),
        targets: ['broadcast'],
    });

    // Send the broadcast request to the Twitch API.
    const options = {
        url: `https://api.twitch.tv/extensions/message/${channelId}`,
        method: 'POST',
        headers,
        body,
    };

    console.log('Options: ' + JSON.stringify(options));

    return request(options);
};

exports.handler = async event => {
    console.log('New join function');

    // Response function
    const response = (statusCode, body) => {
        console.log(event.headers.origin);
        const headers = {
            ['Access-Control-Allow-Origin']: event.headers.origin
        };

        return { statusCode, body: JSON.stringify(body, null, 2), headers };
    };

    // Verify all requests.
    const payload = verifyAndDecode(event.headers.Authorization);
    console.log('payload: ' + JSON.stringify(payload));

    // Return error if verification failed.
    if (payload.err) return response(401, JSON.stringify(payload));

    // Get channel data from database, if no entry is found create one.
    const channelData = await getChannelData(payload.channel_id);
    if (!channelData) return response(500, `Internal Server Error : ${STRINGS.teamData}`);

    const teamData = await getStartingData(channelData, payload.user_id);

    var res = response(200, {
        userId: teamData.userId,
        user: teamData.user,
        nextTurn: channelData.nextTurn,
        viewers: channelData.viewers
    });
    console.log('Response: ' + JSON.stringify(res));
    return Promise.all([SendDataBroadcast(channelData.channel, teamData)])
        .then(() => res)
        .catch(err => {
            console.warn(err);
            response(500, 'Unable to send broadcast');
        });
};