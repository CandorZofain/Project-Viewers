"use strict"
const REPAIR_COST = 50;
const REPAIR_AMOUNT = 10;

var Player = function () {
    let battleData = {
        elementMult: 2,
        dmgMult: 5
    };

    this.ableToMove = false;

    this.StartTurn = function () {
        this.ableToMove = true;
        map.RemoveMenu();
    }

    this.HandleHexData = function (position) {
        // map.StartOpenTab(document.getElementById('space-data-tab'));
        let space = gameState.spaces[position[0]][position[1]];
        // let data = [space.occupants.length, '?', '?', '?', '?', '?'];
        // if (space.team == 0 || space.team == gameState.user.team) {
        let data = [space.occupants.length, 0, 0, 0, 0, 0];
        space.occupants.forEach(playerId => {
            const player = gameState.players[playerId];
            if (!player) {
                global.Error('Player is undefined');
                global.Log('playerId: ' + playerId);
                console.log(gameState);
                return;
            }
            switch (player.element) {
                case 'neutral':
                    data[1]++;
                    break;
                case 'fire':
                    data[2]++;
                    break;
                case 'water':
                    data[3]++;
                    break;
                case 'wind':
                    data[4]++;
                    break;
                case 'earth':
                    data[5]++;
                    break;
                default:
                    global.Error(`Unknown element: ${player.element}`);
                    break;
            }
        });
        if (data.reduce((total, num) => { return total + num; }) / 2 != data[0]) {
            global.Error('Space elements do not sum to total');
        }
        // }

        Object.keys(gameState.team).forEach(teamNum => {
            let team = gameState.team[teamNum];
            if (JSON.stringify(team.position) == JSON.stringify(position)) {
                data[6] = team.hp;
            }
        });

        map.UpdateSpaceTab(data);

        if (!this.ableToMove) {
            // global.Log('Not allowed to move');
            return;
        }

        let user = gameState.user;
        let xDiff = position[0] - user.position[0];
        let yDiff = position[1] - user.position[1];
        if (xDiff == 0 && yDiff == 0) {
            let buttons = [];
            // Selected current position
            switch (space.type) {
                case 0:
                    buttons.push(document.createElement('button'));
                    buttons[0].onclick = () => { player.Defend() };
                    buttons[0].innerText = 'Defend';

                    map.CreateMenu(buttons);
                    break;
                case 1:
                    buttons.push(document.createElement('button'));
                    buttons[0].onclick = () => { player.Defend() };
                    buttons[0].innerText = 'Defend';

                    let canRepair = user.crystals >= REPAIR_COST;
                    buttons.push(document.createElement('button'));
                    buttons[1].onclick = () => { player.Repair() };
                    buttons[1].innerText = 'Repair';
                    buttons[1].disabled = !canRepair;
                    buttons[1].title = canRepair ? '' : `Need ${REPAIR_COST} crystals`;

                    let canChange = user.crystals > 0;
                    buttons.push(document.createElement('button'));
                    buttons[2].onclick = () => { player.ChangeElementOptions() };
                    buttons[2].innerText = 'Element';
                    buttons[2].disabled = !canChange;
                    buttons[2].title = canChange ? '' : `Need crystals to change element`;

                    map.CreateMenu(buttons);
                    break;
                case 2:
                    buttons.push(document.createElement('button'));
                    buttons[0].onclick = () => { player.Defend() };
                    buttons[0].innerText = 'Defend';

                    buttons.push(document.createElement('button'));
                    buttons[1].onclick = () => { player.Gather() };
                    buttons[1].innerText = 'Gather';

                    map.CreateMenu(buttons);
                    break;
                default:
                    global.Error(`Unknown hexagon type: ${space.type}`);
                    break;
            }
        } else if (
            Math.abs(xDiff) <= 1 &&
            Math.abs(yDiff) <= 1 &&
            Math.abs(xDiff + yDiff) <= 1
        ) {
            let buttons = [];
            buttons.push(document.createElement('button'));
            buttons[0].onclick = () => { player.Move(position); };

            if (space.team == user.team || space.team == 0) {
                buttons[0].innerText = 'Move';
            } else {
                buttons[0].innerText = 'Attack';
            }

            map.CreateMenu(buttons);
        }
    };

    this.Defend = function () {
        this.ableToMove = false;

        map.RemoveMenu();

        socket.send(JSON.stringify({
            event: 'defend',
            Authorization: auth
        }));
    };

    this.Gather = function () {
        this.ableToMove = false;

        map.RemoveMenu();

        socket.send(JSON.stringify({
            event: 'gather',
            Authorization: auth
        }));
    };

    this.Repair = function () {
        this.ableToMove = false;

        map.RemoveMenu();

        socket.send(JSON.stringify({
            event: 'repair',
            Authorization: auth
        }));
    };

    this.ChangeElementOptions = function () {
        map.RemoveMenu();

        let buttons = [];

        buttons.push(document.createElement('button'));
        buttons[0].onclick = () => { player.ChangeElement('earth') };
        buttons[0].innerText = 'Earth';

        buttons.push(document.createElement('button'));
        buttons[1].onclick = () => { player.ChangeElement('fire') };
        buttons[1].innerText = 'Fire';

        buttons.push(document.createElement('button'));
        buttons[2].onclick = () => { player.ChangeElement('water') };
        buttons[2].innerText = 'Water';

        buttons.push(document.createElement('button'));
        buttons[3].onclick = () => { player.ChangeElement('wind') };
        buttons[3].innerText = 'Wind';

        map.CreateMenu(buttons);
    };
    this.ChangeElement = function (element) {
        map.RemoveMenu();

        gameState.user.element = element;
        map.UpdatePlayerTab();

        socket.send(JSON.stringify({
            event: 'changeElement',
            data: element,
            Authorization: auth
        }));
    }

    this.Move = function (newPos) {
        this.ableToMove = false;

        map.RemoveMenu();

        socket.send(JSON.stringify({
            event: 'move',
            data: newPos,
            Authorization: auth
        }));
    };
};