function OSSet(key, value, saveForAll){
	request({module: "database", action: "custom", table: "ObjectStorage", custom: {action: "set", key: key, value: value, saveForAll: saveForAll === true ? true : false}}, function(ret){
		return true;
	});
}

function OSSetAll(key, value){
	OSSet(key, value, true)
}

function OSGet(key, getForAll){
	request({module: "database", action: "custom", table: "ObjectStorage", custom: {action: "get", key: key, getForAll: getForAll === true ? true : false}}, function(ret){
		return true;
	});
	
}

function OSGetAll(key){
	OSGet(key, true);
}