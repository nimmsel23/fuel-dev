# Fuel localhost runtime

`deploy.sh staging --build` builds in the source checkout. `deploy.sh prod`
installs that runtime in `/opt/fuel`; `--dry-run` only lists planned file changes.
Run staging once after updating these scripts before promoting to prod.

The explicit payload includes the built SPA, legacy public assets, Node server
and shared modules, two imported meal helpers, Python package and three Gemini
wrappers. This package and lockfile replace the frontend package manifest in
the installed root. Only the 12 direct Node server dependencies are installed;
Vite, React and browser SDKs are already compiled into the SPA. Python helpers
use a local `.venv`, selected through the generated service PATH.

Personal data remains in `~/.aos/fuel`. Catalogs are seeded without overwriting
existing central files and linked from `~/.aos/fuel/catalogs`, never from a dev
checkout. A former real catalog directory is preserved under
`~/.aos/fuel/catalog-migrations/` after importing missing files, so conflicting
originals are retained outside `/opt`. Review conflicts there when migrating.
No complete product backups are created.

The source checkouts are not runtime dependencies. OS Node/Python and other
local laptop services still are: shared FastAPI features remain owned by the
VitalOS service on :8000. Cloud sync, AI providers and Wger are integrations,
not replacements for local storage; this deployment change does not implement
an offline alternative for every integration.

Validation: `python tests/test_deploy_runtime.py`; isolated offline Node
installation and Fastify injection for health, SPA and local nutrition reads.
Measured app payload: 3.25 MB plus 146 MB Node dependencies on 2026-10-31,
plus 21 MB installed Python libraries; excluding personal data. The isolated Python
package installation and vision/catalog/compose imports also passed. No port or
service-name change.
