import { createServer } from 'https';
import fs, { readFileSync } from 'fs';
import WebSocket, { WebSocketServer } from 'ws';
import mysql from 'mysql';
import util from 'util';
import qs from 'querystring';
import crypto from 'crypto';
import config from './config.js';

var stringHash = '^QFY@#$XA712SU&&@#!Jsxcayii^^*3416';
var indexHtml = readFileSync('public_html/index.html').toString();

const server = createServer({
  cert: readFileSync( config.ssl.cert ),
  key: readFileSync( config.ssl.key )
});
const wss = new WebSocketServer({ server });

var connection;
var query;

function mysqlInit() {

  connection = mysql.createConnection(config.db);
   
  connection.connect();
  query = util.promisify(connection.query).bind(connection);
}

function mysqlEnd() {
  connection.end();
}

//let connection1 = mysql.createConnection(config.db);
//connection1.connect();

config.db.connectionLimit = 100;
var pool  = mysql.createPool(config.db);
let query1 = util.promisify(pool.query).bind(pool);


//mysqlInit();

var clients1 = {};

wss.on('connection', function(ws) {

  ws.on('message', function(data, isBinary) {
 
    let jdata = JSON.parse( data );
 
    
    if( jdata.type == "seen" ) {

      let touser = query1("select id, username from users where username = ? ", [ jdata.touser ] );
      touser.then(function( touser ) {

        if( touser[0] ) {
          let up = query1("update chats set seen = 1 where userid = ? and touserid = ? and seen = 0 ", [ touser[0].id, ws.id ] );
        }

        let fws = clients1[touser[0].id];

        //send to friend
        if( fws )
          fws.send(JSON.stringify({type : 'seen', userid : ws.id }), { binary: isBinary});
      });

    }

    if( jdata.type == "open" ) {

      let user = query1("select id,username,login from users where id = ? ", [ jdata.id ] );
  
      user.then(function( user ) {
        if( jdata.login != user[0].login ) {
          ws.send(JSON.stringify({text: 'Login Faild'}) );
        } else {
          ws.id = user[0].id;
          clients1[ user[0].id ] = ws;
        }
      });

    }

    if( jdata.type == "msg" && jdata.text ) {
      
      let toUser = query1("select id from users where username = ? ", [ jdata.touser ] );

      toUser.then(function( toUser ) {
        let touserid = (toUser[0]?toUser[0].id:0);
        //console.log( ws.id );

        let userid = ws.id;

        if( userid ) {
          let q1 = query1('INSERT INTO chats SET ?', { userid : userid, text : jdata.text, date : Date.now(), type : 1, touserid : touserid });
        }

        //q1.then(function() {
          let sendMsg = JSON.stringify({type : 'msg', text : jdata.text, userid : userid, date : Date.now() });

          //send to self
          ws.send( sendMsg, { binary: isBinary} );
          if( toUser[0] && toUser[0].id != userid ) {
            let fws = clients1[toUser[0].id];

            //send to friend
            if( fws )
            fws.send(sendMsg, { binary: isBinary});
          }

        //});
      });


    }

    //mysqlEnd();
  });

  ws.on('close', function() {

   for( let k in clients1 ) {
      let v = clients1[k];
      if( v == ws ) {
        clients1[k] = 0;
      }
    }
  });

});


