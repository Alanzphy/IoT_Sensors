// Frozen response examples: docs/integration/frontend-evidence/.
export interface WeatherCurrent {
  provider: string;
  coordinates: {
    requested_latitude: number;
    requested_longitude: number;
    provider_latitude: number;
    provider_longitude: number;
  };
  current: {
    observed_at: string;
    temperature_2m: number | null;
    relative_humidity_2m: number | null;
    wind_speed_10m: number | null;
    shortwave_radiation: number | null;
    weather_code: number | null;
  };
  today: { date: string; precipitation_sum: number | null; et0_fao_evapotranspiration: number | null };
  fetched_at: string;
  units: Record<string, string>;
  cache_state: "fresh" | "stale";
  cache_age_seconds: number;
}

export interface LatestNdvi {
  irrigation_area_id: number;
  ndvi: number;
  provider: string;
  collection: string;
  scene_id: string;
  scene_observed_at: string;
  cloud_cover_percent: number;
  sample_method: "point";
}
