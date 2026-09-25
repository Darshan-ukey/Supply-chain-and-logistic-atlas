# Canonical Entity Normalization Rule v1

This rule exists because the first Road LTL daughter build exposed an ambiguity in the frozen parent wording `Location Master / Location Identity`.

## Permanent rule

- Canonical ID: `obj-location-master`
- Canonical name: **Location Master**
- Governed aliases: **Location Identity**, **Place Master**, **Site Master**
- The ID never changes.
- Existing references never change.
- An alias is not a second canonical object.
- Daughter modules must reuse `obj-location-master`; they must not create another location/site identity object for wording variation.
- Canonical Business Object names must be atomic; slash-combined or `X or Y` canonical names fail publication.

## Compatibility

This is a label/alias normalization, not an ontology migration. Existing populated data linked by `obj-location-master` remains valid and requires no remapping.