var route =  {
  headers : [],
  routes : [],
  middles : [],
  methods : ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],

  parseCookies : function (cookieHeader) {
      const list = {};
      if( ! cookieHeader ) return list;

      cookieHeader.split(`;`).forEach(function(cookie) {
          let [ name, ...rest] = cookie.split(`=`);
          name = name.trim();
          if (!name) return;
          const value = rest.join(`=`).trim();
          if (!value) return;
          list[name] = decodeURIComponent(value);
      });

      return list;
  },
  setMiddle : function( cb ) {
    this.middles.push(cb);
  },
  dispatch : async function( req, res, body ) {
    for(let k in this.routes ) {
      let v = this.routes[k];
      let sp = req.url.split('?');
      let qs1 = sp[1];
      let url = sp[0];

      if( qs1 )
        req.get = qs.parse('&'+qs1);
      else
        req.get = {};

      //console.log( qs1 );

      if( v[0] == url && req.method == this.methods[ v[2]-1 ] ) {
        let cb = v[1];
        req.cookies = this.parseCookies( req.headers.cookie );
        this.cookies = req.cookies;
        this.req = req;
        this.res = res;
        this.path = url;
        let checkMiddle;
        for( let k1 in this.middles ) {
          let v1 = this.middles[k1];

          checkMiddle = await v1.call(this, req, res );
          if( !checkMiddle ) {
            //this.status = 403;
          }
        }
        
        req.post = qs.parse(body);

        let ret = checkMiddle? await cb.call(this, req,res ):'';

        return [ this.status?this.status:200, ret, this.headers ];

      }
    }

    return [ 404, '404 page not found', this.headers ];
  },
  post : function( path, cb ) {
    this.routes.push([ path, cb, 2 ]);
  },
  get : function( path, cb ) {
    this.routes.push([ path, cb, 1 ]);
  },
  setCookie : function( name, value, exdays, domain, path ) {

    let exdate = new Date()
    exdate.setDate(exdate.getDate() + exdays);
    let cookieText = name+'='+value+';expires='+exdate.toUTCString()+';'
    if (domain)
      cookieText += 'domain='+domain+';'
    if (path)
      cookieText += 'path='+path+';'

    this.headers.push({
      "Set-Cookie": cookieText,
    });
  },
  setHeader( header ) {
    this.headers.push( header );
  },
  setStatus( status ) {
    this.status = status;
  }
}


function serveStatic( pathname, res ) {
  let sp = pathname.split('.');
  const ext = '.'+sp[ sp.length - 1];

  // maps file extension to MIME typere
  const map = {
    '.ico': 'image/x-icon',
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword'
  };

  fs.exists(pathname, function (exist) {
    if(!exist) {
      // if the file is not found, return 404
      res.statusCode = 404;
      res.end(`File ${pathname} not found!`);
      return;
    }

    // if is a directory search for index file matching the extension
    if (fs.statSync(pathname).isDirectory()) pathname += '/index' + ext;

    // read file from file system
    fs.readFile(pathname, function(err, data){
      if(err){
        res.statusCode = 500;
        res.end(`Error getting the file: ${err}.`);
      } else {
        // if the file is found, set Content-type and send data
        res.setHeader('Content-type', map[ext] || 'text/html' );
        res.end(data);
      }
    });
  });
}

createServer({
  cert: readFileSync( config.ssl.cert ),
  key: readFileSync( config.ssl.key )
}, function (req, res) {

  const { headers, method, url } = req;
  let body = [];
  req.on('error', (err) => {
    console.error(err);
  }).on('data', (chunk) => {
    body.push(chunk);
  }).on('end', async () => {
    body = Buffer.concat(body).toString();

    if( req.url == '/' ) {
      req.url = '/index';
    }

    let path = 'public_html'+req.url;

    if (fs.existsSync( path )) {
      serveStatic( path, res );
/*      res.writeHead(200);
      res.end( readFileSync( path ) );*/
    } else {
      let ret = await route.dispatch( req, res, body );
      //console.log( ret );

      //if( ret ) {

        let hs = {};
        for( let k1 in ret[2] ) {
          let v1 = ret[2][k1];
          for( let k2 in v1 ) {
            let v2 = v1[k2];
            hs[k2] = v2;
          }
        }

        res.writeHead( ret[0], hs );
        route.headers = [];

        if( typeof ret[1] == "object" ) {
          ret[1] = JSON.stringify(ret[1]);
        }

        res.end( ret[1] );
   
    }



  });
}).listen(8000);

