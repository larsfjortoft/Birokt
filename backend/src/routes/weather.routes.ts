import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateQuery } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess, sendError, ErrorCodes } from '../utils/response.js';
import { cacheResponse } from '../middleware/cacheMiddleware.js';

const router = Router();

// Met.no Locationforecast API
// Docs: https://api.met.no/weatherapi/locationforecast/2.0/documentation
const MET_API_BASE = 'https://api.met.no/weatherapi/locationforecast/2.0';
const USER_AGENT = 'Birokt/1.0 (https://birokt.no; support@birokt.no)';

// Cache for weather data (simple in-memory cache)
interface WeatherCache {
  data: WeatherData;
  expires: number;
  locationKey: string;
}

interface WeatherData {
  temperature: number;
  windSpeed: number;
  windDirection?: number;
  humidity?: number;
  precipitation?: number;
  cloudCover?: number;
  condition: string;
  conditionCode: string;
  updatedAt: string;
  location: {
    lat: number;
    lng: number;
  };
}

const weatherCache = new Map<string, WeatherCache>();
const CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// Validation schema
const weatherQuerySchema = z.object({
  lat: z.string().transform(Number).pipe(z.number().min(-90).max(90)),
  lng: z.string().transform(Number).pipe(z.number().min(-180).max(180)),
});

// Map met.no symbol codes to simple conditions
function mapSymbolToCondition(symbolCode: string): { condition: string; conditionCode: string } {
  // Symbol codes from met.no: https://api.met.no/weatherapi/weathericon/2.0/documentation
  const code = symbolCode.split('_')[0]; // Remove day/night suffix

  const conditionMap: Record<string, { condition: string; conditionCode: string }> = {
    clearsky: { condition: 'Sol', conditionCode: 'sunny' },
    fair: { condition: 'Lettskyet', conditionCode: 'partly_cloudy' },
    partlycloudy: { condition: 'Delvis skyet', conditionCode: 'partly_cloudy' },
    cloudy: { condition: 'Skyet', conditionCode: 'cloudy' },
    fog: { condition: 'Tåke', conditionCode: 'foggy' },
    lightrain: { condition: 'Lett regn', conditionCode: 'rainy' },
    rain: { condition: 'Regn', conditionCode: 'rainy' },
    heavyrain: { condition: 'Kraftig regn', conditionCode: 'rainy' },
    lightrainshowers: { condition: 'Lette regnbyger', conditionCode: 'rainy' },
    rainshowers: { condition: 'Regnbyger', conditionCode: 'rainy' },
    heavyrainshowers: { condition: 'Kraftige regnbyger', conditionCode: 'rainy' },
    lightsleet: { condition: 'Lett sludd', conditionCode: 'rainy' },
    sleet: { condition: 'Sludd', conditionCode: 'rainy' },
    heavysleet: { condition: 'Kraftig sludd', conditionCode: 'rainy' },
    lightsnow: { condition: 'Lett snø', conditionCode: 'snowy' },
    snow: { condition: 'Snø', conditionCode: 'snowy' },
    heavysnow: { condition: 'Kraftig snø', conditionCode: 'snowy' },
    lightsnowshowers: { condition: 'Lette snøbyger', conditionCode: 'snowy' },
    snowshowers: { condition: 'Snøbyger', conditionCode: 'snowy' },
    heavysnowshowers: { condition: 'Kraftige snøbyger', conditionCode: 'snowy' },
    lightrainandthunder: { condition: 'Lett regn og torden', conditionCode: 'stormy' },
    rainandthunder: { condition: 'Regn og torden', conditionCode: 'stormy' },
    heavyrainandthunder: { condition: 'Kraftig regn og torden', conditionCode: 'stormy' },
  };

  return conditionMap[code] || { condition: 'Ukjent', conditionCode: 'unknown' };
}

