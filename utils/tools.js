const conn = require('../utils/connection');
const mysql = require("mysql");

function getRoomIndexFromName(rooms,_name){
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

function removeCards(_cards,_allCards){
    let remainingCards = _allCards

    for(let i=0;i<_cards.length;i++){
      for(let j=0; j<remainingCards.length; j++){
        if(_cards[i].value === remainingCards[j].value && _cards[i].suit === remainingCards[j].suit){
          remainingCards.splice(j,1)
        }
      }
    }
    return remainingCards
}

function evaluateSelectedCardsPlay(cards,topCard,reqSuit,roomSuit,direction,prevCommand){
	let previousCard = topCard;
	let myPlay = false
	let rs
	let playOk = true
	let ksPlayed,jsPlayed,qsPlayed,qasPlayed,nsPlayed,asPlayed,psPlayed = 0;
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

            if(playOk){
                if(card.value === "K"){
                    ksPlayed+=1
                }else if(card.value === "Q"){
                    qsPlayed+=1
                }else if(card.value === "J"){
                    jsPlayed+=1
                }else if(card.value === "10" || card.value === "9" || card.value === "7", card.value === "6", card.value === "5", card.value === "4"){
                    nsPlayed+=1
                }else if(card.value === "3" || card.value === "2"){
                    psPlayed+=1
                }else if(card.value === "A"){
                    asPlayed+=1
                }
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
                nsPlayed+=1
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
				myPlay = true
			} else {
				console.log("Play false First")
				playOk = false
				break
			}

            if(playOk){
                if(card.value === "K"){
                    ksPlayed+=1
                }else if(card.value === "Q"){
                    qsPlayed+=1
                }else if(card.value === "J"){
                    jsPlayed+=1
                }else if(card.value === "10" || card.value === "9" || card.value === "7", card.value === "6", card.value === "5", card.value === "4"){
                    nsPlayed+=1
                }else if(card.value === "3" || card.value === "2"){
                    psPlayed+=1
                }else if(card.value === "A"){
                    asPlayed+=1
                }
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

function possibleMoves(hand,prevCard,prevCommand){
    let validCards = []
    let otherCards = []
    
    for (let card of hand){
        if(prevCommand === "play"){
            if(card.suit === prevCard.suit){
                validCards.push(card)
            }else{
                otherCards.push(card)
            }
        }
        if(prevCommand === "pick"){
            if(card.suit === prevCard.suit && (card.value === "3" || card.value === "2")){
                validCards.push(card)
            }else{
                otherCards.push(card)
            }
        }
        
    }
    for (let card of validCards){
        let h = [...otherCards]
        let move = [card]
        bestMoves.push([card])
        while(true){
            let i = h.findIndex(e => e.value === card.value)
            if(i > -1){
                let c = h.splice(i,1)
                move.push(c[0])
                bestMoves.push([...move])
            }else{
                break
            }
        }
    }
    console.log("Best Moves", bestMoves)
    for (let move of bestMoves){
        let v = move[move.length - 1].value
        if(v === "8" || v === "Q"){
            console.log("Q move")
            //Query 
        }else if(v === "K"){
            console.log("K move")
        }
        else if(v === "J"){
            console.log("J move")
        }
        else if(["10","9","7","6","5","4"].includes(v)){
            console.log("N move")
        }
        else if(v === "3" || v === "2"){
            console.log("P move")
        }
        else{
            console.log("A move")
        }
    }
    
}
  
module.exports = {getRoomIndexFromName, removeCards, evaluateSelectedCardsPlay, possibleMoves}
    
    // function getPlayerFromRoomName(_name,_id){
    // let player
    // for(var p of players){
    //     if(p.room === _name && p.id === _id){
    //     player = p
    //     break
    //     }
    // }
    // return player
    // }
    
    // function getNextPlayerIdInRoom(_increment, _cid, _name){
    // let playersInRoom = []
    // let increment = _increment
    // let curIndex = 0
    // let pir_ids=-1
    // for(var p of players){
    //     if(p.room === _name){
    //     pir_ids+=1
    //     if(p.id === _cid){
    //         curIndex = pir_ids
    //     }
    //     playersInRoom.push(p)
    //     }
    // }
    // let nextIndex = curIndex
    // if(increment > 0){
    //     for(i=0;i<increment;i++){
    //     nextIndex+=1
    //     if(nextIndex >= playersInRoom.length){
    //         nextIndex = 0
    //     }
    //     }
    // }else{
    //     for(i=increment;i<0;i++){
    //     nextIndex-=1
    //     if(nextIndex < 0){
    //         nextIndex = playersInRoom.length-1
    //     }
    //     }
    // }  
    // let nextPlayer = playersInRoom[nextIndex]
    // return nextPlayer
    // }
    
    // function evaluateSelectedCardsPlay(cards,topCard,reqSuit,roomSuit,direction,prevCommand){
    // let previousCard = topCard;
    // // let cur_dir = _direction
    // //const roomSuit = roomSuit
    // let myPlay = false
    // let rs
    // // let response
    // let playOk = true
    // let ksPlayed = 0
    // let jsPlayed = 0
    
    // console.log("previous command :",prevCommand)
    // for(const card of cards)
    // {
    //     if(myPlay){
    //     //If previous card is Q current card has to be Q or 10,9,8,7,6,5,4 of the same suit
    //     //If previous card is 8 current card has to be 8 or Q,10,9,7,6,5,4 of the same suit
    //     //If previous card is K,J,10,9,7,6,5,4,3,2,A current card has to be of the same value
    //         //if current card is k add ksplayed
    //         //If current card is j add jsplayed
    //     if(previousCard.value === "Q"){
    //         if( card.value === "Q") {
    //         previousCard = card
    //         }
    //         else if(["10","9","8","7","6","5","4"].includes(card.value) && previousCard.suit === card.suit){
    //             previousCard = card
    //         }
    //         else{
    //         console.log("Previous card is Q and subsequent are not allowed")
    //         playOk = false
    //         return
    //         }
    //     } 
    //     else if(previousCard.value === "8")
    //     {
    //         if( card.value === "8") {
    //         previousCard = card
    //         }
    //         else if(["Q","10","9","7","6","5","4"].includes(card.value) && previousCard.suit === card.suit){
    //             previousCard = card
    //         } else {
    //         playOk = false
    //         console.log("Previous card is 8 and subsequent are not allowed")
    //         return
    //         } 
    //     }
    //     else if(["K","J","10","9","7","6","5","4","3","2","A"].includes(card.value) && (previousCard.value === card.value || card.value === "A")) {
    //         previousCard = card;
    //         if (card.value === "K") {
    //         ksPlayed++;
    //         }
    //         if (card.value === "J") {
    //         jsPlayed++;
    //         }
    //     } else {
    //         console.log("Play false Iteration")
    //         playOk = false
    //         break
    //     }
    //     }
    //     else{
    //     //If current card is A and previous command is pick cancel pick
    //     if (card.value === "A" && previousCard.value === "3" && previousCard.value === "2" && prevCommand === "pick") {
    //         console.log("Cancel pick")
    //         previousCard = card;
    //         myPlay = true
    //     }
    //     //If current card is A and previous command is play set suit
    //     else if (card.value === "A" && prevCommand === "play") {
    //         console.log("Setting suit")
    //         previousCard = card;
    //         rs = reqSuit;
    //         myPlay = true
    //     }
    //     else if(previousCard.value === "A" && roomSuit.isSet === true && card.suit === roomSuit.suit){
    //         console.log("Play matches requested suit")
    //         previousCard = card
    //         myPlay = true
    //     }
    //     //If previous card matches current card value or suit
    //         //if current card is k add ksplayed
    //         //If current card is j add jsplayed
    //     else if (previousCard.value === card.value || previousCard.suit === card.suit) {
    //         if(roomSuit.isSet === true && card.suit !== roomSuit.suit){
    //         console.log("Play the correct suit")
    //         playOk = false
    //         break
    //         }
    
    //         previousCard = card;
            
    //         if (card.value === "K") {
    //         ksPlayed++;
    //         }
    //         if (card.value === "J") {
    //         jsPlayed++;
    //         }
    //         myPlay = true
    //     } else {
    //         console.log("Play false First")
    //         playOk = false
    //         break
    //     }
    //     }
        
    
    // }
    
    // if(playOk){
    //     let nextPlayer
    //     if(ksPlayed === 1 || ksPlayed === 3){
    //     //Change to opposite
    //     if(direction > 0){
    //         direction = -1
    //         nextPlayer = 1
    //     }else{
    //         direction = 1
    //         nextPlayer = 1
    //     }
    //     response = {cur_command:"idle", next_command:"play",direction:direction, next_step:nextPlayer*direction, error:false,errorMsg:""}
    //     console.log("ks played",response)
    //     }
    //     else if(ksPlayed === 2 || ksPlayed === 4){
    //     nextPlayer = 1
    //     response = {cur_command:"idle", next_command:"play", data:0, direction:direction, next_step:nextPlayer*direction, error:false,errorMsg:""}
    //     console.log("ks played",response)
    //     }
    
    //     if(jsPlayed > 0){
    //     nextPlayer = jsPlayed + 1
    //     response = {cur_command:"idle", next_command:"play", data:0, direction:direction, next_step:nextPlayer*direction, error:false,errorMsg:""}
    //     console.log("js played",response)
    //     }
    //     if(rs){
    //     nextPlayer = 1
    //     console.log("Suit set")
    //     response = {cur_command:"idle", next_command:"play", data:0, direction:direction, next_step:nextPlayer*direction, error:false,errorMsg:"", req_suit:rs}
    //     }
    
    //     if(previousCard.value === "Q" || previousCard.value === "8"){
    //     nextPlayer = 1
    //     response = {cur_command:"pick", next_command:"play", data:1, direction:direction, next_step:nextPlayer*direction, error:false,errorMsg:""}
    //     //Command for current player to pick one card. Next player to play
    //     }
    //     else if(previousCard.value ==="3" || previousCard.value === "2"){
    //     //Set current player to idle. Next player to pick
    //     nextPlayer = 1
    //     response = {cur_command:"idle", next_command:"pick", data:parseInt(previousCard.value), direction:direction, next_step:nextPlayer*direction, error:false,errorMsg:""}
    //     }
    //     else if(previousCard.value === "10" 
    //             || previousCard.value === "9" 
    //             || previousCard.value === "7" 
    //             ||previousCard.value === "6"
    //             || previousCard.value === "5"
    //             ||previousCard.value === "4"
    //             ){
    //     nextPlayer = 1
    //     response = {cur_command:"idle", next_command:"play", data:0, direction:direction, next_step:nextPlayer*direction, error:false,errorMsg:""}
    //     }
    // }else{
    //     response = {cur_command:"play", next_command:"idle", data:0, direction:direction, next_step:0, error:true, errorMsg:"You cannot play the cards in that order"}
    // }
    // return response
    // }
    
    // function evaluateSelectedCardsPick(_cards,_topCard, _direction){
    // let cur_dir = _direction
    // let playingcards = _cards
    // let response
    // let previousCard = _topCard
    // let allAs = false
    // let playOk = true
    // let myPlay = false
    
    // if(playingcards[0].value === "A"){
    //     playingcards.map(card => {
    //     if(card.value === "A"){
    //         allAs = true
    //     }
    //     })
    // }
    // else{
    //     for (const card of _cards){
    //     if(myPlay){
    //         if(previousCard.value === "3" && card.value === "3"){
    //         previousCard = playingcards[i]
    //         }else if(previousCard.value === "2" && card.value === "2"){
    //         previousCard = playingcards[i]
    //         }else if(previousCard.suit === card.suit && (card.value === "3" || card.value === "2")){
    //         previousCard = playingcards[i]
    //         }else{
    //         playOk=false
    //         }
    //     }
    //     else{
    //         if(previousCard.value === "3" && card.value === "3"){
    //         previousCard = card
    //         myPlay = true
    //         }else if(previousCard.value === "2" && card.value === "2"){
    //         previousCard = card
    //         myPlay = true
    //         }else if(previousCard.suit === card.suit && (card.value === "3" || card.value === "2")){
    //         previousCard = card
    //         myPlay = true
    //         }else{
    //         playOk=false
    //         }
    //     }
    //     }
    // }
    
    // if(allAs){
    //     response = {cur_command:"idle", next_command:"play", data:0, direction:cur_dir, next_step:1*cur_dir, error:false, errorMsg:""}
    //     console.log("All As")
    // }else{
    //     if(playOk && (previousCard.value === "3" || previousCard.value === "2")){
    //     console.log("Equal to 3 or 2")
    //     response = {cur_command:"idle", next_command:"pick", data:parseInt(previousCard.value), direction:cur_dir, next_step:1*cur_dir, error:false, errorMsg:""}
    //     }else if(playOk && previousCard.value !== "3" || previousCard.value !== "2"){
    //     console.log("Not equal to 3 or 2")
    //     response = {cur_command:"play", next_command:"idle", data:parseInt(previousCard.value), direction:cur_dir, next_step:0, error:true, errorMsg:"Cannot play that card. Picking cards"}
    //     }else{
    //     console.log("Error")
    //     response = {cur_command:"pick", next_command:"play", data:parseInt(_topCard.value), direction:cur_dir, next_step:0, error:true, errorMsg:"You cannot play the cards in that order"}
    //     }
    // }
    
    // return response
    
    // }


