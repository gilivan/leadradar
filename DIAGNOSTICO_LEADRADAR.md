# Diagnóstico LeadRadar — Hallazgos y plan de acción

**Fecha:** 2026-05-25
**Repo:** https://github.com/gilivan/leadradar.git
**Cuenta Apify analizada:** elgrupo (plan FREE, $5/mes)

---

## 1. Síntoma reportado

> "La ejecución corre pero no encuentra nada" (totalFound ≈ 0 / 0 oportunidades guardadas).

## 2. Causas raíz (4 bugs técnicos)

| # | Bug | Ubicación | Impacto |
|---|---|---|---|
| 1 | Actor default `apify/linkedin-post-search-scraper` devuelve **HTTP 404** (no existe) | [server/services/apify.ts:56](server/services/apify.ts) en realidad viene del default de [scrapeOrchestrator.ts:56](server/services/scrapeOrchestrator.ts) | Si nunca cambiaste el actor en Settings → todos los runs fallan |
| 2 | Campo `maxResults` no existe en el actor real (debe ser `maxPosts`) | [apify.ts:89](server/services/apify.ts) | Apify ignora el límite, posible sobreconsumo |
| 3 | `normalizeItems` busca campos en la raíz, pero el actor anida en objetos | [apify.ts:129-188](server/services/apify.ts) | `authorName`, `authorTitle`, `authorCompany`, `publishedAt` quedan vacíos en TODAS las oportunidades |
| 4 | Pide proxy `RESIDENTIAL` no disponible en plan FREE (`availableCount: 0`) | [apify.ts:90](server/services/apify.ts) | Inofensivo con harvestapi (lo ignora), pero romperá con otros actores |

### Mapping correcto de campos (harvestapi/linkedin-post-search)

```js
// Estructura REAL del item devuelto por Apify:
{
  id: "7455806278360199168",
  linkedinUrl: "https://www.linkedin.com/posts/...",   // ← URL ya viene en este campo
  content: "...",                                        // ← texto del post
  type: "post",
  postedAt: { date: "2026-05-01T02:32:18.943Z", ... },  // ← anidado
  author: {                                              // ← anidado
    name: "Lida Numancia Sánchez Osorio",
    info: "Especialista empresarial en...",              // ← title/headline
    linkedinUrl: "https://www.linkedin.com/in/...",     // ← profile URL
    publicIdentifier: "...",
    avatar: { url: "..." }
  },
  engagement: { ... },
  reactions: [...]
}
```

## 3. Pruebas realizadas

### 3.1 Actores LinkedIn evaluados

| Actor | Resultado |
|---|---|
| `apify/linkedin-post-search-scraper` (default código) | ❌ 404 |
| `datadoping/linkedin-posts-search-scraper` | ❌ Devuelve `{"error":"Error fetching LinkedIn posts search"}` |
| `supreme_coder/linkedin-post` | ❌ Requiere URLs concretas (no keyword search) |
| **`harvestapi/linkedin-post-search`** | ✅ **Único viable** — corre en 4-10s, datos ricos, 1.7M runs históricos |

**Pricing harvestapi:** PAY_PER_EVENT, mínimo $0.01/run (incluye runs con 0 resultados).

### 3.2 Volumen real por query (últimos 7-30 días, harvestapi)

**Set 1 — "buscar agencia" explícito (23 queries probadas):**

| Query | Posts | Colombia |
|---|---|---|
| `buscamos proveedor marketing` | 15 | 5 |
| `recomiendan agencia` | 15 | 4 |
| `necesitamos agencia marketing` | 15 | 4 |
| `buscamos agencia publicidad` | 15 | 2 |
| `quién me recomienda agencia` | 4 | 0 |
| `RFP agencia marketing` | 3 | 0 |
| `necesito lanzar campaña` | 3 | 0 |
| `rebranding empresa` | 15 | 0 |

⚠️ **~85% de los resultados con `buscamos/necesitamos` son ofertas de empleo** ("Buscamos AD MANAGER", "hiring Senior Associate") — exactamente lo contrario a lo que queremos.

**Set 2 — "dolor / proceso / decisor" (23 queries probadas):**

| Query | Posts | Calidad |
|---|---|---|
| `como CMO necesito` | 6 | 🟢 4/6 son CMOs reales en primera persona |
| `estamos lanzando nuestra marca` | 15 | 🟢 3/15 lanzamientos corporativos reales |
| `ganamos el pitch` | 15 | 🟢 4/15 perfiles del mundo creativo |
| `frustrado con mi agencia` | 15 | 🔴 Matching léxico, posts de otros temas |
| `cambiando de agencia` | 15 | 🔴 Posts sobre IA, no agencias |
| `mi nueva marca necesita` | 15 | 🔴 Casi todo es marca personal de coaches |

## 4. Hallazgo central

> **En LinkedIn, las marcas casi NUNCA publican abiertamente "necesito agencia". Lo que sí publican son: lanzamientos, anuncios de cambios, opiniones de decisores y eventos corporativos.**

El modelo mental del producto ("encontrar quien pide agencia") **no funciona en este canal**. Hay que ajustar la estrategia.

