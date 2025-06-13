// Card class representing a single playing card
class Card {
    constructor(suit, rank) {
        this.suit = suit;
        this.rank = rank;
    }

    toString() {
        return `${this.rank}${this.suit}`;
    }

    // Get the value of the card in a trick
    getValue(trumpSuit) {
        // In all-trumps, all cards are treated as trump cards
        if (trumpSuit === 'all') {
            const trumpRankValues = {
                '7': 0, '8': 0, '9': 14, '10': 10,
                'J': 20, 'Q': 3, 'K': 4, 'A': 11
            };
            return trumpRankValues[this.rank];
        }

        const isTrump = this.suit === trumpSuit;
        const rankValues = {
            '7': 0, '8': 0, '9': 0, '10': 10,
            'J': 2, 'Q': 3, 'K': 4, 'A': 11
        };
        const trumpRankValues = {
            '7': 0, '8': 0, '9': 14, '10': 10,
            'J': 20, 'Q': 3, 'K': 4, 'A': 11
        };
        return isTrump ? trumpRankValues[this.rank] : rankValues[this.rank];
    }
}

// Deck class representing a deck of cards
class Deck {
    constructor() {
        this.cards = [];
        this.initialize();
    }

    initialize() {
        const suits = ['♠', '♥', '♦', '♣'];
        const ranks = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        
        for (const suit of suits) {
            for (const rank of ranks) {
                this.cards.push(new Card(suit, rank));
            }
        }
    }

    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    deal(numCards) {
        return this.cards.splice(0, numCards);
    }
}

// ScoringSystem class to handle all scoring-related functionality
class ScoringSystem {
    constructor() {
        this.cardPoints = {
            '7': { trump: 0, nonTrump: 0 },
            '8': { trump: 0, nonTrump: 0 },
            '9': { trump: 14, nonTrump: 0 },
            '10': { trump: 10, nonTrump: 10 },
            'J': { trump: 20, nonTrump: 2 },
            'Q': { trump: 3, nonTrump: 3 },
            'K': { trump: 4, nonTrump: 4 },
            'A': { trump: 11, nonTrump: 11 }
        };
    }

    calculateTrickPoints(trick, trumpSuit) {
        let points = 0;
        for (const { card } of trick) {
            // In all-trumps, all cards are treated as trump cards
            const isTrump = trumpSuit === 'all' || card.suit === trumpSuit;
            if (trumpSuit === 'all') {
                // In all-trumps, use trump values for all cards
                points += this.cardPoints[card.rank]['trump'];
            } else {
                points += this.cardPoints[card.rank][isTrump ? 'trump' : 'nonTrump'];
            }
        }
        return points;
    }

    calculateTeamScore(tricks, trumpSuit, gameType, isCapo = false) {
        let totalPoints = 0;
        
        // Calculate points from cards
        for (const trick of tricks) {
            totalPoints += this.calculateTrickPoints(trick, trumpSuit);
        }

        // Add last trick bonus (10 points)
        totalPoints += 10;

        // Add capo bonus if applicable (90 points)
        if (isCapo) {
            totalPoints += 90;
        }

        // Handle different game types
        if (gameType === 'no-trumps') {
            // Double points for no-trumps, except capo bonus
            totalPoints = (totalPoints - (isCapo ? 90 : 0)) * 2 + (isCapo ? 90 : 0);
        }

        // Round points according to rules
        return this.roundPoints(totalPoints, gameType);
    }

    roundPoints(points, gameType) {
        // Round to nearest 10
        let roundedPoints = Math.round(points / 10) * 10;
        
        // Special rounding rules for "All Trumps"
        if (gameType === 'all-trumps' && points % 10 >= 4) {
            roundedPoints = Math.ceil(points / 10) * 10;
        }

        return roundedPoints;
    }

