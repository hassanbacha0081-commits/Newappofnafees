import * as fs from 'fs';
fs.chmodSync('./android/gradlew', 0o755);
console.log('chmod complete');
