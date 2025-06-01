// ------------------------------------------------------------------------
// How To Make A Match-3 Game With HTML5 Canvas
// Copyright (c) 2015 Rembound.com
// 
// This program is free software: you can redistribute it and/or modify  
// it under the terms of the GNU General Public License as published by  
// the Free Software Foundation, either version 3 of the License, or  
// (at your option) any later version.
// 
// This program is distributed in the hope that it will be useful,  
// but WITHOUT ANY WARRANTY; without even the implied warranty of  
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the  
// GNU General Public License for more details.  
// 
// You should have received a copy of the GNU General Public License  
// along with this program.  If not, see http://www.gnu.org/licenses/.
//
// http://rembound.com/articles/how-to-make-a-match3-game-with-html5-canvas
// ------------------------------------------------------------------------

// The function gets called when the window is fully loaded
window.onload = function() {
    // Get the canvas and context
    var canvas = document.getElementById("viewport");
    var context = canvas.getContext("2d");
    
    // Timing and frames per second
    var lastframe = 0;
    var fpstime = 0;
    var framecount = 0;
    var fps = 0;
    
    // Mouse dragging
    var drag = false;
    
    // Level object
    var level = {
        x: 250,         // X position
        y: 180,         // Y position (moved down from 113 to 180)
        columns: 8,     // Number of tile columns
        rows: 8,        // Number of tile rows
        tilewidth: 40,  // Visual width of a tile
        tileheight: 40, // Visual height of a tile
        tiles: [],      // The two-dimensional tile array
        selectedtile: { selected: false, column: 0, row: 0 }
    };
    
    // Preview area for upcoming tiles (3 rows above the main game area)
    var preview = {
        rows: 3,        // Number of preview rows
        tiles: []       // Preview tiles array
    };
    
    // All of the different tile colors in RGB
    var tilecolors = [[255, 128, 128],
                      [128, 255, 128],
                      [128, 128, 255],
                      [255, 255, 128],
                      [255, 128, 255]];
    
    // Clusters and moves that were found
    var clusters = [];  // { column, row, length, horizontal }
    var moves = [];     // { column1, row1, column2, row2 }

    // Current move
    var currentmove = { column1: 0, row1: 0, column2: 0, row2: 0 };
    
    // Game states
    var gamestates = { init: 0, ready: 1, resolve: 2 };
    var gamestate = gamestates.init;
    
    // Color elimination statistics
    var colorStats = [];
    
    // Timer functionality
    var gameTimer = 0; // Time in seconds since game started
    var timerRunning = false;
    
    // Level system
    var currentLevel = 1;
    var maxLevel = 3;
    var levelObjectives = [
        { // Level 1 - Easy
            name: "Level 1: Beginner",
            description: "Eliminate 50 tiles total",
            targetTotal: 50,
            timeLimit: 0, // No time limit
            colors: 5
        },
        { // Level 2 - Medium  
            name: "Level 2: Intermediate", 
            description: "Get 100 points in 3 minutes",
            targetTotal: 100,
            timeLimit: 180, // 3 minutes
            colors: 4
        },
        { // Level 3 - Hard
            name: "Level 3: Expert",
            description: "Get 200 points in 2 minutes",
            targetTotal: 200, 
            timeLimit: 120, // 2 minutes
            colors: 3
        }
    ];
    var totalScore = 0; // Total points across all colors
    var levelComplete = false;
    
    // Animation variables
    var animationstate = 0;
    var animationtime = 0;
    var animationtimetotal = 0.3;
    
    // Show available moves
    var showmoves = false;
    
    // The AI bot
    var aibot = false;
    
    // Game Over
    var gameover = false;
    
    // Gui buttons
    var buttons = [ { x: 25, y: 315, width: 180, height: 45, text: "New Game"},
                    { x: 25, y: 365, width: 180, height: 45, text: "Show Moves"},
                    { x: 25, y: 415, width: 180, height: 45, text: "Enable AI Bot"},
                    { x: 25, y: 470, width: 85, height: 28, text: "Level 1"},
                    { x: 120, y: 470, width: 85, height: 28, text: "Level 2"},
                    { x: 25, y: 505, width: 85, height: 28, text: "Level 3"}];
    
    // Initialize the game
    function init() {
        // Add mouse events
        canvas.addEventListener("mousemove", onMouseMove);
        canvas.addEventListener("mousedown", onMouseDown);
        canvas.addEventListener("mouseup", onMouseUp);
        canvas.addEventListener("mouseout", onMouseOut);
        
        // Initialize the two-dimensional tile array
        for (var i=0; i<level.columns; i++) {
            level.tiles[i] = [];
            for (var j=0; j<level.rows; j++) {
                // Define a tile type and a shift parameter for animation
                level.tiles[i][j] = { type: 0, shift:0 }
            }
        }
        
        // New game
        newGame();
        
        // Enter main loop
        main(0);
    }
    
    // Main loop
    function main(tframe) {
        // Request animation frames
        window.requestAnimationFrame(main);
        
        // Update and render the game
        update(tframe);
        render();
    }
    
    // Update the game state
    function update(tframe) {
        var dt = (tframe - lastframe) / 1000;
        lastframe = tframe;
        
        // Update the fps counter
        updateFps(dt);
        
        // Update timer if game is running
        if (timerRunning && !gameover && !levelComplete) {
            gameTimer += dt;
            
            // Check time limit for current level
            var objective = levelObjectives[currentLevel - 1];
            if (objective.timeLimit > 0 && gameTimer >= objective.timeLimit) {
                gameover = true;
                timerRunning = false;
            }
        }
        
        // Check level completion
        if (!levelComplete && !gameover) {
            checkLevelCompletion();
        }
        
        if (gamestate == gamestates.ready) {
            // Game is ready for player input
            
            // Check for game over
            if (moves.length <= 0) {
                gameover = true;
                timerRunning = false; // Stop timer when game is over
            }
            
            // Let the AI bot make a move, if enabled
            if (aibot) {
                animationtime += dt;
                if (animationtime > animationtimetotal) {
                    // Check if there are moves available
                    findMoves();
                    
                    if (moves.length > 0) {
                        // Get a random valid move
                        var move = moves[Math.floor(Math.random() * moves.length)];
                        
                        // Simulate a player using the mouse to swap two tiles
                        mouseSwap(move.column1, move.row1, move.column2, move.row2);
                    } else {
                        // No moves left, Game Over. We could start a new game.
                        // newGame();
                    }
                    animationtime = 0;
                }
            }
        } else if (gamestate == gamestates.resolve) {
            // Game is busy resolving and animating clusters
            animationtime += dt;
            
            if (animationstate == 0) {
                // Clusters need to be found and removed
                if (animationtime > animationtimetotal) {
                    // Find clusters
                    findClusters();
                    
                    if (clusters.length > 0) {
                        // Clusters found, remove them
                        removeClusters();
                        
                        // Tiles need to be shifted
                        animationstate = 1;
                    } else {
                        // No clusters found, animation complete
                        gamestate = gamestates.ready;
                    }
                    animationtime = 0;
                }
            } else if (animationstate == 1) {
                // Tiles need to be shifted
                if (animationtime > animationtimetotal) {
                    // Shift tiles
                    shiftTiles();
                    
                    // New clusters need to be found
                    animationstate = 0;
                    animationtime = 0;
                    
                    // Check if there are new clusters
                    findClusters();
                    if (clusters.length <= 0) {
                        // Animation complete
                        gamestate = gamestates.ready;
                    }
                }
            } else if (animationstate == 2) {
                // Swapping tiles animation
                if (animationtime > animationtimetotal) {
                    // Swap the tiles
                    swap(currentmove.column1, currentmove.row1, currentmove.column2, currentmove.row2);
                    
                    // Check if the swap made a cluster
                    findClusters();
                    if (clusters.length > 0) {
                        // Valid swap, found one or more clusters
                        // Prepare animation states
                        animationstate = 0;
                        animationtime = 0;
                        gamestate = gamestates.resolve;
                    } else {
                        // Invalid swap, Rewind swapping animation
                        animationstate = 3;
                        animationtime = 0;
                    }
                    
                    // Update moves and clusters
                    findMoves();
                    findClusters();
                }
            } else if (animationstate == 3) {
                // Rewind swapping animation
                if (animationtime > animationtimetotal) {
                    // Invalid swap, swap back
                    swap(currentmove.column1, currentmove.row1, currentmove.column2, currentmove.row2);
                    
                    // Animation complete
                    gamestate = gamestates.ready;
                }
            }
            
            // Update moves and clusters
            findMoves();
            findClusters();
        }
    }
    
    function updateFps(dt) {
        if (fpstime > 0.25) {
            // Calculate fps
            fps = Math.round(framecount / fpstime);
            
            // Reset time and framecount
            fpstime = 0;
            framecount = 0;
        }
        
        // Increase time and framecount
        fpstime += dt;
        framecount++;
    }
    
    // Draw text that is centered
    function drawCenterText(text, x, y, width) {
        var textdim = context.measureText(text);
        context.fillText(text, x + (width-textdim.width)/2, y);
    }
    
    // Render the game
    function render() {
        // Draw the frame
        drawFrame();
        
        // Draw buttons
        drawButtons();
        
        // Draw preview area background
        var levelwidth = level.columns * level.tilewidth;
        var previewheight = preview.rows * level.tileheight;
        var previewy = level.y - previewheight - 10; // 10px gap between preview and main area
        context.fillStyle = "#404040";
        context.fillRect(level.x - 4, previewy - 4, levelwidth + 8, previewheight + 8);
        
        // Draw preview area label
        context.fillStyle = "#ffffff";
        context.font = "14px Verdana";
        drawCenterText("Next Tiles", level.x, previewy - 20, levelwidth);
        
        // Render preview tiles
        renderPreviewTiles();
        
        // Draw level background
        var levelheight = level.rows * level.tileheight;
        context.fillStyle = "#000000";
        context.fillRect(level.x - 4, level.y - 4, levelwidth + 8, levelheight + 8);
        
        // Render tiles
        renderTiles();
        
        // Render clusters
        renderClusters();
        
        // Render moves, when there are no clusters
        if (showmoves && clusters.length <= 0 && gamestate == gamestates.ready) {
            renderMoves();
        }
        
        // Draw color elimination statistics
        drawColorStats();
        
        // Draw timer
        drawTimer();
        
        // Draw level information
        drawLevelInfo();
        
        // Game Over overlay
        if (gameover) {
            context.fillStyle = "rgba(0, 0, 0, 0.8)";
            context.fillRect(level.x, level.y, levelwidth, levelheight);
            
            context.fillStyle = "#ffffff";
            context.font = "24px Verdana";
            if (levelComplete) {
                drawCenterText("Level Complete!", level.x, level.y + levelheight / 2 - 20, levelwidth);
                context.font = "16px Verdana";
                drawCenterText("Score: " + totalScore, level.x, level.y + levelheight / 2 + 10, levelwidth);
            } else {
                drawCenterText("Game Over!", level.x, level.y + levelheight / 2 + 10, levelwidth);
            }
        }
        
        // Level Complete overlay (separate from game over)
        if (levelComplete && !gameover) {
            context.fillStyle = "rgba(0, 255, 0, 0.8)";
            context.fillRect(level.x, level.y, levelwidth, levelheight);
            
            context.fillStyle = "#ffffff";
            context.font = "24px Verdana";
            drawCenterText("Level Complete!", level.x, level.y + levelheight / 2 - 20, levelwidth);
            context.font = "16px Verdana";
            drawCenterText("Score: " + totalScore, level.x, level.y + levelheight / 2 + 10, levelwidth);
        }
    }
    
    // Draw a frame with a border
    function drawFrame() {
        // Draw background and a border
        context.fillStyle = "#d0d0d0";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = "#e8eaec";
        context.fillRect(1, 1, canvas.width-2, canvas.height-2);
        
        // Draw header
        context.fillStyle = "#303030";
        context.fillRect(0, 0, canvas.width, 65);
        
        // Draw title
        context.fillStyle = "#ffffff";
        context.font = "24px Verdana";
        context.fillText("Match3", 10, 30);
        
        // Display fps
        context.fillStyle = "#ffffff";
        context.font = "12px Verdana";
        context.fillText("Fps: " + fps, 13, 50);
    }
    
    // Draw buttons
    function drawButtons() {
        for (var i=0; i<buttons.length; i++) {
            // Draw button shape with improved styling
            context.fillStyle = "#2c3e50";
            context.fillRect(buttons[i].x, buttons[i].y, buttons[i].width, buttons[i].height);
            
            // Add button border
            context.strokeStyle = "#34495e";
            context.lineWidth = 1;
            context.strokeRect(buttons[i].x, buttons[i].y, buttons[i].width, buttons[i].height);
            
            // Draw button text with better positioning
            context.fillStyle = "#ffffff";
            var fontSize = buttons[i].height > 30 ? "14px" : "11px";
            context.font = fontSize + " Verdana";
            var textdim = context.measureText(buttons[i].text);
            var textY = buttons[i].y + (buttons[i].height / 2) + 4;
            context.fillText(buttons[i].text, buttons[i].x + (buttons[i].width-textdim.width)/2, textY);
        }
    }
    
    // Draw color elimination statistics
    function drawColorStats() {
        var startX = 25;
        var startY = 100; // Moved down from 85 to 100 for better spacing
        var tileSize = 16;
        var spacing = 22;
        var columnWidth = 85;
        
        // Draw title with background
        context.fillStyle = "#f8f8f8";
        context.fillRect(startX - 3, startY - 22, 180, 95);
        context.strokeStyle = "#d0d0d0";
        context.lineWidth = 1;
        context.strokeRect(startX - 3, startY - 22, 180, 95);
        
        context.fillStyle = "#333333";
        context.font = "13px Verdana";
        context.fillText("COLOR STATISTICS", startX, startY - 8);
        
        // Draw each color and its count in a more compact layout
        for (var i = 0; i < tilecolors.length; i++) {
            var column = Math.floor(i / 3); 
            var row = i % 3; 
            
            var x = startX + column * columnWidth;
            var y = startY + 8 + row * spacing;
            
            // Draw color tile
            var col = tilecolors[i];
            context.fillStyle = "rgb(" + col[0] + "," + col[1] + "," + col[2] + ")";
            context.fillRect(x, y - tileSize + 3, tileSize, tileSize);
            
            // Draw border around tile
            context.strokeStyle = "#333333";
            context.lineWidth = 1;
            context.strokeRect(x, y - tileSize + 3, tileSize, tileSize);
            
            // Draw count
            context.fillStyle = "#333333";
            context.font = "11px Verdana";
            context.fillText(": " + colorStats[i], x + tileSize + 4, y);
        }
    }
    
    // Draw timer
    function drawTimer() {
        var minutes = Math.floor(gameTimer / 60);
        var remainingSeconds = Math.floor(gameTimer % 60);
        var formattedTime = (minutes < 10 ? "0" : "") + minutes + ":" + 
                           (remainingSeconds < 10 ? "0" : "") + remainingSeconds;
        
        context.fillStyle = "#ffffff";
        context.font = "16px Verdana";
        context.fillText("Time: " + formattedTime, 200, 30);
    }
    
    // Draw level information
    function drawLevelInfo() {
        var objective = levelObjectives[currentLevel - 1];
        
        // Position level info below color stats with proper spacing
        var leftX = 25;
        var startY = 220; // Moved down from 200 to 220 for better spacing
        
        // Draw a subtle background for level info section
        context.fillStyle = "#f8f8f8";
        context.fillRect(leftX - 3, startY - 18, 180, 85);
        context.strokeStyle = "#d0d0d0";
        context.lineWidth = 1;
        context.strokeRect(leftX - 3, startY - 18, 180, 85);
        
        context.fillStyle = "#333333";
        context.font = "13px Verdana";
        context.fillText("LEVEL INFORMATION", leftX, startY - 4);
        
        // Current level
        context.font = "11px Verdana";
        context.fillText("Current: Level " + currentLevel, leftX, startY + 12);
        
        // Draw objective name (shortened)
        var levelName = "L" + currentLevel + ": " + (currentLevel === 1 ? "Beginner" : currentLevel === 2 ? "Intermediate" : "Expert");
        context.fillText(levelName, leftX, startY + 26);
        
        // Draw progress
        totalScore = 0;
        for (var i = 0; i < colorStats.length; i++) {
            totalScore += colorStats[i];
        }
        context.fillText("Score: " + totalScore + "/" + objective.targetTotal, leftX, startY + 40);
        
        // Draw time remaining if there's a time limit
        if (objective.timeLimit > 0) {
            var timeRemaining = Math.max(0, objective.timeLimit - gameTimer);
            var minutes = Math.floor(timeRemaining / 60);
            var seconds = Math.floor(timeRemaining % 60);
            var timeText = "Time: " + (minutes < 10 ? "0" : "") + minutes + ":" + 
                          (seconds < 10 ? "0" : "") + seconds;
            context.fillText(timeText, leftX, startY + 54);
        } else {
            context.fillText("Time: Unlimited", leftX, startY + 54);
        }
    }
    
    // Render tiles
    function renderTiles() {
        for (var i=0; i<level.columns; i++) {
            for (var j=0; j<level.rows; j++) {
                // Get the shift of the tile for animation
                var shift = level.tiles[i][j].shift;
                
                // Calculate the tile coordinates
                var coord = getTileCoordinate(i, j, 0, (animationtime / animationtimetotal) * shift);
                
                // Check if there is a tile present
                if (level.tiles[i][j].type >= 0) {
                    // Get the color of the tile
                    var col = tilecolors[level.tiles[i][j].type];
                    
                    // Draw the tile using the color
                    drawTile(coord.tilex, coord.tiley, col[0], col[1], col[2]);
                }
                
                // Draw the selected tile
                if (level.selectedtile.selected) {
                    if (level.selectedtile.column == i && level.selectedtile.row == j) {
                        // Draw a red tile
                        drawTile(coord.tilex, coord.tiley, 255, 0, 0);
                    }
                }
            }
        }
        
        // Render the swap animation
        if (gamestate == gamestates.resolve && (animationstate == 2 || animationstate == 3)) {
            // Calculate the x and y shift
            var shiftx = currentmove.column2 - currentmove.column1;
            var shifty = currentmove.row2 - currentmove.row1;

            // First tile
            var coord1 = getTileCoordinate(currentmove.column1, currentmove.row1, 0, 0);
            var coord1shift = getTileCoordinate(currentmove.column1, currentmove.row1, (animationtime / animationtimetotal) * shiftx, (animationtime / animationtimetotal) * shifty);
            var col1 = tilecolors[level.tiles[currentmove.column1][currentmove.row1].type];
            
            // Second tile
            var coord2 = getTileCoordinate(currentmove.column2, currentmove.row2, 0, 0);
            var coord2shift = getTileCoordinate(currentmove.column2, currentmove.row2, (animationtime / animationtimetotal) * -shiftx, (animationtime / animationtimetotal) * -shifty);
            var col2 = tilecolors[level.tiles[currentmove.column2][currentmove.row2].type];
            
            // Draw a black background
            drawTile(coord1.tilex, coord1.tiley, 0, 0, 0);
            drawTile(coord2.tilex, coord2.tiley, 0, 0, 0);
            
            // Change the order, depending on the animation state
            if (animationstate == 2) {
                // Draw the tiles
                drawTile(coord1shift.tilex, coord1shift.tiley, col1[0], col1[1], col1[2]);
                drawTile(coord2shift.tilex, coord2shift.tiley, col2[0], col2[1], col2[2]);
            } else {
                // Draw the tiles
                drawTile(coord2shift.tilex, coord2shift.tiley, col2[0], col2[1], col2[2]);
                drawTile(coord1shift.tilex, coord1shift.tiley, col1[0], col1[1], col1[2]);
            }
        }
    }
    
    // Render preview tiles
    function renderPreviewTiles() {
        for (var i=0; i<level.columns; i++) {
            for (var j=0; j<preview.rows; j++) {
                // Calculate the preview tile coordinates
                var coord = getPreviewTileCoordinate(i, j);
                
                // Check if there is a preview tile present
                if (preview.tiles[i] && preview.tiles[i][j] && preview.tiles[i][j].type >= 0) {
                    // Get the color of the tile
                    var col = tilecolors[preview.tiles[i][j].type];
                    
                    // Draw the tile using the color with reduced opacity
                    drawPreviewTile(coord.tilex, coord.tiley, col[0], col[1], col[2]);
                }
            }
        }
    }
    
    // Get the preview tile coordinate
    function getPreviewTileCoordinate(column, row) {
        var previewheight = preview.rows * level.tileheight;
        var previewy = level.y - previewheight - 10; // 10px gap between preview and main area
        var tilex = level.x + column * level.tilewidth;
        var tiley = previewy + row * level.tileheight;
        return { tilex: tilex, tiley: tiley};
    }
    
    // Draw a preview tile with a color (slightly transparent)
    function drawPreviewTile(x, y, r, g, b) {
        context.fillStyle = "rgba(" + r + "," + g + "," + b + ", 0.7)";
        context.fillRect(x + 2, y + 2, level.tilewidth - 4, level.tileheight - 4);
    }
    
    // Get the tile coordinate
    function getTileCoordinate(column, row, columnoffset, rowoffset) {
        var tilex = level.x + (column + columnoffset) * level.tilewidth;
        var tiley = level.y + (row + rowoffset) * level.tileheight;
        return { tilex: tilex, tiley: tiley};
    }
    
    // Draw a tile with a color
    function drawTile(x, y, r, g, b) {
        context.fillStyle = "rgb(" + r + "," + g + "," + b + ")";
        context.fillRect(x + 2, y + 2, level.tilewidth - 4, level.tileheight - 4);
    }
    
    // Render clusters
    function renderClusters() {
        for (var i=0; i<clusters.length; i++) {
            // Calculate the tile coordinates
            var coord = getTileCoordinate(clusters[i].column, clusters[i].row, 0, 0);
            
            if (clusters[i].horizontal) {
                // Draw a horizontal line
                context.fillStyle = "#00ff00";
                context.fillRect(coord.tilex + level.tilewidth/2, coord.tiley + level.tileheight/2 - 4, (clusters[i].length - 1) * level.tilewidth, 8);
            } else {
                // Draw a vertical line
                context.fillStyle = "#0000ff";
                context.fillRect(coord.tilex + level.tilewidth/2 - 4, coord.tiley + level.tileheight/2, 8, (clusters[i].length - 1) * level.tileheight);
            }
        }
    }
    
    // Render moves
    function renderMoves() {
        for (var i=0; i<moves.length; i++) {
            // Calculate coordinates of tile 1 and 2
            var coord1 = getTileCoordinate(moves[i].column1, moves[i].row1, 0, 0);
            var coord2 = getTileCoordinate(moves[i].column2, moves[i].row2, 0, 0);
            
            // Draw a line from tile 1 to tile 2
            context.strokeStyle = "#ff0000";
            context.beginPath();
            context.moveTo(coord1.tilex + level.tilewidth/2, coord1.tiley + level.tileheight/2);
            context.lineTo(coord2.tilex + level.tilewidth/2, coord2.tiley + level.tileheight/2);
            context.stroke();
        }
    }
    
    // Start a new game
    function newGame() {
        // Reset timer and level completion
        gameTimer = 0;
        timerRunning = true;
        levelComplete = false;
        totalScore = 0;
        
        // Set the gamestate to ready
        gamestate = gamestates.ready;
        
        // Reset game over
        gameover = false;
        
        // Initialize the preview tiles array
        for (var i=0; i<level.columns; i++) {
            preview.tiles[i] = [];
            for (var j=0; j<preview.rows; j++) {
                // Define preview tiles with random types
                preview.tiles[i][j] = { type: getRandomTile() };
            }
        }
        
        // Create the level
        createLevel();
        
        // Find initial clusters and moves
        findMoves();
        findClusters(); 
        
        // Initialize color elimination statistics after level creation
        initColorStats();
    }
    
    // Create a random level
    function createLevel() {
        var done = false;
        
        // Keep generating levels until it is correct
        while (!done) {
        
            // Create a level with random tiles
            for (var i=0; i<level.columns; i++) {
                for (var j=0; j<level.rows; j++) {
                    level.tiles[i][j].type = getRandomTile();
                }
            }
            
            // Resolve the clusters
            resolveClusters();
            
            // Check if there are valid moves
            findMoves();
            
            // Done when there is a valid move
            if (moves.length > 0) {
                done = true;
            }
        }
    }
    
    // Get a random tile
    function getRandomTile() {
        var objective = levelObjectives[currentLevel - 1];
        return Math.floor(Math.random() * objective.colors);
    }
    
    // Remove clusters and insert tiles
    function resolveClusters() {
        // Check for clusters
        findClusters();
        
        // While there are clusters left
        while (clusters.length > 0) {
        
            // Remove clusters
            removeClusters();
            
            // Shift tiles
            shiftTiles();
            
            // Check if there are clusters left
            findClusters();
        }
    }
    
    // Find clusters in the level
    function findClusters() {
        // Reset clusters
        clusters = []
        
        // Find horizontal clusters
        for (var j=0; j<level.rows; j++) {
            // Start with a single tile, cluster of 1
            var matchlength = 1;
            for (var i=0; i<level.columns; i++) {
                var checkcluster = false;
                
                if (i == level.columns-1) {
                    // Last tile
                    checkcluster = true;
                } else {
                    // Check the type of the next tile
                    if (level.tiles[i][j].type == level.tiles[i+1][j].type &&
                        level.tiles[i][j].type != -1) {
                        // Same type as the previous tile, increase matchlength
                        matchlength += 1;
                    } else {
                        // Different type
                        checkcluster = true;
                    }
                }
                
                // Check if there was a cluster
                if (checkcluster) {
                    if (matchlength >= 3) {
                        // Found a horizontal cluster
                        clusters.push({ column: i+1-matchlength, row:j,
                                        length: matchlength, horizontal: true });
                    }
                    
                    matchlength = 1;
                }
            }
        }

        // Find vertical clusters
        for (var i=0; i<level.columns; i++) {
            // Start with a single tile, cluster of 1
            var matchlength = 1;
            for (var j=0; j<level.rows; j++) {
                var checkcluster = false;
                
                if (j == level.rows-1) {
                    // Last tile
                    checkcluster = true;
                } else {
                    // Check the type of the next tile
                    if (level.tiles[i][j].type == level.tiles[i][j+1].type &&
                        level.tiles[i][j].type != -1) {
                        // Same type as the previous tile, increase matchlength
                        matchlength += 1;
                    } else {
                        // Different type
                        checkcluster = true;
                    }
                }
                
                // Check if there was a cluster
                if (checkcluster) {
                    if (matchlength >= 3) {
                        // Found a vertical cluster
                        clusters.push({ column: i, row:j+1-matchlength,
                                        length: matchlength, horizontal: false });
                    }
                    
                    matchlength = 1;
                }
            }
        }
    }
    
    // Find available moves
    function findMoves() {
        // Reset moves
        moves = []
        
        // Check horizontal swaps
        for (var j=0; j<level.rows; j++) {
            for (var i=0; i<level.columns-1; i++) {
                // Swap, find clusters and swap back
                swap(i, j, i+1, j);
                findClusters();
                swap(i, j, i+1, j);
                
                // Check if the swap made a cluster
                if (clusters.length > 0) {
                    // Found a move
                    moves.push({column1: i, row1: j, column2: i+1, row2: j});
                }
            }
        }
        
        // Check vertical swaps
        for (var i=0; i<level.columns; i++) {
            for (var j=0; j<level.rows-1; j++) {
                // Swap, find clusters and swap back
                swap(i, j, i, j+1);
                findClusters();
                swap(i, j, i, j+1);
                
                // Check if the swap made a cluster
                if (clusters.length > 0) {
                    // Found a move
                    moves.push({column1: i, row1: j, column2: i, row2: j+1});
                }
            }
        }
        
        // Reset clusters
        clusters = []
    }
    
    // Loop over the cluster tiles and execute a function
    function loopClusters(func) {
        for (var i=0; i<clusters.length; i++) {
            //  { column, row, length, horizontal }
            var cluster = clusters[i];
            var coffset = 0;
            var roffset = 0;
            for (var j=0; j<cluster.length; j++) {
                func(i, cluster.column+coffset, cluster.row+roffset, cluster);
                
                if (cluster.horizontal) {
                    coffset++;
                } else {
                    roffset++;
                }
            }
        }
    }
    
    // Remove the clusters
    function removeClusters() {
        // Change the type of the tiles to -1, indicating a removed tile
        // Also track color elimination statistics with new scoring system
        loopClusters(function(index, column, row, cluster) { 
            var tileType = level.tiles[column][row].type;
            if (tileType >= 0 && tileType < colorStats.length) {
                // Only count points for the first tile of each cluster to avoid double counting
                if ((cluster.horizontal && column === cluster.column) || 
                    (!cluster.horizontal && row === cluster.row)) {
                    // Calculate points: 3 × (cluster length - 2)
                    // 3 tiles = 3×1 = 3, 4 tiles = 3×2 = 6, 5 tiles = 3×3 = 9, etc.
                    var points = 3 * (cluster.length - 2);
                    colorStats[tileType] += points;
                }
            }
            level.tiles[column][row].type = -1; 
        });

        // Calculate how much a tile should be shifted downwards
        for (var i=0; i<level.columns; i++) {
            var shift = 0;
            for (var j=level.rows-1; j>=0; j--) {
                // Loop from bottom to top
                if (level.tiles[i][j].type == -1) {
                    // Tile is removed, increase shift
                    shift++;
                    level.tiles[i][j].shift = 0;
                } else {
                    // Set the shift
                    level.tiles[i][j].shift = shift;
                }
            }
        }
    }
    
    // Shift tiles and insert new tiles
    function shiftTiles() {
        // Shift tiles
        for (var i=0; i<level.columns; i++) {
            var newTilesNeeded = 0;
            
            for (var j=level.rows-1; j>=0; j--) {
                // Loop from bottom to top
                if (level.tiles[i][j].type == -1) {
                    // Count how many new tiles we need for this column
                    newTilesNeeded++;
                } else {
                    // Swap tile to shift it
                    var shift = level.tiles[i][j].shift;
                    if (shift > 0) {
                        swap(i, j, i, j+shift)
                    }
                }
                
                // Reset shift
                level.tiles[i][j].shift = 0;
            }
            
            // Insert new tiles from preview area
            var previewIndex = 0;
            for (var j=level.rows-1; j>=0; j--) {
                if (level.tiles[i][j].type == -1) {
                    // Get tile from preview area (from bottom of preview)
                    if (previewIndex < preview.rows && preview.tiles[i] && preview.tiles[i][preview.rows - 1 - previewIndex]) {
                        level.tiles[i][j].type = preview.tiles[i][preview.rows - 1 - previewIndex].type;
                    } else {
                        level.tiles[i][j].type = getRandomTile();
                    }
                    previewIndex++;
                }
            }
            
            // Update preview area - shift existing tiles up and add new ones at bottom
            if (newTilesNeeded > 0) {
                // Shift preview tiles up
                for (var j=0; j<preview.rows - newTilesNeeded; j++) {
                    if (preview.tiles[i] && preview.tiles[i][j + newTilesNeeded]) {
                        preview.tiles[i][j].type = preview.tiles[i][j + newTilesNeeded].type;
                    }
                }
                
                // Add new random tiles at the bottom of preview
                for (var j=Math.max(0, preview.rows - newTilesNeeded); j<preview.rows; j++) {
                    if (preview.tiles[i]) {
                        preview.tiles[i][j].type = getRandomTile();
                    }
                }
            }
        }
    }
    
    // Get the tile under the mouse
    function getMouseTile(pos) {
        // Calculate the index of the tile
        var tx = Math.floor((pos.x - level.x) / level.tilewidth);
        var ty = Math.floor((pos.y - level.y) / level.tileheight);
        
        // Check if the tile is valid
        if (tx >= 0 && tx < level.columns && ty >= 0 && ty < level.rows) {
            // Tile is valid
            return {
                valid: true,
                x: tx,
                y: ty
            };
        }
        
        // No valid tile
        return {
            valid: false,
            x: 0,
            y: 0
        };
    }
    
    // Check if two tiles can be swapped
    function canSwap(x1, y1, x2, y2) {
        // Check if the tile is a direct neighbor of the selected tile
        if ((Math.abs(x1 - x2) == 1 && y1 == y2) ||
            (Math.abs(y1 - y2) == 1 && x1 == x2)) {
            return true;
        }
        
        return false;
    }
    
    // Swap two tiles in the level
    function swap(x1, y1, x2, y2) {
        var typeswap = level.tiles[x1][y1].type;
        level.tiles[x1][y1].type = level.tiles[x2][y2].type;
        level.tiles[x2][y2].type = typeswap;
    }
    
    // Swap two tiles as a player action
    function mouseSwap(c1, r1, c2, r2) {
        // Save the current move
        currentmove = {column1: c1, row1: r1, column2: c2, row2: r2};
    
        // Deselect
        level.selectedtile.selected = false;
        
        // Start animation
        animationstate = 2;
        animationtime = 0;
        gamestate = gamestates.resolve;
    }
    
    // On mouse movement
    function onMouseMove(e) {
        // Get the mouse position
        var pos = getMousePos(canvas, e);
        
        // Check if we are dragging with a tile selected
        if (drag && level.selectedtile.selected) {
            // Get the tile under the mouse
            mt = getMouseTile(pos);
            if (mt.valid) {
                // Valid tile
                
                // Check if the tiles can be swapped
                if (canSwap(mt.x, mt.y, level.selectedtile.column, level.selectedtile.row)){
                    // Swap the tiles
                    mouseSwap(mt.x, mt.y, level.selectedtile.column, level.selectedtile.row);
                }
            }
        }
    }
    
    // On mouse button click
    function onMouseDown(e) {
        // Get the mouse position
        var pos = getMousePos(canvas, e);
        
        // Start dragging
        if (!drag) {
            // Get the tile under the mouse
            mt = getMouseTile(pos);
            
            if (mt.valid) {
                // Valid tile
                var swapped = false;
                if (level.selectedtile.selected) {
                    if (mt.x == level.selectedtile.column && mt.y == level.selectedtile.row) {
                        // Same tile selected, deselect
                        level.selectedtile.selected = false;
                        drag = true;
                        return;
                    } else if (canSwap(mt.x, mt.y, level.selectedtile.column, level.selectedtile.row)){
                        // Tiles can be swapped, swap the tiles
                        mouseSwap(mt.x, mt.y, level.selectedtile.column, level.selectedtile.row);
                        swapped = true;
                    }
                }
                
                if (!swapped) {
                    // Set the new selected tile
                    level.selectedtile.column = mt.x;
                    level.selectedtile.row = mt.y;
                    level.selectedtile.selected = true;
                }
            } else {
                // Invalid tile
                level.selectedtile.selected = false;
            }

            // Start dragging
            drag = true;
        }
        
        // Check if a button was clicked
        for (var i=0; i<buttons.length; i++) {
            if (pos.x >= buttons[i].x && pos.x < buttons[i].x+buttons[i].width &&
                pos.y >= buttons[i].y && pos.y < buttons[i].y+buttons[i].height) {
                
                // Button i was clicked
                if (i == 0) {
                    // New Game
                    newGame();
                } else if (i == 1) {
                    // Show Moves
                    showmoves = !showmoves;
                    buttons[i].text = (showmoves?"Hide":"Show") + " Moves";
                } else if (i == 2) {
                    // AI Bot
                    aibot = !aibot;
                    buttons[i].text = (aibot?"Disable":"Enable") + " AI Bot";
                } else if (i == 3) {
                    // Level 1
                    currentLevel = 1;
                    newGame();
                } else if (i == 4) {
                    // Level 2
                    currentLevel = 2;
                    newGame();
                } else if (i == 5) {
                    // Level 3
                    currentLevel = 3;
                    newGame();
                }
            }
        }
    }
    
    function onMouseUp(e) {
        // Reset dragging
        drag = false;
    }
    
    function onMouseOut(e) {
        // Reset dragging
        drag = false;
    }
    
    // Get the mouse position
    function getMousePos(canvas, e) {
        var rect = canvas.getBoundingClientRect();
        return {
            x: Math.round((e.clientX - rect.left)/(rect.right - rect.left)*canvas.width),
            y: Math.round((e.clientY - rect.top)/(rect.bottom - rect.top)*canvas.height)
        };
    }
    
    // Initialize color statistics
    function initColorStats() {
        colorStats = [];
        for (var i = 0; i < tilecolors.length; i++) {
            colorStats[i] = 0;
        }
    }
    
    // Format time as MM:SS
    function formatTime(seconds) {
        var minutes = Math.floor(seconds / 60);
        var remainingSeconds = Math.floor(seconds % 60);
        return (minutes < 10 ? "0" : "") + minutes + ":" + 
               (remainingSeconds < 10 ? "0" : "") + remainingSeconds;
    }
    
    // Check if level objectives are completed
    function checkLevelCompletion() {
        var objective = levelObjectives[currentLevel - 1];
        
        // Calculate total score
        totalScore = 0;
        for (var i = 0; i < colorStats.length; i++) {
            totalScore += colorStats[i];
        }
        
        // Check if objective is met
        if (totalScore >= objective.targetTotal) {
            levelComplete = true;
            timerRunning = false;
        }
    }
    
    // Call init to start the game
    init();
};