    determineGameResult(bidderTeamPoints, opponentTeamPoints, gameType) {
        if (bidderTeamPoints > opponentTeamPoints) {
            return {
                winner: 'bidder',
                bidderPoints: bidderTeamPoints,
                opponentPoints: opponentTeamPoints
            };
        } else if (bidderTeamPoints < opponentTeamPoints) {
            return {
                winner: 'opponent',
                bidderPoints: 0,
                opponentPoints: bidderTeamPoints + opponentTeamPoints
            };
        } else {
            return {
                winner: 'hanging',
                bidderPoints: 0,
                opponentPoints: opponentTeamPoints,
                hangingPoints: bidderTeamPoints
            };
        }
    }

    checkGameEnd(team1Score, team2Score) {
        return team1Score >= 151 || team2Score >= 151;
    }
}

// DisplaySystem class to handle all game state display
class DisplaySystem {
    constructor() {
        this.gameStateElement = null;
        this.scoreElement = null;
        this.trickElement = null;
        this.playerHandsElement = null;
        this.cardPositions = new Map(); // Store card positions for animation
        this.initializeElements();
        this.initializeCardStyles();
    }

    initializeElements() {
        // Create or get display elements
        this.gameStateElement = document.getElementById('game-state') || this.createDisplayElement('game-state');
        this.scoreElement = document.getElementById('scores') || this.createDisplayElement('scores');
        this.trickElement = document.getElementById('current-trick') || this.createDisplayElement('current-trick');
        this.playerHandsElement = document.getElementById('player-hands') || this.createDisplayElement('player-hands');
    }

    createDisplayElement(id) {
        const element = document.createElement('div');
        element.id = id;
        document.body.appendChild(element);
        return element;
    }

    initializeCardStyles() {
        // Add additional styles for card animations
        const additionalStyles = `
            .card {
                position: relative;
                transition: all 0.3s ease-in-out;
                cursor: pointer;
                user-select: none;
                transform-style: preserve-3d;
                width: 60px;
                height: 90px;
                background: white;
                border-radius: 5px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                padding: 5px;
            }

            .card:hover {
                transform: translateY(-10px);
                box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            }

            .card.selected {
                transform: translateY(-20px);
                box-shadow: 0 8px 20px rgba(0,0,0,0.4);
            }

            .card.played {
                position: fixed;
                z-index: 1000;
                animation: playCard 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
            }

            .trick-cards {
                position: relative;
                min-height: 300px;
                width: 100%;
                display: flex;
                justify-content: center;
                align-items: center;
                perspective: 1000px;
                margin: 20px 0;
            }

            .trick-card {
                position: absolute;
                transform-style: preserve-3d;
                transition: all 0.5s ease-in-out;
                width: 60px;
                height: 90px;
                background: white;
                border-radius: 5px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                padding: 5px;
            }

            .trick-card.player-0 { transform: translateY(-100px) rotate(0deg); }
            .trick-card.player-1 { transform: translateX(100px) rotate(90deg); }
            .trick-card.player-2 { transform: translateY(100px) rotate(180deg); }
            .trick-card.player-3 { transform: translateX(-100px) rotate(270deg); }

            @keyframes playCard {
                0% {
                    transform: scale(1) rotate(0deg);
                    opacity: 1;
                }
                50% {
                    transform: scale(1.2) rotate(180deg);
                    opacity: 0.8;
                }
                100% {
                    transform: scale(1) rotate(360deg);
                    opacity: 1;
                }
            }

            .card-value {
                font-size: 1.2em;
                font-weight: bold;
                margin-bottom: 5px;
            }

            .card-suit {
                font-size: 1.5em;
            }

            .card.red {
                color: red;
            }

            .card.black {
                color: black;
            }

            .cards {
                display: flex;
                gap: 5px;
                padding: 10px;
                min-height: 120px;
                align-items: center;
                justify-content: center;
            }

            .trump-announcement {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 20px 40px;
                border-radius: 10px;
                font-size: 24px;
                z-index: 2000;
                animation: fadeInOut 2s ease-in-out forwards;
            }

            .trump-suit {
                font-size: 48px;
                margin: 10px 0;
                text-align: center;
            }

            .dealing-animation {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 1500;
            }

            .dealing-card {
                position: absolute;
                width: 60px;
                height: 90px;
                background: white;
                border-radius: 5px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                animation: dealCard 0.5s ease-in-out forwards;
            }

            @keyframes fadeInOut {
                0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
                20% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
            }

            @keyframes dealCard {
                0% {
                    transform: translate(0, 0) rotate(0deg);
                    opacity: 1;
                }
                100% {
                    transform: translate(var(--endX), var(--endY)) rotate(360deg);
                    opacity: 0;
                }
            }

            .game-phase-transition {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 1000;
                animation: fadeIn 0.5s ease-in-out;
            }
        `;
        style.textContent += additionalStyles;
    }

