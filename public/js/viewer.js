var token = "";
var user = {
    id: "",
    team: "",
    vote: ""
}

var clientId = "";
var channelId = "";
// var ebs = "";

// because who wants to type this every time?
var twitch = window.Twitch.ext;
const baseURL = 'https://lrx67gfojj.execute-api.us-east-2.amazonaws.com/DEV/';
const testURL = 'http://localhost:8081/';

const TEST_VISUAL = true;

const TEAMS = ['blue', 'green', 'red', 'yellow'];

const TEAM_TO_INT = {
    blue: 0,
    green: 1,
    red: 2,
    yellow: 3
};

const TEAM_TO_COLOR = {
    blue: '#0000FF',
    green: '#00FF00',
    red: '#FF0000',
    yellow: '#FFFF00'
}

const ELEMENTS = ['earth', 'fire', 'water', 'wind'];

const ELEMENT_TO_INT = {
    earth: 0,
    fire: 0,
    water: 0,
    wind: 0
}

const EVENTS = {
    attack: 'ATTACK_RESULTS',
    voting: 'VOTING'
};

const STRINGS = {
    target: 'Your team is attacking '
}

// create the request options for our Twitch API calls
var requests = {
    join: createRequest('POST', 'join', joinedTeam),
    vote: createRequest('POST', 'vote'),
    target: createRequest('POST', 'target'),
    attack: createRequest('POST', 'attack')
};

function createRequest(type, method, success = logResponse) {
    return {
        type: type,
        url: baseURL + method,
        success: success,
        error: logError
    }
}

function setAuth(token) {
    Object.keys(requests).forEach((req) => {
        twitch.rig.log('Setting auth headers');
        requests[req].headers = {
            'Authorization': 'Bearer ' + token
        }
    });
}

// Ensures that the UserID is sent to the server
twitch.actions.requestIdShare();

// No idea
twitch.onContext(function (context) {
    twitch.rig.log(context);
});

// Authorizes the user. Creates token necessary for server communication
twitch.onAuthorized(function (auth) {
    twitch.rig.log('auth: ' + JSON.stringify(auth));
    // save our credentials
    token = auth.token;
    user.id = auth.userId;
    clientId = auth.clientId;
    channelId = auth.channelId;

    setAuth(token);

    if (TEST_VISUAL) {
        twitch.rig.log("No API calls - Visuals only");
        user.team = 'red';
        $('#main').load('html/victory.html', () => {
            $('.banner').css('background-color', TEAM_TO_COLOR[user.team]);
            $('h1.center').html('Team ' + user.team);
        });
        return;
    }

    // Loading page until a team is joined
    $('#main').load('html/connecting.html');

    // twitch.rig.log(JSON.stringify(requests.join));
    $.ajax(requests.join);
});

// Called after the server chooses a team
function joinedTeam(body) {
    twitch.rig.log('Successfully joined a team');
    twitch.rig.log('User: ' + JSON.stringify(user));
    twitch.rig.log('clientId: ' + clientId);
    user.team = body.team;
    showTargetVote(body.votes);
}

// Pulls necessary data for team votes
function parseTeamData(teams) {
    twitch.rig.log(JSON.stringify(teams));
    showTargetVote(teams[user.team].votes);
}

// Sends the user's vote to the server
// All purpose voting (attack, element, etc.)
function setTargetVote() {
    requests.vote.data = JSON.stringify({
        vote: $('#input').serializeArray()[0].value
    }, null, 2);
    twitch.rig.log('Sending vote to server...');
    twitch.rig.log(JSON.stringify(requests.vote));
    $.ajax(requests.vote);
}

function resetVotes() {
    showTargetVote({ 0: 0, 1: 0, 2: 0, 3: 0 });
}

// Show voting data for teams.
// Users vote on which team to attack
/* votes: {
    0: int, ...
}
health: int[]
*/
function showTargetVote() {
    const votes = arguments[0];
    const health = arguments[1];
    let inputs = "";
    TEAMS.forEach(t => {
        if (t != user.team) {
            let ti = TEAM_TO_INT[t];
            inputs += `<input type="radio" id="vote-${t}" name="vote" value=${t}>
                ${t}: ${votes[ti]}&emsp;HP ${health[ti]}/200<br>`;
        }
    });
    if (channelId == user.id.substring(1)) {
        inputs += `<button type='button' id='button'>Lock Target</button>`;
    }
    // twitch.rig.log(inputs);
    $('#main').load('html/team.html', () => {
        $('.banner').css('background-color', TEAM_TO_COLOR[user.team]);
        $('.center').html('Team ' + user.team);
        $('#input').html(inputs);
        $('input').change(setTargetVote);
        document.getElementById('button').addEventListener('click', setTarget);
    });
}

