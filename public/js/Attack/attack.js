const AWS = require('aws-sdk');
const documentClient = new AWS.DynamoDB.DocumentClient({ region: 'us-east-2' });
const jwt = require('jsonwebtoken');
const Promise = require('bluebird');
const broadcast = require('./broadcast_attack');

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

const INT_TO_TEAM = {
    0: 'blue',
    1: 'green',
    2: 'red',
    3: 'yellow'
};

const logPower = Math.log(3.0 / 2.0) / Math.log(2.0);
const baseAttack = 100.0;

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

const getAttackData = async function () {
    const channelData = arguments[0];
    console.log('channelData: ' + JSON.stringify(channelData));

    let teamVotes = {
        blue: {
            choice: "",
            percent: 0
        },
        green: {
            choice: "",
            percent: 0
        },
        red: {
            choice: "",
            percent: 0
        },
        yellow: {
            choice: "",
            percent: 0
        }
    }

    Object.keys(channelData.teams).forEach(key => {
        let choice = "";
        let minCount = 0;
        let totalVotes = 0;
        for (let i = 0; i < 4; i++) {
            const voteCount = channelData.teams[key].votes[i];
            if (voteCount > minCount) {
                choice = INT_TO_TEAM[i];
                minCount = voteCount;
            }
            totalVotes += voteCount;
        }
        teamVotes[key].choice = choice;
        if (totalVotes > 0) {
            teamVotes[key].percent = Math.pow(minCount / totalVotes, logPower);
        } else {
            teamVotes[key].percent = 0;
        }
    });

    return {
        baseAttack: baseAttack,
        teamVotes: teamVotes
    };
}

const resetVotes = async function () {
    const channelData = arguments[0];
    let updateExpression = '';

    const params = {
        TableName: STRINGS.tableName,
        Key: {
            "channel": channelData.channel
        },
        UpdateExpression: 'set ' + updateExpression,
        ExpressionAttributeValues: {},
        ReturnValues: "UPDATED_NEW"
    };

    async function Update(params) {
        await documentClient.update(params, function (err, data) {
            if (err) {
                console.error("Unable to update item. Error JSON: ", JSON.stringify(err, null, 2));
            } else {
                console.log("UpdateItem succeeded: ", JSON.stringify(data, null, 2));
            }
        }).promise();
    }

    console.log("Updating the items...");
    // console.log("Params: " + JSON.stringify(params));
    params.ExpressionAttributeValues[':var'] = [0, 0, 0, 0];
    Object.keys(channelData.teams).forEach(key => {
        params.UpdateExpression = `set teams.${key}.votes = :var`;
        Update(params);
    });
    params.ExpressionAttributeValues[':var'] = -1;
    params.ExpressionAttributeNames = {};
    Object.keys(channelData.viewers).forEach(key => {
        params.UpdateExpression = `set viewers.#uid.vote = :var`;
        params.ExpressionAttributeNames['#uid'] = key;
        Update(params);
    });
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
    // console.log('event.body: ' + JSON.stringify(event.body));
    // console.log('event: ' + JSON.stringify(event));
    console.log('payload: ' + JSON.stringify(payload));
    if (payload.channel_id != payload.user_id) {
        return response(401, 'Only broadcaster may initiate the attack');
    }

    // Return error if verification failed.
    if (payload.err) return response(401, JSON.stringify(payload));

    // Get channel data from database, if no entry is found create one.
    let channelData = await getChannelData(payload.channel_id);
    if (!channelData) return response(500, `Internal Server Error : ${STRINGS.teamData}`);

    let attackData = await getAttackData(channelData);
    console.log('attackData: ' + JSON.stringify(attackData));
    resetVotes(channelData);

    return Promise.all([broadcast(channelData, attackData)])
        .then(() => response(200, attackData))
        .catch(err => {
            console.warn(err);
            response(500, 'Internal Server Error: ' + err);
        });
};