    createCardElement(card, playerIndex = null) {
        const cardElement = document.createElement('div');
        cardElement.className = `card ${['♥', '♦'].includes(card.suit) ? 'red' : 'black'}`;
        cardElement.dataset.suit = card.suit;
        cardElement.dataset.rank = card.rank;
        
        if (playerIndex !== null) {
            cardElement.dataset.player = playerIndex;
        }

        cardElement.innerHTML = `
            <span class="card-value">${card.rank}</span>
            <span class="card-suit">${card.suit}</span>
        `;

        return cardElement;
    }

    updateGameState(game) {
        let stateHTML = `
            <h2>Game State</h2>
            <p>Phase: ${game.gamePhase}</p>
            <p>Current Player: ${game.currentPlayer + 1}</p>
            <p>Trump Suit: ${game.trumpSuit || 'Not set'}</p>
            <p>Current Bid: ${game.currentBid || 'No bid'}</p>
        `;
        this.gameStateElement.innerHTML = stateHTML;
    }

    updateScores(game) {
        console.log('Updating scores display. Current scores:', game.teamScores);
        let scoreHTML = `
            <h2>Scores</h2>
            <div class="team-scores">
                <div class="team">
                    <h3>НИЕ</h3>
                    <p>Score: ${game.teamScores[0]}</p>
                    <p>Tricks: ${game.tricks[0].length}</p>
                </div>
                <div class="team">
                    <h3>ВИЕ</h3>
                    <p>Score: ${game.teamScores[1]}</p>
                    <p>Tricks: ${game.tricks[1].length}</p>
                </div>
            </div>
        `;
        if (game.hangingPoints > 0) {
            scoreHTML += `<p>Hanging Points: ${game.hangingPoints}</p>`;
        }
        this.scoreElement.innerHTML = scoreHTML;
        console.log('Scores display updated');
    }

    updateCurrentTrick(game) {
        let trickHTML = `
            <h2>Current Trick</h2>
            <div class="trick-cards">
        `;
        
        if (game.trick.length > 0) {
            game.trick.forEach(({ card, player }, index) => {
                const cardElement = this.createCardElement(card, player);
                cardElement.classList.add('trick-card', `player-${player}`);
                
                // Add animation delay based on play order
                cardElement.style.animationDelay = `${index * 0.2}s`;
                
                trickHTML += cardElement.outerHTML;
            });
        } else {
            trickHTML += '<p>No cards played yet</p>';
        }
        
        trickHTML += '</div>';
        this.trickElement.innerHTML = trickHTML;
    }

    updatePlayerHands(game) {
        let handsHTML = `
            <h2>Player Hands</h2>
            <div class="player-hands">
        `;
        
        game.players.forEach((hand, playerIndex) => {
            handsHTML += `
                <div class="player-hand">
                    <h3>Player ${playerIndex + 1}</h3>
                    <div class="cards" data-player="${playerIndex}">
                        ${hand.map(card => this.createCardElement(card, playerIndex).outerHTML).join('')}
                    </div>
                </div>
            `;
        });
        
        handsHTML += '</div>';
        this.playerHandsElement.innerHTML = handsHTML;

        // Add click handlers for cards
        this.addCardClickHandlers(game);
    }

