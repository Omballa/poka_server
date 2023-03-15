module.exports = class Player{
    constructor(name,id,room,turn,command){
        this.name = name
        this.cards = []
        this.id = id
        this.room = room
        this.turn = turn
        this.command = command
        this.kadi = false
    }
    addCards(_cards){
      this.cards = this.cards.concat(_cards)
      return this.cards
    }
    removeCards(_cards){
      let remainingCards = this.cards

      for(let i=0;i<_cards.length;i++){
        for(let j=0; j<remainingCards.length; j++){
          if(_cards[i].value === remainingCards[j].value && _cards[i].suit === remainingCards[j].suit){
            remainingCards.splice(j,1)
          }
        }
      }

      this.cards = remainingCards
      return this.cards
    }
    setTurn(){
      this.turn = !this.turn
    }
    setKadi(_state){
      this.kadi = _state;
    }

}