// src/utils/mapDataBuilders.js
import { getPackageTags, hasCoordinates } from './tagUtils';

export function resolveIso3(props) {
  if (!props) return null;
  const candidates = [
    props.ISO_A3_EH,
    props.ADM0_A3,
    props.ISO_A3,
    props.iso_a3,
    props.adm0_a3,
  ];
  for (const candidate of candidates) {
    const value = candidate ? String(candidate).trim().toUpperCase() : '';
    if (value && value !== '-99' && value.length === 3) return value;
  }
  return null;
}

export function boundsForCities(cities) {
  if (!cities || cities.length === 0) return null;
  let west = 180, south = 90, east = -180, north = -90;

  cities.forEach(({ lon, lat }) => {
    if (lon < west) west = lon;
    if (lon > east) east = lon;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  });

  const padLon = Math.max((east - west) * 0.25, 1.5);
  const padLat = Math.max((north - south) * 0.25, 1.5);

  return [
    [Math.max(west - padLon, -179), Math.max(south - padLat, -85)],
    [Math.min(east + padLon, 179), Math.min(north + padLat, 85)],
  ];
}

export function buildDestinations(packagesData) {
  const byDestination = new Map();
  const safeData = Array.isArray(packagesData) ? packagesData : [];

  safeData.forEach((pkg) => {
    if (!pkg || !pkg.destination) return;
    if (!byDestination.has(pkg.destination)) {
      byDestination.set(pkg.destination, {
        destination: pkg.destination,
        country: pkg.country || '',
        lat: pkg.lat || 0,
        lon: pkg.lon || 0,
        iso3: pkg.iso3 || '',
        tags: new Set(),
        packages: [],
      });
    }
    const entry = byDestination.get(pkg.destination);
    entry.packages.push(pkg);
    if (!hasCoordinates(entry) && hasCoordinates(pkg)) {
      entry.lat = Number(pkg.lat);
      entry.lon = Number(pkg.lon);
    }
    getPackageTags(pkg).forEach((t) => entry.tags.add(t));
  });

  return Array.from(byDestination.values()).map((d) => ({
    ...d,
    tags: Array.from(d.tags),
  }));
}

export function buildCityIndex(cityPackagesData) {
  const byCountry = new Map();
  const safeData = Array.isArray(cityPackagesData) ? cityPackagesData : [];

  safeData.forEach((pkg) => {
    if (!pkg || !pkg.iso3 || !pkg.city) return;
    const iso3 = String(pkg.iso3).toUpperCase();
    if (!byCountry.has(iso3)) byCountry.set(iso3, new Map());
    const cities = byCountry.get(iso3);

    if (!cities.has(pkg.city)) {
      cities.set(pkg.city, {
        name: pkg.city,
        lat: pkg.lat || 0,
        lon: pkg.lon || 0,
        iso2: pkg.iso2 || '',
        iso3,
        tags: new Set(),
        packages: [],
      });
    }

    const entry = cities.get(pkg.city);
    entry.packages.push(pkg);
    if (!hasCoordinates(entry) && hasCoordinates(pkg)) {
      entry.lat = Number(pkg.lat);
      entry.lon = Number(pkg.lon);
    }
    getPackageTags(pkg).forEach((t) => entry.tags.add(t));
  });

  const index = {};
  byCountry.forEach((cities, iso3) => {
    index[iso3] = Array.from(cities.values())
      .map((c) => ({ ...c, tags: Array.from(c.tags) }))
      .sort((a, b) => b.packages.length - a.packages.length);
  });
  return index;
}