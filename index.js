const mysql = require("mysql");
const express = require("express");
const { createServer } = require("http");
const app = express();
const httpServer = createServer(app);
const { instrument } = require("@socket.io/admin-ui");

const conn = require('./utils/connection');
const cors = require("cors")

const io = require("socket.io")(httpServer, {
	cors:{
		origin:"*",
		credentials: true,
	}
});

const userRoute = require('./routes/user')
const roomRoute = require('./routes/room')
const progressRoute  = require('./routes/progress')

//Classes
var Player = require("./classes/player.js")
var Room = require("./classes/room.js")

let aiRooms = []
let rooms = []
let players = []

// const io = new Server(httpServer, { /* options */ });
app.use(express.json());
app.use(cors({
origin:"*",
credentials: true,
}))

app.use('/user', userRoute)
app.use('/room', roomRoute)
app.use('/progress', progressRoute)

io.on("connection", (socket)=> {
console.log(`user ${socket.id} has connected`)
socket.on('join-room', (_nickname,_room,_created,_max) => {
	socket.nickname = _nickname
	if(_created){
		let playersInRoom = []
		let room = new Room(_room,socket.nickname)
		let player = new Player(socket.nickname,socket.id,_room,true,"play","left",-30)
		players.push(player)
		playersInRoom.push({id:player.id, name:player.name, cards:player.cards.length})
		rooms.push(room)
		socket.join(_room)
		socket.emit('room-joined', {message:`${socket.nickname} has joined room`, players:playersInRoom, turn:player.turn})
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
	let message = "Game has started"
	let roomIndex = getRoomIndexFromName(_room)
	let topCard = rooms[roomIndex].deck.pickTopCard()
	rooms[roomIndex].setTopCard(topCard[0])
	let pir = []
	for(var i = 0; i < players.length; i++){
	if(players[i].room === _room)
	{
		let cards = rooms[roomIndex].deck.deal(4)
		rooms[roomIndex].setPreviousCommand("play")
		players[i].addCards(cards)
		pir.push({id:players[i].id, name:players[i].name, cards:players[i].cards.length, turn:players[i].turn, kadi:players[i].kadi, command:players[i].command})
		io.to(players[i].id).emit('assign-cards', {cards,topCard})
	}
	}
	io.in(_room).emit('set-players-in-room', {pir, message})
})

socket.on('set-kadi', (_room) => {
	let roomIndex = getRoomIndexFromName(_room)
	if(rooms[roomIndex].prev_player_id === socket.id){
	for(let i = 0; i < players.length; i++){
		if(socket.id === players[i].id){
		players[i].setKadi(true)
		const message = `${socket.nickname} is kadi`
		io.in(_room).emit('player-is-kadi', {message})
		break
		}
	}
	}else{
	const message = "Cannot set kadi after next player has played"
	socket.emit('wrong-move', message)
	}
})

socket.on('send-message', (data) => {
	let message = data.msg
	socket.to(data.room).emit("receive-message", {message});
	//Save this message in the database
})

socket.on('play-cards', (_room, _cards, reqSuit, _isKadi) => {
	let playedCards = _cards
	let roomIndex = getRoomIndexFromName(_room)
	let player = getPlayerFromRoomName(_room,socket.id)
	let response
	let direction = rooms[roomIndex].direction
	let roomSuit = rooms[roomIndex].requestedSuit
	let gameOver = false
	let message = ""
	
	if (!player.turn){
	return
	}
	if(player.command === "play"){
	response = evaluateSelectedCardsPlay(playedCards,rooms[roomIndex].topCard,reqSuit,roomSuit,direction,rooms[roomIndex].prev_command)
	}
	else if(player.command === 'pick'){
	//Pick cards or play A
	console.log("Pick, Direction", direction)
	response = evaluateSelectedCardsPick(playedCards,rooms[roomIndex].topCard,direction)
	}
	else{
	message = "It is not your turn"
	socket.emit('wrong-move', {message})
	console.log("It is not your turn")
	}
	if(response === undefined){
	const message = "Wrong move."
	socket.emit('wrong-move', {message})
	console.log("Careful!!!! You have broken a rule.")
	return
	}
	console.log(response)

	//Return any errors
	if(response.error){
	//Emit error to current player
	message = "Wrong move"
	socket.emit('wrong-move', {message})
	return
	}else{
	//Get the next player
	let nextPlayer = getNextPlayerIdInRoom(response.next_step, player.id, _room)
	let tc = playedCards[_cards.length - 1]
	rooms[roomIndex].setTopCard(tc)
	rooms[roomIndex].removeRequestedSuit()
	let pir = []

	rooms[roomIndex].setPreviousCommand(response.next_command)
	rooms[roomIndex].setPrevPlayerId(socket.id)
	//Set current player state
	//Using this loop so as to get the index of the player and mutate the original array
	for (let i = 0; i<players.length; i++){
		//If its current Player
		//Remove cards
		//Check if player is kadi and doesn't have cards left
			//End game true
			//Continue as normal
		if(players[i].id === socket.id && players[i].kadi === true && players[i].id !== nextPlayer.id){
		console.log("Player is kadi and not the next player.")
		let card_count = players[i].removeCards(playedCards)
		if(card_count > 0 && ["K","Q","J","8","3","2","A"].includes(playedCards[playedCards.length - 1].value)){
			console.log("Cannot complete game. Player has cards remaining or the combination is not accepted")
		}else{
			console.log("Attempting to end game. Player does not have cards left")
			const name = socket.nickname
			io.in(_room).emit('game-over', {name})
			gameOver = true
			break
		}
		}

		//Current player is same as the player who played
		if(players[i].id === socket.id && players[i].id !== nextPlayer.id){
		let pid = players[i].id
		players[i].command = response.cur_command
		players[i].removeCards(playedCards)
		//if response is pick,pick the cards from deck
		if(response.cur_command === "pick"){
			let cards = rooms[roomIndex].deck.deal(response.data)
			players[i].addCards(cards)
			cards = players[i].cards
			players[i].setKadi(false)
			io.to(players[i].id).emit('card-picked', {cards} )
		}else if(response.req_suit){
			console.log('Setting request set')
			rooms[roomIndex].setRequestedSuit(response.req_suit)
			let cards = players[i].cards
			players[i].setKadi(false)
			io.to(players[i].id).emit('card-picked', {cards, message}) 
		}
		else{
			let cards = players[i].cards
			players[i].setKadi(false)
			io.to(pid).emit('card-picked', {cards})
		}
		
		//players[i].kadi = _isKadi
		players[i].turn = false
		players[i].command = "idle"

		message = `${players[i].name} has just played. It's ${nextPlayer.name} turn!`
		}

		//Current player is the same as the player who played and is the next player
		else if(players[i].id === socket.id && players[i].id === nextPlayer.id){
		players[i].removeCards(playedCards)
		let cards = players[i].cards
		players[i].turn = true
		players[i].command = "play"
		io.to(players[i].id).emit('card-picked', {cards})
		io.to(players[i].id).emit('my-turn')
		message = ` It's still ${players[i].name} turn!`
		}

		//Current player is the next player
		else if(players[i].id === nextPlayer.id){
		//Set next player state
		players[i].turn = true
		players[i].command = response.next_command
		//io.to(players[i].id).emit('my-turn')
		}

		if(players[i].room === _room){
		pir.push({id:players[i].id, name:players[i].name, cards:players[i].cards.length, turn:players[i].turn, kadi:players[i].kadi, command:players[i].command})
		}
	}

	if(gameOver === false){
		if(rooms[roomIndex].deck.numberOfCards < 3){
		rooms[roomIndex].deck.shufflePlayedCards
		}
		if(response.req_suit){
		let suitMsg = `${player.name} requested ${response.req_suit}`
		io.in(_room).emit('suit-set', {suitMsg})
		}
		rooms[roomIndex].setPreviousCommand(response.next_command)
		rooms[roomIndex].changeDirection(response.direction)
		io.to(player.id).emit('turn-played', 'Turn played successfully')
		let cards = playedCards
		//Send signal to all players in room
		io.in(_room).emit('cards-played', {tc,pir,cards,message})
	}
	}
})

socket.on('pick-card', (_room) => {
	let message = ""
	let roomIndex = getRoomIndexFromName(_room)
	let direction = rooms[roomIndex].direction
	let player = getPlayerFromRoomName(_room,socket.id)
	let nextPlayer = getNextPlayerIdInRoom(direction, player.id, _room)
	let pir = []
	if(player.turn){
	for(let i = 0; i < players.length; i++){
		//Normal Play Player picks one card
		if(players[i].id === socket.id && players[i].command === "play"){
		let card = rooms[roomIndex].deck.pickCard()
		players[i].addCards(card)
		players[i].kadi = false
		let cards = players[i].cards
		io.to(players[i].id).emit('card-picked', {cards})
		players[i].turn = false;
		players[i].command = "idle"
		message = `${players[i].name} has just picked. It's ${nextPlayer.name} turn!`
		}
		//Player is set to pick a 3 or 2 cards
		else if(players[i].id === socket.id && players[i].command === "pick"){
		let topCardValue = parseInt(rooms[roomIndex].topCard.value)
		let cs = rooms[roomIndex].deck.deal(topCardValue)
		players[i].addCards(cs)
		players[i].kadi = false
		let cards = players[i].cards
		io.to(players[i].id).emit('card-picked', {cards})
		players[i].turn = false;
		players[i].command = "idle"
		message = `${players[i].name} has just picked. It's ${nextPlayer.name} turn!`
		}
		else if(players[i].id === nextPlayer.id){
		players[i].turn = true
		players[i].command = "play"
		io.to(players[i].id).emit('my-turn')
		}
		if(players[i].room === _room){
		pir.push({id:players[i].id, name:players[i].name, cards:players[i].cards.length, turn:players[i].turn, kadi:players[i].kadi, command:players[i].command})
		}
	}
	if(rooms[roomIndex].deck.numberOfCards < 3){
		rooms[roomIndex].deck.shufflePlayedCards
	}
	rooms[roomIndex].setPreviousCommand("play")
	io.in(_room).emit('set-players-in-room', {pir,message})

	}else{
	let message = "Not your turn"
	socket.emit('wrong-move', message)
	console.log("Not your turn")
	}
})

socket.on('restart-game', (_room) => {
	let roomIndex = getRoomIndexFromName(_room)
	rooms[roomIndex].deck.resetDeck();
	let pir = []

	let topCard = rooms[roomIndex].deck.pickTopCard()
	rooms[roomIndex].setTopCard(topCard[0])

	for(let i = 0; i < players.length; i++){
	if(players[i].room === _room)
	{
		players[i].command = "idle"
		players[i].cards = []
		players[i].kadi = false
		let cards = rooms[roomIndex].deck.deal(4)
		players[i].addCards(cards)

		if(players[i].id === socket.id){
		players[i].turn = true;
		players[i].command = "play"
		}
		pir.push({id:players[i].id, name:players[i].name, cards:players[i].cards.length, turn:players[i].turn, kadi:players[i].kadi})
		io.to(players[i].id).emit('assign-cards', {cards,topCard})
	}
	}
	io.in(_room).emit('game-restarted', {pir})

})

socket.on('end-game', (_room) => {
	let roomIndex = getRoomIndexFromName(_room)
	for(i=0; i < players.length; i++){
	if(players[i].room === _room){
		players.splice(i,1)
	}
	}
	rooms.splice(roomIndex, 1)
	console.log("Room terminated")
})
})

instrument(io, {
auth: false,
mode: "development",
});


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
	for(i=0;i<increment;i++){
	nextIndex+=1
	if(nextIndex >= playersInRoom.length){
		nextIndex = 0
	}
	}
}else{
	for(i=increment;i<0;i++){
	nextIndex-=1
	if(nextIndex < 0){
		nextIndex = playersInRoom.length-1
	}
	}
}  
let nextPlayer = playersInRoom[nextIndex]
return nextPlayer
}

