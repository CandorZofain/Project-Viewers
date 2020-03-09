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

function setStyle(element, property, value) {
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
        let x = (HEX_SIZE[0] - HEX_SIZE[2] - 1) * pos[0];
        let y = -((HEX_SIZE[1] - 1) * pos[1] + (HEX_SIZE[1] / 2) * pos[0]);

        if (x < boundX[0]) {
            boundX[0] = x;
        } else if (x > boundX[1]) {
            boundX[1] = x;
        }
        if (y < boundY[0]) {
            boundY[0] = y;
        } else if (y > boundY[1]) {
            boundY[1] = y;
        }

        // Create Hexagon
        // Set the class, position, and innerHTML
        let div = document.createElement('div');
        div.id = `hex_${pos[0]}_${pos[1]}`;
        div.className = `hexagon`;
        setStyle(div, 'left', x);
        setStyle(div, 'top', y);
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
                    <img src='${teamCount == 0 ? BORDER_ONE : BORDER_TWO}' style='z-index: 2' />
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
            console.log(event.currentTarget);
            if (previousMovement < MIN_PIXELS_TO_STOP_CLICK)
                handleHexData(event.currentTarget, JSON.parse(event.currentTarget.dataset.hex));
        }
        MAP.append(div);
    });

    console.log(boundX);
    console.log(boundY);

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