    addCardClickHandlers(game) {
        const cardElements = document.querySelectorAll('.card');
        cardElements.forEach(cardElement => {
            cardElement.addEventListener('click', (e) => {
                const playerIndex = parseInt(cardElement.closest('.cards').dataset.player);
                const suit = cardElement.dataset.suit;
                const rank = cardElement.dataset.rank;
                
                if (playerIndex === game.currentPlayer && game.gamePhase === 'playing') {
                    // Remove selected class from all cards
                    document.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
                    
                    // Add selected class to clicked card
                    cardElement.classList.add('selected');
                    
                    // Animate card to center
                    this.animateCardPlay(cardElement, () => {
                        game.playCard(playerIndex, { suit, rank });
                    });
                }
            });
        });
    }

    animateCardPlay(cardElement, callback) {
        const trickCards = document.querySelector('.trick-cards');
        const cardClone = cardElement.cloneNode(true);
        cardClone.classList.add('played');
        
        // Get the original card's position
        const cardRect = cardElement.getBoundingClientRect();
        const trickRect = trickCards.getBoundingClientRect();
        
        // Calculate the center of the trick area
        const centerX = trickRect.left + trickRect.width / 2;
        const centerY = trickRect.top + trickRect.height / 2;
        
        // Position the clone at the original card's position
        cardClone.style.position = 'fixed';
        cardClone.style.left = `${cardRect.left}px`;
        cardClone.style.top = `${cardRect.top}px`;
        cardClone.style.width = `${cardRect.width}px`;
        cardClone.style.height = `${cardRect.height}px`;
        
        document.body.appendChild(cardClone);
        
        // Create a bezier curve path for the animation
        const startX = cardRect.left;
        const startY = cardRect.top;
        const endX = centerX - cardRect.width / 2;
        const endY = centerY - cardRect.height / 2;
        
        // Calculate control points for the bezier curve
        const controlX = (startX + endX) / 2;
        const controlY = Math.min(startY, endY) - 100; // Arc height
        
        // Create the animation
        const animation = cardClone.animate([
            {
                transform: 'translate(0, 0) rotate(0deg)',
                left: `${startX}px`,
                top: `${startY}px`
            },
            {
                transform: 'translate(0, -100px) rotate(180deg)',
                left: `${controlX}px`,
                top: `${controlY}px`
            },
            {
                transform: 'translate(0, 0) rotate(360deg)',
                left: `${endX}px`,
                top: `${endY}px`
            }
        ], {
            duration: 600,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
            fill: 'forwards'
        });
        
        // Remove clone after animation
        animation.onfinish = () => {
            cardClone.remove();
            if (callback) callback();
        };
    }

    displayGameOver(game) {
        const winner = game.teamScores[0] >= 151 ? 'Team 1' : 'Team 2';
        const gameOverHTML = `
            <div class="game-over">
                <h2>Game Over!</h2>
                <p>${winner} wins!</p>
                <p>Final Scores:</p>
                <p>Team 1: ${game.teamScores[0]}</p>
                <p>Team 2: ${game.teamScores[1]}</p>
                <button onclick="game.startNewGame()">New Game</button>
            </div>
        `;
        this.gameStateElement.innerHTML = gameOverHTML;
    }

    showTrumpAnnouncement(trumpSuit) {
        const announcement = document.createElement('div');
        announcement.className = 'trump-announcement';
        
        let trumpDisplay = '';
        if (trumpSuit === 'all-trumps') {
            trumpDisplay = 'Всичко Коз';
        } else if (trumpSuit === 'no-trumps') {
            trumpDisplay = 'Без Коз';
        } else {
            trumpDisplay = `Коз: ${trumpSuit}`;
        }

        announcement.innerHTML = `
            <div>Наддаването приключи!</div>
            <div class="trump-suit">${trumpDisplay}</div>
        `;

        document.body.appendChild(announcement);
        setTimeout(() => announcement.remove(), 2000);
    }

