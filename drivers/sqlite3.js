function DatabaseConnection(){
	this.conn = null;
}

DatabaseConnection.prototype.connect = function(callback){
	if(this.conn){
		callback(this.conn);
		return;
	}
	
	var sqlite3 = require('sqlite3').verbose();
	this.conn = new sqlite3.Database('db.sqlite3');
	callback(this.conn);
}

DatabaseConnection.prototype.query = function(q, args, callback){
	if(typeof(args) == "function"){
		callback = args;
		args = [];
	}
		
	this.connect(function(conn){
		if(conn.error !== undefined) {
			callback(conn);
			return;
		}
		
		conn.all(q, args, function (err, results) {
			if (err) {
				console.log("Error running query!");
				console.log(err);
				if(typeof(callback) === "function")
					callback({error: err.toString(), query: q});
				return;
			}
			if(typeof(callback) === "function")
				callback(results, args);
		});
	});
}

DatabaseConnection.prototype.exec = function(q, callback){
		
	this.connect(function(conn){
		if(conn.error !== undefined) {
			callback(conn);
			return;
		}
		
		conn.exec(q, function (err) {
			if (err) {
				console.log("Error running query!");
				console.log(err);
				if(typeof(callback) === "function")
					callback({error: err.toString(), query: q});
				return;
			}
			if(typeof(callback) === "function")
				callback();
		});
	});
}

exports = module.exports = DatabaseConnection;