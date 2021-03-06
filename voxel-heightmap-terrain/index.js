var lonLat = require('../lonLat'),
    fs = require('fs'),
    overlays = require('../data-overlay'),
    overlays = new overlays('data/statstomaps/exported_data/chunks/'),
    voxelMultiplier = 50, // Units for the voxels. * 50 = every one is 50m^2
    heightScaler = 0.1, // Scales down the height so nothing is too totes ridic (no I don't think that's a real phrase)
    heightmaps = {},
    gridRef,
    gridRefs = []; // So we don't have to put the same 2D coord in fifty thousand million times

module.exports = function(whichSide) {
    switch(whichSide) {
        case 'server':
            return serverSide;
        case 'client':
            return clientSide;
        default:
            console.log("You've used the generate function wrong. Please pass in either 'client' or 'server'");
    }

}

var serverSide = function(x, y, z) {
    // Value here tweaked from 4 to 8 to make things flatter
    // I also changed the y + 64 to just y to make coords better. Probably broke some wonderful mathematics with my simpleton's tramplings.
    //y = Math.round(y * 8);

    if (z < 0 || x < 0) {
        //We're off the map...
        return y === 0 ? 4 : 0;
    }

    // Otherwise figure out which Json file we need to load in.
    var E = Math.floor(z * voxelMultiplier); //Get Easting

    var N = Math.floor(x * voxelMultiplier); //Get Easting

    gridRef = lonLat({
        x: parseInt(E),
            y: parseInt(N)
    }, 'gameToGridRef');

    var c1and2E = parseFloat(E.toString().slice(0, 2)) * 10000, // Columns 1 and 2 of Easting
        c1and2N = parseFloat(N.toString().slice(0, 2)) * 10000; // Columns 1 and 2 of Easting

    var hmCoords = {
        x: (E - c1and2E) / 50,
        y: 199 - Math.floor((N - c1and2N) / 50)
    }

    var memberName = gridRef.slice(0, 2), // What to call the object member (the two letter code)
        tenKmCode = gridRef.slice(3, 4) + gridRef.slice(9, 10),
        path = '../voxel-heightmap-terrain/data/heightData/' + memberName.toLowerCase() + '.json'; // Path to needed heightmap

    if(typeof gridRef !== 'undefined' && gridRef !== '') {
        // If the appropriate heightmap is unloaded, load it
        if(!heightmaps[memberName]) {
            heightmaps[memberName] = require(path);
            console.log('Added: ' + path);
            if(heightmaps[memberName] === null) {
                // Looks like we're in the ocean
                //console.log('At the end of the lane');
                return y === 0 ? 4 : 0;
            } else {
                if(typeof heightmaps[memberName][memberName + tenKmCode] === 'undefined') {
                    // Looks like we're in the ocean
                    console.log('At the end of the lane');
                    return y === 0 ? 4 : 0;
                } else {
                    // We have height data for this block
                    return y < (heightmaps[memberName][memberName + tenKmCode][hmCoords.x][hmCoords.y]) * heightScaler ? 1 : 0;
                }
            }
        } else {
            if(typeof heightmaps[memberName][memberName + tenKmCode] !== 'undefined') {
                return y < (heightmaps[memberName][memberName + tenkmCode][hmCoords.x][hmCoords.y]) * heightScaler ? 2 : 0;
            } else {
                // Looks like we're in the ocean
                //console.log('At the end of the lane');
                return y === 0 ? 4 : 0;
            }
        }
    }


    if(y < 0) {
        return 0;
    }

    if(y === 0) {
        return 4; // Obsidian
    }

    return y === 0 ? 4 : 0;
}

var clientSide = function(x, y, z) {
    var blockValue;
    var E = x * voxelMultiplier;

    var N = z * voxelMultiplier;

    // In theory should speed up the chunk generation.... Still very slow here :( 
    if(typeof gridRefs[E] === 'undefined') {
        gridRefs[E] = [];
        gridRefs[E][N] = gridRef = lonLat({
            x: E,
            y: N
        }, 'gameToGridRef');
    } else if(typeof gridRefs[E][N] === 'undefined') {
        gridRefs[E] = [];
        gridRefs[E][N] = gridRef = lonLat({ 
            x: E,
            y: N
        }, 'gameToGridRef');
    } else {
        gridRef = gridRefs[E][N];
    }

    // This breathtakingly beautiful piece of code sorts out returning the right height, after loading the heightmap if it isn't already here
    if(typeof gridRef !== 'undefined' && gridRef !== '') {
        // Convert coords for use with the json
        var memberName = gridRef.slice(0, 2), // What to call the object member (the two letter code)
            tenKmCode = gridRef.slice(3, 4) + gridRef.slice(9, 10);

        var c1and2E = parseFloat(E.toString().slice(0, 2)) * 10000, // Columns 1 and 2 of Easting
            c1and2N = parseFloat(N.toString().slice(0, 2)) * 10000; // Columns 1 and 2 of Northing

        var hmCoords = {
            x: Math.floor((E - c1and2E) / 50),
            y: 199 - Math.floor((N - c1and2N) / 50) // Seems like this is how the y coords are stored. Like I'm doing Northings half backwards or something
        }


        // Get from heightmap, or load if heightmap isn't there
        if(heightmaps[memberName]) {
            if(typeof heightmaps[memberName][memberName + tenKmCode] === 'undefined') {
                // Looks like we're in the ocean
                blockValue = y === 0 ? 4 : 0;
            } else {
                // We have height data for this block
                blockValue = y < heightmaps[memberName][memberName + tenKmCode][hmCoords.x][hmCoords.y] * heightScaler ? 1 : 0;
            }
        } else {
            // Load
            var path = '/data/heightData/' + memberName.toLowerCase() + '.json'; // Path to needed heightmap

            console.log("loading: " + path);

            var heightmap = new XMLHttpRequest();
            heightmap.open("GET", path, false); // TODO make async work

            heightmap.send(null);

            heightmaps[memberName] = JSON.parse(heightmap.response);
            console.log("added " + memberName);

            if(typeof heightmaps[memberName][memberName + tenKmCode] === 'undefined') {
                // Looks like we're in the ocean
                console.log('At the end of the lane');
                blockValue = y === 0 ? 4 : 0;
            } else {
                // We have height data for this block
                blockvalue = y < heightmaps[memberName][memberName + tenKmCode][hmCoords.x][hmCoords.y] * heightScaler ? 1 : 0;
            }
        }

        // Now blockValue should be equal to the value we want for this block not taking into account structures, ie cities/forts

        var overlay = overlays.getOverlay({
            x: x * voxelMultiplier,
            y: z * voxelMultiplier
        });

        if(blockValue > 0) {

            switch(overlay[0]) {
                case 0:
                    blockValue = 0;
                    break;
                case 1:
                    blockValue = 1;
                    break;
                case 2:
                    blockValue = 2;
                    break;
                case 3:
                    blockValue = 2;
                    break;
                case 4:
                    blockValue = 2;
                    break;
                case 5:
                    blockValue = 2;
                    break;
                default:
                    blockValue = 0;
            }

        }

        return blockValue;
    }
}
