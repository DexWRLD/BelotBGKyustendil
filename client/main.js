const socket = io('https://belot-backend.onrender.com');

const mainMenu = document.getElementById('main-menu');
const joinBtn = document.getElementById('join');
const nameInput = document.getElementById('name');
const joinError = document.getElementById('join-error');
const gameTable = document.getElementById('game-table');
const gameMessage = document.getElementById('game-message');
const biddingDiv = document.getElementById('bidding');
const seatInfo = document.getElementById('seat-info');
const playersList = document.getElementById('players-list');
const handDivs = {
    bottom: document.getElementById('hand-bottom'),
    left: document.getElementById('hand-left'),
    top: document.getElementById('hand-top'),
    right: document.getElementById('hand-right'),
};
const playerInfoDivs = {
    bottom: document.getElementById('player-info-bottom'),
    left: document.getElementById('player-info-left'),
    top: document.getElementById('player-info-top'),
    right: document.getElementById('player-info-right'),
};
const centerTrickDiv = document.getElementById('center-trick');
const scoreboardNie = document.querySelector('#score-nie span');
const scoreboardVie = document.querySelector('#score-vie span');

let mySeat = null;
let players = [];
let myHand = [];
let kontraState = null;
let biddingResult = null;
let playState = null;
let illegalMoveMsg = null;
let phase = 'bidding'; // 'bidding', 'kontra', 'rekontra', 'play'
let kontraTurn = null;

// Helper to map seat index to position
function seatToPosition(mySeat, seat) {
    // mySeat: 1-4, seat: 1-4
    // returns: 'bottom', 'left', 'top', 'right'
    const order = ['bottom', 'left', 'top', 'right'];
    const idx = (seat - mySeat + 4) % 4;
    return order[idx];
}

// Helper to get card image path
function cardImgPath(card) {
    const suitMap = {
        'Каро': 'diamonds',
        'Купа': 'hearts',
        'Пика': 'spades',
        'Спатия': 'clubs',
    };
    return `cards/${suitMap[card.suit]}_${card.rank}.png`;
}

function isLegalCard(card) {
    if (playState && playState.trick && playState.trick.length >= 4) return false;
    if (!playState || playState.turn !== (mySeat - 1)) return false;
    // Simulate the server's isLegalPlay logic
    const hand = myHand;
    // 1. Must have the card (guaranteed)
    // 2. If not first card, must follow suit if possible
    if (playState.trick.length > 0) {
        const leadSuit = playState.trick[0].card.suit;
        const hasLeadSuit = hand.some(c => c.suit === leadSuit);
        if (hasLeadSuit && card.suit !== leadSuit) return false;
        // Trumping/overtrumping
        if (playState.trumpSuit && playState.trumpSuit !== 'none') {
            const trumpSuit = playState.trumpSuit === 'all' ? leadSuit : playState.trumpSuit;
            const hasTrump = hand.some(c => c.suit === trumpSuit);
            const trickTrumps = playState.trick.filter(t => t.card.suit === trumpSuit);
            if (!hasLeadSuit && hasTrump) {
                // Must play trump
                if (card.suit !== trumpSuit) return false;
                // Overtrumping: if trump has been played, must play higher if possible
                if (trickTrumps.length > 0) {
                    const highestTrump = trickTrumps.reduce((max, t) => cardRankValue(t.card, trumpSuit) > cardRankValue(max.card, trumpSuit) ? t : max);
                    const myHigherTrumps = hand.filter(c => c.suit === trumpSuit && cardRankValue(c, trumpSuit) > cardRankValue(highestTrump.card, trumpSuit));
                    if (myHigherTrumps.length > 0 && cardRankValue(card, trumpSuit) <= cardRankValue(highestTrump.card, trumpSuit)) {
                        return false;
                    }
                }
            }
        }
    }
    return true;
}

function cardRankValue(card, trumpSuit) {
    const orderTrump = ['7','8','Q','K','10','A','9','J'];
    const orderNormal = ['7','8','9','J','Q','K','10','A'];
    if (trumpSuit === 'all' || card.suit === trumpSuit) {
        return orderTrump.indexOf(card.rank);
    } else {
        return orderNormal.indexOf(card.rank);
    }
}

