var counts = {
    0: {
        0: 5
    },
    1: {
        2: 3
    }
}

var teamOwns = {};
var teamBases = {};

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

function addUser(team) {
    counts[teamBases[team][0]][teamBases[team][1]]++;
    updateCounters();
    return teamBases[team];
}

function updateCounters() {
    document.querySelectorAll('.hexagon').forEach(hexagon => {
        let data = JSON.parse(hexagon.querySelector('.hex-img').dataset.hex);
        let count = counts[data[0]][data[1]];
        if (count > 0) {
            hexagon.querySelector('.count').innerHTML = count;
            hexagon.querySelector('.counter').style.display = 'inline-block';
        } else {
            hexagon.querySelector('.counter').style.display = 'none';
            if (data[2] != 1)
                teamOwns[data[0]][data[1]] = 0;
        }
    });
}

// Returns true if hex is uninhabited or is owned by team
function checkTeam(hexData, team) {
    switch (teamOwns[hexData[0]][hexData[1]]) {
        case 0: // Neutral
            teamOwns[hexData[0]][hexData[1]] = team;
            return true;
        case team: // Your team owns it
            return true;
        default: // Another team owns it
            return false;
    }
}