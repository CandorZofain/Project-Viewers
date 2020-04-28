'use strict';

var global = require('./GlobalFunctions.js');
var map = require('./maps/map-basic.json');

const BASE_HP = 100;
const BASE_CRYSTALS = 30;

const NUMBER_OF_CRYSTALS_GATHERED = 10;
const REPAIR_COST = 50;
const REPAIR_AMOUNT = 10;

const ELEMENT_MULT = 2;
const DMG_MULT = 5;

const TURN_TIME = 15;

class Game {
    constructor(_channelId, _mapFile) {
        this.channelId = _channelId;
        this.players = {};
        this.spaces = {};
        this.teams = {};
        this.nextState = {
            players: {},
            spaces: {}
        };
        this.startTime = new Date();
        this.turnTime = 1;
        this.timer;

        if (typeof (_mapFile) !== 'undefined') {
            _mapFile = './maps/map-basic.json';
        }

        let teamCount = 0;

        map.forEach(space => {
            let x = space[0];
            let y = space[1];
            let type = space[2];

            if (!this.spaces[x]) {
                this.spaces[x] = {};
            }
            this.spaces[x][y] = {
                occupants: [],
                type: type,
                team: 0
            };
            if (type == 1) {
                this.spaces[x][y].team = ++teamCount;
                this.teams[teamCount] = {
                    members: [],
                    position: [x.toString(), y.toString()],
                    hp: BASE_HP
                }
            }
        }, this);

        setTimeout(() => {
            this.turnTime = TURN_TIME;
            this.timer = setInterval(() => {
                let diff = ((new Date()).getTime() - this.startTime.getTime()) / 1000;
                if (diff > this.turnTime + 1) {
                    this.startTime = new Date();
                    this.EndTurn();
                }
            }, 1 / 60);
        }, this.turnTime * 1000);
    }

    AddPlayer (userId, _connection) {
        if (this.players[userId]) {
            global.QuietError(`Player with id ${userId} already exists`);
            return false;
        }

        let minCount = Infinity;
        let minTeam;
        Object.keys(this.teams).forEach(team => {
            let count = this.teams[team].members.length;
            if (count < minCount) {
                minCount = count;
                minTeam = team;
            }
        }, this);

        // minTeam = 1;

        if (!minTeam) {
            global.Error(`No teams exist for game. id: ${this.channelId}`);
            return false;
        } else {
            const teamInfo = this.teams[minTeam];
            this.teams[minTeam].members.push(userId);
            this.players[userId] = {
                position: teamInfo.position,
                crystals: BASE_CRYSTALS,
                element: 'neutral',
                team: minTeam,
                connection: _connection
            };
            this.spaces[teamInfo.position[0]][teamInfo.position[1]].occupants.push(userId);
        }

        return true;
    }

    RemovePlayer (userId) {
        let player = this.players[userId];
        if (!global.Exists(player)) {
            global.QuietError(`Play with id ${userId} does not exist`);
            return false;
        }

        delete this.players[userId];
        this.teams[player.team].members.splice(
            this.teams[player.team].members.indexOf(userId),
            1
        );

        this.spaces[player.position[0]][player.position[1]].occupants.splice(
            this.spaces[player.position[0]][player.position[1]].occupants.indexOf(userId),
            1
        );
        if (this.spaces[player.position[0]][player.position[1]].occupants.length == 0 && JSON.stringify(player.position) != JSON.stringify(this.teams[player.team].position)) {
            this.spaces[player.position[0]][player.position[1]].team = 0;
        }

        // global.Log(JSON.stringify(this.players));
        // global.Log(JSON.stringify(this.spaces));
        // global.Log(JSON.stringify(this.teams));

        return true;
    }

    StartNextTurn () {
        if (!global.Exists(this.timer)) return;
        this.nextState = {
            players: {},
            spaces: {}
        };
        this.startTime = new Date();
        this.SendMapUpdateForAll();

        Object.keys(this.players).forEach(playerId => {
            this.players[playerId].connection.sendUTF(JSON.stringify({
                event: 'startTurn'
            }));
        }, this);
    }

