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

function DatabaseConnection(_databaseHandler){
	this.conn = null;
	this.busy = false;
	this.lastRequestTime = new Date().getTime();
	this.idleIntervalTimer = null;
	this.isConnecting = false;
	this.databaseHandler = _databaseHandler;
	this.config = _databaseHandler.config;
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
		callback.call(t, connection);

		clearInterval(t.idleIntervalTimer);
		t.idleIntervalTimer = setInterval(function(){
			if(t.conn != null && t.lastRequestTime < new Date().getTime() - 120000){
				console.log("Closing idle database connection");
				t.conn.close();
				t.conn = null;

				t.databaseHandler.onConnectionClosed();
			}
		}, 30000);
	});
	
	connection.on('errorMessage', function(err){
		console.log("Error: " + JSON.stringify(err));
		callback({error: err.toString()});
	});
	
	connection.on('infoMessage', function(err){
		//console.log("Info: " + err);
	});
	
	connection.on('debug', function(err){
		//console.log("Debug: " + err);
	});
	
	connection.on('end', function(err){
		if(t.conn != null)
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

function DatabaseHandler(_config){
	this.connections = [];
	this.queries = [];
	this.headQuery = null;
	this.tailQuery = null;
	this.isOpeningNewConnection = false;
	this.lastLogActiveConnections = 0;
	this.doNotRetryUntil = 0;
	this.config = _config;

	var t = this;
	this.timer = setInterval(function(){
		t.runNextQuery();
	}, 100);

	console.log("DatabaseHandler: initialized");
}

DatabaseHandler.prototype.openNewConnection = function(callback){
	//if(this.isOpeningNewConnection)
	//	callback();

	var t = this;

	if(t.doNotRetryUntil > 0 && t.doNotRetryUntil > new Date().getTime()){
		//console.log("Cannot run query yet.");
		return;
	}
	t.doNotRetryUntil = 0;

	this.isOpeningNewConnection = true;

	var conn = new DatabaseConnection(this);

	conn.connect(function(ret){
		t.isOpeningNewConnection = false;
		if(ret !== undefined && ret.error !== undefined){
			console.log("Could not connect to database. Retrying in 10 seconds...");
			t.doNotRetryUntil = new Date().getTime() + 10000;
		} else {
			
			t.connections.push(this);
			if(typeof(callback) === "function")
				callback.call(this, this.conn);

			console.log("Active database connections: " + t.numOpenConnections());
		}
	});
}

DatabaseHandler.prototype.runNextQuery = function(){
	if(this.headQuery == null)
		return;

	/*
	//console.log("DatabaseHandler: looking for connections in stored " + this.connections.length);
	var activeConnections = 0;
	for(var i = 0; i < this.connections.length; i++) 
		if(this.connections[i] !== undefined && this.connections[i].conn != null) 
			activeConnections++;
	if(this.lastLogActiveConnections != activeConnections){
		console.log("Active connections: " + activeConnections);
		this.lastLogActiveConnections = activeConnections;
	}
	*/

	for(var i = 0; i < this.connections.length; i++){
		if(this.connections[i] === undefined)
			continue;

		if(this.connections[i].conn == null){
			this.connections[i] = undefined;
			continue;
		}

		if(!this.connections[i].busy){
			//console.log("DatabaseHandler: found available connection");
			this.connections[i].query(this.headQuery.query, this.headQuery.args, this.headQuery.callback);
			this.headQuery = this.headQuery.nextQuery;
			return;
		}
	}

	if(!this.isOpeningNewConnection){
		var t = this;
		this.openNewConnection(function(){
			t.runNextQuery();
		});
	}
}

DatabaseHandler.prototype.onConnectionClosed = function(){
	if(this.numOpenConnections() < 1){
		console.log("All connections has been closed. Opening new...")
		this.openNewConnection();
	}
}

DatabaseHandler.prototype.numOpenConnections = function(){
	var num = 0;
	for(var i = 0; i < this.connections.length; i++){
		if(this.connections[i] !== undefined && this.connections[i].conn != null)
			num++;
	}
	return num;
}

DatabaseHandler.prototype.query = function(_query, _args, callback){
	//console.log("DatabaseHandler: Adding query");
	var query = {query: _query, args: _args, callback: callback, nextQuery: null};

	if(this.headQuery == null)
		this.headQuery = query;

	if(this.tailQuery != null)
		this.tailQuery.nextQuery = query;

	this.tailQuery = query;
	this.runNextQuery();
}
DatabaseHandler.prototype.exec = DatabaseHandler.prototype.query;

exports = module.exports = DatabaseHandler;