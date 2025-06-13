import '../css/styles.css';

// Card class representing a single playing card
class Card {
    constructor(suit, rank) {
        this.suit = suit;
        this.rank = rank;
        this.suitMap = {
            '♠': 'spades',
            '♥': 'hearts',
            '♦': 'diamonds',
            '♣': 'clubs'
        };
    }

    toString() {
        return `${this.rank}${this.suit}`;
    }

    // Get the value of the card in a trick
    getValue(trumpSuit) {
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

    // Create HTML element for the card
    createCardElement() {
        const cardElement = document.createElement('div');
        cardElement.className = 'card';
        
        const img = document.createElement('img');
        img.src = require(`../assets/cards/${this.suitMap[this.suit]}_${this.rank}.png`);
        img.alt = this.toString();
        img.className = 'card-image';
        
        cardElement.appendChild(img);
        cardElement.dataset.suit = this.suit;
        cardElement.dataset.rank = this.rank;
        return cardElement;
    }

    // Create card back element
    static createCardBackElement() {
        const cardElement = document.createElement('div');
        cardElement.className = 'card card-back';
        
        const img = document.createElement('img');
        img.src = require('../assets/cards/back_light.png');
        img.alt = 'Card Back';
        img.className = 'card-image';
        
        cardElement.appendChild(img);
        return cardElement;
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
    }

    makeBid(playerIndex, bid) {
        if (this.gamePhase !== 'bidding' || playerIndex !== this.currentPlayer) {
            return false;
        }

        if (bid === 'pass') {
            this.currentPlayer = (this.currentPlayer + 1) % 4;
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

        return true;
    }

    finalizeBidding() {
        if (this.currentBid === 'pass') {
            // If everyone passed, start a new game
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

        // Deal remaining cards
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 4; j++) {
                this.players[j].push(...this.deck.deal(1));
            }
        }

        this.gamePhase = 'playing';
        this.currentPlayer = this.bidder;
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

        return true;
    }

    resolveTrick() {
        let winningCard = this.trick[0];
        let winningPlayer = this.trick[0].player;
        const leadSuit = this.trick[0].card.suit;

        for (let i = 1; i < this.trick.length; i++) {
            const currentCard = this.trick[i].card;
            const isTrump = this.trumpSuit === 'all' || currentCard.suit === this.trumpSuit;
            const isLeadSuit = currentCard.suit === leadSuit;
            const currentValue = currentCard.getValue(this.trumpSuit);
            const winningValue = winningCard.card.getValue(this.trumpSuit);
            // ... existing code ...
        }
    }
}

// UI Controller class to handle the game interface
class GameUI {
    constructor(game) {
        this.game = game;
        this.selectedCards = new Set();
        this.initializeUI();
    }

    initializeUI() {
        this.updateGameInfo();
        this.setupEventListeners();
    }

    updateGameInfo() {
        const trumpSuitElement = document.getElementById('trump-suit');
        const currentTurnElement = document.getElementById('current-turn');
        const scoresElement = document.getElementById('scores');
        const biddingControls = document.getElementById('bidding-controls');

        // Update trump suit display
        if (this.game.trumpSuit) {
            trumpSuitElement.textContent = `Trump: ${this.game.trumpSuit}`;
        } else {
            trumpSuitElement.textContent = 'No trump selected';
        }

        // Update current turn
        currentTurnElement.textContent = `Current turn: Player ${this.game.currentPlayer + 1}`;

        // Update scores
        scoresElement.textContent = `Team 1: ${this.game.scores[0]} | Team 2: ${this.game.scores[1]}`;

        // Show/hide bidding controls
        biddingControls.classList.toggle('hidden', this.game.gamePhase !== 'bidding');
    }

    setupEventListeners() {
        // Bidding buttons
        document.querySelectorAll('.bid-btn').forEach(button => {
            button.addEventListener('click', () => {
                const bid = button.dataset.bid;
                if (this.game.makeBid(0, bid)) {
                    this.updateGameInfo();
                    this.renderHands();
                }
            });
        });

        // Card selection
        document.getElementById('player-hand').addEventListener('click', (e) => {
            const cardElement = e.target.closest('.card');
            if (!cardElement) return;

            if (this.game.gamePhase === 'playing') {
                const suit = cardElement.dataset.suit;
                const rank = cardElement.dataset.rank;
                const card = new Card(suit, rank);
                
                if (this.game.playCard(0, card)) {
                    this.updateGameInfo();
                    this.renderHands();
                }
            }
        });
    }

    renderHands() {
        // Clear all hands
        document.querySelectorAll('.hand').forEach(hand => hand.innerHTML = '');

        // Render player's hand
        const playerHand = document.getElementById('player-hand');
        this.game.players[0].forEach(card => {
            playerHand.appendChild(card.createCardElement());
        });

        // Render AI hands (face down)
        for (let i = 1; i < 4; i++) {
            const handElement = document.getElementById(
                i === 1 ? 'left-player-hand' :
                i === 2 ? 'opponent-hand' : 'right-player-hand'
            );
            
            this.game.players[i].forEach(() => {
                handElement.appendChild(Card.createCardBackElement());
            });
        }
    }
}

// Initialize the game when the page loads
window.addEventListener('load', () => {
    const game = new BelotGame();
    game.startNewGame();
    const ui = new GameUI(game);
    ui.renderHands();
}); 