## 5. Plan de acción recomendado

### 5.1 Fixes de código (obligatorios para que ejecute)

**Archivo:** [server/services/apify.ts](server/services/apify.ts)

1. **Actualizar `buildActorInput` para harvestapi:**
   ```ts
   if (actorId.includes("harvestapi") || actorId.includes("linkedin-post-search")) {
     return {
       searchQueries: queries,
       maxPosts: input.maxResults ?? 50,        // ← NOTA: maxPosts, no maxResults
       sortBy: "date",
       postedLimit: "month",
     };
   }
   ```

2. **Adaptar `normalizeItems` a campos anidados:**
   ```ts
   const author = (item.author as Record<string, unknown>) || {};
   const postedAt = (item.postedAt as Record<string, unknown>) || {};
   return {
     id: (item.id as string) || `item-${idx}`,
     url: (item.linkedinUrl as string) || (item.url as string) || "",
     text: (item.content as string) || (item.text as string) || "",
     authorName: (author.name as string) || "",
     authorTitle: (author.info as string) || "",
     authorCompany: "",  // harvestapi no devuelve company a nivel raíz
     authorProfileUrl: (author.linkedinUrl as string) || "",
     publishedAt: (postedAt.date as string) || "",
     contentType: "post" as const,
   };
   ```

3. **Quitar `proxy.RESIDENTIAL`** del input (harvestapi maneja proxies internamente).

**Archivo:** [server/services/scrapeOrchestrator.ts:56](server/services/scrapeOrchestrator.ts)

4. **Cambiar default del actor:**
   ```ts
   const actorId = settings["apify_actor_id"] || "harvestapi/linkedin-post-search";
   ```

### 5.2 Configuración en el panel admin (al desplegar)

| Setting | Valor recomendado |
|---|---|
| `apify_token` | (tu token actual) |
| `apify_actor_id` | `harvestapi/linkedin-post-search` |
| `min_relevance_score` | `0.5` (bajar de 0.6 para no perder señales débiles) |

### 5.3 Search Profiles iniciales recomendados

**6 queries que demostraron buena relación señal/ruido:**

| Nombre del perfil | Keywords | Para qué sirve |
|---|---|---|
| CMOs Colombia activos | `CMO Colombia` | Identifica CMOs publicando en Colombia (decisores) |
| CMOs en primera persona | `como CMO necesito` | Captura CMOs hablando de sus necesidades reales |
| Lanzamientos de marca | `estamos lanzando nuestra marca` | Momentos de necesidad latente |
| Pitches creativos | `ganamos el pitch` | Quién compite en pitches = quién contrata agencias |
| Recomendaciones de agencia | `alguien me recomienda agencia` | Demanda explícita (bajo volumen pero alta intención) |
| Procesos B2B | `pitch agencia publicidad` | Conversaciones sobre selección de agencias |

⚠️ **NO usar:** `busco agencia`, `necesito agencia`, oraciones largas con ciudad concatenada — generan ofertas de empleo o resultados irrelevantes.

### 5.4 Ajustes recomendados al clasificador

[server/services/classifier.ts](server/services/classifier.ts) — el prompt actual busca *intent explícito*. Debería ampliarse para detectar también:

- **Señales de decisor**: cargo del autor (CMO, Director Marketing, Gerente Marketing) viene en `author.info`.
- **Momentos de transición**: lanzamiento, rebranding, expansión, cambio de equipo, nuevo CMO.
- **Pain points latentes**: críticas a su agencia actual, descontento con resultados, fee fijo vs hora, automatización.

El clasificador debería puntuar:
- 30% intención explícita ("busco agencia")
- 40% perfil de decisor + empresa target
- 30% señales contextuales (lanzamiento, dolor, cambio)

## 6. Riesgos pendientes (no abordados por estos fixes)

Identificados en la evaluación inicial — siguen vigentes:

1. **Falta verificación de `role: admin`** en `adminRouter` (cualquier usuario logueado puede modificar config).
2. **Secretos en `app_settings` como texto plano** (`apify_token`, `smtp_password`).
3. **`runScrapeJob` es síncrono** en la request (manual trigger puede tomar minutos).
4. **Sin escape HTML** del `rawText` en plantilla de correo (riesgo de inyección).
5. **Feedback rules genera bigramas ruidosos** (sin filtro de stopwords).
6. **`package.json` aún se llama `linkedin-opportunity-scraper`**.

## 7. Costo de las pruebas realizadas

- ~50 runs ejecutados en Apify
- ~$1.50 USD consumidos del free tier ($5/mes)
- Quedan ~$3.50 disponibles este mes

## 8. Próximos pasos sugeridos (en orden)

1. ✅ Aplicar los **4 fixes de código** de la sección 5.1.
2. ✅ Desplegar.
3. ✅ Configurar `apify_actor_id` en panel admin.
4. ✅ Crear los **6 search profiles** de la sección 5.3.
5. ✅ Ejecutar manualmente y validar que `totalFound > 0`.
6. 🔄 Después de 1-2 semanas con datos reales, evaluar pivot del clasificador (sección 5.4).
7. 🔒 Atacar riesgos de seguridad (sección 6).
