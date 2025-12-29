import 'dotenv/config';
import { createRegisterUsernameChainhook } from './chainhooks.js';

const hook = createRegisterUsernameChainhook(5400691);
console.log('Generated hook definition:');
console.log(JSON.stringify(hook, null, 2));





