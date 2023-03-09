const express = require("express");
const { createServer } = require("http");
const app = express();
const httpServer = createServer(app);
const io = require("socket.io")(httpServer, {
    cors:{
        origin:"*"
    }
});
const cors = require("cors")

//Classes
var Player = require("./classes/player.js")
var Room = require("./classes/room.js")

let rooms = []
let players = []

// const io = new Server(httpServer, { /* options */ });

app.use(cors())

io.on("connection", (socket)=> {
  console.log(`user ${socket.id} has connected`)
  socket.on('join-room', (_nickname,_room,_created,_max) => {
    console.log("Room signal received")
      socket.nickname = _nickname
      if(_created){
        let playersInRoom = []
        let room = new Room(_room,socket.nickname)
        let player = new Player(socket.nickname,socket.id,_room,true,"play","left",-30)
        players.push(player)
        playersInRoom.push({id:player.id, name:player.name, cards:player.cards.length})
        rooms.push(room)
        socket.join(_room)
        io.in(_room).emit('room-joined', {message:`${socket.nickname} has joined room`, players:playersInRoom, turn:player.turn})
        console.log(`Room name: ${_room} created successfully`)
      }
      else{
        let player = new Player(socket.nickname,socket.id,_room,false,"idle")
        let roomFound = false
        let playersInRoom = []
        playersInRoom.push(player)
        for(var p of players)
        {
          if(p.room === _room){
            playersInRoom.push({name:p.name,id:p.id,turn:p.turn,cards:p.cards.length})
            console.log("Player in room: ",p.name)
          }
        }
        rooms.map(room => {
          if(room.name === _room){
            roomFound=true
            players.push(player)   
            socket.join(_room)
          }
        })
        if(roomFound){
          io.in(_room).emit('room-joined', {message:`${socket.nickname} has joined room`, players:playersInRoom})
          console.log(`${player.name} joined room ${_room} successfully`)
        }else{
          io.to(socket.id).emit('room-not-found', {message:'Room not found'})
        }
      }
  })


  socket.on('start-game', (_room) => {
    let roomIndex = getRoomIndexFromName(_room)
    let topCard = rooms[roomIndex].deck.pickTopCard()
    rooms[roomIndex].setTopCard(topCard[0])
    let pir = []
    for(var p of players){
      if(p.room === _room)
      {
        let cards = rooms[roomIndex].deck.deal(4)
        p.addCards(cards)
        pir.push({id:p.id, name:p.name, cards:p.cards.length, turn:p.turn})
        io.to(p.id).emit('assign-cards', {cards,topCard})
      }
    }
    io.to(_room).emit('set-players-in-room', {pir})
  })


  socket.on('play-cards', (_room, _cards, _reqSuit) => {
    let playedCards = _cards
    let roomIndex = getRoomIndexFromName(_room)
    let player = getPlayerFromRoomName(_room,socket.id)
    let response
    let direction = rooms[roomIndex].direction
    let roomSuit = rooms[roomIndex].requestedSuit
    let reqSuit = _reqSuit
    console.log("Suit", reqSuit)
    console.log("Room Suit", roomSuit)
    if(player.command === "play" && player.turn === true && roomSuit.isSet === false){
      //Play cards
      console.log("Play, No suit set")
      response = evaluateSelectedCardsPlay(playedCards,rooms[roomIndex].topCard,reqSuit,roomSuit,direction)
    }else if(player.command === "play" && player.turn && roomSuit.isSet === true && playedCards[0].suit === roomSuit.suit){
      //Play cards
      console.log("Play, Suit set")
      response = evaluateSelectedCardsPlay(playedCards,rooms[roomIndex].topCard,reqSuit,roomSuit,direction)
    }else if(player.command === "play" && player.turn && roomSuit.isSet === true && playedCards[0].value === "A"){
      //Play cards
      console.log("Play, Suit reset")
      response = evaluateSelectedCardsPlay(playedCards,rooms[roomIndex].topCard,reqSuit,roomSuit,direction)
    }
    else if(player.command === 'pick' && player.turn === true){
      //Pick cards or play A
      console.log("Play, Pick")
      response = evaluateSelectedCardsPick(playedCards,rooms[roomIndex].topCard,_reqSuit,direction)
    }
    else{
      console.log("It is not your turn")
    }
    if(player.turn){
      console.log(response)
      //Return any errors
      if(response.error){
        //Emit error to current player
        io.to(player.id).emit('wrong-move')
      }else{
        //Get the next player
        let nextPlayer = getNextPlayerIdInRoom(response.next_step, player.id, _room)
        let tc = rooms[roomIndex].setTopCard(playedCards[_cards.length - 1])
        rooms[roomIndex].removeRequestedSuit()
        let pir = []
        //Set current player state
        for (var p of players){
          if(p.id === socket.id && p.id !== nextPlayer.id){
            let pid = p.id
            p.command = response.cur_command
            p.removeCards(_cards)
            //if response is pick,pick the cards from deck
            if(response.cur_command === "pick"){
              let cards = rooms[roomIndex].deck.deal(response.data)
              p.addCards(cards)
              cards = p.cards
              io.to(p.id).emit('card-picked', {cards} )
            }else if(response.req_suit){
              rooms[roomIndex].setRequestedSuit(response.req_suit)
              let cards = p.cards
              io.to(pid).emit('card-picked', {cards})
            }
            else{
              let cards = p.cards
              io.to(pid).emit('card-picked', {cards})
            }
            
            p.turn = false
            p.command = "idle"
          }
          else if(p.id === socket.id && p.id === nextPlayer.id){
            console.log("Current player is next player")
            let cards = p.removeCards(_cards)
            p.turn = true
            p.command = "play"
            io.to(p.id).emit('card-picked', {cards})
            io.to(p.id).emit('my-turn')
          }
          else if(p.id === nextPlayer.id){
            //Set next player state
            p.turn = true
            p.command = response.next_command
            io.to(p.id).emit('my-turn')
          }

          if(p.room === _room){
            pir.push({id:p.id, name:p.name, cards:p.cards.length, turn:p.turn})
          }
        }

        rooms[roomIndex].changeDirection(response.direction)
        io.to(player.id).emit('turn-played', 'Turn played successfully')
        //Send signal to all players in room
        io.in(_room).emit('cards-played', {tc,pir,_cards})
      }
    }
  })
  socket.on('pick-card', (_room) => {
    let roomIndex = getRoomIndexFromName(_room)
    let direction = rooms[roomIndex].direction
    let player = getPlayerFromRoomName(_room,socket.id)
    let nextPlayer = getNextPlayerIdInRoom(1*direction, player.id, _room)
    let pir = []
    if(player.turn){
      for(var p of players){
        if(p.id === socket.id && p.command === "play"){
          let card = rooms[roomIndex].deck.pickCard()
          p.addCards(card)
          let cards = p.cards
          io.to(p.id).emit('card-picked', {cards})
          p.turn = false;
          p.command = "idle"
        }
        else if(p.id === socket.id && p.command === "pick"){
          let topCardValue = parseInt(rooms[roomIndex].topCard.value)
          let cs = rooms[roomIndex].deck.deal(topCardValue)
          p.addCards(cs)
          let cards = p.cards
          io.to(p.id).emit('card-picked', {cards})
          p.turn = false;
          p.command = "idle"
        }
        else if(p.id === nextPlayer.id){
          p.turn = true
          p.command = "play"
          io.to(p.id).emit('my-turn')
        }
        if(p.room === _room){
          pir.push({id:p.id, name:p.name, cards:p.cards.length, turn:p.turn})
        }
      }
      io.to(_room).emit('set-players-in-room', {pir})
    }else{
      console.log("Not your turn")
    }
  })
})

