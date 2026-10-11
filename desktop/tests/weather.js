import GLib from 'gi://GLib';
import System from 'system';
import {findPlaces, forecast, condition} from '../native/weather.js';
const loop = new GLib.MainLoop(null, false);
let failed = false;
async function run() {
    if (condition(0) !== 'Clear skies' || condition(95) !== 'Thunderstorms') throw new Error('Weather code mapping');
    const places = await findPlaces('Boston');
    if (!places.length || !Number.isFinite(places[0].latitude)) throw new Error('City lookup failed');
    const days = await forecast(places[0]);
    if (days.length !== 3 || !days.every(d => Number.isFinite(d.high) && Number.isFinite(d.low))) throw new Error('Invalid forecast');
    print(`PASS: live city lookup and three-day forecast for ${places[0].name}`);
}
run().catch(error => { logError(error); failed = true; }).finally(() => loop.quit());
loop.run();
if (failed) System.exit(1);
