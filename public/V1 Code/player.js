// Player variables
const CRYSTALS_GAINED = 50;
const COST_TO_REPAIR = 100;
const REPAIR_AMOUNT = 5;
const ELEMENT_MULT = 2;
const DMG_MULT = 5;

// Menu
var menu;
let target;
let ableToMove = false;

function addMe(i) {
    if (typeof addUser == 'undefined') {
        if (i >= 1000) {
            console.error('Unable to add user');
        }
        setTimeout(addMe, 10, i + 1);
        return;
    }
    addUser();
};
addMe(0);

function removeMenu() {
    if (menu) {
        menu.parentNode.removeChild(menu);
        menu = null;
    }
};

function createMenu(innerHTML) {
    menu = document.createElement('div');
    menu.className = 'options';
    menu.innerHTML = innerHTML;
    target.parentNode.append(menu);
};

// Movement code
function handleHexData(_target, hexData) {
    if (!ableToMove) {
        log('Not allowed to move', DEBUG.OPTIONS);
        return;
    }

    removeMenu();

    target = _target;

    let userData = gameData.viewers[user.id];
    let xDiff = hexData[0] - userData.position[0];
    let yDiff = hexData[1] - userData.position[1];
    if (xDiff == 0 && yDiff == 0) {
        // Player's current hex - Display Options
        switch (hexData[2]) {
            case 0:
                log('Options: Defense', DEBUG.OPTIONS);
                createMenu(`
                    <button onclick='Defend()' type='button'>Defend</button>
                `);
                break;
            case 1:
                log('Options: Defense, Deposit, Element', DEBUG.OPTIONS);
                if (userData.position[0] == teamBases[userData.team][0] && userData.position[1] == teamBases[userData.team][1]) {
                    createMenu(`
                        <button onclick='Defend()' type='button'>Defend</button>
                        <button onclick='Repair()' type='button'>Repair</button>
                        <button onclick='ChangeElementOptions()' type='button'>Element</button>
                    `);
                }
                break;
            case 2:
                log('Options: Defense, Gather', DEBUG.OPTIONS);
                createMenu(`
                    <button onclick='Defend()' type='button'>Defend</button>
                    <button onclick='Gather()' type='button'>Gather</button>
                `);
                break;
            default:
                console.error('Unknown hexagon type: ' + hexData[2]);
                break;
        }
    } else if (Math.abs(xDiff) <= 1 && Math.abs(yDiff) <= 1 && Math.abs(yDiff + xDiff) <= 1) {
        if (checkTeam(hexData, parseInt(userData.team))) {
            log('Options: Move', DEBUG.OPTIONS);
            createMenu(`
                <button onclick='Move(${JSON.stringify([hexData[0], hexData[1]])})' type='button'>Move</button>
            `)
        } else {
            log('Options: Attack', DEBUG.OPTIONS);
            createMenu(`
                <button onclick='Move(${JSON.stringify([hexData[0], hexData[1]])})' type='button'>Attack</button>
            `)
        }
    }
};

function SendTurnData(pos, state) {
    if (ableToMove) {
        requests.take_turn.data = JSON.stringify({
            position: pos,
            element: gameData.viewers[user.id].element,
            state: state
        }, null, 2);
        log('Taking turn... ' + state, DEBUG.API_CALLS);
        log(requests.take_turn, DEBUG.DATA);
        ableToMove = false;
        $.ajax(requests.take_turn);
    }
}

// -----Choices-----
function Defend() {
    // console.log('Unimplemented: Defend');
    removeMenu();
    // Send message to Server
    SendTurnData(gameData.viewers[user.id].position, "defend");
};

function Gather() {
    // console.log('Unimplemented: Gather');
    removeMenu();
    // Send message to Server
    SendTurnData(gameData.viewers[user.id].position, "gather");
};

function ChangeElementOptions() {
    // console.log('Unimplemented: Change Element');
    removeMenu();
    createMenu(`
        <button onclick='ChangeElement("earth")' type='button'>Earth</button>
        <button onclick='ChangeElement("fire")' type='button'>Fire</button>
        <button onclick='ChangeElement("water")' type='button'>Water</button>
        <button onclick='ChangeElement("wind")' type='button'>Wind</button>
    `);
};

let ChangeElement = function (element) {
    if (ELEMENTS.includes(element)) {
        gameData.viewers[user.id].element = element;
        removeMenu();
    } else {
        console.error('Invalid Element: ' + element);
    }
};

function Repair() {
    console.log('Unimplemented: Repair');
    ableToMove = false;
    removeMenu();
};

function Move(newPos) {
    removeMenu();
    SendTurnData(newPos, 'move');
}

function PlayerTimeout() {
    log('Player timeout', DEBUG.FUNC_STATEMENTS);
    if (ableToMove) {
        log('Forcing Timeout...', DEBUG.API_CALLS);
        SendTurnData(gameData.viewers[user.id].position, "defend");
    }
}