function animateCardToCenter(cardElement, fromPosition, callback) {
    const centerTrick = document.getElementById('center-trick');
    const cardClone = cardElement.cloneNode(true);
    cardClone.style.position = 'fixed';
    cardClone.style.zIndex = '1000';
    
    // Get original card position based on player position
    let cardRect;
    if (fromPosition === 'bottom') {
        cardRect = cardElement.getBoundingClientRect();
    } else {
        // For other players, get the position of their hand
        const handDiv = handDivs[fromPosition];
        cardRect = handDiv.getBoundingClientRect();
    }
    
    const centerRect = centerTrick.getBoundingClientRect();
    
    // Set initial position and fixed size
    cardClone.style.left = `${cardRect.left}px`;
    cardClone.style.top = `${cardRect.top}px`;
    cardClone.style.width = '80px';
    cardClone.style.height = '120px';
    
    document.body.appendChild(cardClone);
    
    // Calculate center position (adjust for fixed size)
    const centerX = centerRect.left + (centerRect.width - 80) / 2;
    const centerY = centerRect.top + (centerRect.height - 120) / 2;
    
    // Animate to center
    cardClone.animate([
        {
            transform: 'translate(0, 0) rotate(0deg)',
            left: `${cardRect.left}px`,
            top: `${cardRect.top}px`,
            width: '80px',
            height: '120px'
        },
        {
            transform: 'translate(0, -50px) rotate(180deg)',
            left: `${(cardRect.left + centerX) / 2}px`,
            top: `${Math.min(cardRect.top, centerY) - 50}px`,
            width: '80px',
            height: '120px'
        },
        {
            transform: 'translate(0, 0) rotate(360deg)',
            left: `${centerX}px`,
            top: `${centerY}px`,
            width: '80px',
            height: '120px'
        }
    ], {
        duration: 400,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        fill: 'forwards'
    }).onfinish = () => {
        cardClone.remove();
        if (callback) callback();
    };
}

// Render all hands
function renderHands() {
    Object.values(handDivs).forEach(div => div.innerHTML = '');
    players.forEach((p, i) => {
        const pos = seatToPosition(mySeat, p.seat);
        if (myHand.length === 0) {
            for (let j = 0; j < 5; j++) {
                const img = document.createElement('img');
                img.src = 'cards/back_dark.png';
                img.className = 'card-img card-back';
                img.alt = 'Обърната карта';
                handDivs[pos].appendChild(img);
            }
        } else {
            if (pos === 'bottom') {
                myHand.forEach((card, idx) => {
                    const img = document.createElement('img');
                    img.src = cardImgPath(card);
                    img.className = 'card-img';
                    img.alt = `${card.suit} ${card.rank}`;
                    // Gray out if not legal
                    if (playState && playState.turn === (mySeat - 1)) {
                        if (!isLegalCard(card)) {
                            img.style.opacity = '0.4';
                            img.style.cursor = 'not-allowed';
                        } else {
                            img.style.cursor = 'pointer';
                            img.onclick = () => {
                                // First emit the play-card event immediately
                                socket.emit('play-card', card);
                                // Then animate the card
                                animateCardToCenter(img, 'bottom');
                            };
                        }
                    } else {
                        img.style.opacity = '0.4';
                        img.style.cursor = 'not-allowed';
                    }
                    handDivs[pos].appendChild(img);
                });
            } else {
                for (let j = 0; j < (playState ? playState.handsCount[i] : 5); j++) {
                    const img = document.createElement('img');
                    img.src = 'cards/back_dark.png';
                    img.className = 'card-img card-back';
                    img.alt = 'Обърната карта';
                    handDivs[pos].appendChild(img);
                }
            }
        }
    });
}

// Render player names
function renderPlayerNames() {
    players.forEach((p, i) => {
        const pos = seatToPosition(mySeat, p.seat);
        playerInfoDivs[pos].textContent = p.name;
    });
}

