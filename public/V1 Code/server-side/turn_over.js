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

const GetChannelData = async channelId => {
    const params = {
        TableName: 'Twitch-Ext-Viewers',
        Key: { channel: channelId }
    };

    const channelData = await documentClient.get(params).promise();

    if (channelData.Item) return channelData.Item;

    console.error('No table for channel ' + channelId);
    return {};
};

// const RemoveOldData = async channelId => {
//     const params = {
//         TableName: STRINGS.tableName,
//         Key: {
//             "channel": channelId
//         },
//         UpdateExpression: "set nextTurn = :nt",
//         ExpressionAttributeValues: {
//             ":nt": {
//                 viewers: {},
//                 spaces: {}
//             }
//         },
//         ReturnValues: "UPDATED_NEW"
//     };

//     console.log("Clearing NextTurn data...");
//     await documentClient.update(params, function (err, data) {
//         if (err) {
//             console.error("Unable to update item. Error JSON: ", JSON.stringify(err, null, 2));
//         } else {
//             console.log("UpdateItem succeeded: ", JSON.stringify(data, null, 2));
//         }
//     }).promise();
// }

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
            event: "TURN_OVER",
            data: channelData
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
    console.log('Take-Turn');
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
    console.log('event.body: ' + JSON.stringify(event.body));
    console.log('event: ' + JSON.stringify(event));

    // Return error if verification failed.
    if (payload.err) return response(401, JSON.stringify(payload));

    // Get channel data from database, if no entry is found create one.
    const channelData = await GetChannelData(payload.channel_id);
    if (!channelData) return response(500, `Internal Server Error : ${STRINGS.teamData}`);

    // await RemoveOldData(payload.channel_id);

    return Promise.all([SendDataBroadcast(channelData)])
        .then(() => response(200, {
            event: "TURN_OVER",
            data: channelData
        }))
        .catch(err => {
            console.warn(err);
            response(500, 'Internal Server Error');
        });
};