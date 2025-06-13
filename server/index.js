const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

const PORT = process.env.PORT || 3001;

let players = [];
let deck = [];
let bidding = null;
let playerHands = [[], [], [], []]; // Store hands for each player
let kontraState = null; // null, 'контра', 'реконтра'
let playPhase = null; // {trick: [], turn: idx, contract, trumpSuit, hands: [...], played: [...], ...}
let kontraPasses = [];
let kontraTurn = null; // index of the player whose turn it is for контра/реконтра

const SUITS = ['Каро', 'Купа', 'Пика', 'Спатия'];
const RANKS = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const BID_ORDER = ['Каро', 'Купа', 'Пика', 'Спатия', 'Без коз', 'Всичко коз'];

function createDeck() {
    const d = [];
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            d.push({ suit, rank });
        }
    }
    return d;
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function dealCards() {
    deck = createDeck();
    shuffle(deck);
    // Deal 3, then 2 cards to each player (total 5)
    playerHands = [[], [], [], []];
    for (let round = 0; round < 3; round++) {
        for (let i = 0; i < 4; i++) {
            playerHands[i].push(deck.pop());
        }
    }
    for (let round = 0; round < 2; round++) {
        for (let i = 0; i < 4; i++) {
            playerHands[i].push(deck.pop());
        }
    }
    return playerHands;
}

function secondDeal() {
    // Deal 3 more cards to each player
    for (let round = 0; round < 3; round++) {
        for (let i = 0; i < 4; i++) {
            playerHands[i].push(deck.pop());
        }
    }
    // Send updated hands to each player
    players.forEach((p, idx) => {
        io.to(p.id).emit('your-cards', playerHands[idx]);
    });
}

function getNextPlayerIdx(idx) {
    return (idx + 1) % 4;
}

function isHigherBid(newBid, currentBid) {
    if (!currentBid) return true;
    return BID_ORDER.indexOf(newBid) > BID_ORDER.indexOf(currentBid);
}

function startBidding() {
    bidding = {
        currentBid: null,
        declarer: null,
        passes: 0,
        turn: 0, // Player 1 starts (seat 1)
        order: [0, 1, 2, 3],
        history: []
    };
    io.emit('bidding-state', {
        currentBid: bidding.currentBid,
        declarer: bidding.declarer,
        turn: bidding.turn,
        history: bidding.history,
        players: players.map(p => ({ name: p.name, seat: p.seat }))
    });
}

function resetKontra() {
    kontraState = null;
    kontraPasses = [];
}

function canCallKontra(playerIdx) {
    if (!biddingResult) return false;
    const declarerTeam = biddingResult.declarerIdx % 2;
    return (playerIdx % 2 !== declarerTeam) && kontraState === null && !kontraPasses.includes(playerIdx);
}

function canCallRekontra(playerIdx) {
    if (!biddingResult) return false;
    const declarerTeam = biddingResult.declarerIdx % 2;
    return (playerIdx % 2 === declarerTeam) && kontraState === 'контра' && !kontraPasses.includes(playerIdx);
}

function allKontraPasses() {
    // All eligible players have passed for контра
    if (!biddingResult) return false;
    const declarerTeam = biddingResult.declarerIdx % 2;
    return kontraPasses.length === 2 && kontraState === null;
}

function allRekontraPasses() {
    if (!biddingResult) return false;
    const declarerTeam = biddingResult.declarerIdx % 2;
    return kontraPasses.length === 2 && kontraState === 'контра';
}

let biddingResult = null; // {contract, declarer, declarerIdx}

function kontraEligiblePlayers() {
    if (!biddingResult) return [];
    const declarerTeam = biddingResult.declarerIdx % 2;
    return [0,1,2,3].filter(idx => idx % 2 !== declarerTeam);
}
function rekontraEligiblePlayers() {
    if (!biddingResult) return [];
    const declarerTeam = biddingResult.declarerIdx % 2;
    return [0,1,2,3].filter(idx => idx % 2 === declarerTeam);
}
function nextKontraTurn() {
    const eligible = kontraState === 'контра' ? rekontraEligiblePlayers() : kontraEligiblePlayers();
    const passed = kontraPasses;
    const remaining = eligible.filter(idx => !passed.includes(idx));
    return remaining.length > 0 ? remaining[0] : null;
}
function broadcastKontraState() {
    io.emit('kontra-state', { state: kontraState, turn: kontraTurn });
}

