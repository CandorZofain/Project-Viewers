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

const UpdateChannelData = async channelData => {
    const params = {
        TableName: STRINGS.tableName,
        Key: {
            "channel": channelData.channel
        },
        UpdateExpression: "set nextTurn = :nt, #sp = :s, teams = :t, viewers = :v",
        ExpressionAttributeNames: {
            "#sp": "spaces",
        },
        ExpressionAttributeValues: {
            ":nt": channelData.nextTurn,
            ":s": channelData.spaces,
            ":t": channelData.teams,
            ":v": channelData.viewers
        },
        ReturnValues: "UPDATED_NEW"
    };

    console.log("Updating data...");
    await documentClient.update(params, function (err, data) {
        if (err) {
            console.error("Unable to update item. Error JSON: ", JSON.stringify(err, null, 2));
        } else {
            console.log("UpdateItem succeeded: ", JSON.stringify(data, null, 2));
        }
    }).promise();
}

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

    // console.log('ownerId: ' + process.env.ownerId);

    const secret = Buffer.from(process.env.secret, 'base64');
    return jwt.sign(payload, secret, { algorithm: 'HS256' });
};

const SendDataBroadcast = channelData => {
    // Set the HTTP headers required by the Twitch API.
    const bearerPrefix = 'Bearer ';
    const headers = {
        'Client-ID': 'njydti6v8hjhgjlreu1pbacttmu5sc',
        'Content-Type': 'application/json',
        'Authorization': bearerPrefix + makeServerToken(channelData.channel),
    };

    // Create the POST body for the Twitch API request.
    const body = JSON.stringify({
        content_type: 'application/json',
        message: JSON.stringify({
            event: "START_TURN"
        }),
        targets: ['broadcast'],
    });

    // Send the broadcast request to the Twitch API.
    const options = {
        url: `https://api.twitch.tv/extensions/message/${channelData.channel}`,
        method: 'POST',
        headers,
        body,
    };

    // console.log('Options: ' + JSON.stringify(options));

    return request(options);
};

exports.handler = async event => {
    console.log('start-turn');
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
    console.log(JSON.parse(event.body));
    console.log('event: ' + JSON.stringify(event));

    // Return error if verification failed.
    if (payload.err) return response(401, JSON.stringify(payload));

    await UpdateChannelData(JSON.parse(event.body));

    return Promise.all([SendDataBroadcast(JSON.parse(event.body))])
        .then(() => response(200, {
            event: "START_TURN"
        }))
        .catch(err => {
            console.warn(err);
            response(500, 'Internal Server Error');
        });
};