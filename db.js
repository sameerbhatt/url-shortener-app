var mysql = require('mysql2')
// while running local
/* var pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'root123',
    database: 'mydb'
}); */
// from a docker container, use name of mysql container
var pool = mysql.createPool({
    host: 'mysql-url-shortener',
    user: 'root',
    password: 'root123',
    database: 'mydb'
});

module.exports = pool;