app.get('/', (req,res) => {
  res.json({message:'Hello World'})
})
app.get('/room/cards', (req,res) => {
  let room = req.query.name
  res.json({message:'Hello World'})
})

app.get('/room/card', (req, res) => {
  let room = req.query.name
  let roomIndex = getRoomIndexFromName(room)
  let topCard = rooms[roomIndex].deck.pickTopCard()
  res.json(topCard)
})

httpServer.listen(3000, ()=> console.log("Server running on port: " + 3000))

function getRoomIndexFromName(_name){
  let roomIndex = 0
  for(i=0; i<rooms.length; i++)
  {
    if(rooms[i].name === _name){
      roomIndex = i;
      break
    }
  }
  return roomIndex
}

function getPlayerFromRoomName(_name,_id){
  let player
  for(var p of players){
    if(p.room === _name && p.id === _id){
      player = p
      break
    }
  }
  return player
}

function getNextPlayerIdInRoom(_increment, _cid, _name){
  let playersInRoom = []
  let increment = _increment
  let curIndex = 0
  let pir_ids=-1
  for(var p of players){
    if(p.room === _name){
      pir_ids+=1
      if(p.id === _cid){
        curIndex = pir_ids
      }
      playersInRoom.push(p)
    }
  }
  let nextIndex = curIndex
  if(increment > 0){
    console.log("incrementing")
    for(i=0;i<increment;i++){
      nextIndex+=1
      if(nextIndex >= playersInRoom.length){
        nextIndex = 0
      }
    }
  }else{
    console.log("decrementing")
    for(i=increment;i<0;i++){
      nextIndex-=1
      if(nextIndex < 0){
        nextIndex = playersInRoom.length-1
      }
    }
  }
  console.log("current index:", curIndex)
  console.log("next index:", nextIndex)
  
  let nextPlayer = playersInRoom[nextIndex]
  return nextPlayer
}