function handleBid(playerIdx, bid) {
    if (!bidding || bidding.turn !== playerIdx) return;
    if (bid === 'Пас') {
        bidding.history.push({ player: playerIdx, bid: 'Пас' });
        bidding.passes++;
        if (bidding.passes >= 3 && bidding.currentBid) {
            // Bidding ends
            biddingResult = {
                contract: bidding.currentBid,
                declarer: players[bidding.declarer].name,
                declarerIdx: bidding.declarer
            };
            
            // Second deal
            secondDeal();
            
            // Allow контра/реконтра
            resetKontra();
            const eligible = kontraEligiblePlayers();
            kontraTurn = eligible.length > 0 ? eligible[0] : null;
            
            // First broadcast bidding end
            io.emit('bidding-end', {
                contract: bidding.currentBid,
                declarer: players[bidding.declarer].name
            });
            
            // Then broadcast kontra state after a short delay
            setTimeout(() => {
                console.log('After bidding: kontraEligiblePlayers:', kontraEligiblePlayers(), 'kontraTurn:', kontraTurn, 'players:', players.map(p => p.name));
                broadcastKontraState();
            }, 100);
            
            bidding = null;
            return;
        }
        // If all pass and no bid, redeal (not implemented here)
        if (bidding.passes >= 4 && !bidding.currentBid) {
            io.emit('bidding-end', { contract: null, declarer: null });
            bidding = null;
            return;
        }
        bidding.turn = getNextPlayerIdx(bidding.turn);
    } else {
        // Must be higher than current bid
        if (!isHigherBid(bid, bidding.currentBid)) return;
        bidding.currentBid = bid;
        bidding.declarer = bidding.turn;
        bidding.passes = 0;
        bidding.history.push({ player: playerIdx, bid });
        bidding.turn = getNextPlayerIdx(bidding.turn);
    }
    io.emit('bidding-state', {
        currentBid: bidding.currentBid,
        declarer: bidding.declarer !== null ? players[bidding.declarer].name : null,
        turn: bidding.turn,
        history: bidding.history,
        players: players.map(p => ({ name: p.name, seat: p.seat }))
    });
}

function startPlayPhase() {
    // Determine trump suit
    let trumpSuit = null;
    if (biddingResult.contract === 'Всичко коз') trumpSuit = 'all';
    else if (biddingResult.contract === 'Без коз') trumpSuit = null;
    else trumpSuit = biddingResult.contract;
    
    // Deep copy hands
    const hands = playerHands.map(h => h.slice());
    
    // Reset playPhase completely
    playPhase = {
        trick: [],
        turn: (biddingResult.declarerIdx + 1) % 4, // Player right of declarer starts
        contract: biddingResult.contract,
        trumpSuit,
        hands,
        played: [[], [], [], []], // Cards played by each player
        trickLeader: (biddingResult.declarerIdx + 1) % 4,
        tricks: [[], []], // Store tricks for each team
        scores: [0, 0], // Reset team scores to 0
    };
    
    // Log the start of play phase
    console.log('Starting play phase:', {
        turn: playPhase.turn,
        contract: playPhase.contract,
        trumpSuit: playPhase.trumpSuit,
        handsCount: playPhase.hands.map(h => h.length),
        scores: playPhase.scores // Log the scores to verify they're reset
    });
    
    // Broadcast initial state with reset scores
    broadcastPlayState();
}

