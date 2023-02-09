//document.addEventListener("DOMContentLoaded", function(e) {
$(document).ready(function(){
    // Create a client instance
    var wsbroker = "127.0.0.1";
    var wsport = 15675;
    var connStr = wsbroker + ":" + wsport
    var clientid = "myclientid_" + parseInt(Math.random() * 100, 10);
    client = new Paho.MQTT.Client(wsbroker, wsport, "/ws", clientid);
    var initiated = false;
    var group = "";
    var curMaxRank = -99;
    var sources = []; // determines order of graphs and charts

    // set callback handlers
    client.onConnectionLost = onConnectionLost;
    client.onMessageArrived = onMessageArrived;

    // connect the client
    var options = {
        timeout: 3,
        keepAliveInterval: 10,
        cleanSession: true,
        mqttVersion: 4,
        onSuccess: onConnect,
        onFailure: onFailure
    };

    if(location.protocol == "https:") {
        options.useSSL = true;
    }

    // called when the client connects
    function onConnect() {
        var topicStr = "";
        topics = topics.split(',');
        for(var t in topics) {
            if(topics[t].slice(-2) == "**") {
                sources.push(topics[t].substring(0, topics[t].length-2));                
            } else if(topics[t].slice(-1) == "*") {
                sources.push(topics[t].substring(0, topics[t].length-1));
            } else {
                sources.push(topics[t]);
            }

            topics[t] = topics[t].replace("**", "#");
            topics[t] = topics[t].split('-').join('/');
            topicStr += "<br/>" + topics[t];
        }
        changeState("Connection established", 500, 200, function() {
            changeState("Wating for messages from" + topicStr, 500, 200, function() {
                for(var t in topics) {
                    client.subscribe(topics[t]);
                }
            });
        });

        // message = new Paho.MQTT.Message("4.2");
        // message.destinationName = "sensors/temp";
        // client.send(message);
    }

    function onFailure(message) {
        console.log("onFailure: " + message.errorMessage);
        changeState("Connection failure, initiating retry", 500, 2000, function() {
            changeState("Establishing connection to " + connStr, 500, 0, null);
            client.connect(options);
        });
    }

    // called when the client loses its connection
    function onConnectionLost(responseObject) {
        if (responseObject.errorCode !== 0) {
            console.log("onConnectionLost: " + responseObject.errorMessage);
            changeState("Connection lost, initiating retry", 500, 2000, function() {
                changeState("Establishing connection to " + connStr, 500, 0, null);
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
        var tmpObj = JSON.parse(message.payloadString);
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
        item.id = _item.id;
        item.source = _source;
        item.group = _item.group;
        item.rank = _item.rank;
        item.title = _item.title;
        item._value = _item.value.toFixed(2);
        item.date = moment(_item.timestamp, "YYYY-MM-DD-HH-mm-ss-SSS").toDate();
        item.systemTimestamp = moment(_item.systemTimestamp, "YYYY-MM-DD-HH-mm-ss-SSS").toDate();

        //console.log(item.systemTimestamp);

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
    
    var series = {};
    var dates = {};
    var charts = {};
    var bufferSize = 150;

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
            '<div id="chartslot_' + rank + '" class="col col-lg-6 col-md-12 col-sm-12">'
            + '<div id="chart-' + item.id + '" class="chart-instance chart-' + Object.keys(charts).length + '"></div>'
            + '</div>');
        
        charts[item.id] = AmCharts.makeChart("chart-" + item.id, {
            "type": "serial",
            "theme": "light",
            "titles": [
                {"text": item.title, "size": 12}
            ],
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
                "title": "red line",
                "useLineColorForBulletBorder": true,
                "valueField": "value"+item.grank,
                "balloonText": "<span style='font-size:14px;'>[[value]]</span>"
            }],
            "chartScrollbar": {
                "graph": "g"+item.grank,
                "oppositeAxis":false,
                "offset":30,
                "scrollbarHeight": 100,
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
            "valueScrollbar":{
                "oppositeAxis":true,
                "offset":0,
                "scrollbarHeight":60,
                "dragIcon": "dragIconRectSmall"
            },
            "categoryField": "date",
            "categoryAxis": {
                "parseDates": true,
                "minPeriod": "fff",
                "dashLength": 1,
                "position": "bottom",
                "minorGridEnabled": true
                // "labelFunction": function(valueText, date, categoryAxis) {
                //     return moment(date).format("HH-mm-ss-SSS"); // "YYYY-MM-DD-HH-mm-ss-SSS"
                // }
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
            "title": "red line",
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
        changeState("Establishing connection to " + connStr, 500, 250, function() {
            client.connect(options);
        });
    }, 500);
});