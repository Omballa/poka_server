const router = require('express').Router();
const conn = require('../utils/connection');
const mysql = require("mysql");
const jwt = require("jsonwebtoken");
const verify = require('../utils/verifyToken')


router.get('/levels', verify,async (req,res) => {	
    conn.getConnection(function (connErr, connection) {
        if(connErr) throw connErr

        let sql = "SELECT * FROM player_progress WHERE player_id = ?";
	    let inserts = [req.user.user.id]

        sql = mysql.format(sql,inserts);

        connection.query(sql, function (databaseErr, results, fields) {
            connection.release()
            if (databaseErr) {
                res.status(401).json({ status: 401, message: databaseErr.message });
            } else {
                res.status(200).json({ status: 200, data:results });
            }
        })

    })
})


module.exports = router;
