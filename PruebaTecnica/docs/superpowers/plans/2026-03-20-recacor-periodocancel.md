# recacor_periodocancel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear un módulo PrestaShop que asigne estado "Periodo de Cancelación" (ID 20) al validar un pedido y lo transicione a "Preparación en curso" (ID 3) tras 10 minutos vía cron.

**Architecture:** Módulo standalone `recacor_periodocancel` con hook `actionValidateOrder` para asignar el estado inicial, y un front controller `cron.php` protegido por token que ejecuta la transición automática. La URL del cron (con token calculado dinámicamente) se expone al admin desde la página de configuración del módulo.

**Tech Stack:** PHP 7.x, PrestaShop 1.7.8.8, MySQL, módulo nativo `ps_cronjobs`

**Spec:** `docs/superpowers/specs/2026-03-20-recacor-periodocancel-design.md`

---

## File Map

| Archivo | Acción | Responsabilidad |
|---------|--------|-----------------|
| `recacor_periodocancel/recacor_periodocancel.php` | Crear | Módulo principal: constructor, install, uninstall, hook, getContent |
| `recacor_periodocancel/config.xml` | Crear | Metadatos del módulo (requerido por PS para aceptar el ZIP) |
| `recacor_periodocancel/logo.png` | Crear | Logo 32x32 placeholder (requerido por PS) |
| `recacor_periodocancel/controllers/front/cron.php` | Crear | Endpoint seguro del cron job |

> **Nota:** no hay framework de tests unitarios en PS. La verificación se hace en la tienda de pruebas.
> **Deploy:** todo el directorio se empaqueta como ZIP y se sube desde Admin → Módulos → "Subir un módulo".
> **Token del cron:** se calcula dinámicamente con `Tools::encrypt()` en `getContent()`. No se almacena en base de datos.

---

## Task 1: Scaffold del módulo (config.xml, logo.png, shell del módulo)

**Files:**
- Create: `recacor_periodocancel/config.xml`
- Create: `recacor_periodocancel/logo.png`
- Create: `recacor_periodocancel/recacor_periodocancel.php` (shell sin lógica)

- [ ] **Step 1: Crear la estructura de directorios**

```bash
mkdir -p recacor_periodocancel/controllers/front
```

- [ ] **Step 2: Crear `config.xml`**

```xml
<?xml version="1.0" encoding="UTF-8" ?>
<module>
    <name>recacor_periodocancel</name>
    <displayName><![CDATA[Recacor - Periodo de Cancelación]]></displayName>
    <version><![CDATA[1.0.0]]></version>
    <description><![CDATA[Gestiona el periodo de cancelación de pedidos]]></description>
    <author><![CDATA[Recacor]]></author>
    <tab>others</tab>
    <is_configurable>1</is_configurable>
    <need_instance>0</need_instance>
    <limited_countries></limited_countries>
</module>
```

- [ ] **Step 3: Crear `logo.png`**

Generar un PNG 32x32. Desde Python:

```bash
python3 -c "
from PIL import Image
img = Image.new('RGB', (32, 32), color=(70, 130, 180))
img.save('recacor_periodocancel/logo.png')
"
```

Si no hay PIL, copiar cualquier PNG pequeño y renombrarlo como `logo.png`.

- [ ] **Step 4: Crear shell de `recacor_periodocancel.php`**

> **PS 1.7 pattern:** asignar propiedades escalares → llamar `parent::__construct()` → asignar `displayName`/`description` (estos usan `$this->l()` que necesita que el contexto esté inicializado).