    animateDealingCards(game) {
        const dealingContainer = document.createElement('div');
        dealingContainer.className = 'dealing-animation';
        document.body.appendChild(dealingContainer);

        const deckPosition = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        const playerPositions = [
            { x: window.innerWidth / 2, y: 50 }, // Top
            { x: window.innerWidth - 50, y: window.innerHeight / 2 }, // Right
            { x: window.innerWidth / 2, y: window.innerHeight - 50 }, // Bottom
            { x: 50, y: window.innerHeight / 2 } // Left
        ];

        let cardIndex = 0;
        const totalCards = 12; // 3 cards to each player

        const dealNextCard = () => {
            if (cardIndex >= totalCards) {
                dealingContainer.remove();
                this.updateDisplay();
                return;
            }

            const playerIndex = cardIndex % 4;
            const card = document.createElement('div');
            card.className = 'dealing-card';
            
            // Set starting position (deck)
            card.style.left = `${deckPosition.x}px`;
            card.style.top = `${deckPosition.y}px`;
            
            // Set end position (player's hand)
            const endX = playerPositions[playerIndex].x - deckPosition.x;
            const endY = playerPositions[playerIndex].y - deckPosition.y;
            card.style.setProperty('--endX', `${endX}px`);
            card.style.setProperty('--endY', `${endY}px`);

            dealingContainer.appendChild(card);
            cardIndex++;

            // Remove card after animation
            setTimeout(() => card.remove(), 500);
            
            // Deal next card
            setTimeout(dealNextCard, 100);
        };

        dealNextCard();
    }
}

// Game class to manage the game state
class BelotGame {
    constructor() {
        this.deck = new Deck();
        this.players = [[], [], [], []]; // Four players' hands
        this.trumpSuit = null;
        this.currentPlayer = 0;
        this.trick = [];
        this.scores = [0, 0]; // Two teams
        this.gamePhase = 'bidding'; // 'bidding', 'playing', 'finished'
        this.currentBid = null;
        this.bidder = null;
        this.bidOptions = ['pass', '♠', '♥', '♦', '♣', 'all-trumps', 'no-trumps'];
        this.belotAnnounced = [false, false, false, false];
        this.scoringSystem = new ScoringSystem();
        this.teamScores = [0, 0];
        this.tricks = [[], []]; // Store tricks for each team
        this.hangingPoints = 0;
        this.displaySystem = new DisplaySystem();
    }

