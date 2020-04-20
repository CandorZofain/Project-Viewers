// Map dragging variables
let dragStart = [0, 0];
let dragDist = [0, 0];
let dragMax = [0, 0];
let dragging = false;
let boundX = [0, 0];
let boundY = [0, 0];
const DRAG_MULT = 4;
let previousMovement = 0;
const MIN_PIXELS_TO_STOP_CLICK = 10;

const HEX_SIZE = [300, 258, 75]; // Width, Height, (p)
const HEXAGON = 'img/hexagon.png';
const HEXAGON_BASE = 'img/hex-base.png';
const HEXAGON_CRYSTALS = 'img/hex-crystals.png';
const BORDER_ONE = 'img/border-blue.png';
const BORDER_TWO = 'img/border-red.png';

// HTML Elements frequently grabbed
const MAP_BORDER = document.getElementById('border');
const MAP = document.getElementById('map');
const SCRIPTS = [
    'js/hex_data.js',
    'js/player.js'
];

// Game variables
const TURN_TIME_IN_SECONDS = 10;
let turns = 0;
Log('map.js loaded', DEBUG.FUNC_STATEMENTS);

function setStyle (element, property, value) {
    element.style[property] = value + 'px';
}

// Load the map, then create it
var xmlhttp = new XMLHttpRequest();
xmlhttp.onload = function (event) {
    // Get map data
    let data = event.target.response;

    // Team variables
    let teamCount = 0;

    // Create each hexagon
    data.forEach(pos => {
        // x & y position of the hexagon
        let pxX = (HEX_SIZE[0] - HEX_SIZE[2] - 1) * pos[0];
        let pxY = -((HEX_SIZE[1] - 1) * pos[1] + (HEX_SIZE[1] / 2) * pos[0]);

        if (pxX < boundX[0]) {
            boundX[0] = pxX;
        } else if (pxX > boundX[1]) {
            boundX[1] = pxX;
        }
        if (pxY < boundY[0]) {
            boundY[0] = pxY;
        } else if (pxY > boundY[1]) {
            boundY[1] = pxY;
        }

        // Create Hexagon
        // Set the class, position, and innerHTML
        let div = document.createElement('div');
        div.id = `hex_${pos[0]}_${pos[1]}`;
        div.className = `hexagon`;
        setStyle(div, 'left', pxX);
        setStyle(div, 'top', pxY);
        div.style['z-index'] = 2 * pos[1] + pos[0];
        let img = document.createElement('img');
        img.dataset.hex = JSON.stringify(pos);
        img.className = 'hex-img';
        switch (pos[2]) {
            case 0:
                img.src = HEXAGON;
                div.append(img);
                break;
            case 1:
                img.src = HEXAGON_BASE;
                div.innerHTML = `
                    <img src='${teamCount == 0 ? BORDER_ONE : BORDER_TWO}' style='z-index: 2; pointer-events: none' />
                `;
                div.append(img);
                teamCount++;
                break;
            case 2:
                img.src = HEXAGON_CRYSTALS;
                div.append(img);
                break;
            default:
                console.log('Invalid value: ' + pos[2]);
                break;
        }
        // Create onclick function for each hexagon
        img.onclick = event => {
            // console.log(event.currentTarget);
            if (previousMovement < MIN_PIXELS_TO_STOP_CLICK)
                handleHexData(event.currentTarget, JSON.parse(event.currentTarget.dataset.hex));
        }
        MAP.append(div);
    });

    // Set map size.
    let bWidth = boundX[1] - boundX[0] + HEX_SIZE[0];
    let bHeight = boundY[1] - boundY[0] + HEX_SIZE[1];
    setStyle(MAP_BORDER, 'width', bWidth);
    setStyle(MAP_BORDER, 'height', bHeight);
    setStyle(MAP, 'left', -boundX[0]);
    setStyle(MAP, 'top', -boundY[0]);

    // Load viewer_count
    SCRIPTS.forEach(script => {
        let scriptElement = document.createElement('script');
        scriptElement.src = script;
        document.body.append(scriptElement);
    });

    // Setup variables for dragging
    let main = document.getElementById('main');
    let zoom = getComputedStyle(document.getElementById('border')).zoom;
    let padding = parseInt(getComputedStyle(MAP_BORDER).padding) * 2;
    dragMax = [
        bWidth + padding - main.clientWidth / zoom,
        bHeight + padding - main.clientHeight / zoom
    ];
};
xmlhttp.open('GET', 'maps/map-basic.json');
xmlhttp.responseType = 'json';
xmlhttp.send();

