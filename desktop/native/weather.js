import Soup from 'gi://Soup?version=3.0';
import GLib from 'gi://GLib';
const session = new Soup.Session({timeout: 20});
export function getJSON(url) {
    return new Promise((resolve, reject) => {
        const message = Soup.Message.new('GET', url);
        session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (_session, result) => {
            try {
                const bytes = session.send_and_read_finish(result);
                if (message.status_code !== 200) throw new Error('Weather request failed');
                resolve(JSON.parse(new TextDecoder().decode(bytes.get_data())));
            } catch (error) { reject(error); }
        });
    });
}
export async function findPlaces(name) {
    const data = await getJSON(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name.trim())}&count=5&language=en&format=json`);
    return (data.results || []).map(p => ({name: [p.name, p.admin1, p.country].filter(Boolean).join(', '), latitude: p.latitude, longitude: p.longitude}));
}
export function condition(code) {
    if (code === 0) return 'Clear skies';
    if (code <= 3) return 'Partly cloudy';
    if (code <= 48) return 'Foggy';
    if (code <= 67) return 'Rain';
    if (code <= 77) return 'Snow';
    if (code <= 82) return 'Rain showers';
    if (code <= 86) return 'Snow showers';
    return 'Thunderstorms';
}
export async function forecast(place) {
    const data = await getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=auto&forecast_days=3`);
    const daily = data.daily;
    if (!daily?.time?.length) throw new Error('Forecast unavailable');
    return daily.time.map((date, i) => ({date, summary: condition(daily.weather_code[i]), high: Math.round(daily.temperature_2m_max[i]), low: Math.round(daily.temperature_2m_min[i])}));
}