    startNewGame() {
        this.deck = new Deck();
        this.deck.shuffle();
        this.players = [[], [], [], []];
        this.trumpSuit = null;
        this.currentPlayer = 0;
        this.trick = [];
        this.gamePhase = 'bidding';
        this.currentBid = null;
        this.bidder = null;
        this.belotAnnounced = [false, false, false, false];
        
        // Deal 3 cards to each player
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 4; j++) {
                this.players[j].push(...this.deck.deal(1));
            }
        }
        
        // Deal 2 cards to each player
        for (let i = 0; i < 2; i++) {
            for (let j = 0; j < 4; j++) {
                this.players[j].push(...this.deck.deal(1));
            }
        }
        this.updateDisplay();
    }

    makeBid(playerIndex, bid) {
        if (this.gamePhase !== 'bidding' || playerIndex !== this.currentPlayer) {
            return false;
        }

        if (bid === 'pass') {
            this.currentPlayer = (this.currentPlayer + 1) % 4;
            this.updateDisplay();
            return true;
        }

        // If someone has already bid, only higher bids are allowed
        if (this.currentBid) {
            const bidValues = {
                '♠': 1, '♥': 2, '♦': 3, '♣': 4,
                'all-trumps': 5, 'no-trumps': 6
            };
            
            if (bidValues[bid] <= bidValues[this.currentBid]) {
                return false;
            }
        }

        this.currentBid = bid;
        this.bidder = playerIndex;
        this.currentPlayer = (this.currentPlayer + 1) % 4;

        // If we've gone around the table and no one has outbid
        if (this.currentPlayer === this.bidder) {
            this.finalizeBidding();
        }

        this.updateDisplay();
        return true;
    }

    finalizeBidding() {
        if (this.currentBid === 'pass') {
            this.startNewGame();
            return;
        }

        // Set the trump suit
        if (this.currentBid === 'all-trumps') {
            this.trumpSuit = 'all';
        } else if (this.currentBid === 'no-trumps') {
            this.trumpSuit = 'none';
        } else {
            this.trumpSuit = this.currentBid;
        }

        // Show trump announcement
        this.displaySystem.showTrumpAnnouncement(this.currentBid);

        // Deal remaining cards with animation
        setTimeout(() => {
            // Deal remaining cards
            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 4; j++) {
                    this.players[j].push(...this.deck.deal(1));
                }
            }
            
            // Animate dealing
            this.displaySystem.animateDealingCards(this);

            this.gamePhase = 'playing';
            this.currentPlayer = this.bidder;
        }, 2000);
    }

    exchangeCards(playerIndex, cardsToExchange) {
        if (this.gamePhase !== 'playing' || playerIndex !== this.currentPlayer) {
            return false;
        }

        // Check if player has the cards they want to exchange
        for (const card of cardsToExchange) {
            if (!this.players[playerIndex].some(c => c.suit === card.suit && c.rank === card.rank)) {
                return false;
            }
        }

        // Remove cards from player's hand
        this.players[playerIndex] = this.players[playerIndex].filter(
            card => !cardsToExchange.some(c => c.suit === card.suit && c.rank === card.rank)
        );

        // Deal new cards
        const newCards = this.deck.deal(cardsToExchange.length);
        this.players[playerIndex].push(...newCards);

        this.updateDisplay();
        return true;
    }

    checkBelot(playerIndex) {
        if (this.trumpSuit === 'none' || this.trumpSuit === 'all') {
            return false;
        }

        const hasKing = this.players[playerIndex].some(card => 
            card.suit === this.trumpSuit && card.rank === 'K');
        const hasQueen = this.players[playerIndex].some(card => 
            card.suit === this.trumpSuit && card.rank === 'Q');

        if (hasKing && hasQueen && !this.belotAnnounced[playerIndex]) {
            this.belotAnnounced[playerIndex] = true;
            this.updateDisplay();
            return true;
        }

        return false;
    }

    playCard(playerIndex, card) {
        if (this.gamePhase !== 'playing' || playerIndex !== this.currentPlayer) {
            return false;
        }

        // Check if player has the card
        const cardIndex = this.players[playerIndex].findIndex(
            c => c.suit === card.suit && c.rank === card.rank
        );
        if (cardIndex === -1) {
            return false;
        }

        // Check if player must follow suit
        if (this.trick.length > 0) {
            const leadSuit = this.trick[0].suit;
            const hasLeadSuit = this.players[playerIndex].some(c => c.suit === leadSuit);
            
            if (hasLeadSuit && card.suit !== leadSuit) {
                return false;
            }
        }

        // Remove card from player's hand and add to trick
        const playedCard = this.players[playerIndex].splice(cardIndex, 1)[0];
        this.trick.push({ card: playedCard, player: playerIndex });

        // If trick is complete, determine winner
        if (this.trick.length === 4) {
            this.resolveTrick();
        } else {
            this.currentPlayer = (this.currentPlayer + 1) % 4;
        }

        this.updateDisplay();
        return true;
    }

    resolveTrick() {
        let winningCard = this.trick[0];
        let winningPlayer = this.trick[0].player;
        const leadSuit = this.trick[0].card.suit;

        console.log('Resolving trick:', this.trick);
        console.log('Current trump suit:', this.trumpSuit);

        for (let i = 1; i < this.trick.length; i++) {
            const currentCard = this.trick[i].card;
            const isTrump = this.trumpSuit === 'all' || currentCard.suit === this.trumpSuit;
            const isLeadSuit = currentCard.suit === leadSuit;
            const currentValue = currentCard.getValue(this.trumpSuit);
            const winningValue = winningCard.card.getValue(this.trumpSuit);

            console.log('Card:', currentCard.toString(), 'Value:', currentValue, 'IsTrump:', isTrump);

            if (isTrump && (!winningCard.card.isTrump || currentValue > winningValue)) {
                winningCard = this.trick[i];
                winningPlayer = this.trick[i].player;
            } else if (!isTrump && !winningCard.card.isTrump && isLeadSuit && currentValue > winningValue) {
                winningCard = this.trick[i];
                winningPlayer = this.trick[i].player;
            }
        }

        // Store the trick for the winning team
        const winningTeam = Math.floor(winningPlayer / 2);
        this.tricks[winningTeam].push([...this.trick.map(t => t.card)]);

        console.log('Winning team:', winningTeam);
        console.log('Current team scores before update:', [...this.teamScores]);

        // Calculate points for this trick
        const trickPoints = this.scoringSystem.calculateTrickPoints(this.trick, this.trumpSuit);
        console.log('Points for this trick:', trickPoints);
        
        this.teamScores[winningTeam] += trickPoints;
        console.log('Updated team scores:', [...this.teamScores]);

        // Check for capo
        const isCapo = this.tricks[winningTeam].length === 8;
        if (isCapo) {
            this.teamScores[winningTeam] += 90; // Add capo bonus
            console.log('Added capo bonus, new scores:', [...this.teamScores]);
        }

        // Add last trick bonus (10 points) if this is the last trick
        if (this.tricks[0].length + this.tricks[1].length === 8) {
            this.teamScores[winningTeam] += 10;
            console.log('Added last trick bonus, new scores:', [...this.teamScores]);
        }

        // Check if game is over
        if (this.scoringSystem.checkGameEnd(this.teamScores[0], this.teamScores[1])) {
            this.gamePhase = 'finished';
        } else {
            this.currentPlayer = winningPlayer;
            this.trick = [];
        }

        this.updateDisplay();
    }

    updateDisplay() {
        if (this.gamePhase === 'finished') {
            this.displaySystem.displayGameOver(this);
        } else {
            this.displaySystem.updateGameState(this);
            this.displaySystem.updateScores(this);
            this.displaySystem.updateCurrentTrick(this);
            this.displaySystem.updatePlayerHands(this);
        }
    }
}