function evaluateSelectedCardsPlay(_cards,_topCard,_reqSuit,_roomSuit,_direction){
  let previousCard = _topCard;
  let cur_dir = _direction
  let roomSuit =_roomSuit
  let myPlay = false
  let reqSuit
  let response
  let playOk = true
  let ksPlayed = 0
  let jsPlayed = 0

  for(i=0; i<_cards.length; i++)
  {
    if(myPlay){
      if(previousCard.value === "Q" && (_cards[i].value === "Q" 
        || (_cards[i].value === "10" && previousCard.suit === _cards[i].suit)
        || (_cards[i].value === "9" && previousCard.suit === _cards[i].suit)
        || (_cards[i].value === "8" && previousCard.suit === _cards[i].suit)
        || (_cards[i].value === "7" && previousCard.suit === _cards[i].suit)
        || (_cards[i].value === "6" && previousCard.suit === _cards[i].suit)
        || (_cards[i].value === "5" && previousCard.suit === _cards[i].suit)
        || (_cards[i].value === "4" && previousCard.suit === _cards[i].suit))){
          previousCard = _cards[i]   
      }
      else if(previousCard.value === "8" && (_cards[i].value === "8" 
        || (_cards[i].value === "Q" && previousCard.suit === _cards[i].suit)
        || (_cards[i].value === "10" && previousCard.suit === _cards[i].suit)
        || (_cards[i].value === "9" && previousCard.suit === _cards[i].suit)
        || (_cards[i].value === "7" && previousCard.suit === _cards[i].suit)
        || (_cards[i].value === "6" && previousCard.suit === _cards[i].suit)
        || (_cards[i].value === "5" && previousCard.suit === _cards[i].suit)
        || (_cards[i].value === "4" && previousCard.suit === _cards[i].suit))){
          previousCard = _cards[i]   
      }
      else if(previousCard.value === "K" && _cards[i].value === "K"){
        ksPlayed+=1
        previousCard = _cards[i] 
      }
      else if(previousCard.value === "J" && _cards[i].value === "J"){
        jsPlayed+=1
        previousCard = _cards[i] 
      }
      else if(previousCard.value === "10" && _cards[i].value === "10"
            || previousCard.value === "9" && _cards[i].value === "9"
            || previousCard.value === "7" && _cards[i].value === "7"
            || previousCard.value === "6" && _cards[i].value === "6"
            || previousCard.value === "5" && _cards[i].value === "5"
            || previousCard.value === "4" && _cards[i].value === "4"
            || previousCard.value === "3" && _cards[i].value === "3"
            || previousCard.value === "2" && _cards[i].value === "2"
            || previousCard.value === "A" && _cards[i].value === "A"
            ){
        previousCard = _cards[i]
      }else if(previousCard.value === "A" && roomSuit.suit === _cards[i].suit){
        previousCard = _cards[i]
      }
      else{
        playOk = false
      }
    }
    else{
      if(previousCard.value === _cards[i].value || previousCard.suit === _cards[i].suit){
        previousCard = _cards[i]
        if(_cards[i].value === "K"){
          ksPlayed+=1
          console.log("Ks played: ",ksPlayed)
          myPlay=true
        }
        else if(_cards[i].value === "J"){
          jsPlayed+=1
          console.log("Js played: ",jsPlayed)
          myPlay=true
        }
        else if(_cards[i].value === "A"){
          reqSuit = _reqSuit
          console.log("Request suit",reqSuit)
          myPlay=true
        }
        else{
          myPlay = true
        }
        
      }else if(previousCard.value === "A" && _cards[i].suit === roomSuit.suit && roomSuit.isSet === true){
        previousCard = _cards[i]
        console.log("Card matches, suit set")
        myPlay = true
      }else if(previousCard.value === "A" && _cards[i].suit === previousCard.suit && roomSuit.isSet === false){
        previousCard = _cards[i]
        console.log("Card matches, suit not set")
        myPlay = true
      }
      else if(_cards[i].value === "A"){
        previousCard = _cards[i]
        reqSuit = _reqSuit
        console.log("Request suit",reqSuit)
        myPlay=true
      }
      else{
        playOk = false
      }
    }
  }

  if(playOk){
    let nextPlayer
    if(ksPlayed === 1 || ksPlayed === 3){
      //Change to opposite
      if(cur_dir > 0){
        cur_dir = -1
        nextPlayer = 1
      }else{
        cur_dir = 1
        nextPlayer = 1
      }
      response = {cur_command:"idle", next_command:"play",direction:cur_dir, next_step:nextPlayer*cur_dir, error:false,errorMsg:""}
      console.log("ks played",response)
    }
    else if(ksPlayed === 2 || ksPlayed === 4){
      nextPlayer = 1
      response = {cur_command:"idle", next_command:"play", data:0, direction:cur_dir, next_step:nextPlayer*cur_dir, error:false,errorMsg:""}
      console.log("ks played",response)
    }

    if(jsPlayed > 0){
      nextPlayer = jsPlayed + 1
      response = {cur_command:"idle", next_command:"play", data:0, direction:cur_dir, next_step:nextPlayer*cur_dir, error:false,errorMsg:""}
      console.log("js played",response)
    }
    if(reqSuit){
      nextPlayer = 1
      console.log("Suit set")
      response = {cur_command:"idle", next_command:"play", data:0, direction:cur_dir, next_step:nextPlayer*cur_dir, error:false,errorMsg:"", req_suit:reqSuit}
    }

    if(previousCard.value === "Q" || previousCard.value === "8"){
      nextPlayer = 1
      response = {cur_command:"pick", next_command:"play", data:1, direction:cur_dir, next_step:nextPlayer*cur_dir, error:false,errorMsg:""}
      //Command for current player to pick one card. Next player to play
    }
    else if(previousCard.value ==="3" || previousCard.value === "2"){
      //Set current player to idle. Next player to pick
      nextPlayer = 1
      response = {cur_command:"idle", next_command:"pick", data:parseInt(previousCard.value), direction:cur_dir, next_step:nextPlayer*cur_dir, error:false,errorMsg:""}
    }
    else if(previousCard.value === "10" 
            || previousCard.value === "9" 
            || previousCard.value === "7" 
            ||previousCard.value === "6"
            || previousCard.value === "5"
            ||previousCard.value === "4"
            ){
      nextPlayer = 1
      response = {cur_command:"idle", next_command:"play", data:0, direction:cur_dir, next_step:nextPlayer*cur_dir, error:false,errorMsg:""}
    }
  }else{
    response = {cur_command:"play", next_command:"idle", data:0, direction:cur_dir, next_step:0, error:true, errorMsg:"You cannot play the cards in that order"}
  }
  return response
}

