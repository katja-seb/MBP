/* global app */

'use strict';

/**
 * Directive for a modeling tool that can be used for creating and editing IoT environment models.
 */
app.directive('envModelTool',
    ['ENDPOINT_URI', '$timeout', '$q', '$controller', 'ModelService', 'ComponentService', 'DeviceService', 'CrudService',
        function (ENDPOINT_URI, $timeout, $q, $controller, ModelService, ComponentService, DeviceService, CrudService) {

            function initialize(scope) {
                const DIAGRAM_CONTAINER = $("#toolCanvasContainer");
                const CANVAS = $("#canvas");
                let MARKING_RECT_CONTAINER = $(null);
                let MARKING_RECT = $(null);
                let jsPlumbInstance;
                let elementIdCount = 0; // used for canvas ID uniqueness
                let properties = {}; // keeps the properties of each element to draw on canvas
                let element = ""; // the element which will be appended to the canvas
                let deletionPromises = [];
                let clicked = false; // true if an element from the palette was clicked
                let isMoving = false; //Remembers if the user is currently moving or modifying an element
                let markingRectPos = { //Remembers the position of the marking rect
                    x: 0,
                    y: 0
                };

                //Stacks for Undo and Redo functions
                let historyStack = [];
                let futureStack = [];

                //Expose fields for template
                scope.processing = {}; // used to show/hide the progress circle
                scope.selectedOptionName = "";
                scope.loadedModels = [];
                scope.currentModel = {};
                scope.clickedComponent = {};
                scope.adapterListCtrl = $controller('ItemListController as adapterListCtrl', {
                    $scope: scope,
                    list: []
                });

                //Expose functions for template
                scope.drawModel = drawModel;
                scope.api.undo = undoAction;
                scope.api.redo = redoAction;

                // On initialization load the models from the database
                (function initController() {
                    initMarkingRect();
                })();


                /*
                 * Define the types and look of the nodes and connections
                 */

                jsPlumbInstance = window.jsp = jsPlumb.getInstance({
                    Endpoint: ["Dot", {
                        radius: 2
                    }],
                    Connector: "StateMachine",
                    HoverPaintStyle: {
                        strokeWidth: 3
                    },
                    ConnectionOverlays: [
                        ["Label", {
                            label: "NAME",
                            id: "label",
                            cssClass: "aLabel",
                            visible: false
                        }]
                    ],
                    Container: "canvas"
                });

                let basicType = {
                    anchor: "Continuous",
                    connector: "StateMachine"
                };

                jsPlumbInstance.registerConnectionType("basic", basicType);

                let sourceEndpoint = {
                    filter: ".ep",
                    anchor: "Continuous",
                    connectorStyle: {
                        stroke: "#000000",
                        strokeWidth: 2
                    },
                    connectionType: "basic"
                };

                let targetEndpoint = {
                    dropOptions: {
                        hoverClass: "dragHover"
                    },
                    anchor: "Continuous",
                    allowLoopback: false
                };

                /**
                 * Initializes the marking rectangle.
                 */
                function initMarkingRect() {
                    //Create marking rect elements
                    MARKING_RECT = $('<div class="markingRect">');
                    MARKING_RECT_CONTAINER = $('<div class="markingRectContainer">').hide();

                    //Append elements to canvas
                    CANVAS.append(MARKING_RECT_CONTAINER.append(MARKING_RECT));
                }

                /**
                 * Makes the given element rotatable.
                 *
                 * @param element The element to rotate
                 */
                function makeRotatable(element) {
                    //Check if rotatability may be just enabled again
                    if (element.has(".ui-rotatable-handle").length) {
                        element.rotatable("enable").find('.ui-rotatable-handle').show();
                        return;
                    }

                    let rotateOptions = {
                        handleOffset: {'top': 5, 'left': 5},
                        rotate: function (el) {
                            jsPlumbInstance.revalidate(el);
                        },
                        start: () => (isMoving = true),
                        stop: function (el, event) {

                            //Save final rotation angle
                            element.data("angle", event.angle.stop);

                            //Unset moving flag
                            $timeout(() => (isMoving = false), 200);

                            //Write model to history stack
                            writeModelToHistoryStack();
                        },
                        snap: true,
                        step: 22.5
                    };

                    element.rotatable(rotateOptions);
                }

                /*
                 * jQuery makes the given element resizable.
                 *
                 * @param element The element to resize
                 */
                function makeResizable(element) {
                    //Check if resizability may be just enabled again
                    if (element.hasClass("ui-resizable-disabled")) {
                        element.resizable("enable");
                        return;
                    }

                    //Make element resizable
                    element.resizable({
                        //Check if aspect ratio needs to be preserved
                        aspectRatio: (!element.hasClass("free-resize")),
                        resize: (event, ui) => jsPlumbInstance.revalidate(ui.helper),
                        start: () => (isMoving = true),
                        stop: function (el, event) {
                            //Unset moving flag
                            $timeout(() => (isMoving = false), 200);

                            //Write model to history stack
                            writeModelToHistoryStack();
                        },
                        handles: "all"
                    });
                }

                /*
                 * jQuery makes the element draggable
                 */
                function makeDraggable(id, className) {

                    $(id).draggable({
                        helper: () => {
                            return $("<div/>", {
                                class: className
                            })
                        },
                        revert: false
                    });
                }


                /*
                 * Make all the elements from the palette draggable
                 */
                makeDraggable("#roomFloorplan", "window floorplan room-floorplan custom");
                makeDraggable("#wallFloorplan", "window floorplan wall-floorplan custom");
                makeDraggable("#doorFloorplan", "window floorplan door-floorplan custom");
                makeDraggable("#windowFloorplan", "window floorplan window-floorplan custom");
                makeDraggable("#stairsFloorplan", "window floorplan stairs-floorplan custom");
                makeDraggable("#tableFloorplan", "window floorplan table-floorplan custom");
                makeDraggable("#chairFloorplan", "window floorplan chair-floorplan custom");
                makeDraggable("#couchFloorplan", "window floorplan couch-floorplan custom");
                makeDraggable("#bedFloorplan", "window floorplan bed-floorplan custom");
                makeDraggable("#kitchenSinkFloorplan", "window floorplan kitchen-sink-floorplan custom");
                makeDraggable("#bathtubFloorplan", "window floorplan bathtub-floorplan custom");
                makeDraggable("#bathSinkFloorplan", "window floorplan bath-sink-floorplan custom");
                makeDraggable("#toiletFloorplan", "window floorplan toilet-floorplan custom");

                makeDraggable("#raspberryPiDevice", "window device raspberry-pi-device custom");
                makeDraggable("#arduinoDevice", "window device arduino-device custom");
                makeDraggable("#computerDevice", "window device computer-device custom");
                makeDraggable("#laptopDevice", "window device laptop-device custom");
                makeDraggable("#tvDevice", "window device tv-device custom");
                makeDraggable("#smartphoneDevice", "window device smartphone-device custom");
                makeDraggable("#smartwatchDevice", "window device smartwatch-device custom");
                makeDraggable("#audioSystemDevice", "window device audio-system-device custom");
                makeDraggable("#voiceControllerDevice", "window device voice-controller-device custom");
                makeDraggable("#cameraDevice", "window device camera-device custom");
                makeDraggable("#defaultDevice", "window device default-device custom");

                makeDraggable("#lightActuator", "window actuator light-actuator custom");
                makeDraggable("#ledActuator", "window actuator led-actuator custom");
                makeDraggable("#speakerActuator", "window actuator speaker-actuator custom");
                makeDraggable("#buzzerActuator", "window actuator buzzer-actuator custom");
                makeDraggable("#vibrationActuator", "window actuator vibration-actuator custom");
                makeDraggable("#heaterActuator", "window actuator heater-actuator custom");
                makeDraggable("#airConditionerActuator", "window actuator air-conditioner-actuator custom");
                makeDraggable("#switchActuator", "window actuator switch-actuator custom");
                makeDraggable("#motorActuator", "window actuator motor-actuator custom");
                makeDraggable("#defaultActuator", "window actuator default-actuator custom");

                makeDraggable("#cameraSensor", "window sensor camera-sensor custom");
                makeDraggable("#soundSensor", "window sensor sound-sensor custom");
                makeDraggable("#temperatureSensor", "window sensor temperature-sensor custom");
                makeDraggable("#humiditySensor", "window sensor humidity-sensor custom");
                makeDraggable("#gasSensor", "window sensor gas-sensor custom");
                makeDraggable("#lightSensor", "window sensor light-sensor custom");
                makeDraggable("#motionSensor", "window sensor motion-sensor custom");
                makeDraggable("#locationSensor", "window sensor location-sensor custom");
                makeDraggable("#gyroscopeSensor", "window sensor gyroscope-sensor custom");
                makeDraggable("#proximitySensor", "window sensor proximity-sensor custom");
                makeDraggable("#touchSensor", "window sensor touch-sensor custom");
                makeDraggable("#vibrationSensor", "window sensor vibration-sensor custom");
                makeDraggable("#defaultSensor", "window sensor default-sensor custom");

                // jQuery makes the canvas droppable
                CANVAS.droppable({
                    accept: ".window",
                    drop: function (event, ui) {
                        if (clicked) {
                            // Get the drop position
                            properties.left = ui.offset.left - $(this).offset().left;
                            properties.top = ui.offset.top - $(this).offset().top;
                            clicked = false;
                            elementIdCount++;
                            let id = "canvasWindow" + elementIdCount;
                            // Create and draw the element in the canvas
                            element = createElement(id);
                            drawElement(element);

                            //Write model to history stack
                            writeModelToHistoryStack();
                        }
                    }
                });

                /*
                 * Temporary saved properties of clicked element in palette
                 * The data is used to create the element on drop
                 */
                function loadProperties(clsName, type) {
                    properties = {};
                    properties.clsName = clsName;
                    properties.type = type;
                    clicked = true;
                }


                /*
                 * Load properties of an element once the element in the palette is clicked
                 */

                // Floorplan
                $('#roomFloorplan').mousedown(function () {
                    loadProperties("window floorplan room-floorplan custom free-resize jtk-node", undefined);
                });

                $('#wallFloorplan').mousedown(function () {
                    loadProperties("window floorplan wall-floorplan custom free-resize jtk-node", undefined);
                });

                $('#doorFloorplan').mousedown(function () {
                    loadProperties("window floorplan door-floorplan custom jtk-node", undefined);
                });

                $('#windowFloorplan').mousedown(function () {
                    loadProperties("window floorplan window-floorplan custom jtk-node", undefined);
                });

                $('#stairsFloorplan').mousedown(function () {
                    loadProperties("window floorplan stairs-floorplan custom jtk-node", undefined);
                });

                $('#tableFloorplan').mousedown(function () {
                    loadProperties("window floorplan table-floorplan custom jtk-node", undefined);
                });

                $('#chairFloorplan').mousedown(function () {
                    loadProperties("window floorplan chair-floorplan custom jtk-node", undefined);
                });

                $('#couchFloorplan').mousedown(function () {
                    loadProperties("window floorplan couch-floorplan custom jtk-node", undefined);
                });

                $('#bedFloorplan').mousedown(function () {
                    loadProperties("window floorplan bed-floorplan custom jtk-node", undefined);
                });

                $('#kitchenSinkFloorplan').mousedown(function () {
                    loadProperties("window floorplan kitchen-sink-floorplan custom jtk-node", undefined);
                });

                $('#bathtubFloorplan').mousedown(function () {
                    loadProperties("window floorplan bathtub-floorplan custom jtk-node", undefined);
                });

                $('#bathSinkFloorplan').mousedown(function () {
                    loadProperties("window floorplan bath-sink-floorplan custom jtk-node", undefined);
                });

                $('#toiletFloorplan').mousedown(function () {
                    loadProperties("window floorplan toilet-floorplan custom jtk-node", undefined);
                });

                // Devices
                $('#raspberryPiDevice').mousedown(function () {
                    loadProperties("window device raspberry-pi-device custom jtk-node", "Raspberry Pi");
                });

                $('#arduinoDevice').mousedown(function () {
                    loadProperties("window device arduino-device custom jtk-node", "Arduino");
                });

                $('#computerDevice').mousedown(function () {
                    loadProperties("window device computer-device custom jtk-node", "Computer");
                });

                $('#laptopDevice').mousedown(function () {
                    loadProperties("window device laptop-device custom jtk-node", "Laptop");
                });

                $('#tvDevice').mousedown(function () {
                    loadProperties("window device tv-device custom jtk-node", "TV");
                });

                $('#smartphoneDevice').mousedown(function () {
                    loadProperties("window device smartphone-device custom jtk-node", "Smartphone");
                });

                $('#smartwatchDevice').mousedown(function () {
                    loadProperties("window device smartwatch-device custom jtk-node", "Smartwatch");
                });

                $('#audioSystemDevice').mousedown(function () {
                    loadProperties("window device audio-system-device custom jtk-node", "Audio System");
                });

                $('#voiceControllerDevice').mousedown(function () {
                    loadProperties("window device voice-controller-device custom jtk-node", "Voice Controller");
                });

                $('#cameraDevice').mousedown(function () {
                    loadProperties("window device camera-device custom jtk-node", "Camera");
                });

                $('#defaultDevice').mousedown(function () {
                    loadProperties("window device default-device custom jtk-node", undefined);
                });

                // Actuators
                $('#lightActuator').mousedown(function () {
                    loadProperties("window actuator light-actuator custom jtk-node", "Light");
                });

                $('#ledActuator').mousedown(function () {
                    loadProperties("window actuator led-actuator custom jtk-node", "LED");
                });

                $('#speakerActuator').mousedown(function () {
                    loadProperties("window actuator speaker-actuator custom jtk-node", "Speaker");
                });

                $('#buzzerActuator').mousedown(function () {
                    loadProperties("window actuator buzzer-actuator custom jtk-node", "Buzzer");
                });

                $('#vibrationActuator').mousedown(function () {
                    loadProperties("window actuator vibration-actuator custom jtk-node", "Vibration");
                });

                $('#heaterActuator').mousedown(function () {
                    loadProperties("window actuator heater-actuator custom jtk-node", "Heater");
                });

                $('#airConditionerActuator').mousedown(function () {
                    loadProperties("window actuator air-conditioner-actuator custom jtk-node", "Air Conditioner");
                });

                $('#switchActuator').mousedown(function () {
                    loadProperties("window actuator switch-actuator custom jtk-node", "Switch");
                });

                $('#motorActuator').mousedown(function () {
                    loadProperties("window actuator motor-actuator custom jtk-node", "Motor");
                });

                $('#defaultActuator').mousedown(function () {
                    loadProperties("window actuator default-actuator custom jtk-node", undefined);
                });

                // Sensors
                $('#cameraSensor').mousedown(function () {
                    loadProperties("window sensor camera-sensor custom jtk-node", "Camera");
                });

                $('#soundSensor').mousedown(function () {
                    loadProperties("window sensor sound-sensor custom jtk-node", "Sound");
                });

                $('#temperatureSensor').mousedown(function () {
                    loadProperties("window sensor temperature-sensor custom jtk-node", "Temperature");
                });

                $('#humiditySensor').mousedown(function () {
                    loadProperties("window sensor humidity-sensor custom jtk-node", "Humidity");
                });

                $('#gasSensor').mousedown(function () {
                    loadProperties("window sensor gas-sensor custom jtk-node", "Gas");
                });

                $('#lightSensor').mousedown(function () {
                    loadProperties("window sensor light-sensor custom jtk-node", "Light");
                });

                $('#motionSensor').mousedown(function () {
                    loadProperties("window sensor motion-sensor custom jtk-node", "Motion");
                });

                $('#locationSensor').mousedown(function () {
                    loadProperties("window sensor location-sensor custom jtk-node", "Location");
                });

                $('#gyroscopeSensor').mousedown(function () {
                    loadProperties("window sensor gyroscope-sensor custom jtk-node", "Gyroscope");
                });

                $('#proximitySensor').mousedown(function () {
                    loadProperties("window sensor proximity-sensor custom jtk-node", "Proximity");
                });

                $('#touchSensor').mousedown(function () {
                    loadProperties("window sensor touch-sensor custom jtk-node", "Touch");
                });

                $('#vibrationSensor').mousedown(function () {
                    loadProperties("window sensor vibration-sensor custom jtk-node", "Vibration");
                });

                $('#defaultSensor').mousedown(function () {
                    loadProperties("window sensor default-sensor custom jtk-node", undefined);
                });

                /**
                 * Create an element to be drawn on the canvas with a certain id.
                 */
                function createElement(id) {
                    //Create element
                    let element = $('<div>').attr('id', id).addClass(properties.clsName);

                    // The position to create the dropped element
                    element.css({
                        'top': properties.top,
                        'left': properties.left
                    });

                    // Increase the size of room
                    if (element.hasClass("room-floorplan")) {
                        element.css({width: '50px', height: '50px'}).animate({
                            width: '250px',
                            height: '250px'
                        }, 1000);
                    }
                    // Add connection square on device
                    if (properties.clsName.indexOf("device") > -1) {
                        element.append("<div class=\"ep\"></div>");
                    }

                    if (properties.type) {
                        element.data("type", properties.type);
                    }

                    //Remove focus from all elements
                    clearFocus();

                    //Put focus on the new element
                    focusElement(element);

                    return element;
                }


                /**
                 * Create an element from a given node to be drawn on the canvas with a certain id.
                 */
                function createElementFromNode(id, node) {
                    //Create element
                    let element = $('<div>').attr('id', id).addClass(node.clsName);

                    // The position to create the element
                    element.css({
                        'left': node.left,
                        'top': node.top
                    });

                    // Define the size of the element
                    element.outerWidth(node.width);
                    element.outerHeight(node.height);

                    // Set rotation angle
                    if (node.angle) {
                        element.data("angle", node.angle);
                        //TODO
                        //setAngle(element, false);
                    }

                    // Append the data to the element
                    element.data(node);

                    //Append ep if device
                    if (node.nodeType === "device") {
                        element.append("<div class=\"ep\"></div>");
                    }

                    return element;
                }

                /*
                 * Draw/append the element on the canvas
                 */
                function drawElement($element) {
                    CANVAS.append($element);
                    // Make the element on the canvas draggable
                    jsPlumbInstance.draggable(jsPlumbInstance.getSelector(".jtk-node"), {
                        filter: ".ui-resizable-handle",
                        start: function (event) {
                            //Remove focus from all events
                            clearFocus();

                            //Put focus on dragged element
                            focusElement($element);
                        },
                        stop: function (event) {
                            //Write model to history stack
                            writeModelToHistoryStack();
                        }
                    });

                    addEndpoints($element);
                }

                /*
                 * Define the sources and targets for making connections
                 */
                function addEndpoints(element) {
                    let type = element.attr('class').toString().split(" ")[1];
                    if (type === "device") {
                        targetEndpoint.maxConnections = -1;
                        jsPlumbInstance.makeSource(element, sourceEndpoint);
                        jsPlumbInstance.makeTarget(element, targetEndpoint);
                    } else if (type === "actuator" || type === "sensor") {
                        targetEndpoint.maxConnections = 1;
                        jsPlumbInstance.makeTarget(element, targetEndpoint);
                    }
                }

                // In case the diagram container is clicked
                DIAGRAM_CONTAINER.on("click", function (event) {
                    //Ensure that user is not currently moving an element
                    if (isMoving) {
                        return;
                    }

                    //Get element
                    let element = $(event.target).filter('.jtk-node');

                    //Sanity check
                    if (!element.length) {
                        return;
                    }

                    //Remove focus from all elements
                    clearFocus();

                    //Put focus on the clicked element
                    focusElement(element);
                });

                // In case a key is pressed
                $(document).on("keydown", function (event) {
                    //Check for pressed key
                    switch (event.which) {
                        //DEL key
                        case 46:
                            deleteFocusedElements();
                            break;
                        //Arrow left key
                        case 37:
                            moveFocusedElements("left", 3);
                            break;
                        //Arrow up key
                        case 38:
                            moveFocusedElements("up", 3);
                            break;
                        //Arrow right key
                        case 39:
                            moveFocusedElements("right", 3);
                            break;
                        //Arrow down key
                        case 40:
                            moveFocusedElements("down", 3);
                            break;
                        default:
                            return;
                    }

                    //Key event was processed, so prevent default behaviour
                    event.preventDefault();
                });

                // Events of the canvas
                CANVAS.on('click', function (e) {
                    //Save data from input fields to the corresponding element
                    saveData();
                }).on('mousedown', function (e) {
                    //Make sure canvas is the actual target
                    if (!$(e.target).hasClass("jtk-canvas")) {
                        return;
                    }

                    //Save starting position of the marking rect
                    markingRectPos.x = e.offsetX;
                    markingRectPos.y = e.offsetY;

                    MARKING_RECT.css({
                        left: e.offsetX + 'px',
                        top: e.offsetY + 'px'
                    }).width(0).height(0);

                    //Display marking rect
                    MARKING_RECT_CONTAINER.css('display', '');

                }).on('mousemove', function (e) {
                    //Do not mark if an element is currently moved
                    if (isMoving) {
                        MARKING_RECT_CONTAINER.hide();
                        return;
                    }

                    let posX = Math.min(markingRectPos.x, e.offsetX);
                    let posY = Math.min(markingRectPos.y, e.offsetY);
                    let width = Math.abs(markingRectPos.x - e.offsetX);
                    let height = Math.abs(markingRectPos.y - e.offsetY);

                    MARKING_RECT.css({
                        left: posX + 'px',
                        top: posY + 'px',
                        width: width + 'px',
                        height: height + 'px'
                    });
                });
                $('body').on('mouseup', function (e) {

                    if (isMoving) {
                        //Hide marking rect
                        MARKING_RECT_CONTAINER.hide();
                        return;
                    }

                    //Get final rect dimensions
                    let markPosition = MARKING_RECT.position();
                    let markWidth = MARKING_RECT.width();
                    let markHeight = MARKING_RECT.height();

                    //Remove focus from all elements
                    clearFocus();

                    //Get all selectable nodes
                    $('.jtk-node').each(function () {
                        let node = $(this);
                        let nodePosition = node.position();
                        let nodeWidth = node.width();
                        let nodeHeight = node.height();

                        //Check if node is within the mark
                        if ((markPosition.left < nodePosition.left)
                            && (markPosition.top < nodePosition.top)
                            && ((markPosition.left + markWidth) > (nodePosition.left + nodeWidth))
                            && ((markPosition.top + markHeight) > (nodePosition.top + nodeHeight))) {
                            //Put focus on node
                            focusElement(node);
                        }
                    });

                    //Hide marking rect
                    MARKING_RECT_CONTAINER.hide();
                });

                /**
                 * Moves all currently focused elements in a certain direction for a given number of pixels.
                 * @param direction The direction (left, up, right, down) in which to move the elements:
                 * @param pixels The absolute number of pixels to move the element
                 */
                function moveFocusedElements(direction, pixels) {
                    //Sanity check for pixels
                    pixels = Math.abs(pixels || 0);

                    //Remember move distance for each direction
                    let moveX = "+=0";
                    let moveY = "+=0";

                    switch (direction) {
                        case "left":
                            moveX = "-=" + pixels;
                            break;
                        case "up":
                            moveY = "-=" + pixels;
                            break;
                        case "right":
                            moveX = "+=" + pixels;
                            break;
                        case "down":
                            moveY = "+=" + pixels;
                            break;
                    }

                    //Get elements with focus and move them
                    $('.clicked-element').animate({
                        left: moveX,
                        top: moveY
                    }, 10).each(function () {
                        //Revalidate with jsPlumb
                        jsPlumbInstance.revalidate($(this));
                    });
                }

                /**
                 * Deletes all currently focused elements.
                 */
                function deleteFocusedElements() {
                    //Get elements with focus and delete them
                    $('.clicked-element').each(function () {
                        deleteElement($(this));
                    });
                }

                /**
                 * Puts the focus on a given element. Focused elements become resizable and rotatable.
                 * @param element The element to focus
                 */
                function focusElement(element) {
                    //Sanity check
                    if ((element === null) || (element.length < 1)) {
                        return;
                    }

                    // Load the corresponding data to show it in the tool
                    loadData(element);

                    //Make element resizable
                    makeResizable(element);

                    //Make element rotatable
                    makeRotatable(element);

                    // Put focus on element
                    element.addClass("clicked-element");
                }

                /**
                 * Removes the focus from all elements. This also disables resizability and rotatability of the
                 * affected elements.
                 */
                function clearFocus() {
                    //Get all focused elements and remove focus, resizability and rotatability
                    $('.clicked-element')
                        .removeClass('clicked-element')
                        .resizable("disable")
                        .rotatable("disable")
                        .find('.ui-rotatable-handle')
                        .hide();
                }


                /*
                 * Rotate the element with css
                 */
                function setAngle(element, rotate) {
                    let angle = 0;
                    if (rotate) {
                        angle = (element.data('angle') + 90) || 90;
                    } else {
                        angle = element.data("angle");
                    }
                    element.css({
                        '-webkit-transform': 'rotate(' + angle + 'deg)',
                        '-moz-transform': 'rotate(' + angle + 'deg)',
                        '-ms-transform': 'rotate(' + angle + 'deg)',
                        'transform': 'rotate(' + angle + 'deg)',
                    });
                    element.data('angle', angle);
                    if (element.outerHeight() > element.outerWidth()) {
                        element.outerWidth(element.outerHeight());
                    } else {
                        element.outerHeight(element.outerWidth());
                    }
                }

                /**
                 * Deletes an element from the canvas.
                 * @param element The element to delete
                 */
                function deleteElement(element) {
                    jsPlumbInstance.remove(element);
                }

                /*
                 * Bind listeners to the connections
                 */

                // The connection is deleted on double click
                jsPlumbInstance.bind("dblclick", jsPlumbInstance.deleteConnection);

                // Show the name input on click
                jsPlumbInstance.bind("click", function (connection, originalEvent) {
                    let overlay = connection.getOverlay("label");
                    if (overlay.isVisible() && originalEvent.target.localName == 'path') {
                        overlay.hide();
                    } else if (!overlay.isVisible()) {
                        overlay.show();
                    }
                });

                // Add device name and id to sensor or actuator when a connection is created
                jsPlumbInstance.bind("connection", function (info) {
                    saveData();
                    let source = $(info.source);
                    let target = $(info.target);
                    if (target.attr("class").indexOf("device") == -1) {
                        target.data("device", source.data("name"));
                        target.data("deviceId", source.data("id"));
                    }
                });

                // Undeploy, deregister and remove device name and id from sensor or actuator when a connection is removed
                jsPlumbInstance.bind("connectionDetached", function (info) {
                    onDetach(info);
                });

                function onDetach(info) {
                    let target = $(info.target);
                    let targetType = target.attr('class').toString().split(" ")[1];
                    if (targetType === "sensor" || targetType === "actuator") {
                        target.removeData("device");
                        target.removeData("deviceId");
                    }
                }

                /*
                 * Load the data from the element to show it in the tool and input fields
                 */
                function loadData(element) {
                    $timeout(function () {
                        if (element.attr("class").indexOf("device") > -1) {
                            scope.clickedComponent.category = "DEVICE";
                            scope.clickedComponent.id = element.data("id");
                            scope.clickedComponent.name = element.data("name");
                            scope.clickedComponent.type = element.data("type");
                            scope.clickedComponent.mac = element.data("mac");
                            scope.clickedComponent.ip = element.data("ip");
                            scope.clickedComponent.username = element.data("username");
                            scope.clickedComponent.password = element.data("password");
                            scope.clickedComponent.rsaKey = element.data("rsaKey");
                            scope.clickedComponent.regError = element.data("regError");
                            scope.clickedComponent.element = element;
                            // If device is registered then disable the input fields
                            if (element.data("id")) {
                                $("#deviceInfo *").attr("disabled", true).off('click');
                            } else {
                                $("#deviceInfo *").attr("disabled", false).on('click');
                                if (element.attr("class").indexOf("default") === -1) {
                                    $("#deviceTypeInput").attr("disabled", true);
                                }
                            }
                        } else if (element.attr("class").indexOf("actuator") > -1) {
                            scope.clickedComponent.category = "ACTUATOR";
                            scope.clickedComponent.id = element.data("id");
                            scope.clickedComponent.name = element.data("name");
                            scope.clickedComponent.type = element.data("type");
                            scope.clickedComponent.adapter = element.data("adapter");
                            scope.clickedComponent.device = element.data("device");
                            scope.clickedComponent.regError = element.data("regError");
                            scope.clickedComponent.depError = element.data("depError");
                            scope.clickedComponent.deployed = element.data("deployed");
                            scope.clickedComponent.element = element;
                            // Disable the input fields if registered
                            if (element.data("id")) {
                                $("#actuatorInfo *").attr("disabled", true).off('click');
                            } else {
                                $("#actuatorInfo *").attr("disabled", false).on('click');
                                $("#actuatorDeviceInput").attr("disabled", true);
                                if (element.attr("class").indexOf("default") == -1) {
                                    $("#actuatorTypeInput").attr("disabled", true);
                                }
                            }
                        } else if (element.attr("class").indexOf("sensor") > -1) {
                            scope.clickedComponent.category = "SENSOR";
                            scope.clickedComponent.id = element.data("id");
                            scope.clickedComponent.name = element.data("name");
                            scope.clickedComponent.type = element.data("type");
                            scope.clickedComponent.adapter = element.data("adapter");
                            scope.clickedComponent.device = element.data("device");
                            scope.clickedComponent.regError = element.data("regError");
                            scope.clickedComponent.depError = element.data("depError");
                            scope.clickedComponent.deployed = element.data("deployed");
                            scope.clickedComponent.element = element;
                            // Disable the input fields if registered
                            if (element.data("id")) {
                                $("#sensorInfo *").attr("disabled", true).off('click');
                            } else {
                                $("#sensorInfo *").attr("disabled", false).on('click');
                                $("#sensorDeviceInput").attr("disabled", true);
                                if (element.attr("class").indexOf("default") == -1) {
                                    $("#sensorTypeInput").attr("disabled", true);
                                }
                            }
                        }
                    });
                }

                /*
                 * Save the data from the input fields in the element
                 */
                function saveData() {
                    let element = scope.clickedComponent.element;
                    if (element) {
                        if (element.attr("class").indexOf("device") > -1) {
                            element.data("name", scope.clickedComponent.name);
                            element.data("type", scope.clickedComponent.type);
                            element.data("mac", scope.clickedComponent.mac);
                            element.data("ip", scope.clickedComponent.ip);
                            element.data("username", scope.clickedComponent.username);
                            element.data("password", scope.clickedComponent.password);
                            element.data("rsaKey", scope.clickedComponent.rsaKey);
                            updateDeviceSA(element);
                        } else if (element.attr("class").indexOf("actuator") > -1) {
                            element.data("name", scope.clickedComponent.name);
                            element.data("type", scope.clickedComponent.type);
                            element.data("adapter", scope.clickedComponent.adapter);
                        } else if (element.attr("class").indexOf("sensor") > -1) {
                            element.data("name", scope.clickedComponent.name);
                            element.data("type", scope.clickedComponent.type);
                            element.data("adapter", scope.clickedComponent.adapter);
                        }
                    }

                    $timeout(function () {
                        scope.clickedComponent = {};
                    });
                }

                /*
                 * Update device name and ID in the attached sensors and actuators
                 */
                function updateDeviceSA(device) {
                    $.each(jsPlumbInstance.getConnections({
                        source: device.attr("id")
                    }), function (index, connection) {
                        let target = $(connection.target);
                        if (target.attr("class").indexOf("device") === -1) {
                            target.data("device", device.data("name"));
                            target.data("deviceId", device.data("id"));
                        }
                    });
                }

                /*
                 * Draw a model on the canvas based on the saved JSON representation
                 */
                function drawModel(model) {
                    clearCanvas();
                    scope.currentModel = JSON.parse(model);
                    let environment = JSON.parse(scope.currentModel.value);
                    // Draw first the nodes
                    $.each(environment.nodes, function (index, node) {
                        element = createElementFromNode(node.elementId, node);
                        drawElement(element);
                        element = "";
                    });
                    // Connect the created nodes
                    $.each(environment.connections, function (index, connection) {
                        let conn = jsPlumbInstance.connect({
                            source: connection.sourceId,
                            target: connection.targetId,
                            type: "basic"
                        });
                        conn.getOverlay("label").label = connection.label;
                        if (connection.labelVisible) {
                            conn.getOverlay("label").show();
                        }
                    });
                    elementIdCount = environment.elementIdCount;
                }

                /**
                 * Exports the model in its current state to a JSON string.
                 * @return The exported JSON string representing the model
                 */
                function exportToJSON() {
                    //Save all unsaved form data
                    saveData();

                    let totalCount = 0;
                    let nodes = [];

                    //Iterate over all nodes of the canvas
                    $(".jtk-node").each(function (index) {
                        let $element = $(this);

                        totalCount++;

                        //Read element classes and remove uninteresting ones
                        let classNames = $element.attr('class')
                            .replace('jtk-draggable')
                            .replace('ui-resizable')
                            .replace('ui-resizable-disabled')
                            .replace('ui-rotatable-disabled')
                            .replace('clicked-element')
                            .replace(/ +(?= )/g, '');

                        //Create basic node object
                        let nodeObject = {
                            nodeType: "floorplan", //Default, may be altered below
                            elementId: $element.attr('id'),
                            clsName: classNames,
                            left: $element.position().left,
                            top: $element.position().top,
                            width: $element.width(),
                            height: $element.height(),
                        };

                        //Read data from element and merge them with the node object
                        Object.assign(nodeObject, $element.data());

                        //Remove useless properties
                        delete nodeObject['uiRotatable'];
                        delete nodeObject['uiResizable'];

                        //Determine node type
                        if ($element.hasClass("device")) {
                            nodeObject['nodeType'] = "device";
                        } else if ($element.hasClass("actuator")) {
                            nodeObject['nodeType'] = "actuator";
                        } else if ($element.hasClass("sensor")) {
                            nodeObject['nodeType'] = "sensor";
                        }

                        //Push node object
                        nodes.push(nodeObject);
                    });

                    // Get all connections
                    let connections = [];
                    $.each(jsPlumbInstance.getConnections(), function (index, connection) {
                        connections.push({
                            id: connection.id,
                            sourceId: connection.source.id,
                            targetId: connection.target.id,
                            label: connection.getOverlay("label").canvas ? connection.getOverlay("label").canvas.innerText : connection.getOverlay("label").label,
                            labelVisible: connection.getOverlay("label").isVisible()
                        });
                    });

                    // Create the JSON representation
                    let environment = {};
                    environment.nodes = nodes;
                    environment.connections = connections;
                    environment.numberOfElements = totalCount;
                    environment.elementIdCount = elementIdCount;

                    return JSON.stringify(environment);
                }

                /**
                 * Imports the model from a JSON string.
                 * @param jsonString The JSON string to import the model from
                 */
                function importFromJSON(jsonString) {
                    //Parse the JSON string
                    let jsonObject = JSON.parse(jsonString);

                    //Remove all current nodes from the canvas
                    clearCanvas();

                    //First create the nodes
                    $.each(jsonObject.nodes, function (index, node) {
                        let element = createElementFromNode(node.elementId, node);
                        drawElement(element);
                    });

                    //Connect the created nodes
                    $.each(jsonObject.connections, function (index, connection) {
                        let conn = jsPlumbInstance.connect({
                            source: connection.sourceId,
                            target: connection.targetId,
                            type: "basic"
                        });
                        conn.getOverlay("label").label = connection.label;
                        if (connection.labelVisible) {
                            conn.getOverlay("label").show();
                        }
                    });
                    elementIdCount = jsonObject.elementIdCount;
                }

                /*
                 * Remove all elements from canvas
                 */
                function clearCanvas() {
                    jsPlumbInstance.unbind("connectionDetached");
                    jsPlumbInstance.empty("canvas");
                    $timeout(function () {
                        scope.clickedComponent = {};
                    });
                    jsPlumbInstance.bind("connectionDetached", function (info) {
                        onDetach(info);
                    });
                    initMarkingRect();
                }

                /**
                 * Writes the model in its current state to the history stack.
                 */
                function writeModelToHistoryStack() {
                    //Export the model and push it on the stack
                    historyStack.push(exportToJSON());
                }

                /**
                 * [Public]
                 * Undoes the most recent action.
                 */
                function undoAction() {
                    //Check if there is an action to undo
                    if (historyStack.length < 2) {
                        return;
                    }

                    //Push last state to the future stack
                    futureStack.push(historyStack.pop());

                    //Get previous state from history stack and restore model
                    importFromJSON(historyStack.pop());
                }

                /**
                 * [Public]
                 * Redoes the most recent undone action.
                 */
                function redoAction() {
                    console.log(historyStack);
                }
            }


            /**
             * Linking function, glue code
             *
             * @param scope Scope of the directive
             * @param element Elements of the directive
             * @param attrs Attributes of the directive
             */
            let link = function (scope, element, attrs) {

                //Expose public API
                scope.api = {};

                //Initialize modelling tool
                let initFunction = initialize.bind(this, scope);
                jsPlumb.ready(initFunction);
            };

            //Configure and expose the directive
            return {
                restrict: 'E', //Elements only
                template:
                    '<div id="modelingToolView">' +
                    '<!-- Palette -->' +
                    '<div id="toolPalette" style="display: inline-block; vertical-align: top; width: 220px;">' +
                    '<div class="panel-group" id="accordion">' +
                    '<div class="panel panel-default">' +
                    '<div class="panel-heading" style="overflow-x: hidden;">' +
                    '<h4 class="panel-title">' +
                    '<a class="clickable" data-toggle="collapse" data-target="#collapseFloorplans" aria-expanded="false">' +
                    '<span class="material-icons" style="font-size: 20px;">weekend</span>Floorplans' +
                    '<i class="material-icons" style="float: right;">keyboard_arrow_down</i></a>' +
                    '</h4>' +
                    '</div>' +
                    '<div id="collapseFloorplans" class="panel-collapse collapse in">' +
                    '<div class="panel-body canvas-wide modeling-tool canvasPalette">' +
                    '<ul class="dragList">' +
                    '<li>' +
                    '<div class="window floorplan room-floorplan" id="roomFloorplan"></div>' +
                    '<p><strong>Room</strong></p>' +
                    '</li>' +
                    '<li>' +
                    '<div class="window floorplan wall-floorplan" id="wallFloorplan"></div>' +
                    '<p><strong>Wall</strong></p>' +
                    '</li>' +
                    '<li>' +
                    '<div class="window floorplan door-floorplan" id="doorFloorplan"></div>' +
                    '<p><strong>Door</strong></p>' +
                    '</li>' +
                    '<li>' +
                    '<div class="window floorplan window-floorplan" id="windowFloorplan"></div>' +
                    '<p><strong>Window</strong></p>' +
                    '</li>' +
                    '<li>' +
                    '<div class="window floorplan stairs-floorplan" id="stairsFloorplan"></div>' +
                    '<p><strong>Stairs</strong></p>' +
                    '</li>' +
                    '<li>' +
                    '<div class="window floorplan table-floorplan" id="tableFloorplan"></div>' +
                    '<p><strong>Table</strong></p>' +
                    '</li>' +
                    '<li>' +
                    '<div class="window floorplan chair-floorplan" id="chairFloorplan"></div>' +
                    '<p><strong>Chair</strong></p>' +
                    '</li>' +
                    '<li>' +
                    '<div class="window floorplan couch-floorplan" id="couchFloorplan"></div>' +
                    '<p><strong>Couch</strong></p>' +
                    '</li>' +
                    '<li>' +
                    '<div class="window floorplan bed-floorplan" id="bedFloorplan"></div>' +
                    '<p><strong>Bed</strong></p>' +
                    '</li>' +
                    '<li>' +
                    '<div class="window floorplan kitchen-sink-floorplan" id="kitchenSinkFloorplan"></div>' +
                    '<p><strong>Kitchen sink</strong></p>' +
                    '</li>' +
                    '<li>' +
                    '<div class="window floorplan bathtub-floorplan" id="bathtubFloorplan"></div>' +
                    '<p><strong>Bathtub</strong></p>' +
                    '</li>' +
                    '<li>' +
                    '<div class="window floorplan bath-sink-floorplan" id="bathSinkFloorplan"></div>' +
                    '<p><strong>Bath sink</strong></p>' +
                    '</li>' +
                    '<li>' +
                    '<div class="window floorplan toilet-floorplan" id="toiletFloorplan"></div>' +
                    '<p><strong>Toilet</strong></p>' +
                    '</li>' +
                    '</ul>' +
                    '</div>' +
                    '</div>' +
                    '</div>' +
                    '<div class="panel panel-default">' +
                    '<div class="panel-heading" style="overflow-x: hidden;">' +
                    '<h4 class="panel-title">' +
                    '<a class="clickable collapsed" data-toggle="collapse" data-target="#collapseDevices" aria-expanded="false">' +
                    '<span class="material-icons" style="font-size: 20px;">devices</span>Device types' +
                    '<i class="material-icons" style="float: right;">keyboard_arrow_down</i></a>' +
                    '</h4>' +
                    '</div>' +
                    '<div id="collapseDevices" class="panel-collapse collapse">' +
                    '<div class="panel-body canvas-wide modeling-tool canvasPalette">' +
                    '<ul class="dragList">' +
                    '<li>' +
                    '<div class="window device raspberry-pi-device" id="raspberryPiDevice"></div>' +
                    '<p><strong>Raspberry Pi</strong></p>' +
                    '</li>' +
                    '<li>' +
                    '<div class="window device arduino-device" id="arduinoDevice"></div>' +
                    '<p><strong>Arduino</strong></p>' +
                    '</li>' +
                    '<li>' +
                    '<div class="window device computer-device" id="computerDevice"></div>' +
                    '<p><strong>Computer</strong></p>' +
                    '</li>' +
                    '<li>' +
                    '<div class="window device laptop-device" id="laptopDevice"></div>' +
                    '<p><strong>Laptop</strong></p>' +
                    '</li>' +
                    '<li>' +
                    '<div class="window device tv-device" id="tvDevice"></div>' +
                    '<p><strong>TV</strong></p>' +
                    '</li>' +
                    '<li>' +
                    '<div class="window device smartphone-device" id="smartphoneDevice"></div>' +
                    '<p><strong>Smartphone</strong></p>' +
                    '</li>' +
                    '<li>' +
                    '<div class="window device smartwatch-device" id="smartwatchDevice"></div>' +
                    '<p><strong>Smartwatch</strong></p>' +
                    '</li>' +
                    '<li>' +
                    '<div class="window device audio-system-device" id="audioSystemDevice"></div>' +
                    '<p><strong>Audio System</strong></p>' +
                    '</li>' +
                    '<li>' +
                    '<div class="window device voice-controller-device" id="voiceControllerDevice"></div>' +
                    '<p><strong>Voice Controller</strong></p>' +
                    '</li>' +
                    '<li>' +
                    '<div class="window device camera-device" id="cameraDevice"></div>' +
                    '<p><strong>Camera</strong></p>' +
                    '</li>' +
                    '<li>' +
                    '<div class="window device default-device" id="defaultDevice"></div>' +
                    '<p><strong>Default device</strong></p>' +
                    '</li>' +
                    '</ul>' +
                    '</div>' +
                    '</div>' +
                    '</div>' +
                    '<div class="panel panel-default">' +
                    '<div class="panel-heading" style="overflow-x: hidden;">' +
                    '<h4 class="panel-title">' +
                    '<a class="clickable collapsed" data-toggle="collapse" data-target="#collapseActuators" aria-expanded="false">' +
                    '<span class="material-icons" style="font-size: 20px;">wb_incandescent</span>Actuator types' +
                    '<i class="material-icons" style="float: right;">keyboard_arrow_down</i></a>' +
                    '</h4>' +
                    '</div>' +
                    '<div id="collapseActuators" class="panel-collapse collapse">' +
                    '<div class="panel-body canvas-wide modeling-tool canvasPalette">' +
                    '<ul class="dragList">' +
                    '<li>' +
                    '<div class="window actuator light-actuator" id="lightActuator"></div>' +
                    '<p><strong>Light</strong></p>' +
                    '</li>' +
                    '<li>' +
                    '<div class="window actuator led-actuator" id="ledActuator"></div>' +
                    '<p><strong>LED</strong></p>' +
                    '</li>' +
                    '<li>' +
                    '<div class="window actuator speaker-actuator" id="speakerActuator"></div>' +
                    '<p><strong>Speaker</strong></p>' +
                    '</li>' +
                    '<li>' +
                    '<div class="window actuator buzzer-actuator" id="buzzerActuator"></div>' +
                    '<p><strong>Buzzer</strong></p>' +
                    '</li>' +
                    '<li>' +
                    '<div class="window actuator vibration-actuator" id="vibrationActuator"></div>' +
                    '<p><strong>Vibration</strong></p>' +
                    '</li>' +
                    '<li>' +
                    '<div class="window actuator heater-actuator" id="heaterActuator"></div>' +
                    '<p><strong>Heater</strong></p>' +
                    '</li>' +
                    '<li>' +
                    '<div class="window actuator air-conditioner-actuator" id="airConditionerActuator"></div>' +
                    '<p><strong>Air Conditioner</strong></p>' +
                    '</li>' +
                    '<li>' +
                    '<div class="window actuator switch-actuator" id="switchActuator"></div>' +
                    '<p><strong>Switch</strong></p>' +
                    '</li>' +
                    '<li>' +
                    '<div class="window actuator motor-actuator" id="motorActuator"></div>' +
                    '<p><strong>Motor</strong></p>' +
                    '</li>' +
                    '<li>' +
                    '<div class="window actuator default-actuator" id="defaultActuator"></div>' +
                    '<p><strong>Default actuator</strong></p>' +
                    '</li>' +
                    '</ul>' +
                    '</div>' +
                    '</div>' +
                    '</div>' +
                    '<div class="panel panel-default">' +
                    '<div class="panel-heading" style="overflow-x: hidden;">' +
                    '<h4 class="panel-title">' +
                    '<a class="clickable collapsed" data-toggle="collapse" data-target="#collapseSensors" aria-expanded="false">' +
                    '<span class="material-icons" style="font-size: 20px;">settings_remote</span>Operators' +
                    '<i class="material-icons" style="float: right;">keyboard_arrow_down</i></a>' +
                    '</h4>' +
                    '</div>' +
                    '<div id="collapseSensors" class="panel-collapse collapse">' +
                    '<div class="panel-body canvas-wide modeling-tool canvasPalette">' +
                    '<ul class="dragList">' +
                    '<li>' +
                    '<div class="window sensor camera-sensor" id="cameraSensor"></div>' +
                    '<p><strong>Camera</strong></p>' +
                    '</li>' +
                    '<li>' +
                    '<div class="window sensor sound-sensor" id="soundSensor"></div>' +
                    '<p><strong>Sound</strong></p>' +
                    '</li>' +
                    '<li>' +
                    '<div class="window sensor temperature-sensor" id="temperatureSensor"></div>' +
                    '<p><strong>Temperature</strong></p>' +
                    '</li>' +
                    '<li>' +
                    '<div class="window sensor humidity-sensor" id="humiditySensor"></div>' +
                    '<p><strong>Humidity</strong></p>' +
                    '</li>' +
                    '<li>' +
                    '<div class="window sensor gas-sensor" id="gasSensor"></div>' +
                    '<p><strong>Gas</strong></p>' +
                    '</li>' +
                    '<li>' +
                    '<div class="window sensor light-sensor" id="lightSensor"></div>' +
                    '<p><strong>Light</strong></p>' +
                    '</li>' +
                    '<li>' +
                    '<div class="window sensor motion-sensor" id="motionSensor"></div>' +
                    '<p><strong>Motion</strong></p>' +
                    '</li>' +
                    '<li>' +
                    '<div class="window sensor location-sensor" id="locationSensor"></div>' +
                    '<p><strong>Location</strong></p>' +
                    '</li>' +
                    '<li>' +
                    '<div class="window sensor gyroscope-sensor" id="gyroscopeSensor"></div>' +
                    '<p><strong>Gyroscope</strong></p>' +
                    '</li>' +
                    '<li>' +
                    '<div class="window sensor proximity-sensor" id="proximitySensor"></div>' +
                    '<p><strong>Proximity</strong></p>' +
                    '</li>' +
                    '<li>' +
                    '<div class="window sensor touch-sensor" id="touchSensor"></div>' +
                    '<p><strong>Touch</strong></p>' +
                    '</li>' +
                    '<li>' +
                    '<div class="window sensor vibration-sensor" id="vibrationSensor"></div>' +
                    '<p><strong>Vibration</strong></p>' +
                    '</li>' +
                    '<li>' +
                    '<div class="window sensor default-sensor" id="defaultSensor"></div>' +
                    '<p><strong>Default sensor</strong></p>' +
                    '</li>' +
                    '</ul>' +
                    '</div>' +
                    '</div>' +
                    '</div>' +
                    '</div>' +
                    '</div>' +
                    '<!-- Canvas - Modeling Area -->' +
                    '<div id="toolCanvasContainer">' +
                    '<div class="jtk-main">' +
                    '<div class="jtk-canvas canvas-wide modeling-tool jtk-surface jtk-surface-nopan" id="canvas">' +
                    '</div>' +
                    '</div>' +
                    '</div>' +
                    '<!-- Info sidebar -->' +
                    '<div id="infoSidebar" style="display: inline-block; width:162px; vertical-align: top;">' +
                    '<div class="panel panel-default" ng-show="clickedComponent.category == \'DEVICE\'">' +
                    '<div class="panel-heading" style="text-align: center; overflow-x: hidden;">' +
                    '<h4 class="panel-title">Device</h4>' +
                    '</div>' +
                    '<div id="deviceInfo" class="input-list">' +
                    '<ul>' +
                    '<li>' +
                    '<label for="deviceNameInput">Name</label>' +
                    '<input id="deviceNameInput" type="text" name="name" ng-model="clickedComponent.name" autocomplete="off">' +
                    '</li>' +
                    '<li>' +
                    '<label for="deviceTypeInput">Device type</label>' +
                    '<input id="deviceTypeInput" type="text" name="type" ng-model="clickedComponent.type" autocomplete="off">' +
                    '</li>' +
                    '<li>' +
                    '<label for="deviceMacInput">MAC address</label>' +
                    '<input id="deviceMacInput" type="text" name="mac" ng-model="clickedComponent.mac" autocomplete="off" placeholder="HH-HH-HH-HH-HH-HH">' +
                    '</li>' +
                    '<li>' +
                    '<label for="deviceIpInput">IP address</label>' +
                    '<input id="deviceIpInput" type="text" name="ip" ng-model="clickedComponent.ip" autocomplete="off">' +
                    '</li>' +
                    '<li>' +
                    '<label for="deviceUsernameInput">User name</label>' +
                    '<input id="deviceUsernameInput" type="text" name="username" ng-model="clickedComponent.username" autocomplete="off">' +
                    '</li>' +
                    '<li>' +
                    '<label for="devicePasswordInput">Password</label>' +
                    '<input id="devicePasswordInput" type="password" name="password" ng-model="clickedComponent.password" autocomplete="off">' +
                    '</li>' +
                    '<li>' +
                    '<label for="deviceRsaKeyInput">RSA Key</label>' +
                    '<textarea id="deviceRsaKeyInput" type="text" name="rsaKey" placeholder="Private RSA key" ng-model="clickedComponent.rsaKey" rows="4"></textarea>' +
                    '</li>' +
                    '</ul>' +
                    '</div>' +
                    '<div class="panel-footer" style="height: 100%; overflow-x: scroll">' +
                    '<span>' +
                    '<b>Status</b>' +
                    '</span>' +
                    '<br>' +
                    '<span>' +
                    '<i class="fas fa-check-circle" ng-show="clickedComponent.id"></i>' +
                    '<i class="fas fa-times-circle" ng-show="!clickedComponent.id"></i>' +
                    'Registered' +
                    '<span style="color: red; font-size: 12px" ng-show="clickedComponent.regError">' +
                    '<br>' +
                    '{{clickedComponent.regError}}' +
                    '</span>' +
                    '</span>' +
                    '</div>' +
                    '</div>' +
                    '<div class="panel panel-default" ng-show="clickedComponent.category == \'ACTUATOR\'">' +
                    '<div class="panel-heading" style="text-align: center;overflow-x: hidden;">' +
                    '<h4 class="panel-title">Actuator</h4>' +
                    '</div>' +
                    '<div id="actuatorInfo" class="input-list">' +
                    '<ul>' +
                    '<li>' +
                    '<label for="actuatorNameInput">Name</label>' +
                    '<input id="actuatorNameInput" type="text" name="name" ng-model="clickedComponent.name" autocomplete="off">' +
                    '</li>' +
                    '<li>' +
                    '<label for="actuatorTypeInput">Type</label>' +
                    '<input id="actuatorTypeInput" type="text" name="type" ng-model="clickedComponent.type" autocomplete="off">' +
                    '</li>' +
                    '<li>' +
                    '<label for="actuatorAdapterInput">Adapter</label>' +
                    '<select class="form-control show-tick" id="actuatorAdapterInput" ng-model="clickedComponent.adapter" ng-options="t.id as (t.name) for t in adapterListCtrl.items">' +
                    '<option value="">Select adapter</option>' +
                    '</select>' +
                    '</li>' +
                    '<li>' +
                    '<label for="actuatorDeviceInput">Device</label>' +
                    '<input id="actuatorDeviceInput" type="text" name="device" ng-model="clickedComponent.device" autocomplete="off" disabled="disabled">' +
                    '</li>' +
                    '</ul>' +
                    '</div>' +
                    '<div class="panel-footer" style="height: 100%; overflow-x: scroll">' +
                    '<span>' +
                    '<b>Status</b>' +
                    '</span>' +
                    '<br>' +
                    '<span>' +
                    '<i class="fas fa-check-circle" ng-show="clickedComponent.id"></i>' +
                    '<i class="fas fa-times-circle" ng-show="!clickedComponent.id"></i>' +
                    'Registered' +
                    '<span style="color: red; font-size: 12px" ng-show="clickedComponent.regError">' +
                    '<br>' +
                    '{{clickedComponent.regError}}' +
                    '</span>' +
                    '</span>' +
                    '<br>' +
                    '<span>' +
                    '<i class="fas fa-check-circle" ng-show="clickedComponent.deployed"></i>' +
                    '<i class="fas fa-times-circle" ng-show="!clickedComponent.deployed"></i>' +
                    'Deployed' +
                    '<span style="color: red; font-size: 12px" ng-show="clickedComponent.depError">' +
                    '<br>' +
                    '{{clickedComponent.depError}}' +
                    '</span>' +
                    '</span>' +
                    '</div>' +
                    '</div>' +
                    '<div class="panel panel-default" ng-show="clickedComponent.category == \'SENSOR\'">' +
                    '<div class="panel-heading" style="text-align: center;overflow-x: hidden;">' +
                    '<h4 class="panel-title">Sensor</h4>' +
                    '</div>' +
                    '<div id="sensorInfo" class="input-list">' +
                    '<ul>' +
                    '<li>' +
                    '<label for="sensorNameInput">Name</label>' +
                    '<input id="sensorNameInput" type="text" name="name" ng-model="clickedComponent.name" autocomplete="off">' +
                    '</li>' +
                    '<li>' +
                    '<label for="sensorTypeInput">Type</label>' +
                    '<input id="sensorTypeInput" type="text" name="type" ng-model="clickedComponent.type" autocomplete="off">' +
                    '</li>' +
                    '<li>' +
                    '<label for="sensorAdapterInput">Adapter</label>' +
                    '<select class="form-control show-tick" id="sensorAdapterInput" ng-model="clickedComponent.adapter" ng-options="t.id as (t.name) for t in adapterListCtrl.items">' +
                    '<option value="">Select adapter</option>' +
                    '</select>' +
                    '</li>' +
                    '<li>' +
                    '<label for="sensorDeviceInput">Device</label>' +
                    '<input id="sensorDeviceInput" type="text" name="device" ng-model="clickedComponent.device" autocomplete="off" disabled="disabled">' +
                    '</li>' +
                    '</ul>' +
                    '</div>' +
                    '<div class="panel-footer" style="height: 100%; overflow-x: scroll">' +
                    '<span>' +
                    '<b>Status</b>' +
                    '</span>' +
                    '<br>' +
                    '<span>' +
                    '<i class="fas fa-check-circle" ng-show="clickedComponent.id"></i>' +
                    '<i class="fas fa-times-circle" ng-show="!clickedComponent.id"></i>' +
                    'Registered' +
                    '<span style="color: red; font-size: 12px" ng-show="clickedComponent.regError">' +
                    '<br>' +
                    '{{clickedComponent.regError}}' +
                    '</span>' +
                    '</span>' +
                    '<br>' +
                    '<span>' +
                    '<i class="fas fa-check-circle" ng-show="clickedComponent.deployed"></i>' +
                    '<i class="fas fa-times-circle" ng-show="!clickedComponent.deployed"></i>' +
                    'Deployed' +
                    '<span style="color: red; font-size: 12px" ng-show="clickedComponent.depError">' +
                    '<br>' +
                    '{{clickedComponent.depError}}' +
                    '</span>' +
                    '</span>' +
                    '</div>' +
                    '</div>' +
                    '</div>' +
                    '</div>'
                ,
                link: link,
                scope: {
                    //Public API
                    api: "=api"

                    /*
                    //The unit in which the statistics are supposed to be displayed
                    unit: '@unit',
                    //Functions that are called when the chart loads/finishes loading data
                    loadingStart: '&loadingStart',
                    loadingFinish: '&loadingFinish',
                    //Function for updating the value stats data
                    getStats: '&getStats'*/
                }
            };
        }]
)
;