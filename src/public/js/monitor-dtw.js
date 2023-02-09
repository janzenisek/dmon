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
    am4core.useTheme(am4themes_animated);

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



    // message processing
    // ========================================================

    function parseItem(_item, _source) {
        if(_item.type == "list") return parseList(_item, _source);
        else if(_item.type == "series") return parseSeries(_item, _source);
    }

    function parseSeries(_item, _source) {
        var item = {};
        item.id = _item.id;
        item.source = _source;
        item.type= _item.type;
        item.group = _item.group;
        item.rank = _item.rank;
        item.title = _item.title;
        item.data = _item.data
        item.date = moment(_item.timestamp, "YYYY-MM-DD-HH-mm-ss-SSS").toDate();
        return item;
    }

    function parseList(_item, _source) {
        var item = {};
        item.id = _item.id;
        item.source = _source;
        item.type= _item.type;
        item.group = _item.group;
        item.date = moment(_item.timestamp, "YYYY-MM-DD-HH-mm-ss-SSS").toDate();
        item.rank = 0;
        return item;
    }

    function processItem(item) {
        if(group == "") {
            group = item.group;
            curMaxRank = item.rank            
        } else if(group != item.group) {
            $("#controls").html("");
            $("#charts").html("");
            charts = {};
            group = item.group;
            curMaxRank = item.rank;            
        }

        if(item.type == "list") processList(item);
        else if(item.type == "series") processSeries(item);
    }

    function processList(item) {
        return;
    }

    function processSeries(item) {
        console.log("processing series...");
        if(!charts[item.id]) {
            series[item.id] = [];
            series[item.id].push(item.source);
            createChart(item, 1);

            if(curMaxRank > item.rank) {
                var chartSlotsContainer = document.getElementById('charts');
                reorderChildElementsById(chartSlotsContainer);
            } else {
                curMaxRank = item.rank;
            }
        } else {
            console.log("series already added");            
        }
    }

    // charting
    // ========================================================
    var series = {};    
    var charts = {};
    

    function createChart(item) {
        var rank = item.rank;

        $("#charts")
        .append(
            '<div id="chartslot_' + rank + '" class="col col-lg-4 col-md-12 col-sm-12">'
            + '<div id="chart-' + item.id + '" class="chart-instance chart-' + Object.keys(charts).length + '"></div>'
            + '</div>');

        // charts[item.id] =  am4core.createFromConfig({
        //     "yAxes": [{
        //         "id": "yv1",
        //         "type": "ValueAxis",
        //         "numberFormatter": {
        //             "type": "NumberFormatter",
        //             "numberFormat": "#.00"
        //           }
        //     }],
        //     "xAxes": [{
        //         "id": "xv1",
        //         "type": "ValueAxis",
        //         "numberFormatter": {
        //             "type": "NumberFormatter",
        //             "numberFormat": "#"
        //           }
        //     }],
        //     "series": [{
        //         "id": item.id,
        //         "type": "LineSeries",
        //         "strokeWidth": 3,
        //         "tooltipText": "{valueX}: [bold]{valueY}[/]",
        //         "dataFields": {
        //             "valueX": "eventno",
        //             "valueY": "thickness"
        //         }
        //     }],            
        //     // "cursor": {
        //     //     "xAxis": "xv1",
        //     //     "yAxis": "yv1",
        //     //     "fullWidthLineX": true,
        //     //     "maxTooltipDistance": 20
        //     // },
        //     "tooltip": {
        //         "pointerOrientation": "vertical"
        //     },
        //     "exporting": {
        //         "menu": {
        //             "align": "right",
        //             "verticalAlign": "top",
        //         },
        //         "filePrefix": moment().format('YYYY-MM-DD-hh-mm-ss') + '_',
        //         "title": item.id,
        //         "formatOptions": {
        //             "pdf": { "minWidth": 1920, "minHeight": 1080, "maxWidth": 1920, "maxHeight": 1080 },
        //             "svg": { "minWidth": 1920, "minHeight": 1080, "maxWidth": 1920, "maxHeight": 1080 },
        //             "png": { "minWidth": 1920, "minHeight": 1080, "maxWidth": 1920, "maxHeight": 1080 },
        //             "jpg": { "minWidth": 1920, "minHeight": 1080, "maxWidth": 1920, "maxHeight": 1080 }
        //           }
        //       }
        // }, "chart-" + item.id, am4charts.XYChart);

        charts[item.id] = am4core.create("chart-" + item.id, am4charts.XYChart);        
        var title = charts[item.id].titles.create();
        title.text = item.title;
        title.fontSize = 12;
        title.marginBottom = 15;
        charts[item.id].data = item.data;


        // create axes
        var xAxis = charts[item.id].xAxes.push(new am4charts.ValueAxis());
        //xAxis.renderer.minGridDistance = 60;
        var yAxis = charts[item.id].yAxes.push(new am4charts.ValueAxis());
        
        // create series
        
        var series = charts[item.id].series.push(new am4charts.LineSeries());
        series.dataFields.valueY = "thickness";
        series.dataFields.valueX = "eventno";
        series.tooltipText = "{eventno}: [bold]{thickness}[/]"
        series.tooltip.pointerOrientation = "vertical";
        series.tooltip.exportable = false;

        charts[item.id].cursor = new am4charts.XYCursor();
        charts[item.id].cursor.snapToSeries = series;
        charts[item.id].cursor.xAxis = xAxis;

        charts[item.id].scrollbarX = new am4core.Scrollbar();
        charts[item.id].scrollbarX.parent = charts[item.id].bottomAxesContainer;
        charts[item.id].scrollbarX.exportable = false;

        charts[item.id].exporting.menu = new am4core.ExportMenu();
        charts[item.id].exporting.menu.align = "left";
        charts[item.id].exporting.menu.verticalAlign = "top";
        charts[item.id].exporting.filePrefix = moment().format('YYYY-MM-DD-hh-mm-ss') + '_' + item.id;        
        
        var options = charts[item.id].exporting.getFormatOptions("pdf");
        options.minWidth = 1920; options.minHeight = 1080; options.maxWidth = 1920; options.maxHeight = 1080;
        charts[item.id].exporting.setFormatOptions("pdf", options);
        options = charts[item.id].exporting.getFormatOptions("svg");
        options.minWidth = 1920; options.minHeight = 1080; options.maxWidth = 1920; options.maxHeight = 1080;
        charts[item.id].exporting.setFormatOptions("svg", options);
        options = charts[item.id].exporting.getFormatOptions("png");
        options.minWidth = 1920; options.minHeight = 1080; options.maxWidth = 1920; options.maxHeight = 1080;
        charts[item.id].exporting.setFormatOptions("png", options);
        options = charts[item.id].exporting.getFormatOptions("jpg");
        options.minWidth = 1920; options.minHeight = 1080; options.maxWidth = 1920; options.maxHeight = 1080;
        charts[item.id].exporting.setFormatOptions("jpg", options);
    }



    //  helpers

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
        var $cts = jQuery('#controls');
        var $c = jQuery('#charts');
        var $l = jQuery('#loader');
        $l.fadeOut(100, function() {
            $cts.fadeIn(100);
            $c.fadeIn(100);
        });
    }

    function isFunction(functionToCheck) {
        var getType = {};
        return functionToCheck && getType.toString.call(functionToCheck) === '[object Function]';
    }

    setTimeout(function() {
        changeState("Establishing connection to " + connStr, 100, 50, function() {
            client.connect(options);
        });
    }, 100);
});