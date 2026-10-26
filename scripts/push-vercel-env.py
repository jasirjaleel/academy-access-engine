"""Copy settings from .env.local to the linked Vercel project (production), without printing values.

Run from the project folder:  python3 scripts/push-vercel-env.py
Skips values that must differ in production; those are set separately after the first deploy.
"""
import subprocess

SKIP = {"NEXT_PUBLIC_APP_URL", "DATABASE_URL_DIRECT", "N8N_WEBHOOK_URL", "VERCEL_OIDC_TOKEN", "STRIPE_WEBHOOK_SECRET"}

values = {}
for line in open(".env.local"):
    line = line.rstrip("\n")
    if not line or line.lstrip().startswith("#") or "=" not in line:
        continue
    key, value = line.split("=", 1)
    if key not in SKIP:
        values[key] = value.strip().strip('"')

for key, value in values.items():
    subprocess.run(["vercel", "env", "rm", key, "production", "--yes"], capture_output=True)
    result = subprocess.run(["vercel", "env", "add", key, "production"], input=value, capture_output=True, text=True)
    print(("ok    " if result.returncode == 0 else "FAILED ") + key)
