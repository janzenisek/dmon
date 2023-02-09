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
    //var strokeColors = ["#1E91D6", "#8FC93A", "#E18335", "#E4CC37"];    
    var strokeColors = [ "#6a89cc", "#fa983a", "#78e08f", "#e55039", "#38ada9", "#b71540",
                            "#b8e994", "#3c6382", "#079992", "#f6b93b", "#4a69bd" ];    
    var usedStrokeColors = {};                            

    var defaultSeriesColor = "#999999";
    var maxWarpSeries = strokeColors.length-1;
    var warpSeriesAddCounter = 0;

    var charts = {};
    var detailChart = {};
    var distributionChart = {};

    // set callback handlers
    client.onConnectionLost = onConnectionLost;
    client.onMessageArrived = onMessageArrived;

    var srcTopicListUpdate = "fp/list/update";
    var srcTopicSearchResults = "fp/search/results";
    var srcTopicSearchDistribution = "fp/search/distribution";
    var targetTopicListUpdate = "fp/list";
    var targetTopicMaterialSearch = "fp/search";


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
        topicStr += "<br/>" + srcTopicListUpdate;
        topicStr += "<br/>" + srcTopicSearchResults;

        changeState("Connection established", 200, 100, function() {
            changeState("Wating for messages from" + topicStr, 200, 100, function() {
                client.subscribe(srcTopicListUpdate);
                client.subscribe(srcTopicSearchResults);
                changeState("Loading database", 100, 200, function() {
                    loadDb();
                });                
            });
        });

        // var topicStr = "";
        // topics = topics.split(',');
        // for(var t in topics) {
        //     if(topics[t].slice(-2) == "**") {
        //         sources.push(topics[t].substring(0, topics[t].length-2));                
        //     } else if(topics[t].slice(-1) == "*") {
        //         sources.push(topics[t].substring(0, topics[t].length-1));
        //     } else {
        //         sources.push(topics[t]);
        //     }

        //     topics[t] = topics[t].replace("**", "#");
        //     topics[t] = topics[t].split('-').join('/');
        //     topicStr += "<br/>" + topics[t];
        // }
        // changeState("Connection established", 200, 100, function() {
        //     changeState("Wating for messages from" + topicStr, 200, 100, function() {
        //         for(var t in topics) {
        //             client.subscribe(topics[t]);
        //         }
        //     });
        // });
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
        if(_item.type == "list") {
            return parseList(_item, _source);
        } else if(_item.type == "series") {
            return parseSeries(_item, _source);
        } else if(_item.type == "warpinfo") {
            return parseWarpInfo(_item, _source);
        } else if(_item.type == "summary") {
            return parseSummary(_item, _source);
        }
    }

    function parseWarpInfo(_item, _source) {
        var item = {};
        item.id1 = _item.id1;
        item.id2 = _item.id2;
        var splitId1 = item.id1.split('-');
        var splitId2 = item.id2.split('-');
        item.machine1 = splitId1[0];
        item.material1 = splitId1[1];
        item.machine2 = splitId2[0];
        item.material2 = splitId2[1];
        item.source = _source;
        item.type = _item.type;
        item.group = _item.group;
        item.timestamp = moment(_item.timestamp, "YYYY-MM-DD-HH-mm-ss").toDate();
        item.distance = _item.distance;
        item.warp = _item.warp;
        item.warpsum = sumArr(item.warp);
        item.stretch = daboDetail.data.length / daboOverview[item.id2].data.length;
        item.track = _item.track;
        return item;
    }

    function parseSeries(_item, _source) {
        var item = {};
        item.id = _item.id;
        var splitId = item.id.split('-');
        item.machine = splitId[0];
        item.material = splitId[1];
        item.source = _source;
        item.type= _item.type;
        item.target = _item.target;
        item.group = _item.group;
        item.rank = _item.rank;
        item.title = _item.title;
        item.material = _item.material;
        item.data = _item.data
        item.timestamp = moment(_item.timestamp, "YYYY-MM-DD-HH-mm-ss").toDate();
        return item;
    }

    function parseSummary(_item, _source) {
        var item = {};
        item.id = _item.id;
        item.material = _item.material;
        item.source = _source;
        item.type = _item.type;
        item.target = _item.target;
        item.group = _item.group;
        item.rank = _item.rank;
        item.timestamp = moment(_item.timestamp, "YYYY-MM-DD-HH-mm-ss").toDate();
        item.data = _item.results;


        for(let bar of item.data) {
            if(daboDetail.material == bar.material) console.log(daboDetail.material + " ... " + bar.material);
            bar.color = daboDetail.material == bar.material ? "#6a89cc" : "#999999";
        }

        return item;
    }

    function parseList(_item, _source) {
        var item = {};
        item.id = _item.id;
        item.source = _source;
        item.type= _item.type;
        item.group = _item.group;
        item.timestamp = moment(_item.timestamp, "YYYY-MM-DD-HH-mm-ss").toDate();        
        item.data = _item.data;
        return item;
    }

    function processItem(item) {
        if(group == "" || group != item.group) {
            localStorage.clear();
            localStorage.setItem("daboInfo", JSON.stringify(item.group));
            daboInfo = item.group;

            $("#db-menu").html("");
            $("#db-detail").html("");
            $("#db-overview").html("");
            charts = {};
            group = item.group;
            curMaxRank = -99;
            if(item.type == "series") curMaxRank = item.rank;  
        }

        if(item.type == "list") {            
            daboList = item;
            localStorage.setItem("daboList", JSON.stringify(item));
            processList(item);
        } else if(item.type == "series" && item.target == "detail") {
            daboDetail = item;
            localStorage.setItem("daboDetail", JSON.stringify(item));
            processSeries(item);
        } else if(item.type == "series" && item.target == "overview") {
            daboOverview[item.id] = item;
            localStorage.setItem("daboOverview-" + item.id, JSON.stringify(item));
            processSeries(item);
        } else if(item.type == "warpinfo") {
            daboWarps[item.id2] = item;
            localStorage.setItem("daboWarps-" + item.id2, JSON.stringify(item));
            console.log("added daboWarps-" + item.id2);
            processWarp(item);
        } else if(item.type == "summary" && item.target == "distribution") {
            daboDistribution = item;
            localStorage.setItem("daboDistribution", JSON.stringify(item));
            console.log("processing result distribution");
            processResultDistribution(item);
        }
    }

    function processWarp(warpinfo) {
        var item;
        if(daboOverview[warpinfo.id2]) item = daboOverview[warpinfo.id2];

        if(item) {
            $('#chartinfo-' + warpinfo.id2 + ' .chartinfo-line2').html(
                '<span class="distance">distance: ' + Number(warpinfo.distance).toFixed(2) + '</span>'
                + '<span class="sum">warp sum: ' + warpinfo.warpsum + '</span>'
                + '<span class="sum">stretch: ' + Number(warpinfo.stretch).toFixed(2) + '</span>'
            );

            if(daboDetail.id != item.id) {
                $('#chartinfo-' + item.id + ' .chartinfo-line1').append(
                    '<button id="chartaddbutton-' + item.id +'" type="button" class="addbutton btn" value="' + item.id + '">+</button>'            
                );
                $("#chartaddbutton-" + item.id).click(function() {

                    if($("#chartaddbutton-" + item.id).hasClass("added")) {
                        warpSeriesAddCounter--;
                        $("#chartaddbutton-" + item.id).attr('style', "");
                        $("#chartaddbutton-" + item.id).html('+');
                        $("#chartaddbutton-" + item.id).removeClass('added');
                        $(".chartslot_" + item.id +">div").attr('style', "");
                        var srs = charts[item.id].series.getIndex(0);                        
                        srs.stroke = am4core.color(defaultSeriesColor);
                        removeSeriesFromDetailChart(item);                    
                        returnStrokeColor(item.id);
                    } else if(warpSeriesAddCounter < maxWarpSeries) {
                        warpSeriesAddCounter++;
                        var scolor = getStrokeColor(item.id);               
                        $("#chartaddbutton-" + item.id).attr('style', "background-color: "+ pSBC(0.5, scolor));
                        $("#chartaddbutton-" + item.id).html('-');
                        $("#chartaddbutton-" + item.id).addClass('added');
                        $(".chartslot_" + item.id +">div").attr('style', "border-color: "+ pSBC(0.5, scolor));
                        var srs = charts[item.id].series.getIndex(0);
                        srs.stroke = am4core.color(pSBC(0.25, scolor));                        
                        addSeriesToDetailChart(warpinfo, item , detailSeriesName);     
                    }
                });
            } 
            
        }
    }

    function processList(item) {
        console.log("processing list");
        var listCount = item.data.length;
        $("#db-menu").html("");
        $("#db-menu").append(
            '<button id="refresh-listbutton" type="button" class="btn btn-light" ><svg width="1em" height="1em" viewBox="0 0 16 16" class="bi bi-arrow-clockwise" fill="currentColor" xmlns="http://www.w3.org/2000/svg">'
            +'<path fill-rule="evenodd" d="M3.17 6.706a5 5 0 0 1 7.103-3.16.5.5 0 1 0 .454-.892A6 6 0 1 0 13.455 5.5a.5.5 0 0 0-.91.417 5 5 0 1 1-9.375.789z"/>'
            +'<path fill-rule="evenodd" d="M8.147.146a.5.5 0 0 1 .707 0l2.5 2.5a.5.5 0 0 1 0 .708l-2.5 2.5a.5.5 0 1 1-.707-.708L10.293 3 8.147.854a.5.5 0 0 1 0-.708z"/></svg>&nbsp;Refresh</button>'
            + '<div class="dropdown">'
            + '<button id="db-mbutton" type="button" class="btn btn-light dropdown-toggle" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">Material</button>'
            + '<div id="db-mselector" class="dropdown-menu scrollable-menu" role="menu"></div>'
            + '</div>'
        );        

        for(var i = 0; i < item.data.length; i++) {
            $("#db-mselector").append(
                '<button class="dropdown-item" id="db-moption-' + item.data[i].material + 'value=' + item.data[i].material + '">'
                + item.data[i].material
                + '</button>'
            );
        }        

        registerReload();
        registerListEvents();        
    }

    function processSeries(item) {      

        if(item.target == "detail") {
            createDetailChart(item);                
            createOverviewChart(item);
            var scolor = getStrokeColor(item.id);
            $(".chartslot_" + item.id +">div").attr("style", "border-color: " + pSBC(0.5, scolor));
            var srs = charts[item.id].series.getIndex(0);            
            srs.stroke = am4core.color(pSBC(0.25, scolor));
        } else if(item.target == "overview") {
            createOverviewChart(item);                        
        }

        if(curMaxRank > item.rank) {
            var chartSlotsContainer = document.getElementById('db-overview');
            reorderChildElementsById(chartSlotsContainer);
        } else {
            curMaxRank = item.rank;
        }
    }

    function processResultDistribution(item) {

        createDistributionChart(item);
    }

    // charting
    // ========================================================
    
    var detailSeriesName = "";
    function createFirstDetailSeries(item) {
        // add x data
        detailChart.data = item.data.map(function(x) { return { eventno: x.eventno }; })        
        detailSeriesName = "value-" + seriesId;

        // add y data
        var seriesId = item.id;        
        for(var i = 0; i < detailChart.data.length; i++) {
            detailChart.data[i][detailSeriesName] = item.data[i].thickness;
        }

        // create series and map data
        //var series = detailChart.series.push(new am4charts.LineSeries());
        var series = new am4charts.LineSeries();
        series.data = detailChart.data;
        series.dataFields.valueY = detailSeriesName;
        series.dataFields.valueX = "eventno";
        series.tooltipText = "{eventno}: [bold]{" + detailSeriesName + "}[/]"
        series.tooltip.pointerOrientation = "vertical";
        series.tooltip.exportable = false;
        series.name = item.id;
        series.stroke = am4core.color(strokeColors[0]);
        series.strokeWidth = 2;
        return series;
    }

    function removeSeriesFromDetailChart(item) {
        var idx = -1;
        console.log(detailChart.series.length);

        for(var i = 0, count = detailChart.series.length; i < count && idx == -1; i++) {                        
            if(detailChart.series.getIndex(i).name == item.id) {
                idx = i;
                detailChart.series.removeIndex(idx);
            }
        }                
    }

    function addSeriesToDetailChart(warpinfo, item, detailSeriesName) {
        var seriesId = item.id;
        var addSeriesName = "value-" + seriesId;        
        console.log("pltcm length: " + detailChart.data.length);
        console.log("hsm length: " + item.data.length);
        console.log("warplength: " + warpinfo.warp.length);

        var j = 0, c = 0;        
        detailChart.data[c][addSeriesName] = item.data[j].thickness;
        try {
            for(var i = 2, count = warpinfo.warp.length; i < count; i++) {                
                if(warpinfo.warp[i] == 0) {
                    j++;
                    c++;
                    detailChart.data[c][addSeriesName] = item.data[j].thickness;
                } else if(warpinfo.warp[i] == 1) {                
                    c++;
                    detailChart.data[c][addSeriesName] = item.data[j].thickness;
                } else {                
                    j++;
                    detailChart.data[c][addSeriesName] = item.data[j].thickness;
                }
            }
        } catch(exc) {

        } finally {
            console.log("pltcm length: " + detailChart.data.length + " / c = " + c);
            console.log("hsm length: " + item.data.length + " / j = " + j);
            console.log("warplength: " + warpinfo.warp.length + " / i = " + i);            
        }

        var series = new am4charts.LineSeries();
        series.data = detailChart.data;
        series.dataFields.valueY = addSeriesName;
        series.dataFields.valueX = "eventno";
        series.name = item.id;
        series.id = item.id;
        series.stroke = am4core.color(usedStrokeColors[item.id]);
        series.strokeWidth = 2;
        return detailChart.series.push(series);
    }

    // function mockDistributionChart() {
    //     // Add data
    //     var data = [{
    //         "material": "9J013674",
    //         "rank": 1,
    //         "distance": 49.53,
    //         "warpsum": 1311,
    //         "stretch": 4.60,
    //         "reverse": false
    //     }, {
    //         "material": "9J013788",
    //         "rank": 2,
    //         "distance": 72.14,
    //         "warpsum": 1273,
    //         "stretch": 4.17,
    //         "reverse": false
    //     }, {
    //         "material": "9J013820",
    //         "rank": 3,
    //         "distance": 72.75,
    //         "warpsum": 1292,
    //         "stretch": 4.37,
    //         "reverse": false
    //     }, {
    //         "counmaterialtry": "9J013825",
    //         "rank": 4,
    //         "distance": 73.38,
    //         "warpsum": 1308,
    //         "stretch": 4.56,
    //         "reverse": false
    //     }, {
    //         "material": "9J014549",
    //         "rank": 5,
    //         "distance": 73.93,
    //         "warpsum": 1300,
    //         "stretch": 4.47,
    //         "reverse": false
    //     }, {
    //         "material": "9J014512",
    //         "rank": 6,
    //         "distance": 74.09,
    //         "warpsum": 1290,
    //         "stretch": 4.35,
    //         "reverse": false
    //     }, {
    //         "material": "9J013680",
    //         "rank": 7,
    //         "distance": 75.26,
    //         "warpsum": 1294,
    //         "stretch": 4.40,
    //         "reverse": false
    //     }, {
    //         "material": "9J013682",
    //         "rank": 8,
    //         "distance": 75.53,
    //         "warpsum": 1240,
    //         "stretch": 3.85,
    //         "reverse": false
    //     }, {
    //         "material": "9J013713",
    //         "rank": 9,
    //         "distance": 75.61,
    //         "warpsum": 1276,
    //         "stretch": 4.20,
    //         "reverse": false
    //     }, {
    //         "material": "9J013757",
    //         "rank": 10,
    //         "distance": 76.68,
    //         "warpsum": 1329,
    //         "stretch": 4.84,
    //         "reverse": false        
    //     }];

    //     var item = {};
    //     item.id = 1234;
    //     item.data = data;
    //     createDistributionChart(item);
    // }

    function createDistributionChart(item) {
        $("#db-detail")
        .append(            
            '<div id="distributionchart-' + item.id + '" class="col col-lg-4 col-md-4 col-sm-12 chart-instance distribution-chart"></div>'
        );
        distributionChart = am4core.create("distributionchart-" + item.id, am4charts.XYChart);

        distributionChart.data = item.data;

        // create title
        var topContainer = distributionChart.chartContainer.createChild(am4core.Container);
        topContainer.layout = "absolute";
        topContainer.toBack();
        topContainer.paddingBottom = 15;
        topContainer.width = am4core.percent(100);

        var title = topContainer.createChild(am4core.Label);
        title.text = "Distance Distribution";
        title.align = "center";

        // Create axes
        var categoryAxis = distributionChart.xAxes.push(new am4charts.CategoryAxis());
        categoryAxis.dataFields.category = "material";
        categoryAxis.renderer.grid.template.location = 0;
        categoryAxis.renderer.minGridDistance = 30;
        categoryAxis.renderer.labels.template.rotation = 270;

        // categoryAxis.renderer.labels.template.adapter.add("dy", function(dy, target) {
        // if (target.dataItem && target.dataItem.index & 2 == 2) {
        //     return dy + 25;
        // }
        // return dy;
        // });

        //distributionChart.title.text = "Distance Distribution";
        // distributionChart.title.rotation = 0;
        // distributionChart.title.align = "center";
        // distributionChart.title.valign = "top";
        // distributionChart.title.dy = -40;
        // distributionChart.title.fontWeight = 600;

        var valueAxis = distributionChart.yAxes.push(new am4charts.ValueAxis());
        

        // Create series
        var series = distributionChart.series.push(new am4charts.ColumnSeries());
        series.dataFields.valueY = "distance";
        series.dataFields.categoryX = "material";
        series.name = "Distance";
        series.columns.template.tooltipText = "{categoryX}: [bold]{valueY}[/]";
        series.columns.template.fillOpacity = .75;
        //series.columns.template.fill = am4core.color("#999999");
        //series.columns.template.fill = 
        series.columns.template.propertyFields.fill = "color";

        var columnTemplate = series.columns.template;
        //columnTemplate.stroke = am4core.color("#999999");
        columnTemplate.strokeWidth = 0;
        //columnTemplate.strokeOpacity = 1;

    }

    function createDetailChart(item) {
        changeState("Loading results", 0, 0, function() {
            var $l = jQuery('#loader');
            $l.fadeOut(200);
        });        
        var rank = item.rank;

        $("#db-detail")
        .append(            
            '<div id="detailchart-' + item.id + '" class="col col-lg-8 col-md-8 col-sm-12 chart-instance detail-chart detail-chart-' + Object.keys(charts).length + '"></div>'
            );

        detailChart = am4core.create("detailchart-" + item.id, am4charts.XYChart);     


        // create axes
        var xAxis = detailChart.xAxes.push(new am4charts.ValueAxis());
        //xAxis.renderer.minGridDistance = 60;
        var yAxis = detailChart.yAxes.push(new am4charts.ValueAxis());
        
        // create series
        var series = createFirstDetailSeries(item);
        series = detailChart.series.push(series);
        // add legend 
        detailChart.legend = new am4charts.Legend();
        detailChart.legend.position = "top";

        detailChart.cursor = new am4charts.XYCursor();
        detailChart.cursor.snapToSeries = series;
        detailChart.cursor.xAxis = xAxis;

        detailChart.scrollbarX = new am4core.Scrollbar();
        detailChart.scrollbarX.parent = detailChart.bottomAxesContainer;
        detailChart.scrollbarX.exportable = false;

        detailChart.exporting.menu = new am4core.ExportMenu();
        detailChart.exporting.menu.align = "left";
        detailChart.exporting.menu.verticalAlign = "top";
        detailChart.exporting.filePrefix = moment().format('YYYY-MM-DD-hh-mm-ss') + '_' + item.id;        
        
        var options = detailChart.exporting.getFormatOptions("pdf");
        options.minWidth = 1920; options.minHeight = 1080; options.maxWidth = 1920; options.maxHeight = 1080;
        detailChart.exporting.setFormatOptions("pdf", options);
        options = detailChart.exporting.getFormatOptions("svg");
        options.minWidth = 1920; options.minHeight = 1080; options.maxWidth = 1920; options.maxHeight = 1080;
        detailChart.exporting.setFormatOptions("svg", options);
        options = detailChart.exporting.getFormatOptions("png");
        options.minWidth = 1920; options.minHeight = 1080; options.maxWidth = 1920; options.maxHeight = 1080;
        detailChart.exporting.setFormatOptions("png", options);
        options = detailChart.exporting.getFormatOptions("jpg");
        options.minWidth = 1920; options.minHeight = 1080; options.maxWidth = 1920; options.maxHeight = 1080;
        detailChart.exporting.setFormatOptions("jpg", options);
        
    }

    function createOverviewChart(item) {
        var rank = item.rank;

        var materialMatchClass = item.material == daboDetail.material ? " materialMatchChart" : "";

        $("#db-overview")
        .append(            
            '<div id="chartslot_' + rank + '" class="chartslot chartslot_' + item.id +' col col-lg-4 col-md-4 col-sm-12">'
            + '<div class="chartslot-borderbox">'
            + '<div id="chartinfo-' + item.id + '" class="chartinfo">'
            + '<div class="chartinfo-line1"><span class="charttitle' + materialMatchClass + '">' + item.title + '</span>'
            + '<span class="chartrank">rank: ' + item.rank + '</span></div>'             
            + '<div class="chartinfo-line2"><span>distance: 0.00</span></div>'            
            + '</div><div id="chart-' + item.id + '" class="chart-instance chart-' + Object.keys(charts).length + '"></div>'
            + '</div></div>');


        charts[item.id] = am4core.create("chart-" + item.id, am4charts.XYChart);        
        // var title = charts[item.id].titles.create();
        // title.text = item.title;
        // title.fontSize = 16;
        // title.marginBottom = 15;
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
        series.stroke = am4core.color(defaultSeriesColor);
        series.strokeWidth = 1;
        series.name = item.id;
        series.id = item.id ;       

        charts[item.id].cursor = new am4charts.XYCursor();
        charts[item.id].cursor.snapToSeries = series;
        charts[item.id].cursor.xAxis = xAxis;
    }

    function reorderChildElementsById(parent) {
        [].map.call(parent.children, Object).sort(function(a, b) {
            return +a.id.match(/\d+/) - +b.id.match(/\d+/);
        }).forEach(function(elem) {
            parent.appendChild(elem);
        });
    }

    // db
    // ========================================================

    var daboInfo = {};
    var daboList = {};
    var daboDetail = {};
    var daboOverview = {};
    var daboWarps = {};
    var daboDistribution = {}
    function loadDb() {        
        var daboInfoStr = localStorage.getItem("daboInfo");
        if(!daboInfoStr) {
            changeState("No data stored yet", 100, 500, function() {  
                fadeLoader();  
                $("#db-menu").append(
                    '<button id="refresh-listbutton" type="button" class="btn btn-light" ><svg width="1em" height="1em" viewBox="0 0 16 16" class="bi bi-arrow-clockwise" fill="currentColor" xmlns="http://www.w3.org/2000/svg">'
                    +'<path fill-rule="evenodd" d="M3.17 6.706a5 5 0 0 1 7.103-3.16.5.5 0 1 0 .454-.892A6 6 0 1 0 13.455 5.5a.5.5 0 0 0-.91.417 5 5 0 1 1-9.375.789z"/>'
                    +'<path fill-rule="evenodd" d="M8.147.146a.5.5 0 0 1 .707 0l2.5 2.5a.5.5 0 0 1 0 .708l-2.5 2.5a.5.5 0 1 1-.707-.708L10.293 3 8.147.854a.5.5 0 0 1 0-.708z"/></svg>&nbsp;Refresh</button>'
                );
                registerReload();
            });
        } else {
            fadeLoader();
            daboInfo = JSON.parse(daboInfoStr);
            group = daboInfo;
            
            var daboListStr = localStorage.getItem("daboList");
            if(daboListStr) {
                daboList = JSON.parse(daboListStr);
                processList(daboList);
            } else {
                $("#db-menu").append(
                    '<button id="refresh-listbutton" type="button" class="btn btn-light" ><svg width="1em" height="1em" viewBox="0 0 16 16" class="bi bi-arrow-clockwise" fill="currentColor" xmlns="http://www.w3.org/2000/svg">'
                    +'<path fill-rule="evenodd" d="M3.17 6.706a5 5 0 0 1 7.103-3.16.5.5 0 1 0 .454-.892A6 6 0 1 0 13.455 5.5a.5.5 0 0 0-.91.417 5 5 0 1 1-9.375.789z"/>'
                    +'<path fill-rule="evenodd" d="M8.147.146a.5.5 0 0 1 .707 0l2.5 2.5a.5.5 0 0 1 0 .708l-2.5 2.5a.5.5 0 1 1-.707-.708L10.293 3 8.147.854a.5.5 0 0 1 0-.708z"/></svg>&nbsp;Refresh</button>'
                );
                sendReloadRequest();
            }

            var daboDetailStr = localStorage.getItem("daboDetail");
            if(daboDetailStr) {
                daboDetail = JSON.parse(daboDetailStr);
                processSeries(daboDetail);
                $("#db-mbutton").text(daboDetail.material);
                $("#db-mbutton").val(daboDetail.material);
                console.log();
            }

            var daboDistributionStr = localStorage.getItem("daboDistribution");
            if(daboDistributionStr) {
                daboDistribution = JSON.parse(daboDistributionStr);
                processResultDistribution(daboDistribution);
                console.log("loaded dabo distribution");
            }

            var lsKeys = Object.keys(localStorage);
            for(var i = 0, count = lsKeys.length; i < count; i++) {
                if(lsKeys[i].startsWith("daboOverview-")) {                    
                    var daboOverviewStr = localStorage.getItem(lsKeys[i]);
                    if(daboOverviewStr) {
                        var daboOverviewElement = JSON.parse(daboOverviewStr);
                        daboOverview[daboOverviewElement.id] = daboOverviewElement;
                        processSeries(daboOverviewElement);
                    }
                }
            }

            for(var i = 0, count = lsKeys.length; i < count; i++) {
                if(lsKeys[i].startsWith("daboWarps-")) {
                    var daboWarpStr = localStorage.getItem(lsKeys[i]);
                    if(daboWarpStr) {
                        var daboWarpElement = JSON.parse(daboWarpStr);
                        daboWarps[daboWarpElement.id2] = daboWarpElement;                        
                        processWarp(daboWarpElement);
                    }
                }
            }

            
        }
    }


    function unloadDatabase() {
        var lsKeys = Object.keys(localStorage);
        for(var i = 0, count = lsKeys.length; i < count; i++) {
            if(lsKeys[i].startsWith("daboOverview-") 
            || lsKeys[i].startsWith("daboWarps-")
            || lsKeys[i].startsWith("daboDetail")
            || lsKeys[i].startsWith("daboDistribution"))  {
                localStorage.removeItem(lsKeys[i]);
            }
        }

        daboDetail = {};
        daboOverview = {};
        daboWarps = {};
        daboDistribution = {};
    }

    //  helpers
    // ========================================================
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
        var $dbc = jQuery('#dashboard-container');        
        var $l = jQuery('#loader');
        $l.fadeOut(100, function() {
            $dbc.fadeIn(100);            
        });
    }

    function showLoader() {
        var $dbc = jQuery('#dashboard-container');        
        var $l = jQuery('#loader');
        $dbc.fadeOut(100, function() {
            $l.fadeIn(100);            
        });
    }

    function isFunction(functionToCheck) {
        var getType = {};
        return functionToCheck && getType.toString.call(functionToCheck) === '[object Function]';
    }

    function sumArr(arr) {
        var count = 0;
        for(var i=arr.length; i--;) {
            count += arr[i];
        }
        return count;
    }
  
    setTimeout(function() {
        changeState("Establishing connection to " + connStr, 100, 50, function() {
            client.connect(options);
        });
    }, 100);

    function registerReload() {
        $("#refresh-listbutton").click(function() {
            sendReloadRequest();
            daboDetail.material = "";
         });
    }

    function sendReloadRequest() {
        var listRequestMsgObj = {
            group: group,
            timestamp: moment().format('YYYY-MM-DD-hh-mm-ss')
        };
        var listRequestMsg = new Paho.MQTT.Message(JSON.stringify(listRequestMsgObj));
        listRequestMsg.destinationName = targetTopicListUpdate
        client.send(listRequestMsg);
    }

    function registerListEvents() {
        $(".dropdown-menu button").click(function(){
            var searchMaterial = $(this).text();
            //if(daboDetail.material == searchMaterial) return;
            
            $("#db-mbutton").text(searchMaterial);
            $("#db-mbutton").val(searchMaterial);            
            $("#db-overview").html("");
            $("#db-detail").html("");
            warpSeriesAddCounter = 0;
            usedStrokeColors = {};

            var fpSearchMsgObj =  {
                id: searchMaterial,
                warpInfo: true,
                searchResultCount: 10,
                group: group,
                timestamp: moment().format('YYYY-MM-DD-hh-mm-ss')
            };

            var $l = jQuery('#loader');
            changeState("Performing fingerprint search", 100, 50, function() {
                $l.fadeIn(200);
                unloadDatabase();
                var fpSearchMsg = new Paho.MQTT.Message(JSON.stringify(fpSearchMsgObj));
                fpSearchMsg.destinationName = targetTopicMaterialSearch;
                client.send(fpSearchMsg);
            });
         });
    }

    function registerAddButtonEvents() {
        $(".chartinfo button").click(function(){
            var $this = $(this);
            console.log($this.value);
        });
    }
    
    function getStrokeColor(id) {
        var color;
        for(var i = 0, count = strokeColors.length; i < count && !color; i++) {
            if(!Object.values(usedStrokeColors).includes(strokeColors[i])) {                
                color = strokeColors[i];
            }
        }

        if(color) usedStrokeColors[id] = (color);
        return color;        
    }
    function returnStrokeColor(id) {
        delete usedStrokeColors[id];
    }

    // Version 4.0
    const pSBC=(p,c0,c1,l)=>{
        let r,g,b,P,f,t,h,i=parseInt,m=Math.round,a=typeof(c1)=="string";
        if(typeof(p)!="number"||p<-1||p>1||typeof(c0)!="string"||(c0[0]!='r'&&c0[0]!='#')||(c1&&!a))return null;
        if(!this.pSBCr)this.pSBCr=(d)=>{
            let n=d.length,x={};
            if(n>9){
                [r,g,b,a]=d=d.split(","),n=d.length;
                if(n<3||n>4)return null;
                x.r=i(r[3]=="a"?r.slice(5):r.slice(4)),x.g=i(g),x.b=i(b),x.a=a?parseFloat(a):-1
            }else{
                if(n==8||n==6||n<4)return null;
                if(n<6)d="#"+d[1]+d[1]+d[2]+d[2]+d[3]+d[3]+(n>4?d[4]+d[4]:"");
                d=i(d.slice(1),16);
                if(n==9||n==5)x.r=d>>24&255,x.g=d>>16&255,x.b=d>>8&255,x.a=m((d&255)/0.255)/1000;
                else x.r=d>>16,x.g=d>>8&255,x.b=d&255,x.a=-1
            }return x};
        h=c0.length>9,h=a?c1.length>9?true:c1=="c"?!h:false:h,f=this.pSBCr(c0),P=p<0,t=c1&&c1!="c"?this.pSBCr(c1):P?{r:0,g:0,b:0,a:-1}:{r:255,g:255,b:255,a:-1},p=P?p*-1:p,P=1-p;
        if(!f||!t)return null;
        if(l)r=m(P*f.r+p*t.r),g=m(P*f.g+p*t.g),b=m(P*f.b+p*t.b);
        else r=m((P*f.r**2+p*t.r**2)**0.5),g=m((P*f.g**2+p*t.g**2)**0.5),b=m((P*f.b**2+p*t.b**2)**0.5);
        a=f.a,t=t.a,f=a>=0||t>=0,a=f?a<0?t:t<0?a:a*P+t*p:0;
        if(h)return"rgb"+(f?"a(":"(")+r+","+g+","+b+(f?","+m(a*1000)/1000:"")+")";
        else return"#"+(4294967296+r*16777216+g*65536+b*256+(f?m(a*255):0)).toString(16).slice(1,f?undefined:-2)
    }

});