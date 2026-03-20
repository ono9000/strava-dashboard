# Módulo recacor_periodocancel — Diseño

**Fecha:** 2026-03-20
**Versión PS:** 1.7.8.8
**Repositorio:** PruebaTecnica

---

## Contexto

La tienda Recacor (venta de neumáticos) necesita un flujo de estados para los pedidos:

1. Al realizarse un pedido → estado **"Periodo de Cancelación"** (ID 20)
2. Transcurridos 10 minutos, si sigue en ese estado → cambia automáticamente a **"Preparación en curso"** (ID 3)

Ambos estados ya existen en la instalación. El módulo `recacor` existente gestiona integración con proveedores y no se modifica.

---

## Solución

Nuevo módulo PrestaShop: **`recacor_periodocancel`**

### Archivos

```
recacor_periodocancel/
  recacor_periodocancel.php       ← módulo principal (install, hooks, config page)
  config.xml                      ← requerido por PS para aceptar el ZIP en el admin
  logo.png                        ← requerido por PS (32x32, puede ser placeholder)
  controllers/
    front/
      cron.php                    ← endpoint seguro para el cron job
```

> `config.xml` y `logo.png` son obligatorios para que PrestaShop 1.7 acepte el ZIP al subirlo desde el admin. Sin ellos el upload falla con error genérico.

---

## Componente 1 — `recacor_periodocancel.php`

### `install()`

1. Verifica que los estados 20 y 3 existen en la BD (`OrderState::existsInDatabase(20)` y `OrderState::existsInDatabase(3)`). Si alguno no existe, devuelve `false` con mensaje de error y aborta la instalación.
2. Registra el hook `actionValidateOrder`.

### `uninstall()`

Llama a `parent::uninstall()`, que desregistra los hooks automáticamente. No hay claves de `Configuration` que eliminar porque el token del cron se calcula dinámicamente con `Tools::encrypt()` y nunca se persiste en base de datos.

### `getContent()`

Genera la página de configuración del módulo (accesible desde Admin → Módulos → Configurar). Muestra:
- La URL completa del endpoint de cron con el token resuelto:
  `https://<dominio>/module/recacor_periodocancel/cron?token=<valor>`
- Instrucciones para configurar `ps_cronjobs` con esa URL (frecuencia: 1 min)

Esta página es el único mecanismo disponible para que el administrador obtenga el token, ya que no hay acceso SSH/FTP.

### `hookActionValidateOrder($params)`

- Obtiene el objeto `Order` de `$params['order']`
- **Guard:** solo actúa si `$order->current_state != 20` (evita doble asignación si el hook se dispara más de una vez para el mismo pedido)
- Llama a `$order->setCurrentState(20)` para registrar el cambio en historial, disparar emails configurados y ejecutar hooks relacionados

---

## Componente 2 — `controllers/front/cron.php`

### Validación de token

Compara `Tools::getValue('token')` con `Tools::encrypt('recacor_periodocancel/cron')`.
Si no coincide → responde HTTP 403 y termina.

### Query de elegibilidad

```sql
SELECT id_order
FROM [PREFIX]orders o
WHERE current_state = 20
AND (
  SELECT MAX(date_add)
  FROM [PREFIX]order_history
  WHERE id_order = o.id_order
  AND id_order_state = 20
) <= DATE_SUB(NOW(), INTERVAL 10 MINUTE)
```

> Usar `_DB_PREFIX_` en el código, nunca `ps_` literal. Instalaciones con prefijo distinto fallarían silenciosamente.

**Por qué esta query es correcta:**
- `current_state = 20` asegura que el pedido aún está en Periodo de Cancelación (si un admin lo movió manualmente a otro estado, ya no cumple esta condición y el cron lo ignora correctamente)
- El subquery con `MAX(date_add)` toma la entrada más reciente al estado 20, cubriendo el caso de que el estado haya sido asignado múltiples veces

### Procesamiento

Para cada pedido encontrado:
- Instanciar `new Order((int)$row['id_order'])`
- Llamar `$order->setCurrentState(3)` — esto registra historial, dispara emails configurados para el estado 3 y ejecuta hooks relacionados. **No usar UPDATE directo** ya que bypassa la lógica de PS y no enviaría el email de "Preparación en curso" al cliente si está configurado.

### Respuesta y logging

- Éxito: responde con texto plano `OK — X pedidos procesados` (legible en logs de `ps_cronjobs`)
- Token inválido: HTTP 403, cuerpo `Forbidden`
- Excepción/error DB: capturar con `try/catch`, registrar con `PrestaShopLogger::addLog()` y responder `ERROR — ver logs PS`

---

## Estados de pedido involucrados

| ID | Nombre               | Origen              |
|----|----------------------|---------------------|
| 20 | Periodo de Cancelación | Custom (ya existe) |
|  3 | Preparación en curso   | Nativo PS (ya existe) |

---

## Cron

- **Herramienta:** módulo nativo `ps_cronjobs` (instalado)
- **Frecuencia:** cada 1 minuto
- **URL:** obtenida desde la página de configuración del módulo (Admin → Módulos → Configurar recacor_periodocancel)
- **Token:** `Tools::encrypt('recacor_periodocancel/cron')` — usa `_COOKIE_KEY_` de la instalación. Se calcula una vez en `getContent()` y se muestra al admin.

---

## Deploy

1. Empaquetar el directorio completo (incluyendo `config.xml` y `logo.png`) como `.zip`
2. Admin → Módulos → "Subir un módulo" → seleccionar ZIP
3. Instalar y activar
4. Ir a Admin → Módulos → Configurar → copiar la URL del cron mostrada
5. Configurar `ps_cronjobs` con esa URL, frecuencia 1 minuto

---

## Flujo completo

```
Cliente hace pedido
       ↓
actionValidateOrder hook
       ↓  (si current_state != 20)
Estado → 20 (Periodo de Cancelación)
       ↓
ps_cronjobs llama al endpoint cada minuto
       ↓
¿current_state = 20 Y última entrada en estado 20 hace >10 min?
  → SÍ → setCurrentState(3) → "Preparación en curso" + email + historial
  → NO → sin acción
```

---

## Casos límite

| Caso | Comportamiento |
|------|---------------|
| Admin mueve el pedido a otro estado antes de 10 min | `current_state != 20` → cron lo ignora |
| Hook `actionValidateOrder` se dispara dos veces | Guard `current_state != 20` evita doble asignación |
| Estado 20 ó 3 no existe en la instalación | `install()` devuelve false con error, módulo no se activa |
| Token de cron incorrecto | HTTP 403, sin procesamiento |
| Error de BD en el cron | Excepción capturada, log en PS, respuesta `ERROR` |
