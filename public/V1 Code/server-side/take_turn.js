const AWS = require('aws-sdk');
const documentClient = new AWS.DynamoDB.DocumentClient({ region: 'us-east-2' });
const jwt = require('jsonwebtoken');

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

const SetTurnData = async function (channelData, turnData, userId) {
    let pos = turnData.position;

    const params = {
        TableName: STRINGS.tableName,
        Key: {
            "channel": channelData.channel
        },
        UpdateExpression: "set nextTurn.viewers.#id = :v",
        ExpressionAttributeNames: {
            "#id": userId,
            "#sp": "spaces",
            "#x": pos[0]
        },
        ExpressionAttributeValues: {
            ":v": turnData
        },
        ReturnValues: "UPDATED_NEW"
    }

    let spaces = channelData.nextTurn.spaces;
    let team = channelData.viewers[userId].team;

    if (spaces[pos[0]]) {
        if (spaces[pos[0]][pos[1]]) {
            params.UpdateExpression += ", nextTurn.#sp.#x.#y.#t = :s"
            params.ExpressionAttributeNames["#y"] = pos[1];
            params.ExpressionAttributeNames["#t"] = team;

            if (spaces[pos[0]][pos[1]][team]) {
                params.ExpressionAttributeValues[":s"] =
                    spaces[pos[0]][pos[1]][team].concat(userId);
            } else {
                params.ExpressionAttributeValues[":s"] = [userId];
            }
        } else {
            params.UpdateExpression += ", nextTurn.#sp.#x.#y = :s"
            params.ExpressionAttributeNames["#y"] = pos[1];
            let mapping = {};
            mapping[team] = [userId];
            params.ExpressionAttributeValues[":s"] = mapping;
        }
    } else {
        params.UpdateExpression += ", nextTurn.#sp.#x = :s"
        let mapping = {};
        mapping[pos[1]] = {};
        mapping[pos[1]][team] = [userId];
        params.ExpressionAttributeValues[":s"] = mapping;
    }

    console.log("Updating the item...");
    let truth;
    await documentClient.update(params, function (err, data) {
        if (err) {
            console.error("Unable to update item. Error JSON: ", JSON.stringify(err, null, 2));
            truth = false;
        } else {
            console.log("UpdateItem succeeded: ", JSON.stringify(data, null, 2));
            truth = true;
        }
    }).promise();

    return truth;
}

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

    let res;
    if (await SetTurnData(channelData, JSON.parse(event.body), payload.user_id)) {
        res = response(200, "Update item succeeded");
    } else {
        res = response(500, "Unable to update item. See server logs for details");
    }
    console.log('Response: ' + JSON.stringify(res));
    return res;
};