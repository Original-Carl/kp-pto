# Brand assets (not shipped)

Full-size PTO logos, kept for flyers and social posts. The site uses the small
copies in `assets/` (made with `sips` + `cwebp` at 2× display size):

| File | Use |
|------|-----|
| `kp-pto-logo-blue.webp` | Classic blue logo → `assets/logo-header.webp` (120×96, site header) |
| `kp-pto-logo-color.webp` | Colorful logo → `assets/logo-home.webp` (640 wide, Home page) |

To regenerate, e.g.:

```bash
sips -s format png --resampleHeight 96 brand/kp-pto-logo-blue.webp --out /tmp/header.png
cwebp -q 82 -m 6 /tmp/header.png -o assets/logo-header.webp
```