function evaluateSelectedCardsPick(_cards,_topCard,_reqSuit, _direction){
  let cur_dir = _direction
  let playingcards = _cards
  let response
  let previousCard = _topCard
  let allAs = false
  let playOk = true
  let myPlay = false

  if(playingcards[0].value === "A"){
    playingcards.map(card => {
      if(card.value === "A"){
        allAs = true
      }
    })
  }
  else{
    for(i=0; i<playingcards.length; i++){
      if(myPlay){
        if(previousCard.value === "3" && playingcards[i].value === "3"){
          previousCard = playingcards[i]
        }else if(previousCard.value === "2" && playingcards[i].value === "2"){
          previousCard = playingcards[i]
        }else if(previousCard.suit === playingcards[i].suit && (playingcards[i].value === "3" || playingcards[i].value === "2")){
          previousCard = playingcards[i]
        }else{
          playOk=false
        }
      }else{
        if(previousCard.value === "3" && playingcards[i].value === "3"){
          previousCard = playingcards[i]
          myPlay = true
        }else if(previousCard.value === "2" && playingcards[i].value === "2"){
          previousCard = playingcards[i]
          myPlay = true
        }else if(previousCard.suit === playingcards[i].suit && (playingcards[i].value === "3" || playingcards[i].value === "2")){
          previousCard = playingcards[i]
          myPlay = true
        }else{
          playOk=false
        }
      }
    }
  }

  if(allAs){
    response = {cur_command:"idle", next_command:"play", data:0, direction:cur_dir, next_step:1*cur_dir, error:false, errorMsg:""}
    console.log("All As")
  }else{
    if(playOk && (previousCard.value === "3" || previousCard.value === "2")){
      console.log("Equal to 3 or 2")
      response = {cur_command:"idle", next_command:"pick", data:parseInt(previousCard.value), direction:cur_dir, next_step:1*cur_dir, error:false, errorMsg:""}
    }else if(playOk && previousCard.value !== "3" || previousCard.value !== "2"){
      console.log("Not equal to 3 or 2")
      response = {cur_command:"play", next_command:"idle", data:parseInt(previousCard.value), direction:cur_dir, next_step:0, error:true, errorMsg:"Cannot play that card. Picking cards"}
    }else{
      console.log("Error")
      response = {cur_command:"pick", next_command:"play", data:parseInt(_topCard.value), direction:cur_dir, next_step:0, error:true, errorMsg:"You cannot play the cards in that order"}
    }
  }

  return response

}
















