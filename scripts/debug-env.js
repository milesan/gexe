const { config } = require('dotenv');

console.log('🔍 Environment Debug:');
console.log('Current working directory:', process.cwd());

// Load .env file explicitly from current directory
const result = config({ path: './.env' });

if (result.error) {
  console.error('❌ Error loading .env file:', result.error);
} else {
  console.log('✅ .env file loaded successfully');
  console.log('Parsed variables:', result.parsed);
}

console.log('\n📋 Environment Variables:');
console.log('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL ? 'SET' : 'NOT SET');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET');

if (process.env.VITE_SUPABASE_URL) {
  console.log('URL Value:', process.env.VITE_SUPABASE_URL);
}
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log('Service Key (first 20 chars):', process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 20) + '...');
} 