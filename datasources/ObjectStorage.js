function ObjectStorage(){
}

ObjectStorage.prototype.handleCustom = function(db, custom, callback){
	
	if(typeof(custom) != "object" || typeof(custom.action) !== "string" || typeof(custom.Key !== "string")){
		callback({error: "Unknown request"});
		return;
	}
	
	var userId = this.session.userId;


	switch(custom.action){
		case "set" :
			if(custom.saveForAll === true && this.args.isFromClient === false)
				userId = undefined;
			db.query("DECLARE @key nvarchar(100) = ?; DELCARE @value nvarchar(max) = ?; DECLARE @userId int = ?;"
					+ " IF EXISTS (SELECT [Key] FROM ObjectStorage WHERE [Key] = @key AND (UserId IS NULL OR UserId = @userId)) "
					+ " INSERT INTO ObjectStorage([Key], Value, UserId) VALUES(@key, @value, @userId)"
					+ " ELSE "
					+ " UPDATE ObjectStorage SET Value = @value WHERE [Key] = @key AND (UserId IS NULL OR UserId = @userId)", 
						[custom.key, custom.value, userId], function(res){
				callback({success:true});
			});
			break;
		case "get" :
			if(custom.getForAll === true && this.args.isFromClient === false)
				userId = undefined;
			db.query("SELECT Value FROM ObjectStorage WHERE [Key] = ? AND (UserId IS NULL OR UserId = ?)", 
						[custom.key, userId], function(res){
				if(res.length > 0)
					callback({success:true, Value: res[0].Value});
				else
					callback({success:false, error: "Unknown key or no access"});
			});
			break;
	}
}

exports = module.exports = ObjectStorage;