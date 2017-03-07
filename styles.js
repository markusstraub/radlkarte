// temporary place where we keep the other style variants














// ------------------- style variant B: stressfulness = line width, priority = color

rkGlobal.priorityVisibleFromZoom = [0, 14, 15];
rkGlobal.stressfulnessLineWidthFactor = [1.2, 0.5, 0.4];
rkGlobal.stressfulnessArrowWidthFactor = [2, 3, 3];
rkGlobal.priorityOpacities = [0.75, 0.75, 0.5];
// rkGlobal.priorityColors = ['#004B67', '#29788F', '#51A4B6']; // 3 blues
rkGlobal.priorityColors = ['#FF6600', '#51A4B6', '#51A4B6']; // orange - blue
// rkGlobal.priorityColors = ['#51A4B6', '#51A4B6', '#51A4B6']; // blue (light)
// rkGlobal.priorityColors = ['#004B67', '#004B67', '#004B67']; // blue (dark)
//rkGlobal.priorityColors = ['#004B67', '#51A4B6', '#FF6600']; // blue - orange

/**
 * Updates the styles of all layers. Takes current zoom level into account
 */
function updateStylesWithStyleB() {
    for(var priority=0; priority<rkGlobal.priorityStrings.length; priority++) {
        for(var stressfulness=0; stressfulness<rkGlobal.stressfulnessStrings.length; stressfulness++) {
            if(rkGlobal.leafletMap.getZoom() >= rkGlobal.priorityVisibleFromZoom[priority]) {
                //                 rkGlobal.leafletMap.addLayer(rkGlobal.segmentsPS[priority][stressfulness].lines);
                rkGlobal.segmentsPS[priority][stressfulness].lines.setStyle(getLineStringStyleWithLineWidthDefiningStressfulness(priority, stressfulness));
                if(rkGlobal.segmentsPS[priority][stressfulness].decorators != undefined) {
                    rkGlobal.segmentsPS[priority][stressfulness].decorators.setPatterns(getOnewayArrowPatternsWithLineWidthDefiningStressfulness(priority, stressfulness));
                    rkGlobal.leafletMap.addLayer(rkGlobal.segmentsPS[priority][stressfulness].decorators);
                }
            } else {
                rkGlobal.segmentsPS[priority][stressfulness].lines.setStyle(getLineStringStyleWithLineWidthDefiningStressfulnessMinimal(priority,stressfulness));
                //                 rkGlobal.leafletMap.removeLayer(rkGlobal.segmentsPS[priority][stressfulness].lines);
                if(rkGlobal.segmentsPS[priority][stressfulness].decorators != undefined) {
                    rkGlobal.leafletMap.removeLayer(rkGlobal.segmentsPS[priority][stressfulness].decorators);
                }
            }
        }
    }
}

function getLineStringStyleWithLineWidthDefiningStressfulness(priority,stressfulness) {
    var style = {
        color: rkGlobal.priorityColors[priority],
        weight: getLineWeightForStressfulness(stressfulness),
        opacity: rkGlobal.priorityOpacities[priority]
    };
    if(stressfulness >= 2)
        style.dashArray = "5, 5";
    return style;
}

function getLineStringStyleWithLineWidthDefiningStressfulnessMinimal(priority,stressfulness) {
    var style = {
        color: '#999',
        weight: 1,
        opacity: rkGlobal.priorityOpacities[priority],
        dashArray: undefined
    };
    return style;
}

/**
 * @return an array of patterns as expected by L.PolylineDecorator.setPatterns
 */ 
function getOnewayArrowPatternsWithLineWidthDefiningStressfulness(priority, stressfulness) {
    var arrowWidth = Math.max(5, getLineWeightForStressfulness(stressfulness) * rkGlobal.stressfulnessArrowWidthFactor[stressfulness]);
    return [
    {
        offset: 25,
        repeat: 50,
        symbol: L.Symbol.arrowHead({
            pixelSize: arrowWidth,
            headAngle: 90,
            pathOptions: {
                color: rkGlobal.priorityColors[priority],
                fillOpacity: rkGlobal.priorityOpacities[priority],
                weight: 0
            }
        })
    }
    ];
}

function getLineWeightForStressfulness(stressfulness) {
    var lineWeight = rkGlobal.leafletMap.getZoom() - 10;
    lineWeight = (lineWeight <= 0 ? 1 : lineWeight) * 1.4;
    lineWeight *= rkGlobal.stressfulnessLineWidthFactor[stressfulness]
    return lineWeight;
}









































// ------------------- style variant C: stressfulness = line width / dash + color, priority = only used for hiding/minimizing lines when zooming out 