function broadcastPlayState() {
    io.emit('play-state', {
        trick: playPhase.trick,
        turn: playPhase.turn,
        handsCount: playPhase.hands.map(h => h.length),
        played: playPhase.played,
        contract: playPhase.contract,
        trumpSuit: playPhase.trumpSuit,
        trickLeader: playPhase.trickLeader,
        tricks: playPhase.tricks,
        scores: playPhase.scores,
    });
}

function isLegalPlay(playerIdx, card) {
    const hand = playPhase.hands[playerIdx];
    // 1. Must have the card
    const cardIdx = hand.findIndex(c => c.suit === card.suit && c.rank === card.rank);
    if (cardIdx === -1) return false;
    
    // 2. If not first card, must follow suit if possible
    if (playPhase.trick.length > 0) {
        const leadSuit = playPhase.trick[0].card.suit;
        const hasLeadSuit = hand.some(c => c.suit === leadSuit);
        
        // In all-trumps, you must follow suit if you can
        if (playPhase.trumpSuit === 'all') {
            if (hasLeadSuit && card.suit !== leadSuit) return false;
        } else {
            // Normal trump rules
            if (hasLeadSuit && card.suit !== leadSuit) return false;
            
            // Trumping/overtrumping
            if (playPhase.trumpSuit) {
                const hasTrump = hand.some(c => c.suit === playPhase.trumpSuit);
                const trickTrumps = playPhase.trick.filter(t => t.card.suit === playPhase.trumpSuit);
                
                if (!hasLeadSuit && hasTrump) {
                    // Must play trump
                    if (card.suit !== playPhase.trumpSuit) return false;
                    
                    // Overtrumping: if trump has been played, must play higher if possible
                    if (trickTrumps.length > 0) {
                        const highestTrump = trickTrumps.reduce((max, t) => 
                            cardRankValue(t.card, playPhase.trumpSuit) > cardRankValue(max.card, playPhase.trumpSuit) ? t : max
                        );
                        const myHigherTrumps = hand.filter(c => 
                            c.suit === playPhase.trumpSuit && 
                            cardRankValue(c, playPhase.trumpSuit) > cardRankValue(highestTrump.card, playPhase.trumpSuit)
                        );
                        if (myHigherTrumps.length > 0 && 
                            cardRankValue(card, playPhase.trumpSuit) <= cardRankValue(highestTrump.card, playPhase.trumpSuit)) {
                            return false;
                        }
                    }
                }
            }
        }
    }
    return true;
}

function cardRankValue(card, trumpSuit) {
    // Returns the value for comparing cards in a trick
    const orderTrump = ['7','8','Q','K','10','A','9','J'];
    const orderNormal = ['7','8','9','J','Q','K','10','A'];
    if (trumpSuit === 'all' || card.suit === trumpSuit) {
        return orderTrump.indexOf(card.rank);
    } else {
        return orderNormal.indexOf(card.rank);
    }
}

// Add this function before the socket.on handlers
function seatToPosition(playerIdx) {
    // Convert player index (0-3) to position ('bottom', 'left', 'top', 'right')
    const positions = ['bottom', 'left', 'top', 'right'];
    return positions[playerIdx];
}

function resetGameState() {
    players = [];
    deck = [];
    bidding = null;
    playerHands = [[], [], [], []];
    kontraState = null;
    playPhase = null;
    kontraPasses = [];
    kontraTurn = null;
    biddingResult = null;
}

