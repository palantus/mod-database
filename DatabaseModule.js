var fs = require('fs');

var DatabaseModule = function () {
	this.datasources = {};
};

DatabaseModule.prototype.onMessage = function (req, callback) {
	var t = this;
	var args = req.body;
	args.isFromClient = true;

	req.body.table = typeof(req.body.table) === "string" ? req.body.table : typeof(req.body.ds)  === "string" ? req.body.ds : req.body.datasource;

	if(this.config.enableAuth && fw.modules["user"] !== undefined){
		if(!fw.modules["user"].loggedIn(req.body.sessionId)){
			callback({error: "You are not logged in"});
			return;
		}
		else if(typeof(req.body.table) === "string" && this.datasources[req.body.table] !== undefined && typeof(this.datasources[req.body.table].requiredPermission) === "string"){
			fw.modules["user"].hasPermission(req.body.sessionId, this.datasources[req.body.table].requiredPermission, function(hasPermission){
				if(hasPermission)
					t.run(args, callback);
				else
					callback({error: "You do not have permission to do this"});
			})
		} else {
			this.run(args, callback);
		}

	} else {
		this.run(args, callback);
	}
}

DatabaseModule.prototype.run = function (request, callback) {
	if(typeof(request.table) !== "string")
		callback({error: "No table for database action"});

	var ta = this.datasources[request.table];
	
	if(ta === undefined){
		console.log("Unknown table handler: " + request.table);
		callback({error: "Unknown table handler: " + request.table});
		return;
	}

	ta.args = request;
	ta.session = fw.modules["user"].sessionId2Session(request.sessionId);
	context = ta;

	var handled = true;
	switch(request.action){
		case "query" : 
			if(typeof(ta.handleQuery) === "function")
				ta.handleQuery.call(context, db, request.query, callback);
			else
				handled = false;
			break;
		case "insert" : 
			if(typeof(ta.handleInsert) === "function")
				ta.handleInsert.call(context, db, request.record, callback);
			else
				handled = false;
			break;
		case "update" : 
			if(typeof(ta.handleUpdate) === "function")
				ta.handleUpdate.call(context, db, request.oldRecord, request.newRecord, callback);
			else
				handled = false;
			break;
		case "delete" : 
			if(typeof(ta.handleDelete) === "function")
				ta.handleDelete.call(context, db, request.record, callback);
			else
				handled = false;
			break;
		case "custom" : 
			if(typeof(ta.handleCustom) === "function")
				ta.handleCustom.call(context, db, request.custom, callback);
			else
				handled = false;
			break;
		default: 
			callback({error: "No handler for database action"})
	}
	
	if(!handled)
		callback({error: "Could not handle request"});
};

DatabaseModule.prototype.handlePreStart = function(){
	
	for(moduleName in fw.modules){
		this.addTabels(moduleName);
	}
	this.onTabelsAdded();
}

DatabaseModule.prototype.addTabels = function(moduleName){
	var t = this;
	try{
		var files = fs.readdirSync(__dirname + "/../" + moduleName + "/datasources");
		files.forEach(function(tab){
			if(tab.substring(0, 1) != "_" && tab.endsWith(".js")){
				var Type = require(__dirname + "/../" + moduleName + "/datasources/" + tab);
				t.datasources[tab.substring(0, tab.length - 3)] = new Type();
			}
		});
	} catch(e){}
}

DatabaseModule.prototype.onTabelsAdded = function(moduleName){
	/*
	if(fw.config.DatabaseDriver === "mssql")
		DB = require("./drivers/mssql.js")
	else if(fw.config.DatabaseDriver === "mssql_tedious")
		DB = require("./drivers/mssql_tedious.js")
	else
		DB = require("./drivers/sqlite3.js")
	*/

	if(typeof(fw.config.DatabaseDriver) !== "string"){
		console.error("ERROR: No database driver specified")
		throw error("Unable to start database module");
	}


	DB = require("./drivers/" + fw.config.DatabaseDriver);
		
	db = new DB(fw.config);
	db.driver = fw.config.DatabaseDriver;

	for(tabKey in this.datasources)
		if(typeof(this.datasources[tabKey].init) === "function")
			this.datasources[tabKey].init(db);
}
 
DatabaseModule.prototype.init = function(_fw, onFinished){
	fw = _fw;
	onFinished.call(this);
}
module.exports = DatabaseModule;
