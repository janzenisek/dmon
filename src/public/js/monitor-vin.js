//document.addEventListener("DOMContentLoaded", function(e) {
	$(document).ready(function(){                
		// Create a client instance
		var wsbroker = "127.0.0.1";
		var wsport = 5000; // 15675
		var wspath = "/mqtt";
		// var connStr = wsbroker + ":" + wsport
		var connStr = wsbroker + ":" + wsport + wspath;
		var clientid = "myclientid_" + parseInt(Math.random() * 100, 10);
		// client = new Paho.MQTT.Client(wsbroker, wsport, "/ws", clientid);
		client = new Paho.MQTT.Client(wsbroker, wsport, wspath, clientid); // if using RabbitMQ, use port 15675 and path "/ws"
		var initiated = false;
		var group = "";
		var sources = [];

		var vin = null;
		var curvin = null;
		var network, nodes, edges, data, container, nodesDict, nodesArr, edgesDict, edgesArr, nodeNamesDict;
		var models, modelsDict;        
		var hotpath;
		var curEdgesArr;
		
		var initSession = function() {
			group = sessionStorage.group;
			vin = (sessionStorage.vin) ? JSON.parse(sessionStorage.vin) : null;
			curvin = (sessionStorage.curvin) ? JSON.parse(sessionStorage.curvin) : null;  
			hotpath = (sessionStorage.hotpath) ? JSON.parse(sessionStorage.hotpath) : null;      
			models = (sessionStorage.models) ? JSON.parse(sessionStorage.models) : null;
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
			item.models = _item.models;			
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
				models = {};
				group = item.group;
				hotpath = item.hotpath;
				models = item.models;
			}
			sessionStorage.group = group;

			if(item.type == MessageType.Init) {
				if(Object.keys(vin).length == 0 && vin.constructor === Object) {
					vin = item.network;
					models = item.models;
					sessionStorage.vin = JSON.stringify(vin);
					sessionStorage.hotpath = JSON.stringify(hotpath);
					sessionStorage.models = JSON.stringify(models);
					initNetwork(vin);					
				}
				/*if(Object.keys(curvin).length > 0 && curvin.constructor === Object) {
					processNetwork(curvin);
				}*/ 
				console.log("vin initiated.");
			} else if(item.type == MessageType.Update) {
				curvin = item.network;
				hotpath = item.hotpath;
				models = item.models;
				sessionStorage.hotpath = JSON.stringify(hotpath);
				sessionStorage.curvin = JSON.stringify(curvin);
				sessionStorage.models = JSON.stringify(models);
				processNetwork(curvin);				
				processHotpath(hotpath, curvin);
				console.log("vin updated.");				
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
		var ec4 = {color: {color: '#ff1111'}, width: 3}; // hotpath

		var cceOnClicked = function(values, id, selected, hovering) {
			values.width = 2;
			values.color = '#333333';
		};

		var ccelOnClicked = function(values, id, selected, hovering) {
			values.mod = 'bold';
		};

		var cceOnFromNodeClicked = function(values, id, selected, hovering) {
			values.width = 2;
			values.color = '#00e5d4'; //'#f95f6f';
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
			modelsDict = {};                                    
			
			$('#legend').html("");
			$('#model').html("");

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
						console.log("Clicked node: " + cn.id);						

						var nodeName = getByValue(nodesDict, cn.id);
						console.log("Node name: " + nodeName);
						
						$('#model').html("");
						if(models && models[nodeName]) {
							var mtext = nodeName + ' = ' + models[nodeName]
							//$('#model').html(mtext);

							// var formattedModel = formatExpressionAsHtml(mtext, Object.keys(nodesDict));							
							formattedModel = expressionToMathML(mtext, Object.keys(nodesDict), {
								    caseSensitive: true,
									display: "inline",
									showExplicitTimes: false,
									fractionDigits: 2 });

							$('#model').html(formattedModel);
						}

						// var nodeName = nodesDict.get(function(n) { return n === cn.id; });
						// console.log("Node name: " + nodeName);

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

		
		
		function formatExpressionAsHtml(expression, variableNames) {
			if (!expression) return '';
			
			var formatted = expression;
			
			// Format decimal numbers to 2 decimal places
			formatted = formatted.replace(/\b(\d+\.\d+)\b/g, function(match) {
				return parseFloat(match).toFixed(2);
			});
			
			// Highlight variables first (before adding any HTML tags)
			variableNames.forEach(function(variable) {
				var escapedVar = variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
				var regex = new RegExp('\\b(' + escapedVar + ')\\b', 'g');
				formatted = formatted.replace(regex, '{{VAR:$1}}');
			});
			
			// Replace mathematical functions
			formatted = formatted
				.replace(/\bsin\(/g, '{{FUNC:sin}}{{OP:(}}')
				.replace(/\bcos\(/g, '{{FUNC:cos}}{{OP:(}}')
				.replace(/\btan\(/g, '{{FUNC:tan}}{{OP:(}}')
				.replace(/\blog\(/g, '{{FUNC:log}}{{OP:(}}')
				.replace(/\bln\(/g, '{{FUNC:ln}}{{OP:(}}')
				.replace(/\bexp\(/g, '{{FUNC:exp}}{{OP:(}}')
				.replace(/\bsqrt\(/g, '{{SQRT}}{{OP:(}}')
				.replace(/\babs\(/g, '{{FUNC:abs}}{{OP:(}}');
			
			// Replace constants
			formatted = formatted
				.replace(/\bpi\b/g, '{{CONST:pi}}')
				.replace(/\be\b/g, '{{CONST:e}}')
				.replace(/\bi\b/g, '{{CONST:i}}')
				.replace(/\bPI\b/g, '{{CONST:PI}}');
			
			// Replace Greek letters
			formatted = formatted
				.replace(/\balpha\b/g, '{{GREEK:alpha}}')
				.replace(/\bbeta\b/g, '{{GREEK:beta}}')
				.replace(/\blambda\b/g, '{{GREEK:lambda}}')
				.replace(/\bgamma\b/g, '{{GREEK:gamma}}')
				.replace(/\bdelta\b/g, '{{GREEK:delta}}')
				.replace(/\btheta\b/g, '{{GREEK:theta}}');
			
			// Calculate parenthesis nesting levels
			var parenDepth = 0;
			var maxDepth = 0;
			var tempFormatted = '';
			
			for (var i = 0; i < formatted.length; i++) {
				if (formatted[i] === '(') {
					tempFormatted += '{{PAREN:' + parenDepth + ':OPEN}}';
					parenDepth++;
					if (parenDepth > maxDepth) maxDepth = parenDepth;
				} else if (formatted[i] === ')') {
					parenDepth--;
					tempFormatted += '{{PAREN:' + parenDepth + ':CLOSE}}';
				} else {
					tempFormatted += formatted[i];
				}
			}
			formatted = tempFormatted;
			
			// Replace operators
			formatted = formatted
				.replace(/\+/g, ' {{OP:+}} ')
				.replace(/-/g, ' {{OP:-}} ')
				.replace(/\*/g, ' {{OP:*}} ')
				.replace(/\//g, ' {{OP:/}} ')
				.replace(/\^/g, '{{OP:^}}');
			
			// Clean up extra spaces
			formatted = formatted.replace(/\s+/g, ' ');
			
			// Replace placeholders with actual HTML, with smaller sizes
			formatted = formatted
				.replace(/\{\{VAR:([^}]+)\}\}/g, '<i style="color: #1e40af; font-weight: 500;">$1</i>')
				.replace(/\{\{FUNC:([^}]+)\}\}/g, '<span style="color: #047857; font-weight: 500;">$1</span>')
				.replace(/\{\{SQRT\}\}/g, '<span style="color: #047857; font-weight: 500;">&radic;</span>')
				.replace(/\{\{CONST:pi\}\}/g, '<span style="color: #b91c1c; font-weight: 500;">&pi;</span>')
				.replace(/\{\{CONST:PI\}\}/g, '<span style="color: #b91c1c; font-weight: 500;">&pi;</span>')
				.replace(/\{\{CONST:e\}\}/g, '<i style="color: #b91c1c; font-weight: 500;">e</i>')
				.replace(/\{\{CONST:i\}\}/g, '<i style="color: #b91c1c; font-weight: 500;">i</i>')
				.replace(/\{\{GREEK:alpha\}\}/g, '<span style="color: #9333ea; font-weight: 500;">&alpha;</span>')
				.replace(/\{\{GREEK:beta\}\}/g, '<span style="color: #9333ea; font-weight: 500;">&beta;</span>')
				.replace(/\{\{GREEK:lambda\}\}/g, '<span style="color: #9333ea; font-weight: 500;">&lambda;</span>')
				.replace(/\{\{GREEK:gamma\}\}/g, '<span style="color: #9333ea; font-weight: 500;">&gamma;</span>')
				.replace(/\{\{GREEK:delta\}\}/g, '<span style="color: #9333ea; font-weight: 500;">&delta;</span>')
				.replace(/\{\{GREEK:theta\}\}/g, '<span style="color: #9333ea; font-weight: 500;">&theta;</span>')
				.replace(/\{\{OP:\+\}\}/g, '<span style="color: #c2410c; font-weight: 500; padding: 0 1px;">+</span>')
				.replace(/\{\{OP:-\}\}/g, '<span style="color: #c2410c; font-weight: 500; padding: 0 1px;">&minus;</span>')
				.replace(/\{\{OP:\*\}\}/g, '<span style="color: #c2410c; font-weight: 500; padding: 0 1px;">&times;</span>')
				.replace(/\{\{OP:\/\}\}/g, '<span style="color: #c2410c; font-weight: 500; padding: 0 1px;">&divide;</span>')
				.replace(/\{\{OP:\^\}\}/g, '<sup style="color: #c2410c; font-weight: 500;">^</sup>');
			
			// Replace parentheses with scaled sizes - reduced increment for compact display
			for (var depth = maxDepth - 1; depth >= 0; depth--) {
				var size = 14 + (maxDepth - depth - 1) * 2;
				var openRegex = new RegExp('\\{\\{PAREN:' + depth + ':OPEN\\}\\}', 'g');
				var closeRegex = new RegExp('\\{\\{PAREN:' + depth + ':CLOSE\\}\\}', 'g');
				formatted = formatted.replace(openRegex, '<span style="color: #334155; font-size: ' + size + 'px; font-weight: 500; vertical-align: middle;">(</span>');
				formatted = formatted.replace(closeRegex, '<span style="color: #334155; font-size: ' + size + 'px; font-weight: 500; vertical-align: middle;">)</span>');
			}

			return '<span style="font-family: \'STIX Two Text\', \'Cambria Math\', \'Times New Roman\', serif; font-size: 14px; color: #1e293b; letter-spacing: 0.2px; line-height: 1.4;">' + formatted + '</span>';
		}
		

		function processHotpath(hotpath, net) {			
			if(!hotpath || hotpath.length === 0) return;			

			var hotpathVars = [];
			for(var n in hotpath) {
				hotpathVars.push(nodeNamesDict[hotpath[n]]);
			}

			console.log(hotpath);
			console.log(hotpathVars);

			for(var i = 0; i < hotpath.length - 1; i++) {
				var fromNode = nodesDict[hotpath[i]];
				var toNode = nodesDict[hotpath[i+1]];
				var edgeId = fromNode + "->" + toNode;				

				var edge = curEdgesArr.find(function(e) {
					return e.id === edgeId;
				});
				
				if(edge) {
					Object.assign(edge, ec4);
					console.log("Hotpath edge: " + edge.id);
				}
				       
				data.edges.update(curEdgesArr);
			}
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












		//=====================



/**
 * Convert an infix math expression (with optional '=') into a MathML <math> element.
 *
 * Features:
 * - Operators: +, -, *, /, ^, =
 * - Unary + and -
 * - Parentheses: (...)
 * - Implicit multiplication: 2x, 3(x+1), a b
 * - Functions: sin, cos, tan, ln, log, exp, sqrt(arg), frac(a,b), root(x,n)
 * - Variable highlighting via a provided list
 * - Configurable fractional digits for numbers
 *
 * @param {string} expression - e.g., 'gridDiff2 = 0.4*pvProduction1 + 0.35*batterySOC1'
 * @param {string[]} variablesToHighlight - e.g., ['gridDiff1','gridDiff2','pvProduction1','batterySOC1']
 * @param {Object} [options]
 * @param {string} [options.highlightColor="#1976d2"] - CSS color for variables
 * @param {boolean} [options.caseSensitive=true] - Case sensitivity for variable matching
 * @param {"inline"|"block"} [options.display="inline"] - MathML display style
 * @param {boolean} [options.showExplicitTimes=false] - Show explicit multiplication dot
 * @param {number|null} [options.fractionDigits=null] - Number of fractional digits (null = keep original)
 * @returns {HTMLElement} - A <math> MathML element
 */
function expressionToMathML(expression, variablesToHighlight = [], options = {}) {
  const opt = {
    highlightColor: "#1976d2",
    caseSensitive: true,
    display: "inline",
    showExplicitTimes: false,
    fractionDigits: null, // NEW: number of fractional digits
    ...options,
  };

  const MATHML_NS = "http://www.w3.org/1998/Math/MathML";

  // Sanitize input: trim and remove surrounding quotes
  let src = String(expression ?? "").trim();
  if ((src.startsWith('"') && src.endsWith('"')) || (src.startsWith("'") && src.endsWith("'"))) {
    src = src.slice(1, -1).trim();
  }

  // --- Utility to create MathML elements ---
  function mel(name, attrs = {}, ...children) {
    const el = document.createElementNS(MATHML_NS, name);
    for (const [k, v] of Object.entries(attrs)) {
      if (v != null) el.setAttribute(k, String(v));
    }
    for (const c of children) {
      if (c == null) continue;
      if (typeof c === "string") el.appendChild(document.createTextNode(c));
      else el.appendChild(c);
    }
    return el;
  }

  function miIdentifier(name) {
    const matchName = opt.caseSensitive ? name : name.toLowerCase();
    const highlightSet = new Set(
      (opt.caseSensitive ? variablesToHighlight : variablesToHighlight.map(s => s.toLowerCase()))
    );
    const attrs = {};
    if (highlightSet.has(matchName)) {
      attrs.style = `color: ${opt.highlightColor};`;
    }
    return mel("mi", attrs, name);
  }

  // --- Tokenizer ---
  function tokenize(text) {
    const tokens = [];
    let i = 0;

    function isWhitespace(ch) { return /\s/.test(ch); }
    function isDigit(ch) { return ch >= "0" && ch <= "9"; }
    function isIdentStart(ch) { return /[A-Za-z_]/.test(ch); }
    function isIdentPart(ch) { return isIdentStart(ch) || isDigit(ch); }

    while (i < text.length) {
      const ch = text[i];

      if (isWhitespace(ch)) { i++; continue; }

      // Number
      if (isDigit(ch) || (ch === "." && isDigit(text[i + 1] || ""))) {
        const start = i;
        let s = "";
        while (isDigit(text[i] || "")) s += text[i++];
        if (text[i] === ".") {
          s += text[i++];
          while (isDigit(text[i] || "")) s += text[i++];
        }
        if ((text[i] === "e" || text[i] === "E")) {
          const eIdx = i;
          let t = text[i++];
          if (text[i] === "+" || text[i] === "-") t += text[i++];
          let digits = "";
          while (isDigit(text[i] || "")) digits += text[i++];
          if (digits.length === 0) i = eIdx;
          else s += t + digits;
        }
        tokens.push({ type: "number", value: s, start, end: i });
        continue;
      }

      // Identifier
      if (isIdentStart(ch)) {
        const start = i;
        let s = text[i++];
        while (isIdentPart(text[i] || "")) s += text[i++];
        tokens.push({ type: "ident", value: s, start, end: i });
        continue;
      }

      // Parentheses & comma
      if (ch === "(") { tokens.push({ type: "lparen", value: "(", start: i, end: i + 1 }); i++; continue; }
      if (ch === ")") { tokens.push({ type: "rparen", value: ")", start: i, end: i + 1 }); i++; continue; }
      if (ch === ",") { tokens.push({ type: "comma", value: ",", start: i, end: i + 1 }); i++; continue; }

      // Operators
      if ("+-*/^=".includes(ch)) {
        tokens.push({ type: "op", value: ch, start: i, end: i + 1 });
        i++;
        continue;
      }

      throw new SyntaxError(`Unexpected character "${ch}" at index ${i}`);
    }

    tokens.push({ type: "eof", value: "", start: i, end: i });
    return tokens;
  }

  const tokens = tokenize(src);
  let pos = 0;

  function current() { return tokens[pos]; }
  function next() { return tokens[pos++]; }
  function peekIs(type, value) {
    const t = current();
    if (!t || t.type !== type) return false;
    if (value !== undefined) return t.value === value;
    return true;
  }
  function expect(type, value) {
    if (!peekIs(type, value)) throw new SyntaxError(`Expected ${type} ${value ?? ""}`);
    return next();
  }

  // --- Parser ---
  function parseExpression() {
    const node = parseEquality();
    if (!peekIs("eof")) throw new SyntaxError(`Unexpected token "${current().value}"`);
    return node;
  }

  function parseEquality() {
    let node = parseSum();
    while (peekIs("op", "=")) {
      next();
      const rhs = parseSum();
      node = { type: "binary", op: "=", left: node, right: rhs };
    }
    return node;
  }

  function parseSum() {
    let node = parseProduct();
    while (peekIs("op", "+") || peekIs("op", "-")) {
      const op = next().value;
      const rhs = parseProduct();
      node = { type: "binary", op, left: node, right: rhs };
    }
    return node;
  }

  function parseProduct() {
    let node = parsePower();
    while (true) {
      if (peekIs("op", "*") || peekIs("op", "/")) {
        const op = next().value;
        const rhs = parsePower();
        node = { type: "binary", op, left: node, right: rhs };
        continue;
      }
      if (peekIs("number") || peekIs("ident") || peekIs("lparen")) {
        const rhs = parsePower();
        node = { type: "binary", op: "*", left: node, right: rhs, implicit: true };
        continue;
      }
      break;
    }
    return node;
  }

  function parsePower() {
    let node = parseUnary();
    if (peekIs("op", "^")) {
      next();
      const rhs = parsePower();
      node = { type: "binary", op: "^", left: node, right: rhs };
    }
    return node;
  }

  function parseUnary() {
    if (peekIs("op", "+") || peekIs("op", "-")) {
      const op = next().value;
      const arg = parseUnary();
      return op === "+" ? arg : { type: "unary", op, arg };
    }
    return parsePrimary();
  }

  function parsePrimary() {
    if (peekIs("number")) {
      const t = next();
      return { type: "number", value: t.value };
    }
    if (peekIs("ident")) {
      const ident = next().value;
      if (peekIs("lparen")) {
        next();
        const args = [];
        if (!peekIs("rparen")) {
          args.push(parseSum());
          while (peekIs("comma")) {
            next();
            args.push(parseSum());
          }
        }
        expect("rparen");
        return { type: "call", name: ident, args };
      }
      return { type: "identifier", name: ident };
    }
    if (peekIs("lparen")) {
      next();
      const exprNode = parseSum();
      expect("rparen");
      return { type: "group", expr: exprNode };
    }
    throw new SyntaxError(`Unexpected token "${current().value}"`);
  }

  const ast = parseExpression();

  // --- MathML builder ---
  function ensureMrow(child) {
    const tag = child.nodeName.toLowerCase();
    return ["mrow","mi","mn","mo","msqrt","mfrac","msup","mroot"].includes(tag) ? child : mel("mrow", {}, child);
  }

  function build(node) {
    switch (node.type) {
      case "number": {
        let val = node.value;
        if (opt.fractionDigits !== null && !isNaN(val)) {
          val = Number(val).toFixed(opt.fractionDigits);
        }
        return mel("mn", {}, val);
      }
      case "identifier": return miIdentifier(node.name);
      case "group": return mel("mrow", {}, mel("mo", {}, "("), build(node.expr), mel("mo", {}, ")"));
      case "unary": return mel("mrow", {}, mel("mo", {}, node.op === "-" ? "−" : ""), build(node.arg));
      case "binary": {
        const L = build(node.left), R = build(node.right);
        if (node.op === "+") return mel("mrow", {}, L, mel("mo", {}, "+"), R);
        if (node.op === "-") return mel("mrow", {}, L, mel("mo", {}, "−"), R);
        if (node.op === "=") return mel("mrow", {}, L, mel("mo", {}, "="), R);
        if (node.op === "*") {
          const times = node.implicit && !opt.showExplicitTimes ? "\u2062" : "·";
          return mel("mrow", {}, L, mel("mo", {}, times), R);
        }
        if (node.op === "/") return mel("mfrac", {}, ensureMrow(L), ensureMrow(R));
        if (node.op === "^") return mel("msup", {}, ensureMrow(L), ensureMrow(R));
      }
      case "call": {
        const fname = node.name;
        const args = node.args.map(build);
        if (fname === "sqrt" && args.length === 1) return mel("msqrt", {}, ensureMrow(args[0]));
        if (fname === "root" && args.length === 2) return mel("mroot", {}, ensureMrow(args[0]), ensureMrow(args[1]));
        if (fname === "frac" && args.length === 2) return mel("mfrac", {}, ensureMrow(args[0]), ensureMrow(args[1]));
        const apply = mel("mo", {}, "\u2061");
        const argsRow = [mel("mo", {}, "(")];
        args.forEach((a, i) => { if (i > 0) argsRow.push(mel("mo", {}, ",")); argsRow.push(a); });
        argsRow.push(mel("mo", {}, ")"));
        return mel("mrow", {}, mel("mi", { mathvariant: "normal" }, fname), apply, ...argsRow);
      }
    }
  }

  const math = mel("math", { display: opt.display });
  math.appendChild(build(ast));
  return math;
}

// Example usage:
// const expr = 'gridDiff2 = 0.4*pvProduction1 + 0.35*batterySOC1';
// const vars = ['gridDiff2','pvProduction1','batterySOC1'];
// document.body.appendChild(expressionToMathML(expr, vars, { fractionDigits: 2, highlightColor: '#e91e63', display: 'block' }));



		//=====================
	













		setTimeout(function() {
			changeState("Establishing connection to " + connStr, 250, 250, function() {
				client.connect(options);
			});
		}, 250);

		initSession();
	});