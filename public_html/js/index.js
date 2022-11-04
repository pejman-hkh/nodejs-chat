if ('serviceWorker' in navigator) {
   navigator.serviceWorker.register("/serviceworker.js");
}

route.get('/register', function( data ) {
  return `
    <div class="row">
    <div class="col-md-6 m-auto">    
  <h1>Register</h1>
  <form action="/register" method="post" id="register">
  <div class="form-floating mb-2">
  <input type="text" class="form-control" id="username" name="username">
  <label for="username">Name</label>
  </div>      

  <div class="form-floating mb-2">
  <input type="text" class="form-control" id="password" name="password">
  <label for="password">Password</label>
  </div>
 
  <button type="submit" class="btn btn-primary">Register</button>
</form>
</div>
</div>
`;

});

let chat;
let chats = [];

route.get('/chat', chat = function( data ) {
  user = data[2];
  let users = data[3];
  let listh = '';
  for( let k in users ) {
    let v = users[k];
    let name = v.username;

    if( v.id == user.id )
      name = 'Saved Messages';

    listh += `<li class="list-group-item" id="user-`+v.id+`"><a href="@`+v.username+`">`+name+` <span class="badge bg-secondary float-end">0</span></a></li>`;
  }

  this.setHtml(`
    <h3>`+user.username+` welcome</h3>
    <div class="row">
    <div class="col-md-4">
    <ul style="padding-left:0"  class="list-group" id="users">
    `+listh+`
    </ul>

    </div>
  
    <div class="col-md-8">
      <div id="chat-card">
        <div id="chat">
          <div>Select a chat to start messaging</div>
        </div>
      </div>
    
      <form id="sendForm" class="d-none">
    
        <div class="form-floating">
          <input type="text" class="form-control" id="text">
          <label for="text">Message</label>
          <span id="emoji-p">😀</span>

        <div id="emoji" class="d-none">
        <div></div>
        </div>
        </div>

    
      </form>
      <br />

      <center>
      <a href="/register">Register</a> / 
      <a href="/login">Login</a>
      </center>
    </div>
    </div>
    `);

  let eh = '';
  let arremoj = emojies.split("\n");
  for( let k in arremoj ) {
    let v = arremoj[k];
    console.lo
    eh += '<span class="emoji">'+v+'</span>';
  }
  
  document.querySelectorAll('#emoji div').html( eh );
  document.querySelectorAll('#emoji span').click(function() {
      document.getElementById('text').value += this.innerHTML;
      document.getElementById('text').focus();
  });  

  document.addEventListener("click", function (event) {

    if( event.target != document.getElementById('emoji-p') && event.target != document.getElementById('emoji') && ! event.target.classList.contains('emoji') )
      $("#emoji").addClass('d-none');

  });

  document.querySelectorAll('#emoji-p').click(function() {
    $("#emoji").toggleClass('d-none');
  });

  let ws = new WebSocket("wss://localhost:8081");
  
  ws.onopen = (event) => {
    ws.send( JSON.stringify ({ type: "open", id : user.id, login : user.login, text : '', date: Date.now(), touser : toUser.username }) );
  };


  ws.onmessage = (event ) => {
    let data = JSON.parse( event.data );
    console.log( data );
    if( data.type == "seen" ) {
      
    }

    chats.push(data);

    if( data.userid == toUser.id || data.userid == user.id ) {
      showChat(data);
      //console.log(data);

      if( data.userid == toUser.id ) {
        ws.send( JSON.stringify ({ type: "seen", date: Date.now(), touser : toUser.username }) );
      }

    } else {
      let val = parseInt( document.querySelectorAll('#user-'+data.userid+' .badge')[0].innerHTML );
      document.querySelectorAll('#user-'+data.userid+' .badge')[0].innerHTML = val + 1 ;
    }
  }

  setInterval(function() {
     if ( ws.readyState === 3 ) {
          let tws = ws;
          ws.close();
          
          ws = new WebSocket("wss://localhost:8081");
          ws.onopen = tws.onopen;
          ws.onmessage = tws.onmessage;
    }
  }, 1000 );

  document.getElementById('sendForm').addEventListener("submit", async function( e ) {
    let send = { type: "msg", touser : toUser.username/*, id : user.id, login : user.login*/, text : document.getElementById('text').value, date: Date.now() };
    //console.log(send);

     if ( ws.readyState === 3 ) {
          let tws = ws;
          ws.close();
          
          ws = new WebSocket("wss://localhost:8081");
          ws.onopen = tws.onopen;
          ws.onmessage = tws.onmessage;
          let it = setInterval(function() {
            if( ws.readyState == 1 ) {
              ws.send( JSON.stringify ( send ) );
              clearInterval(it);
            }
          }, 250);
     
     } else {
        ws.send( JSON.stringify ( send ) );
     }

  
    document.getElementById('text').value = '';
    var od = document.getElementById("chat");
    od.scrollTop = od.scrollHeight;
    document.getElementById('text').focus();

    e.preventDefault();

  });

});

route.get('/', chat);

route.get('/login', function() {
  return `
    <div class="row">
    <div class="col-md-6 m-auto">  
  <h1>Login</h1>
  <form method="post" action="/login" id="register">
  <div class="form-floating mb-2">
  <input type="text" class="form-control" id="username" name="username">
  <label for="username">Name</label>
  </div>      

  <div class="form-floating mb-2">
  <input type="text" class="form-control" id="password" name="password">
  <label for="password">Password</label>
  </div>
 
  <button type="submit" class="btn btn-primary">Login</button>
</form>
  </div></div>
`;
});

route.dispatch();

window.addEventListener('locationchange', function() {
  route.dispatch();
});
