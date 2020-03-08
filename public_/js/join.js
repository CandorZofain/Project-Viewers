const AWS = require('aws-sdk');
const documentClient = new AWS.DynamoDB.DocumentClient({ region: 'us-east-2' });
const jwt = require('jsonwebtoken');

const STRINGS = {
    teamData: 'Unable to retrieve team data',
    tableName: 'Twitch-Ext-Viewers'
}

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
                blue: {
                    count: 0,
                    votes: [0, 0, 0, 0]
                },
                red: {
                    count: 0,
                    votes: [0, 0, 0, 0]
                },
                yellow: {
                    count: 0,
                    votes: [0, 0, 0, 0]
                },
                green: {
                    count: 0,
                    votes: [0, 0, 0, 0]
                }
            }
        }
    };

    console.log('Creating item...');
    await documentClient.put(newEntry).promise();
    return newEntry.Item;
}

const getTeamData = async function (channelData, userId) {
    let user = channelData.viewers[userId];

    function teamData(team) {
        return {
            team: team,
            votes: channelData.teams[team].votes
        };
    }

    if (user) {
        return teamData(user.team);
    }

    let team = "";
    let minCount = Infinity;
    Object.keys(channelData.teams).forEach(key => {
        if (channelData.teams[key].count < minCount) {
            minCount = channelData.teams[key].count;
            team = key;
        }
    });

    const params = {
        TableName: STRINGS.tableName,
        Key: {
            "channel": channelData.channel
        },
        UpdateExpression: "set teams.#team.#c = :ct, viewers.#id = :vs",
        ExpressionAttributeNames: {
            "#team": team,
            "#c": "count",
            "#id": userId
        },
        ExpressionAttributeValues: {
            ":ct": channelData.teams[team].count + 1,
            ":vs": {
                team: team,
                vote: -1
            }
        },
        ReturnValues: "UPDATED_NEW"
    };

    console.log("Updating the item...");
    await documentClient.update(params, function (err, data) {
        if (err) {
            console.error("Unable to update item. Error JSON: ", JSON.stringify(err, null, 2));
        } else {
            console.log("UpdateItem succeeded: ", JSON.stringify(data, null, 2));
        }
    }).promise();

    return teamData(team);
};

exports.handler = async event => {
    // Response function
    const response = (statusCode, body) => {
        const headers = {
            ['Access-Control-Allow-Origin']: event.headers.origin
        };

        return { statusCode, body: JSON.stringify(body, null, 2), headers };
    };

    // Verify all requests.
    const payload = verifyAndDecode(event.headers.Authorization);
    // console.log('payload: ' + JSON.stringify(payload));

    // Return error if verification failed.
    if (payload.err) return response(401, JSON.stringify(payload));

    // Get channel data from database, if no entry is found create one.
    const channelData = await getChannelData(payload.channel_id);
    if (!channelData) return response(500, `Internal Server Error : ${STRINGS.teamData}`);

    const teamData = await getTeamData(channelData, payload.user_id);

    var res = response(200, teamData);
    console.log('Response: ' + JSON.stringify(res));
    return res;
};