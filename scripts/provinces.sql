-- Dump all provinces as line delimeted GeoJSON features.

\copy (SELECT JSONB_BUILD_OBJECT('type', 'Feature', 'geometry', ST_AsGEOJSON(geom)::JSONB, 'properties', JSONB_BUILD_OBJECT('id', id, 'type', type)) FROM admin_boundaries WHERE type='province') to .tmp/provinces.json