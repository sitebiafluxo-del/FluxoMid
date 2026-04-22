window.SUPABASE_CONFIG = {
  url: "https://dltcpnelgnrmsyfetjjy.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsdGNwbmVsZ25ybXN5ZmV0amp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4ODA2ODUsImV4cCI6MjA5MjQ1NjY4NX0.4lAHCgtmDSA7XtBSYqSkDVYOFIF942dsjyVQM7UVzoY",
  authBypass: false,
};

try {
  window.SUPABASE_CLIENT = window.supabase.createClient(
    window.SUPABASE_CONFIG.url,
    window.SUPABASE_CONFIG.anonKey
  );
} catch (e) {
  console.error("Falha ao criar cliente Supabase:", e);
}
