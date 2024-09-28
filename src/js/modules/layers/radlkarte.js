const getRadlkarteLayersFor = function (sourceName) {
  return [
    {
      "id": "stress0_priority0" + sourceName,
      "type": "line",
      "source": sourceName,
      "filter": ["all", ["==", "stress", "0"], ["==", "priority", "0"]],
      "paint": { "line-color": "#004B67", "line-width": 2 }
    },
    {
      "id": "stress0_priority1" + sourceName,
      "type": "line",
      "source": sourceName,
      "filter": ["all", ["==", "stress", "0"], ["==", "priority", "1"]],
      "paint": { "line-color": "#004B67", "line-width": 1 }
    },
    {
      "id": "stress0_priority2" + sourceName,
      "type": "line",
      "source": sourceName,
      "filter": ["all", ["==", "stress", "0"], ["==", "priority", "2"]],
      "paint": { "line-color": "#004B67", "line-width": 1 }
    },
    {
      "id": "stress1_priority0" + sourceName,
      "type": "line",
      "source": sourceName,
      "filter": ["all", ["==", "stress", "1"], ["==", "priority", "0"]],
      "paint": { "line-color": "#51A4B6", "line-width": 2 }
    },
    {
      "id": "stress1_priority2" + sourceName,
      "type": "line",
      "source": sourceName,
      "filter": ["all", ["==", "stress", "1"], ["==", "priority", "2"]],
      "paint": { "line-color": "#51A4B6", "line-width": 1 }
    },
    {
      "id": "stress1_priority1" + sourceName,
      "type": "line",
      "source": sourceName,
      "filter": ["all", ["==", "stress", "1"], ["==", "priority", "1"]],
      "paint": { "line-color": "#51A4B6", "line-width": 1 }
    },
    {
      "id": "stress2_priority0" + sourceName,
      "type": "line",
      "source": sourceName,
      "filter": ["all", ["==", "stress", "2"], ["==", "priority", "0"]],
      "paint": { "line-color": "#FF6600", "line-width": 2 }
    },
    {
      "id": "stress2_priority1" + sourceName,
      "type": "line",
      "source": sourceName,
      "filter": ["all", ["==", "stress", "2"], ["==", "priority", "1"]],
      "paint": { "line-color": "#FF6600", "line-width": 1 }
    },
    {
      "id": "stress2_priority2"  + sourceName,
      "type": "line",
      "source": sourceName,
      "filter": ["all", ["==", "stress", "2"], ["==", "priority", "2"]],
      "paint": { "line-color": "#FF6600", "line-width": 1 }
    }
  ];
}

export default getRadlkarteLayersFor;
