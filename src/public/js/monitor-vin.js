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
		var sources = [];

		var vin = null;
		var curvin = null;
		var network, nodes, edges, data, container, nodesDict, nodesArr, edgesDict, edgesArr, nodeNamesDict;        
		var hotpath;
		var curEdgesArr;
		
		var initSession = function() {
			group = sessionStorage.group;
			vin = (sessionStorage.vin) ? JSON.parse(sessionStorage.vin) : null;
			curvin = (sessionStorage.curvin) ? JSON.parse(sessionStorage.curvin) : null;  
			hotpath = (sessionStorage.hotpath) ? JSON.parse(sessionStorage.hotpath) : null;      
			//Object.keys(vin).length == 0 && vin.constructor === Object
			if(vin) {
				if(!initiated) {
					initiated = true;
					fadeLoader();                    
					$('#vin').css('height', '700px');
				}                

				initNetwork(vin);
			} else {
				vin = {};
			}
			if(curvin) {
				processNetwork(curvin);
			} else {
				curvin = {};
				hotpath = {};
			}
			if(!group) group = "";
			console.log("Monitor: initialized session...");
		}
		
		// sessionStorage.removeItem("group");
		// sessionStorage.removeItem("vin");
		// sessionStorage.removeItem("curvin");

		var MessageType = {
			Init    : 0,
			Update  : 1
		};

	
		// set callback handlers
		client.onConnectionLost = onConnectionLost;
		client.onMessageArrived = onMessageArrived;
	
		// connect the client
		var options = {
			timeout: 3,
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
				if(topics[t].slice(-1) == "*") {
					sources.push("vin/" + topics[t].substring(0, topics[t].length-1));
				} else {
					sources.push("vin/" + topics[t]);
				}
	
				topics[t] = topics[t].split('-').join('/');
				topicStr += "<br/>" + "vin/" + topics[t];
			}
			changeState("Connection established", 250, 200, function() {
				changeState("Wating for messages from" + topicStr, 250, 200, function() {
					for(var t in topics) {
						client.subscribe("vin/" + topics[t]);
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
			item.source = _source;
			item.group = _item.group;
			item.date = moment(_item.timestamp, "YYYY-MM-DD-HH-mm-ss-SSS").toDate();
			item.type = _item.type;
			item.network = _item.network;
			item.hotpath = _item.hotpath;

			return item;
		}
	
		function processItem(item) {
			if(group == "") {
				group = item.group;
				$('#vin').css('height', '750px');
			} else if(group != item.group) {
				$("#vin").html("");
				vin = {};
				curvin = {};
				group = item.group;
				hotpath = item.hotpath;
			}
			sessionStorage.group = group;

			if(item.type == MessageType.Init) {
				if(Object.keys(vin).length == 0 && vin.constructor === Object) {
					vin = item.network;
					sessionStorage.vin = JSON.stringify(vin);
					sessionStorage.hotpath = JSON.stringify(hotpath);
					initNetwork(vin);
				}
				/*if(Object.keys(curvin).length > 0 && curvin.constructor === Object) {
					processNetwork(curvin);
				}*/ 
				console.log("init message arrived");
			} else if(item.type == MessageType.Update) {
				curvin = item.network;
				hotpath = item.hotpath;
				sessionStorage.hotpath = JSON.stringify(hotpath);
				sessionStorage.curvin = JSON.stringify(curvin);
				processNetwork(curvin);
			}
		}       


		// NODE STYLES
		// ===============================================================================
		// colors: https://www.color-hex.com/ 
		// http://visjs.org/examples/network/other/chosen.html
		// view-source:http://visjs.org/examples/network/other/chosen.html
		var changeChosenNodeLabel = function(values, id, selected, hovering) {
			values.color = '#000000';
			//values.mod = 'bold';
		}

		var changeChosenNode = function(values, id, selected, hovering) {
			values.borderColor = '#000000';
		}

		var nc0 = {margin: 12, shape: 'circle', borderWidth: 2, borderWidthSelected: 2, chosen: {label: changeChosenNodeLabel, node: changeChosenNode},
			color: {background: '#ffffff', border: '#666666'}, 
			font: {multi: 'html', color: '#666666', face: 'Open Sans'}
		};


		// EDGE STYLES
		// ===============================================================================

		var ec0 = {length: 400, width: 1, color: {color: '#333333'}, dashes:false, arrows: {to: {enabled: true, scaleFactor: 0.5}}, chosen: {label: ccelOnClicked, edge: cceOnClicked}}; // default
		var ec1 = {color: {color: '#f9ce1c'}}; // changed
		var ec2 = {color: {color: '#333333'}, dashes:true}; // removed
		var ec3 = {color: {color: '#2cb77b'}}; // added
		var ec4 = {color: {color: '#ff1111'}}; // hotpath

		var cceOnClicked = function(values, id, selected, hovering) {
			values.width = 2;
			values.color = '#333333';
		};

		var ccelOnClicked = function(values, id, selected, hovering) {
			values.mod = 'bold';
		};

		var cceOnFromNodeClicked = function(values, id, selected, hovering) {
			values.width = 2;
			values.color = '#f95f6f';
		};

		var cceOnToNodeClicked = function(values, id, selected, hovering) {
			values.width = 2;
			values.color = '#00e5d4';
		};
				
		var echfrom = { chosen: {label: ccelOnClicked, edge: cceOnFromNodeClicked} };
		var echto = { chosen: {label: ccelOnClicked, edge: cceOnToNodeClicked} };


		function initNetwork(net) {            
			nodesDict = {};
			nodesArr = [];
			nodeNamesDict = {};
			edgesDict = {};
			edgesArr = [];
			nodeEdgeCounter = [];                                    
			
			var count = 1;
			for(var input in net) {
				nodesDict[input] = count;
				nodeNamesDict[input] = "x" + count;
				//console.log($('#legend').text());
				var text = $('#legend').html();
				// $('#legend').html(text + "</br>" + nodeNamesDict[input] + "   = " + input);
				$('#legend').html(text + "" + nodeNamesDict[input] + " = " + input + "&nbsp;&nbsp;&nbsp;");
				nodeEdgeCounter[input] = { from: 0, to: 0 };
				var obj = {};
				Object.assign(obj, nc0);
				obj.id = count;
				obj.label = '<b>' + nodeNamesDict[input] + '</b>';
				nodesArr.push(obj);
				count++;
			}          

			for(var input in net)  {                                             
				for(var target in net[input]) {
					if(net[input][target] < 0.2) continue;
					edgesDict[nodesDict[input] + "->" + nodesDict[target]] = {
						from: nodesDict[input], 
						to: nodesDict[target], 
						weight: net[input][target]
					};
					nodeEdgeCounter[input].from += 1;
					nodeEdgeCounter[target].to += 1;

					var obj = {};
					Object.assign(obj, ec0);
					obj.id = nodesDict[input] + "->" + nodesDict[target];
					obj.from = nodesDict[input];
					obj.to = nodesDict[target];                                        
					obj.label = net[input][target].toFixed(2);
					edgesArr.push(obj);
				}                
			} 
			
			// CUSTOM NODE POSITIONING ALG
			// sort and position nodes
			// sort by outgoing edges desc
			// bins = width / max(incoming edges)
			// foreach node: position = binPosition * incoming edges
			// nodeEdgeCounter = nodeEdgeCounter.sort(compareByTo);
			// var max = nodeEdgeCounter[Object.keys(nodeEdgeCounter)[Object.keys(nodeEdgeCounter).length-1]].to;
			
			var max = 0;
			for(var item in nodeEdgeCounter) {
				if(nodeEdgeCounter[item].to > max) max = nodeEdgeCounter[item].to
			}
			var padding = 400;
			var width = $('#vin').outerWidth() - padding;
			var binsize = Math.floor(width / max);

			for(var n in nodesArr) {
				var node = nodesArr[n];
				var count = nodeEdgeCounter[getByValue(nodesDict, node.id)].to;                
				//var position = {physics: false, fixed: {x: true}, x: padding / 2 + count * binsize };
				var position = {physics: false, fixed: {x: true}};
				Object.assign(node, position);
			}
			

			nodes = new vis.DataSet(nodesArr);
			edges = new vis.DataSet(edgesArr);

			container = document.getElementById('vin');
			data = {
				nodes: nodes,
				edges: edges
			};            

			var options = {
				layout: {
					hierarchical: {
						direction: "UD", // LR, 
						sortMethod: "directed",
						parentCentralization: true
					}
				}
			};
			network = new vis.Network(container, data, options);

			curEdgesArr = edgesArr;

			network.on('click', function(properties) {
				var clickedNodeIds = properties.nodes;
				var clickedNodes = nodes.get(clickedNodeIds);

				if(clickedNodes) {
					for(var _cn in clickedNodes) {                    
						var cn = clickedNodes[_cn];
						for(var _e in curEdgesArr) {
							var e = curEdgesArr[_e];                           
							if(e.from == cn.id) {
								Object.assign(e, echfrom);
							} else if(e.to == cn.id) {
								Object.assign(e, echto);
							}
						}
					}
				}

				data.edges.update(curEdgesArr);
			});
		}

		function processHotpath(hotpath, net) {
		
		}

		function processNetwork(net) {
			var newEdgesDict = {};
			var newEdgesArr = [];            
			// console.log(net);
			for(var input in net)  {
				// console.log(input);
				for(var target in net[input]) {
					if(net[input][target] < 0.2) continue;                    
					newEdgesDict[nodesDict[input] + "->" + nodesDict[target]] = {                        
						from: nodesDict[input], 
						to: nodesDict[target],                         
						weight: net[input][target]
					};
				}                
			}

			for(var e in edgesArr) {
				var e0 = edgesArr[e];
				var e1 = newEdgesDict[e0.id];
				var obj = {};
				if(e1) {                    
					// changed edge  
					Object.assign(obj, ec0);                  
					Object.assign(obj, ec1);
					//obj.id = e0.id;
					obj.id = e1.from + "->" + e1.to;
					obj.from = e1.from;
					obj.to = e1.to;                    
					obj.label = e1.weight.toFixed(2) + " (" + e0.label + ")";
					newEdgesArr.push(obj);

					// remove entry from dict
					delete newEdgesDict[e0.id];
				} else {
					// add removed edge
					Object.assign(obj, ec0);
					Object.assign(obj, ec2);
					obj.id =  e0.from + "->" + e0.to;
					obj.from = e0.from;
					obj.to = e0.to;                    
					obj.label = e0.label;
					newEdgesArr.push(obj);
				}                
			}            
			
			// add new edges (i.e. remaining edges in dict)
			for(var e in newEdgesDict) {
				var e1 = newEdgesDict[e];                
				var obj = {};
				Object.assign(obj, ec0);
				Object.assign(obj, ec3);
				obj.id = e1.from + "->" + e1.to;
				obj.from = e1.from;
				obj.to = e1.to;                    
				obj.label = e1.weight.toFixed(2);
				newEdgesArr.push(obj);
			}
						
			for(var _e in curEdgesArr) {
				if(!newEdgesArr[_e]) {
					data.edges.remove(curEdgesArr[_e].id);
				}
			}

			// handle current selection
			var selection = network.getSelection();             
			var selectedNodeId = -1;
			var selectedEdges = [];          
			for(var sn in selection.nodes) selectedNodeId = selection.nodes[sn];            

			for(var _e in newEdgesArr) {
				var e = newEdgesArr[_e];                
				if(e.from == selectedNodeId) {
					Object.assign(e, echfrom);
					selectedEdges.push(e.id);
				} else if(e.to == selectedNodeId) {
					Object.assign(e, echto);
					selectedEdges.push(e.id);
				}
				newEdgesArr[_e] = e;
			}

			curEdgesArr = newEdgesArr;            
			data.edges.update(curEdgesArr);
			network.selectNodes(selection.nodes, true);            
		}

		function compareByFrom(a,b) {
			if(a.from < b.from) return 1;
			if(a.from > b.from) return -1;
			return 0;
		}

		function compareByTo(a,b) {
			if(a.to < b.to) return -1;
			if(a.to > b.to) return 1;
			return 0;
		}

		function getByValue(dict, value) {
			for(var item in dict) {
				if(dict[item] == value) return item;
			}            
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
			$l.fadeOut(250, function() {
				$c.fadeIn(250);
			});
		}
	
		function isFunction(functionToCheck) {
			var getType = {};
			return functionToCheck && getType.toString.call(functionToCheck) === '[object Function]';
		}
	
		setTimeout(function() {
			changeState("Establishing connection to " + connStr, 250, 250, function() {
				client.connect(options);
			});
		}, 250);

		initSession();
	});