```php
<?php
if (!defined('_PS_VERSION_')) {
    exit;
}

class Recacor_Periodocancel extends Module
{
    const STATUS_CANCELACION = 20;
    const STATUS_PREPARACION = 3;

    public function __construct()
    {
        $this->name = 'recacor_periodocancel';
        $this->tab = 'others';
        $this->version = '1.0.0';
        $this->author = 'Recacor';
        $this->need_instance = 0;
        $this->ps_versions_compliancy = ['min' => '1.7.0.0', 'max' => _PS_VERSION_];

        parent::__construct(); // debe ir ANTES de $this->l()

        $this->displayName = $this->l('Recacor - Periodo de Cancelación');
        $this->description = $this->l('Gestiona el periodo de cancelación de pedidos');
    }

    public function install()
    {
        return parent::install();
    }

    public function uninstall()
    {
        return parent::uninstall();
    }
}
```

- [ ] **Step 5: Verificar estructura de archivos**

```bash
find recacor_periodocancel -type f
```

Salida esperada (3 archivos, el directorio `controllers/front/` aparecerá vacío y no se listará):
```
recacor_periodocancel/recacor_periodocancel.php
recacor_periodocancel/config.xml
recacor_periodocancel/logo.png
```

- [ ] **Step 6: Commit**

```bash
git add recacor_periodocancel/
git commit -m "feat: scaffold module recacor_periodocancel"
```

---

## Task 2: install() con validación de estados y registro de hook

**Files:**
- Modify: `recacor_periodocancel/recacor_periodocancel.php`

- [ ] **Step 1: Reemplazar `install()` con validación y registro de hook**

```php
public function install()
{
    if (!OrderState::existsInDatabase(self::STATUS_CANCELACION, 'order_state') ||
        !OrderState::existsInDatabase(self::STATUS_PREPARACION, 'order_state')) {
        $this->_errors[] = $this->l(
            'Los estados de pedido necesarios (ID 20 y ID 3) no existen en la base de datos.'
        );
        return false;
    }

    return parent::install()
        && $this->registerHook('actionValidateOrder');
}
```

- [ ] **Step 2: Verificar sintaxis PHP**

```bash
php -l recacor_periodocancel/recacor_periodocancel.php
```

Salida esperada: `No syntax errors detected`

- [ ] **Step 3: Commit**

```bash
git add recacor_periodocancel/recacor_periodocancel.php
git commit -m "feat: add install validation and hook registration"
```

---

## Task 3: Hook `actionValidateOrder`

**Files:**
- Modify: `recacor_periodocancel/recacor_periodocancel.php`

- [ ] **Step 1: Añadir el método del hook**

```php
public function hookActionValidateOrder($params)
{
    /** @var Order $order */
    $order = $params['order'];

    // Guard: evitar doble asignación si el hook se dispara más de una vez
    // PS actualiza $order->current_state en memoria tras setCurrentState(),
    // por lo que esta comprobación funciona correctamente en llamadas repetidas.
    if ((int)$order->current_state !== self::STATUS_CANCELACION) {
        $order->setCurrentState(self::STATUS_CANCELACION);
    }
}
```

- [ ] **Step 2: Verificar sintaxis PHP**

```bash
php -l recacor_periodocancel/recacor_periodocancel.php
```

Salida esperada: `No syntax errors detected`

- [ ] **Step 3: Commit**

```bash
git add recacor_periodocancel/recacor_periodocancel.php
git commit -m "feat: add hookActionValidateOrder to set cancellation period status"
```

---

## Task 4: Cron controller

**Files:**
- Create: `recacor_periodocancel/controllers/front/cron.php`

- [ ] **Step 1: Crear `controllers/front/cron.php`**

