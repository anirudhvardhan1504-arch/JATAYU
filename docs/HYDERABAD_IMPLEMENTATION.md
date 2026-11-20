# Hyderabad weather and facility improvements

Implemented 20 November 2026.

## Weather

- Reuse Open-Meteo; do not add a second duplicate integration.
- Request 72 hours from the current hour plus 24 past hours rather than calendar-day windows.
- Match 15-minute current-condition timestamps to the correct hourly weather/soil bucket and emit UTC ISO timestamps.
- Reject missing or non-finite required measurements instead of inventing zero rainfall, calm wind, normal pressure, or clear sky. The existing error UI reports unavailable feeds. This deliberately fails the affected feed closed; optional soil moisture remains optional and its missing tier is `UNKNOWN`.
- Model-derived current conditions and numerical forecasts have separate provenance types; they are not official warnings or station observations.
- Validate grid measurements before accepting a provider so incomplete responses trigger the existing GFS/stale fallback.
- Require Node 22.13 or newer for the existing native SQLite integration; align fresh-install development defaults on port 5000.

## Hyderabad directory

Nine initial public/private hospital records are bundled in `backend/src/data/geo/verified_facilities.json`. This is a starter directory, not complete GHMC coverage or a live dispatch inventory.

Sources reviewed on 20 November 2026:

- Government hospital directory: https://www.telangana.gov.in/Contacts/Hospitals/
- Gandhi location: https://gandhihospital.telangana.gov.in/contact.html
- Apollo Hyderguda address, contact, emergency, trauma, intensive-care and ambulance information: https://www.apollohospitals.com/hospitals/apollo-hospitals-hyderguda
- Yashoda branch contacts and map links: https://www.yashodahospitals.com/contact-us
- Yashoda provider-reported emergency/trauma services: https://www.yashodahospitals.com/specialities/emergency-services

Government hospital coordinates are community map campus/reference points (individual source links are stored), not confirmed emergency entrances. Private hospital reference points come from provider map links. A source review does not verify present-day phone service, entrance access, staffing, beds, emergency capability, or real-time capacity. Public records retain `GENERAL_DIRECTORY`, not `OFFICIALLY_VERIFIED`; all availability remains `UNKNOWN`. Government hospital trauma capability is not inferred from hospital names. Provider-reported capabilities are searchable but require calling to confirm branch service.

## Facility behavior and UI

- Preserve per-record verification and source provenance.
- Match medical, trauma and ambulance filters against documented categories/capabilities.
- Keep different named facilities even if within 250 metres. Match duplicates using identity or matching name plus proximity.
- Match the 100 km UI radius limit; mark nearest fallback records explicitly outside the requested radius.
- Show source links, review dates, capabilities, and outside-radius warnings in directory and SafeRoute cards.
- Ignore obsolete directory responses when location/filters change; clear old cards while refreshing.
- Compact directory cards, wrapping controls, readable details, 44 px controls and visible focus treatment support desktop/mobile.

## Remaining design work

The broader Stitch/Figma visual redesign is awaiting an approved mockup. These changes improve the existing UI; they do not claim to reproduce an unapproved design. Complete GHMC facility coverage, verified emergency entrances, and direct service verification require further source collection and local confirmation. Prediction accuracy has not been independently validated.
