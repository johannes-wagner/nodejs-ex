//  OpenShift sample Node application
var express = require("express"),
    fs      = require("fs"),
    app     = express(),
    eps     = require("ejs"),
    morgan  = require("morgan"),
	cheerio = require("cheerio"),
	request = require("request");
    
Object.assign=require("object-assign")

app.engine("html", require("ejs").renderFile);
app.use(morgan("combined"))

var port = process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 8080,
    ip   = process.env.IP   || process.env.OPENSHIFT_NODEJS_IP || "0.0.0.0",
    mongoURL = process.env.OPENSHIFT_MONGODB_DB_URL || process.env.MONGO_URL,
    mongoURLLabel = "";

if (mongoURL == null && process.env.DATABASE_SERVICE_NAME) {
  var mongoServiceName = process.env.DATABASE_SERVICE_NAME.toUpperCase(),
      mongoHost = process.env[mongoServiceName + "_SERVICE_HOST"],
      mongoPort = process.env[mongoServiceName + "_SERVICE_PORT"],
      mongoDatabase = process.env[mongoServiceName + "_DATABASE"],
      mongoPassword = process.env[mongoServiceName + "_PASSWORD"]
      mongoUser = process.env[mongoServiceName + "_USER"];

  if (mongoHost && mongoPort && mongoDatabase) {
    mongoURLLabel = mongoURL = "mongodb://";
    if (mongoUser && mongoPassword) {
      mongoURL += mongoUser + ":" + mongoPassword + "@";
    }
    // Provide UI label that excludes user id and pw
    mongoURLLabel += mongoHost + ":" + mongoPort + "/" + mongoDatabase;
    mongoURL += mongoHost + ":" +  mongoPort + "/" + mongoDatabase;

  }
}
var db = null,
    dbDetails = new Object();

var initDb = function(callback) {
  if (mongoURL == null) return;

  var mongodb = require("mongodb");
  if (mongodb == null) return;

  mongodb.connect(mongoURL, function(err, conn) {
    if (err) {
      callback(err);
      return;
    }

    db = conn;
    dbDetails.databaseName = db.databaseName;
    dbDetails.url = mongoURLLabel;
    dbDetails.type = "MongoDB";

    console.log("Connected to MongoDB at: %s", mongoURL);
  });
};

app.get("/", function (req, res) {
  // try to initialize the db on every request if it"s not already
  // initialized.
  if (!db) {
    initDb(function(err){});
  }
  if (db) {
    var col = db.collection("counts");
    // Create a document with request IP and current time of request
    col.insert({ip: req.ip, date: Date.now()});
    col.count(function(err, count){
      res.render("index.html", { pageCountMessage : count, dbInfo: dbDetails });
    });
  } else {
    res.render("index.html", { pageCountMessage : null});
  }
});

app.get("/pagecount", function (req, res) {
  // try to initialize the db on every request if it"s not already
  // initialized.
  if (!db) {
    initDb(function(err){});
  }
  if (db) {
    db.collection("counts").count(function(err, count ){
      res.send("{ pageCount: " + count + "}");
    });
  } else {
    res.send("{ pageCount: -1 }");
  }
});

app.get("/scrape/:player", function(req, res) {
	player = req.params.player || "_jabba_"
	url = "http://torch.myftb.de/player/"+player
	request(url, function(error, response, html){

        // First we"ll check to make sure no errors occurred when making the request

        if(!error){
            // Next, we"ll utilize the cheerio library on the returned html which will essentially give us jQuery functionality

            var $ = cheerio.load(html);
			/*$("div.col-lg-9").each(function(i, element){
				var header = $(this).find("div.panel-heading").text();
				if(header.startsWith("Spieler Steckbrief")){
					var children = $(this).find("ul").children();
					res.send(children);
				}
			});*/
			
			var user = {}; 
			$("div.col-lg-9").children().find("ul").first().find("li").children().each(function(i, elem){ 
				console.log(elem);
				var date;
				switch(elem.next.data){
					case("Mitglied seit"): date = elem.children[0].data.split("."); user.memberSince = new Date(date[2],date[1]-1,date[0]);break;
					case("Zuletzt online"):date = elem.children[0].data.split("."); user.lastLogin = new Date(date[2],date[1]-1,date[0]);break;
					case("Zuletzt gevotet"):user.lastVote = new Date(elem.children[0].data);break;
					case("Anzahl der Votes"):user.voteCount = elem.children[0].data*1;break;
					case("Anzahl der Logins"):user.loginCount = elem.children[0].data*1;break;
					case("Gesamt Spielzeit"):var ontime = elem.children[0].data.split(":"); user.ontime = (60*ontime[0]+ontime[1])*60+ontime[2];
					case("Spieler gebannt"):user.banned = elem.children[0].data*1;break;
			}});
			//user[elem.nextSibling.data] = elem.innerText;}); 
			console.log(user);
			res.send(user);
		}else{
			console.log(error);
			res.send(error);
		}
	});
});

// error handling
app.use(function(err, req, res, next){
  console.error(err.stack);
  res.status(500).send("Something bad happened!");
});

initDb(function(err){
  console.log("Error connecting to Mongo. Message:\n"+err);
});



app.listen(port, ip);
console.log("Server running on http://%s:%s", ip, port);

module.exports = app ;