// Generate cache key from coordinates (rounded to 2 decimals for cache efficiency)
function getCacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(2)}_${lng.toFixed(2)}`;
}

// Fetch weather from met.no API
async function fetchWeatherFromMetNo(lat: number, lng: number): Promise<WeatherData> {
  const url = `${MET_API_BASE}/compact?lat=${lat.toFixed(4)}&lon=${lng.toFixed(4)}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Met.no API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as any;

  // Extract current weather from first timeseries entry
  const timeseries = data.properties?.timeseries;
  if (!timeseries || timeseries.length === 0) {
    throw new Error('No weather data available');
  }

  const current = timeseries[0];
  const instant = current.data?.instant?.details;
  const next1h = current.data?.next_1_hours;
  const next6h = current.data?.next_6_hours;

  if (!instant) {
    throw new Error('No instant weather data available');
  }

  // Get symbol from next_1_hours or next_6_hours
  const symbolCode = next1h?.summary?.symbol_code || next6h?.summary?.symbol_code || 'cloudy';
  const { condition, conditionCode } = mapSymbolToCondition(symbolCode);

  return {
    temperature: Math.round(instant.air_temperature * 10) / 10,
    windSpeed: Math.round(instant.wind_speed * 10) / 10,
    windDirection: instant.wind_from_direction,
    humidity: instant.relative_humidity,
    precipitation: next1h?.details?.precipitation_amount ?? next6h?.details?.precipitation_amount,
    cloudCover: instant.cloud_area_fraction,
    condition,
    conditionCode,
    updatedAt: current.time,
    location: { lat, lng },
  };
}

// All routes require authentication
router.use(authenticate);

// GET /weather/current - Get current weather for a location
router.get('/current', validateQuery(weatherQuerySchema), cacheResponse(300), async (req: Request, res: Response) => {
  try {
    const lat = req.query.lat as unknown as number;
    const lng = req.query.lng as unknown as number;

    const cacheKey = getCacheKey(lat, lng);
    const cached = weatherCache.get(cacheKey);

    // Return cached data if still valid
    if (cached && cached.expires > Date.now()) {
      sendSuccess(res, {
        ...cached.data,
        cached: true,
      });
      return;
    }

    // Fetch fresh data from met.no
    const weatherData = await fetchWeatherFromMetNo(lat, lng);

    // Cache the result
    weatherCache.set(cacheKey, {
      data: weatherData,
      expires: Date.now() + CACHE_DURATION_MS,
      locationKey: cacheKey,
    });

    sendSuccess(res, {
      ...weatherData,
      cached: false,
    });
  } catch (error) {
    console.error('Weather API error:', error);

    // Return cached data even if expired, as fallback
    const lat = req.query.lat as unknown as number;
    const lng = req.query.lng as unknown as number;
    const cacheKey = getCacheKey(lat, lng);
    const cached = weatherCache.get(cacheKey);

    if (cached) {
      sendSuccess(res, {
        ...cached.data,
        cached: true,
        stale: true,
      });
      return;
    }

    sendError(res, ErrorCodes.EXTERNAL_SERVICE_ERROR, 'Failed to fetch weather data', 503);
  }
});

// GET /weather/forecast - Get weather forecast for next days
router.get('/forecast', validateQuery(weatherQuerySchema), cacheResponse(600), async (req: Request, res: Response) => {
  try {
    const lat = req.query.lat as unknown as number;
    const lng = req.query.lng as unknown as number;

    const url = `${MET_API_BASE}/compact?lat=${lat.toFixed(4)}&lon=${lng.toFixed(4)}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Met.no API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    const timeseries = data.properties?.timeseries;

    if (!timeseries || timeseries.length === 0) {
      throw new Error('No forecast data available');
    }

    // Get forecast for next 3 days at noon
    const forecast: Array<{
      date: string;
      temperature: number;
      windSpeed: number;
      condition: string;
      conditionCode: string;
    }> = [];

    const processedDates = new Set<string>();

    for (const entry of timeseries) {
      const time = new Date(entry.time);
      const dateStr = time.toISOString().split('T')[0];
      const hour = time.getUTCHours();

      // Get one entry per day, preferring noon (12:00)
      if (!processedDates.has(dateStr) && (hour === 12 || hour === 13)) {
        const instant = entry.data?.instant?.details;
        const next6h = entry.data?.next_6_hours;

        if (instant) {
          const symbolCode = next6h?.summary?.symbol_code || 'cloudy';
          const { condition, conditionCode } = mapSymbolToCondition(symbolCode);

          forecast.push({
            date: dateStr,
            temperature: Math.round(instant.air_temperature),
            windSpeed: Math.round(instant.wind_speed * 10) / 10,
            condition,
            conditionCode,
          });

          processedDates.add(dateStr);
        }
      }

      if (forecast.length >= 5) break;
    }

    sendSuccess(res, {
      location: { lat, lng },
      forecast,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Weather forecast error:', error);
    sendError(res, ErrorCodes.EXTERNAL_SERVICE_ERROR, 'Failed to fetch weather forecast', 503);
  }
});

export default router;