```php
<?php
if (!defined('_PS_VERSION_')) {
    exit;
}

class Recacor_PeriodocancelCronModuleFrontController extends ModuleFrontController
{
    const STATUS_CANCELACION = 20;
    const STATUS_PREPARACION = 3;

    public function __construct()
    {
        parent::__construct();
        // Evitar que PS intente renderizar layout HTML completo
        $this->ajax = true;
    }

    public function initContent()
    {
        header('Content-Type: text/plain');

        // Validar token de seguridad
        if (Tools::getValue('token') !== Tools::encrypt('recacor_periodocancel/cron')) {
            header('HTTP/1.1 403 Forbidden');
            die('Forbidden');
        }

        try {
            // Buscar pedidos en estado 20 cuya última entrada en ese estado fue hace >10 min
            $orders = Db::getInstance()->executeS('
                SELECT o.id_order
                FROM `' . _DB_PREFIX_ . 'orders` o
                WHERE o.current_state = ' . (int)self::STATUS_CANCELACION . '
                AND (
                    SELECT MAX(oh.date_add)
                    FROM `' . _DB_PREFIX_ . 'order_history` oh
                    WHERE oh.id_order = o.id_order
                    AND oh.id_order_state = ' . (int)self::STATUS_CANCELACION . '
                ) <= DATE_SUB(NOW(), INTERVAL 10 MINUTE)
            ');

            $count = 0;
            foreach ($orders as $row) {
                $order = new Order((int)$row['id_order']);
                $order->setCurrentState(self::STATUS_PREPARACION);
                $count++;
            }

            die('OK -- ' . $count . ' pedidos procesados');
        } catch (Exception $e) {
            PrestaShopLogger::addLog(
                'recacor_periodocancel cron error: ' . $e->getMessage(),
                3,       // nivel: error
                null,
                'Order',
                null,
                true
            );
            die('ERROR -- ver logs PS');
        }
    }
}
```

- [ ] **Step 2: Verificar sintaxis PHP**

```bash
php -l recacor_periodocancel/controllers/front/cron.php
```

Salida esperada: `No syntax errors detected`

- [ ] **Step 3: Commit**

```bash
git add recacor_periodocancel/controllers/front/cron.php
git commit -m "feat: add cron front controller for automatic status transition"
```

---

## Task 5: Página de configuración `getContent()`

**Files:**
- Modify: `recacor_periodocancel/recacor_periodocancel.php`

- [ ] **Step 1: Añadir `getContent()` al módulo**

> **PS translation pattern:** el texto traducible va dentro de `$this->l()`. El HTML va fuera, concatenado. Nunca mezclar HTML dentro de `$this->l()`.

```php
public function getContent()
{
    $token = Tools::encrypt('recacor_periodocancel/cron');
    $cronUrl = $this->context->link->getModuleLink(
        $this->name,
        'cron',
        ['token' => $token],
        true
    );

    return '
        <div class="panel">
            <div class="panel-heading">
                <i class="icon-cogs"></i> ' . $this->l('Configuración del Cron') . '
            </div>
            <div class="panel-body">
                <p>'
                    . $this->l('Configura el módulo') . ' <strong>ps_cronjobs</strong> '
                    . $this->l('con la siguiente URL y frecuencia de 1 minuto:')
                . '</p>
                <div class="well">
                    <code style="word-break:break-all;">' . htmlspecialchars($cronUrl) . '</code>
                </div>
                <p class="text-muted">'
                    . $this->l('Esta URL transiciona automáticamente los pedidos en "Periodo de Cancelación" de más de 10 minutos a "Preparación en curso".')
                . '</p>
                <hr>
                <h4>' . $this->l('Pasos para configurar ps_cronjobs:') . '</h4>
                <ol>
                    <li>' . $this->l('Ir a Admin → Módulos → buscar "Cron tasks manager" → Configurar') . '</li>
                    <li>' . $this->l('Añadir nueva tarea con la URL de arriba') . '</li>
                    <li>' . $this->l('Frecuencia: cada 1 minuto') . '</li>
                    <li>' . $this->l('Guardar') . '</li>
                </ol>
            </div>
        </div>';
}
```

- [ ] **Step 2: Verificar sintaxis PHP**

```bash
php -l recacor_periodocancel/recacor_periodocancel.php
```

Salida esperada: `No syntax errors detected`

- [ ] **Step 3: Commit**

```bash
git add recacor_periodocancel/recacor_periodocancel.php
git commit -m "feat: add getContent config page showing cron URL"
```

---

## Task 6: Empaquetar y desplegar en PrestaShop

**Files:** ninguno nuevo — empaquetado del directorio existente

