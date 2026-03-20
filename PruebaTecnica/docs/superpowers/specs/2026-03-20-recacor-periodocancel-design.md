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
  recacor_periodocancel.php       ← módulo principal (install, hooks)
  controllers/
    front/
      cron.php                    ← endpoint seguro para el cron job
```

### Componente 1 — `recacor_periodocancel.php`

**Responsabilidades:**
- `install()`: registra el hook `actionValidateOrder`
- `uninstall()`: desregistra hooks
- `hookActionValidateOrder($params)`: asigna estado 20 al pedido recién validado

**Por qué `actionValidateOrder`:** Es el hook que PrestaShop lanza en el momento en que un pedido es validado (pago confirmado), independientemente del método de pago. Es el punto más temprano y fiable para interceptar un pedido nuevo.

### Componente 2 — `controllers/front/cron.php`

**Responsabilidades:**
- Valida el token de seguridad (`Tools::encrypt('recacor_periodocancel/cron')`)
- Consulta la base de datos buscando pedidos elegibles para transición
- Ejecuta el cambio de estado para cada uno

**Query de elegibilidad:**
```sql
SELECT id_order
FROM ps_orders o
WHERE current_state = 20
AND (
  SELECT MAX(date_add)
  FROM ps_order_history
  WHERE id_order = o.id_order
  AND id_order_state = 20
) <= DATE_SUB(NOW(), INTERVAL 10 MINUTE)
```

Lógica: pedidos cuyo estado actual es 20 Y cuya última entrada en ese estado ocurrió hace más de 10 minutos. Usar el MAX de `order_history` garantiza que si el estado 20 fue asignado varias veces, se toma la más reciente.

### Cron

- Herramienta: módulo nativo `ps_cronjobs` (instalado)
- Frecuencia: cada 1 minuto
- URL: `https://<dominio>/module/recacor_periodocancel/cron?token=<token>`
- El token se genera con `Tools::encrypt('recacor_periodocancel/cron')` usando la `_COOKIE_KEY_` de la instalación

### Deploy

1. Empaquetar el directorio del módulo como `.zip`
2. Subir desde Admin → Módulos → "Subir un módulo"
3. Instalar y activar
4. Configurar `ps_cronjobs` con la URL del endpoint (frecuencia: 1 min)

---

## Estados de pedido involucrados

| ID | Nombre               | Origen         |
|----|----------------------|----------------|
| 20 | Periodo de Cancelación | Custom (ya existe) |
|  3 | Preparación en curso   | Nativo PS (ya existe) |

---

## Flujo completo

```
Cliente hace pedido
       ↓
actionValidateOrder hook
       ↓
Estado → 20 (Periodo de Cancelación)
       ↓
ps_cronjobs llama al endpoint cada minuto
       ↓
¿Pedido en estado 20 hace >10 min? → SÍ → Estado → 3 (Preparación en curso)
                                   → NO → No se hace nada
```

---

## Lo que NO hace este módulo

- No crea los estados (ya existen con IDs fijos)
- No modifica el módulo `recacor` existente
- No gestiona cancelaciones manuales (si el usuario cancela manualmente antes de los 10 min, el pedido sale del estado 20 y el cron lo ignora)