function evaluateSelectedCardsPlay(cards,topCard,reqSuit,roomSuit,direction,prevCommand){
let previousCard = topCard;
// let cur_dir = _direction
//const roomSuit = roomSuit
let myPlay = false
let rs
// let response
let playOk = true
let ksPlayed = 0
let jsPlayed = 0

console.log("previous command :",prevCommand)
for(const card of cards)
{
	if(myPlay){
	//If previous card is Q current card has to be Q or 10,9,8,7,6,5,4 of the same suit
	//If previous card is 8 current card has to be 8 or Q,10,9,7,6,5,4 of the same suit
	//If previous card is K,J,10,9,7,6,5,4,3,2,A current card has to be of the same value
		//if current card is k add ksplayed
		//If current card is j add jsplayed
	if(previousCard.value === "Q"){
		if( card.value === "Q") {
		previousCard = card
		}
		else if(["10","9","8","7","6","5","4"].includes(card.value) && previousCard.suit === card.suit){
			previousCard = card
		}
		else{
		console.log("Previous card is Q and subsequent are not allowed")
		playOk = false
		return
		}
	} 
	else if(previousCard.value === "8")
	{
		if( card.value === "8") {
		previousCard = card
		}
		else if(["Q","10","9","7","6","5","4"].includes(card.value) && previousCard.suit === card.suit){
			previousCard = card
		} else {
		playOk = false
		console.log("Previous card is 8 and subsequent are not allowed")
		return
		} 
	}
	else if(["K","J","10","9","7","6","5","4","3","2","A"].includes(card.value) && (previousCard.value === card.value || card.value === "A")) {
		previousCard = card;
		if (card.value === "K") {
		ksPlayed++;
		}
		if (card.value === "J") {
		jsPlayed++;
		}
	} else {
		console.log("Play false Iteration")
		playOk = false
		break
	}
	}
	else{
	//If current card is A and previous command is pick cancel pick
	if (card.value === "A" && previousCard.value === "3" && previousCard.value === "2" && prevCommand === "pick") {
		console.log("Cancel pick")
		previousCard = card;
		myPlay = true
	}
	//If current card is A and previous command is play set suit
	else if (card.value === "A" && prevCommand === "play") {
		console.log("Setting suit")
		previousCard = card;
		rs = reqSuit;
		myPlay = true
	}
	else if(previousCard.value === "A" && roomSuit.isSet === true && card.suit === roomSuit.suit){
		console.log("Play matches requested suit")
		previousCard = card
		myPlay = true
	}
	//If previous card matches current card value or suit
		//if current card is k add ksplayed
		//If current card is j add jsplayed
	else if (previousCard.value === card.value || previousCard.suit === card.suit) {
		if(roomSuit.isSet === true && card.suit !== roomSuit.suit){
		console.log("Play the correct suit")
		playOk = false
		break
		}

		previousCard = card;
		
		if (card.value === "K") {
		ksPlayed++;
		}
		if (card.value === "J") {
		jsPlayed++;
		}
		myPlay = true
	} else {
		console.log("Play false First")
		playOk = false
		break
	}
	}
	

}

if(playOk){
	let nextPlayer
	if(ksPlayed === 1 || ksPlayed === 3){
	//Change to opposite
	if(direction > 0){
		direction = -1
		nextPlayer = 1
	}else{
		direction = 1
		nextPlayer = 1
	}
	response = {cur_command:"idle", next_command:"play",direction:direction, next_step:nextPlayer*direction, error:false,errorMsg:""}
	console.log("ks played",response)
	}
	else if(ksPlayed === 2 || ksPlayed === 4){
	nextPlayer = 1
	response = {cur_command:"idle", next_command:"play", data:0, direction:direction, next_step:nextPlayer*direction, error:false,errorMsg:""}
	console.log("ks played",response)
	}

	if(jsPlayed > 0){
	nextPlayer = jsPlayed + 1
	response = {cur_command:"idle", next_command:"play", data:0, direction:direction, next_step:nextPlayer*direction, error:false,errorMsg:""}
	console.log("js played",response)
	}
	if(rs){
	nextPlayer = 1
	console.log("Suit set")
	response = {cur_command:"idle", next_command:"play", data:0, direction:direction, next_step:nextPlayer*direction, error:false,errorMsg:"", req_suit:rs}
	}

	if(previousCard.value === "Q" || previousCard.value === "8"){
	nextPlayer = 1
	response = {cur_command:"pick", next_command:"play", data:1, direction:direction, next_step:nextPlayer*direction, error:false,errorMsg:""}
	//Command for current player to pick one card. Next player to play
	}
	else if(previousCard.value ==="3" || previousCard.value === "2"){
	//Set current player to idle. Next player to pick
	nextPlayer = 1
	response = {cur_command:"idle", next_command:"pick", data:parseInt(previousCard.value), direction:direction, next_step:nextPlayer*direction, error:false,errorMsg:""}
	}
	else if(previousCard.value === "10" 
			|| previousCard.value === "9" 
			|| previousCard.value === "7" 
			||previousCard.value === "6"
			|| previousCard.value === "5"
			||previousCard.value === "4"
			){
	nextPlayer = 1
	response = {cur_command:"idle", next_command:"play", data:0, direction:direction, next_step:nextPlayer*direction, error:false,errorMsg:""}
	}
}else{
	response = {cur_command:"play", next_command:"idle", data:0, direction:direction, next_step:0, error:true, errorMsg:"You cannot play the cards in that order"}
}
return response
}

function evaluateSelectedCardsPick(_cards,_topCard, _direction){
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
	for (const card of _cards){
	if(myPlay){
		if(previousCard.value === "3" && card.value === "3"){
		previousCard = playingcards[i]
		}else if(previousCard.value === "2" && card.value === "2"){
		previousCard = playingcards[i]
		}else if(previousCard.suit === card.suit && (card.value === "3" || card.value === "2")){
		previousCard = playingcards[i]
		}else{
		playOk=false
		}
	}
	else{
		if(previousCard.value === "3" && card.value === "3"){
		previousCard = card
		myPlay = true
		}else if(previousCard.value === "2" && card.value === "2"){
		previousCard = card
		myPlay = true
		}else if(previousCard.suit === card.suit && (card.value === "3" || card.value === "2")){
		previousCard = card
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
















