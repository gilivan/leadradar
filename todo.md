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
- [ ] Ordenamiento en página de oportunidades: por fecha más reciente, por relevancia (score) y por región
- [ ] Badge "Nuevo" en oportunidades cargadas en la última ejecución

## Pendiente (post-entrega — requiere configuración del usuario)
- [ ] Configurar API token de Apify desde el panel admin
- [ ] Configurar SMTP para alertas por correo
- [ ] Crear perfiles de búsqueda con keywords relevantes
- [ ] Configurar programaciones de ejecución (hora Colombia)
- [ ] Publicar la aplicación desde el botón Publish
