# Sources and licences

Application code is MIT licensed. That licence does not relicense imagery,
geographic data, or derived clue files. The application also exposes this list
through its bilingual “Sources and licences” view.

| Material                     | Use in GEOLUKITUKI                                      | Terms / attribution                                                                                                                                                                  |
| ---------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Copernicus Sentinel-2 L2A    | 90 satellite clues                                      | `Contains modified Copernicus Sentinel data (year)`; Copernicus Sentinel Data Terms                                                                                                  |
| Microsoft Planetary Computer | STAC selection and server-side WebP rendering           | Service terms apply; each source item and date are retained in the private manifest                                                                                                  |
| OpenStreetMap                | Source geometry for five anonymized metro clues         | © OpenStreetMap contributors, ODbL 1.0                                                                                                                                               |
| EOxCloudless 2025            | Satellite context shown only on the metro guessing map  | EOxCloudless by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2025); non-commercial use under CC BY-NC-SA 4.0, commercial use requires the applicable EOX licence |
| GeoNames                     | Names and reference locations for the 30-city catalogue | CC BY 4.0                                                                                                                                                                            |
| Natural Earth                | South Korea country outline                             | Public domain                                                                                                                                                                        |

Full terms and primary documentation:

- [Copernicus Data Space terms](https://dataspace.copernicus.eu/terms-and-conditions)
- [Microsoft Planetary Computer Data API](https://planetarycomputer.microsoft.com/docs/quickstarts/using-the-data-api/)
- [Microsoft Planetary Computer terms](https://planetarycomputer.microsoft.com/terms)
- [OpenStreetMap copyright and licence](https://www.openstreetmap.org/copyright)
- [EOxCloudless licence summary](https://cloudless.eox.at/documentation/license)
- [GeoNames data export and licence](https://www.geonames.org/export/)
- [Natural Earth terms](https://www.naturalearthdata.com/about/terms-of-use/)

## Publication boundary

The public site contains optimized clue images, anonymous metro JSON, and the
country outline. Exact answers, source item IDs, raw OSM responses, checksums,
and build manifests stay in D1 or the private repository. Anyone with repository
access can see those records, which is why this MVP repository remains private.

The EOxCloudless layer is a runtime dependency and has a stricter use boundary
than the MIT code. Before charging for the game or using it commercially,
replace that layer with appropriately licensed/self-hosted imagery or obtain the
required EOX licence. Keep its attribution visible in the map in every case.
