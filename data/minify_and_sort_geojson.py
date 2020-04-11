#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# This script deals with GeoJSON files produced by JOSM,
# i.e. a FeatureCollection with Points and LineStrings, and serves two purposes:
# 1) reduce file size (for faster download)
# 2) stable feature order for minimum diffs after changes
#    (JOSM unfortunately reorders the GeoJSON)
#
# For the latter point it adds unique ids to each feature and gracefully
# handles duplicate and invalid ids.


import json
import logging
import sys
logFormatter = '%(asctime)s - %(levelname)s - %(message)s'
logging.basicConfig(format=logFormatter, level=logging.INFO)


def enforce_int_id_in_feature_properties(feature):
    if feature['properties'] is None:
        feature['properties'] = {}
    int_id = -1
    try:
        int_id = int(feature['properties']['id'])
    except KeyError:
        logging.info('no id in {}'.format(feature['properties']))
    except ValueError:
        logging.info('invalid id in {}'.format(feature['properties']))
    feature['properties']['id'] = int_id


def restrict_decimal_precision(geometry):
    tuples = None
    if geometry['type'] == 'LineString':
        tuples = geometry['coordinates']
    elif geometry['type'] == 'Point':
        tuples = [geometry['coordinates']]
    else:
        logging.warning('ignoring geometry type {}'.format(geometry['type']))

    for tuple in tuples:
        tuple[0] = float('{:.5f}'.format(tuple[0]).rstrip('0').rstrip('.'))
        tuple[1] = float('{:.5f}'.format(tuple[1]).rstrip('0').rstrip('.'))


def get_max_id(features):
    ids = [feature['properties']['id'] for feature in features]
    return max(ids)


def get_features_with_duplicate_or_invalid_ids(features):
    seen_ids = set()
    bad_features = []
    for feature in features:
        id = feature['properties']['id']
        if id in seen_ids or id < 0:
            bad_features.append(feature)
        seen_ids.add(id)
    return bad_features


def set_new_ids(features, start_id):
    current_id = start_id
    for feature in features:
        feature['properties']['id'] = current_id
        current_id += 1


def minimize(infile, outfile):
    data = None
    try:
        with open(infile) as json_file:
            data = json.load(json_file)
    except(json.JSONDecodeError):
        logging.warning('{} is not a valid json file - skipping.'.format(infile))
        return

    if 'features' not in data:
        logging.warning('{} is not a valid geojson file - skipping.'.format(infile))
        return

    features = data['features']
    logging.info("{} features parsed from {}".format(len(features), infile))

    for feature in features:
        enforce_int_id_in_feature_properties(feature)
        restrict_decimal_precision(feature['geometry'])

    bad_features = get_features_with_duplicate_or_invalid_ids(features)
    max_id = max(1, get_max_id(features))
    logging.info("max id found was {}".format(max_id))
    set_new_ids(bad_features, max_id + 1)

    id_to_feature = {feature['properties']['id']: feature for feature in features}
    sorted_ids = sorted(id_to_feature.keys())

    with open(outfile, 'w') as json_file:
        json_file.write('{"type": "FeatureCollection", "features": [\n')
        for id in sorted_ids[:-1]:
            json_file.write(json.dumps(id_to_feature[id], sort_keys=True, indent=None))
            json_file.write(",\n")
        json_file.write(json.dumps(id_to_feature[sorted_ids[-1]], sort_keys=True, indent=None))
        json_file.write(']}')
    logging.info("{} features ({} with new id) written to {}".format(len(sorted_ids),
                                                                     len(bad_features),
                                                                     outfile))


if __name__ == '__main__':
    if len(sys.argv) > 1:
        for infile in sys.argv[1:]:
            minimize(infile, infile)
    else:
        print('Usage: add one or more geojson files to be minimized as arguments')
