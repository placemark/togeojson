import { nodeVal, get1 } from "./shared";

const attributeNames = [
  // Trackpoint attributes
  ["heartRate", "heartRates"],
  ["cadence", "cadences"],
  // Extended Trackpoint attributes
  ["Speed", "speeds"],
  ["Watts", "watts"],
  // Lap attributes
  ["TotalTimeSeconds", "totalTimeSeconds"],
  ["DistanceMeters", "distanceMeters"],
  ["MaximumSpeed", "maxSpeed"],
  ["AverageHeartRateBpm", "avgHeartRate"],
  ["MaximumHeartRateBpm", "maxHeartRate"],
  // Extended Lap attributes
  ["AvgSpeed", "avgSpeed"],
  ["AvgWatts", "avgWatts"],
  ["MaxWatts", "maxWatts"],
];

function getProperties(node) {
  const prop = {};
  const extensions = node.getElementsByTagNameNS(
    "http://www.garmin.com/xmlschemas/ActivityExtension/v2",
    "*"
  );
  attributeNames.forEach((attr) => {
    const raw = get1(node, attr[0]);
    if (raw !== null) {
      prop[attr[1]] = parseFloat(nodeVal(raw));
    } else if (extensions !== null) {
      for (let i = 0; i < extensions.length; i++) {
        const extension = extensions[i];
        if (extension.localName === attr[0]) {
          const ext = nodeVal(extension);
          if (ext !== null) {
            const v = parseFloat(ext);
            if (!isNaN(v)) {
              prop[attr[1]] = v;
            }
          }
        }
      }
    }
  });
  return prop;
}

function coordPair(x) {
  const lon = nodeVal(get1(x, "LongitudeDegrees"));
  const lat = nodeVal(get1(x, "LatitudeDegrees"));
  if (!lon.length || !lat.length) {
    return null;
  }
  const ll = [parseFloat(lon), parseFloat(lat)];
  const alt = get1(x, "AltitudeMeters");
  const heartRate = get1(x, "HeartRateBpm");
  const cadence = get1(x, "Cadence");
  const time = get1(x, "Time");
  let a;
  if (alt) {
    a = parseFloat(nodeVal(alt));
    if (!isNaN(a)) {
      ll.push(a);
    }
  }
  const result = {
    coordinates: ll,
    time: time ? nodeVal(time) : null,
    heartRate: heartRate ? parseFloat(nodeVal(heartRate)) : null,
    cadence: cadence ? parseFloat(nodeVal(cadence)) : null,
  };
  const extensions = x.getElementsByTagNameNS(
    "http://www.garmin.com/xmlschemas/ActivityExtension/v2",
    "*"
  );
  if (extensions !== null) {
    for (let i = 0; i < extensions.length; i++) {
      const extension = extensions[i];
      attributeNames
        .map((r) => r[0])
        .filter((n) => n === extension.localName)
        .forEach((name) => {
          const raw = nodeVal(extension);
          if (raw !== null) {
            const v = parseFloat(raw);
            if (!isNaN(v)) {
              result[name] = v;
            }
          }
        });
    }
  }
  return result;
}

function getPoints(node, pointname) {
  const pts = node.getElementsByTagName(pointname);
  const line = [];
  const times = [];
  const l = pts.length;
  const extendedValues = {};
  if (l < 2) return {}; // Invalid line in GeoJSON
  for (let i = 0; i < l; i++) {
    const c = coordPair(pts[i]);
    if (c === null) continue;
    line.push(c.coordinates);
    if (c.time) times.push(c.time);
    attributeNames
      .map((r) => r[0])
      .forEach((name) => {
        if (c[name] || extendedValues[name]) {
          if (!extendedValues[name]) {
            extendedValues[name] = Array(i).fill(null);
          }
          extendedValues[name].push(c[name] || null);
        }
      });
  }
  const result = {
    line: line,
    times: times,
  };
  attributeNames.forEach((n) => {
    if (extendedValues[n[0]]) {
      result[n[1]] = extendedValues[n[0]] || [];
    }
  });
  return result;
}

function getLap(node) {
  const segments = node.getElementsByTagName("Track");
  const track = [];
  const times = [];
  const extendedValues = {};
  let line;
  for (let i = 0; i < segments.length; i++) {
    line = getPoints(segments[i], "Trackpoint");
    if (line) {
      if (line.line) track.push(line.line);
      if (line.times && line.times.length) times.push(line.times);

      attributeNames
        .map((r) => r[1])
        .forEach((name) => {
          if (
            (extendedValues[name] && extendedValues[name].length) ||
            (line[name] && line[name].length)
          ) {
            if (!extendedValues[name]) {
              extendedValues[name] = [];
            }
            if (!extendedValues[name].length) {
              for (let s = 0; s < i; s++) {
                extendedValues[name].push(Array(track[s].length).fill(null));
              }
            }
            if (line[name] && line[name].length) {
              extendedValues[name].push(line[name]);
            } else {
              extendedValues[name].push(
                Array(line.line.length || 0).fill(null)
              );
            }
          }
        });
    }
  }
  if (track.length === 0) return;
  const properties = Object.assign(
    getProperties(node)
  );
  if (times.length)
    properties.coordTimes = track.length === 1 ? times[0] : times;
  attributeNames.forEach((n) => {
    if (extendedValues[n[1]] && extendedValues[n[1]].length) {
      properties[n[1]] =
        track.length === 1 ? extendedValues[n[1]][0] : extendedValues[n[1]];
    }
  });
  return {
    type: "Feature",
    properties: properties,
    geometry: {
      type: track.length === 1 ? "LineString" : "MultiLineString",
      coordinates: track.length === 1 ? track[0] : track,
    },
  };
}

export function* tcxGen(doc) {
  const laps = doc.getElementsByTagName("Lap");

  for (let i = 0; i < laps.length; i++) {
    const feature = getLap(laps[i]);
    if (feature) yield feature;
  }
}

export function tcx(doc) {
  return {
    type: "FeatureCollection",
    features: Array.from(tcxGen(doc)),
  };
}
