var mysql = require('mysql');

const dotenv = require("dotenv")

dotenv.config()

const conn = mysql.createPool({
    multipleStatements:true,
    connectionLimit:10,
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: "",
    database:process.env.DB_NAME
})

module.exports = conn