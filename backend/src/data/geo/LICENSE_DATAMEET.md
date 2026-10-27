# DataMeet India District Boundaries Dataset & License Notice

## Dataset Provenance
- **Dataset:** 2011 Census Districts of India
- **Source Repository:** [DataMeet Maps](https://github.com/datameet/maps/tree/master/Districts/Census_2011)
- **Primary Source Files:** `2011_Dist.shp`, `2011_Dist.dbf`, `2011_Dist.prj`, `2011_Dist.shx`
- **Original Source Community:** [Data{Meet} Community Maps Project](http://datameet.org/)
- **Administrative Delimitation:** 2011 Census of India (641 administrative districts across 35 states/UTs)
- **Original Coordinate Reference System:** EPSG:4326 (WGS84, `GEOGCS["GCS_WGS_1984"...]`)

## License & Attribution Requirements
Unless explicitly stated otherwise, spatial datasets in the DataMeet repository are shared under the **Creative Commons Attribution 4.0 International (CC BY 4.0)** license.

### Required Attribution Notice:
> "District boundaries by DataMeet India community (http://datameet.org/) under Creative Commons Attribution 4.0 International (CC BY 4.0)."

## Geometric Simplification & Processing
To enable rapid, low-latency in-memory point-in-polygon queries on backend initialization without high memory consumption:
1. **Tooling:** Processed via `shapefile` Node.js parser into GeoJSON.
2. **Algorithm:** Ramer-Douglas-Peucker line simplification with an epsilon tolerance of `0.005°` (approximately 500 meters at Indian latitudes).
3. **Precision:** Coordinate coordinates rounded to 4 decimal places (~11 meters precision).
4. **Integrity Protections:** Closed polygon rings with fewer than 4 points retain original coordinates to prevent topological collapse. Holes and multipolygon structures are fully preserved.
5. **Output File:** `backend/src/data/geo/india_districts_simplified.geojson` (2.26 MB).
6. **Feature Count:** 641 verified districts.