rkGlobal.tileLayerOpacity = 0.65;
rkGlobal.styleCPriorityVisibleFromZoom = [0, 15, 16];
rkGlobal.styleCLineWidthFactor = [1.4, 0.5, 0.5];
rkGlobal.styleCArrowWidthFactor = [2, 3, 3];
rkGlobal.styleCOpacity = 0.8;
// rkGlobal.styleCColors = ['#004B67', '#FF6600', '#F00']; // blue - orange - red
//rkGlobal.styleCColors = ['#004B67', '#51A4B6', '#51A4B6']; // dark blue - light blue
//rkGlobal.styleCColors = ['#004B67', '#004B67', '#FF6600']; // blue - blue - orange
//rkGlobal.styleCColors = ['#51A4B6', '#FF6600', '#ff0069']; // blue - orange - voilet
rkGlobal.styleCColors = ['#51A4B6', '#51A4B6', '#FF6600']; // blue - orange - voilet
//rkGlobal.styleCColors = ['#51A4B6', '#51A4B6', '#FF6600']; // blue - orange - voilet

/**
 * Updates the styles of all layers. Takes current zoom level into account
 */
function updateStylesWithStyleC() {
    for(var priority=0; priority<rkGlobal.priorityStrings.length; priority++) {
        for(var stressfulness=0; stressfulness<rkGlobal.stressfulnessStrings.length; stressfulness++) {
            if(rkGlobal.leafletMap.getZoom() >= rkGlobal.styleCPriorityVisibleFromZoom[priority]) {
                rkGlobal.leafletMap.addLayer(rkGlobal.segmentsPS[priority][stressfulness].lines);
                rkGlobal.segmentsPS[priority][stressfulness].lines.setStyle(getLineStringStyleC(priority, stressfulness));
                if(rkGlobal.segmentsPS[priority][stressfulness].decorators != undefined) {
                    rkGlobal.segmentsPS[priority][stressfulness].decorators.setPatterns(getOnewayArrowPatternsStyleC(priority, stressfulness));
                    rkGlobal.leafletMap.addLayer(rkGlobal.segmentsPS[priority][stressfulness].decorators);
                }
            } else if(rkGlobal.leafletMap.getZoom()+2 >= rkGlobal.styleCPriorityVisibleFromZoom[priority]) {
                rkGlobal.segmentsPS[priority][stressfulness].lines.setStyle(getLineStringStyleCBlendOut(priority,stressfulness));
                rkGlobal.leafletMap.addLayer(rkGlobal.segmentsPS[priority][stressfulness].lines);
                if(rkGlobal.segmentsPS[priority][stressfulness].decorators != undefined) {
                    rkGlobal.leafletMap.removeLayer(rkGlobal.segmentsPS[priority][stressfulness].decorators);
                }
            } else {
                rkGlobal.leafletMap.removeLayer(rkGlobal.segmentsPS[priority][stressfulness].lines);
            }
        }
    }
}

function getLineStringStyleC(priority,stressfulness) {
    var style = {
        color: rkGlobal.styleCColors[stressfulness],
        weight: getLineWeightStyleC(stressfulness),
        opacity: rkGlobal.styleCOpacity
    };
    if(priority == 0 && stressfulness == 0)
        style.color = '#004B67';
    if(stressfulness >= 2)
        style.dashArray = "5 10";
    return style;
}

function getLineStringStyleCBlendOut(priority,stressfulness) {
    var style = {
        color: rkGlobal.styleCColors[stressfulness],
        weight: 1.5,
        opacity: rkGlobal.styleCOpacity
    };
    if(stressfulness >= 2)
        style.dashArray = "5 10";
    return style;
}

function getLineWeightStyleC(category) {
    //     console.log(category)
    var lineWeight = rkGlobal.leafletMap.getZoom() - 10;
    lineWeight = (lineWeight <= 0 ? 1 : lineWeight) * 1.4;
    lineWeight *= rkGlobal.styleCLineWidthFactor[category]
    return lineWeight;
}


/**
 * @return an array of patterns as expected by L.PolylineDecorator.setPatterns
 */ 
function getOnewayArrowPatternsStyleC(priority, stressfulness) {
    var arrowWidth = Math.max(5, getLineWeightStyleC(priority) * rkGlobal.styleCArrowWidthFactor[priority]);
    return [
    {
        offset: 25,
        repeat: 50,
        symbol: L.Symbol.arrowHead({
            pixelSize: arrowWidth,
            headAngle: 90,
            pathOptions: {
                color: rkGlobal.styleCColors[stressfulness],
                fillOpacity: rkGlobal.styleCOpacity,
                weight: 0
            }
        })
    }
    ];
}