    EndTurn () {
        if (!global.Exists(this.timer)) return;
        // Every player must take an action. Default = defend
        Object.keys(this.players).forEach(playerId => {
            let nextPlayer = this.nextState.players[playerId];
            if (!global.Exists(nextPlayer) || !global.Exists(nextPlayer.action)) {
                this.PlayerDefend(playerId);
            }
        }, this);

        let battles = this.#GatherBattles();
        this.#ApartBattles(battles.apart);
        this.#AdjacentBattles(battles.adjacent);
        this.#BaseBattles(battles.base);
        this.#BattleAftermath(battles);

        this.SendMapUpdateForAll();

        let winner = -1;
        if (this.teams[1].hp <= 0) {
            if (this.teams[2].hp <= 0) {
                global.Log('Tie Game');
                winner = 0;
            } else {
                global.Log('Team 2');
                winner = 2;
            }
        } else if (this.teams[2].hp <= 0) {
            global.Log('Team 1');
            winner = 1;
        } else {
            this.StartNextTurn();
        }
        if (winner != -1) {
            clearInterval(this.timer);
            Object.keys(this.players).forEach(playerId => {
                this.players[playerId].connection.sendUTF(JSON.stringify({
                    event: 'endGame',
                    data: winner
                }));
            });
        }
    }

