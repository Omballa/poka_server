const jwt = require('jsonwebtoken');

module.exports = function(req, res, next)
{
    let token
    try {
        token = req.body.token
    } catch (err) {
        console.log(err)
    }
    
    
    if(!token) return res.status(200).json({status:401, message:"No token"});
    try {
        const verified = jwt.verify(token, process.env.TOKEN_SECRET);
        req.user = verified;
        next();
    } catch (err) {
        res.status(401).json({status:401, error: err}); 
    }
}









