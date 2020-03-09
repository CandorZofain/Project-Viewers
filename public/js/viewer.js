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

const TEAM_TO_COLOR = {
    1: '#2f55de',
    2: '#eb4d4d',
}

const ELEMENTS = ['neutral', 'earth', 'fire', 'water', 'wind'];

const ELEMENT_TO_INT = {
    neutral: 0,
    earth: 1,
    fire: 2,
    water: 3,
    wind: 4
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
        user.team = 1;
        $('#main').load('html/map.html');
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

function beginAttack() {
    twitch.rig.log('Starting attack...');
    $.ajax(requests.attack);
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
