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

const TEST_VISUAL = false;

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

const TEAMS = [
    'blue',
    'green',
    'red',
    'yellow'
];

const EVENTS = {
    attack: 'ATTACK_RESULTS',
    voting: 'VOTING'
};

// create the request options for our Twitch API calls
var requests = {
    join: createRequest('POST', 'join', joinedTeam),
    vote: createRequest('POST', 'vote'),
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

twitch.onContext(function (context) {
    twitch.rig.log(context);
});

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
        $('#main').load('html/connecting.html');
        return;
    }

    // Loading page until a team is joined
    $('#main').load('html/connecting.html');

    // twitch.rig.log(JSON.stringify(requests.join));
    $.ajax(requests.join);
});

function joinedTeam(body) {
    twitch.rig.log('Successfully joined a team');
    twitch.rig.log('User: ' + JSON.stringify(user));
    twitch.rig.log('clientId: ' + clientId);
    user.team = body.team;
    showTargetVote(body.votes);
}

function parseTeamData(teams) {
    twitch.rig.log(JSON.stringify(teams));
    showTargetVote(teams[user.team].votes);
}

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

function showTargetVote(votes) {
    var inputs = "";
    TEAMS.forEach(t => {
        if (t != user.team) {
            inputs += `<input type="radio" id="vote-${t}" name="vote" value=${t}>${t}: ${votes[TEAM_TO_INT[t]]}<br>`;
        }
    });
    if (channelId == user.id.substring(1)) {
        inputs += `<button type='button' onclick='beginAttack()'>Begin Attack!</button>`;
    }
    // twitch.rig.log(inputs);
    $('#main').load('html/team.html', () => {
        $('.banner').css('background-color', TEAM_TO_COLOR[user.team]);
        $('.center').html('Team ' + user.team);
        $('#input').html(inputs);
        $('input').change(setTargetVote);
    });
}

function beginAttack() {
    twitch.rig.log('Starting attack...');
    $.ajax(requests.attack);
}

function showAttackResults() {
    const teamsData = arguments[0];
    twitch.rig.log('teamsData: ' + JSON.stringify(teamsData));

    var results = "";
    Object.keys(teamsData.teamVotes).forEach(key => {
        const choice = teamsData.teamVotes[key].choice;
        const percent = teamsData.teamVotes[key].percent;
        const dmg = Math.floor(teamsData.baseAttack * percent);
        if (choice) {
            results += `<p>${key} attacked ${choice} for ${dmg} damage!</p>`
        }
    });

    $('#main').load('html/attack_results.html', () => {
        $('.banner').css('background-color', TEAM_TO_COLOR[user.team]);
        $('.center').html('Team ' + user.team);
        $('#results').html(results);
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
