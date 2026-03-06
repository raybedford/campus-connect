#!/usr/bin/env node

/**
 * Inject environment variables into the built Electron app
 * This ensures Vite env vars are available when running as Electron
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

const electronAppDir = path.join(__dirname, 'electron', 'app');
const indexHtmlPath = path.join(electronAppDir, 'index.html');

if (!fs.existsSync(indexHtmlPath)) {
  console.error('index.html not found in electron/app directory');
  console.error('Make sure to run "npm run build" first');
  process.exit(1);
}

// Read the index.html file
let html = fs.readFileSync(indexHtmlPath, 'utf8');

// Create env config script
const envConfig = `
<script>
  // Injected environment variables for Electron
  window._env_ = {
    SUPABASE_URL: '${process.env.VITE_SUPABASE_URL || ''}',
    SUPABASE_ANON_KEY: '${process.env.VITE_SUPABASE_ANON_KEY || ''}',
    TENOR_API_KEY: '${process.env.VITE_TENOR_API_KEY || ''}'
  };
</script>
`;

// Inject before the closing head tag
if (html.includes('window._env_')) {
  console.log('Environment variables already injected, skipping...');
} else {
  html = html.replace('</head>', `${envConfig}</head>`);
  fs.writeFileSync(indexHtmlPath, html, 'utf8');
  console.log('✅ Environment variables injected into Electron app');
}