- [ ] **Step 1: Crear el ZIP del módulo**

En Windows (PowerShell):
```powershell
Compress-Archive -Path recacor_periodocancel -DestinationPath recacor_periodocancel.zip -Force
```

En Linux/Mac:
```bash
zip -r recacor_periodocancel.zip recacor_periodocancel/
```

- [ ] **Step 2: Subir el módulo al admin de PrestaShop**

1. Ir a `https://recacor.gifted-feistel.45-13-185-75.plesk.page/admin_RE0323`
2. Admin → Módulos → Gestor de módulo
3. Clic en "Subir un módulo"
4. Seleccionar `recacor_periodocancel.zip`
5. Verificar que no aparece error de ZIP inválido

- [ ] **Step 3: Instalar el módulo**

En la lista de módulos, buscar "Recacor - Periodo de Cancelación" y clic en "Instalar".

Verificar: no aparece error. Si aparece "estados no encontrados", los IDs 20 y 3 no existen en esa instalación.

- [ ] **Step 4: Obtener la URL del cron**

Admin → Módulos → Gestor de módulo → Configurar → "Recacor - Periodo de Cancelación"

Verificar que la página muestra una URL en la caja de código. Copiarla.

- [ ] **Step 5: Configurar ps_cronjobs**

1. Admin → Módulos → buscar "Cron tasks manager" → Configurar
2. Añadir nueva tarea:
   - URL: pegar la URL copiada en Step 4
   - Frecuencia: cada 1 minuto
3. Guardar

- [ ] **Step 6: Commit del ZIP**

```bash
git add recacor_periodocancel.zip
git commit -m "build: add deployable module ZIP v1.0.0"
```

---

## Task 7: Verificación end-to-end

- [ ] **Step 1: Verificar token inválido devuelve 403**

Abrir en el navegador la URL del cron **sin** el parámetro `token` (o con un token incorrecto):
```
https://recacor.gifted-feistel.45-13-185-75.plesk.page/module/recacor_periodocancel/cron
```
Resultado esperado: respuesta `Forbidden` (HTTP 403).

- [ ] **Step 2: Realizar un pedido de prueba**

1. Ir a `https://recacor.gifted-feistel.45-13-185-75.plesk.page/13-cubierta-de-camion`
2. Añadir una cubierta al carrito y completar el proceso de compra

- [ ] **Step 3: Verificar estado inicial**

Admin → Pedidos → buscar el pedido recién creado.
Verificar que el estado es **"Periodo de Cancelación"** (ID 20).

- [ ] **Step 4: Forzar el cron y verificar transición**

Abrir la URL del cron (con token correcto, obtenida en Task 6 Step 4) en el navegador.
Resultado esperado: `OK -- 1 pedidos procesados`

Volver al pedido en el admin y verificar que el estado es ahora **"Preparación en curso"** (ID 3).

- [ ] **Step 5: Verificar historial del pedido**

En el detalle del pedido, comprobar que el historial muestra en orden:
1. "Periodo de Cancelación"
2. "Preparación en curso"

- [ ] **Step 6: Verificar que la cancelación manual bloquea la transición**

1. Realizar un segundo pedido de prueba
2. Verificar que entra en "Periodo de Cancelación"
3. Cambiar manualmente el estado a "Cancelado" desde el admin antes de llamar al cron
4. Llamar al cron de nuevo
5. Verificar que el pedido permanece en "Cancelado" (el cron lo ignoró porque `current_state != 20`)

---

## Resumen de archivos finales

```
recacor_periodocancel/
  recacor_periodocancel.php   ← constructor (PS 1.7 pattern), install, uninstall,
                                 hookActionValidateOrder, getContent
  config.xml                  ← metadatos para PS (obligatorio para upload ZIP)
  logo.png                    ← imagen 32x32 (obligatorio para upload ZIP)
  controllers/
    front/
      cron.php                ← ajax=true, token guard, query con _DB_PREFIX_,
                                 setCurrentState, logging, respuestas plain text
```
