"use strict";

// var mapScript = require('./map.js');
// var global = require('./GlobalFunctions.js');

// var user = {
//     id: "",
//     isHost: false
// };
var map, player;
var gameState;

var userId = "";
var channelId = "";

var twitch = window.Twitch.ext;
var auth;
var token;

const IS_AWS = true;
const BASE_IP = 'project-for-viewers.com';
const LOCAL_IP = 'localhost';
const PORT = '30000';
let socket;

// const TEAM_TO_COLOR = {
//     1: '#2f55de',
//     2: '#eb4d4d',
// }

// const ELEMENTS = ['neutral', 'fire', 'wind', 'earth', 'water'];

// const ELEMENT_TO_INT = {
//     neutral: 0,
//     fire: 1,
//     wind: 2,
//     earth: 3,
//     water: 4
// }

function Log (message, enabled) {
    if (enabled) {
        console.log(user.id, message);
    }
}

// Ensures that the UserID is sent to the server
twitch.actions.requestIdShare();

// No idea
// twitch.onContext(function (context) {
//     console.log(context);
// });

// Authorizes the user. Creates token necessary for server communication
twitch.onAuthorized(function (_auth) {
    // save our credentials
    token = _auth.token;
    channelId = _auth.channelId;

    auth = 'Bearer ' + token;

    SetupSocket();
});

let SetupSocket = () => {
    console.log('Attempting to open socket');
    if (typeof (WebSocket) !== 'undefined') {
        socket = new WebSocket((IS_AWS ? 'wss://' + BASE_IP : 'ws://' + LOCAL_IP) + ':' + PORT);
        socket.onopen = () => {
            document.title = 'Project Viewers';
            socket.send(JSON.stringify({
                event: 'join',
                Authorization: auth
            }));
        }
        socket.onclose = () => {
            console.log('Socket closed');
        }
        socket.onmessage = message => {
            try {
                message = JSON.parse(message.data);
            } catch (err) {
                global.Error(`Unable to parse message`);
                console.error(message);
                return;
            }

            switch (message.event) {
                case 'error':
                    global.Error(message.message);
                    break;
                case 'join':
                    global.Log('Connection successful');
                    gameState = message.data;
                    map = new MapState();
                    player = new Player();
                    map.UpdateMap();
                    map.StartCountdownUpdates();
                    break;
                case 'update':
                    gameState = message.data;
                    map.UpdateMap();
                    map.UpdatePlayerTab();
                    break;
                case 'startTurn':
                    player.StartTurn();
                    break;
                case 'endGame':
                    map.EndGame(message.data);
                    break;
                default:
                    global.Error(`Member 'event' is missing or invalid. Received: ${message.event}`);
                    break;
            }
        }
    } else {
        console.log('WebSocket is undefined');
    }
};
