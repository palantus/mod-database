/*
Sample 1:
	db.query("select name from users where userid = ?", [query], function(res){
		callback(res);
	});

Sample 2:
	db.query("select name from users where userid = 'ahk'", function(res){
		callback(res);
	});
*/
	
var Request = require('tedious').Request;
var TYPES = require('tedious').TYPES;

function DatabaseConnection(_config){
	this.conn = null;
	this.busy = false;
	this.lastRequestTime = new Date().getTime();
	this.idleIntervalTimer = null;
	this.isConnecting = false;
	this.config = _config;
}

DatabaseConnection.prototype.connect = function(callback){

	if(this.conn){
		callback.call(this, this.conn);
		return;
	}

	this.isConnecting = true;

	var Connection = require('tedious').Connection;
	
	var config = {
		userName: this.config.DatabaseUsername,
		password: this.config.DatabasePassword,
		server: this.config.DatabaseServer,
		database: this.config.Database,
		options: {
			database: this.config.Database,
			encrypt: true
		}
	};
	console.log("Connecting to database...");
	
	var connection = new Connection(config);
	
	var t = this;
	connection.on('connect', function(err) {
		t.isConnecting = false;
		if(err){
			console.log("Error: " + err);
			callback.call(this, {error: err.toString()});
			return;
		}
		t.conn = connection;
		console.log("Connected to database");
		callback.call(this, connection);

		clearInterval(t.idleIntervalTimer);
		t.idleIntervalTimer = setInterval(function(){
			if(t.conn != null && t.lastRequestTime < new Date().getTime() - 120000){
				console.log("Closing idle database connection");
				t.conn.close();
				t.conn = null;
			}
		}, 30000);
	});
	
	connection.on('errorMessage', function(err){
		console.log("Error: " + JSON.stringify(err));
	});
	
	connection.on('infoMessage', function(err){
		//console.log("Info: " + err);
	});
	
	connection.on('debug', function(err){
		//console.log("Debug: " + err);
	});
	
	connection.on('end', function(err){
		console.log("Connection to database closed.");
		t.conn = null;
		t.busy = false;
		t.isConnecting = false;
	});
}

DatabaseConnection.prototype.query = function(_query, _args, callback){
	//console.log(_query);
	var args = _args;
	if(typeof(args) == "function"){
		callback = args;
		args = [];
	}
		
	var t = this;

	if(this.isConnecting) {
		console.log("Database is connecting, so waiting...");
		setTimeout(function(){
			t.query(_query, _args, callback);
		}, 500)
		return;
	}

	this.connect(function(conn){
		if(conn.error !== undefined) {
			callback(conn);
			return;
		}
		
		var res = [];
		var q = _query;
		var idx = q.indexOf("?");
		var num = 1;
		while(idx >= 0){
			q = q.substring(0, idx) + ("@a" + num) + q.substring(idx+1);
			idx = q.indexOf("?");
			num++;
		}
		
		//console.log("New query: " + q);
		
		var request = new Request(q, function (err, rowCount) {
			t.busy = false;
			if (err) {
				console.log("Error running query!");
				console.log(err);
				console.log("Query: " + q);
				if(typeof(args) === "object" || typeof(args) === "array")
					console.log(JSON.stringify(args));
				if(typeof(callback) === "function")
					callback({error: err.toString(), query: q});
				return;
			}
			
			//console.log("Query result: " + JSON.stringify(res));
			/*
			var res = [];
			for (var i = 0; i < results.rows.length; i++) {
				rowRes = {};
				for(m in results.meta)
					rowRes[results.meta[m].name] = results.rows[i][m]
				res.push(rowRes);
			}
			*/
			if(typeof(callback) === "function")
				callback(res, args);
		});
		
		request.on('row', function(columns){
			var row = {};
			columns.forEach(function(column) {
				row[column.metadata.colName] = column.value;
			});
			res.push(row);
		});
		
				
		if(args !== undefined){
			for(var i = 0; i < args.length; i++){
				request.addParameter('a'+(i+1),  TYPES.VarChar, args[i]);
			}
		}
		
		if(!t.busy){
			t.busy = true;
			t.lastRequestTime = new Date().getTime();
			conn.execSql(request);
		}
		else {
			console.log("Connection busy");
			setTimeout(function(){
				t.query(_query, _args, callback);
			}, 100)
		}
	});
}

DatabaseConnection.prototype.exec = DatabaseConnection.prototype.query;

exports = module.exports = DatabaseConnection;