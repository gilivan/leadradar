# LeadRadar — Guía de Instalación Local

Esta guía explica cómo correr **LeadRadar** en tu propio equipo o servidor, sin depender de la plataforma Manus.

---

## Requisitos

| Herramienta | Versión mínima | Notas |
|---|---|---|
| Node.js | 22.x | [nodejs.org](https://nodejs.org) |
| pnpm | 10.x | `npm install -g pnpm` |
| MySQL / MariaDB | 8.0 / 10.6 | O usa Docker (ver abajo) |
| Git | cualquier | Para clonar el repo |

---

## Opción A — Instalación con Docker (recomendada)

La forma más rápida. Solo necesitas **Docker** y **Docker Compose**.

### 1. Clonar el repositorio

```bash
git clone https://github.com/TU_USUARIO/linkedin-opportunity-scraper.git
cd linkedin-opportunity-scraper
```

### 2. Configurar variables de entorno

```bash
cp env.example .env
```

Edita `.env` con tus valores. Los campos **obligatorios** son:

```env
LOCAL_AUTH=true
LOCAL_ADMIN_USER=admin
LOCAL_ADMIN_PASSWORD=tu_contraseña_segura
JWT_SECRET=una_clave_larga_y_aleatoria_de_al_menos_32_caracteres
```

### 3. Levantar los servicios

```bash
docker compose up -d
```

Esto levanta:
- **MySQL 8.0** en el puerto 3306
- **LeadRadar** en el puerto 3000

### 4. Acceder a la aplicación

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

Inicia sesión con las credenciales que definiste en `.env`.

---

## Opción B — Instalación manual (sin Docker)

### 1. Clonar e instalar dependencias

```bash
git clone https://github.com/TU_USUARIO/linkedin-opportunity-scraper.git
cd linkedin-opportunity-scraper
pnpm install
```

### 2. Crear la base de datos MySQL

```sql
CREATE DATABASE leadradar CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'leadradar'@'localhost' IDENTIFIED BY 'tu_password_db';
GRANT ALL PRIVILEGES ON leadradar.* TO 'leadradar'@'localhost';
FLUSH PRIVILEGES;
```

### 3. Configurar variables de entorno

```bash
cp env.example .env
```

Edita `.env`:

```env
LOCAL_AUTH=true
LOCAL_ADMIN_USER=admin
LOCAL_ADMIN_PASSWORD=tu_contraseña_segura
DATABASE_URL=mysql://leadradar:tu_password_db@localhost:3306/leadradar
JWT_SECRET=una_clave_larga_y_aleatoria_de_al_menos_32_caracteres
PORT=3000
```

### 4. Aplicar migraciones de base de datos

```bash
pnpm drizzle-kit migrate
```

### 5. Iniciar en modo desarrollo

```bash
pnpm dev
```

O para producción:

```bash
pnpm build
pnpm start
```

### 6. Acceder a la aplicación

Abre [http://localhost:3000](http://localhost:3000).

---

## Configuración del proveedor LLM

LeadRadar necesita un LLM para clasificar oportunidades. En modo local, debes configurar uno de estos proveedores desde el panel Admin:

1. Inicia sesión y ve a **Configuración General → Proveedor LLM**
2. Selecciona tu proveedor y pega tu API key

| Proveedor | Modelo recomendado | Costo |
|---|---|---|
| **Google Gemini** | `gemini-2.5-flash` | Tier gratuito disponible |
| **OpenAI** | `gpt-4o-mini` | ~$0.15 / 1M tokens |
| **Anthropic** | `claude-3-5-haiku-20241022` | ~$0.80 / 1M tokens |
| **Groq** | `llama-3.3-70b-versatile` | Tier gratuito disponible |

**Recomendación:** Usa **Google Gemini** con `gemini-2.5-flash` — tiene tier gratuito generoso y excelente calidad para clasificación de texto.

---

## Configuración del scraper Apify

Para que el scraping de LinkedIn funcione:

1. Crea una cuenta en [apify.com](https://apify.com) (tiene tier gratuito)
2. Obtén tu **API Token** desde Settings → Integrations
3. En LeadRadar: **Configuración General → Token de Apify**

---

## Programación automática (Cron)

En modo local, LeadRadar usa `node-cron` para ejecutar el scraping automáticamente.

1. Ve a **Programación** en el panel Admin
2. Configura la hora de ejecución en hora Colombia (UTC-5)
3. El sistema convierte automáticamente a UTC y programa el cron

> **Nota:** El proceso del servidor debe estar corriendo para que el cron funcione. Si usas Docker, el contenedor se reinicia automáticamente (`restart: unless-stopped`).

---

## Seguridad en producción

Si vas a exponer LeadRadar en internet, sigue estas recomendaciones:

1. **Usa una contraseña fuerte** — mínimo 16 caracteres, combinando letras, números y símbolos
2. **Usa bcrypt hash** en lugar de contraseña en texto plano:
   ```bash
   node -e "const b=require('bcryptjs');b.hash('tu_password',12).then(console.log)"
   ```
   Luego en `.env`: `LOCAL_ADMIN_PASSWORD_HASH=$2b$12$...`
3. **Cambia el JWT_SECRET** — usa una cadena aleatoria de al menos 64 caracteres
4. **Usa HTTPS** — configura un reverse proxy (nginx, Caddy) con certificado SSL
5. **Restringe el acceso** — considera poner la app detrás de una VPN o firewall

---

## Estructura del proyecto

```
server/
  _core/
    localAuth.ts    ← Autenticación local (usuario/contraseña + JWT)
    index.ts        ← Servidor Express + rutas de login local
  services/
    llmRouter.ts    ← Enrutador LLM (Gemini, OpenAI, Anthropic, Groq)
    scrapeOrchestrator.ts  ← Orquestador de scraping
    emailAlert.ts   ← Alertas por correo SMTP
client/
  src/
    pages/
      LocalLogin.tsx  ← Página de login local
    components/
      DashboardLayout.tsx  ← Layout principal con auth
env.example         ← Plantilla de variables de entorno
docker-compose.yml  ← Configuración Docker Compose
Dockerfile.local    ← Dockerfile para self-hosting
```

---

## Solución de problemas

### Error: "En modo local, debes configurar un proveedor LLM externo"
Configura el proveedor LLM desde **Admin → Configuración General → Proveedor LLM**.

### Error de conexión a la base de datos
Verifica que `DATABASE_URL` en `.env` tenga el formato correcto y que MySQL esté corriendo.

### El cron no ejecuta
Verifica que el servidor esté corriendo. En Docker: `docker compose logs app -f`.

### Olvidé la contraseña
Edita `.env`, cambia `LOCAL_ADMIN_PASSWORD` y reinicia el servidor.

---

## Soporte

Para reportar problemas o solicitar mejoras, abre un issue en el repositorio de GitHub.
