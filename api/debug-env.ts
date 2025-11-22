/**
 * Diagnostic endpoint to check if DATABASE_URL is available
 * Visit: https://your-app.vercel.app/api/debug-env
 */
export async function GET(request: Request) {
  const headers = {
    'Content-Type': 'application/json',
  };

  const diagnostics = {
    DATABASE_URL_exists: !!process.env.DATABASE_URL,
    DATABASE_URL_value: process.env.DATABASE_URL ? 'SET (hidden for security)' : 'NOT SET',
    DATABASE_URL_length: process.env.DATABASE_URL?.length || 0,
    DATABASE_URL_preview: process.env.DATABASE_URL?.substring(0, 30) || 'EMPTY',
    all_postgres_vars: Object.keys(process.env).filter(key => 
      key.toUpperCase().includes('DATABASE') || 
      key.toUpperCase().includes('POSTGRES')
    ),
    all_env_var_count: Object.keys(process.env).length,
    node_env: process.env.NODE_ENV,
    vercel_env: process.env.VERCEL_ENV,
  };

  return new Response(
    JSON.stringify(diagnostics, null, 2),
    { status: 200, headers }
  );
}