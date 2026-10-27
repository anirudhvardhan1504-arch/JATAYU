import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as shapefile from 'shapefile';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SHP_URL = 'https://raw.githubusercontent.com/datameet/maps/master/Districts/Census_2011/2011_Dist.shp';
const DBF_URL = 'https://raw.githubusercontent.com/datameet/maps/master/Districts/Census_2011/2011_Dist.dbf';

// Standard Ramer-Douglas-Peucker simplification
function perpendicularDistance(p: [number, number], p1: [number, number], p2: [number, number]): number {
  let dx = p2[0] - p1[0];
  let dy = p2[1] - p1[1];
  const mag = Math.hypot(dx, dy);
  if (mag > 0) {
    dx /= mag;
    dy /= mag;
  }
  const p1x = p[0] - p1[0];
  const p1y = p[1] - p1[1];
  const proj = p1x * dx + p1y * dy;
  let ax = p1x - proj * dx;
  let ay = p1y - proj * dy;
  return Math.hypot(ax, ay);
}

function ramerDouglasPeucker(points: [number, number][], epsilon: number): [number, number][] {
  if (points.length <= 2) return points;
  let dmax = 0;
  let index = 0;
  const end = points.length - 1;
  for (let i = 1; i < end; i++) {
    const d = perpendicularDistance(points[i], points[0], points[end]);
    if (d > dmax) {
      index = i;
      dmax = d;
    }
  }
  if (dmax > epsilon) {
    const rec1 = ramerDouglasPeucker(points.slice(0, index + 1), epsilon);
    const rec2 = ramerDouglasPeucker(points.slice(index), epsilon);
    return rec1.slice(0, rec1.length - 1).concat(rec2);
  } else {
    return [points[0], points[end]];
  }
}

function simplifyRing(ring: [number, number][], epsilon: number): [number, number][] {
  if (ring.length < 4) return ring;
  // Ensure closed ring
  const isClosed = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1];
  const simplified = ramerDouglasPeucker(ring, epsilon);
  // Guarantee closed ring has at least 4 coordinates for valid GeoJSON polygon
  if (simplified.length < 4) {
    return ring;
  }
  if (isClosed && (simplified[0][0] !== simplified[simplified.length - 1][0] || simplified[0][1] !== simplified[simplified.length - 1][1])) {
    simplified.push(simplified[0]);
  }
  return simplified.map(([x, y]) => [Number(x.toFixed(4)), Number(y.toFixed(4))]);
}

function simplifyGeometry(geom: any, epsilon: number): any {
  if (!geom) return null;
  if (geom.type === 'Polygon') {
    return {
      type: 'Polygon',
      coordinates: geom.coordinates.map((ring: [number, number][]) => simplifyRing(ring, epsilon)),
    };
  } else if (geom.type === 'MultiPolygon') {
    return {
      type: 'MultiPolygon',
      coordinates: geom.coordinates.map((poly: [number, number][][]) =>
        poly.map((ring: [number, number][]) => simplifyRing(ring, epsilon))
      ),
    };
  }
  return geom;
}

async function run() {
  console.log('Downloading DataMeet Census_2011 SHP & DBF...');
  const [shpRes, dbfRes] = await Promise.all([
    fetch(SHP_URL),
    fetch(DBF_URL),
  ]);

  if (!shpRes.ok || !dbfRes.ok) {
    throw new Error(`Failed to fetch: SHP ${shpRes.status}, DBF ${dbfRes.status}`);
  }

  const shpBuf = Buffer.from(await shpRes.arrayBuffer());
  const dbfBuf = Buffer.from(await dbfRes.arrayBuffer());

  console.log(`Downloaded: SHP ${shpBuf.length} bytes, DBF ${dbfBuf.length} bytes`);

  const source = await shapefile.open(shpBuf, dbfBuf, { encoding: 'utf-8' });
  const features: any[] = [];

  // Epsilon 0.005 degrees ≈ ~500m tolerance
  const EPSILON = 0.005;

  let readResult = await source.read();
  while (!readResult.done) {
    const feat = readResult.value;
    if (feat && feat.geometry && feat.properties) {
      const simplifiedGeom = simplifyGeometry(feat.geometry, EPSILON);
      features.push({
        type: 'Feature',
        properties: {
          district: String(feat.properties.DISTRICT || '').trim().toUpperCase(),
          state: String(feat.properties.ST_NM || '').trim().toUpperCase(),
          censusCode: feat.properties.censuscode ? String(feat.properties.censuscode).trim() : undefined,
          stateCode: feat.properties.ST_CEN_CD ? Number(feat.properties.ST_CEN_CD) : undefined,
          districtCode: feat.properties.DT_CEN_CD ? Number(feat.properties.DT_CEN_CD) : undefined,
        },
        geometry: simplifiedGeom,
      });
    }
    readResult = await source.read();
  }

  console.log(`Extracted & simplified ${features.length} districts.`);

  const geojson = {
    type: 'FeatureCollection',
    metadata: {
      source: 'DataMeet India Community Maps (Census 2011 Districts)',
      sourceUrl: 'https://github.com/datameet/maps/tree/master/Districts/Census_2011',
      license: 'Creative Commons Attribution 4.0 International (CC BY 4.0)',
      attribution: 'District boundaries by DataMeet India community (http://datameet.org/) under CC BY 4.0',
      vintage: '2011 Census of India administrative delimitation',
      crs: 'EPSG:4326 (WGS84)',
      featureCount: features.length,
      simplification: 'Douglas-Peucker algorithm with 0.005° (~500m) tolerance and 4-decimal precision',
      processedAt: new Date().toISOString(),
    },
    features,
  };

  const outPath = path.resolve(__dirname, 'india_districts_simplified.geojson');
  const jsonStr = JSON.stringify(geojson);
  fs.writeFileSync(outPath, jsonStr, 'utf-8');

  console.log(`Saved simplified GeoJSON to: ${outPath} (${(jsonStr.length / 1024 / 1024).toFixed(2)} MB)`);
}

run().catch((err) => {
  console.error('Error processing district boundaries:', err);
  process.exit(1);
});
