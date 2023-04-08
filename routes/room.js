const router = require('express').Router();
const conn = require('../utils/connection');
const mysql = require("mysql");
const verify = require('../utils/verifyToken')
var Room = require("../classes/room")

const {getRoomIndexFromName, removeCards, evaluateSelectedCardsPlay, evaluateBestMove} = require('../utils/tools');

let aiRooms = []

router.post('/create', verify, async (req,res) => {
    let room = new Room(req.body.roomName,req.body.name)
    room.setPreviousCommand("play")
    let topCard = room.deck.pickTopCard()
    let aiCards = room.deck.deal(4)
    let playerCards = room.deck.deal(4)
    room.setTopCard(topCard[0])
    aiRooms.push(room)

    conn.getConnection(function (connErr, connection) {
        if(connErr) throw connErr
        let sql = "INSERT INTO rooms (name,user_id, top_card) VALUES (?, ?, ?); INSERT INTO ai (user_id, cards) VALUES (?, ?); INSERT INTO players (user_id, cards) VALUES (?,?)";
	    let inserts = [req.body.roomName,req.user.user.id, JSON.stringify(topCard),req.user.user.id,JSON.stringify(aiCards), req.user.user.id, JSON.stringify(playerCards)]

        sql = mysql.format(sql,inserts);
        connection.query(sql, function (databaseErr, results, fields) {
            connection.release()
            if (databaseErr) {
                res.status(401).json({ status: 401, message: databaseErr.message });
            } else {
                res.json({status:200, message:"Room created successfully", id:results.insertId, top_card:topCard})
            }
        })

    })
})

router.post('/play', verify, async (req,res) => {
    const roomIndex = getRoomIndexFromName(aiRooms,req.body.roomName)
    let topCard = aiRooms[roomIndex].topCard
    let roomSuit = aiRooms[roomIndex].requestedSuit
    let prevCommand = aiRooms[roomIndex].prev_command

    let myCards
    let aiCards

    conn.getConnection(function (connErr, connection) {
        if(connErr) throw connErr
        let sql = "SELECT cards FROM players WHERE user_id = ?; SELECT cards FROM ai WHERE user_id = ?";
	    let inserts = [req.user.user.id,req.user.user.id]

        sql = mysql.format(sql,inserts);
        connection.query(sql, function (databaseErr, results, fields) {
            if (databaseErr) {
                res.status(401).json({ status: 401, message: databaseErr.message });
            } else {
                myCards = JSON.parse(results[0][0].cards)
                aiCards = JSON.parse(results[1][0].cards)
                
                let response = evaluateSelectedCardsPlay(req.body.cards,topCard,"",roomSuit, 1, prevCommand)
                let remainingCards = removeCards(req.body.cards, myCards)

                if (response.error){
                    res.json({message:response.errorMsg, error:true})
                }else{
                    //Respond to player's move
                    response = possibleMoves(aiCards,topCard, response.next_command)
                    //Loop through the possibilities
                    //Play a move.
                    //Update player move
                    console.log(response)
                }
                res.json({message:"Cards played successfully", response:response, remainingCards:remainingCards})
            }
        })
    })
    //Check if play is okay
    //cards,topCard,reqSuit,roomSuit,direction,prevCommand
    
})

router.post('/pick', verify, async (req,res) => {
    const roomIndex = getRoomIndexFromName(aiRooms,req.body.roomName)
    let card = aiRooms[roomIndex].deck.pickCard()
    //Update player's cards

    conn.getConnection(function (connErr, connection) {
        if(connErr) throw connErr
        let sql = "SELECT cards FROM players WHERE user_id = ?";
	    let inserts = [req.user.user.id]

        sql = mysql.format(sql,inserts);
        connection.query(sql, function (databaseErr, results, fields) {
            if (databaseErr) {
                res.status(401).json({ status: 401, message: databaseErr.message });
            } else {

                let cards = JSON.parse(results[0].cards)
                cards.push(card[0])

                let sql2 = "UPDATE players SET cards = ? WHERE user_id = ? AND active = 1";
                let inserts2 = [JSON.stringify(cards), req.user.user.id]

                sql2 = mysql.format(sql2,inserts2);
                connection.query(sql2, function (databaseErr, results, fields) {
                    connection.release()
                    if (databaseErr) {
                        res.status(401).json({ status: 401, message: databaseErr.message });
                    } else {
                        res.json({status:200, message:"Card picked successfully", cards:cards})
                    }
                })
            }
        })

    })

})

module.exports = router;