// --- Join flow ---
joinBtn.onclick = () => {
    const name = nameInput.value.trim();
    if (!name) {
        joinError.textContent = 'Моля, въведи име!';
        return;
    }
    joinBtn.disabled = true;
    nameInput.disabled = true;
    joinError.textContent = '';
    socket.emit('join', name);
};

socket.on('seat', ({ seat, name }) => {
    mySeat = seat;
    mainMenu.style.display = 'none';
    gameTable.style.display = '';
});

socket.on('full', (msg) => {
    joinError.textContent = msg;
    joinBtn.disabled = false;
    nameInput.disabled = false;
});

// --- Game events ---
socket.on('players', (pList) => {
    players = pList;
    if (mySeat) {
        renderPlayerNames();
        renderHands();
    }
});

socket.on('start', (msg) => {
    gameMessage.textContent = msg;
});

socket.on('your-cards', (cards) => {
    myHand = cards;
    renderHands();
});

const BID_ORDER = ['Каро', 'Купа', 'Пика', 'Спатия', 'Без коз', 'Всичко коз'];

socket.on('bidding-state', (state) => {
    // Show bidding UI
    let html = '<h3>Наддаване</h3>';
    html += '<div>Текуща обява: ' + (state.currentBid || 'няма') + '</div>';
    if (state.declarer !== null) {
        html += '<div>Обявяващ: ' + state.declarer + '</div>';
    }
    html += '<div>История:</div>';
    html += '<ul>' + state.history.map(h => `<li>${state.players[h.player].name}: ${h.bid}</li>`).join('') + '</ul>';
    
    // If it's my turn, show bid buttons
    if (mySeat && state.turn === (mySeat - 1)) {
        html += '<div>Твой ред за наддаване:</div>';
        html += '<div style="margin-top:10px;">';
        // Show only higher bids than current
        let canBid = false;
        for (let i = 0; i < BID_ORDER.length; i++) {
            if (!state.currentBid || BID_ORDER.indexOf(BID_ORDER[i]) > BID_ORDER.indexOf(state.currentBid)) {
                html += `<button class="bid-btn" data-bid="${BID_ORDER[i]}">${BID_ORDER[i]}</button> `;
                canBid = true;
            }
        }
        html += '<button class="bid-btn" data-bid="Пас">Пас</button>';
        html += '</div>';
        if (!canBid && state.currentBid) {
            html += '<div style="color:#c00;">Можеш само да пасуваш.</div>';
        }
    } else {
        html += '<div>Чакаме ход на: ' + state.players[state.turn].name + '</div>';
    }
    
    biddingDiv.innerHTML = html;
    biddingDiv.style.display = 'block';
    
    // Add event listeners for bid buttons
    document.querySelectorAll('.bid-btn').forEach(btn => {
        btn.onclick = () => {
            socket.emit('bid', btn.dataset.bid);
        };
    });
});

function canCallKontra() {
    if (!biddingResult) return false;
    const declarerTeam = biddingResult.declarerIdx % 2;
    return (mySeat - 1) % 2 !== declarerTeam && kontraState === null;
}
function canCallRekontra() {
    if (!biddingResult) return false;
    const declarerTeam = biddingResult.declarerIdx % 2;
    return (mySeat - 1) % 2 === declarerTeam && kontraState === 'контра';
}

socket.on('bidding-end', (data) => {
    if (data.contract) {
        biddingResult = data;
        phase = 'kontra';
        
        // Create or update contract info display
        let contractInfo = document.getElementById('contract-info');
        if (!contractInfo) {
            contractInfo = document.createElement('div');
            contractInfo.id = 'contract-info';
            document.getElementById('game-table').appendChild(contractInfo);
        }
        
        // Show contract info
        contractInfo.innerHTML = `
            <div>Обявен контракт:</div>
            <div>${data.contract} от ${data.declarer}</div>
        `;
        contractInfo.style.display = 'block';
        
        // Don't clear the bidding div during kontra phase
        renderKontraUI();
    } else {
        biddingDiv.innerHTML = `<h3>Наддаването приключи!</h3><div>Всички пасуваха. Ново раздаване.</div>`;
        biddingResult = null;
        phase = 'bidding';
    }
});

