const AWS = require('aws-sdk');
const documentClient = new AWS.DynamoDB.DocumentClient({ region: 'us-east-2' });
const jwt = require('jsonwebtoken');
const Promise = require('bluebird');
const broadcast = require('./broadcast');

const STRINGS = {
    teamData: 'Unable to retrieve team data',
    tableName: 'Twitch-Ext-Viewers'
}

const TEAM_TO_INT = {
    blue: 0,
    green: 1,
    red: 2,
    yellow: 3
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
}

const setVote = async function (channelData, userId, body) {

    let vote = TEAM_TO_INT[body.vote];   // The vote (int)
    let user = channelData.viewers[userId]; // User data from database
    let votes = channelData.teams[user.team].votes; // Team votes from database

    // Do nothing if vote is the same as before
    if (vote == user.vote) {
        return channelData;
    }

    votes[vote]++;  // Increase vote
    if (user.vote != -1) {  // Decrease previous vote
        votes[user.vote]--;
    }
    user.vote = vote;   // Update user vote

    // Update channelData
    channelData.teams[user.team].votes = votes;
    channelData.viewers[userId] = user;

    const params = {
        TableName: STRINGS.tableName,
        Key: {
            "channel": channelData.channel
        },
        UpdateExpression: 'set teams.#team.votes = :votes, viewers.#viewer.vote = :vote',
        ExpressionAttributeNames: {
            '#team': user.team,
            '#viewer': userId
        },
        ExpressionAttributeValues: {
            ':votes': votes,
            ':vote': vote
        },
        ReturnValues: "UPDATED_NEW"
    };

    console.log("Updating the item...");
    console.log("Params: " + JSON.stringify(params));
    await documentClient.update(params, function (err, data) {
        if (err) {
            console.error("Unable to update item. Error JSON: ", JSON.stringify(err, null, 2));
        } else {
            console.log("UpdateItem succeeded: ", JSON.stringify(data, null, 2));
        }
    }).promise();

    return channelData;
}

exports.handler = async (event) => {
    // Response function
    const response = (statusCode, body) => {
        const headers = {
            ['Access-Control-Allow-Origin']: event.headers.origin
        };

        return { statusCode, body: JSON.stringify(body, null, 2), headers };
    };

    // Verify all requests.
    const payload = verifyAndDecode(event.headers.Authorization);
    console.log('event.body: ' + JSON.stringify(event.body));
    // console.log('event: ' + JSON.stringify(event));
    console.log('payload: ' + JSON.stringify(payload));

    // Return error if verification failed.
    if (payload.err) return response(401, JSON.stringify(payload));

    // Get channel data from database, if no entry is found create one.
    let channelData = await getChannelData(payload.channel_id);
    if (!channelData) return response(500, `Internal Server Error : ${STRINGS.teamData}`);

    channelData = await setVote(channelData, payload.user_id, JSON.parse(event.body));

    return Promise.all([broadcast(channelData)])
        .then(() => response(200, channelData.teams))
        .catch(err => {
            console.warn(err);
            response(500, 'Internal Server Error');
        });
};