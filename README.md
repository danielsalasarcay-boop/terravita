# Terravita · Taller de arcilla y cerámica

Sitio one-page (HTML/CSS/JS vanilla + GSAP/ScrollTrigger + Lenis por CDN).

- `index.html` — estructura (los símbolos del logo `#mark` y `#word` están vectorizados del logo oficial)
- `css/style.css` — colores del logo (terracota #96411B, moteado #AD5027, crema #FFF5DE); `--speckle` recrea el fondo moteado del logo
- `js/main.js` — `SITE` con WhatsApp / teléfono / Instagram / TikTok; animaciones
- Pendientes: `grep -rn "PENDIENTE\|CONFIRMAR" index.html js/main.js`

Vista local: `python3 -m http.server 47311 --directory ~/terravita`

## Al publicar cambios
Actualiza la versión de CSS/JS (si no, el navegador muestra archivos viejos):
`V=$(cat css/style.css js/main.js | md5 | cut -c1-8); sed -i '' -E "s#(css/style\.css|js/main\.js)(\?v=[a-z0-9]+)?#\1?v=$V#g" index.html nosotros.html`