socket.on('kontra-state', (data) => {
    console.log('kontra-state event:', data, 'mySeat:', mySeat, 'players:', players);
    kontraState = data.state;
    kontraTurn = data.turn;
    
    // Always ensure biddingDiv is visible during kontra phase
    biddingDiv.style.display = 'block';
    
    if (kontraState === 'контра') {
        phase = 'rekontra';
        renderKontraUI();
    } else if (kontraState === 'реконтра') {
        phase = 'play';
        // Clear bidding div when moving to play phase
        biddingDiv.innerHTML = '';
        biddingDiv.style.display = 'none';
        initializePlayPhase();
    } else if (kontraState === null && kontraTurn === null && biddingResult) {
        phase = 'play';
        // Clear bidding div when moving to play phase
        biddingDiv.innerHTML = '';
        biddingDiv.style.display = 'none';
        initializePlayPhase();
    } else {
        // Keep kontra phase active if turn is not null
        phase = 'kontra';
        renderKontraUI();
    }
});

function renderKontraUI() {
    if (!biddingResult) return;
    
    // Debugging output
    console.log('renderKontraUI phase:', phase, 'kontraTurn:', kontraTurn, 'mySeat:', mySeat, 'canCallKontra:', canCallKontra(), 'canCallRekontra:', canCallRekontra(), 'players:', players);
    
    let html = '';
    
    // Always ensure biddingDiv is visible
    biddingDiv.style.display = 'block';
    
    if (phase === 'kontra') {
        html += `<h3>Контра/Пас</h3><div>Може да обявите контра или да пасувате.</div>`;
        if (canCallKontra() && kontraTurn === (mySeat - 1)) {
            html += '<button id="btn-kontra">Контра</button> ';
            html += '<button id="btn-kontra-pass">Пас</button>';
        } else if (kontraTurn !== null) {
            html += `<div style="margin-top:10px;">Чакаме ход на: <b>${players[kontraTurn]?.name || ''}</b></div>`;
        }
    } else if (phase === 'rekontra') {
        html += `<h3>Реконтра/Пас</h3><div>Може да обявите реконта или да пасувате.</div>`;
        if (canCallRekontra() && kontraTurn === (mySeat - 1)) {
            html += '<button id="btn-rekontra">Реконтра</button> ';
            html += '<button id="btn-rekontra-pass">Пас</button>';
        } else if (kontraTurn !== null) {
            html += `<div style="margin-top:10px;">Чакаме ход на: <b>${players[kontraTurn]?.name || ''}</b></div>`;
        }
        if (kontraState === 'контра') {
            html += '<div style="margin-top:10px;font-size:22px;color:#ff0;">Контра!</div>';
        }
    }
    
    // Keep teammate windows visible
    Object.values(playerInfoDivs).forEach(div => {
        if (div) div.style.display = 'block';
    });
    
    biddingDiv.innerHTML = html;
    
    // Set up button handlers
    if (canCallKontra() && kontraTurn === (mySeat - 1)) {
        const btnKontra = document.getElementById('btn-kontra');
        const btnKontraPass = document.getElementById('btn-kontra-pass');
        if (btnKontra) btnKontra.onclick = () => { 
            socket.emit('call-kontra');
            // Keep UI visible after clicking
            setTimeout(() => renderKontraUI(), 100);
        };
        if (btnKontraPass) btnKontraPass.onclick = () => { 
            socket.emit('kontra-pass');
            // Keep UI visible after clicking
            setTimeout(() => renderKontraUI(), 100);
        };
    }
    if (canCallRekontra() && kontraTurn === (mySeat - 1)) {
        const btnRekontra = document.getElementById('btn-rekontra');
        const btnRekontraPass = document.getElementById('btn-rekontra-pass');
        if (btnRekontra) btnRekontra.onclick = () => { 
            socket.emit('call-rekontra');
            // Keep UI visible after clicking
            setTimeout(() => renderKontraUI(), 100);
        };
        if (btnRekontraPass) btnRekontraPass.onclick = () => { 
            socket.emit('rekontra-pass');
            // Keep UI visible after clicking
            setTimeout(() => renderKontraUI(), 100);
        };
    }
}

