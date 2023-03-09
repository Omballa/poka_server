var Deck = require("./deck.js")
module.exports = class Room{
    constructor(name,creator){
      this.deck = new Deck()
      this.name = name
      this.creator = creator
      this.topCard
      this.requestedSuit = {isSet:false, suit:""}
      this.direction = 1
    }
    setTopCard(card){
      this.topCard = card
      return card
    }

    setRequestedSuit(_reqSuit){
      this.requestedSuit = {isSet:true, suit:_reqSuit}
    }

    removeRequestedSuit(){
      this.requestedSuit = {isSet:false,suit:""}
    }
    changeDirection(_direction){
        this.direction = _direction
    }
}