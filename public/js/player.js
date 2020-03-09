// Player variables
let position = [0, 0];
let team = 1;
let crystals = 0;
const CRYSTALS_GAINED = 50;
let element = 'neutral';

// Menu
var menu;
let target;
let ableToMove = true;

function addMe(i) {
    if (typeof addUser == 'undefined') {
        if (i >= 1000) {
            console.error('Unable to add user');
        }
        setTimeout(addMe, 10, i + 1);
        return;
    }
    position = addUser(1);
}
addMe(0);

function removeMenu() {
    if (menu) {
        menu.parentNode.removeChild(menu);
        menu = null;
    }
}

function createMenu(innerHTML) {
    menu = document.createElement('div');
    menu.className = 'options';
    menu.innerHTML = innerHTML;
    target.parentNode.append(menu);
}

// Movement code
function handleHexData(_target, hexData) {
    if (!ableToMove) return;

    removeMenu();

    target = _target;

    // console.log('hexData: ' + hexData);
    // console.log('position: ' + position);
    let xDiff = hexData[0] - position[0];
    let yDiff = hexData[1] - position[1];
    if (xDiff == 0 && yDiff == 0) {
        // Player's current hex - Display Options
        switch (hexData[2]) {
            case 0:
                console.log('Options: Defense');
                createMenu(`
                    <button onclick='Defend()' type='button'>Defend</button>
                `);
                break;
            case 1:
                console.log('Options: Defense, Deposit, Element');
                if (position[0] == teamBases[team][0] && position[1] == teamBases[team][1]) {
                    createMenu(`
                        <button onclick='Defend()' type='button'>Defend</button>
                        <button onclick='Deposit()' type='button'>Deposit</button>
                        <button onclick='ChangeElementOptions()' type='button'>Element</button>
                    `);
                } else {
                    console.log('This is not your base');
                }
                break;
            case 2:
                console.log('Options: Defense, Gather');
                createMenu(`
                    <button onclick='Defend()' type='button'>Defend</button>
                    <button onclick='Gather()' type='button'>Gather</button>
                `);
                break;
            default:
                console.error('Unknown hexagon type: ' + hexData[2]);
                break;
        }
    } else if (
        Math.abs(xDiff) <= 1 &&
        Math.abs(yDiff) <= 1 &&
        Math.abs(yDiff + xDiff) <= 1
    ) {
        if (checkTeam(hexData, 1)) {
            counts[position[0]][position[1]]--;
            position = [hexData[0], hexData[1]];
            counts[position[0]][position[1]]++;
        }
        updateCounters();
    } else {
        console.log('Too far');
    }
}

// -----Choices-----
function Defend() {
    console.log('Unimplemented: Defend');
    ableToMove = false;
    removeMenu();
    // Send message to Server

}

function Gather() {
    console.log('Unimplemented: Gather');
    crystals += CRYSTALS_GAINED;
    ableToMove = false;
    removeMenu();
    // Send message to Server
}

function ChangeElementOptions() {
    console.log('Unimplemented: Change Element');
    removeMenu();
    createMenu(`
        <button onclick='ChangeElement("earth")' type='button'>Earth</button>
        <button onclick='ChangeElement("fire")' type='button'>Fire</button>
        <button onclick='ChangeElement("water")' type='button'>Water</button>
        <button onclick='ChangeElement("wind")' type='button'>Wind</button>
    `);
}

let ChangeElement = function (_element) {
    if (ELEMENTS.includes(_element)) {
        element = _element;
        removeMenu();
    } else {
        console.error('Invalid Element: ' + _element);
    }
}

function Deposit() {
    console.log('Unimplemented: Deposit');
}