// Dragging events
document.onmousedown = event => {
    dragging = true;
    dragStart = [event.clientX, event.clientY];
}

document.onmouseup = event => {
    dragging = false;
    var left = Math.min(Math.max(dragDist[0] + (event.clientX - dragStart[0]) * DRAG_MULT, -dragMax[0]), 0);
    var top = Math.min(Math.max(dragDist[1] + (event.clientY - dragStart[1]) * DRAG_MULT, -dragMax[1]), 0);
    previousMovement = Math.abs(event.clientX - dragStart[0]) + Math.abs(event.clientY - dragStart[1]);
    dragDist = [left, top];

    if (previousMovement > MIN_PIXELS_TO_STOP_CLICK)
        removeMenu();
}

document.onmousemove = event => {
    if (!dragging) return;

    var left = Math.min(Math.max(dragDist[0] + (event.clientX - dragStart[0]) * DRAG_MULT, -dragMax[0]), 0);
    var top = Math.min(Math.max(dragDist[1] + (event.clientY - dragStart[1]) * DRAG_MULT, -dragMax[1]), 0);

    setStyle(MAP_BORDER, 'left', left);
    setStyle(MAP_BORDER, 'top', top);
};

// Game functions
function DisplayNextTurn (channelData) {
    Log('DisplayNextTurn - Enter', DEBUG.FUNC_STATEMENTS);
    let viewers = channelData.nextTurn.viewers;
    let spaces = channelData.nextTurn.spaces;
    let attackList = {};

    // Conflict checker
    Object.keys(spaces).forEach(x => {
        Object.keys(spaces[x]).forEach(y => {
            let space = spaces[x][y];
            if (Object.keys(space).length == 1) {
                if (!channelData.spaces[x] ||
                    !channelData.spaces[x][y] ||
                    Object.keys(space)[0] != channelData.spaces[x][y].team % 2 + 1) {
                    console.log('No conflict');
                    // No conflict
                    Object.keys(space).forEach(t => {
                        space[t].forEach(userId => {
                            channelData = ActOnState(channelData, userId, viewers[userId], [x, y]);
                        })
                    })
                } else {
                    console.log('swap battle not implemented');
                }
            } else {
                let key = JSON.stringify([x, y]);
                // if (attackList[key]) {
                //     if (attackList[key][team]) {
                //         attackList[key][team] =
                //             attackList[key][team].concat(space[team]);
                //     } else {
                //         attackList[key][team] = space[team];
                //     }
                // } else {
                //     attackList[key] = {};
                //     attackList[key]["type"] = teamOwns[x][y] == 0 ? "meet" : "swap";
                //     attackList[key][team] = space[team];
                // }
                attackList[key] = {
                    type: "meet",
                    1: space[1],
                    2: space[2]
                };
            }
        });
    });

    // Conflict
    Object.keys(attackList).forEach(position => {
        let attack = attackList[position];
        position = JSON.parse(position);
        let tOne = [0, 0, 0, 0, 0];
        let tTwo = [0, 0, 0, 0, 0];
        attack[1].forEach(viewer => {
            tOne[ELEMENT_TO_INT[viewers[viewer].element]]++;
        });
        attack[2].forEach(viewer => {
            tTwo[ELEMENT_TO_INT[viewers[viewer].element]]++;
        });

        let atkOne =
            tOne[0] * 0.25 +
            (tOne[1] > tTwo[2] ?
                tTwo[2] * ELEMENT_MULT + (tOne[1] - tTwo[2]) :
                tOne[1] * ELEMENT_MULT) +
            (tOne[2] > tTwo[3] ?
                tTwo[3] * ELEMENT_MULT + (tOne[2] - tTwo[3]) :
                tOne[2] * ELEMENT_MULT) +
            (tOne[3] > tTwo[4] ?
                tTwo[4] * ELEMENT_MULT + (tOne[3] - tTwo[4]) :
                tOne[3] * ELEMENT_MULT) +
            (tOne[4] > tTwo[1] ?
                tTwo[1] * ELEMENT_MULT + (tOne[4] - tTwo[1]) :
                tOne[4] * ELEMENT_MULT);
        let atkTwo =
            tTwo[0] * 0.25 +
            (tTwo[1] > tOne[2] ?
                tOne[2] * ELEMENT_MULT + (tTwo[1] - tOne[2]) :
                tTwo[1] * ELEMENT_MULT) +
            (tTwo[2] > tOne[3] ?
                tOne[3] * ELEMENT_MULT + (tTwo[2] - tOne[3]) :
                tTwo[2] * ELEMENT_MULT) +
            (tTwo[3] > tOne[4] ?
                tOne[4] * ELEMENT_MULT + (tTwo[3] - tOne[4]) :
                tTwo[3] * ELEMENT_MULT) +
            (tTwo[4] > tOne[1] ?
                tOne[1] * ELEMENT_MULT + (tTwo[4] - tOne[1]) :
                tTwo[4] * ELEMENT_MULT);

        let deaths = [0, 0];
        attack[1].forEach(viewer => {
            let viewerData = channelData.viewers[viewer];
            // let battleData = viewers[viewer];
            let dmg = Math.ceil(
                atkTwo / attack[1].length * DMG_MULT * (viewers[viewer].state == "defend" ? 0.5 : 1) + 5
            );

            if (position[0] == teamBases[2][0] &&
                position[1] == teamBases[2][1]) {
                gameData.teams[2].hp -= dmg;
            }

            viewerData.crystals = Math.max(0, viewerData.crystals - dmg);
            if (viewerData.crystals == 0) {
                viewerData.element = "neutral";
                viewerData.position = teamBases[1];
                deaths[0]++;
            }
            // viewers[viewer] = battleData;
            // channelData = UpdateUserFromBattle(channelData, viewer, battleData);
        });
        attack[2].forEach(viewer => {
            let viewerData = channelData.viewers[viewer];
            // let battleData = viewers[viewer];
            let dmg = Math.ceil(
                atkOne / attack[2].length * DMG_MULT * (viewers[viewer].state == "defend" ? 0.5 : 1) + 5
            );

            if (position[0] == teamBases[1][0] &&
                position[1] == teamBases[1][1]) {
                gameData.teams[1].hp -= dmg;
            }

            viewerData.crystals = Math.max(0, viewerData.crystals - dmg);
            if (viewerData.crystals == 0) {
                viewerData.element = "neutral";
                viewerData.position = teamBases[2];
                deaths[1]++;
            }
            // viewers[viewer] = battleData;
            // channelData = UpdateUserFromBattle(channelData, viewer, battleData);
        });

        // if (attack.type == "meet") {
        if (attack[1].length == deaths[0] && attack[2].length != deaths[1]) {
            attack[2].forEach(viewer => {
                let viewerData = channelData.viewers[viewer];
                if (viewerData.crystals != 0) {
                    channelData = ActOnState(channelData, viewer, viewers[viewer], position);
                } else {
                    channelData = ActOnState(channelData, viewer, viewers[viewer], viewerData.position);
                }
            });
        } else {
            attack[2].forEach(viewer => {
                channelData = ActOnState(channelData, viewer, viewers[viewer], channelData.viewers[viewer].position);
            });
        }

        if (attack[2].length == deaths[1] && attack[1].length != deaths[0]) {
            attack[1].forEach(viewer => {
                let viewerData = channelData.viewers[viewer];
                if (viewerData.crystals != 0) {
                    channelData = ActOnState(channelData, viewer, viewers[viewer], position);
                } else {
                    channelData = ActOnState(channelData, viewer, viewers[viewer], viewerData.position);
                }
            });
        } else {
            attack[1].forEach(viewer => {
                channelData = ActOnState(channelData, viewer, viewers[viewer], channelData.viewers[viewer].position);
            });
        }
        // } else {

        // }

        // attack[1].forEach(viewer => {
        //     channelData = ActOnState(channelData, viewer, viewers[viewer], attack.position);
        // })
        // attack[2].forEach(viewer => {
        //     channelData = ActOnState(channelData, viewer, viewers[viewer], attack.position);
        // })
    }); // End of Attacks

    gameData = channelData;
    UpdateCounters();
    CheckEndState();
    Log('DisplayNextTurn - End', DEBUG.FUNC_STATEMENTS);
}

