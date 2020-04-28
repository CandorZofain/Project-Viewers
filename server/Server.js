'use strict';

process.title = 'Project Viewers Server';

let ws_cfg = {
    ssl: true,
    port: 30000,
    ssl_key: '/etc/letsencrypt/live/project-for-viewers.com/privkey.pem',
    ssl_cert: '/etc/letsencrypt/live/project-for-viewers.com/fullchain.pem'
}

var WebSocketServer = require('websocket').server;
var fs = require('fs');
var http = require('http');
var httpServ = require('https');
var twitch = require('./TwitchFunctions.js');
var global = require('./GlobalFunctions.js');
var gameState = require('./GameState.js');

/**
 * Global variables
 */
let games = {};

/**
 * Helper function for escaping input strings
 */
// function htmlEntities (str) {
//     return String(str)
//         .replace(/&/g, '&amp;').replace(/</g, '&lt;')
//         .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// };

// var server = httpServ.createServer({
//     key: fs.readFileSync(ws_cfg.ssl_key),
//     cert: fs.readFileSync(ws_cfg.ssl_cert)
// });
var server = http.createServer(function (request, response) { });
server.listen(ws_cfg.port, () => {
    global.Log('Server is listening on port ' + ws_cfg.port);
});

/**
 * WebSocket server
 */
var wsServer = new WebSocketServer({
    httpServer: server
});

wsServer.on('request', request => {
    global.Log(`Connection from origin ${request.origin}.`);

    let connection = request.accept(null, request.origin);
    let player_id, channel_id, game, successfullyJoined;

    // global.Log('Connection accepted.');

    // This is the most important callback for us, we'll handle
    // all message from users here.
    connection.on('message', message => {
        if (message.type === 'utf8') { // accept only text
            // process WebSocket message
            try {
                message = JSON.parse(message.utf8Data);
            } catch (err) {
                connection.sendUTF(JSON.stringify({
                    event: 'error',
                    message: err.message
                }));
                return;
            }

            const payload = twitch.VerifyAndDecode(message.Authorization);
            // global.Log(JSON.stringify(payload));
            if (payload.err) {
                connection.sendUTF(JSON.stringify({
                    event: 'error',
                    message: payload.err
                }));
                return;
            }

            player_id = payload.user_id;
            channel_id = payload.channel_id;
            game = games[channel_id];
            successfullyJoined = false;

            switch (message.event) {
                case 'join':
                    if (!game) {
                        game = games[channel_id] = new gameState.Game(channel_id);
                        global.Log(`Game for streamer ${channel_id} is opened`);
                    }

                    let success = game.AddPlayer(player_id, connection);
                    if (success) {
                        successfullyJoined = true;
                        global.Log(`Player with id ${player_id} joined game ${channel_id}`);
                        connection.sendUTF(JSON.stringify({
                            event: 'join',
                            message: `Successfully joined game ${channel_id}`,
                            data: game.GetDataForPlayer(player_id)
                        }))
                    } else {
                        connection.sendUTF(JSON.stringify({
                            event: 'error',
                            message: `Failed to join`
                        }));
                        connection.close();
                    }

                    game.SendMapUpdateForAll();

                    break;
                case 'move':
                    game.PlayerMove(player_id, message.data);
                    // TODO 2: Change when players get team info
                    // games[channel_id].SendTeamData(user_id);
                    break;
                case 'defend':
                    game.PlayerDefend(player_id);
                    // TODO: Include when players get team info
                    // games[channel_id].SendTeamData(user_id);
                    break;
                case 'gather':
                    game.PlayerGather(player_id);
                    // TODO: Change when players get team info
                    // games[channel_id.SendTeamData(user_id);
                    break;
                case 'repair':
                    game.PlayerRepair(player_id);
                    // TODO: Include when players get team info
                    // games[channel_id].SendTeamData(user_id);
                    break;
                case 'changeElement':
                    game.PlayerChangeElement(player_id, message.data);
                    // TODO: Include when players get personal info
                    // games[channel_id].SendUserData(user_id);
                    break;
                case 'start':
                    game.StartNextTurn();
                    break;
                case 'end':
                    game.EndTurn();
                    break;
                default:
                    connection.sendUTF(JSON.stringify({
                        event: 'error',
                        message: `Member 'event' is missing or invalid. Received: ${message.event}`
                    }));
                    break;
            }
        } else {
            connection.sendUTF(JSON.stringify({
                event: 'error',
                message: 'Server only accepts string messages'
            }));
        }
    });

    connection.on('close', connection => {
        if (!successfullyJoined) return;

        // close user connection
        global.Log(`Player with id ${player_id} disconnected from game ${channel_id}`);

        if (channel_id) {
            game.RemovePlayer(player_id);

            if (game.IsEmpty()) {
                delete games[channel_id];
                global.Log(`Game for streamer ${channel_id} is closed`);
            }
        }
    });
});