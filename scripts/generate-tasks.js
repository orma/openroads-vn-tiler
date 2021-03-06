#!/usr/bin/env node

'use strict'

var fs = require('fs')
var collect = require('stream-collect')
var match = require('networkmatch')
var linestring = require('turf-linestring')
var ndjson = require('ndjson')
var _ = require('lodash');
var GeoJsonGeometriesLookup = require('geojson-geometries-lookup');
var provinces = JSON.parse(fs.readFileSync(process.argv[3], {'encoding': 'utf-8'}));
var districts = JSON.parse(fs.readFileSync(process.argv[4], {'encoding': 'utf-8'}));
var glookupProvinces = new GeoJsonGeometriesLookup(provinces);
var glookupDistricts = new GeoJsonGeometriesLookup(districts);

// 50m threshold
var THRESHOLD = 0.005

var input = fs.createReadStream(process.argv[2])
.pipe(ndjson.parse())
collect(input, function (i) {
  i.forEach(feature => { feature._id = feature.way_id })
  var network = {
    type: 'FeatureCollection',
    features: i
  }
  function lookForIntersections (feature) {
    var neighbors;

    // filter for ways with vpromms.
    if (feature.properties.hasOwnProperty('or_vpromms')) {
      var start = linestring(feature.geometry.coordinates.slice(0, 2))
      var end = linestring(feature.geometry.coordinates.slice(-2, 0))
      start._id = end._id = feature.way_id
      neighbors = match.match(start, THRESHOLD)
      .concat(match.match(end, THRESHOLD))
      .map(c => c[2])
    }

    if (neighbors && neighbors.length) {
      // find provinces this way passes through
      let provinceMemberships = glookupProvinces.getContainers(feature.geometry, {ignorePoints: true});
      let provinceIds = [];
      provinceMemberships.features.forEach(membership => {
        provinceIds.push(membership.properties.id);
      });
      // find districts this way passes through
      let districtsMemberships = glookupDistricts.getContainers(feature.geometry, {ignorePoints: true});
      let districtIds = [];
      districtsMemberships.features.forEach(membership => {
        districtIds.push(membership.properties.id);
      });

      provinceIds = provinceIds.join(',');
      districtIds = districtIds.join(',');
      let ids = neighbors.join(',');
      // create a uuid as a string of all way ids involved for deduping later
      let uuid = neighbors.concat([feature.way_id]).sort().join(',')
      return { uuid: uuid, way_id: feature.way_id, neighbors: `"{${ids}}"`, provinces: `"{${provinceIds}}"`, districts: `"{${districtIds}}"`, updated_at: new Date().toISOString() }
    }
    return null
  }

  match.index(network)
  var result = network.features.map(lookForIntersections).filter(Boolean)
  result = _.uniqBy(result, (task) => {
    return task.uuid;
  });
  var headers = ['way_id', 'neighbors', 'provinces', 'districts', 'updated_at']

  result.forEach(result => {
    console.log(headers.map(h => result[h]).join(','))
  })
})

function dblQuote (s) {
  return " + s + "
}
