const { v4: uuidv4 } = require('uuid');
const router = require('express').Router();
const conn = require('../utils/connection');
const mysql = require("mysql");
const jwt = require("jsonwebtoken");
const verify = require('../utils/verifyToken')


router.post('/register', async (req,res) => {
    console.log(req.body)
	const id = uuidv4();
	
    conn.getConnection(function (connErr, connection) {
        if(connErr) throw connErr

        let sql = "INSERT INTO users (id,name) VALUES (?, ?)";
	    let inserts = [id,req.body.name]

        sql = mysql.format(sql,inserts);

        connection.query(sql, function (databaseErr, results, fields) {
            connection.release()
            if (databaseErr) {
                res.status(401).json({ status: 401, message: databaseErr.message });
            } else {
                const user = {
                    id: id,
                    role: 3,
                    verified: false
                }
                const token = jwt.sign({ user }, process.env.TOKEN_SECRET, { expiresIn: '21d' });
                res.status(200).json({ status: 200, message: "Device reqistered successfully.", token:token });
            }
        })

    })
})

router.post('/update', verify, async (req,res) => {	
    //res.send(req.user.user)
    conn.getConnection(function (connErr, connection) {
        if(connErr) throw connErr

        let sql = "UPDATE users SET name = ? WHERE id = ?";
	    let inserts = [req.body.name,req.user.user.id]

        sql = mysql.format(sql,inserts);

        connection.query(sql, function (databaseErr, results, fields) {
            connection.release()
            if (databaseErr) {
                res.status(401).json({ status: 401, message: databaseErr.message });
            } else {
                res.status(200).json({ status: 200, message: "Name updated successfully." });
            }
        })

    })
})

router.post('/add-game', verify, async(req,res) => {
    conn.getConnection(function (connErr, connection) {
        if(connErr) throw connErr

        let sql = 'UPDATE users SET games_played = games_played + 1 WHERE id = ?';;
	    let inserts = [req.user.user.id]

        sql = mysql.format(sql,inserts);

        connection.query(sql, function (databaseErr, results, fields) {
            connection.release()
            if (databaseErr) {
                res.status(401).json({ status: 401, message: databaseErr.message });
            } else {
                res.status(200).json({ status: 200, message: "Game count added successfully." });
            }
        })

    })
})

router.post('/add-win', verify, async(req,res) => {
    conn.getConnection(function (connErr, connection) {
        if(connErr) throw connErr

        let sql = 'UPDATE users SET games_won = games_won + 1 WHERE id = ?';;
	    let inserts = [req.user.user.id]

        sql = mysql.format(sql,inserts);

        connection.query(sql, function (databaseErr, results, fields) {
            connection.release()
            if (databaseErr) {
                res.status(401).json({ status: 401, message: databaseErr.message });
            } else {
                res.status(200).json({ status: 200, message: "Games won count added successfully." });
            }
        })

    })
})

router.post('/add-win', verify, async(req,res) => {
    conn.getConnection(function (connErr, connection) {
        if(connErr) throw connErr

        let sql = 'UPDATE users SET games_won = games_won + 1 WHERE id = ?';;
	    let inserts = [req.user.user.id]

        sql = mysql.format(sql,inserts);

        connection.query(sql, function (databaseErr, results, fields) {
            connection.release()
            if (databaseErr) {
                res.status(401).json({ status: 401, message: databaseErr.message });
            } else {
                res.status(200).json({ status: 200, message: "Games won count added successfully." });
            }
        })
    })
})

module.exports = router;
