//document.addEventListener("DOMContentLoaded", function(e) {
$(document).ready(function(){
    // Create a client instance
    var wsbroker = "127.0.0.1";
    var wsport = 5000; // // if using RabbitMQ, use port 15675 and path "/ws" // 5000
    var wspath = "/mqtt"; // ws or mqtt
    var connStr = wsbroker + ":" + wsport + wspath;
    var clientid = "myclientid_" + parseInt(Math.random() * 1000, 10);    
    client = new Paho.MQTT.Client(wsbroker, wsport, wspath, clientid); // if using RabbitMQ, use port 15675 and path "/ws"
    var initiated = false;
    var group = "";
    var curMaxRank = -99;
    var sources = []; // determines order of graphs and charts    
    var series = {};
    var dates = {};
    var charts = {};
    var counts = {};
    var bufferSize = 500; // 150

    var initialDelay = 0;
    var changeStateTime = 0;
    var changeStateDelay = 0;

    // set callback handlers
    client.onConnectionLost = onConnectionLost;
    client.onMessageArrived = onMessageArrived;

    // set options
    var options = getOptions();

    //mqttVersion: 4, // former: 4

    if(location.protocol == "https:") {
        options.useSSL = true;
    }

    function setupClient() {
        client = new Paho.MQTT.Client(wsbroker, wsport, wspath, clientid); // if using RabbitMQ, use port 15675 and path "/ws"
        client.onConnectionLost = onConnectionLost;
        client.onMessageArrived = onMessageArrived;
    }

    function prepare() {   
        $("#charts").html("");     
        initiated = false;
        sources = [];   
        series = {};
        dates = {};
        charts = {};
        counts = {};
    }

    function getOptions() {
        return {
            timeout: 0,
            keepAliveInterval: 0,
            cleanSession: true,             
            onSuccess: onConnect,
            onFailure: onFailure
            // ,hosts:
            // ,ports:
            // ,mqttVersion:
        };
    }

    // called when the client connects
    function onConnect() {
        prepare();
        var topicStr = "";
        var topicArr = topics.split(',');
        for(var t in topicArr) {
            if(topicArr[t].slice(-2) == "**") {
                sources.push(topicArr[t].substring(0, topicArr[t].length-2));                
            } else if(topicArr[t].slice(-1) == "*") {
                sources.push(topicArr[t].substring(0, topicArr[t].length-1));
            } else {
                sources.push(topicArr[t]);
            }

            topicArr[t] = topicArr[t].replace("**", "#");
            topicArr[t] = topicArr[t].split('-').join('/');
            topicStr += "<br/>" + topicArr[t];
        }
        changeState("Connection established", changeStateTime, changeStateDelay, function() {
            changeState("Wating for messages from" + topicStr, changeStateTime, changeStateDelay, function() {
                for(var t in topicArr) {
                    client.subscribe(topicArr[t]);
                    console.log("subscribe to: " + topicArr[t]);
                }
            });
        });

        // message = new Paho.MQTT.Message("4.2");
        // message.destinationName = "sensors/temp";
        // client.send(message);
    }

    function onFailure(message) {
        // console.log("onFailure: " + message.errorCode + " -- " + message.errorMessage);
        console.log("onFailure: " + message.errorMessage);
        changeState("Connection failure, initiating retry", changeStateTime, changeStateDelay, function() {
            changeState("Establishing connection to " + connStr, changeStateTime, changeStateDelay, null);            
            setupClient();
            options = getOptions();
            client.connect(options);
        });
    }

    // called when the client loses its connection
    function onConnectionLost(responseObject) {
        if (responseObject.errorCode !== 0) {
            console.log("onConnectionLost: " + responseObject.errorMessage);
            changeState("Connection lost, initiating retry", changeStateTime, changeStateDelay, function() {
                changeState("Establishing connection to " + connStr, changeStateTime, changeStateDelay, null);            
                setupClient();
                options = getOptions();
                client.connect(options);                
            });
        }
    }

    // called when a message arrives
    function onMessageArrived(message) {
        if(!initiated) {
            initiated = true;
            fadeLoader();
            //updateCharts();
        }
        
        var source = message.destinationName.split('/').join('-');
        var _tmpObj = JSON.parse(message.payloadString);
        var tmpObj = _tmpObj.Content;
        // console.log("payload = " + JSON.stringify(tmpObj));        
        
        if(Object.prototype.toString.call(tmpObj) === '[object Array]') {
            
            for(var t in tmpObj) {
                var item = parseItem(tmpObj[t], source);
                processItem(item);                
            }
        } else {
            var item = parseItem(tmpObj, source);
            processItem(item);
        }
    }

    function parseItem(_item, _source) {
        var item = {};
        // console.log("id = " + _item.id);
        // console.log("source = " + _source);        

        item.id = _item.id;
        item.source = _source;
        item.group = _item.group;
        item.rank = _item.rank;
        item.title = _item.title;
        item._value = _item.value.toFixed(2);
        item.date = moment(_item.timestamp, "YYYY-MM-DD-HH-mm-ss-SSS").toDate();
        item.systemTimestamp = moment(_item.systemTimestamp, "YYYY-MM-DD-HH-mm-ss-SSS").toDate();
        
        if(!charts[item.id]) {
            counts[item.id] = 0;
            item.count = 0;
        } else {
            counts[item.id]++;
            item.count = counts[item.id];
        }


        var gRank = 1;
        for(var s = 0; s < sources.length; s++) {           
            if(item.source.startsWith(sources[s])) {
                gRank = (s+1);
                s += sources.length;                
                
            }       
        }
        item.grank = gRank;
        item["value"+item.grank] = item._value;
        return item;
    }

    function processItem(item) {
        if(group == "") {
            group = item.group;
            curMaxRank = item.rank;
        } else if(group != item.group) {
            $("#charts").html("");
            charts = {};
            group = item.group;
            curMaxRank = item.rank;
        }
        if(!charts[item.id]) {
            series[item.id] = [];
            series[item.id].push(item.source);            

            initChart(item, 1);
            if(curMaxRank > item.rank) {
                var chartSlotsContainer = document.getElementById('charts');
                reorderChildElementsById(chartSlotsContainer);
            } else {
                curMaxRank = item.rank;
            }
        }  else if(!series[item.id].includes(item.source)) {
            series[item.id].push(item.source);
            addGraph(item, series[item.id].length);
        }

        updateChart(item);
    }

    // Chart

    function updateChart(item) {
        var id = item.id;
        var data = charts[id].dataProvider;
        var len = data.length;
        var foundEntry = false;
        var valueAlias = "value"+item.grank;        

        if(series[id].length > 1) {
            // reverse search for date (if already added)
            for(var i = len-1; i >= 0 && !foundEntry; i--) {
                if(data[i].date < item.date) {                    
                    i = 0;
                }
                else if(data[i].date.getTime() == item.date.getTime()) {
                    data[i][valueAlias] = item._value;
                    foundEntry = true;
                    // console.log(data[i][valueAlias]);
                    // console.log(charts[id].dataProvider[i][valueAlias]);
                }
            }
            if(!foundEntry) {
                data.push(item);
            }     
        } else {
            charts[id].dataProvider.push(item);
        }

        // shift or adapt zoom
        if(!foundEntry && charts[id].dataProvider.length >= bufferSize) {
            charts[id].dataProvider.shift();
            
        } else if(!foundEntry) {
            charts[id].zoomEndIndex++;
            if(charts[id].zoomStartIndex != 0) charts[id].zoomStartIndex++;
        }

        // comment if performance is bad
        charts[id].ignoreZoomed = true;
        charts[id].validateData();
    }

    function initChart(item) {
        var rank = item.rank; //+item.grank*1000;

        $("#charts")
        .append(
            '<div id="chartslot_' + rank + '" class="col col-lg-4 col-md-6 col-sm-12">'
            + '<div id="chart-' + item.id + '" class="chart-instance chart-' + Object.keys(charts).length + '"></div>'
            + '</div>');
        
        charts[item.id] = AmCharts.makeChart("chart-" + item.id, {
            "type": "serial",
            "theme": "light",
            "titles": [
                {"text": item.title, "size": 12} // 12
            ],
            "legend": {
                "useGraphSettings": true
            },
            "marginRight": 0,
            "marginLeft": 50,
            "autoMarginOffset": 10,
            "mouseWheelZoomEnabled":true,
            "dataDateFormat": "YYYY-MM-DD hh-mm-ss-fff", //"YYYY-MM-DD hh-mm-ss-fff"
            "valueAxes": [{
                "id": "v1",
                "axisAlpha": 0,
                "position": "left",
                "ignoreAxisWidth":true
            }],
            "balloon": {
                "enabled":false,
                "borderThickness": 1,
                "shadowAlpha": 0
            },
            "graphs": [{
                "id": "g"+item.grank,
                "title": item.title,
                //"lineColor": "#6fa511", //"#BD4920", "#6fa511",
                "balloon":{
                    "drop":true,
                    "adjustBorderColor":false,
                    "color":"#ffffff"
                },
                "fillAlphas": 0.2,
                "bullet": "round",
                "bulletBorderAlpha": 1,
                "bulletColor": "#FFFFFF",
                "bulletSize": 5,
                "hideBulletsCount": bufferSize/4 <= 50 ? bufferSize/4 : 50,
                "lineThickness": 2,
                "title": item.source,
                "useLineColorForBulletBorder": true,
                "valueField": "value"+item.grank,
                "balloonText": "<span style='font-size:14px;'>[[value]]</span>"
            }],
            "chartScrollbar": {
                "graph": "g"+item.grank,
                "oppositeAxis":false,
                "offset":30,
                "scrollbarHeight": 40,
                "backgroundAlpha": 0,
                "selectedBackgroundAlpha": 0.1,
                "selectedBackgroundColor": "#888888",
                "graphFillAlpha": 0,
                "graphLineAlpha": 0.5,
                "selectedGraphFillAlpha": 0,
                "selectedGraphLineAlpha": 1,
                "autoGridCount":true,
                "color":"#AAAAAA",
                "dragIcon": "dragIconRectSmall"
            },
            "chartCursor": {
                "pan": true,
                "valueLineEnabled": true,
                "valueLineBalloonEnabled": true,
                "cursorAlpha":1,
                "cursorColor":"#258cbb",
                "limitToGraph":"g"+item.grank,
                "valueLineAlpha":0.2,
                "valueZoomable":true,
                "categoryBalloonFunction": function(date) {
                    return moment(date).format("HH:mm:ss.SSS");
                }
            },
            // "valueScrollbar":{
            //     "oppositeAxis":true,
            //     "offset":0,
            //     "scrollbarHeight":60,
            //     "dragIcon": "dragIconRectSmall"
            // },
            // "categoryField": "date", // date / count
            // "categoryAxis": {
            //     "parseDates": true, // true
            //     "minPeriod": "fff", // fff
            //     "dashLength": 1,
            //     "position": "bottom",
            //     "minorGridEnabled": true
            // },
            "categoryField": "date", // date / count
            "categoryAxis": {
                "parseDates": true, // true / false
                "minPeriod": "fff", // fff
                "dashLength": 1,
                "position": "bottom",                
                "autoGridCount": false,
                "minorGridEnabled": true,
                "equalSpacing": true,
                // "forceShowField": true,
                // "labelFrequency": 10,
                "labelFunction": function(valueText, date, categoryAxis) {
                    return moment(date).format("HH-mm-ss"); // "YYYY-MM-DD-HH-mm-ss-SSS"
                    // return moment("" + count + "-00-00-00-00-00-000").format("Y"); // "YYYY-MM-DD-HH-mm-ss-SSS"
                    // console.log(count);
                    // categoryAxis.renderer.minGridDistance = 10;

                    // count:
                    // var c = count.category;
                    // if(parseInt(c) % 10 == 0) return "" + c;
                    // else return;
                }
            },
            "dataProvider": [],
            "export": {
                "enabled": false,
                "position": "top-right"
            }
        });
        

        charts[item.id].zoomStartIndex = 0;
        charts[item.id].zoomEndIndex = 0;
        charts[item.id].ignoreZoomed = false;

        charts[item.id].addListener("zoomed", function(event) {
            if(charts[item.id].ignoreZoomed) {
                charts[item.id].ignoreZoomed = false;
                return;
            }
            charts[item.id].zoomStartIndex = event.startIndex;
            charts[item.id].zoomEndIndex = event.endIndex;
        });

        charts[item.id].addListener("dataUpdated", function(event) {
            charts[item.id].zoomToIndexes(charts[item.id].zoomStartIndex, charts[item.id].zoomEndIndex);
        });

        //chart.addListener("rendered", zoomChart());

        // uncomment if performance is bad
        // setInterval(function() {
        //     charts[item.id].ignoreZoomed = true;
        //     charts[item.id].validateData(); 
        // },1500);
    }

    var lineColors = ["#f4e841", "#BD4920", "#6fa511", "#9e42f4"];
    function addGraph(item) {
        var gCount = charts[item.id].graphs.length;
        charts[item.id].graphs.push({   
            "id": "g"+item.grank,
            "title": item.title,
            "lineColor": lineColors[gCount], //"#6fa511", //"#BD4920", "#6fa511",
            "balloon":{
                "drop":true,
                "adjustBorderColor":false,
                "color":"#ffffff"
            },
            "fillAlphas": 0.2,
            "bullet": "round",
            "bulletBorderAlpha": 1,
            "bulletColor": "#FFFFFF",
            "bulletSize": 5,
            "hideBulletsCount": bufferSize/4 <= 50 ? bufferSize/4 : 50,
            "lineThickness": 2,
            "title": item.source,
            "useLineColorForBulletBorder": true,
            "valueField": "value"+item.grank,
            "balloonText": "<span style='font-size:14px;'>[[value]]</span>"
        });
    }

    function updateCharts() {
        setInterval(function() {
            for(var c in charts) {
                charts[c].ignoreZoomed = true;
                charts[c].validateData(); 
            }
        },2000);
    }

    function reorderChildElementsById(parent) {
        [].map.call(parent.children, Object).sort(function(a, b) {
            return +a.id.match(/\d+/) - +b.id.match(/\d+/);
        }).forEach(function(elem) {
            parent.appendChild(elem);
        });
    }

    function changeState(text, time, delay, callback) {
        var $elem = jQuery('#state>p');
        $elem.fadeOut(time, function() {
            $elem.html(text);
            $elem.fadeIn(time, function() {
                if(isFunction(callback)) {
                    setTimeout(callback, delay);
                }
            });
        });
    }

    function fadeLoader() {
        var $c = jQuery('#charts');
        var $l = jQuery('#loader');
        $l.fadeOut(500, function() {
            $c.fadeIn(500);
        });
    }

    function isFunction(functionToCheck) {
        var getType = {};
        return functionToCheck && getType.toString.call(functionToCheck) === '[object Function]';
    }

    setTimeout(function() {
        changeState("Establishing connection to " + connStr, changeStateTime, changeStateDelay, function() {
            client.connect(options);
        });
    }, initialDelay);
});