function ActOnState (channelData, viewerId, battleData, curPosition) {
    Log('ActOnState - Enter', DEBUG.FUNC_STATEMENTS);
    let viewerData = channelData.viewers[viewerId];
    viewerData.element = battleData.element;
    if (viewerData.position[0] == curPosition[0] &&
        viewerData.position[1] == curPosition[1]) {
        if (battleData.state == 'gather') {
            viewerData.crystals += CRYSTALS_GAINED;
            Log('Successful gather', DEBUG.OTHER);
            Log(viewerData, DEBUG.DATA);
        } else if (battleData.state == 'repair' && viewerData.crystals >= COST_TO_REPAIR) {
            viewerData.crystals -= COST_TO_REPAIR;
            channelData.teams[viewerData.team].hp += REPAIR_AMOUNT;
        }
    } else {
        if (--channelData.spaces[viewerData.position[0]][viewerData.position[1]].count == 0) {
            channelData.spaces[viewerData.position[0]][viewerData.position[1]].team = 0;
        }
        viewerData.position = curPosition;

        if (channelData.spaces[viewerData.position[0]]) {
            if (channelData.spaces[viewerData.position[0]][viewerData.position[1]]) {
                channelData.spaces[viewerData.position[0]][viewerData.position[1]].count++;
                channelData.spaces[viewerData.position[0]][viewerData.position[1]].team = viewerData.team;
            } else {
                channelData.spaces[viewerData.position[0]][viewerData.position[1]] = {
                    count: 1,
                    team: viewerData.team
                }
            }
        } else {
            channelData.spaces[viewerData.position[0]] = {};
            channelData.spaces[viewerData.position[0]][viewerData.position[1]] = {
                count: 1,
                team: viewerData.team
            }
        }
    }

    channelData.viewers[viewerId] = viewerData;
    Log('ActOnState - Exit', DEBUG.FUNC_STATEMENTS);
    return channelData;
}

