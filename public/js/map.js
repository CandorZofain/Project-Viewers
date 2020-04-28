"use strict";

var MapState = function () {
    let drag = {
        start: [0, 0],
        dist: [0, 0],
        max: [0, 0],
        bound: {
            x: [0, 0],
            y: [0, 0]
        },
        mult: 1,
        dragging: false,
        previous: 0,
        minPixelsToStopClickEvent: 10
    };
    const hexData = {
        size: [300, 258, 75].map(n => n * 0.225),
        imgNorm: 'img/hexagon.png',
        imgBase: 'img/hex-base.png',
        imgCrystals: 'img/hex-crystals.png',
        imgBorder1: 'img/border-blue.png',
        imgBorder2: 'img/border-red.png'
    };
    const MAP_BORDER_ELEMENT = document.getElementById('border');
    const MAP_ELEMENT = document.getElementById('map');

    let target, menu;

    const TAB_SPEED = 4;
    this.openTab = null;

    let timeBar = document.getElementById('timer-bar');

    let SetStyle = function (element, property, value) {
        element.style[property] = value + 'px';
    }

    this.UpdateMap = function () {
        global.Error('UpdateMap is unimplemented');
    }

    let init = function () {
        $(document).on("dragstart", "img", () => { return false; });
        Object.keys(gameState.spaces).forEach(x => {
            Object.keys(gameState.spaces[x]).forEach(y => {
                const space = gameState.spaces[x][y];

                let pxX = (hexData.size[0] - hexData.size[2] - 1) * x;
                let pxY = -((hexData.size[1] - 1) * y + (hexData.size[1] / 2) * x);

                drag.bound = {
                    x: [Math.min(pxX, drag.bound.x[0]), Math.max(pxX, drag.bound.x[1])],
                    y: [Math.min(pxY, drag.bound.y[0]), Math.max(pxY, drag.bound.y[1])]
                };

                let div = document.createElement('div');
                div.id = `hex_${x}_${y}`;
                div.className = 'hexagon';
                SetStyle(div, 'left', pxX);
                SetStyle(div, 'top', pxY);
                div.style['z-index'] = 2 * parseInt(y) + parseInt(x);

                let img = document.createElement('img');
                img.dataset.hex = JSON.stringify([x, y]);
                img.className = 'hex-img';
                // img.draggable = false;
                switch (space.type) {
                    case 0:
                        img.src = hexData.imgNorm;
                        break;
                    case 1:
                        img.src = hexData.imgBase;
                        break;
                    case 2:
                        img.src = hexData.imgCrystals;
                        break;
                    default:
                        global.Error(`Invalid type: ${space.type}`);
                        break;
                }
                img.onclick = event => {
                    if (drag.previous < drag.minPixelsToStopClickEvent) {
                        target = event.currentTarget;
                        map.RemoveMenu();
                        player.HandleHexData(JSON.parse(event.currentTarget.dataset.hex));
                    }
                }

                div.append(img);
                MAP_ELEMENT.append(div);
            });
        });

        let bWidth = drag.bound.x[1] - drag.bound.x[0] + hexData.size[0];
        let bHeight = drag.bound.y[1] - drag.bound.y[0] + hexData.size[1];
        SetStyle(MAP_BORDER_ELEMENT, 'width', bWidth);
        SetStyle(MAP_BORDER_ELEMENT, 'height', bHeight);
        SetStyle(MAP_ELEMENT, 'left', -drag.bound.x[0]);
        SetStyle(MAP_ELEMENT, 'top', -drag.bound.y[0]);

        // Setup variables for dragging
        let main = document.getElementById('main');
        // let zoom = getComputedStyle(MAP_BORDER_ELEMENT).zoom;
        let padding = parseInt(getComputedStyle(MAP_BORDER_ELEMENT).paddingLeft) * 2;
        drag.max = [
            bWidth + padding - main.clientWidth,
            bHeight + padding - main.clientHeight
        ];

        // Create counters - Are invisible to start
        document.querySelectorAll('.hexagon').forEach(hexagon => {
            var counter = document.createElement('div');
            counter.className = 'counter';
            counter.innerHTML = `
                <img src='img/viewer.png' />
                <span class='count'>0</span>
            `;
            hexagon.append(counter);
        });

        document.querySelectorAll('.tab').forEach(tab => {
            tab.onclick = function (event) {
                SwitchTab(event.currentTarget);
            };
        }, this);

        if (!IS_AWS) {
            $(MAP_BORDER_ELEMENT).append(`
            <button type='button' onclick='map.StartTurn()' 
                style='position: absolute; top: 7%; left: 0; width: 80px'>
                Start Turn</button>
            <button type='button' onclick='map.EndTurn()'
                style='position: absolute; top: 11.1%; left: 0; width: 80px'>
                End Turn</button>
            <button type='button' onclick='console.log(gameState)'
                style='position: absolute; top: 15.2%; left: 0; width: 80px'>
                Print Data</button>
            `);
        }

        console.log(drag);
    }; init();

    let SwitchTab = function (tab) {
        // if (tabBox == map.tabs.open) {
        //     map.StartCloseTab(tabBox);
        // } else {
        //     map.StartOpenTab(tabBox);
        // }
        if (tab == map.openTab) {
            document.getElementById(tab.dataset.tabId).style.display = 'none';
            tab.style['z-index'] = -1;
            map.openTab = null;
        } else {
            if (map.openTab != null) {
                document.getElementById(map.openTab.dataset.tabId).style.display = 'none';
                map.openTab.style['z-index'] = -1;
            }

            document.getElementById(tab.dataset.tabId).style.display = 'initial';
            tab.style['z-index'] = 1;

            map.openTab = tab;
        }
    }

    // this.StartOpenTab = function (tabBox) {
    //     if (global.Exists(map.tabs.closing[tabBox])) {
    //         clearInterval(map.tabs.closing[tabBox]);
    //         delete map.tabs.closing[tabBox];
    //     }
    //     if (map.tabs.open != tabBox) {
    //         if (map.tabs.open != null) {
    //             map.StartCloseTab(map.tabs.open);
    //         }
    //         map.tabs.open = tabBox;
    //         let maxWidth = tabBox.dataset.width;
    //         map.tabs.interval = setInterval(() => {
    //             let width = parseInt(window.getComputedStyle(tabBox).getPropertyValue('width'));
    //             width += TAB_SPEED;
    //             if (width >= maxWidth) {
    //                 width = maxWidth;
    //                 clearInterval(map.tabs.interval);
    //                 map.tabs.interval = null;
    //             }
    //             tabBox.style.width = width + 'px';
    //         });
    //     }
    // }

    // this.StartCloseTab = function (tabBox) {
    //     if (map.tabs.open == tabBox) {
    //         if (map.tabs.interval) {
    //             clearInterval(map.tabs.interval);
    //             map.tabs.interval = null;
    //         }
    //         map.tabs.open = null;
    //     }
    //     if (!global.Exists(map.tabs.closing[tabBox])) {
    //         map.tabs.closing[tabBox] = setInterval(() => {
    //             let width = parseInt(window.getComputedStyle(tabBox).getPropertyValue('width'));
    //             width -= TAB_SPEED;
    //             if (width <= 0) {
    //                 width = 0;
    //                 clearInterval(map.tabs.closing[tabBox]);
    //                 delete map.tabs.closing[tabBox];
    //             }
    //             tabBox.style.width = width + 'px';
    //         });
    //     }
    // }

    this.UpdateSpaceTab = function (data) {
        document.getElementById('element-total').innerText = data[0];
        document.getElementById('element-neutral').innerText = data[1];
        document.getElementById('element-fire').innerText = data[2];
        document.getElementById('element-water').innerText = data[3];
        document.getElementById('element-wind').innerText = data[4];
        document.getElementById('element-earth').innerText = data[5];
        if (data[6]) {
            document.getElementById('health-container').style.display = 'flex';
            document.getElementById('health').innerText = data[6];
        } else {
            document.getElementById('health-container').style.display = 'none';
        }
    }

    this.UpdatePlayerTab = function () {
        let elementStr = gameState.user.element;
        document.getElementById('player-element-img').src = `img/element-bead-${elementStr}.png`;
        elementStr = elementStr[0].toUpperCase() + elementStr.slice(1);
        document.getElementById('player-element').innerText = elementStr;

        document.getElementById('player-crystals').innerText = gameState.user.crystals;
    }

    this.StartCountdownUpdates = function () {
        setInterval(() => {
            let diff = ((new Date()).getTime() - (new Date(gameState.turnTime.startTime)).getTime()) / 1000;
            let percent = Math.max(0, (gameState.turnTime.length - diff) / gameState.turnTime.length);
            timeBar.style.width = percent * 100 + '%';
            if (percent == 0) {
                player.ableToMove = false;
            }
        }, 1 / 60);
    }

    document.onmousedown = event => {
        drag.dragging = true;
        drag.start = [event.clientX, event.clientY];
    };

    document.onmouseup = event => {
        drag.dragging = false;
        var left = Math.min(Math.max(drag.dist[0] + (event.clientX - drag.start[0]) * drag.mult, -drag.max[0]), 0);
        var top = Math.min(Math.max(drag.dist[1] + (event.clientY - drag.start[1]) * drag.mult, -drag.max[1]), 0);

        drag.previous = Math.abs(event.clientX - drag.start[0]) + Math.abs(event.clientY - drag.start[1]);
        drag.dist = [left, top];

        if (drag.previous > drag.minPixelsToStopClickEvent) {
            map.RemoveMenu();
        } else if (event.target == document.getElementById('border')) {
            map.RemoveMenu();
            map.UpdateSpaceTab(['-', '-', '-', '-', '-', '-']);
            // map.StartCloseTab(document.getElementById('space-data-tab'));
        }
    }

    document.onmousemove = event => {
        if (!drag.dragging) return;

        var left = Math.min(Math.max(drag.dist[0] + (event.clientX - drag.start[0]) * drag.mult, -drag.max[0]), 0);
        var top = Math.min(Math.max(drag.dist[1] + (event.clientY - drag.start[1]) * drag.mult, -drag.max[1]), 0);

        SetStyle(MAP_BORDER_ELEMENT, 'left', left);
        SetStyle(MAP_BORDER_ELEMENT, 'top', top);
    };

    this.UpdateMap = function () {
        Object.keys(gameState.spaces).forEach(x => {
            Object.keys(gameState.spaces[x]).forEach(y => {
                let space = gameState.spaces[x][y];
                let hexagon = document.getElementById(`hex_${x}_${y}`);
                if (!hexagon) {
                    global.Error(`Unknown hex id: hex_${x}_${y}`);
                    return;
                }

                let count = space.occupants.length;

                let border = hexagon.querySelector('.hex-border');
                if (border) {
                    border.parentElement.removeChild(border);
                }
                if (space.type == 1 || count > 0) {
                    $(hexagon).append(`
                        <img src='${space.team == 1 ? hexData.imgBorder1 : hexData.imgBorder2}' class='hex-border' style='z-index: 2; pointer-events: none' />
                    `)
                }

                if (count > 0) {
                    let counterElement = hexagon.querySelector('.counter');
                    let countElement = hexagon.querySelector('.count');
                    counterElement.style.display = 'inline-block';
                    countElement.innerHTML = count;

                    if (JSON.stringify([x, y]) == JSON.stringify(gameState.user.position)) {
                        counterElement.querySelector('img').src = 'img/viewer-highlight.png';
                        counterElement.style.backgroundColor = '#00000066';
                        counterElement.style.borderColor = '#0000001A';
                        countElement.style.color = '#FBC736';
                        countElement.style.textShadow = '0 0 12px #000000';
                    } else {
                        counterElement.querySelector('img').src = 'img/viewer.png';
                        counterElement.style.backgroundColor = '#FFFFFFB0';
                        counterElement.style.borderColor = '#FFFFFF60';
                        countElement.style.color = '#000000';
                        countElement.style.textShadow = '0 0 12px #FFFFFF';
                    }
                } else {
                    hexagon.querySelector('.counter').style.display = 'none';
                }
            });
        });
    }

    this.CreateMenu = function (buttons) {
        menu = document.createElement('div');
        menu.className = 'options';
        buttons.forEach(button => {
            menu.append(button);
        }, this);
        target.parentNode.append(menu);
    }

    this.RemoveMenu = function () {
        if (menu) {
            menu.parentNode.removeChild(menu);
            menu = null;
        }
    }

    this.StartTurn = function () {
        socket.send(JSON.stringify({
            event: 'start',
            Authorization: auth
        }));
    }
    this.EndTurn = function () {
        socket.send(JSON.stringify({
            event: 'end',
            Authorization: auth
        }));
    }
    this.EndGame = function (winner) {
        let winText;
        switch (winner) {
            case 0:
                winText = 'Tie game!';
                break;
            case 1:
                winText = 'Blue team wins!';
                break;
            case 2:
                winText = 'Red team wins!';
                break;
            default:
                global.Error(`Unknown winning team: ${winner}`);
                break;
        }
        document.getElementById('winner').innerText = winText;
        document.getElementById('end-game').style.display = 'initial';
    }
};