route.setMiddle( async function( req, res ) {
  if( this.path == '/login' || this.path == '/register') {
    return true;
  }

  if( ! this.cookies.login ) {
  
    if( this.path !== '/login' ) {
      this.setStatus(302);
      this.setHeader( {
        'Location': '/login'
      });
      return false;
    } else {
      return true;
    }

    
  } else {
    try {
      
      let login = JSON.parse( this.cookies.login );
      let user = await query("select * from users where id = ? ", [ login[0] ] );
      if(user[0].login != login[1] ) {
        return false;
      }

    } catch( e ) {
    }
  }

  return true;
});


route.post('/login', async function( req, res ) {

  if( typeof req.get.ajax !== 'undefined' ) {
    mysqlInit();
    let user = await query("select * from users where username = ? ", [ req.post.username ] );
    mysqlEnd();
 
    if( ! user[0] || ! user[0].id ) {
      return [0,'User not exists !'];
    }

    let pass = crypto.createHash('md5').update(req.post.password).digest('hex');
    if( user[0].password == pass ) {
      this.setCookie('login', JSON.stringify([ user[0].id, user[0].login ]), 365 );
      return [ 1, 'Logined successfully', { redirect : '/' } ];
    }
    return [0, 'Login failed !'];
  }

  return '';
});

route.get("/login", function( req, res ) {

  return indexHtml;
});


route.get("/register", function( req, res ) {

  return indexHtml;
});

route.post("/register", async function( req, res ) {
  //console.log( req.get );

  if( typeof req.get.ajax !== 'undefined' ) {
      mysqlInit();

      if( req.post.username == '' || req.post.username.length < 3 ) {
        return [0, 'Wrong username !'];
      }

      if( req.post.password == '' || req.post.password.length < 6 ) {
        return [0, 'Wrong password !'];
      }

      let user = await query("select * from users where username = ? ", [ req.post.username ] );
   
      if( user[0] && user[0].id ) {
        return [0,'User exists !'];
      }

      let pass = crypto.createHash('md5').update(req.post.password).digest('hex');

      let login = crypto.createHash('md5').update(pass+stringHash+req.post.username).digest('hex');
      let nuser = await query("insert into users set ?", { username : req.post.username, password : pass, date : Date.now(), login : login });

      mysqlEnd();

      this.setCookie('login', JSON.stringify([ nuser.insertId, login ]), 365 );
      return [ 1, 'User created', { redirect : '/' } ];
  }
 
});

route.get("/chat", function( req, res ) {
  return indexHtml;
});

route.post("/chat/list", async function( req, res ) {

  mysqlInit();


  let login = JSON.parse( req.cookies.login );
  let user = await query("select id from users where id = ? and login = ? ", [ login[0], login[1] ] );
  let touser = await query("select id, username from users where username = ? ", [ req.post.touser ] );

  await query("update chats set seen = 1 where userid = ? and touserid = ? and seen = 0 ", [ touser[0].id, user[0].id ] );

  if( user[0].id == touser[0].id ) {
    var rs = await query('select * from chats where (userid = ? and touserid = ?) order by id desc limit 0, 20', [ user[0].id, user[0].id ]);
    
  } else {
    var rs = await query('select * from chats where (userid = ? or touserid = ?) and ( userid = ? or touserid = ? ) order by id desc limit 0, 20', [ user[0].id, user[0].id, touser[0].id, touser[0].id ]);
  }


  mysqlEnd();

  return [ 1, 'Ok', rs, touser[0] ];

});

route.post("/chat", function() {
  return {};
});

route.get("/index", function( req, res ) {
  return indexHtml;
});

route.post("/index", async function( req, res ) {
  mysqlInit();

  let login = JSON.parse( req.cookies.login );
  let user = await query("select id,username,login from users where id = ? and login = ? ", [ login[0], login[1] ] );

  let users = await query("select id,username,login from users limit 0,100 " );


  if( user[0] && login[1] == user[0].login ) {
    return [ 1, 'Ok', user[0], users ];
  }
  mysqlEnd();

  return [0, 'Fail', {redirect : '/register'}];

});


server.listen(8002);