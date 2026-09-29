from supabase import create_client
from app.core.config import settings

supabase = create_client(
    settings.supabase_url,
    settings.supabase_anon_key,
)

email = "thorataryan0@gmail.com"
password = "Aryanthorat@1234#"

response = supabase.auth.sign_in_with_password(
    {
        "email": email,
        "password": password,
    }
)

if not response.session or not response.user:
    raise RuntimeError("Login failed")

print("USER UUID:")
print(response.user.id)

print("\nEMAIL:")
print(response.user.email)

print("\nACCESS TOKEN:")
print(response.session.access_token)