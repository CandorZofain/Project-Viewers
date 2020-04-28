// function Test() {
//     console.log('Test');
// };

// exports.Test = Test;

const jwt = require('jsonwebtoken');
const request = require('request-promise');

const SECRET = 'kgT/j+J5zN3WoBxAxoBnBM3wVe3CEX3Y1aV8NKYAZyk=';

const VerifyAndDecode = auth => {
    const bearerPrefix = 'Bearer ';
    if (!auth || !auth.startsWith(bearerPrefix)) return { err: 'Invalid authorization header' };
    try {
        const token = auth.substring(bearerPrefix.length);
        return jwt.verify(token, Buffer.from(SECRET, 'base64'), { algorithms: ['HS256'] });
    } catch (err) {
        return { err: 'Invalid JWT' };
    }
};

const MakeServerToken = (channelID, userID) => {
    const serverTokenDurationSec = 30;

    const payload = {
        exp: Math.floor(Date.now() / 1000) + serverTokenDurationSec,
        channelID: '' + channelID,
        user_id: userID,
        role: 'external',
        pubsub_perms: {
            send: ['*']
        }
    };

    const secret = Buffer.from(SECRET, 'base64');
    return jwt.sign(payload, secret, { algorithm: 'HS256' });
};

const SendDataBroadcast = (channelID, userID, data) => {
    // Set the HTTP headers required by the Twitch API.
    const bearerPrefix = 'Bearer ';
    const headers = {
        'Client-ID': 'njydti6v8hjhgjlreu1pbacttmu5sc',
        'Content-Type': 'application/json',
        'Authorization': bearerPrefix + MakeServerToken(channelID, userID),
    };

    // Create the POST body for the Twitch API request.
    const body = JSON.stringify({
        content_type: 'application/json',
        message: JSON.stringify(data),
        targets: ['broadcast'],
    });

    // Send the broadcast request to the Twitch API.
    const options = {
        url: `https://api.twitch.tv/extensions/message/${channelID}`,
        method: 'POST',
        headers,
        body,
    };

    return request(options);
};

exports.VerifyAndDecode = VerifyAndDecode;
exports.SendDataBroadcast = SendDataBroadcast;