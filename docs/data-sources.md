# Third-party data

Data the app carries that we did not produce. Code dependencies are in the
lockfile; this is the list of _data_, which has its own licences and its own
attribution obligations.

## Cities — GeoNames

`cities` holds every place with a population over fifteen thousand — about
thirty-two thousand rows once the seed drops what nobody calls home: the
export also lists neighbourhoods (`PPLX`, a "section of populated place") and
historical, abandoned or destroyed places, and a Toronto waterfront district
outranking Toronto is what happens when they are left in. A profile's city is
read off its stored coordinates against this list, and the discovery filter
searches the same list, so the two ends of that filter cannot disagree.

|             |                                                             |
| ----------- | ----------------------------------------------------------- |
| Source      | <https://download.geonames.org/export/dump/cities15000.zip> |
| Licence     | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)   |
| Seeded by   | `apps/api/scripts/seed-cities.ts`                           |
| Credited in | this file, `README.md`, and the app's "Our Kitchen" screen  |

The required notice, which must appear wherever the data is credited:

> This work is based on data from GeoNames (<https://www.geonames.org/>),
> licensed under CC BY 4.0.

Refreshing it is a re-run of the seed script against a newly downloaded export;
every row is upserted by its own id, so ids are stable across updates and a
profile's `cityId` survives. A row the export no longer carries — or one the
seed now skips — is deleted, and every profile that pointed at it has its city
worked out again from its stored coordinates, so a city never outlives the
list it came from.

**Attribution is a licence condition, not a courtesy.** Removing it from any of
the three places above is a licence breach, and the repo is public.