io.on('connection', (socket) => {
    console.log('Нов играч се свърза:', socket.id);

    socket.on('join', (name) => {
        if (players.length >= 4) {
            socket.emit('full', 'Стаята е пълна!');
            return;
        }
        
        // Reset game state if this is the first player joining
        if (players.length === 0) {
            resetGameState();
        }
        
        // Assign seat (1-4)
        const seat = players.length + 1;
        players.push({ id: socket.id, name, seat });
        socket.emit('seat', { seat, name });
        io.emit('players', players.map(p => ({ name: p.name, seat: p.seat })));
        if (players.length === 4) {
            io.emit('start', 'Играта започва!');
            // Deal cards and send to each player
            dealCards();
            players.forEach((p, idx) => {
                io.to(p.id).emit('your-cards', playerHands[idx]);
            });
            // Start bidding phase
            startBidding();
        }
    });

    socket.on('bid', (bid) => {
        const playerIdx = players.findIndex(p => p.id === socket.id);
        if (playerIdx !== -1 && bidding) {
            handleBid(playerIdx, bid);
        }
    });

    socket.on('call-kontra', () => {
        const playerIdx = players.findIndex(p => p.id === socket.id);
        if (canCallKontra(playerIdx) && kontraTurn === playerIdx) {
            kontraState = 'контра';
            kontraPasses = [];
            kontraTurn = rekontraEligiblePlayers()[0] || null;
            broadcastKontraState();
        }
    });

    socket.on('kontra-pass', () => {
        const playerIdx = players.findIndex(p => p.id === socket.id);
        if (canCallKontra(playerIdx) && kontraTurn === playerIdx) {
            kontraPasses.push(playerIdx);
            
            if (kontraState === null) {
                // First kontra phase
                const eligible = kontraEligiblePlayers();
                const remaining = eligible.filter(idx => !kontraPasses.includes(idx));
                
                if (remaining.length > 0) {
                    // More players can still call kontra
                    kontraTurn = remaining[0];
                } else {
                    // All eligible players have passed
                    if (kontraPasses.length === 2) {
                        // Both players passed, move to play phase
                        kontraTurn = null;
                        broadcastKontraState();
                        startPlayPhase();
                        return;
                    }
                }
            } else if (kontraState === 'контра') {
                // Rekontra phase
                kontraPasses = []; // Reset passes for rekontra
                const eligible = rekontraEligiblePlayers();
                const remaining = eligible.filter(idx => !kontraPasses.includes(idx));
                
                if (remaining.length > 0) {
                    kontraTurn = remaining[0];
                } else {
                    // All players passed on rekontra
                    kontraTurn = null;
                    broadcastKontraState();
                    startPlayPhase();
                    return;
                }
            }
            
            broadcastKontraState();
        }
    });

    socket.on('call-rekontra', () => {
        const playerIdx = players.findIndex(p => p.id === socket.id);
        if (canCallRekontra(playerIdx) && kontraTurn === playerIdx) {
            kontraState = 'реконтра';
            kontraPasses = [];
            kontraTurn = null;
            broadcastKontraState();
            startPlayPhase();
        }
    });

    socket.on('rekontra-pass', () => {
        const playerIdx = players.findIndex(p => p.id === socket.id);
        if (canCallRekontra(playerIdx) && kontraTurn === playerIdx) {
            kontraPasses.push(playerIdx);
            const eligible = rekontraEligiblePlayers();
            const remaining = eligible.filter(idx => !kontraPasses.includes(idx));
            if (remaining.length > 0) {
                kontraTurn = remaining[0];
                broadcastKontraState();
            } else {
                kontraTurn = null;
                broadcastKontraState();
                startPlayPhase();
            }
        }
    });

    socket.on('start-play-phase', () => {
        // Only allow once, after bidding/kontra
        if (!playPhase && biddingResult) {
            startPlayPhase();
        }
    });

    socket.on('play-card', (card) => {
        if (!playPhase) {
            console.log('Play phase not initialized');
            return;
        }
        const playerIdx = players.findIndex(p => p.id === socket.id);
        if (playerIdx !== playPhase.turn) {
            console.log('Not player\'s turn:', { playerIdx, currentTurn: playPhase.turn });
            return;
        }
        if (!isLegalPlay(playerIdx, card)) {
            console.log('Illegal play:', { playerIdx, card });
            socket.emit('illegal-move', 'Невалиден ход!');
            return;
        }
        
        // Remove card from hand
        const cardIdx = playPhase.hands[playerIdx].findIndex(c => c.suit === card.suit && c.rank === card.rank);
        playPhase.hands[playerIdx].splice(cardIdx, 1);
        playPhase.trick.push({ card, player: playerIdx });
        playPhase.played[playerIdx].push(card);
        
        // Log the card play
        console.log('Card played:', {
            player: playerIdx,
            card,
            fromPosition: seatToPosition(playerIdx)
        });
        
        // Broadcast the card play to all players
        io.emit('card-played', {
            card,
            player: playerIdx,
            fromPosition: seatToPosition(playerIdx)
        });
        
        // Update turn and broadcast new state
        if (playPhase.trick.length === 4) {
            // Determine winner and reset trick
            const winner = determineTrickWinner(playPhase.trick, playPhase.trumpSuit, playPhase.trickLeader);
            // Store the trick for the winning team
            const winningTeam = Math.floor(winner / 2);
            playPhase.tricks[winningTeam].push([...playPhase.trick]);
            
            // Calculate points for this trick
            const trickPoints = calculateTrickPoints(playPhase.trick, playPhase.trumpSuit);
            console.log('Points for this trick:', trickPoints);
            
            // Update team scores
            playPhase.scores[winningTeam] += trickPoints;
            console.log('Updated team scores:', playPhase.scores);
            
            // Check for capo (winning all 8 tricks)
            if (playPhase.tricks[winningTeam].length === 8) {
                playPhase.scores[winningTeam] += 90; // Capo bonus
                console.log('Capo bonus added!');
            }
            
            // Add last trick bonus (10 points)
            if (playPhase.tricks[0].length + playPhase.tricks[1].length === 8) {
                playPhase.scores[winningTeam] += 10; // Last trick bonus
                console.log('Last trick bonus added!');
            }
            
            // Reset trick and update turn
            playPhase.trick = [];
            playPhase.turn = winner;
            playPhase.trickLeader = winner;
        } else {
            playPhase.turn = (playPhase.turn + 1) % 4;
        }
        broadcastPlayState();
    });

    socket.on('disconnect', () => {
        players = players.filter(p => p.id !== socket.id);
        io.emit('players', players.map(p => ({ name: p.name, seat: p.seat })));
        bidding = null;
    });
});