// Add function to initialize play phase UI
function initializePlayPhase() {
    // Clear any existing center trick
    const centerTrick = document.getElementById('center-trick');
    if (centerTrick) {
        centerTrick.innerHTML = '';
    }
    
    // Initialize hand divs if not already done
    if (!handDivs) {
        handDivs = {
            bottom: document.getElementById('bottom-hand'),
            left: document.getElementById('left-hand'),
            top: document.getElementById('top-hand'),
            right: document.getElementById('right-hand')
        };
    }
    
    // Add click handlers to cards in my hand
    const myHandDiv = handDivs.bottom;
    if (myHandDiv) {
        myHandDiv.querySelectorAll('.card-img').forEach(card => {
            card.onclick = () => {
                const cardData = {
                    suit: card.dataset.suit,
                    rank: card.dataset.rank
                };
                socket.emit('play-card', cardData);
            };
        });
    }
}

// Add a function to update the center trick display
function updateCenterTrick() {
    const centerTrick = document.getElementById('center-trick');
    centerTrick.innerHTML = ''; // Clear existing cards
    
    if (playState && playState.trick) {
        playState.trick.forEach(({ card, player }) => {
            const trickCard = document.createElement('img');
            trickCard.src = cardImgPath(card);
            trickCard.className = 'card-img trick-card';
            trickCard.alt = `${card.suit} ${card.rank}`;
            // Add player-specific positioning class
            trickCard.classList.add(`player-${player}`);
            centerTrick.appendChild(trickCard);
        });
    }
}

// Modify the socket.on('play-state') handler to update the center trick
socket.on('play-state', (state) => {
    playState = state;
    renderHands();
    updateCenterTrick();
    
    // Update scores
    if (state.scores) {
        console.log('Updating scores:', state.scores);
        scoreboardNie.textContent = state.scores[0];
        scoreboardVie.textContent = state.scores[1];
    }
});

socket.on('illegal-move', (msg) => {
    if (illegalMoveMsg) clearTimeout(illegalMoveMsg);
    gameMessage.textContent = msg;
    illegalMoveMsg = setTimeout(() => { gameMessage.textContent = ''; }, 2000);
});

// Modify the card-played event handler
socket.on('card-played', ({ card, player, fromPosition }) => {
    console.log('Received card-played event:', { card, player, fromPosition });
    
    // Create a temporary card element for animation
    const tempCard = document.createElement('img');
    tempCard.src = cardImgPath(card);
    tempCard.className = 'card-img';
    tempCard.alt = `${card.suit} ${card.rank}`;
    document.body.appendChild(tempCard);
    
    // Get the hand position for the player
    const handDiv = handDivs[fromPosition];
    console.log('Hand div for position', fromPosition, ':', handDiv);
    
    if (handDiv) {
        // Position the temporary card at the hand location
        const handRect = handDiv.getBoundingClientRect();
        console.log('Hand rect:', handRect);
        
        tempCard.style.position = 'fixed';
        tempCard.style.left = `${handRect.left}px`;
        tempCard.style.top = `${handRect.top}px`;
        tempCard.style.width = `${handRect.width / 5}px`; // Approximate card width
        tempCard.style.height = `${handRect.height}px`;
        tempCard.style.zIndex = '1000';
        
        // Animate the card
        animateCardToCenter(tempCard, fromPosition);
        
        // Remove the temporary card after animation
        setTimeout(() => tempCard.remove(), 700); // Slightly longer than animation duration
    } else {
        console.log('No hand div found for position:', fromPosition);
        tempCard.remove();
    }
});

socket.on('join', (data) => {
    mySeat = data.seat;
    players = data.players;
    mainMenu.style.display = 'none';
    gameTable.style.display = 'block';
    seatInfo.textContent = `Your seat: ${mySeat}`;
    renderPlayerNames();
    
    // Reset scores when joining
    scoreboardNie.textContent = '0';
    scoreboardVie.textContent = '0';
    
    // Start bidding if all players are present
    if (players.length === 4) {
        socket.emit('start-bidding');
    }
}); 