function setTarget() {
    twitch.rig.log('Setting target...');
    $.ajax(requests.target);
}

/* data : {
    target: {
        name: string,
        health: int
    },
    votes: {
        earth: int,
        fire: int,
        water: int,
        wind: int
    }
}
*/
function showElementVote(data) {
    let inputs = `
    <input type='radio' id='vote-earth' name='vote' value=earth>earth: ${data.votes.earth}<span>&ensp;&nbsp</span>
    <input type='radio' id='vote-fire' name='vote' value=fire>fire: ${data.votes.fire}<br>
    <input type='radio' id='vote-water' name='vote' value=water>water: ${data.votes.water}
    <input type='radio' id='vote-wind' name='vote' value=wind>wind: ${data.votes.wind}<br>
    `;
    // ELEMENTS.forEach(e => {
    //     inputs += `<input type='radio' id='vote-${e}' name='vote' value=${e}>${e}: ${data.votes[ELEMENT_TO_INT[e]]}<br>`;
    // });
    if (channelId == user.id.substring(1)) {
        inputs += `<button type='button' id='button'>Begin Attack!</button>`;
    }
    $('#main').load('html/element_vote.html', () => {
        $('.banner').css('background-color', TEAM_TO_COLOR[user.team]);
        $('.center').html('Team ' + user.team);
        $('#target').html(STRINGS.target + data.target.name);
        $('#health').html(`HP ${data.target.health}/200`);
        $('#input').html(inputs);
        $('input').change(setTargetVote);
        document.getElementById('button').addEventListener('click', setTarget);
    });
}

function beginAttack() {
    twitch.rig.log('Starting attack...');
    $.ajax(requests.attack);
}

/* teamsData: {
    teamVotes: {
        choice: string,
        percent: float,
        element: string
    },
    targetElement: string
    baseAttack: int,

}*/
function showAttackResults() {
    const teamsData = arguments[0];
    twitch.rig.log('teamsData: ' + JSON.stringify(teamsData));

    var results = "";
    // Object.keys(teamsData.teamVotes).forEach(key => {
    const choice = teamsData.teamVotes.choice;
    const percent = teamsData.teamVotes.percent;
    const element = teamsData.teamVotes.element;
    const dmg = Math.floor(teamsData.baseAttack * percent);
    if (choice) {
        results += `<p>${user.team} attacked ${choice}<br>with ${element} element</p>`
        results += `<p>${choice} defended<br>with ${teamsData.targetElement} element</p>`
        results += `<p>HP 146/200 (-${dmg})</p>`
        results += `<button type='button' id='button'>Next</button>`;
    }
    // });

    $('#main').load('html/attack_results.html', () => {
        $('.banner').css('background-color', TEAM_TO_COLOR[user.team]);
        $('.center').html('Team ' + user.team);
        $('#results').html(results);
        document.getElementById('button').addEventListener('click', resetVotes);
    });
}

function logResponse(body) {
    twitch.rig.log('API Response: ' + JSON.stringify(body));
    // $('#color').css('background-color', hex);
}

function logError(_, error, status) {
    twitch.rig.log('EBS request returned error: ' + status + ' (' + error + ')');
}

function logSuccess(hex, status) {
    // we could also use the output to update the block synchronously here,
    // but we want all views to get the same broadcast response at the same time.
    twitch.rig.log('EBS request returned success: ' + hex + ' (' + status + ')');
}

$(function () {

    // when we click the cycle button
    // $('#cycle').click(function () {
    //     if (!token) { return twitch.rig.log('Not authorized'); }
    //     twitch.rig.log('Requesting a color cycle');
    //     $.ajax(requests.set);
    // });

    // listen for incoming broadcast message from our EBS
    twitch.listen('broadcast', function (target, contentType, message) {
        twitch.rig.log('Received broadcast message: ' + JSON.parse(message));
        twitch.rig.log('event: ' + JSON.parse(message).event);
        const event = JSON.parse(message).event;

        if (event == EVENTS.attack) {
            showAttackResults(JSON.parse(message).data);
        } else if (event == EVENTS.voting) {
            parseTeamData(JSON.parse(message).data);
        }
    });
});
