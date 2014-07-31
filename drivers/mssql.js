function DatabaseConnection(_username, _password){
	this.conn = null;
	this.username = _username;
	this.password = _password;
}

DatabaseConnection.prototype.connect = function(callback){
	if(this.conn){
		callback(this.conn);
		return;
	}
	var sql = require('msnodesql');
	var conn_str = "Driver={SQL Server Native Client 10.0};Server=192.168.1.221;Database=AxManagement;Uid=" + this.username + ";Pwd=" + this.password + ";";
	var t = this;
	sql.open(conn_str, function(err, conn){
		if(err){
			console.log(err);
			callback({error: err.toString()});
			return;
		}
		t.conn = conn;
		console.log("Connected");
		callback(conn);
	});
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
		
		conn.query(q, args, function (err, results) {
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
exports = module.exports = DatabaseConnection;