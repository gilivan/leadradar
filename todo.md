# LinkedIn Intelligence — TODO

## Base de datos y esquema
- [x] Tabla `search_profiles` — perfiles de búsqueda (país, ciudad, keywords, activo)
- [x] Tabla `opportunities` — resultados del scraping con score, estado, feedback
- [x] Tabla `execution_logs` — historial de ejecuciones con estado y métricas
- [x] Tabla `app_settings` — configuración global (Apify token, SMTP, horarios, etc.)
- [x] Tabla `feedback_rules` — reglas aprendidas del feedback del usuario
- [x] Tabla `email_templates` — plantillas de correo configurables
- [x] Tabla `schedule_jobs` — jobs programados con taskUid de heartbeat

## Backend — tRPC routers
- [x] Router `opportunities` — CRUD, filtros, paginación, feedback, exportación
- [x] Router `admin.searchProfiles` — CRUD de perfiles de búsqueda
- [x] Router `admin.settings` — leer/escribir configuración global
- [x] Router `admin.executions` — historial de ejecuciones y logs
- [x] Router `admin.scheduler` — crear/actualizar/pausar jobs heartbeat
- [x] Router `admin.emailTemplates` — CRUD de plantillas de correo
- [x] Router `admin.feedbackRules` — listar/eliminar reglas aprendidas

## Backend — Servicios
- [x] Servicio Apify — ejecutar actor de LinkedIn scraper con parámetros configurables
- [x] Servicio de clasificación LLM — analizar texto y asignar score de oportunidad
- [x] Servicio de feedback learning — ajustar criterios con base en feedback del usuario
- [x] Servicio de alertas por correo — envío SMTP con plantilla configurable
- [x] Handler heartbeat `/api/scheduled/scrape` — ejecutar scraping programado
- [x] Conversión hora Colombia (UTC-5) → cron UTC para programación

## Frontend — Dashboard
- [x] Layout principal con sidebar elegante y navegación
- [x] Dashboard home con métricas: total oportunidades, nuevas hoy, score promedio
- [x] Tabla de oportunidades con filtros (fecha, región, keyword, relevancia)
- [x] Vista detalle de oportunidad con botones de feedback (relevante/irrelevante)
- [x] Indicadores visuales de score y estado por oportunidad
- [x] Botón de ejecución manual de scraping

## Frontend — Panel Admin
- [x] Página de configuración global (Apify token, zona horaria)
- [x] Gestión de perfiles de búsqueda (CRUD con país, ciudad, keywords)
- [x] Configuración de horarios de ejecución automática (hora Colombia)
- [x] Configuración de alertas por correo (SMTP, destinatario, asunto, plantilla)
- [x] Gestión de plantillas de correo con editor de texto e imágenes
- [x] Historial de ejecuciones con logs detallados
- [x] Panel de reglas de aprendizaje (visualizar y eliminar patrones)

## Frontend — Exportaciones
- [x] Botón de exportar a Excel con filtros activos
- [x] Botón de exportar a CSV con filtros activos

## Sistema de aprendizaje
- [x] Almacenar feedback explícito por oportunidad
- [x] Extraer patrones del texto al recibir feedback
- [x] Actualizar peso de reglas existentes con cada confirmación
- [x] Aplicar reglas en clasificación LLM para mejorar scoring

## Diseño visual
- [x] Paleta de colores sofisticada (dark navy + gold accent)
- [x] Tipografía refinada (Inter + DM Serif Display)
- [x] Componentes pulidos con micro-animaciones
- [x] Responsive design completo
- [x] Estados de carga, vacío y error elegantes

## Testing
- [x] Tests vitest: scoreToLabel, computeKeywordPreScore, colombiaHourToUtcCron
- [x] Tests vitest: interpolación de plantillas de correo
- [x] Test vitest: logout de autenticación

## Mejoras UI — Julio 2026
- [x] Ordenamiento en página de oportunidades: por fecha más reciente, por relevancia (score) y por región
- [x] Badge "Nuevo" en oportunidades cargadas en la última ejecución

## Pendiente (post-entrega — requiere configuración del usuario)
- [x] Configurar API token de Apify desde el panel admin
- [x] Configurar SMTP para alertas por correo
- [x] Crear perfiles de búsqueda con keywords relevantes
- [ ] Configurar programaciones de ejecución (hora Colombia)
- [ ] Publicar la aplicación desde el botón Publish

## Verificaciones operativas pendientes
- [x] Unificar las claves SMTP entre la interfaz y el backend, y validar el remitente
- [x] Revisar que los perfiles de búsqueda activos tengan keywords no vacías y alineadas con El Grupo

## Instalación Local — Julio 2026
- [x] Módulo localAuth.ts: login con usuario/contraseña + JWT sin Manus OAuth
- [x] Rutas /api/auth/login y /api/auth/logout en modo LOCAL_AUTH=true
- [x] Página LocalLogin.tsx con formulario de acceso
- [x] DashboardLayout redirige a /login en modo local
- [x] Meta tag local-auth inyectado en HTML por el servidor
- [x] LLM router lanza error descriptivo en modo local sin proveedor configurado
- [x] URLs de logo en emails actualizadas a dominio público permanente
- [x] Cron local con node-cron para ejecuciones programadas sin Manus Heartbeat
- [x] env.example con todas las variables necesarias
- [x] docker-compose.yml con MySQL + app
- [x] Dockerfile.local para self-hosting
- [x] INSTALL_LOCAL.md con guía completa paso a paso

## LLM Configurable — Julio 2026
- [x] Servicio LLM unificado que enruta al proveedor configurado (Manus, OpenAI, Anthropic, Gemini, Groq)
- [x] Bloque de configuración de proveedor LLM en panel Admin → Configuración General
- [x] Prueba de conexión al proveedor LLM desde el panel admin

## Mejora de precisión comercial — Despliegue
- [x] Sincronizar el commit 1fb9324 de gilivan/leadradar y revisar sus cambios
- [x] Aplicar y verificar la migración 0002_commercial_intent_quality.sql
- [x] Normalizar respuestas JSON incompletas del LLM durante la clasificación comercial
- [x] Recalibrar el histórico de oportunidades por lotes sin enviar alertas
- [x] Validar resultados de precisión y dejar un checkpoint listo para publicar

## Ajustes finales de la mejora de precisión
- [x] Depurar el perfil activo “Especialista Digital” con términos de intención comercial alineados con El Grupo
- [x] Guardar el checkpoint final posterior a la migración, los fixes y la recalibración