    #GatherBattles = function () {
        let battles = {
            apart: [],
            adjacent: [],
            base: []
        };
        Object.keys(this.nextState.spaces).forEach(position => {
            let nextSpace = this.nextState.spaces[position];
            position = JSON.parse(position);
            if (nextSpace.team == 0) {
                let teamNums = Object.keys(nextSpace.teams);
                if (teamNums.length == 1) { // Movement
                    nextSpace.teams[teamNums[0]].forEach(playerId => {
                        this.#ActionPlayer(playerId);
                        this.#MovePlayer(playerId, this.nextState.players[playerId].position);
                        delete this.nextState.players[playerId];
                    });
                } else { // Apart
                    battles.apart.push({
                        1: nextSpace.teams[1],
                        2: nextSpace.teams[2]
                    });
                }
            } else {
                let teamNums = Object.keys(nextSpace.teams);
                if (teamNums.length == 1 && nextSpace.team == teamNums[0]) { // Movement
                    nextSpace.teams[teamNums[0]].forEach(playerId => {
                        this.#ActionPlayer(playerId);
                        this.#MovePlayer(playerId, this.nextState.players[playerId].position);
                        delete this.nextState.players[playerId];
                    });
                } else { // Adjacent
                    let atk1 = nextSpace.teams[1] ? nextSpace.teams[1] : [];
                    let atk2 = nextSpace.teams[2] ? nextSpace.teams[2] : [];
                    let def = this.spaces[position[0]][position[1]].occupants;
                    let battle = {
                        team: nextSpace.team,
                        atk1: atk1,
                        atk2: atk2,
                        def: def
                    };
                    if (JSON.stringify(position) == JSON.stringify(this.teams[nextSpace.team].position)) {
                        // Base battle
                        battles.base.push(battle);
                    } else {
                        battles.adjacent.push(battle);
                    }
                }
            }
        }, this);
        return battles;
    }

    #ApartBattles = function (apartBattles) {
        apartBattles.forEach(battle => {
            let atk1 = this.#CalculateAttack(battle[1], battle[2]);
            let atk2 = this.#CalculateAttack(battle[2], battle[1]);

            this.#DealDamage(battle[2], atk1);
            this.#DealDamage(battle[1], atk2);

            battle.winner = atk1 > atk2 ? 1 : 2;
        }, this);

        this.#CheckCrystals();
    }

    #AdjacentBattles = function (adjacentBattles) {
        adjacentBattles.forEach(battle => {
            let attackers, defenders;
            if (battle.team == 1) {
                attackers = battle.atk2;
                defenders = [...new Set(battle.atk1.concat(battle.def))];
            } else {
                attackers = battle.atk1;
                defenders = [...new Set(battle.atk2.concat(battle.def))];
            }

            let atk1 = this.#CalculateAttack(attackers, defenders);
            let atk2 = this.#CalculateAttack(defenders, attackers);

            this.#DealDamage(defenders, atk1);
            this.#DealDamage(attackers, atk2);
        }, this);

        this.#CheckCrystals();
    }

    #BaseBattles = function (baseBattles) {
        baseBattles.forEach(battle => {
            let attackers, defenders;
            if (battle.team == 1) {
                attackers = battle.atk2;
                defenders = [...new Set(battle.atk1.concat(battle.def))];
            } else {
                attackers = battle.atk1;
                defenders = [...new Set(battle.atk2.concat(battle.def))];
            }
            attackers.forEach(playerId => {
                let nextPlayer = this.nextState.players[playerId];
                if (!global.Exists(nextPlayer) || JSON.stringify(nextPlayer.position) != JSON.stringify(this.teams[battle.team].position)) {
                    attackers.splice(attackers.indexOf(playerId), 1);
                }
            }, this);

            let atk1 = this.#CalculateAttack(attackers, defenders);
            let atk2 = this.#CalculateAttack(defenders, attackers);

            this.#DealDamage(defenders, atk1);
            this.#DealDamage(attackers, atk2);

            // Attack base
            let baseDmg = 0;
            attackers.forEach(playerId => {
                baseDmg += this.players[playerId].element != global.ELEMENTS[0] ? 5 : 1;
            }, this);
            if (defenders.length != 0) {
                let numNeutral = 0;
                defenders.forEach(playerId => {
                    numNeutral += this.nextState.players[playerId].element == global.ELEMENTS[0] ? 1 : 0;
                }, this);
                baseDmg *= numNeutral / defenders.length;
            }
            this.teams[battle.team].hp -= baseDmg;
        }, this);

        this.#CheckCrystals();
    }

    #CalculateAttack = function (attackers, defenders) {
        let attackElements = [0, 0, 0, 0, 0];
        let defendElements = [0, 0, 0, 0, 0];
        attackers.forEach(playerId => {
            let elementIndex = global.ELEMENT_TO_INT[this.nextState.players[playerId].element];
            let power;
            switch (this.nextState.players[playerId].action) {
                case 'move':
                    power = 1;
                    break;
                case 'defend':
                    power = 0.4;
                    break;
                case 'gather':
                case 'repair':
                case 'none':
                    power = 0.5;
                    break;
                default:
                    global.Error(`Unknown action: ${nextPlayer.action}`);
                    break;
            }
            attackElements[elementIndex] += power;
        });
        defenders.forEach(playerId => {
            defendElements[global.ELEMENT_TO_INT[this.nextState.players[playerId].element]]++;
        });

        let atk = attackElements[0] * 0.25;
        for (let i = 1; i < 5; i++) {
            let plusOne = (i % 4) + 1;
            atk += attackElements[i] > defendElements[plusOne] ?
                defendElements[plusOne] * ELEMENT_MULT + (attackElements[i] - defendElements[plusOne]) :
                attackElements[i] * ELEMENT_MULT;
        }
        return atk;
    }

    #DealDamage = function (defenders, atk) {
        if (defenders.length === 0 || atk === 0) return;
        let dmg = atk / defenders.length * DMG_MULT;

        defenders.forEach(playerId => {
            let player = this.players[playerId];
            let nextPlayer = this.nextState.players[playerId];

            let defMult;
            switch (nextPlayer.action) {
                case 'move':
                case 'none':
                    defMult = 1;
                    break;
                case 'defend':
                    defMult = 0.5;
                    break;
                case 'gather':
                case 'repair':
                    defMult = 2;
                    break;
                default:
                    global.Error(`Unknown action: ${nextPlayer.action}`);
                    break;
            }

            player.crystals = Math.max(0, player.crystals - (dmg * defMult + 5));
        });
    }

    #CheckCrystals = function () {
        Object.keys(this.players).forEach(playerId => {
            let player = this.players[playerId];
            let nextPlayer = this.nextState.players[playerId];

            if (global.Exists(nextPlayer) && player.crystals == 0) {
                player.element = global.ELEMENTS[0];
                let basePos = this.teams[player.team].position;
                this.#MovePlayer(playerId, basePos);

                nextPlayer.position = basePos;
                nextPlayer.element = global.ELEMENTS[0];
                nextPlayer.action = 'none';
            }
        }, this);
    }

    #BattleAftermath = function (battles) {
        battles.apart.forEach(battle => {
            let winners = battle[battle.winner];
            winners.forEach(playerId => {
                if (this.players[playerId].crystals != 0) {
                    this.#MovePlayer(playerId, this.nextState.players[playerId].position);
                }
            }, this);
        }, this);

        // Move players that joined their team in battle
        battles.adjacent.forEach(battle => {
            battle['atk' + battle.team].forEach(playerId => {
                if (this.players[playerId].crystals != 0) {
                    this.#MovePlayer(playerId, this.nextState.players[playerId].position);
                }
            }, this);
        }, this);
        battles.base.forEach(battle => {
            battle['atk' + battle.team].forEach(playerId => {
                if (this.players[playerId].crystals != 0) {
                    this.#MovePlayer(playerId, this.nextState.players[playerId].position);
                }
            }, this);
        }, this);

        // Check for adjacent winners
        battles.adjacent.forEach(battle => {
            if (battle.def.length == 0) {
                (battle.team == 1 ? battle.atk2 : battle.atk1).forEach(playerId => {
                    if (this.players[playerId].crystals != 0) {
                        this.#MovePlayer(playerId, this.nextState.players[playerId].position);
                    }
                }, this);
            }
        }, this);
        // No movement onto bases

        Object.keys(this.players).forEach(playerId => {
            this.#ActionPlayer(playerId);
        }, this);
    }

    #ActionPlayer = function (playerId) {
        let player = this.players[playerId];
        let nextPlayer = this.nextState.players[playerId];

        if (global.Exists(nextPlayer)) {
            player.element = nextPlayer.element;
            switch (nextPlayer.action) {
                case 'gather':
                    player.crystals += NUMBER_OF_CRYSTALS_GATHERED;
                    break;
                case 'repair':
                    if (player.crystals >= REPAIR_COST) {
                        player.crystals -= REPAIR_COST;
                        this.teams[player.team].hp += REPAIR_AMOUNT;
                    }
                    break;
                case 'defend':
                case 'none':
                case 'move':
                    break;
                default:
                    global.Error(`Unknown action: ${nextPlayer.action}`);
                    break;
            }
        }
    }

    GetDataForPlayer (userId) {
        const userData = Object.assign({}, this.players[userId]);
        delete userData.connection;
        Object.freeze(userData);

        const playersData = {};
        Object.keys(this.players).forEach(playerId => {
            const player = this.players[playerId];
            if (player.team == userData.team) {
                playersData[playerId] = {
                    element: player.element,
                    team: userData.team,
                    crystals: player.crystals
                };
            } else {
                playersData[playerId] = {
                    element: player.element,
                    team: userData.team
                };
            }
        });
        Object.freeze(playersData);

        const teamData = {};
        Object.keys(this.teams).forEach(teamNum => {
            teamData[teamNum] = {};
            Object.keys(this.teams[teamNum]).forEach(attribute => {
                if (attribute != 'members') {
                    if (this.teams[teamNum][attribute] instanceof Array || !(this.teams[teamNum][attribute] instanceof Object)) {
                        teamData[teamNum][attribute] = this.teams[teamNum][attribute];
                    } else {
                        teamData[teamNum][attribute] = Object.assign({}, this.teams[teamNum][attribute]);
                    }
                }
            });
        });
        Object.freeze(teamData);

        const spaceData = {};
        Object.keys(this.spaces).forEach(x => {
            Object.keys(this.spaces[x]).forEach(y => {
                if (!spaceData[x]) {
                    spaceData[x] = {};
                }

                spaceData[x][y] = Object.assign({}, this.spaces[x][y]);
                // if (spaceData[x][y].team != userData.team) {
                //     spaceData[x][y].occupants = spaceData[x][y].occupants.map(_ => -1);
                // }
            }, this);
        }, this);
        Object.freeze(spaceData);

        const turnTime = {
            startTime: this.startTime,
            length: this.turnTime
        };

        return {
            user: userData,
            players: playersData,
            team: teamData,
            spaces: spaceData,
            turnTime: turnTime
        }
    }

    SendMapUpdateForAll () {
        Object.keys(this.players).forEach(playerId => {
            this.#SendMapUpdateForPlayer(playerId);
        }, this);
    }

    #SendMapUpdateForTeam = function (team) {
        this.teams[team].members.forEach(playerId => {
            this.#SendMapUpdateForPlayer(playerId);
        }, this);
    }

    #SendMapUpdateForPlayer = function (playerId) {
        this.players[playerId].connection.sendUTF(JSON.stringify({
            event: 'update',
            data: this.GetDataForPlayer(playerId)
        }));
    }

    #CheckPlayerNext = function (playerId, playerNext) {
        if (global.Exists(playerNext) && global.Exists(playerNext.action)) {
            let message = `Player with id ${playerId} has already decided on action ${playerNext.action}`;
            global.QuietError(message);
            this.players[playerId].connection.sendUTF(JSON.stringify({
                event: 'error',
                message: message
            }));
            return true;
        }
        return false;
    }

    PlayerMove (playerId, position) {
        // TODO: Check position if adjacent

        let playerNext = this.nextState.players[playerId];
        if (this.#CheckPlayerNext(playerId, playerNext)) return;

        let player = this.players[playerId];
        this.nextState.players[playerId] = {
            position: position,
            element: (global.Exists(playerNext) ? playerNext.element : player.element),
            action: 'move'
        };

        this.#AddToSpace(playerId, position);

        return;
    }

    #MovePlayer = function (playerId, position) {
        let player = this.players[playerId];
        let curSpace = this.spaces[player.position[0]][player.position[1]];

        curSpace.occupants.splice(curSpace.occupants.indexOf(playerId), 1);

        if (curSpace.occupants.length == 0 && JSON.stringify(player.position) != JSON.stringify(this.teams[player.team].position)) {
            curSpace.team = 0;
        }

        curSpace = this.spaces[position[0]][position[1]];

        curSpace.occupants.push(playerId);
        curSpace.team = player.team;
        player.position = position;
    }

    PlayerDefend (playerId) {
        let playerNext = this.nextState.players[playerId];
        if (this.#CheckPlayerNext(playerId, playerNext)) return;

        let player = this.players[playerId];
        this.nextState.players[playerId] = {
            position: player.position,
            element: global.Exists(playerNext) ? playerNext.element : player.element,
            action: 'defend'
        };

        this.#AddToSpace(playerId, player.position);
    }

    PlayerGather (playerId) {
        let player = this.players[playerId];
        if (this.spaces[player.position[0]][player.position[1]].type != 2) {
            let message = `Cannot gather crystals when not on crystal space`;
            global.QuietError(message);
            player.connection.sendUTF(JSON.stringify({
                event: 'error',
                message: message
            }));
            return;
        }

        let playerNext = this.nextState.players[playerId];
        if (this.#CheckPlayerNext(playerId, playerNext)) return;

        this.nextState.players[playerId] = {
            position: player.position,
            element: global.Exists(playerNext) ? playerNext.element : player.element,
            action: 'gather'
        };

        this.#AddToSpace(playerId, player.position);

        return;
    }

    PlayerRepair (playerId) {
        let player = this.players[playerId];
        if (JSON.stringify(this.teams[player.team].position) !=
            JSON.stringify(player.position)) {
            let message = `Cannot repair base when not on base.`;
            global.QuietError(message);
            player.connection.sendUTF(JSON.stringify({
                event: 'error',
                message: message
            }));
            return;
        }

        if (player.crystals < REPAIR_COST) {
            let message = `Not enough crystals to repair base. Need ${REPAIR_COST}. Have ${player.crystals}.`;
            global.QuietError(message);
            player.connection.sendUTF(JSON.stringify({
                event: 'error',
                message: message
            }));
            return;
        }

        let playerNext = this.nextState.players[playerId];
        if (this.#CheckPlayerNext(playerId, playerNext)) return;

        this.nextState.players[playerId] = {
            position: player.position,
            element: global.Exists(playerNext) ? playerNext.element : player.element,
            action: 'repair'
        };

        this.#AddToSpace(playerId, player.position);

        return;
    }

    PlayerChangeElement (playerId, element) {
        let player = this.players[playerId];
        if (JSON.stringify(this.teams[player.team].position) !=
            JSON.stringify(player.position)) {
            let message = `Cannot change element when not on base.`;
            global.QuietError(message);
            player.connection.sendUTF(JSON.stringify({
                event: 'error',
                message: message
            }));
            return;
        }

        if (this.#CheckPlayerNext(playerId, this.nextState.players[playerId])) return;

        this.nextState.players[playerId] = {
            element: element,
        };
    }

    #AddToSpace = function (playerId, position) {
        let player = this.players[playerId];
        let space = this.nextState.spaces[JSON.stringify(position)];
        if (global.Exists(space)) {
            if (global.Exists(space.teams[player.team])) {
                space.teams[player.team].push(playerId);
            } else {
                space.teams[player.team] = [playerId];
            }
        } else {
            space = this.nextState.spaces[JSON.stringify(position)] = {
                team: this.spaces[position[0]][position[1]].team,
                teams: {}
            };
            space.teams[player.team] = [playerId];
        }
    }

    IsEmpty () {
        return Object.keys(this.players).length == 0;
    }
};

exports.Game = Game;