function determineTrickWinner(trick, trumpSuit, leaderIdx) {
    // Returns the playerIdx of the winner
    const leadSuit = trick[0].card.suit;
    let winner = trick[0];
    for (let i = 1; i < trick.length; i++) {
        const c = trick[i].card;
        if (trumpSuit === 'all') {
            // All suits are trump, highest card in suit wins
            if (cardRankValue(c, c.suit) < cardRankValue(winner.card, winner.card.suit)) {
                winner = trick[i];
            }
        } else if (trumpSuit && c.suit === trumpSuit && winner.card.suit !== trumpSuit) {
            winner = trick[i];
        } else if (c.suit === winner.card.suit && cardRankValue(c, trumpSuit) < cardRankValue(winner.card, trumpSuit)) {
            winner = trick[i];
        }
    }
    return winner.player;
}

function calculateTrickPoints(trick, trumpSuit) {
    let points = 0;
    for (const { card } of trick) {
        // In all-trumps, all cards are treated as trump cards
        if (trumpSuit === 'all') {
            if (card.rank === '7' || card.rank === '8') points += 0;
            else if (card.rank === '9') points += 14;
            else if (card.rank === '10') points += 10;
            else if (card.rank === 'J') points += 20;
            else if (card.rank === 'Q') points += 3;
            else if (card.rank === 'K') points += 4;
            else if (card.rank === 'A') points += 11;
        } else {
            const isTrump = card.suit === trumpSuit;
            if (card.rank === '7' || card.rank === '8') points += 0;
            else if (card.rank === '9') points += isTrump ? 14 : 0;
            else if (card.rank === '10') points += 10;
            else if (card.rank === 'J') points += isTrump ? 20 : 2;
            else if (card.rank === 'Q') points += 3;
            else if (card.rank === 'K') points += 4;
            else if (card.rank === 'A') points += 11;
        }
    }
    return points;
}

server.listen(PORT, () => {
    console.log(`Сървърът работи на порт ${PORT}`);
}); 