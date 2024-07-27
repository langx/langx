import axios from 'axios';
import { useEffect, useRef } from 'react';
import { useSegments } from 'expo-router';
import { PLAUSIBLE_API_URL, APP_ENDPOINT } from '@/constants/config';

const DOMAIN = new URL(APP_ENDPOINT).hostname;

const getFullUrl = (segments) => {
  const filteredSegments = segments.filter(
    (segment) => !segment.startsWith('(') && !segment.endsWith(')')
  );
  const path = filteredSegments.join('/');
  return `${APP_ENDPOINT}/${path}`;
};

const trackEvent = async (eventName, props = {}) => {
  const data = {
    name: eventName,
    url: APP_ENDPOINT,
    domain: DOMAIN,
    ...props,
  };

  try {
    await axios.post(PLAUSIBLE_API_URL, data, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error tracking event:', error);
  }
};

const usePlausible = () => {
  const segments = useSegments();

  useEffect(() => {
    const fullUrl = getFullUrl(segments);
    trackEvent('pageview', { url: fullUrl });
  }, [segments]);

  return trackEvent;
};

export default usePlausible;
