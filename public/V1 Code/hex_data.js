var counts = {};

var teamOwns = {};
var teamBases = {};

requests.join.success = ParseJoinData;

// Create counters - Are invisible to start
document.querySelectorAll('.hexagon').forEach(hexagon => {
    var countContainer = document.createElement('div');
    countContainer.className = 'counter';
    countContainer.innerHTML = `
        <img src='img/viewer.png' />
        <span class='count'>0</span>
    `;
    hexagon.append(countContainer);
});

{
    log('hex_data.js loaded', DEBUG.FUNC_STATEMENTS);
    let teamBase = 1;

    // Setup counts and teamOwns
    document.querySelectorAll('.hex-img').forEach(hexagon => {
        let data = JSON.parse(hexagon.dataset.hex);

        // Init counts
        if (!counts[data[0]]) {
            counts[data[0]] = {};
        }
        counts[data[0]][data[1]] = 0;

        // Init teamOwns
        if (!teamOwns[data[0]]) {
            teamOwns[data[0]] = {};
        }
        if (data[2] != 1) {
            teamOwns[data[0]][data[1]] = 0;
        } else {
            teamBases[teamBase] = [data[0], data[1]];
            teamOwns[data[0]][data[1]] = teamBase;
            teamBase++;
        }
    });
}

function addUser() {
    //counts[teamBases[team][0]][teamBases[team][1]]++;
    log('Sending join request...', DEBUG.API_CALLS);
    $.ajax(requests.join);
    // return teamBases[team];
}

function ParseJoinData(body) {
    log('ParseJoinData - Enter', DEBUG.FUNC_STATEMENTS);
    log(body, DEBUG.DATA);
    user.id = body.userId;
    user.isHost = user.id == channelId;

    gameData.viewers = body.viewers;
    gameData.viewers[user.id] = body.user;
    gameData.nextTurn = body.nextTurn;

    log('ParseJoinData - End', DEBUG.FUNC_STATEMENTS);
}

function UpdateCounters() {
    log('UpdateCounters - Enter', DEBUG.FUNC_STATEMENTS);
    let spaces = gameData.spaces;
    // console.log(spaces);
    Object.keys(spaces).forEach(x => {
        Object.keys(spaces[x]).forEach(y => {
            hexagon = document.getElementById(`hex_${x}_${y}`);
            if (!hexagon) {
                console.error('Unknown hex id: ' + `hex_${x}_${y}`);
                return;
            }

            let count = spaces[x][y].count;
            counts[x][y] = count;
            if (count > 0) {
                hexagon.querySelector('.count').innerHTML = count;
                hexagon.querySelector('.counter').style.display = 'inline-block';
                teamOwns[x][y] = parseInt(spaces[x][y].team);
            } else {
                hexagon.querySelector('.counter').style.display = 'none';
                let notBase = true;
                Object.keys(teamBases).forEach(t => {
                    if (x == teamBases[t][0] && y == teamBases[t][1]) {
                        notBase = false;
                    }
                });
                if (notBase) {
                    teamOwns[x][y] = 0;
                    gameData.spaces[x][y].team = 0;
                }
            }
        });
    });
    log('UpdateCounters - End', DEBUG.FUNC_STATEMENTS);
}

// Returns true if hex is uninhabited or is owned by team
function checkTeam(hexData, team) {
    switch (teamOwns[hexData[0]][hexData[1]]) {
        case 0: // Neutral
        case team: // Your team owns it
            return true;
        default: // Another team owns it
            return false;
    }
}