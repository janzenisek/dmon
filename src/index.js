var fs          = require('fs'),
    os          = require('os'),
    http        = require('http'),
    express     = require('express'),
    exphbs      = require('express-handlebars'),
    sass        = require('node-sass-middleware'),
    //redirect    = require('redirect')('monitor.herokuapp.com'),
    socketio    = require('socket.io');

var router = express.Router();
var app = express();
var server = http.createServer(app);
// var io = socketio.listen(server);
var io = socketio(server);

const port = 3000;
const defaultRoute = '/monitor/*';
//const defaultRoute = '/monitor/';

var env = process.env.NODE_ENV || 'development';
// development only
if ('development' == env) {
    console.log("Server is starting in development environment.");
}
// production only
if ('production' == env) {
    console.log("Server is starting in production environment.");
}


var hbs = exphbs.create({
    helpers: {
        foo: function () { return 'FOO!'; },
        bar: function () { return 'BAR!'; }
    },
    extname: '.hbs',
    defaultLayout: 'main'
});

//app.use(redirect);
app.use('/', router);
app.set('views', __dirname+'/views');
//app.engine('.hbs', exphbs({extname: '.hbs', defaultLayout: 'main', layoutsDir: 'views/layouts/', partialsDir: 'views/partials/'}));
app.engine('.hbs', hbs.engine);
app.set('view engine', '.hbs');
app.use(sass({
    src: __dirname + '/sass',
    dest: __dirname + '/public/css',
    prefix: '/css',
    debug: true
}));

//app.use(express.bodyParser()); // ???
//app.use(express.methodOverride()); // ???



// route middleware that will happen on every request
router.use(function(req, res, next) {
    // log each request to the console
    console.log(req.method, req.url);
    // continue doing what we were doing and go to the route
    next(); 
});

router.get('/monitor/:topics', function(req, res, next) {
    // ignore request for favicon
    var ignore = false;
    if (req.params.id === 'favicon.ico') ignore = true;

    //var _mode = req.params.mode;
    var _mode = "monitor";
    var _topics = req.params.topics.split('+');    

    if(!ignore) {
        res.render('monitor', {
            mode: _mode,
            topics: _topics,
            showTitle: true
    });
    } else {
        console.log(ignore);
    }
});

router.get('/monitor/vin/:topics', function(req, res, next) {
    // ignore request for favicon
    var ignore = false;
    if (req.params.id === 'favicon.ico') ignore = true;

    //var _mode = req.params.mode;
    var _mode = "monitor-vin";
    var _topics = req.params.topics.split('+');

    if(!ignore) {
        res.render('monitor-vin', {
            mode: _mode,
            topics: _topics,
            showTitle: true
    });
    } else {
        console.log(ignore);
    }
});

router.get('/monitor/dtw/:topics', function(req, res, next) {
    // ignore request for favicon
    var ignore = false;
    if (req.params.id === 'favicon.ico') ignore = true;

    //var _mode = req.params.mode;
    var _mode = "monitor-dtwdashboard";    
    var _topics = req.params.topics.split('+');

    if(!ignore) {
        res.render('monitor-dtwdashboard', {
            mode: _mode,
            topics: _topics,
            showTitle: true
    });
    } else {
        console.log(ignore);
    }
});

router.get('/monitor/dtw/', function(req, res, next) {
    // ignore request for favicon
    var ignore = false;
    if (req.params.id === 'favicon.ico') ignore = true;
    var _mode = "monitor-dtwdashboard";

    if(!ignore) {
        res.render('monitor-dtwdashboard', {
            mode: _mode,
            topics: "",
            showTitle: true
    });
    } else {
        console.log(ignore);
    }
});


router.get('/', function(req, res) {
    console.log("Received url without valid alias - performing redirection");
    res.redirect(307, defaultRoute);
});

app.use(express.static(__dirname+'/public'));

server.listen(process.env.PORT || port, function() {
    console.log(`Server is now running on ${os.hostname()}:${port}`);
});