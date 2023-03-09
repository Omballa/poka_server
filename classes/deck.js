const SUITS = ["♠","♣","♥","♦"]
const VALUES = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"]

var Card = require("./card.js")

module.exports = class Deck {
    constructor(cards = freshDeck()){
        this.cards = cards
    }
    get numberOfCards(){
        return this.cards.length
    }
    shuffle() {
        for(let i = this.numberOfCards - 1; i > 0; i--){
            const newIndex = Math.floor(Math.random() * (i + 1))
            const oldValue = this.cards[newIndex]
            this.cards[newIndex] = this.cards[i]
            this.cards[i] = oldValue
        }
    }
    deal(amount){
        let cards = this.cards.splice(0, amount)
        return cards
    }
    pickTopCard(){
        let index = 0
        for(i=0; i<this.numberOfCards; i++){
            console.log(i)
            if(this.cards[i].value !== "K" 
                && this.cards[i].value !== "Q"
                && this.cards[i].value !== "J"
                && this.cards[i].value !== "8"
                && this.cards[i].value !== "3"
                && this.cards[i].value !== "2"
                && this.cards[i].value !== "A"){
                    index = i
                    break
            }
        }
        let topCard = this.cards.splice(index,1)
        return topCard
    }

    pickCard(){
        let pickedCard = this.cards.splice(0,1)
        return pickedCard
    }

}

function freshDeck(){
    let cards = SUITS.flatMap(suit => {
                return VALUES.map(value => {
                    return new Card(suit, value)
                })
            })

    for(let i = cards.length - 1; i > 0; i--){
        const newIndex = Math.floor(Math.random() * (i + 1))
        const oldValue = cards[newIndex]
        cards[newIndex] = cards[i]
        cards[i] = oldValue
    }

    return cards
}