// Add CSS styles for the display
const style = document.createElement('style');
style.textContent = `
    .team-scores {
        display: flex;
        justify-content: space-around;
        margin: 20px 0;
    }

    .team {
        padding: 10px;
        border: 1px solid #ccc;
        border-radius: 5px;
        text-align: center;
    }

    .trick-cards {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin: 10px 0;
    }

    .trick-card {
        padding: 5px;
        border: 1px solid #ddd;
        border-radius: 3px;
    }

    .player-hands {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 20px;
        margin: 20px 0;
    }

    .player-hand {
        padding: 10px;
        border: 1px solid #ccc;
        border-radius: 5px;
    }

    .cards {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
    }

    .card {
        padding: 5px;
        border: 1px solid #ddd;
        border-radius: 3px;
        background-color: white;
    }

    .game-over {
        text-align: center;
        padding: 20px;
        background-color: #f8f9fa;
        border-radius: 5px;
        margin: 20px 0;
    }

    button {
        padding: 10px 20px;
        background-color: #007bff;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
    }

    button:hover {
        background-color: #0056b3;
    }
`;
document.head.appendChild(style);

// Initialize the game when the page loads
window.addEventListener('load', () => {
    const game = new BelotGame();
    game.startNewGame();
    console.log('Game initialized:', game);
}); 