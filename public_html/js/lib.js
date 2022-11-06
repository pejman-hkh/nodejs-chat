var ajax = {};
ajax.x = function () {
    if (typeof XMLHttpRequest !== 'undefined') {
        return new XMLHttpRequest();
    }
    var versions = [
        "MSXML2.XmlHttp.6.0",
        "MSXML2.XmlHttp.5.0",
        "MSXML2.XmlHttp.4.0",
        "MSXML2.XmlHttp.3.0",
        "MSXML2.XmlHttp.2.0",
        "Microsoft.XmlHttp"
    ];

    var xhr;
    for (var i = 0; i < versions.length; i++) {
        try {
            xhr = new ActiveXObject(versions[i]);
            break;
        } catch (e) {
        }
    }
    return xhr;
};

ajax.send = function (url, callback, method, data, async) {
    if (async === undefined) {
        async = true;
    }
    var x = ajax.x();
    x.open(method, url, async);
    x.onreadystatechange = function () {
        if (x.readyState == 4) {
            callback(x.responseText)
        }
    };
    if (method == 'POST') {
        x.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    }
    x.send(data)
};

ajax.get = function (url, data, callback, async) {
    var query = [];
    for (var key in data) {
        query.push(encodeURIComponent(key) + '=' + encodeURIComponent(data[key]));
    }
    ajax.send(url + (query.length ? '?' + query.join('&') : ''), callback, 'GET', null, async)
};

ajax.post = function (url, data, callback, async) {
    if( typeof data == 'object' ) {
        var query = [];
        for (var key in data) {
            query.push(encodeURIComponent(key) + '=' + encodeURIComponent(data[key]));
        }
        data = query.join('&');
    }

    ajax.send(url, callback, 'POST', data , async)
};



var route = {
  routes : [],
  dispatch : function() {
    let p1 = window.location.pathname.replace(baseUri||'', '');

     console.log(p1);
     console.log( this.routes );
    for( let k in this.routes ) {
      let v = this.routes[k];
      if( v[0] == p1 ) {
        let cb = v[1];
        let that = this;
        ajax.post(baseUri+p1, {}, function( data ) {
          //console.log(data);
            try {
                data = JSON.parse(data);
            } catch( e ) {

            }

          let ret = cb.call( that, data  );
          if( ret )
            document.getElementById('main').innerHTML = ret;
        }, 0);
      }
    }
  },
  get : function( path, cb ) {
    this.routes.push([ path, cb ]);
  },
  setHtml : function( html ) {
    document.getElementById('main').innerHTML = html;
  }
};

history.pushState = ( f => function pushState(){
    var ret = f.apply(this, arguments);
    window.dispatchEvent(new Event('pushstate'));
    window.dispatchEvent(new Event('locationchange'));
    return ret;
})(history.pushState);

history.replaceState = ( f => function replaceState(){
    var ret = f.apply(this, arguments);
    window.dispatchEvent(new Event('replacestate'));
    window.dispatchEvent(new Event('locationchange'));
    return ret;
})(history.replaceState);

window.addEventListener('popstate',()=>{
    window.dispatchEvent(new Event('locationchange'))
});

function showChat( v ) {

    let dir = 'rtl';

    if( v.text.substr(0,1).match(/^[A-Za-z0-9]*$/) ) {
        dir = 'ltr';
    }

    let color = '';
    //console.log(v);
    let boxDir = 'left';


    if( v.userid == user.id ) {
        color = 'bg-green';
        boxDir = 'right';
        from = user.username;
    } else {
        from = toUser.username;
    }
    //from = '';

    var date = new Date(v.date);
    var hours = date.getHours()+":"+date.getMinutes();


    document.getElementById('chat').innerHTML += '<div class="chat-text '+boxDir+'"><div class="card chat-p '+dir+' '+color+'"><div class="card-body">'+v.text+'<br /><span class="time">'+hours+'</span></div></div></div>';
    var od = document.getElementById("chat");
    od.scrollTop = od.scrollHeight;
    //document.getElementById('text').focus();    
}

document.addEventListener("click", function (event) {

    if(event.target.tagName == 'LI' ) {
       document.querySelectorAll(event.target).find("a").each(function() {
        this.dispatchEvent(new Event("click", { 'bubbles': true }));
       }); 
    }

    if(event.target.tagName == 'A' ) {
        let href = event.target.getAttribute('href');
        if( href.substr(0,1) == '@' ) {
            document.querySelectorAll('#sendForm').removeClass('d-none');
            document.querySelectorAll(event.target).find('.badge').html('0');

            document.getElementById('chat').innerHTML = '';
            document.querySelectorAll('.list-group-item').removeClass('active');

            event.target.parentElement.classList.add('active');
            ajax.post('/chat/list', { touser : href.substr(1) }, function( data ) {
                data = JSON.parse(data);
                toUser.username = data[3].username;
                toUser.id = data[3].id;
                data = data[2].reverse();
                for( let x in data ) {
                    let v = data[x];
                    showChat(v);
                }
            });
        } else {
            history.pushState({}, null, href);
        }

        event.preventDefault();
    }
});


document.addEventListener("submit", function( event ) {

    if( event.target.tagName == "FORM" ) {
        if( ! event.target.getAttribute('action') ) return;
        
        var data = new URLSearchParams(new FormData(event.target)).toString();

        ajax.post( event.target.getAttribute('action')+'?ajax', data, function( data ) {
        
            data = JSON.parse(data);
            if( data[2] && data[2].redirect ) {
                history.pushState({}, null, data[2].redirect );
            }

            alert( data[1] );

        });

        event.preventDefault();
    }
})