function UpdateUserFromBattle (channelData, userId, data) {
    let viewer = channelData.viewers[userId];
    viewer.element = data.element;

    if (--channelData.spaces[viewer.position[0]][viewer.position[1]].count == 0) {
        channelData.spaces[viewer.position[0]][viewer.position[1]].team = 0;
    }
    viewer.position = data.position;
    channelData.spaces[viewer.position[0]][viewer.position[1]].count++;

    channelData.viewers[userId] = viewer;
    return channelData;
}

// Server functions
function EndTurn () {
    if (DEBUG.TURN_LIMIT >= 0 && turns >= DEBUG.TURN_LIMIT + 1) { return; }
    if (user.isHost) {
        Log('Ending the turn...', DEBUG.API_CALLS);
        $.ajax(requests.turn_over);
        if (turns == DEBUG.TURN_LIMIT) {
            turns++;
        }
    }
}

function CheckEndState () {
    let cont = true;
    if (gameData.teams[1].hp <= 0) {
        console.log('Team 2 wins');
        cont = false;
    }
    if (gameData.teams[2].hp <= 0) {
        console.log('Team 1 wins!');
        cont = false;
    }
    if (cont) {
        if (DEBUG.TURN_LIMIT >= 0) {
            if (turns >= DEBUG.TURN_LIMIT) {
                Log('no more starting turns', DEBUG.OPTIONS);
                return;
            }
            turns++;
        }
        gameData.nextTurn = {
            spaces: {},
            viewers: {}
        }
        if (!DEBUG.NO_TIMER)
            StartTurn();
    }
}

function StartTurn () {
    if (user.isHost) {
        requests.start_turn.data = JSON.stringify(gameData, null, 2);
        Log('Starting turn...', DEBUG.API_CALLS);
        $.ajax(requests.start_turn);
    } else {
        console.log('not host');
    }
}